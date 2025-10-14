import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from 'ws';
import { 
  insertEarningSchema, 
  users, 
  earnings, 
  referrals, 
  referralCommissions,
  withdrawals,
  userBalances,
  dailyTasks
} from "../shared/schema";
import { db } from "./db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import crypto from "crypto";
import { sendTelegramMessage, sendUserTelegramNotification, sendWelcomeMessage, handleTelegramMessage, setupTelegramWebhook, verifyChannelMembership } from "./telegram";
import { authenticateTelegram, requireAuth } from "./auth";

// Store WebSocket connections for real-time updates
// Map: sessionId -> { socket: WebSocket, userId: string }
const connectedUsers = new Map<string, { socket: WebSocket; userId: string }>();

// Function to verify session token against PostgreSQL sessions table
async function verifySessionToken(sessionToken: string): Promise<{ isValid: boolean; userId?: string }> {
  try {
    const { pool } = await import('./db');
    
    // Query the sessions table to find the session
    const result = await pool.query(
      'SELECT sess, expire FROM sessions WHERE sid = $1',
      [sessionToken]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Session not found in database:', sessionToken);
      return { isValid: false };
    }
    
    const sessionRow = result.rows[0];
    const sessionData = sessionRow.sess;
    const expireTime = new Date(sessionRow.expire);
    
    // Check if session has expired
    if (expireTime <= new Date()) {
      console.log('❌ Session expired:', sessionToken);
      return { isValid: false };
    }
    
    // Extract user information from session data
    // Session data structure from connect-pg-simple typically contains passport user data
    let userId: string | undefined;
    
    if (sessionData && typeof sessionData === 'object') {
      // Try different possible session data structures
      if (sessionData.user && sessionData.user.user && sessionData.user.user.id) {
        // Structure: { user: { user: { id: "uuid", ... } } }
        userId = sessionData.user.user.id;
      } else if (sessionData.user && sessionData.user.id) {
        // Structure: { user: { id: "uuid", ... } }
        userId = sessionData.user.id;
      } else if (sessionData.passport && sessionData.passport.user) {
        // Structure: { passport: { user: "userId" } }
        userId = sessionData.passport.user;
      }
    }
    
    if (!userId) {
      console.log('❌ No user ID found in session data:', sessionToken);
      return { isValid: false };
    }
    
    console.log(`✅ Session verified for user: ${userId}`);
    return { isValid: true, userId };
    
  } catch (error) {
    console.error('❌ Session verification error:', error);
    return { isValid: false };
  }
}

// Helper function to send real-time updates to a user
function sendRealtimeUpdate(userId: string, update: any) {
  let messagesSent = 0;
  
  // Find ALL sessions for this user and send to each one
  for (const [sessionId, connection] of connectedUsers.entries()) {
    if (connection.userId === userId && connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(update));
        messagesSent++;
        console.log(`📤 Sent update to user ${userId}, session ${sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to send update to user ${userId}, session ${sessionId}:`, error);
        // Remove dead connection
        connectedUsers.delete(sessionId);
      }
    }
  }
  
  console.log(`📊 Sent real-time update to ${messagesSent} sessions for user ${userId}`);
  return messagesSent > 0;
}

// Broadcast update to all connected users
function broadcastUpdate(update: any) {
  connectedUsers.forEach((connection, userId) => {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(update));
    }
  });
}

// Check if user is admin
const isAdmin = (telegramId: string): boolean => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  if (!adminId) {
    console.warn('⚠️ TELEGRAM_ADMIN_ID not set - admin access disabled');
    return false;
  }
  // Ensure both values are strings for comparison
  return adminId.toString() === telegramId.toString();
};

