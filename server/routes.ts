import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEarningSchema, insertWithdrawalSchema, withdrawals, users, earnings, referrals } from "@shared/schema";
import { db } from "./db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import crypto from "crypto";
import { sendTelegramMessage, formatWithdrawalNotification, sendUserTelegramNotification, formatUserNotification, sendWelcomeMessage, handleTelegramMessage, setupTelegramWebhook } from "./telegram";

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

// Telegram Web App authentication middleware
const authenticateTelegram = async (req: any, res: any, next: any) => {
  try {
    // Get Telegram Web App data from headers or query params
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
    // Development mode fallback - create a test user when no Telegram data available
    if (!telegramData) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Using test user authentication');
        const testUser = {
          id: '123456789',
          username: 'testuser',
          first_name: 'Test',
          last_name: 'User'
        };
        
        // Ensure test user exists in database
        const { user: upsertedUser, isNewUser } = await storage.upsertUser({
          id: testUser.id.toString(),
          email: `${testUser.username}@telegram.user`,
          firstName: testUser.first_name,
          lastName: testUser.last_name,
          username: testUser.username,
          personalCode: testUser.username || testUser.id.toString(),
          withdrawBalance: '0',
          totalEarnings: '0',
          adsWatched: 0,
          dailyAdsWatched: 0,
          dailyEarnings: '0',
          level: 1,
          flagged: false,
          banned: false,
        });
        
        req.user = { telegramUser: testUser };
        return next();
      }
      
      return res.status(401).json({ message: "Telegram authentication required. Please access this app through Telegram." });
    }

    try {
      // Parse Telegram Web App data
      const urlParams = new URLSearchParams(telegramData);
      const userString = urlParams.get('user');
      
      if (!userString) {
        return res.status(401).json({ message: "Invalid Telegram data" });
      }

      const telegramUser = JSON.parse(userString);
      
      // Ensure user exists in database
      const { user: upsertedUser, isNewUser } = await storage.upsertUser({
        id: telegramUser.id.toString(),
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
      });
      
      // Send welcome message to new users
      if (isNewUser) {
        await sendWelcomeMessage(telegramUser.id.toString());
      }
      
      req.user = { telegramUser };
      next();
    } catch (parseError) {
      console.error("Failed to parse Telegram data:", parseError);
      return res.status(401).json({ message: "Invalid Telegram data format" });
    }
  } catch (error) {
    console.error("Telegram auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Registering API routes...');
  
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

  // Database initialization endpoint for free tier users
  app.get('/api/init-database', async (req: any, res) => {
    try {
      console.log('🔧 Initializing database tables...');
      
      // Import database dependencies
      const { pool } = await import('./db');
      
      // Create tables manually using raw SQL if they don't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY,
          email VARCHAR NOT NULL UNIQUE,
          first_name VARCHAR NOT NULL,
          last_name VARCHAR NOT NULL,
          profile_image_url VARCHAR,
          balance DECIMAL(10,8) DEFAULT 0,
          total_earned DECIMAL(10,8) DEFAULT 0,
          ads_watched_today INTEGER DEFAULT 0,
          last_ad_date DATE,
          streak_count INTEGER DEFAULT 0,
          last_streak_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS earnings (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,8) NOT NULL,
          source VARCHAR NOT NULL,
          description VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS withdrawals (
          id VARCHAR PRIMARY KEY,
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,8) NOT NULL,
          wallet_address VARCHAR NOT NULL,
          status VARCHAR DEFAULT 'pending',
          transaction_hash VARCHAR,
          admin_notes VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          referrer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          referred_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(referrer_id, referred_id)
        );
      `);
      
      console.log('✅ Database tables initialized successfully');
      res.json({ 
        success: true, 
        message: 'Database tables created successfully!',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      res.status(500).json({ 
        success: false, 
        error: (error as Error).message,
        message: 'Failed to initialize database' 
      });
    }
  });
  
  // Telegram Bot Webhook endpoint - MUST be first to avoid Vite catch-all interference

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
      
      // Check if user exists in database, create if not
      const { user: upsertedUser, isNewUser } = await storage.upsertUser({
        id: telegramUser.id.toString(),
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

  // Auth routes
  app.get('/api/auth/user', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Ad watching endpoint
  app.post('/api/ads/watch', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { adType } = req.body;
      
      // Add earning for watched ad
      const earning = await storage.addEarning({
        userId,
        amount: "0.00021",
        source: 'ad_watch',
        description: 'Watched advertisement',
      });
      
      // Increment ads watched count
      await storage.incrementAdsWatched(userId);
      
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
      const userId = req.user.telegramUser.id.toString();
      
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
      const userId = req.user.telegramUser.id.toString();
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
      const userId = req.user.telegramUser.id.toString();
      const limit = parseInt(req.query.limit as string) || 20;
      const earnings = await storage.getUserEarnings(userId, limit);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  // Withdrawal request endpoint
  app.post('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawalData = insertWithdrawalSchema.parse({
        ...req.body,
        userId,
      });
      
      // Check if user has sufficient balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.balance || "0") < parseFloat(withdrawalData.amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      const withdrawal = await storage.createWithdrawal(withdrawalData);
      
      // Send Telegram notification to admin
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || `User ${userId}`;
      
      const notificationMessage = formatWithdrawalNotification(
        userId,
        withdrawalData.amount,
        withdrawalData.method,
        withdrawalData.details,
        userName
      );
      
      // Send notification (don't wait for it to complete)
      if (notificationMessage) {
        sendTelegramMessage(notificationMessage).catch(error => {
          console.error('Failed to send withdrawal notification:', error);
        });
      }
      
      res.json({ 
        success: true, 
        withdrawal,
        message: 'Withdrawal request created successfully' 
      });
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  // Get user withdrawals
  app.get('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawals = await storage.getUserWithdrawals(userId);
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Referral endpoints
  app.get('/api/referrals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const referrals = await storage.getUserReferrals(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Generate referral code
  app.post('/api/referrals/generate', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const code = await storage.generateReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Process referral signup
  app.post('/api/referrals/process', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code required" });
      }
      
      // Find referrer by referral code (not user ID)
      const referrer = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
      if (!referrer[0]) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      
      // Create referral relationship
      const referral = await storage.createReferral(referrer[0].id, userId);
      
      res.json({ 
        success: true, 
        referral,
        message: 'Referral processed successfully' 
      });
    } catch (error) {
      console.error("Error processing referral:", error);
      res.status(500).json({ message: "Failed to process referral" });
    }
  });

  // Referral stats endpoint for dashboard/referral page
  app.get('/api/referrals/info', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const user = await db
        .select({
          referralCode: users.referralCode,
          totalReferrals: users.totalReferrals,
          referralEarnings: users.referralEarnings
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const referredUsers = await db
        .select({ id: users.id, firstName: users.firstName, username: users.username, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.referredBy, userId))
        .orderBy(desc(users.createdAt));

      const botUsername = process.env.TELEGRAM_BOT_USERNAME || "YourBotName";
      const referralLink = `https://t.me/${botUsername}?start=${user[0]?.referralCode}`;

      res.json({
        referralCode: user[0]?.referralCode,
        referralLink,
        totalReferrals: user[0]?.totalReferrals,
        referralEarnings: user[0]?.referralEarnings,
        referredUsers,
      });
    } catch (error) {
      console.error("Error fetching referral info:", error);
      res.status(500).json({ message: "Failed to fetch referral info" });
    }
  });

  // Admin endpoint to see all referrals
  app.get('/api/admin/referrals', authenticateAdmin, async (req: any, res) => {
    try {
      const referralList = await db
        .select({
          referrerId: users.referredBy,
          invitedUserId: users.id,
          invitedUsername: users.username,
          joined: users.createdAt
        })
        .from(users)
        .where(sql`${users.referredBy} IS NOT NULL`)
        .orderBy(desc(users.createdAt));
      res.json({referrals: referralList});
    } catch (error) {
      console.error("Error fetching admin referrals:", error);
      res.status(500).json({ message: "Failed to fetch admin referrals" });
    }
  });

  // Admin routes
  app.get('/api/admin/withdrawals', authenticateAdmin, async (req: any, res) => {
    try {
      // Get all withdrawals for admin panel, not just pending
      const withdrawals = await storage.getAllWithdrawals();
      
      // Get user details for each withdrawal
      const withdrawalsWithUsers = await Promise.all(
        withdrawals.map(async (withdrawal) => {
          const user = await storage.getUser(withdrawal.userId);
          return {
            ...withdrawal,
            user: user ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            } : null
          };
        })
      );
      
      res.json(withdrawalsWithUsers);
    } catch (error) {
      console.error("Error fetching admin withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post('/api/admin/withdrawals/:id/update', authenticateAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, transactionHash, adminNotes } = req.body;
      
      if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Get withdrawal and user info before updating
      const withdrawal = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
      if (!withdrawal[0]) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      
      const user = await storage.getUser(withdrawal[0].userId);
      
      // Update withdrawal status
      const updatedWithdrawal = await storage.updateWithdrawalStatus(
        id, 
        status, 
        transactionHash, 
        adminNotes
      );
      
      // Send notification to user if status changed to completed or failed
      if ((status === 'completed' || status === 'failed') && user) {
        const userNotification = formatUserNotification(
          withdrawal[0].amount,
          withdrawal[0].method,
          status,
          transactionHash
        );
        
        sendUserTelegramNotification(withdrawal[0].userId, userNotification).catch(error => {
          console.error('Failed to send user notification:', error);
        });
      }
      
      res.json({ 
        success: true, 
        withdrawal: updatedWithdrawal,
        message: 'Withdrawal status updated successfully' 
      });
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });



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
        error: (error as Error).message,
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
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      // Total users
      const totalUsers = (await db.select({ c: sql`count(*)` }).from(users))[0].c;
      // Users joined today
      const todayUsers = (await db.select({ c: sql`count(*)` })
        .from(users)
        .where(gte(users.createdAt, todayStart)))[0].c;

      // Total successful referrals
      const totalReferrals = (await db.select({ c: sql`count(*)` })
        .from(users)
        .where(sql`${users.referredBy} IS NOT NULL`))[0].c;

      // Referrals registered today
      const todayReferrals = (await db.select({ c: sql`count(*)` })
        .from(users)
        .where(and(sql`${users.referredBy} IS NOT NULL`, gte(users.createdAt, todayStart))))[0].c;

      // Total earnings sum
      const totalEarnings = (await db.select({ total: sql`sum(amount)` }).from(earnings))[0].total;

      // Today's earnings sum
      const todayEarnings = (await db.select({ total: sql`sum(amount)` })
        .from(earnings)
        .where(gte(earnings.createdAt, todayStart)))[0].total;

      // Total withdrawals sum
      const totalWithdrawals = (await db.select({ total: sql`sum(amount)` }).from(withdrawals))[0].total;

      // Pending withdrawals count and sum
      const pending = (await db.select({
          count: sql`count(*)`,
          amount: sql`sum(amount)`
        })
        .from(withdrawals)
        .where(eq(withdrawals.status, 'pending')))[0];

      res.json({
        users: { total: totalUsers, today: todayUsers },
        referrals: { total: totalReferrals, today: todayReferrals },
        earnings: { total: totalEarnings, today: todayEarnings },
        withdrawals: {
          total: totalWithdrawals,
          pending: { count: pending.count, amount: pending.amount }
        }
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin users endpoint with referral info
  app.get('/api/admin/users', authenticateAdmin, async (req: any, res) => {
    try {
      const usersList = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email,
          totalEarned: users.totalEarned,
          balance: users.balance,
          totalReferrals: users.totalReferrals,
          referralEarnings: users.referralEarnings,
          referralCode: users.referralCode,
          referredBy: users.referredBy,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(100); // paginate if needed

      res.json({users: usersList});
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

  // Promo code management endpoints
  app.post('/api/admin/promo-codes', authenticateAdmin, async (req: any, res) => {
    try {
      const { code, rewardAmount, rewardCurrency, usageLimit, perUserLimit, expiresAt } = req.body;
      
      if (!code || !rewardAmount) {
        return res.status(400).json({ message: "Code and reward amount are required" });
      }

      // Check if code already exists
      const existingCode = await storage.getPromoCode(code);
      if (existingCode) {
        return res.status(400).json({ message: "Promo code already exists" });
      }

      const promoCode = await storage.createPromoCode({
        code: code.toUpperCase(),
        rewardAmount,
        rewardCurrency: rewardCurrency || 'USDT',
        usageLimit,
        perUserLimit: perUserLimit || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.json({
        success: true,
        promoCode,
        message: 'Promo code created successfully'
      });
    } catch (error) {
      console.error("Error creating promo code:", error);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });

  app.get('/api/admin/promo-codes', authenticateAdmin, async (req: any, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  app.post('/api/admin/promo-codes/:id/toggle', authenticateAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const promoCode = await storage.updatePromoCodeStatus(id, isActive);
      
      res.json({
        success: true,
        promoCode,
        message: `Promo code ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error("Error updating promo code status:", error);
      res.status(500).json({ message: "Failed to update promo code status" });
    }
  });

  // User promo code redemption endpoint
  app.post('/api/promo-codes/redeem', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Promo code is required" });
      }

      const result = await storage.usePromoCode(code.toUpperCase(), userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
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
        
        // Generate referral codes for existing users
        await storage.ensureAllUsersHaveReferralCodes();
        
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

  // Get bot info endpoint
  app.get('/api/telegram/bot-info', (req, res) => {
    res.json({ 
      username: process.env.TELEGRAM_BOT_USERNAME || 'LightningSatsbot'
    });
  });

  // Debug endpoint for manual referral testing
  app.post('/api/debug/test-referral', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { referrerId } = req.body;
      
      console.log(`🧪 DEBUG: Testing referral creation for user ${userId} with referrer ID ${referrerId}`);
      
      if (!referrerId) {
        return res.status(400).json({ error: "Referrer ID required" });
      }
      
      // Find referrer by user ID directly
      const referrer = await storage.getUser(referrerId);
      if (!referrer) {
        console.log(`🧪 DEBUG: No referrer found with ID ${referrerId}`);
        return res.status(404).json({ error: "Invalid referrer ID", referrerId });
      }
      
      console.log(`🧪 DEBUG: Found referrer: ${referrer.id} (${referrer.firstName || 'No name'})`);
      
      // Check if referral already exists
      const existingReferral = await db
        .select()
        .from(referrals)
        .where(and(
          eq(referrals.referrerId, referrer.id),
          eq(referrals.referredId, userId)
        ))
        .limit(1);
      
      if (existingReferral.length > 0) {
        console.log(`🧪 DEBUG: Referral already exists between ${referrer.id} -> ${userId}`);
        return res.json({ 
          success: false, 
          message: 'Referral already exists',
          existingReferral: existingReferral[0]
        });
      }
      
      // Create referral
      const referral = await storage.createReferral(referrer.id, userId);
      console.log(`🧪 DEBUG: Successfully created referral:`, referral);
      
      res.json({ 
        success: true, 
        referral,
        referrer: { id: referrer.id, name: referrer.firstName },
        message: `Referral created! ${referrer.firstName || referrer.id} will now get 10% of your ad earnings.`
      });
    } catch (error) {
      console.error("🧪 DEBUG: Error testing referral:", error);
      res.status(500).json({ 
        error: "Failed to test referral",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
