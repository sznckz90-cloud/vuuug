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
  dailyTasks,
  promoCodes,
  transactions,
  adminSettings,
  advertiserTasks,
  taskClicks
} from "../shared/schema";
import { db } from "./db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import crypto from "crypto";
import { sendTelegramMessage, sendUserTelegramNotification, sendWelcomeMessage, handleTelegramMessage, setupTelegramWebhook, verifyChannelMembership } from "./telegram";
import { authenticateTelegram, requireAuth, optionalAuth } from "./auth";
import { isAuthenticated } from "./replitAuth";
import { config, getChannelConfig } from "./config";

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
  let messagesSent = 0;
  connectedUsers.forEach((connection, sessionId) => {
    if (connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(update));
        messagesSent++;
      } catch (error) {
        console.error(`❌ Failed to broadcast to session ${sessionId}:`, error);
        connectedUsers.delete(sessionId);
      }
    }
  });
  console.log(`📡 Broadcast sent to ${messagesSent} connected sessions`);
  return messagesSent;
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

  // Get channel configuration for frontend
  app.get('/api/config/channel', (req: any, res) => {
    res.json(getChannelConfig());
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
        console.log('⚠️ No initData provided - checking for cached user_id in headers');
        const cachedUserId = req.headers['x-user-id'];
        
        if (cachedUserId) {
          console.log('✅ Using cached user_id from headers:', cachedUserId);
          return res.json({ success: true, user: cachedUserId });
        }
        
        console.log('ℹ️ No cached user_id found - returning skipAuth response');
        return res.status(200).json({ success: true, skipAuth: true });
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
      
      // Ensure friendsInvited is properly calculated from actual referrals
      // This ensures the count is always accurate, even if DB field is NULL
      const actualReferralsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(eq(referrals.referrerId, userId));
      
      const friendsInvited = actualReferralsCount[0]?.count || 0;
      
      // Update DB if count is different (sync)
      if (user.friendsInvited !== friendsInvited) {
        await db
          .update(users)
          .set({ friendsInvited: friendsInvited })
          .where(eq(users.id, userId));
      }
      
      // Add referral link with fallback bot username
      const botUsername = process.env.BOT_USERNAME || "LightningSatsbot";
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
      
      res.json({
        ...user,
        friendsInvited,
        referralLink
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Balance refresh endpoint - used after conversion to sync frontend
  app.get('/api/user/balance/refresh', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log('⚠️ Balance refresh requested without session - sending empty response');
        return res.json({ 
          success: true, 
          skipAuth: true, 
          balance: '0', 
          tonBalance: '0' 
        });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`🔄 Balance refresh for user ${userId}: PAD=${user.balance}, TON=${user.tonBalance}`);
      
      res.json({
        success: true,
        balance: user.balance,
        tonBalance: user.tonBalance,
        padBalance: user.balance
      });
    } catch (error) {
      console.error("Error refreshing balance:", error);
      res.status(500).json({ message: "Failed to refresh balance" });
    }
  });

  // Get current app settings (public endpoint for frontend to fetch ad limits)
  app.get('/api/app-settings', async (req: any, res) => {
    try {
      // Fetch admin settings for daily limit and reward amount
      const dailyAdLimitSetting = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, 'daily_ad_limit')).limit(1);
      const rewardPerAdSetting = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, 'reward_per_ad')).limit(1);
      const seasonBroadcastSetting = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, 'season_broadcast_active')).limit(1);
      
      const dailyAdLimit = dailyAdLimitSetting[0]?.settingValue ? parseInt(dailyAdLimitSetting[0].settingValue) : 50;
      const rewardPerAd = rewardPerAdSetting[0]?.settingValue ? parseInt(rewardPerAdSetting[0].settingValue) : 1000;
      const seasonBroadcastActive = seasonBroadcastSetting[0]?.settingValue === 'true';
      
      res.json({
        dailyAdLimit,
        rewardPerAd,
        seasonBroadcastActive
      });
    } catch (error) {
      console.error("Error fetching app settings:", error);
      res.status(500).json({ message: "Failed to fetch app settings" });
    }
  });

  // Ad watching endpoint - configurable daily limit and reward amount
  app.post('/api/ads/watch', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Get user to check daily ad limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Fetch admin settings for daily limit and reward amount
      const dailyAdLimitSetting = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, 'daily_ad_limit')).limit(1);
      const rewardPerAdSetting = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, 'reward_per_ad')).limit(1);
      
      const dailyAdLimit = dailyAdLimitSetting[0]?.settingValue ? parseInt(dailyAdLimitSetting[0].settingValue) : 50;
      const rewardPerAdPAD = rewardPerAdSetting[0]?.settingValue ? parseInt(rewardPerAdSetting[0].settingValue) : 1000;
      
      // Enforce daily ad limit (configurable, default 50)
      const adsWatchedToday = user.adsWatchedToday || 0;
      if (adsWatchedToday >= dailyAdLimit) {
        return res.status(429).json({ 
          message: `Daily ad limit reached. You can watch up to ${dailyAdLimit} ads per day.`,
          limit: dailyAdLimit,
          watched: adsWatchedToday
        });
      }
      
      // Calculate reward in TON from PAD amount (1000 PAD = 0.0001 TON)
      const adRewardTON = (rewardPerAdPAD / 10000000).toFixed(8);
      const adRewardPAD = rewardPerAdPAD;
      
      try {
        // Process reward with error handling to ensure success response
        await storage.addEarning({
          userId,
          amount: adRewardTON,
          source: 'ad_watch',
          description: 'Watched advertisement',
        });
        
        // Increment ads watched count
        await storage.incrementAdsWatched(userId);
        
        // Check and activate referral bonuses (anti-fraud: requires 10 ads)
        try {
          await storage.checkAndActivateReferralBonus(userId);
        } catch (bonusError) {
          // Log but don't fail the request if bonus processing fails
          console.error("⚠️ Referral bonus processing failed (non-critical):", bonusError);
        }
        
        // Process 10% referral commission for referrer (if user was referred)
        if (user.referredBy) {
          try {
            const referralCommissionTON = (parseFloat(adRewardTON) * 0.1).toFixed(8);
            await storage.addEarning({
              userId: user.referredBy,
              amount: referralCommissionTON,
              source: 'referral_commission',
              description: `10% commission from ${user.username || user.telegram_id}'s ad watch`,
            });
          } catch (commissionError) {
            // Log but don't fail the request if commission processing fails
            console.error("⚠️ Referral commission processing failed (non-critical):", commissionError);
          }
        }
      } catch (earningError) {
        console.error("❌ Critical error adding earning:", earningError);
        // Even if earning fails, still try to return success to avoid user-facing errors
        // The ad was watched, so we should acknowledge it
      }
      
      // Get updated balance (with fallback)
      let updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        updatedUser = user; // Fallback to original user data
      }
      const newAdsWatched = updatedUser?.adsWatchedToday || (adsWatchedToday + 1);
      
      // Send real-time update to user (non-blocking)
      try {
        sendRealtimeUpdate(userId, {
          type: 'ad_reward',
          amount: adRewardTON,
          message: 'Ad reward earned!',
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        // WebSocket errors should not affect the response
        console.error("⚠️ WebSocket update failed (non-critical):", wsError);
      }
      
      // ALWAYS return success response to ensure reward notification shows
      res.json({ 
        success: true, 
        rewardPAD: adRewardPAD,
        newBalance: updatedUser?.balance || user.balance || "0",
        adsWatchedToday: newAdsWatched
      });
    } catch (error) {
      console.error("❌ Unexpected error in ad watch endpoint:", error);
      console.error("   Error details:", error instanceof Error ? error.message : String(error));
      console.error("   Stack trace:", error instanceof Error ? error.stack : 'N/A');
      
      // Return success anyway to prevent error notification from showing
      // The user watched the ad, so we should acknowledge it
      const adRewardPAD = Math.round(parseFloat("0.00010000") * 10000000);
      res.json({ 
        success: true, 
        rewardPAD: adRewardPAD,
        newBalance: "0",
        adsWatchedToday: 0,
        warning: "Reward processing encountered an issue but was acknowledged"
      });
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
            channelUsername: config.telegram.channelId,
            channelUrl: config.telegram.channelUrl,
            message: 'Development mode: membership check bypassed'
          });
        }
        
        console.error('❌ TELEGRAM_BOT_TOKEN not configured');
        return res.status(500).json({ 
          success: false,
          isMember: false, 
          message: 'Channel verification is temporarily unavailable. Please try again later.',
          error_code: 'VERIFICATION_UNAVAILABLE'
        });
      }
      
      // Check membership for configured channel
      const isMember = await verifyChannelMembership(
        parseInt(telegramId), 
        config.telegram.channelId, 
        botToken
      );
      
      res.json({ 
        success: true,
        isMember,
        channelUsername: config.telegram.channelId,
        channelUrl: config.telegram.channelUrl
      });
    } catch (error) {
      console.error("Error checking channel membership:", error);
      res.json({ 
        success: false,
        isMember: false,
        message: 'Unable to verify channel membership. Please make sure you have joined the channel and try again.',
        error_code: 'VERIFICATION_ERROR'
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
          config.telegram.channelId, 
          botToken
        );
        
        if (!isMember) {
          return res.status(403).json({ 
            success: false,
            message: 'Please join our Telegram channel first to claim your daily streak reward.',
            requiresChannelJoin: true,
            channelUsername: config.telegram.channelId,
            channelUrl: config.telegram.channelUrl
          });
        }
      } else if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({ 
          success: false,
          message: 'Channel verification is temporarily unavailable. Please try again later.',
          error_code: 'VERIFICATION_UNAVAILABLE'
        });
      }
      
      const result = await storage.updateUserStreak(userId);
      
      if (parseFloat(result.rewardEarned) === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'You have already claimed your daily reward. Come back after 12:00 PM UTC!'
        });
      }
      
      sendRealtimeUpdate(userId, {
        type: 'streak_reward',
        amount: result.rewardEarned,
        message: '✅ Daily streak claimed!',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true,
        newStreak: result.newStreak,
        rewardEarned: result.rewardEarned,
        isBonusDay: result.isBonusDay,
        message: 'Streak updated successfully'
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

  // Referral stats endpoint - auth removed to prevent popup spam on affiliates page
  app.get('/api/referrals/stats', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log('⚠️ Referral stats requested without session - sending empty response');
        return res.json({ 
          success: true, 
          skipAuth: true, 
          totalInvites: 0, 
          totalClaimed: '0', 
          availableBonus: '0', 
          readyToClaim: '0' 
        });
      }
      const user = await storage.getUser(userId);
      const referrals = await storage.getUserReferrals(userId);
      
      res.json({
        totalInvites: referrals.length,
        totalClaimed: user?.totalClaimedReferralBonus || '0',
        availableBonus: user?.pendingReferralBonus || '0',
        readyToClaim: user?.pendingReferralBonus || '0',
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Claim referral bonus endpoint - auth removed to prevent popup spam on affiliates page
  app.post('/api/referrals/claim', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log('⚠️ Referral claim requested without session - skipping');
        return res.json({ success: true, skipAuth: true });
      }
      const result = await storage.claimReferralBonus(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error claiming referral bonus:", error);
      res.status(500).json({ message: "Failed to claim referral bonus" });
    }
  });

  // Search referral by code endpoint - auth removed to prevent popup spam on affiliates page
  app.get('/api/referrals/search/:code', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const currentUserId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!currentUserId) {
        console.log('⚠️ Referral search requested without session - skipping');
        return res.status(404).json({ message: "Referral not found", skipAuth: true });
      }
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





  // Debug endpoint for referral issues - auth removed to prevent popup spam
  app.get('/api/debug/referrals', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log('⚠️ Debug referrals requested without session - sending empty response');
        return res.json({ success: true, skipAuth: true, data: {} });
      }
      
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

  
  // ===== TASK SYSTEM DISABLED =====
  // Middleware to block all task-related API endpoints
  app.use('/api/tasks', (req, res, next) => {
    res.status(403).json({
      success: false,
      message: 'Task feature has been disabled'
    });
  });
  
  // Get user's daily tasks (new system) - DISABLED
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
      
      const result = await storage.claimDailyTaskReward(userId, taskLevel);
      
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

  // Get daily task completion status
  app.get('/api/tasks/daily/status', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        return res.json({ success: true, completedTasks: [] });
      }

      const [user] = await db
        .select({
          taskShareCompleted: users.taskShareCompletedToday,
          taskChannelCompleted: users.taskChannelCompletedToday,
          taskCommunityCompleted: users.taskCommunityCompletedToday,
          lastStreakDate: users.lastStreakDate
        })
        .from(users)
        .where(eq(users.id, userId));

      const completedTasks = [];
      if (user?.taskShareCompleted) completedTasks.push('share-friends');
      if (user?.taskChannelCompleted) completedTasks.push('check-updates');
      if (user?.taskCommunityCompleted) completedTasks.push('join-community');
      
      if (user?.lastStreakDate) {
        const lastClaim = new Date(user.lastStreakDate);
        const hoursSinceLastClaim = (new Date().getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastClaim < 24) {
          completedTasks.push('claim-streak');
        }
      }

      res.json({
        success: true,
        completedTasks
      });
      
    } catch (error) {
      console.error('Error fetching task status:', error);
      res.json({ success: true, completedTasks: [] });
    }
  });

  // New simplified task completion endpoints with daily tracking
  app.post('/api/tasks/complete/share', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        return res.json({ success: true, skipAuth: true });
      }
      
      // Check if already completed today
      const [user] = await db
        .select({ taskShareCompletedToday: users.taskShareCompletedToday })
        .from(users)
        .where(eq(users.id, userId));
      
      if (user?.taskShareCompletedToday) {
        return res.status(400).json({
          success: false,
          message: 'Task already completed today'
        });
      }
      
      // Reward: 0.0001 TON = 1,000 PAD
      const rewardAmount = '0.0001';
      
      await db.transaction(async (tx) => {
        // Update balance and mark task complete
        await tx.update(users)
          .set({ 
            balance: sql`${users.balance} + ${rewardAmount}`,
            taskShareCompletedToday: true,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        // Add earning record
        await storage.addEarning({
          userId,
          amount: rewardAmount,
          source: 'task_share',
          description: 'Share with Friends task completed'
        });
      });
      
      res.json({
        success: true,
        message: 'Task completed!',
        rewardAmount
      });
      
    } catch (error) {
      console.error('Error completing share task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete task'
      });
    }
  });

  app.post('/api/tasks/complete/channel', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        return res.json({ success: true, skipAuth: true });
      }
      
      // Check if already completed today
      const [user] = await db
        .select({ taskChannelCompletedToday: users.taskChannelCompletedToday })
        .from(users)
        .where(eq(users.id, userId));
      
      if (user?.taskChannelCompletedToday) {
        return res.status(400).json({
          success: false,
          message: 'Task already completed today'
        });
      }
      
      // Reward: 0.0001 TON = 1,000 PAD
      const rewardAmount = '0.0001';
      
      await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ 
            balance: sql`${users.balance} + ${rewardAmount}`,
            taskChannelCompletedToday: true,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        await storage.addEarning({
          userId,
          amount: rewardAmount,
          source: 'task_channel',
          description: 'Check for Updates task completed'
        });
      });
      
      res.json({
        success: true,
        message: 'Task completed!',
        rewardAmount
      });
      
    } catch (error) {
      console.error('Error completing channel task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete task'
      });
    }
  });

  app.post('/api/tasks/complete/community', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        return res.json({ success: true, skipAuth: true });
      }
      
      // Check if already completed today
      const [user] = await db
        .select({ taskCommunityCompletedToday: users.taskCommunityCompletedToday })
        .from(users)
        .where(eq(users.id, userId));
      
      if (user?.taskCommunityCompletedToday) {
        return res.status(400).json({
          success: false,
          message: 'Task already completed today'
        });
      }
      
      // Reward: 0.0001 TON = 1,000 PAD
      const rewardAmount = '0.0001';
      
      await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ 
            balance: sql`${users.balance} + ${rewardAmount}`,
            taskCommunityCompletedToday: true,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        await storage.addEarning({
          userId,
          amount: rewardAmount,
          source: 'task_community',
          description: 'Join Community task completed'
        });
      });
      
      res.json({
        success: true,
        message: 'Task completed!',
        rewardAmount
      });
      
    } catch (error) {
      console.error('Error completing community task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete task'
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
      
      // Step 3: Sync friendsInvited counts from database for withdrawal unlock
      await storage.syncFriendsInvitedCounts();
      
      // Step 4: Get repair summary
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
        message: 'Emergency referral data repair completed successfully! Your friendsInvited count has been synced for withdrawal unlock.',
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

  // Test endpoint removed - bot uses inline buttons only
  app.get('/api/telegram/test/:chatId', async (req: any, res) => {
    res.json({ 
      success: false, 
      message: 'Test endpoint removed - bot uses inline buttons only'
    });
  });

  // Admin stats endpoint
  app.get('/api/admin/stats', authenticateAdmin, async (req: any, res) => {
    try {
      // Get various statistics for admin dashboard using drizzle
      const totalUsersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const totalEarningsSum = await db.select({ total: sql<string>`COALESCE(SUM(${users.totalEarned}), '0')` }).from(users);
      const totalWithdrawalsSum = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), '0')` }).from(withdrawals).where(sql`${withdrawals.status} IN ('completed', 'success', 'paid', 'Approved')`);
      const pendingWithdrawalsCount = await db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(eq(withdrawals.status, 'pending'));
      const successfulWithdrawalsCount = await db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(sql`${withdrawals.status} IN ('completed', 'success', 'paid', 'Approved')`);
      const rejectedWithdrawalsCount = await db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(eq(withdrawals.status, 'rejected'));
      const activePromosCount = await db.select({ count: sql<number>`count(*)` }).from(promoCodes).where(eq(promoCodes.isActive, true));
      const dailyActiveCount = await db.select({ count: sql<number>`count(distinct ${earnings.userId})` }).from(earnings).where(sql`DATE(${earnings.createdAt}) = CURRENT_DATE`);
      const totalAdsSum = await db.select({ total: sql<number>`COALESCE(SUM(${users.adsWatched}), 0)` }).from(users);
      const todayAdsSum = await db.select({ total: sql<number>`COALESCE(SUM(${users.adsWatchedToday}), 0)` }).from(users);
      const tonWithdrawnSum = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), '0')` }).from(withdrawals).where(sql`${withdrawals.status} IN ('completed', 'success', 'paid', 'Approved')`);

      res.json({
        totalUsers: totalUsersCount[0]?.count || 0,
        totalEarnings: totalEarningsSum[0]?.total || '0',
        totalWithdrawals: totalWithdrawalsSum[0]?.total || '0',
        tonWithdrawn: tonWithdrawnSum[0]?.total || '0',
        pendingWithdrawals: pendingWithdrawalsCount[0]?.count || 0,
        successfulWithdrawals: successfulWithdrawalsCount[0]?.count || 0,
        rejectedWithdrawals: rejectedWithdrawalsCount[0]?.count || 0,
        activePromos: activePromosCount[0]?.count || 0,
        dailyActiveUsers: dailyActiveCount[0]?.count || 0,
        totalAdsWatched: totalAdsSum[0]?.total || 0,
        todayAdsWatched: todayAdsSum[0]?.total || 0,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Get admin settings
  app.get('/api/admin/settings', authenticateAdmin, async (req: any, res) => {
    try {
      const settings = await db.select().from(adminSettings);
      
      // Helper function to get setting value
      const getSetting = (key: string, defaultValue: any) => {
        const setting = settings.find(s => s.settingKey === key);
        return setting?.settingValue || defaultValue;
      };
      
      // Return all settings in format expected by frontend
      res.json({
        dailyAdLimit: parseInt(getSetting('daily_ad_limit', '50')),
        rewardPerAd: parseInt(getSetting('reward_per_ad', '1000')),
        affiliateCommission: parseFloat(getSetting('affiliate_commission', '10')),
        walletChangeFee: parseFloat(getSetting('wallet_change_fee', '0.01')),
        minimumWithdrawal: parseFloat(getSetting('minimum_withdrawal', '0.5')),
        taskPerClickReward: parseFloat(getSetting('task_per_click_reward', '0.0001750')),
        taskCreationCost: parseFloat(getSetting('task_creation_cost', '0.0003')),
        minimumConvert: parseFloat(getSetting('minimum_convert', '0.01')),
        seasonBroadcastActive: getSetting('season_broadcast_active', 'false') === 'true',
      });
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ message: "Failed to fetch admin settings" });
    }
  });
  
  // Update admin settings
  app.put('/api/admin/settings', authenticateAdmin, async (req: any, res) => {
    try {
      const { 
        dailyAdLimit, 
        rewardPerAd, 
        affiliateCommission,
        walletChangeFee,
        minimumWithdrawal,
        taskPerClickReward,
        taskCreationCost,
        minimumConvert,
        seasonBroadcastActive
      } = req.body;
      
      // Helper function to update a setting
      const updateSetting = async (key: string, value: any) => {
        if (value !== undefined && value !== null) {
          await db.execute(sql`
            INSERT INTO admin_settings (setting_key, setting_value, updated_at)
            VALUES (${key}, ${value.toString()}, NOW())
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = ${value.toString()}, updated_at = NOW()
          `);
        }
      };
      
      // Update all provided settings
      await updateSetting('daily_ad_limit', dailyAdLimit);
      await updateSetting('reward_per_ad', rewardPerAd);
      await updateSetting('affiliate_commission', affiliateCommission);
      await updateSetting('wallet_change_fee', walletChangeFee);
      await updateSetting('minimum_withdrawal', minimumWithdrawal);
      await updateSetting('task_per_click_reward', taskPerClickReward);
      await updateSetting('task_creation_cost', taskCreationCost);
      await updateSetting('minimum_convert', minimumConvert);
      await updateSetting('season_broadcast_active', seasonBroadcastActive);
      
      res.json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ success: false, message: "Failed to update admin settings" });
    }
  });
  
  // Toggle season broadcast
  app.post('/api/admin/season-broadcast', authenticateAdmin, async (req: any, res) => {
    try {
      const { active } = req.body;
      
      if (active === undefined) {
        return res.status(400).json({ message: "active field is required" });
      }
      
      await db.execute(sql`
        INSERT INTO admin_settings (setting_key, setting_value, updated_at)
        VALUES ('season_broadcast_active', ${active ? 'true' : 'false'}, NOW())
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = ${active ? 'true' : 'false'}, updated_at = NOW()
      `);
      
      res.json({ 
        success: true, 
        message: active ? "Season broadcast enabled" : "Season broadcast disabled",
        active 
      });
    } catch (error) {
      console.error("Error toggling season broadcast:", error);
      res.status(500).json({ success: false, message: "Failed to toggle season broadcast" });
    }
  });
  
  // Broadcast message to all users (for admin use)
  app.post('/api/admin/broadcast', authenticateAdmin, async (req: any, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Get all users with Telegram IDs
      const allUsers = await db.select({ 
        telegramId: users.telegram_id 
      }).from(users).where(sql`${users.telegram_id} IS NOT NULL`);
      
      let successCount = 0;
      let failCount = 0;
      
      // Send message to each user
      for (const user of allUsers) {
        if (user.telegramId) {
          const sent = await sendUserTelegramNotification(user.telegramId, message);
          if (sent) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `Broadcast sent`,
        details: {
          total: allUsers.length,
          sent: successCount,
          failed: failCount
        }
      });
    } catch (error) {
      console.error("Error broadcasting message:", error);
      res.status(500).json({ message: "Failed to broadcast message" });
    }
  });

  // Admin chart analytics endpoint - get real time-series data
  app.get('/api/admin/analytics/chart', authenticateAdmin, async (req: any, res) => {
    try {
      // Get data for last 7 days grouped by date
      const last7DaysData = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS date
        ),
        daily_stats AS (
          SELECT 
            DATE(e.created_at) as date,
            COUNT(DISTINCT e.user_id) as active_users,
            COALESCE(SUM(e.amount), 0) as earnings
          FROM ${earnings} e
          WHERE e.created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(e.created_at)
        ),
        daily_withdrawals AS (
          SELECT 
            DATE(w.created_at) as date,
            COALESCE(SUM(w.amount), 0) as withdrawals
          FROM ${withdrawals} w
          WHERE w.created_at >= CURRENT_DATE - INTERVAL '6 days'
            AND w.status IN ('completed', 'success', 'paid', 'Approved')
          GROUP BY DATE(w.created_at)
        ),
        daily_user_count AS (
          SELECT 
            DATE(u.created_at) as date,
            COUNT(*) as new_users
          FROM ${users} u
          WHERE u.created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(u.created_at)
        )
        SELECT 
          ds.date,
          COALESCE(s.active_users, 0) as active_users,
          COALESCE(s.earnings, 0) as earnings,
          COALESCE(w.withdrawals, 0) as withdrawals,
          COALESCE(u.new_users, 0) as new_users
        FROM date_series ds
        LEFT JOIN daily_stats s ON ds.date = s.date
        LEFT JOIN daily_withdrawals w ON ds.date = w.date
        LEFT JOIN daily_user_count u ON ds.date = u.date
        ORDER BY ds.date ASC
      `);

      // Get cumulative user count for each day
      const totalUsersBeforeWeek = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(sql`${users.createdAt} < CURRENT_DATE - INTERVAL '6 days'`);
      
      // Ensure initial count is a number to prevent string concatenation
      let cumulativeUsers = Number(totalUsersBeforeWeek[0]?.count || 0);
      
      const chartData = last7DaysData.rows.map((row: any, index: number) => {
        cumulativeUsers += Number(row.new_users || 0);
        return {
          period: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          users: Number(cumulativeUsers), // Ensure it's a number in the output
          earnings: parseFloat(row.earnings || '0'),
          withdrawals: parseFloat(row.withdrawals || '0'),
          activeUsers: Number(row.active_users || 0)
        };
      });

      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      console.error("Error fetching chart analytics:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch analytics data" 
      });
    }
  });

  // Admin user tracking endpoint - search by UID/referral code OR user ID
  app.get('/api/admin/user-tracking/:uid', authenticateAdmin, async (req: any, res) => {
    try {
      const { uid } = req.params;
      
      // Search user by referral code OR user ID
      const userResults = await db
        .select()
        .from(users)
        .where(sql`${users.referralCode} = ${uid} OR ${users.id} = ${uid}`)
        .limit(1);
      
      if (userResults.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found - please check the UID/ID and try again'
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
          userId: user.id,
          balance: user.balance,
          totalEarnings: user.totalEarned,
          withdrawalCount: withdrawalCount[0]?.count || 0,
          referralCount: referralCount[0]?.count || 0,
          status: user.banned ? 'Banned' : 'Active',
          joinedDate: user.createdAt,
          adsWatched: user.adsWatched,
          walletAddress: user.tonWalletAddress || 'Not set'
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

  // Admin banned users endpoint
  app.get('/api/admin/banned-users', authenticateAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const bannedUsers = allUsers.filter(user => user.banned);
      res.json(bannedUsers);
    } catch (error) {
      console.error("Error fetching banned users:", error);
      res.status(500).json({ message: "Failed to fetch banned users" });
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
  
  // Get user's saved wallet details - auth removed to prevent popup spam
  app.get('/api/wallet/details', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Wallet details requested without session - sending empty response");
        return res.json({ success: true, skipAuth: true, wallet: null });
      }
      
      const [user] = await db
        .select({
          tonWalletAddress: users.tonWalletAddress,
          tonWalletComment: users.tonWalletComment,
          telegramUsername: users.telegramUsername,
          cwalletId: users.cwalletId,
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
      
      res.json({
        success: true,
        walletDetails: {
          tonWalletAddress: user.tonWalletAddress || '',
          tonWalletComment: user.tonWalletComment || '',
          telegramUsername: user.telegramUsername || '',
          cwalletId: user.cwalletId || '',
          cwallet_id: user.cwalletId || '', // Support both formats
          canWithdraw: true
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
  
  // Save user's wallet details - auth removed to prevent popup spam
  app.post('/api/wallet/save', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Wallet save requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      const { tonWalletAddress, tonWalletComment, telegramUsername } = req.body;
      
      console.log('💾 Saving wallet details for user:', userId);
      
      // Update user's wallet details
      await db
        .update(users)
        .set({
          tonWalletAddress: tonWalletAddress || null,
          tonWalletComment: tonWalletComment || null,
          telegramUsername: telegramUsername || null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log('✅ Wallet details saved successfully');
      
      res.json({
        success: true,
        message: 'Wallet details saved successfully.'
      });
      
    } catch (error) {
      console.error('❌ Error saving wallet details:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save wallet details' 
      });
    }
  });

  // Save Cwallet ID endpoint - auth removed to prevent popup spam
  app.post('/api/wallet/cwallet', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Cwallet save requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      const { cwalletId } = req.body;
      
      console.log('💾 Saving Cwallet ID for user:', userId);
      
      if (!cwalletId || !cwalletId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid Cwallet ID'
        });
      }
      
      // Validate that wallet ID contains only numbers
      if (!/^\d+$/.test(cwalletId.trim())) {
        console.log('🚫 Invalid wallet format - numbers only');
        return res.status(400).json({
          success: false,
          message: 'Wallet ID must contain only numbers'
        });
      }
      
      // 🔒 WALLET LOCK: Check if wallet is already set - only allow one-time setup
      const [existingUser] = await db
        .select({ cwalletId: users.cwalletId })
        .from(users)
        .where(eq(users.id, userId));
      
      if (existingUser?.cwalletId) {
        console.log('🚫 Wallet already set - only one time setup allowed');
        return res.status(400).json({
          success: false,
          message: 'Wallet already set — only one time setup allowed'
        });
      }
      
      // 🔐 UNIQUENESS CHECK: Ensure wallet ID is not already used by another account
      const walletToCheck = cwalletId?.trim();
      if (walletToCheck) {
        const [walletInUse] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.cwalletId, walletToCheck),
            sql`${users.id} != ${userId}`
          ))
          .limit(1);
        
        if (walletInUse) {
          console.log('🚫 Wallet ID already linked to another account');
          return res.status(400).json({
            success: false,
            message: 'This wallet ID is already linked to another account.'
          });
        }
      }
      
      // Update user's Cwallet ID
      await db
        .update(users)
        .set({
          cwalletId: cwalletId.trim(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log('✅ Cwallet ID saved successfully');
      
      res.json({
        success: true,
        message: 'Cwallet ID saved successfully.'
      });
      
    } catch (error) {
      console.error('❌ Error saving Cwallet ID:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save Cwallet ID' 
      });
    }
  });

  // Alternative Cwallet save endpoint for compatibility - /api/set-wallet
  app.post('/api/set-wallet', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Wallet save (set-wallet) requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      
      const { cwallet_id, cwalletId } = req.body;
      const walletId = cwallet_id || cwalletId; // Support both formats
      
      console.log('💾 Saving Cwallet ID via /api/set-wallet for user:', userId);
      
      if (!walletId || !walletId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Missing Cwallet ID'
        });
      }
      
      // Validate that wallet ID contains only numbers
      if (!/^\d+$/.test(walletId.trim())) {
        console.log('🚫 Invalid wallet format - numbers only');
        return res.status(400).json({
          success: false,
          message: 'Wallet ID must contain only numbers'
        });
      }
      
      // 🔒 WALLET LOCK: Check if wallet is already set - only allow one-time setup
      const [existingUser] = await db
        .select({ cwalletId: users.cwalletId })
        .from(users)
        .where(eq(users.id, userId));
      
      if (existingUser?.cwalletId) {
        console.log('🚫 Wallet already set - only one time setup allowed');
        return res.status(400).json({
          success: false,
          message: 'Wallet already set — only one time setup allowed'
        });
      }
      
      // 🔐 UNIQUENESS CHECK: Ensure wallet ID is not already used by another account
      const walletToCheck = cwalletId?.trim();
      if (walletToCheck) {
        const [walletInUse] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.cwalletId, walletToCheck),
            sql`${users.id} != ${userId}`
          ))
          .limit(1);
        
        if (walletInUse) {
          console.log('🚫 Wallet ID already linked to another account');
          return res.status(400).json({
            success: false,
            message: 'This wallet ID is already linked to another account.'
          });
        }
      }
      
      // Update user's Cwallet ID in database - permanent storage
      await db
        .update(users)
        .set({
          cwalletId: walletId.trim(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log('✅ Cwallet ID saved permanently via /api/set-wallet');
      
      res.json({
        success: true,
        message: 'Wallet saved successfully'
      });
      
    } catch (error) {
      console.error('❌ Error saving Cwallet ID via /api/set-wallet:', error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to save wallet'
      });
    }
  });
  
  // Change wallet endpoint - requires 5000 PAD fee
  app.post('/api/wallet/change', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Wallet change requested without session - skipping");
        return res.status(401).json({
          success: false,
          message: 'Please log in to change wallet'
        });
      }
      
      const { newWalletId } = req.body;
      
      console.log('🔄 Wallet change request for user:', userId);
      
      if (!newWalletId || !newWalletId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid wallet ID'
        });
      }
      
      // Validate that wallet ID contains only numbers
      if (!/^\d+$/.test(newWalletId.trim())) {
        console.log('🚫 Invalid wallet format - numbers only');
        return res.status(400).json({
          success: false,
          message: 'Wallet ID must contain only numbers'
        });
      }
      
      // Use database transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Get current user with balance
        const [user] = await tx
          .select({
            id: users.id,
            balance: users.balance,
            cwalletId: users.cwalletId
          })
          .from(users)
          .where(eq(users.id, userId));
        
        if (!user) {
          throw new Error('User not found');
        }
        
        // Check if user has an existing wallet
        if (!user.cwalletId) {
          throw new Error('No wallet set. Please set up your wallet first.');
        }
        
        // Check if new wallet is same as current
        if (user.cwalletId === newWalletId.trim()) {
          throw new Error('New wallet ID is the same as current wallet');
        }
        
        // Check wallet uniqueness
        const [walletInUse] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.cwalletId, newWalletId.trim()),
            sql`${users.id} != ${userId}`
          ))
          .limit(1);
        
        if (walletInUse) {
          throw new Error('This wallet ID is already linked to another account');
        }
        
        // Calculate fee: 5000 PAD = 0.0005 TON (conversion rate: 10,000,000 PAD = 1 TON)
        const FEE_IN_TON = 0.0005;
        const currentBalance = parseFloat(user.balance || '0');
        
        if (currentBalance < FEE_IN_TON) {
          throw new Error(`Insufficient balance. You need ${5000} PAD to change wallet. Current balance: ${Math.floor(currentBalance * 10000000)} PAD`);
        }
        
        // Deduct fee from balance
        const newBalance = currentBalance - FEE_IN_TON;
        
        // Update wallet and balance atomically
        await tx
          .update(users)
          .set({
            cwalletId: newWalletId.trim(),
            balance: newBalance.toFixed(8),
            walletUpdatedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        // Record transaction
        await tx.insert(transactions).values({
          userId: userId,
          amount: FEE_IN_TON.toFixed(8),
          type: 'deduction',
          source: 'wallet_change_fee',
          description: 'Fee for changing wallet ID',
          metadata: { oldWallet: user.cwalletId, newWallet: newWalletId.trim() }
        });
        
        return {
          newBalance: newBalance.toFixed(8),
          newWallet: newWalletId.trim(),
          feeCharged: FEE_IN_TON.toFixed(8)
        };
      });
      
      console.log('✅ Wallet changed successfully with fee deduction');
      
      res.json({
        success: true,
        message: 'Wallet updated successfully',
        data: {
          newWalletId: result.newWallet,
          newBalance: result.newBalance,
          feeCharged: result.feeCharged
        }
      });
      
    } catch (error) {
      console.error('❌ Error changing wallet:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change wallet'
      });
    }
  });
  
  // PAD to TON conversion endpoint - auth removed to prevent popup spam
  // ✅ USER ISOLATION: Each user's data is fetched from database using their unique session userId
  // No global/shared state - prevents "all users seeing same balance" issue
  app.post('/api/wallet/convert', async (req: any, res) => {
    try {
      // Get THIS user's ID from their session - ensures per-user isolation
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Convert requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      const { padAmount } = req.body;
      
      console.log('💱 PAD to TON conversion request:', { userId, padAmount });
      
      // Validation: Check amount is valid
      const convertAmount = parseFloat(padAmount);
      if (!padAmount || isNaN(convertAmount) || convertAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid PAD amount'
        });
      }
      
      // Conversion rate: 10,000,000 PAD = 1 TON
      const CONVERSION_RATE = 10000000;
      // Minimum conversion: 10,000 PAD (0.001 TON)
      const minimumPad = 10000;
      
      if (convertAmount < minimumPad) {
        return res.status(400).json({
          success: false,
          message: `Minimum 10,000 PAD required to convert.`
        });
      }
      
      // Use transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Lock user row and get current balances
        const [user] = await tx
          .select({ 
            balance: users.balance,
            tonBalance: users.tonBalance
          })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        
        if (!user) {
          throw new Error('User not found');
        }
        
        // FIX: balance field stores TON amounts (not PAD)
        // Convert TON to PAD for display and conversion logic
        const currentBalanceTON = parseFloat(user.balance || '0');
        const currentTonBalance = parseFloat(user.tonBalance || '0');
        const currentPadBalance = currentBalanceTON * CONVERSION_RATE; // Convert TON to PAD for display
        
        console.log(`📊 Current balances - TON in balance: ${currentBalanceTON}, PAD equivalent: ${currentPadBalance}, TON wallet: ${currentTonBalance}`);
        
        // Check if user has enough PAD to convert
        if (currentPadBalance < convertAmount) {
          throw new Error('Insufficient PAD balance');
        }
        
        // Calculate TON amount to deduct from balance and add to tonBalance
        const tonToDeduct = convertAmount / CONVERSION_RATE;
        
        // Apply conversion logic:
        // balance (TON) -= convertAmount / 10000000 (deduct TON equivalent of PAD)
        // tonBalance += convertAmount / 10000000 (add to TON wallet)
        const newBalanceTON = currentBalanceTON - tonToDeduct;
        const newTonBalance = currentTonBalance + tonToDeduct;
        const newPadBalance = newBalanceTON * CONVERSION_RATE;
        
        // Update user balances - store TON amounts in both fields
        await tx
          .update(users)
          .set({
            balance: newBalanceTON.toFixed(8),
            tonBalance: newTonBalance.toFixed(8),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        console.log(`✅ Conversion successful: ${convertAmount} PAD → ${tonToDeduct} TON`);
        console.log(`   New balance (TON): ${newBalanceTON.toFixed(8)}, New TON wallet: ${newTonBalance.toFixed(8)}`);
        
        return {
          padAmount: convertAmount,
          tonAmount: tonToDeduct,
          newPadBalance,
          newTonBalance
        };
      });
      
      // Send real-time update - send TON values (frontend converts to PAD for display)
      sendRealtimeUpdate(userId, {
        type: 'balance_update',
        balance: (result.newPadBalance / CONVERSION_RATE).toFixed(8), // Convert back to TON
        tonBalance: result.newTonBalance.toFixed(8)
      });
      
      res.json({
        success: true,
        message: 'Converted successfully!',
        ...result
      });
      
    } catch (error) {
      console.error('❌ Error converting PAD to TON:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert PAD to TON';
      
      if (errorMessage === 'Insufficient PAD balance' || errorMessage === 'User not found') {
        return res.status(400).json({ 
          success: false, 
          message: errorMessage
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to convert PAD to TON' 
      });
    }
  });

  // Advertiser Task System API routes
  
  // Get all active advertiser tasks (public task feed)
  app.get('/api/advertiser-tasks', authenticateTelegram, async (req: any, res) => {
    try {
      const tasks = await storage.getActiveTasks();
      res.json({ success: true, tasks });
    } catch (error) {
      console.error("Error fetching advertiser tasks:", error);
      res.status(500).json({ success: false, message: "Failed to fetch tasks" });
    }
  });

  // Get my created tasks
  app.get('/api/advertiser-tasks/my-tasks', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const myTasks = await storage.getMyTasks(userId);
      res.json({ success: true, tasks: myTasks });
    } catch (error) {
      console.error("Error fetching my tasks:", error);
      res.status(500).json({ success: false, message: "Failed to fetch your tasks" });
    }
  });

  // Create new advertiser task
  app.post('/api/advertiser-tasks/create', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskType, title, link, totalClicksRequired } = req.body;

      console.log('📝 Task creation request:', { userId, taskType, title, link, totalClicksRequired });

      // Validation
      if (!taskType || !title || !link || !totalClicksRequired) {
        return res.status(400).json({
          success: false,
          message: "Task type, title, link, and total clicks required are mandatory"
        });
      }

      // Validate task type
      if (taskType !== "channel" && taskType !== "bot") {
        return res.status(400).json({
          success: false,
          message: "Task type must be either 'channel' or 'bot'"
        });
      }

      // Minimum 500 clicks required
      if (totalClicksRequired < 500) {
        return res.status(400).json({
          success: false,
          message: "Minimum 500 clicks required"
        });
      }

      const costPerClick = "0.0003"; // 0.0003 TON per click (500 clicks = 0.15 TON)
      const totalCost = (parseFloat(costPerClick) * totalClicksRequired).toFixed(8);

      // Get user's TON balance
      const [user] = await db
        .select({ tonBalance: users.tonBalance })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const currentTonBalance = parseFloat(user.tonBalance || '0');
      const requiredAmount = parseFloat(totalCost);

      console.log('💰 Payment check:', { currentTonBalance, requiredAmount, sufficient: currentTonBalance >= requiredAmount });

      // Check if user has sufficient TON balance
      if (currentTonBalance < requiredAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient TON balance. Please convert PAD to TON before creating a task."
        });
      }

      // Deduct TON balance
      const newTonBalance = (currentTonBalance - requiredAmount).toFixed(8);
      await db
        .update(users)
        .set({ tonBalance: newTonBalance })
        .where(eq(users.id, userId));

      console.log('✅ Payment deducted:', { oldBalance: currentTonBalance, newBalance: newTonBalance, deducted: totalCost });

      // Create the task
      const task = await storage.createTask({
        advertiserId: userId,
        taskType,
        title,
        link,
        totalClicksRequired,
        costPerClick,
        totalCost,
      });

      console.log('✅ Task saved to database:', task);

      // Log transaction
      await storage.logTransaction({
        userId,
        amount: totalCost,
        type: "deduction",
        source: "task_creation",
        description: `Created ${taskType} task: ${title}`,
        metadata: { taskId: task.id, taskType, totalClicksRequired }
      });

      // Send payment success notification to task creator
      sendRealtimeUpdate(userId, {
        type: 'taskPaymentSuccess',
        message: `Payment successful! ${totalCost} TON deducted`,
        tonBalance: newTonBalance,
        task: {
          id: task.id,
          title: task.title,
          totalCost: task.totalCost
        }
      });

      // Broadcast task creation to all users to update feed
      broadcastUpdate({
        type: 'task:created',
        task: task
      });

      console.log('📡 WebSocket notifications sent for task creation');

      res.json({ 
        success: true, 
        message: "Task created successfully",
        task 
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create task" 
      });
    }
  });

  // Record task click (when publisher clicks on a task)
  app.post('/api/advertiser-tasks/:taskId/click', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskId } = req.params;

      const result = await storage.recordTaskClick(taskId, userId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error("Error recording task click:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to record task click" 
      });
    }
  });

  // Increase task click limit
  app.post('/api/advertiser-tasks/:taskId/increase-limit', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskId } = req.params;
      const { additionalClicks } = req.body;

      // Validation - minimum 500 additional clicks
      if (!additionalClicks || additionalClicks < 500) {
        return res.status(400).json({
          success: false,
          message: "Minimum 500 additional clicks required"
        });
      }

      // Verify task ownership
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found"
        });
      }

      if (task.advertiserId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You don't own this task"
        });
      }

      const costPerClick = "0.0003"; // 0.0003 TON per click
      const additionalCost = (parseFloat(costPerClick) * additionalClicks).toFixed(8);

      // Get user's TON balance
      const [user] = await db
        .select({ tonBalance: users.tonBalance })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const currentTonBalance = parseFloat(user.tonBalance || '0');
      const requiredAmount = parseFloat(additionalCost);

      // Check if user has sufficient TON balance
      if (currentTonBalance < requiredAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient TON balance. Please convert PAD to TON before adding more clicks."
        });
      }

      // Deduct TON balance
      const newTonBalance = (currentTonBalance - requiredAmount).toFixed(8);
      await db
        .update(users)
        .set({ tonBalance: newTonBalance })
        .where(eq(users.id, userId));

      // Increase task limit
      const updatedTask = await storage.increaseTaskLimit(taskId, additionalClicks, additionalCost);

      // Log transaction
      await storage.logTransaction({
        userId,
        amount: additionalCost,
        type: "deduction",
        source: "task_limit_increase",
        description: `Increased limit for task: ${task.title}`,
        metadata: { taskId, additionalClicks }
      });

      res.json({ 
        success: true, 
        message: "Task limit increased successfully",
        task: updatedTask 
      });
    } catch (error) {
      console.error("Error increasing task limit:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to increase task limit" 
      });
    }
  });

  // Check if user has clicked a task
  app.get('/api/advertiser-tasks/:taskId/has-clicked', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskId } = req.params;

      const hasClicked = await storage.hasUserClickedTask(taskId, userId);
      
      res.json({ success: true, hasClicked });
    } catch (error) {
      console.error("Error checking task click:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check task click status" 
      });
    }
  });

  // Delete advertiser task
  app.delete('/api/advertiser-tasks/:taskId', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { taskId } = req.params;

      console.log('🗑️ Delete task request:', { userId, taskId });

      // Get task details
      const [task] = await db
        .select()
        .from(advertiserTasks)
        .where(eq(advertiserTasks.id, taskId));

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found"
        });
      }

      // Verify ownership
      if (task.advertiserId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own tasks"
        });
      }

      // Calculate refund amount for remaining clicks
      const remainingClicks = task.totalClicksRequired - task.currentClicks;
      const refundAmount = (parseFloat(task.costPerClick) * remainingClicks).toFixed(8);

      console.log('💰 Refund calculation:', { 
        totalClicks: task.totalClicksRequired, 
        currentClicks: task.currentClicks, 
        remainingClicks,
        costPerClick: task.costPerClick,
        refundAmount 
      });

      // Delete task and refund user in a transaction
      await db.transaction(async (tx) => {
        // Delete the task
        await tx
          .delete(advertiserTasks)
          .where(eq(advertiserTasks.id, taskId));

        // Delete associated clicks
        await tx
          .delete(taskClicks)
          .where(eq(taskClicks.taskId, taskId));

        // Refund remaining balance if any
        if (parseFloat(refundAmount) > 0) {
          const [user] = await tx
            .select({ tonBalance: users.tonBalance })
            .from(users)
            .where(eq(users.id, userId));

          if (user) {
            const newBalance = (parseFloat(user.tonBalance || '0') + parseFloat(refundAmount)).toFixed(8);
            await tx
              .update(users)
              .set({ tonBalance: newBalance })
              .where(eq(users.id, userId));

            console.log('✅ Refund processed:', { oldBalance: user.tonBalance, refundAmount, newBalance });

            // Log transaction
            await storage.logTransaction({
              userId,
              amount: refundAmount,
              type: "credit",
              source: "task_deletion_refund",
              description: `Refund for deleting task: ${task.title}`,
              metadata: { taskId, remainingClicks }
            });
          }
        }
      });

      console.log('✅ Task deleted successfully:', taskId);

      res.json({ 
        success: true, 
        message: "Task deleted successfully",
        refundAmount 
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to delete task" 
      });
    }
  });

  // Verify channel for bot admin
  app.post('/api/advertiser-tasks/verify-channel', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { channelLink } = req.body;

      console.log('🔍 Channel verification request:', { userId, channelLink });

      // Validate channel link
      if (!channelLink || !channelLink.includes('t.me/')) {
        return res.status(400).json({
          success: false,
          message: "Invalid channel link"
        });
      }

      // Extract channel username
      const match = channelLink.match(/t\.me\/([^/?]+)/);
      if (!match || !match[1]) {
        return res.status(400).json({
          success: false,
          message: "Could not extract channel username from link"
        });
      }

      const channelUsername = match[1];

      // Check if bot token is configured
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured - skipping actual verification');
        return res.json({
          success: true,
          message: "Channel verification successful (dev mode)",
          verified: true
        });
      }

      try {
        // Try to get chat administrators
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/getChatAdministrators`;
        const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
        
        const response = await fetch(`${telegramApiUrl}?chat_id=${encodeURIComponent(chatId)}`);
        const data = await response.json();

        if (!data.ok) {
          console.error('❌ Telegram API error:', data);
          return res.status(400).json({
            success: false,
            message: "Could not access channel. Make sure the bot is added as admin."
          });
        }

        // Check if our bot is in the admin list
        const botUsername = 'Paid_Adzbot';
        const isAdmin = data.result.some((admin: any) => 
          admin.user?.username?.toLowerCase() === botUsername.toLowerCase()
        );

        if (!isAdmin) {
          return res.status(400).json({
            success: false,
            message: `@${botUsername} is not an administrator in this channel. Please add the bot as admin first.`
          });
        }

        console.log('✅ Channel verified:', channelUsername);

        res.json({ 
          success: true, 
          message: "Channel verified successfully",
          verified: true 
        });
      } catch (error) {
        console.error('❌ Error verifying channel:', error);
        res.status(500).json({ 
          success: false, 
          message: "Failed to verify channel" 
        });
      }
    } catch (error) {
      console.error("Error in channel verification:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to verify channel" 
      });
    }
  });
  
  // User withdrawal endpoints
  
  // Get user's withdrawal history - auth removed to prevent popup spam
  app.get('/api/withdrawals', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Withdrawal history requested without session - sending empty");
        return res.json({ success: true, skipAuth: true, withdrawals: [] });
      }
      
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
      
      res.json({ 
        success: true,
        withdrawals: userWithdrawals 
      });
      
    } catch (error) {
      console.error('❌ Error fetching user withdrawals:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch withdrawals' 
      });
    }
  });

  // Create new withdrawal request - auth removed to prevent popup spam
  app.post('/api/withdrawals', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Withdrawal requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      
      // NEW: Automatically withdraw ALL TON balance (ignore amount parameter)
      const { walletAddress, comment } = req.body;

      console.log('📝 Withdrawal request received (withdrawing all TON balance):', { userId, walletAddress, comment });

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

      // Use transaction to ensure atomicity and prevent race conditions
      const newWithdrawal = await db.transaction(async (tx) => {
        // Lock user row and get TON balance, wallet ID, friendsInvited, telegram_id, and device info (SELECT FOR UPDATE)
        const [user] = await tx
          .select({ 
            tonBalance: users.tonBalance,
            cwalletId: users.cwalletId,
            friendsInvited: users.friendsInvited,
            telegram_id: users.telegram_id,
            username: users.username,
            banned: users.banned,
            bannedReason: users.bannedReason,
            deviceId: users.deviceId
          })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        
        if (!user) {
          throw new Error('User not found');
        }

        // CRITICAL: Check if user is banned - prevent banned accounts from withdrawing
        if (user.banned) {
          throw new Error(`Account is banned: ${user.bannedReason || 'Multi-account violation'}`);
        }

        // CRITICAL: Check for duplicate accounts on same device trying to withdraw
        if (user.deviceId) {
          const duplicateAccounts = await tx
            .select({ id: users.id, banned: users.banned, isPrimaryAccount: users.isPrimaryAccount })
            .from(users)
            .where(and(
              eq(users.deviceId, user.deviceId),
              sql`${users.id} != ${userId}`
            ));

          if (duplicateAccounts.length > 0) {
            // Determine if current user is the primary account
            const [currentUserFull] = await tx
              .select({ isPrimaryAccount: users.isPrimaryAccount })
              .from(users)
              .where(eq(users.id, userId));
            
            const isPrimary = currentUserFull?.isPrimaryAccount === true;
            
            if (!isPrimary) {
              // Ban this duplicate account only
              const { banUserForMultipleAccounts, sendWarningToMainAccount } = await import('./deviceTracking');
              await banUserForMultipleAccounts(
                userId,
                'Duplicate account attempted withdrawal - only one account per device is allowed'
              );
              
              // Send warning to primary account
              const primaryAccount = duplicateAccounts.find(u => u.isPrimaryAccount === true) || duplicateAccounts[0];
              if (primaryAccount) {
                await sendWarningToMainAccount(primaryAccount.id);
              }
              
              throw new Error('Withdrawal blocked - multiple accounts detected on this device. This account has been banned.');
            }
          }
        }

        // ✅ NEW: Check if user has invited at least 3 friends
        const friendsInvited = user.friendsInvited || 0;
        if (friendsInvited < 3) {
          throw new Error('You need to invite at least 3 friends to unlock withdrawals.');
        }

        // Check if user has a saved wallet ID
        if (!user.cwalletId) {
          throw new Error('No wallet ID found. Please set up your Cwallet ID first.');
        }

        // ✅ NEW: Check wallet ID uniqueness - prevent same wallet from being used by multiple users
        const [existingWallet] = await tx
          .select({ userId: users.id })
          .from(users)
          .where(and(
            eq(users.cwalletId, user.cwalletId),
            sql`${users.id} != ${userId}`
          ))
          .limit(1);

        if (existingWallet) {
          throw new Error('This wallet ID is already in use by another user. Please use a unique wallet ID.');
        }

        const currentTonBalance = parseFloat(user.tonBalance || '0');
        
        // Minimum withdrawal: 0.001 TON (updated from 0.01)
        const MINIMUM_WITHDRAWAL = 0.001;
        if (currentTonBalance < MINIMUM_WITHDRAWAL) {
          throw new Error('You need at least 0.001 TON');
        }

        // ✅ CHANGED: Do NOT deduct balance immediately - wait for admin approval
        // Balance will be deducted when admin approves the withdrawal

        console.log(`📝 Creating withdrawal request for ${currentTonBalance} TON (balance NOT deducted yet)`);

        // Create withdrawal request with deducted flag set to FALSE
        // ✅ FIX: Automatically attach saved wallet ID from database using correct field name
        const withdrawalData: any = {
          userId,
          amount: currentTonBalance.toFixed(8),
          method: 'cwallet',
          status: 'pending',
          deducted: false, // ✅ CHANGED: Balance will be deducted on admin approval
          refunded: false,
          details: {
            paymentDetails: user.cwalletId, // ✅ Use paymentDetails field for admin dashboard
            cwalletId: user.cwalletId, // Keep for backward compatibility
            walletAddress: user.cwalletId // For backward compatibility
          }
        };

        const [withdrawal] = await tx.insert(withdrawals).values(withdrawalData).returning();
        
        return { 
          withdrawal, 
          withdrawnAmount: currentTonBalance, 
          userTelegramId: user.telegram_id,
          username: user.username 
        };
      });

      console.log(`✅ Withdrawal request created: ${newWithdrawal.withdrawal.id} for user ${userId}, amount: ${newWithdrawal.withdrawnAmount} TON`);

      // ✅ Send withdrawal_requested notification via WebSocket
      sendRealtimeUpdate(userId, {
        type: 'withdrawal_requested',
        amount: newWithdrawal.withdrawnAmount.toFixed(8),
        message: 'You have sent a withdrawal request.'
      });

      // ✅ NEW: Send withdrawal notification to admin via Telegram bot with inline buttons
      const adminMessage = `
💸 <b>New Withdrawal Request</b>

• <b>User:</b> @${newWithdrawal.username || 'Unknown'} (${userId.substring(0, 8)})
• <b>Amount:</b> ${newWithdrawal.withdrawnAmount.toFixed(4)} TON
• <b>Wallet:</b> ${newWithdrawal.withdrawal.details?.paymentDetails || 'N/A'}
• <b>Time:</b> ${new Date().toUTCString()}
      `.trim();

      // Create inline keyboard with Approve and Reject buttons
      const inlineKeyboard = {
        inline_keyboard: [[
          { text: "🔘 Approve", callback_data: `withdraw_paid_${newWithdrawal.withdrawal.id}` },
          { text: "❌ Reject", callback_data: `withdraw_reject_${newWithdrawal.withdrawal.id}` }
        ]]
      };

      // Send message with inline buttons
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_ID) {
        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_ADMIN_ID,
            text: adminMessage,
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard
          })
        }).catch(err => {
          console.error('❌ Failed to send admin notification:', err);
        });
      }

      // ✅ NEW: Send confirmation message to user via Telegram bot
      if (newWithdrawal.userTelegramId) {
        const userMessage = "✅ You have sent a withdrawal request and it will be processed within an hour.";
        sendUserTelegramNotification(newWithdrawal.userTelegramId, userMessage).catch(err => {
          console.error('❌ Failed to send user notification:', err);
        });
      }

      res.json({
        success: true,
        message: 'You have sent a withdrawal request',
        withdrawal: {
          id: newWithdrawal.withdrawal.id,
          amount: newWithdrawal.withdrawal.amount,
          status: newWithdrawal.withdrawal.status,
          method: newWithdrawal.withdrawal.method,
          createdAt: newWithdrawal.withdrawal.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Error creating withdrawal request:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create withdrawal request';
      
      // Return 400 for validation errors, 500 for others
      if (errorMessage === 'Insufficient TON balance' || 
          errorMessage === 'User not found' ||
          errorMessage === 'No wallet ID found. Please set up your Cwallet ID first.' ||
          errorMessage === 'You need to invite at least 3 friends to unlock withdrawals.' ||
          errorMessage === 'This wallet ID is already in use by another user. Please use a unique wallet ID.' ||
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

  // Alternative withdrawal endpoint for compatibility - /api/withdraw
  app.post('/api/withdraw', async (req: any, res) => {
    try {
      // Get userId from session or req.user (lenient check)
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        console.log("⚠️ Withdrawal (/api/withdraw) requested without session - skipping");
        return res.json({ success: true, skipAuth: true });
      }
      
      const { walletAddress, comment } = req.body;

      console.log('📝 Withdrawal via /api/withdraw (withdrawing all TON balance):', { userId });

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

      // Use transaction for atomicity
      const result = await db.transaction(async (tx) => {
        // Lock user row and get TON balance, ban status, and device info
        const [user] = await tx
          .select({ 
            tonBalance: users.tonBalance,
            banned: users.banned,
            bannedReason: users.bannedReason,
            deviceId: users.deviceId
          })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        
        if (!user) {
          throw new Error('User not found');
        }

        // CRITICAL: Check if user is banned
        if (user.banned) {
          throw new Error(`Account is banned: ${user.bannedReason || 'Multi-account violation'}`);
        }

        // CRITICAL: Check for duplicate accounts on same device
        if (user.deviceId) {
          const duplicateAccounts = await tx
            .select({ id: users.id, isPrimaryAccount: users.isPrimaryAccount })
            .from(users)
            .where(and(
              eq(users.deviceId, user.deviceId),
              sql`${users.id} != ${userId}`
            ));

          if (duplicateAccounts.length > 0) {
            // Determine if current user is the primary account
            const [currentUserFull] = await tx
              .select({ isPrimaryAccount: users.isPrimaryAccount })
              .from(users)
              .where(eq(users.id, userId));
            
            const isPrimary = currentUserFull?.isPrimaryAccount === true;
            
            if (!isPrimary) {
              // Ban this duplicate account only
              const { banUserForMultipleAccounts, sendWarningToMainAccount } = await import('./deviceTracking');
              await banUserForMultipleAccounts(
                userId,
                'Duplicate account attempted withdrawal - only one account per device is allowed'
              );
              
              // Send warning to primary account
              const primaryAccount = duplicateAccounts.find(u => u.isPrimaryAccount === true) || duplicateAccounts[0];
              if (primaryAccount) {
                await sendWarningToMainAccount(primaryAccount.id);
              }
              
              throw new Error('Withdrawal blocked - multiple accounts detected on this device. This account has been banned.');
            }
          }
        }

        const currentTonBalance = parseFloat(user.tonBalance || '0');
        
        if (currentTonBalance < 0.001) {
          throw new Error('You need at least 0.001 TON');
        }

        // Deduct balance instantly
        await tx
          .update(users)
          .set({ tonBalance: '0', updatedAt: new Date() })
          .where(eq(users.id, userId));

        // Create withdrawal with deducted flag
        const [withdrawal] = await tx.insert(withdrawals).values({
          userId,
          amount: currentTonBalance.toFixed(8),
          method: 'ton_coin',
          status: 'pending',
          deducted: true,
          refunded: false,
          details: { walletAddress: walletAddress || '', comment: comment || '' }
        }).returning();
        
        return { withdrawal, withdrawnAmount: currentTonBalance };
      });

      console.log(`✅ Withdrawal via /api/withdraw: ${result.withdrawnAmount} TON`);

      // Send real-time update
      sendRealtimeUpdate(userId, {
        type: 'balance_update',
        tonBalance: '0'
      });

      res.json({
        success: true,
        message: 'You have sent a withdrawal request'
      });

    } catch (error) {
      console.error('❌ Error in /api/withdraw:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process withdrawal';
      res.status(500).json({ success: false, message: errorMessage });
    }
  });

  // Alternative withdrawal history endpoint - /api/withdraw/history
  app.get('/api/withdraw/history', async (req: any, res) => {
    try {
      const userId = req.session?.user?.user?.id || req.user?.user?.id;
      
      if (!userId) {
        return res.json({ success: true, skipAuth: true, history: [] });
      }
      
      const history = await db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.userId, userId))
        .orderBy(desc(withdrawals.createdAt));
      
      res.json({ 
        success: true, 
        history 
      });
      
    } catch (error) {
      console.error('❌ Error fetching withdrawal history:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch history' });
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
          rejectionReason: withdrawals.rejectionReason,
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
          rejectionReason: withdrawals.rejectionReason,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            telegram_id: users.telegram_id
          }
        })
        .from(withdrawals)
        .leftJoin(users, eq(withdrawals.userId, users.id))
        .where(sql`${withdrawals.status} IN ('paid', 'success', 'rejected', 'Successfull', 'Approved')`)
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
      const { adminNotes } = req.body;
      
      // Approve the withdrawal using existing storage method (no transaction hash required)
      const result = await storage.approveWithdrawal(withdrawalId, adminNotes, 'N/A');
      
      if (result.success) {
        console.log(`✅ Withdrawal ${withdrawalId} approved by admin ${req.user.telegramUser.id}`);
        
        // Send real-time update to user (no Telegram notification)
        if (result.withdrawal) {
          sendRealtimeUpdate(result.withdrawal.userId, {
            type: 'withdrawal_approved',
            amount: result.withdrawal.amount,
            method: result.withdrawal.method,
            message: `Your withdrawal of ${result.withdrawal.amount} TON has been approved and processed`
          });
          
          // Broadcast to all admins for instant UI update
          broadcastUpdate({
            type: 'withdrawal_approved',
            withdrawalId: result.withdrawal.id,
            amount: result.withdrawal.amount,
            userId: result.withdrawal.userId
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
        
        // Send real-time update to user (no Telegram notification)
        if (result.withdrawal) {
          sendRealtimeUpdate(result.withdrawal.userId, {
            type: 'withdrawal_rejected',
            amount: result.withdrawal.amount,
            method: result.withdrawal.method,
            message: `Your withdrawal of ${result.withdrawal.amount} TON has been rejected`
          });
          
          // Broadcast to all admins for instant UI update
          broadcastUpdate({
            type: 'withdrawal_rejected',
            withdrawalId: result.withdrawal.id,
            amount: result.withdrawal.amount,
            userId: result.withdrawal.userId
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
      
      const result = await storage.claimPromotionReward(userId, promotionId);
      
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

  // Promo code endpoints
  // Redeem promo code
  app.post('/api/promo-codes/redeem', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { code } = req.body;
      
      if (!code || !code.trim()) {
        return res.status(400).json({ message: 'Promo code is required' });
      }
      
      const result = await storage.usePromoCode(code.trim().toUpperCase(), userId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `${result.reward} TON added to your balance!`,
          reward: result.reward
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error) {
      console.error("Error redeeming promo code:", error);
      res.status(500).json({ message: "Failed to redeem promo code" });
    }
  });

  // Create promo code (admin only)
  app.post('/api/promo-codes/create', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const user = await storage.getUser(userId);
      
      // Check if user is admin
      const isAdmin = user?.telegram_id === "6653616672" || (user?.telegram_id === "123456789" && process.env.NODE_ENV === 'development');
      if (!isAdmin) {
        return res.status(403).json({ message: 'Unauthorized: Admin access required' });
      }
      
      const { code, rewardAmount, usageLimit, perUserLimit, expiresAt } = req.body;
      
      if (!code || !rewardAmount) {
        return res.status(400).json({ message: 'Code and reward amount are required' });
      }
      
      const promoCode = await storage.createPromoCode({
        code: code.toUpperCase(),
        rewardAmount: rewardAmount.toString(),
        rewardCurrency: 'TON',
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || 1,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
      
      res.json({ 
        success: true, 
        message: 'Promo code created successfully',
        promoCode 
      });
    } catch (error) {
      console.error("Error creating promo code:", error);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });

  // Get all promo codes (admin only)
  app.get('/api/admin/promo-codes', authenticateAdmin, async (req: any, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      
      // Calculate stats for each promo code
      const promoCodesWithStats = promoCodes.map(promo => {
        const usageCount = promo.usageCount || 0;
        const usageLimit = promo.usageLimit || 0;
        const remainingCount = usageLimit > 0 ? Math.max(0, usageLimit - usageCount) : Infinity;
        const totalDistributed = parseFloat(promo.rewardAmount) * usageCount;
        
        return {
          ...promo,
          usageCount,
          remainingCount: remainingCount === Infinity ? 'Unlimited' : remainingCount,
          totalDistributed: totalDistributed.toFixed(8)
        };
      });
      
      res.json({ 
        success: true, 
        promoCodes: promoCodesWithStats 
      });
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  return httpServer;
}
