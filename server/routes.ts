import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from 'ws';
import { 
  insertEarningSchema, 
  insertPromotionSchema,
  users, 
  earnings, 
  referrals, 
  referralCommissions,
  withdrawals,
  promotions,
  taskCompletions,
  dailyTaskCompletions,
  userBalances
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

  // Ad watching endpoint
  app.post('/api/ads/watch', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { adType } = req.body;
      
      // Check if user can watch ad (daily limit)
      const canWatch = await storage.canWatchAd(userId);
      if (!canWatch) {
        return res.status(429).json({ message: 'Daily ad limit reached (160 ads)' });
      }
      
      // Add earning for watched ad with new rate
      const earning = await storage.addEarning({
        userId,
        amount: "0.000086",
        source: 'ad_watch',
        description: 'Watched advertisement',
      });
      
      // Increment ads watched count
      await storage.incrementAdsWatched(userId);
      
      // Check and activate referral bonuses (anti-fraud: requires 10 ads)
      await storage.checkAndActivateReferralBonus(userId);
      
      // Send real-time update to user
      sendRealtimeUpdate(userId, {
        type: 'ad_reward',
        amount: "0.000086",
        message: 'Ad reward earned! 💰',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true, 
        earning,
        message: 'Ad reward added successfully' 
      });
    } catch (error) {
      console.error("Error processing ad watch:", error);
      res.status(500).json({ message: "Failed to process ad reward" });
    }
  });

  // Streak claim endpoint
  app.post('/api/streak/claim', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      const result = await storage.updateUserStreak(userId);
      
      res.json({ 
        success: true,
        newStreak: result.newStreak,
        rewardEarned: result.rewardEarned,
        message: 'Streak updated successfully' 
      });
    } catch (error) {
      console.error("Error processing streak:", error);
      res.status(500).json({ message: "Failed to process streak" });
    }
  });

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


  // Affiliate stats endpoint
  app.get('/api/affiliates/stats', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get total friends referred by counting actual referrals table
      const totalFriendsReferred = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(eq(referrals.referrerId, userId));

      // Get count of successful referrals (those who watched ≥10 ads)
      const successfulReferrals = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(and(
          eq(referrals.referrerId, userId),
          eq(referrals.status, 'completed')
        ));

      // Get total referral earnings (both commissions and bonuses) - all go to main balance
      const totalReferralEarnings = await db
        .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
        .from(earnings)
        .where(and(
          eq(earnings.userId, userId),
          sql`${earnings.source} IN ('referral_commission', 'referral')`
        ));

      // Get current user's referral code
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
      
      // Generate referral link with fallback bot username
      const botUsername = process.env.BOT_USERNAME || "LightningSatsbot";
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

      // Get detailed referrals list from actual referrals table
      const referralsList = await db
        .select({
          refereeId: referrals.refereeId,
          rewardAmount: referrals.rewardAmount,
          status: referrals.status,
          createdAt: referrals.createdAt,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username
          }
        })
        .from(referrals)
        .leftJoin(users, eq(referrals.refereeId, users.id))
        .where(eq(referrals.referrerId, userId))
        .orderBy(desc(referrals.createdAt));
      
      res.json({
        totalFriendsReferred: totalFriendsReferred[0]?.count || 0,
        successfulReferrals: successfulReferrals[0]?.count || 0,
        totalReferralEarnings: totalReferralEarnings[0]?.total || '0.00000',
        referralLink,
        referrals: referralsList.map(r => ({
          refereeId: r.refereeId,
          refereeName: r.user?.firstName ? `${r.user.firstName} ${r.user.lastName || ''}`.trim() : r.user?.username || 'Anonymous',
          reward: r.rewardAmount,
          status: r.status,
          createdAt: r.createdAt
        }))
      });
    } catch (error) {
      console.error("Error fetching affiliate stats:", error);
      res.status(500).json({ message: "Failed to fetch affiliate stats" });
    }
  });


  // Sync referral data endpoint - fixes referral tracking issues
  app.post('/api/admin/sync-referrals', async (req: any, res) => {
    try {
      console.log('🔄 Starting manual referral data synchronization...');
      
      // Step 1: Ensure all users have referral codes
      await storage.ensureAllUsersHaveReferralCodes();
      console.log('✅ Step 1: All users now have referral codes');
      
      // Step 2: Sync existing referral data 
      await storage.fixExistingReferralData();
      console.log('✅ Step 2: Existing referral data synchronized');
      
      // Step 3: Get current stats
      const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
      const totalReferrals = await db.select({ count: sql<number>`count(*)` }).from(referrals);
      
      console.log(`✅ Referral sync complete: ${totalUsers[0]?.count || 0} users, ${totalReferrals[0]?.count || 0} referrals`);
      
      res.json({
        success: true,
        message: 'Referral data synchronization completed',
        stats: {
          totalUsers: totalUsers[0]?.count || 0,
          totalReferrals: totalReferrals[0]?.count || 0
        }
      });
    } catch (error) {
      console.error('❌ Error syncing referral data:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to sync referral data',
        error: error instanceof Error ? error.message : String(error)
      });
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

  // Telegram Promotion System API endpoints
  
  // Create promotion and auto-post to Telegram channel
  app.post('/api/promotions/create', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { type, url, cost, rewardPerUser, limit, title, description } = req.body;
      
      // Validate required fields
      if (!type || !url || !cost || !rewardPerUser || !limit) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: type, url, cost, rewardPerUser, limit' 
        });
      }
      
      // Enforce fixed task creation cost for security - never trust client
      const FIXED_TASK_COST = '0.01';
      
      // Validate client input ranges for security
      if (parseFloat(rewardPerUser) <= 0 || parseFloat(rewardPerUser) > 1) {
        return res.status(400).json({ 
          success: false, 
          message: '❌ Invalid reward amount. Must be between $0.01 and $1.00.' 
        });
      }
      
      if (limit <= 0 || limit > 10000) {
        return res.status(400).json({ 
          success: false, 
          message: '❌ Invalid limit. Must be between 1 and 10,000.' 
        });
      }
      
      const allowedTypes = ['channel', 'bot', 'daily'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ 
          success: false, 
          message: '❌ Invalid task type. Allowed types: channel, bot, daily.' 
        });
      }
      
      // Check user balance and deduct fixed cost - security: ignore client cost
      const balanceResult = await storage.deductBalance(userId, FIXED_TASK_COST);
      if (!balanceResult.success) {
        console.log(`❌ Task creation blocked for user ${userId}: ${balanceResult.message}`);
        return res.status(400).json({ 
          success: false, 
          message: balanceResult.message === 'Insufficient balance' 
            ? '❌ Not enough balance to create this task.'
            : 'Failed to process task creation cost' 
        });
      }
      
      console.log(`💰 Task creation cost $${FIXED_TASK_COST} (fixed rate) deducted from user ${userId} balance`);
      
      // Create promotion in database - requires admin approval before going live
      const promotion = await storage.createPromotion({
        ownerId: userId,
        type,
        url,
        cost: FIXED_TASK_COST,
        rewardPerUser: rewardPerUser.toString(),
        limit,
        title,
        description,
        status: 'active',
        isApproved: false // Require admin approval before public visibility
      });
      
      console.log(`📊 TASK_CREATION_LOG: UserID=${userId}, TaskID=${promotion.id}, CostDeducted=${FIXED_TASK_COST}, RewardPerUser=${rewardPerUser}, Limit=${limit}, Status=PENDING_APPROVAL, Title="${title}"`);
      
      // Promotion created but needs admin approval before going live
      res.json({
        success: true,
        message: '🎯 Task created successfully! It will appear to users after admin approval.',
        promotion: {
          ...promotion,
          isPending: true
        }
      });
    } catch (error) {
      console.error('❌ Error creating promotion:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create promotion' 
      });
    }
  });
  
  // Get tasks/promotions with Open button links to Telegram channel posts
  app.get('/api/tasks', authenticateTelegram, async (req: any, res) => {
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
      
      // Query daily task completions from dailyTaskCompletions table for today only
      try {
        const dailyCompletions = await db
          .select({ promotionId: dailyTaskCompletions.promotionId })
          .from(dailyTaskCompletions)
          .where(and(
            eq(dailyTaskCompletions.userId, userId),
            eq(dailyTaskCompletions.completionDate, currentTaskDate)
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

  // Get user's created promotions/tasks  
  app.get('/api/user/promotions', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get user's promotions
      const userPromotions = await db
        .select({
          id: promotions.id,
          type: promotions.type,
          url: promotions.url,
          cost: promotions.cost,
          rewardPerUser: promotions.rewardPerUser,
          limit: promotions.limit,
          claimedCount: promotions.claimedCount,
          title: promotions.title,
          description: promotions.description,
          status: promotions.status,
          createdAt: promotions.createdAt
        })
        .from(promotions)
        .where(eq(promotions.ownerId, userId))
        .orderBy(desc(promotions.createdAt));
      
      res.json({
        success: true,
        promotions: userPromotions
      });
    } catch (error) {
      console.error('❌ Error fetching user promotions:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch promotions' 
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
      const { fixProductionDatabase } = require('../fix-production-db');
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
        // Share link task is auto-verified (user sharing is the action)
        isVerified = true;
        verificationMessage = 'App link shared successfully';
      } else if (taskType === 'invite_friend') {
        // Invite friend task requires checking if user has made a valid referral today
        // Check if user has made any referrals in the last 24 hours
        try {
          const { pool } = await import('./db');
          const result = await pool.query(`
            SELECT COUNT(*) as referral_count 
            FROM referrals 
            WHERE referrer_id = $1 
            AND created_at >= NOW() - INTERVAL '24 hours'
          `, [userId]);
          
          const referralCount = parseInt(result.rows[0]?.referral_count || '0');
          isVerified = referralCount > 0;
          verificationMessage = isVerified 
            ? `Friend invitation verified (${referralCount} referral${referralCount > 1 ? 's' : ''} today)` 
            : 'Please invite a friend to complete this task. Share your referral link to earn rewards together!';
        } catch (error) {
          console.error('❌ Error checking referrals for invite_friend task:', error);
          isVerified = false;
          verificationMessage = 'Unable to verify friend invitation. Please try again later.';
        }
      } else if (taskType.startsWith('ads_goal_')) {
        // Ads goal tasks require checking user's daily ad count
        const hasMetGoal = await storage.checkAdsGoalCompletion(userId, taskType);
        isVerified = hasMetGoal;
        verificationMessage = isVerified 
          ? 'Ads goal achieved successfully' 
          : 'You need to watch more ads today to complete this goal';
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

  // Admin API endpoints for promotion management
  
  // Get pending promotions (admin only)
  app.get('/api/admin/promotions/pending', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Check if user is admin (you may need to adjust this based on your admin system)
      // For now, checking if user has unlimited balance as admin indicator
      const userBalance = await storage.getUserBalance(userId);
      const isAdmin = userBalance?.balance === '999999999' || userId === '6653616672'; // Admin user from logs
      
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Get all pending promotions
      const pendingPromotions = await db
        .select({
          id: promotions.id,
          ownerId: promotions.ownerId,
          type: promotions.type,
          url: promotions.url,
          cost: promotions.cost,
          rewardPerUser: promotions.rewardPerUser,
          limit: promotions.limit,
          title: promotions.title,
          description: promotions.description,
          createdAt: promotions.createdAt
        })
        .from(promotions)
        .where(and(
          eq(promotions.status, 'active'),
          eq(promotions.isApproved, false)
        ))
        .orderBy(desc(promotions.createdAt));
      
      res.json({
        success: true,
        promotions: pendingPromotions,
        total: pendingPromotions.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching pending promotions:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch pending promotions' 
      });
    }
  });
  
  // Approve promotion (admin only)
  app.post('/api/admin/promotions/:promotionId/approve', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      
      // Check if user is admin
      const userBalance = await storage.getUserBalance(userId);
      const isAdmin = userBalance?.balance === '999999999' || userId === '6653616672';
      
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Get the promotion
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found'
        });
      }
      
      if (promotion.isApproved) {
        return res.status(400).json({
          success: false,
          message: 'Promotion is already approved'
        });
      }
      
      // Approve the promotion
      await db.update(promotions)
        .set({ 
          isApproved: true 
        })
        .where(eq(promotions.id, promotionId));
      
      // Channel posting functionality removed - promotion features simplified
      console.log(`✅ Promotion ${promotionId} approved`);
      const messageId = null;
      
      // Send real-time update to promotion owner
      if (promotion) {
        sendRealtimeUpdate(promotion.ownerId, {
          type: 'promotion_approved',
          promotionId: promotionId,
          title: promotion.title,
          message: `Your promotion "${promotion.title}" has been approved and is now live!`
        });
      }
      
      res.json({
        success: true,
        message: '✅ Promotion approved and posted to channel',
        messageId
      });
      
    } catch (error) {
      console.error('❌ Error approving promotion:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to approve promotion' 
      });
    }
  });
  
  // Reject promotion (admin only)
  app.post('/api/admin/promotions/:promotionId/reject', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      const { reason, refund = true } = req.body;
      
      // Check if user is admin
      const userBalance = await storage.getUserBalance(userId);
      const isAdmin = userBalance?.balance === '999999999' || userId === '6653616672';
      
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Get the promotion
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found'
        });
      }
      
      if (promotion.isApproved) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject approved promotion'
        });
      }
      
      // Reject the promotion by setting status to 'deleted'
      await db.update(promotions)
        .set({ 
          status: 'deleted'
        })
        .where(eq(promotions.id, promotionId));
      
      // Refund the user if requested (default true)
      if (refund) {
        const refundAmount = promotion.cost;
        await storage.createOrUpdateUserBalance(promotion.ownerId, `+${refundAmount}`);
        
        // Record the refund transaction
        await storage.addTransaction({
          userId: promotion.ownerId,
          amount: refundAmount,
          type: 'addition',
          source: 'promotion_refund',
          description: `Refund for rejected promotion: ${promotion.title}`,
          metadata: { 
            promotionId: promotion.id,
            reason: reason || 'Promotion rejected by admin',
            originalCost: promotion.cost
          }
        });
        
        console.log(`💰 Refunded $${refundAmount} to user ${promotion.ownerId} for rejected promotion ${promotionId}`);
      }
      
      // Send real-time update to promotion owner
      sendRealtimeUpdate(promotion.ownerId, {
        type: 'promotion_rejected',
        promotionId: promotionId,
        title: promotion.title,
        refunded: refund,
        refundAmount: refund ? promotion.cost : '0',
        message: `Your promotion "${promotion.title}" has been rejected` + (refund ? ' and you have been refunded' : '')
      });
      
      res.json({
        success: true,
        message: '❌ Promotion rejected' + (refund ? ' and user refunded' : ''),
        refunded: refund,
        refundAmount: refund ? promotion.cost : '0'
      });
      
    } catch (error) {
      console.error('❌ Error rejecting promotion:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to reject promotion' 
      });
    }
  });
  
  // Delete task/promotion (user can delete own, admin can delete any)
  app.delete('/api/promotions/:promotionId', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { promotionId } = req.params;
      
      // Get the promotion
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }
      
      // Check permissions: user can delete own tasks, admin can delete any
      const userBalance = await storage.getUserBalance(userId);
      const isAdmin = userBalance?.balance === '999999999' || userId === '6653616672';
      const isOwner = promotion.ownerId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own tasks'
        });
      }
      
      // Check if already deleted
      if (promotion.status === 'deleted') {
        return res.status(400).json({
          success: false,
          message: 'Task is already deleted'
        });
      }
      
      // Soft delete the promotion
      await db.update(promotions)
        .set({ 
          status: 'deleted' 
        })
        .where(eq(promotions.id, promotionId));
      
      // Calculate refund amount based on claims
      // If no claims yet, refund full cost. If claims exist, refund remaining budget
      const claimedCount = promotion.claimedCount || 0;
      const rewardPerUser = parseFloat(promotion.rewardPerUser);
      const totalCost = parseFloat(promotion.cost);
      const spentOnRewards = claimedCount * rewardPerUser;
      const refundAmount = Math.max(0, totalCost - spentOnRewards);
      
      // Issue refund if there's any amount to refund
      if (refundAmount > 0) {
        await storage.createOrUpdateUserBalance(promotion.ownerId, `+${refundAmount.toFixed(8)}`);
        
        // Record the refund transaction
        await storage.addTransaction({
          userId: promotion.ownerId,
          amount: refundAmount.toFixed(8),
          type: 'addition',
          source: 'task_deletion_refund',
          description: `Refund for deleted task: ${promotion.title}`,
          metadata: { 
            promotionId: promotion.id,
            originalCost: promotion.cost,
            claimedCount: claimedCount,
            refundReason: 'task_deleted'
          }
        });
        
        console.log(`💰 Refunded $${refundAmount.toFixed(8)} to user ${promotion.ownerId} for deleted task ${promotionId}`);
      }
      
      // Send real-time update to promotion owner (if not self-deleting)
      if (promotion.ownerId !== userId) {
        sendRealtimeUpdate(promotion.ownerId, {
          type: 'task_deleted',
          promotionId: promotionId,
          title: promotion.title,
          refunded: refundAmount > 0,
          refundAmount: refundAmount.toFixed(8),
          message: `Your task "${promotion.title}" has been deleted` + (refundAmount > 0 ? ` and you received a refund of $${refundAmount.toFixed(8)}` : '') + ` by admin`
        });
      }
      
      // Broadcast task removal to all users for real-time UI updates
      broadcastUpdate({
        type: 'task_removed',
        promotionId: promotionId
      });
      
      res.json({
        success: true,
        message: '🗑️ Task deleted successfully' + (refundAmount > 0 ? ` (refund: $${refundAmount.toFixed(8)})` : ''),
        refunded: refundAmount > 0,
        refundAmount: refundAmount.toFixed(8)
      });
      
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete task' 
      });
    }
  });
  
  // Admin withdrawal management endpoints
  
  // Get pending withdrawals (admin only)
  app.get('/api/admin/withdrawals/pending', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Check if user is admin
      const userBalance = await storage.getUserBalance(userId);
      const isAdmin = userBalance?.balance === '999999999' || userId === '6653616672';
      
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Get all pending withdrawals with user details
      const pendingWithdrawals = await db
        .select({
          id: withdrawals.id,
          userId: withdrawals.userId,
          amount: withdrawals.amount,
          method: withdrawals.method,
          details: withdrawals.details,
          createdAt: withdrawals.createdAt,
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
  
  // Approve withdrawal (admin only)
  app.post('/api/admin/withdrawals/:withdrawalId/approve', authenticateAdmin, async (req: any, res) => {
    try {
      const { withdrawalId } = req.params;
      const { adminNotes } = req.body;
      
      // Approve the withdrawal using existing storage method
      const result = await storage.approveWithdrawal(withdrawalId, adminNotes);
      
      if (result.success) {
        console.log(`✅ Withdrawal ${withdrawalId} approved by admin ${req.user.telegramUser.id}`);
        
        // Send real-time update to user
        if (result.withdrawal) {
          sendRealtimeUpdate(result.withdrawal.userId, {
            type: 'withdrawal_approved',
            amount: result.withdrawal.amount,
            method: result.withdrawal.method,
            message: `Your withdrawal of $${result.withdrawal.amount} has been approved and processed`
          });
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
            message: `Your withdrawal of $${result.withdrawal.amount} has been rejected and balance refunded`
          });
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

  return httpServer;
}