// Admin authentication middleware
const authenticateAdmin = async (req: any, res: any, next: any) => {
  try {
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
    // Development mode: Allow admin access for test user
    if (process.env.NODE_ENV === 'development' && !telegramData) {
      console.log('🔧 Development mode: Granting admin access to test user');
      req.user = { 
        telegramUser: { 
          id: '123456789',
          username: 'testuser',
          first_name: 'Test',
          last_name: 'Admin'
        } 
      };
      return next();
    }
    
    if (!telegramData) {
      return res.status(401).json({ message: "Admin access denied" });
    }

    const urlParams = new URLSearchParams(telegramData);
    const userString = urlParams.get('user');
    
    if (!userString) {
      return res.status(401).json({ message: "Invalid Telegram data" });
    }

    const telegramUser = JSON.parse(userString);
    
    if (!isAdmin(telegramUser.id.toString())) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.user = { telegramUser };
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Authentication middleware has been moved to server/auth.ts for better organization


export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Registering API routes...');
  
  // Create HTTP server first
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('🔌 New WebSocket connection established');
    let sessionId: string | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        if (data.type === 'auth') {
          if (!data.sessionToken) {
            console.log('❌ Missing sessionToken in auth message');
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Missing sessionToken. Expected format: {"type": "auth", "sessionToken": "<token>"}'
            }));
            return;
          }

          // Verify session token securely
          try {
            // In development mode ONLY, allow test user authentication
            if (process.env.NODE_ENV === 'development' && data.sessionToken === 'test-session') {
              const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
              sessionId = `session_${Date.now()}_${Math.random()}`;
              connectedUsers.set(sessionId, { socket: ws, userId: testUserId });
              console.log(`👤 Test user connected via WebSocket: ${testUserId}`);
              
              ws.send(JSON.stringify({
                type: 'connected',
                message: 'Real-time updates enabled! 🚀'
              }));
              return;
            }
            
            // Production mode: Verify session token against PostgreSQL sessions table
            const { isValid, userId } = await verifySessionToken(data.sessionToken);
            
            if (!isValid || !userId) {
              console.log(`❌ WebSocket authentication failed for token: ${data.sessionToken}`);
              ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Invalid or expired session. Please refresh the page and try again.'
              }));
              return;
            }
            
            // Session verified successfully - establish WebSocket connection
            sessionId = `session_${Date.now()}_${Math.random()}`;
            connectedUsers.set(sessionId, { socket: ws, userId });
            console.log(`👤 User ${userId} connected via WebSocket (verified session)`);
            
            ws.send(JSON.stringify({
              type: 'connected',
              message: 'Real-time updates enabled! 🚀',
              userId: userId
            }));
          } catch (authError) {
            console.error('❌ WebSocket auth error:', authError);
            ws.send(JSON.stringify({
              type: 'auth_error', 
              message: 'Authentication failed'
            }));
          }
        } else if (data.type === 'ping') {
          // Handle ping messages
          ws.send(JSON.stringify({ type: 'pong' }));
        } else {
          // Handle invalid message types
          console.log(`❌ Invalid WebSocket message type: ${data.type || 'undefined'}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Invalid message type. Expected "auth" but received "${data.type || 'undefined'}". Format: {"type": "auth", "sessionToken": "<token>"}`
          }));
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON format. Expected: {"type": "auth", "sessionToken": "<token>"}'
        }));
      }
    });
    
    ws.on('close', () => {
      // Remove session from connected list
      if (sessionId) {
        const connection = connectedUsers.get(sessionId);
        if (connection) {
          connectedUsers.delete(sessionId);
          console.log(`👋 User ${connection.userId} disconnected from WebSocket`);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });
  
  // Simple test route to verify routing works
  app.get('/api/test', (req: any, res) => {
    console.log('✅ Test route called!');
    res.json({ status: 'API routes working!', timestamp: new Date().toISOString() });
  });

  // Debug route to check database columns
  app.get('/api/debug/db-schema', async (req: any, res) => {
    try {
      const { pool } = await import('./db');
      
      // Check what columns exist in users table
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `);
      
      res.json({ 
        success: true, 
        columns: result.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Schema check failed:', error);
      res.status(500).json({ 
        success: false, 
        error: (error as Error).message
      });
    }
  });

  // Removed deprecated manual database setup - use proper Drizzle migrations instead

  // Removed deprecated schema fix routes - use Drizzle migrations instead
  
  // Telegram Bot Webhook endpoint - MUST be first to avoid Vite catch-all interference
  app.post('/api/telegram/webhook', async (req: any, res) => {
    try {
      const update = req.body;
      console.log('📨 Received Telegram update:', JSON.stringify(update, null, 2));
      
      // Verify the request is from Telegram (optional but recommended)
      // You can add signature verification here if needed
      
      const handled = await handleTelegramMessage(update);
      console.log('✅ Message handled:', handled);
      
      if (handled) {
        res.status(200).json({ ok: true });
      } else {
        res.status(200).json({ ok: true, message: 'No action taken' });
      }
    } catch (error) {
      console.error('❌ Telegram webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Function to verify Telegram WebApp initData with HMAC-SHA256
  function verifyTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; user?: any } {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        return { isValid: false };
      }
      
      // Remove hash from params for verification
      urlParams.delete('hash');
      
      // Sort parameters and create data check string
      const sortedParams = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Create secret key from bot token
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      
      // Calculate expected hash
      const expectedHash = crypto.createHmac('sha256', secretKey).update(sortedParams).digest('hex');
      
      // Verify hash
      const isValid = expectedHash === hash;
      
      if (isValid) {
        const userString = urlParams.get('user');
        if (userString) {
          try {
            const user = JSON.parse(userString);
            return { isValid: true, user };
          } catch (parseError) {
            console.error('Error parsing user data:', parseError);
            return { isValid: false };
          }
        }
      }
      
      return { isValid };
    } catch (error) {
      console.error('Error verifying Telegram data:', error);
      return { isValid: false };
    }
  }

  // New Telegram WebApp authentication route
  app.post('/api/auth/telegram', async (req: any, res) => {
    try {
      const { initData } = req.body;
      
      if (!initData) {
        return res.status(400).json({ message: 'Missing initData' });
      }
      
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ message: 'Bot token not configured' });
      }
      
      // Verify the initData with HMAC-SHA256
      const { isValid, user: telegramUser } = verifyTelegramWebAppData(initData, botToken);
      
      if (!isValid || !telegramUser) {
        return res.status(401).json({ message: 'Invalid Telegram authentication data' });
      }
      
      // Use upsertTelegramUser method which properly handles telegram_id
      const { user: upsertedUser, isNewUser } = await storage.upsertTelegramUser(telegramUser.id.toString(), {
        email: `${telegramUser.username || telegramUser.id}@telegram.user`,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        personalCode: telegramUser.username || telegramUser.id.toString(),
        withdrawBalance: '0',
        totalEarnings: '0',
        adsWatched: 0,
        dailyAdsWatched: 0,
        dailyEarnings: '0',
        level: 1,
        flagged: false,
        banned: false,
        referralCode: '',
      });
      
      // Send welcome message to new users
      if (isNewUser) {
        try {
          await sendWelcomeMessage(telegramUser.id.toString());
        } catch (welcomeError) {
          console.error('Error sending welcome message:', welcomeError);
          // Don't fail authentication if welcome message fails
        }
      }
      
      res.json(upsertedUser);
    } catch (error) {
      console.error('Telegram authentication error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });

  // Session token endpoint for WebSocket authentication
  app.get('/api/auth/session-token', authenticateTelegram, async (req: any, res) => {
    try {
      let sessionToken: string;
      
      // Development mode: Return predictable test token
      if (process.env.NODE_ENV === 'development' || process.env.REPL_ID) {
        sessionToken = 'test-session';
        console.log('🔧 Development mode: Returning test session token');
      } else {
        // Production mode: Always use Express session ID
        if (!req.sessionID) {
          console.error('❌ No session ID found - session not created properly');
          return res.status(500).json({ 
            message: 'Session not established',
            error: 'Express session not found'
          });
        }
        
        sessionToken = req.sessionID;
        console.log('🔐 Production mode: Using Express session ID for WebSocket auth:', sessionToken);
      }
      
      res.json({ 
        sessionToken,
        message: 'Session token generated successfully'
      });
    } catch (error) {
      console.error('❌ Error generating session token:', error);
      res.status(500).json({ 
        message: 'Failed to generate session token',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Auth routes
  app.get('/api/auth/user', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id; // Use the database UUID, not Telegram ID
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Ensure referralCode exists
      if (!user.referralCode) {
        await storage.generateReferralCode(userId);
        const updatedUser = await storage.getUser(userId);
        user.referralCode = updatedUser?.referralCode || '';
      }
      
      // Add referral link with fallback bot username
      const botUsername = process.env.BOT_USERNAME || "LightningSatsbot";
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
      
      res.json({
        ...user,
        referralLink
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Ad watching endpoint - 200 ads per day limit
  app.post('/api/ads/watch', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { adType } = req.body;
      
      // Get user to check daily ad limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Enforce 200 ads per day limit
      const adsWatchedToday = user.adsWatchedToday || 0;
      if (adsWatchedToday >= 200) {
        return res.status(429).json({ 
          message: "Daily ad limit reached. You can watch up to 200 ads per day.",
          limit: 200,
          watched: adsWatchedToday
        });
      }
      
      // Add earning for watched ad with new rate (30 PAD = 0.0003 TON)
      const adRewardTON = "0.00030000";
      const adRewardPAD = Math.round(parseFloat(adRewardTON) * 100000);
      
      const earning = await storage.addEarning({
        userId,
        amount: adRewardTON,
        source: 'ad_watch',
        description: 'Watched advertisement',
      });
      
      // Increment ads watched count
      await storage.incrementAdsWatched(userId);
      
      // Check and activate referral bonuses (anti-fraud: requires 10 ads)
      await storage.checkAndActivateReferralBonus(userId);
      
      // Process 10% referral commission for referrer (if user was referred)
      if (user.referredBy) {
        const referralCommissionTON = (parseFloat(adRewardTON) * 0.1).toFixed(8);
        await storage.addEarning({
          userId: user.referredBy,
          amount: referralCommissionTON,
          source: 'referral_commission',
          description: `10% commission from ${user.username || user.telegram_id}'s ad watch`,
        });
      }
      
      // Get updated balance
      const updatedUser = await storage.getUser(userId);
      const balancePAD = Math.round(parseFloat(updatedUser?.balance || "0") * 100000);
      
      // Send real-time update to user
      sendRealtimeUpdate(userId, {
        type: 'ad_reward',
        amount: adRewardTON,
        message: 'Ad reward earned!',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true, 
        rewardPAD: adRewardPAD,
        balance: balancePAD
      });
    } catch (error) {
      console.error("Error processing ad watch:", error);
      res.status(500).json({ message: "Failed to process ad reward" });
    }
  });

  // Check channel membership endpoint
  app.get('/api/streak/check-membership', authenticateTelegram, async (req: any, res) => {
    try {
      const telegramId = req.user.user.telegram_id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        if (process.env.NODE_ENV === 'development') {
          return res.json({ 
            success: true,
            isMember: true,
            channelUsername: '@PaidAdsNews',
            message: 'Development mode: membership check bypassed'
          });
        }
        
        console.error('❌ TELEGRAM_BOT_TOKEN not configured');
        return res.status(500).json({ 
          isMember: false, 
          message: 'Bot token not configured' 
        });
      }
      
      // Check membership for @PaidAdsNews channel
      const isMember = await verifyChannelMembership(
        parseInt(telegramId), 
        '@PaidAdsNews', 
        botToken
      );
      
      res.json({ 
        success: true,
        isMember,
        channelUsername: '@PaidAdsNews'
      });
    } catch (error) {
      console.error("Error checking channel membership:", error);
      res.json({ 
        success: false,
        isMember: false,
        message: 'Failed to verify membership' 
      });
    }
  });

  // Streak claim endpoint
  app.post('/api/streak/claim', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const telegramId = req.user.user.telegram_id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      // Verify channel membership before allowing claim
      if (botToken) {
        const isMember = await verifyChannelMembership(
          parseInt(telegramId), 
          '@PaidAdsNews', 
          botToken
        );
        
        if (!isMember) {
          return res.status(403).json({ 
            success: false,
            message: 'You must join our channel to claim daily rewards',
            requiresChannelJoin: true
          });
        }
      } else if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({ 
          success: false,
          message: 'Channel verification not available. Please contact support.'
        });
      }
      
      const result = await storage.updateUserStreak(userId);
      
      if (parseFloat(result.rewardEarned) === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'You have already claimed your daily reward. Come back in 24 hours!'
        });
      }
      
      sendRealtimeUpdate(userId, {
        type: 'streak_reward',
        amount: result.rewardEarned,
        message: result.isBonusDay ? '🎉 5-day streak bonus!' : '✅ Daily streak claimed!',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true,
        newStreak: result.newStreak,
        rewardEarned: result.rewardEarned,
        isBonusDay: result.isBonusDay,
        message: result.isBonusDay ? 'Congratulations! You completed a 5-day streak!' : 'Streak updated successfully'
      });
    } catch (error) {
      console.error("Error processing streak:", error);
      res.status(500).json({ message: "Failed to process streak" });
    }
  });



  // Legacy task eligibility endpoint removed - using daily tasks system only

  // User stats endpoint
  app.get('/api/user/stats', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Referral stats endpoint
  app.get('/api/referrals/stats', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const referrals = await storage.getUserReferrals(userId);
      const referralEarnings = await storage.getUserReferralEarnings(userId);
      const earningsByLevel = await storage.getUserReferralEarningsByLevel(userId);
      
      res.json({
        referralCount: referrals.length,
        referralEarnings: referralEarnings,
        level1Earnings: earningsByLevel.level1,
        level2Earnings: earningsByLevel.level2
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Search referral by code endpoint
  app.get('/api/referrals/search/:code', authenticateTelegram, async (req: any, res) => {
    try {
      const currentUserId = req.user.user.id;
      const searchCode = req.params.code;

      // Find user by referral code
      const referralUser = await storage.getUserByReferralCode(searchCode);
      
      if (!referralUser) {
        return res.status(404).json({ message: "Referral not found" });
      }

      // Check if this referral belongs to the current user
      const referralRelationship = await storage.getReferralByUsers(currentUserId, referralUser.id);
      
      if (!referralRelationship) {
        return res.status(403).json({ message: "This referral does not belong to you" });
      }

      // Get referral stats
      const referralEarnings = await storage.getUserStats(referralUser.id);
      const referralCount = await storage.getUserReferrals(referralUser.id);

      res.json({
        id: searchCode,
        earnedToday: referralEarnings.todayEarnings || "0.00",
        allTime: referralUser.totalEarned || "0.00",
        invited: referralCount.length,
        joinedAt: referralRelationship.createdAt
      });
    } catch (error) {
      console.error("Error searching referral:", error);
      res.status(500).json({ message: "Failed to search referral" });
    }
  });

  // Earnings history endpoint
  app.get('/api/earnings', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const earnings = await storage.getUserEarnings(userId, limit);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });





  // Debug endpoint for referral issues
  app.get('/api/debug/referrals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get user info
      const user = await storage.getUser(userId);
      
      // Get all earnings for this user
      const userEarnings = await db
        .select()
        .from(earnings)
        .where(eq(earnings.userId, userId))
        .orderBy(desc(earnings.createdAt));
      
      // Get referrals where user is referrer
      const myReferrals = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerId, userId));
      
      // Get referrals where user is referee  
      const referredBy = await db
        .select()
        .from(referrals)
        .where(eq(referrals.refereeId, userId));
      
      res.json({
        user: {
          id: user?.id,
          referralCode: user?.referralCode,
          balance: user?.balance,
          totalEarned: user?.totalEarned
        },
        earnings: userEarnings,
        myReferrals: myReferrals,
        referredBy: referredBy,
        counts: {
          totalEarnings: userEarnings.length,
          referralEarnings: userEarnings.filter(e => e.source === 'referral').length,
          commissionEarnings: userEarnings.filter(e => e.source === 'referral_commission').length,
          adEarnings: userEarnings.filter(e => e.source === 'ad_watch').length
        }
      });
    } catch (error) {
      console.error("Debug referrals error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Production database fix endpoint - run once to fix referrals
  app.post('/api/fix-production-referrals', async (req: any, res) => {
    try {
      console.log('🔧 Fixing production referral system...');
      
      // 1. Update existing referral bonuses from $0.50 to $0.01
      console.log('📝 Updating referral bonus amounts...');
      await db.execute(sql`
        UPDATE ${earnings} 
        SET amount = '0.01', 
            description = REPLACE(description, '$0.50', '$0.01')
        WHERE source = 'referral' 
        AND amount = '0.50'
      `);
      
      // 2. Ensure referrals table has correct default
      console.log('🔧 Updating referrals table...');
      await db.execute(sql`
        ALTER TABLE ${referrals} 
        ALTER COLUMN reward_amount SET DEFAULT 0.01
      `);
      
      // 3. Update existing pending referrals to new amount
      await db.execute(sql`
        UPDATE ${referrals} 
        SET reward_amount = '0.01' 
        WHERE reward_amount = '0.50'
      `);
      
      // 4. Generate referral codes for users who don't have them
      console.log('🔑 Generating missing referral codes...');
      const usersWithoutCodes = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.referralCode} IS NULL OR ${users.referralCode} = ''`);
      
      for (const user of usersWithoutCodes) {
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await db
          .update(users)
          .set({ referralCode })
          .where(eq(users.id, user.id));
      }
      
      // 5. Get stats for response
      const totalReferralEarnings = await db
        .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
        .from(earnings)
        .where(eq(earnings.source, 'referral'));
      
      const totalReferrals = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals);
      
      console.log('✅ Production referral system fixed successfully!');
      
      res.json({
        success: true,
        message: 'Production referral system fixed successfully!',
        changes: {
          updatedReferralBonuses: 'Changed from $0.50 to $0.01',
          totalReferralEarnings: totalReferralEarnings[0]?.total || '0',
          totalReferrals: totalReferrals[0]?.count || 0,
          generatedReferralCodes: usersWithoutCodes.length
        }
      });
      
    } catch (error) {
      console.error('❌ Error fixing production referrals:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  
  // ===== NEW SIMPLE TASK SYSTEM =====
  
  // Get user's daily tasks (new system)
  app.get('/api/tasks/daily', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get user's current ads count
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const adsWatchedToday = user?.adsWatchedToday || 0;
      
      // Get daily tasks
      const tasks = await storage.getUserDailyTasks(userId);
      
      res.json({
        success: true,
        tasks: tasks.map(task => ({
          id: task.id,
          level: task.taskLevel,
          title: `Watch ${task.required} ads`,
          description: `Watch ${task.required} ads to earn ${parseFloat(task.rewardAmount).toFixed(5)} TON`,
          required: task.required,
          progress: task.progress,
          completed: task.completed,
          claimed: task.claimed,
          rewardAmount: task.rewardAmount,
          canClaim: task.completed && !task.claimed,
        })),
        adsWatchedToday,
        resetInfo: {
          nextReset: "00:00 UTC",
          resetDate: new Date().toISOString().split('T')[0]
        }
      });
      
    } catch (error) {
      console.error('Error fetching daily tasks:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch daily tasks' 
      });
    }
  });
  
  // Claim a task reward
  app.post('/api/tasks/claim/:taskLevel', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const taskLevel = parseInt(req.params.taskLevel);
      
      if (!taskLevel || taskLevel < 1 || taskLevel > 9) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid task level' 
        });
      }
      
      const result = await storage.claimTaskReward(userId, taskLevel);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          rewardAmount: result.rewardAmount
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
      
    } catch (error) {
      console.error('Error claiming task:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to claim task reward' 
      });
    }
  });

  // Old task system removed - using daily tasks system only

  // ================================
  // NEW TASK SYSTEM ENDPOINTS
  // ================================

  // Get all task statuses for user
  app.get('/api/tasks/status', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Define hardcoded daily tasks that exactly match live system format
      // Fixed timestamp to prevent ordering issues
      const fallbackTimestamp = new Date('2025-09-18T11:15:16.000Z');
      
      const hardcodedDailyTasks = [
        {
          id: 'channel-visit-check-update',
          type: 'channel_visit',
          title: 'Channel visit (Check Update)',
          description: 'Visit our Telegram channel for updates and news',
          rewardPerUser: '0.00015000', // 8-decimal format to match live API
          url: 'https://t.me/PaidAdsNews',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'app-link-share',
          type: 'share_link', 
          title: 'App link share (Share link)',
          description: 'Share your affiliate link with friends',
          rewardPerUser: '0.00020000', // 8-decimal format to match live API
          url: 'share://referral',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'invite-friend-valid',
          type: 'invite_friend',
          title: 'Invite friend (valid)',
          description: 'Invite 1 valid friend to earn rewards',
          rewardPerUser: '0.00050000', // 8-decimal format to match live API
          url: 'invite://friend',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'ads-goal-mini',
          type: 'ads_goal_mini',
          title: 'Mini (Watch 15 ads)',
          description: 'Watch 15 ads to complete this daily goal',
          rewardPerUser: '0.00045000', // 8-decimal format to match live API
          url: 'watch://ads/mini',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'ads-goal-light',
          type: 'ads_goal_light',
          title: 'Light (Watch 25 ads)',
          description: 'Watch 25 ads to complete this daily goal',
          rewardPerUser: '0.00060000', // 8-decimal format to match live API
          url: 'watch://ads/light',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'ads-goal-medium',
          type: 'ads_goal_medium',
          title: 'Medium (Watch 45 ads)',
          description: 'Watch 45 ads to complete this daily goal',
          rewardPerUser: '0.00070000', // 8-decimal format to match live API
          url: 'watch://ads/medium',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        },
        {
          id: 'ads-goal-hard',
          type: 'ads_goal_hard',
          title: 'Hard (Watch 75 ads)',
          description: 'Watch 75 ads to complete this daily goal',
          rewardPerUser: '0.00080000', // 8-decimal format to match live API
          url: 'watch://ads/hard',
          limit: 100000,
          claimedCount: 0,
          status: 'active',
          isApproved: true,
          channelMessageId: null,
          createdAt: fallbackTimestamp
        }
      ];
      
      // Get active promotions from database (if any) - only show approved promotions
      let activeTasks = [];
      try {
        activeTasks = await db
          .select({
            id: promotions.id,
            type: promotions.type,
            url: promotions.url,
            rewardPerUser: promotions.rewardPerUser,
            limit: promotions.limit,
            claimedCount: promotions.claimedCount,
            title: promotions.title,
            description: promotions.description,
            channelMessageId: promotions.channelMessageId,
            createdAt: promotions.createdAt
          })
          .from(promotions)
          .where(and(
            eq(promotions.status, 'active'),
            eq(promotions.isApproved, true), // Only show admin-approved promotions
            sql`${promotions.claimedCount} < ${promotions.limit}`
          ))
          .orderBy(desc(promotions.createdAt));
      } catch (dbError) {
        console.log('⚠️ Database query failed, using hardcoded tasks only:', dbError);
        activeTasks = [];
      }
      
      // Use hardcoded tasks only if database has no active tasks
      let allTasks = [];
      
      if (activeTasks.length === 0) {
        console.log('🔄 Database empty, using hardcoded daily tasks fallback');
        allTasks = hardcodedDailyTasks;
      } else {
        allTasks = activeTasks;
      }
      
      // Check which tasks user has already completed
      const completedIds = new Set<string>();
      
      // Calculate current task date using 12:00 PM UTC reset logic
      const getCurrentTaskDate = (): string => {
        const now = new Date();
        const resetHour = 12; // 12:00 PM UTC
        
        // If current time is before 12:00 PM UTC, use yesterday's date
        if (now.getUTCHours() < resetHour) {
          now.setUTCDate(now.getUTCDate() - 1);
        }
        
        return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
      };
      
      const currentTaskDate = getCurrentTaskDate();
      
      // Query non-daily task completions from taskCompletions table
      try {
        const nonDailyCompletions = await db
          .select({ promotionId: taskCompletions.promotionId })
          .from(taskCompletions)
          .where(eq(taskCompletions.userId, userId));
        
        // Add non-daily completed tasks (permanently hidden)
        for (const completion of nonDailyCompletions) {
          const task = allTasks.find(t => t.id === completion.promotionId);
          const isDailyTask = task && ['channel_visit', 'share_link', 'invite_friend', 'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard', 'daily'].includes(task.type);
          
          if (!isDailyTask) {
            // Only add non-daily tasks to completed set
            completedIds.add(completion.promotionId);
          }
        }
      } catch (dbError) {
        console.log('⚠️ Task completions query failed, continuing without completion check:', dbError);
      }
      
      // Query daily task completions from dailyTasks table for today only
      try {
        const dailyCompletions = await db
          .select({ promotionId: dailyTasks.promotionId })
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.completionDate, currentTaskDate)
          ));
        
        // Add daily completed tasks (hidden until tomorrow's reset at 12:00 PM UTC)
        for (const completion of dailyCompletions) {
          completedIds.add(completion.promotionId);
        }
      } catch (dbError) {
        console.log('⚠️ Daily task completions query failed, continuing without daily completion check:', dbError);
      }
      
      // Filter out completed tasks and generate proper task links
      const availableTasks = allTasks
        .filter(task => !completedIds.has(task.id))
        .map(task => {
          // Extract username from URL for link generation
          const urlMatch = task.url?.match(/t\.me\/([^/?]+)/);
          const username = urlMatch ? urlMatch[1] : null;
          
          let channelPostUrl = null;
          let claimUrl = null;
          
          if (task.type === 'channel' && username) {
            // Use channel message ID if available, otherwise fallback to channel URL
            if (task.channelMessageId) {
              channelPostUrl = `https://t.me/${username}/${task.channelMessageId}`;
            } else {
              channelPostUrl = `https://t.me/${username}`;
            }
            claimUrl = channelPostUrl;
          } else if (task.type === 'bot' && username) {
            // Bot deep link with task ID
            claimUrl = `https://t.me/${username}?start=task_${task.id}`;
          } else if (task.type === 'daily' && username) {
            // Daily task using channel link
            claimUrl = `https://t.me/${username}`;
          } else if (task.type === 'channel_visit' && username) {
            // Channel visit task
            claimUrl = `https://t.me/${username}`;
          } else if (task.type === 'share_link' && username) {
            // Share link task
            claimUrl = `https://t.me/${username}`;
          } else if (task.type === 'invite_friend' && username) {
            // Invite friend task
            claimUrl = `https://t.me/${username}`;
          } else if (task.type.startsWith('ads_goal_')) {
            // Ads goal tasks don't need external URLs
            claimUrl = 'internal://ads-goal';
          }
          
          return {
            ...task,
            reward: task.rewardPerUser, // Map rewardPerUser to reward for frontend compatibility
            channelPostUrl,
            claimUrl,
            username // Include username for mobile fallback
          };
        });
      
      res.json({
        success: true,
        tasks: availableTasks,
        total: availableTasks.length
      });
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      
      // Fallback: Return hardcoded daily tasks with exact format matching
      const fallbackDailyTasks = hardcodedDailyTasks.map(task => ({
        ...task,
        reward: task.rewardPerUser, // Map rewardPerUser to reward for frontend compatibility
        channelPostUrl: task.type === 'channel_visit' ? task.url : null,
        claimUrl: task.type === 'channel_visit' ? task.url : 
                  task.type.startsWith('ads_goal_') ? null : task.url,
        username: task.type === 'channel_visit' ? 'PaidAdsNews' : null
      }));
      
      res.json({
        success: true,
        tasks: fallbackDailyTasks,
        total: fallbackDailyTasks.length
      });
    }
  });


  // CRITICAL: Public referral data repair endpoint (no auth needed for emergency fix)
  app.post('/api/emergency-fix-referrals', async (req: any, res) => {
    try {
      console.log('🚨 EMERGENCY: Running referral data repair...');
      
      // Step 1: Run the referral data synchronization
      await storage.fixExistingReferralData();
      
      // Step 2: Ensure all users have referral codes
      await storage.ensureAllUsersHaveReferralCodes();
      
      // Step 3: Get repair summary
      const totalReferralsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals);
      
      const completedReferralsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(eq(referrals.status, 'completed'));

      const totalReferralEarningsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
        .from(earnings)
        .where(sql`${earnings.source} IN ('referral', 'referral_commission')`);
      
      console.log('✅ Emergency referral repair completed successfully!');
      
      res.json({
        success: true,
        message: 'Emergency referral data repair completed successfully!',
        summary: {
          totalReferrals: totalReferralsResult[0]?.count || 0,
          completedReferrals: completedReferralsResult[0]?.count || 0,
          totalReferralEarnings: totalReferralEarningsResult[0]?.total || '0',
          message: 'All missing referral data has been restored. Check your app now!'
        }
      });
    } catch (error) {
      console.error('❌ Error in emergency referral repair:', error);
      res.status(500).json({
        success: false,
        message: 'Emergency repair failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Admin routes



  // Setup webhook endpoint (call this once to register with Telegram)
  app.post('/api/telegram/setup-webhook', async (req: any, res) => {
    try {
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ message: 'Webhook URL is required' });
      }
      
      const success = await setupTelegramWebhook(webhookUrl);
      
      if (success) {
        res.json({ success: true, message: 'Webhook set up successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to set up webhook' });
      }
    } catch (error) {
      console.error('Setup webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // One-time production database fix endpoint
  app.get('/api/fix-production-db', async (req: any, res) => {
    try {
      const { fixProductionDatabase } = await import('../server/fix-production-db.js');
      console.log('🔧 Running production database fix...');
      await fixProductionDatabase();
      res.json({ 
        success: true, 
        message: 'Production database fixed successfully! Your app should work now.',
        instructions: 'Try using your Telegram bot - it should now send messages properly!'
      });
    } catch (error) {
      console.error('Fix production DB error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: 'Database fix failed. Check the logs for details.'
      });
    }
  });

  // Auto-setup webhook endpoint (automatically determines URL)
  app.get('/api/telegram/auto-setup', async (req: any, res) => {
    try {
      // Get the current domain from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
      
      console.log('Setting up Telegram webhook:', webhookUrl);
      
      const success = await setupTelegramWebhook(webhookUrl);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Webhook set up successfully',
          webhookUrl 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to set up webhook',
          webhookUrl 
        });
      }
    } catch (error) {
      console.error('Auto-setup webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint to check bot functionality
  app.get('/api/telegram/test/:chatId', async (req: any, res) => {
    try {
      const { chatId } = req.params;
      console.log('🧪 Testing bot with chat ID:', chatId);
      
      const { sendWelcomeMessage } = await import('./telegram');
      const success = await sendWelcomeMessage(chatId);
      
      res.json({ 
        success, 
        message: success ? 'Test message sent!' : 'Failed to send test message',
        chatId 
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ error: 'Test failed', details: error });
    }
  });

  // Admin stats endpoint
  app.get('/api/admin/stats', authenticateAdmin, async (req: any, res) => {
    try {
      // Get various statistics for admin dashboard using drizzle
      const totalUsersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const totalEarningsSum = await db.select({ total: sql<string>`COALESCE(SUM(${users.totalEarned}), '0')` }).from(users);
      const totalWithdrawalsSum = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), '0')` }).from(withdrawals).where(eq(withdrawals.status, 'completed'));
      const pendingWithdrawalsCount = await db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(eq(withdrawals.status, 'pending'));
      const dailyActiveCount = await db.select({ count: sql<number>`count(distinct ${earnings.userId})` }).from(earnings).where(sql`DATE(${earnings.createdAt}) = CURRENT_DATE`);
      const totalAdsSum = await db.select({ total: sql<number>`COALESCE(SUM(${users.adsWatched}), 0)` }).from(users);

      res.json({
        totalUsers: totalUsersCount[0]?.count || 0,
        totalEarnings: totalEarningsSum[0]?.total || '0',
        totalWithdrawals: totalWithdrawalsSum[0]?.total || '0',
        pendingWithdrawals: pendingWithdrawalsCount[0]?.count || 0,
        dailyActiveUsers: dailyActiveCount[0]?.count || 0,
        totalAdsWatched: totalAdsSum[0]?.total || 0,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin user tracking endpoint - search by UID/referral code
  app.get('/api/admin/user-tracking/:uid', authenticateAdmin, async (req: any, res) => {
    try {
      const { uid } = req.params;
      
      // Search user by referral code (UID)
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, uid))
        .limit(1);
      
      if (userResults.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const user = userResults[0];
      
      // Get withdrawal count
      const withdrawalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(withdrawals)
        .where(eq(withdrawals.userId, user.id));
      
      // Get referral count
      const referralCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(eq(referrals.referrerId, user.id));
      
      res.json({
        success: true,
        user: {
          uid: user.referralCode,
          balance: user.balance,
          totalEarnings: user.totalEarned,
          withdrawalCount: withdrawalCount[0]?.count || 0,
          referralCount: referralCount[0]?.count || 0,
          status: user.banned ? 'Banned' : 'Active',
          joinedDate: user.createdAt,
          adsWatched: user.adsWatched
        }
      });
    } catch (error) {
      console.error("Error fetching user tracking:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch user data" 
      });
    }
  });

  // Admin users endpoint
  app.get('/api/admin/users', authenticateAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin ban/unban user endpoint
  app.post('/api/admin/users/:id/ban', authenticateAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { banned } = req.body;
      
      await storage.updateUserBanStatus(id, banned);
      
      res.json({ 
        success: true,
        message: banned ? 'User banned successfully' : 'User unbanned successfully'
      });
    } catch (error) {
      console.error("Error updating user ban status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });


  // Database setup endpoint for free plan deployments (call once after deployment)
  app.post('/api/setup-database', async (req: any, res) => {
    try {
      // Only allow this in production and with a setup key for security
      const { setupKey } = req.body;
      
      if (setupKey !== 'setup-database-schema-2024') {
        return res.status(403).json({ message: "Invalid setup key" });
      }

      console.log('🔧 Setting up database schema...');
      
      // Use drizzle-kit to push schema
      const { execSync } = await import('child_process');
      
      try {
        execSync('npx drizzle-kit push --force', { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        
        console.log('✅ Database setup completed successfully');
        
        res.json({
          success: true,
          message: 'Database schema setup completed successfully'
        });
      } catch (dbError) {
        console.error('Database setup error:', dbError);
        res.status(500).json({ 
          success: false, 
          message: 'Database setup failed',
          error: String(dbError)
        });
      }
    } catch (error) {
      console.error("Error setting up database:", error);
      res.status(500).json({ message: "Failed to setup database" });
    }
  });

  // Task/Promotion API routes
  
  // Get all active promotions/tasks for current user
  app.get('/api/tasks', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const result = await storage.getAvailablePromotionsForUser(userId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Complete a task
  app.post('/api/tasks/:promotionId/complete', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const telegramUserId = req.user.telegramUser.id.toString();
      const { promotionId } = req.params;
      const { taskType, channelUsername, botUsername } = req.body;
      
      // Validate required parameters
      if (!taskType) {
        console.log(`❌ Task completion blocked: Missing taskType for user ${userId}`);
        return res.status(400).json({ 
          success: false, 
          message: '❌ Task cannot be completed: Missing task type parameter.' 
        });
      }
      
      // Validate taskType is one of the allowed values
      const allowedTaskTypes = [
        'channel', 'bot', 'daily', 'fix',
        'channel_visit', 'share_link', 'invite_friend',
        'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'
      ];
      if (!allowedTaskTypes.includes(taskType)) {
        console.log(`❌ Task completion blocked: Invalid taskType '${taskType}' for user ${userId}`);
        return res.status(400).json({ 
          success: false, 
          message: '❌ Task cannot be completed: Invalid task type.' 
        });
      }
      
      console.log(`📋 Task completion attempt:`, {
        userId,
        telegramUserId,
        promotionId,
        taskType,
        channelUsername,
        botUsername
      });
      
      // Perform Telegram verification based on task type
      let isVerified = false;
      let verificationMessage = '';
      
      if (taskType === 'channel' && channelUsername) {
        // Verify channel membership using Telegram Bot API
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.log('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping channel verification');
          isVerified = false;
        } else {
          const isMember = await verifyChannelMembership(parseInt(telegramUserId), `@${channelUsername}`, process.env.BOT_TOKEN || botToken);
          isVerified = isMember;
        }
        verificationMessage = isVerified 
          ? 'Channel membership verified successfully' 
          : `Please join the channel @${channelUsername} first to complete this task`;
      } else if (taskType === 'bot' && botUsername) {
        // For bot tasks, we'll consider them verified if the user is in the WebApp
        // (since they would need to interact with the bot to access the WebApp)
        isVerified = true;
        verificationMessage = 'Bot interaction verified';
      } else if (taskType === 'daily') {
        // Daily tasks require channel membership if channelUsername is provided
        if (channelUsername) {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (!botToken) {
            console.log('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping channel verification');
            isVerified = false;
          } else {
            const isMember = await verifyChannelMembership(parseInt(telegramUserId), `@${channelUsername}`, process.env.BOT_TOKEN || botToken);
            isVerified = isMember;
          }
          verificationMessage = isVerified 
            ? 'Daily task verification successful' 
            : `Please join the channel @${channelUsername} first to complete this task`;
        } else {
          isVerified = true;
          verificationMessage = 'Daily task completed';
        }
      } else if (taskType === 'fix') {
        // Fix tasks are verified by default (user opening link is verification)
        isVerified = true;
        verificationMessage = 'Fix task completed';
      } else if (taskType === 'channel_visit') {
        // Channel visit task requires channel membership verification
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.log('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping channel verification');
          isVerified = false;
          verificationMessage = 'Channel verification failed - bot token not configured';
        } else {
          // Extract channel username from promotion URL
          const promotion = await storage.getPromotion(promotionId);
          const channelMatch = promotion?.url?.match(/t\.me\/([^/?]+)/);
          const channelName = channelMatch ? channelMatch[1] : 'PaidAdsNews';
          
          const isMember = await verifyChannelMembership(parseInt(telegramUserId), `@${channelName}`, botToken);
          isVerified = isMember;
          verificationMessage = isVerified 
            ? 'Channel membership verified successfully' 
            : `Please join the channel @${channelName} first to complete this task`;
        }
      } else if (taskType === 'share_link') {
        // Share link task requires user to have shared their affiliate link  
        const hasSharedToday = await storage.hasSharedLinkToday(userId);
        isVerified = hasSharedToday;
        verificationMessage = isVerified
          ? 'App link sharing verified successfully'
          : 'Not completed yet. Please share your affiliate link first.';
      } else if (taskType === 'invite_friend') {
        // Invite friend task requires exactly 1 valid referral today
        const hasValidReferralToday = await storage.hasValidReferralToday(userId);
        isVerified = hasValidReferralToday;
        verificationMessage = isVerified 
          ? 'Valid friend invitation verified for today' 
          : 'Not completed yet. Please invite a friend using your referral link first.';
      } else if (taskType.startsWith('ads_goal_')) {
        // Ads goal tasks require checking user's daily ad count
        const hasMetGoal = await storage.checkAdsGoalCompletion(userId, taskType);
        const user = await storage.getUser(userId);
        const adsWatchedToday = user?.adsWatchedToday || 0;
        
        // Get required ads for this task type
        const adsGoalThresholds = {
          'ads_goal_mini': 15,
          'ads_goal_light': 25,
          'ads_goal_medium': 45,
          'ads_goal_hard': 75
        };
        const requiredAds = adsGoalThresholds[taskType as keyof typeof adsGoalThresholds] || 0;
        
        isVerified = hasMetGoal;
        verificationMessage = isVerified 
          ? 'Ads goal achieved successfully!' 
          : `Not eligible yet. Watch ${requiredAds - adsWatchedToday} more ads (${adsWatchedToday}/${requiredAds} watched).`;
      } else {
        console.log(`❌ Task validation failed: Invalid task type '${taskType}' or missing parameters`, {
          taskType,
          channelUsername,
          botUsername,
          promotionId,
          userId
        });
        return res.status(400).json({ 
          success: false, 
          message: '❌ Task cannot be completed: Invalid task type or missing parameters.' 
        });
      }
      
      if (!isVerified) {
        console.log(`❌ Task verification failed for user ${userId}:`, verificationMessage);
        let friendlyMessage = '❌ Verification failed. Please complete the required action first.';
        if (taskType === 'channel' && channelUsername) {
          friendlyMessage = `❌ Verification failed. Please make sure you joined the required channel @${channelUsername}.`;
        } else if (taskType === 'bot' && botUsername) {
          friendlyMessage = `❌ Verification failed. Please make sure you started the bot @${botUsername}.`;
        }
        return res.status(400).json({ 
          success: false, 
          message: verificationMessage,
          friendlyMessage
        });
      }
      
      console.log(`✅ Task verification successful for user ${userId}:`, verificationMessage);
      
      // Get promotion to fetch actual reward amount
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        return res.status(404).json({ 
          success: false, 
          message: 'Task not found' 
        });
      }
      
      const rewardAmount = promotion.rewardPerUser || '0.00025';
      console.log(`🔍 Promotion details:`, { rewardPerUser: promotion.rewardPerUser, type: promotion.type, id: promotion.id });
      
      // Determine if this is a daily task (new task types that reset daily)
      const isDailyTask = [
        'channel_visit', 'share_link', 'invite_friend',
        'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'
      ].includes(taskType);
      
      if (isDailyTask) {
        console.log(`💰 Using dynamic reward amount: ${rewardAmount} TON`);
      } else {
        console.log(`💰 Using dynamic reward amount: $${rewardAmount}`);
      }
      
      // Complete the task using appropriate method
      const result = isDailyTask 
        ? await storage.completeDailyTask(promotionId, userId, rewardAmount)
        : await storage.completeTask(promotionId, userId, rewardAmount);
      
      if (result.success) {
        // Get updated balance for real-time sync
        let updatedBalance;
        try {
          updatedBalance = await storage.getUserBalance(userId);
          console.log(`💰 Balance updated for user ${userId}: $${updatedBalance?.balance || '0'}`);
          
          // Send real-time balance update to WebSocket clients
          const currencySymbol = isDailyTask ? 'TON' : '$';
          const balanceUpdate = {
            type: 'balance_update',
            balance: updatedBalance?.balance || '0',
            delta: rewardAmount,
            message: `🎉 Task completed! +${currencySymbol}${parseFloat(rewardAmount).toFixed(5)}`
          };
          sendRealtimeUpdate(userId, balanceUpdate);
          console.log(`📡 Real-time balance update sent to user ${userId}`);
          
        } catch (balanceError) {
          console.error('⚠️ Failed to fetch updated balance for real-time sync:', balanceError);
        }
        
        res.json({ 
          ...result, 
          verificationMessage,
          rewardAmount,
          newBalance: updatedBalance?.balance || '0'
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Promotional system endpoints removed - using daily tasks system only
  
  // Wallet management endpoints
  
  // Get user's saved wallet details
  app.get('/api/wallet/details', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      const [user] = await db
        .select({
          tonWalletAddress: users.tonWalletAddress,
          tonWalletComment: users.tonWalletComment,
          telegramUsername: users.telegramUsername,
          walletUpdatedAt: users.walletUpdatedAt
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      // Check if user can withdraw (24-hour hold check)
      const canWithdraw = !user.walletUpdatedAt || 
        (Date.now() - new Date(user.walletUpdatedAt).getTime()) > 24 * 60 * 60 * 1000;
      
      res.json({
        success: true,
        walletDetails: {
          tonWalletAddress: user.tonWalletAddress || '',
          tonWalletComment: user.tonWalletComment || '',
          telegramUsername: user.telegramUsername || '',
          walletUpdatedAt: user.walletUpdatedAt,
          canWithdraw
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching wallet details:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch wallet details' 
      });
    }
  });
  
  // Save user's wallet details
  app.post('/api/wallet/save', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { tonWalletAddress, tonWalletComment, telegramUsername } = req.body;
      
      console.log('💾 Saving wallet details for user:', userId);
      
      // Update user's wallet details
      await db
        .update(users)
        .set({
          tonWalletAddress: tonWalletAddress || null,
          tonWalletComment: tonWalletComment || null,
          telegramUsername: telegramUsername || null,
          walletUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log('✅ Wallet details saved successfully');
      
      res.json({
        success: true,
        message: 'Wallet details saved successfully. Withdrawal is on hold for 24 hours.',
        walletUpdatedAt: new Date()
      });
      
    } catch (error) {
      console.error('❌ Error saving wallet details:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save wallet details' 
      });
    }
  });
  
  // User withdrawal endpoints
  
  // Get user's withdrawal history (authenticated users)
  app.get('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get all user's withdrawals (show all statuses: pending, Approved, paid, rejected, etc.)
      const userWithdrawals = await db
        .select({
          id: withdrawals.id,
          amount: withdrawals.amount,
          method: withdrawals.method,
          status: withdrawals.status,
          details: withdrawals.details,
          comment: withdrawals.comment,
          transactionHash: withdrawals.transactionHash,
          adminNotes: withdrawals.adminNotes,
          createdAt: withdrawals.createdAt,
          updatedAt: withdrawals.updatedAt
        })
        .from(withdrawals)
        .where(eq(withdrawals.userId, userId))
        .orderBy(desc(withdrawals.createdAt));
      
      res.json(userWithdrawals);
      
    } catch (error) {
      console.error('❌ Error fetching user withdrawals:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch withdrawals' 
      });
    }
  });

  // Create new withdrawal request (authenticated users)
  app.post('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { amount, paymentSystemId, paymentDetails, comment } = req.body;

      console.log('📝 Withdrawal request received:', { userId, amount, paymentSystemId, paymentDetails, comment });

      // Check for pending withdrawals
      const pendingWithdrawals = await db
        .select({ id: withdrawals.id })
        .from(withdrawals)
        .where(and(
          eq(withdrawals.userId, userId),
          eq(withdrawals.status, 'pending')
        ))
        .limit(1);

      if (pendingWithdrawals.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create new request until current one is processed'
        });
      }

      // Validation: Check minimum amount (0.5 TON)
      const withdrawAmount = parseFloat(amount);
      if (!amount || isNaN(withdrawAmount) || withdrawAmount < 0.5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum withdraw amount is 0.5 TON'
        });
      }

      // Use transaction to ensure atomicity and prevent race conditions
      const newWithdrawal = await db.transaction(async (tx) => {
        // Lock user row and check balance and wallet update time (SELECT FOR UPDATE)
        const [user] = await tx
          .select({ 
            balance: users.balance,
            walletUpdatedAt: users.walletUpdatedAt
          })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        
        if (!user) {
          throw new Error('User not found');
        }

        // Check 24-hour hold
        if (user.walletUpdatedAt) {
          const hoursSinceUpdate = (Date.now() - new Date(user.walletUpdatedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate < 24) {
            throw new Error('Withdrawal on hold for 24 hours after updating wallet details');
          }
        }

        const currentBalance = parseFloat(user.balance || '0');
        
        if (currentBalance < withdrawAmount) {
          throw new Error('Insufficient balance');
        }

        // DO NOT deduct balance here - only verify user has enough
        // Balance will be deducted when admin approves the withdrawal
        console.log(`✅ Withdrawal request validated. User has sufficient balance: ${currentBalance} TON`);

        // Create withdrawal request with deducted flag set to FALSE
        // Balance will be deducted on admin approval
        const withdrawalData: any = {
          userId,
          amount: amount.toString(),
          method: 'ton_coin',
          status: 'pending',
          deducted: false,
          refunded: false,
          details: {
            paymentSystemId: paymentSystemId || 'ton_coin',
            paymentDetails: paymentDetails || ''
          }
        };

        if (comment && comment.trim() !== '') {
          withdrawalData.comment = comment.trim();
        }

        const [withdrawal] = await tx.insert(withdrawals).values(withdrawalData).returning();
        
        return withdrawal;
      });

      console.log(`✅ Withdrawal request created: ${newWithdrawal.id} for user ${userId}, amount: ${amount} TON`);

      res.json({
        success: true,
        message: 'Withdrawal request submitted successfully',
        withdrawal: {
          id: newWithdrawal.id,
          amount: newWithdrawal.amount,
          status: newWithdrawal.status,
          method: newWithdrawal.method,
          createdAt: newWithdrawal.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Error creating withdrawal request:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create withdrawal request';
      
      // Return 400 for validation errors, 500 for others
      if (errorMessage === 'Insufficient balance' || 
          errorMessage === 'User not found' ||
          errorMessage === 'Withdrawal on hold for 24 hours after updating wallet details' ||
          errorMessage === 'Cannot create new request until current one is processed') {
        return res.status(400).json({ 
          success: false, 
          message: errorMessage
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create withdrawal request' 
      });
    }
  });
  
  // Admin withdrawal management endpoints
  
  // Get pending withdrawals (admin only)
  app.get('/api/admin/withdrawals/pending', authenticateAdmin, async (req: any, res) => {
    try {
      
      // Get pending withdrawals only
      const pendingWithdrawals = await db
        .select({
          id: withdrawals.id,
          userId: withdrawals.userId,
          amount: withdrawals.amount,
          status: withdrawals.status,
          method: withdrawals.method,
          details: withdrawals.details,
          comment: withdrawals.comment,
          createdAt: withdrawals.createdAt,
          updatedAt: withdrawals.updatedAt,
          transactionHash: withdrawals.transactionHash,
          adminNotes: withdrawals.adminNotes,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            telegram_id: users.telegram_id
          }
        })
        .from(withdrawals)
        .leftJoin(users, eq(withdrawals.userId, users.id))
        .where(eq(withdrawals.status, 'pending'))
        .orderBy(desc(withdrawals.createdAt));
      
      res.json({
        success: true,
        withdrawals: pendingWithdrawals,
        total: pendingWithdrawals.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching pending withdrawals:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch pending withdrawals' 
      });
    }
  });

  // Get processed withdrawals (approved/rejected) - admin only
  app.get('/api/admin/withdrawals/processed', authenticateAdmin, async (req: any, res) => {
    try {
      
      // Get all processed withdrawals (approved and rejected)
      const processedWithdrawals = await db
        .select({
          id: withdrawals.id,
          userId: withdrawals.userId,
          amount: withdrawals.amount,
          status: withdrawals.status,
          method: withdrawals.method,
          details: withdrawals.details,
          comment: withdrawals.comment,
          createdAt: withdrawals.createdAt,
          updatedAt: withdrawals.updatedAt,
          transactionHash: withdrawals.transactionHash,
          adminNotes: withdrawals.adminNotes,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            telegram_id: users.telegram_id
          }
        })
        .from(withdrawals)
        .leftJoin(users, eq(withdrawals.userId, users.id))
        .where(sql`${withdrawals.status} IN ('paid', 'rejected', 'Successfull', 'Approved')`)
        .orderBy(desc(withdrawals.updatedAt));
      
      res.json({
        success: true,
        withdrawals: processedWithdrawals,
        total: processedWithdrawals.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching processed withdrawals:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch processed withdrawals' 
      });
    }
  });
  
  // Approve withdrawal (admin only)
  app.post('/api/admin/withdrawals/:withdrawalId/approve', authenticateAdmin, async (req: any, res) => {
    try {
      const { withdrawalId } = req.params;
      const { adminNotes, transactionHash } = req.body;
      
      // Require transaction hash for payment confirmation
      if (!transactionHash) {
        return res.status(400).json({
          success: false,
          message: 'Transaction hash is required for payment confirmation'
        });
      }
      
      // Approve the withdrawal using existing storage method
      const result = await storage.approveWithdrawal(withdrawalId, adminNotes, transactionHash);
      
      if (result.success) {
        console.log(`✅ Withdrawal ${withdrawalId} approved by admin ${req.user.telegramUser.id}`);
        
        // Send real-time update to user
        if (result.withdrawal) {
          sendRealtimeUpdate(result.withdrawal.userId, {
            type: 'withdrawal_approved',
            amount: result.withdrawal.amount,
            method: result.withdrawal.method,
            message: `Your withdrawal of ${result.withdrawal.amount} TON has been approved and processed`
          });

          // Send Telegram bot notification to user
          const user = await db.select().from(users).where(eq(users.id, result.withdrawal.userId)).limit(1);
          if (user.length > 0 && user[0].telegram_id) {
            try {
              const formattedAmount = parseFloat(result.withdrawal.amount).toFixed(8).replace(/\.?0+$/, '');
              const withdrawalDetails = result.withdrawal.details as any;
              const walletAddress = withdrawalDetails?.paymentDetails || 'N/A';
              
              // Escape special characters for MarkdownV2
              const escapeMarkdownV2 = (text: string) => text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
              const escapedAmount = escapeMarkdownV2(formattedAmount);
              const escapedTxHash = escapeMarkdownV2(transactionHash);
              const escapedWallet = escapeMarkdownV2(walletAddress);
              
              // Create withdrawal success message in MarkdownV2 format
              const approvalMessage = `🎉 *Withdrawal Successful\\!* ✅\n\n` +
                `🔔 *Payout:* ${escapedAmount} TON\n` +
                `💳 *Wallet:* ${escapedWallet}\n` +
                `📝 *Txn Hash:* ${escapedTxHash}\n\n` +
                `✨ Keep earning & growing\\! Your journey to success continues 💪`;
              
              await sendUserTelegramNotification(
                user[0].telegram_id,
                approvalMessage,
                null,
                'MarkdownV2'
              );
              console.log(`📱 Telegram notification sent to user ${user[0].telegram_id}`);
            } catch (telegramError) {
              console.error('❌ Failed to send Telegram notification:', telegramError);
            }
          }
        }
        
        res.json({
          success: true,
          message: '✅ Withdrawal approved and processed',
          withdrawal: result.withdrawal
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
      
    } catch (error) {
      console.error('❌ Error approving withdrawal:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to approve withdrawal' 
      });
    }
  });
  
  // Reject withdrawal (admin only)
  app.post('/api/admin/withdrawals/:withdrawalId/reject', authenticateAdmin, async (req: any, res) => {
    try {
      const { withdrawalId } = req.params;
      const { adminNotes, reason } = req.body;
      
      // Reject the withdrawal using existing storage method
      const result = await storage.rejectWithdrawal(withdrawalId, adminNotes || reason);
      
      if (result.success) {
        console.log(`❌ Withdrawal ${withdrawalId} rejected by admin ${req.user.telegramUser.id}`);
        
        // Send real-time update to user
        if (result.withdrawal) {
          sendRealtimeUpdate(result.withdrawal.userId, {
            type: 'withdrawal_rejected',
            amount: result.withdrawal.amount,
            method: result.withdrawal.method,
            message: `Your withdrawal of ${result.withdrawal.amount} TON has been rejected`
          });

          // Send Telegram bot notification to user
          const user = await db.select().from(users).where(eq(users.id, result.withdrawal.userId)).limit(1);
          if (user.length > 0 && user[0].telegram_id) {
            try {
              const currentBalance = parseFloat(user[0].balance || '0');
              const formattedBalance = parseFloat(currentBalance.toFixed(8)).toString().replace(/\.?0+$/, '');
              const formattedAmount = parseFloat(result.withdrawal.amount).toFixed(8).replace(/\.?0+$/, '');
              const rejectionReason = adminNotes || reason || 'No reason provided';
              const utcTime = new Date().toUTCString();
              
              const rejectionMessage = `❌ Your withdrawal of ${formattedAmount} TON was rejected.\n\n` +
                `📋 Reason: ${rejectionReason}\n` +
                `⏰ Time (UTC): ${utcTime}\n` +
                `💡 Remaining Balance: ${formattedBalance} TON`;
              
              await sendUserTelegramNotification(
                user[0].telegram_id,
                rejectionMessage
              );
              console.log(`📱 Telegram notification sent to user ${user[0].telegram_id}`);
            } catch (telegramError) {
              console.error('❌ Failed to send Telegram notification:', telegramError);
            }
          }
        }
        
        res.json({
          success: true,
          message: '❌ Withdrawal rejected',
          withdrawal: result.withdrawal
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
      
    } catch (error) {
      console.error('❌ Error rejecting withdrawal:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to reject withdrawal' 
      });
    }
  });

  // Check if user has completed a task
  app.get('/api/tasks/:promotionId/status', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      
      const hasCompleted = await storage.hasUserCompletedTask(promotionId, userId);
      res.json({ completed: hasCompleted });
    } catch (error) {
      console.error("Error checking task status:", error);
      res.status(500).json({ message: "Failed to check task status" });
    }
  });

  // NEW TASK STATUS SYSTEM ENDPOINTS

  // Verify task (makes it claimable if requirements are met)
  app.post('/api/tasks/:promotionId/verify', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      const { taskType } = req.body;
      
      if (!taskType) {
        return res.status(400).json({ 
          success: false, 
          message: 'Task type is required' 
        });
      }
      
      console.log(`🔍 Task verification attempt: UserID=${userId}, TaskID=${promotionId}, TaskType=${taskType}`);
      
      const result = await storage.verifyTask(userId, promotionId, taskType);
      
      if (result.success) {
        console.log(`✅ Task verification result: ${result.message}, Status: ${result.status}`);
        res.json(result);
      } else {
        console.log(`❌ Task verification failed: ${result.message}`);
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error verifying task:", error);
      res.status(500).json({ success: false, message: "Failed to verify task" });
    }
  });

  // Claim task reward (credits balance and marks as claimed)
  app.post('/api/tasks/:promotionId/claim', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      
      console.log(`🎁 Task claim attempt: UserID=${userId}, TaskID=${promotionId}`);
      
      const result = await storage.claimTaskReward(userId, promotionId);
      
      if (result.success) {
        console.log(`✅ Task claimed successfully: ${result.message}, Reward: ${result.rewardAmount}`);
        
        // Send real-time balance update via WebSocket
        try {
          const connection = connectedUsers.get(req.sessionID);
          if (connection && connection.ws.readyState === 1) {
            connection.ws.send(JSON.stringify({
              type: 'balance_update',
              balance: result.newBalance,
              rewardAmount: result.rewardAmount,
              source: 'task_claim'
            }));
          }
        } catch (wsError) {
          console.error('Failed to send WebSocket balance update:', wsError);
        }
        
        res.json(result);
      } else {
        console.log(`❌ Task claim failed: ${result.message}`);
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error claiming task reward:", error);
      res.status(500).json({ success: false, message: "Failed to claim task reward" });
    }
  });

  // Create promotion (via Telegram bot only - internal endpoint)
  app.post('/api/internal/promotions', authenticateTelegram, async (req: any, res) => {
    try {
      const promotionData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.createPromotion(promotionData);
      res.json(promotion);
    } catch (error) {
      console.error("Error creating promotion:", error);
      res.status(500).json({ message: "Failed to create promotion" });
    }
  });

  // Get user balance
  app.get('/api/user/balance', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const balance = await storage.getUserBalance(userId);
      
      if (!balance) {
        // Create initial balance if doesn't exist
        const newBalance = await storage.createOrUpdateUserBalance(userId, '0');
        res.json(newBalance);
      } else {
        res.json(balance);
      }
    } catch (error) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Add funds to main balance (via bot only - internal endpoint)
  app.post('/api/internal/add-funds', authenticateTelegram, async (req: any, res) => {
    try {
      const { userId, amount } = req.body;
      
      if (!userId || !amount) {
        return res.status(400).json({ message: "userId and amount are required" });
      }

      const balance = await storage.createOrUpdateUserBalance(userId, amount);
      res.json({ success: true, balance });
    } catch (error) {
      console.error("Error adding funds:", error);
      res.status(500).json({ message: "Failed to add funds" });
    }
  });

  // Deduct main balance for promotion creation (internal endpoint)
  app.post('/api/internal/deduct-balance', async (req: any, res) => {
    try {
      const { userId, amount } = req.body;
      
      if (!userId || !amount) {
        return res.status(400).json({ message: "userId and amount are required" });
      }

      const result = await storage.deductBalance(userId, amount);
      res.json(result);
    } catch (error) {
      console.error("Error deducting balance:", error);
      res.status(500).json({ message: "Failed to deduct balance" });
    }
  });

  // ================================
  // NEW TASK SYSTEM ENDPOINTS
  // ================================

  // Get all task statuses for user
  app.get('/api/tasks/status', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Get daily task completion records for today
      const dailyTasks = await db.select()
        .from(dailyTasks)
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.completionDate, currentDate)
        ));
      
      // Get current user data for ads progress
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Format task statuses
      const taskStatuses = dailyTasks.map(task => ({
        taskType: task.taskType,
        progress: task.progress,
        required: task.required,
        completed: task.completed,
        claimed: task.claimed,
        rewardAmount: parseFloat(task.rewardAmount).toFixed(7),
        status: task.claimed ? 'completed' : (task.completed ? 'claimable' : 'in_progress')
      }));
      
      // Add ads progress from user data
      const adsToday = user.adsWatchedToday || 0;
      taskStatuses.forEach(task => {
        if (task.taskType.startsWith('ads_')) {
          task.progress = adsToday;
          task.completed = adsToday >= task.required;
          task.status = task.claimed ? 'completed' : (task.completed ? 'claimable' : 'in_progress');
        }
      });
      
      res.json({ tasks: taskStatuses, adsWatchedToday: adsToday });
    } catch (error) {
      console.error("Error fetching task status:", error);
      res.status(500).json({ message: "Failed to fetch task status" });
    }
  });



  // Increment ads counter
  app.post('/api/tasks/ads/increment', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Get current user data
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const currentAds = (user.adsWatchedToday || 0) + 1;
      
      // Update user's ads watched count
      await db.update(users)
        .set({ 
          adsWatchedToday: currentAds,
          adsWatched: (user.adsWatched || 0) + 1,
          lastAdWatch: new Date()
        })
        .where(eq(users.id, userId));
      
      // Update all ads goal tasks progress
      const adsGoals = ['ads_mini', 'ads_light', 'ads_medium', 'ads_hard'];
      for (const goalType of adsGoals) {
        const taskData = await db.select()
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.taskType, goalType),
            eq(dailyTasks.completionDate, currentDate)
          ))
          .limit(1);
        
        if (taskData.length > 0) {
          const task = taskData[0];
          const completed = currentAds >= task.required;
          
          await db.update(dailyTasks)
            .set({ 
              progress: currentAds,
              completed: completed
            })
            .where(and(
              eq(dailyTasks.userId, userId),
              eq(dailyTasks.taskType, goalType),
              eq(dailyTasks.completionDate, currentDate)
            ));
        }
      }
      
      res.json({ 
        success: true, 
        adsWatchedToday: currentAds,
        message: `Ads watched today: ${currentAds}`
      });
    } catch (error) {
      console.error("Error incrementing ads counter:", error);
      res.status(500).json({ message: "Failed to increment ads counter" });
    }
  });

  // Complete invite friend task
  app.post('/api/tasks/invite-friend/complete', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Update user's friend invited flag
      await db.update(users)
        .set({ friendInvited: true })
        .where(eq(users.id, userId));
      
      // Update daily task completion
      await db.update(dailyTasks)
        .set({ completed: true, progress: 1 })
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.taskType, 'invite_friend'),
          eq(dailyTasks.completionDate, currentDate)
        ));
      
      res.json({ success: true, message: 'Friend invite completed' });
    } catch (error) {
      console.error("Error completing friend invite:", error);
      res.status(500).json({ message: "Failed to complete friend invite" });
    }
  });

  // Claim completed task reward
  app.post('/api/tasks/:taskType/claim', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskType } = req.params;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Get task completion record
      const taskData = await db.select()
        .from(dailyTasks)
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.taskType, taskType),
          eq(dailyTasks.completionDate, currentDate)
        ))
        .limit(1);
      
      if (taskData.length === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      const task = taskData[0];
      
      if (task.claimed) {
        return res.status(400).json({ message: 'Task already claimed' });
      }
      
      if (!task.completed) {
        return res.status(400).json({ message: 'Task not completed yet' });
      }
      
      // Claim the reward in a transaction
      await db.transaction(async (tx) => {
        // Mark task as claimed
        await tx.update(dailyTasks)
          .set({ claimed: true })
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.taskType, taskType),
            eq(dailyTasks.completionDate, currentDate)
          ));
        
        // Add balance
        await storage.addBalance(userId, task.rewardAmount);
        
        // Add earning record
        await storage.addEarning({
          userId,
          amount: task.rewardAmount,
          source: 'daily_task_completion',
          description: `Daily task completed: ${taskType}`,
        });
      });
      
      // Get updated balance
      const user = await storage.getUser(userId);
      
      res.json({ 
        success: true, 
        message: 'Task reward claimed successfully',
        rewardAmount: parseFloat(task.rewardAmount).toFixed(7),
        newBalance: user?.balance || '0'
      });
    } catch (error) {
      console.error("Error claiming task reward:", error);
      res.status(500).json({ message: "Failed to claim task reward" });
    }
  });

  return httpServer;
}
