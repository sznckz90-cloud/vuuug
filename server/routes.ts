import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEarningSchema, insertWithdrawalSchema, withdrawals } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { sendTelegramMessage, formatWithdrawalNotification, sendUserTelegramNotification, formatUserNotification, sendWelcomeMessage, handleTelegramMessage, setupTelegramWebhook } from "./telegram";
import { migrateMissingColumns } from "./migrate";

// Check if user is admin
const isAdmin = (telegramId: string): boolean => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  return adminId === telegramId;
};

// Admin authentication middleware
const authenticateAdmin = async (req: any, res: any, next: any) => {
  try {
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
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
    
    if (!telegramData) {
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
        error: error.message,
        message: 'Failed to initialize database' 
      });
    }
  });
  
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
      
      // Find referrer by code
      const referrer = await storage.getUser(referralCode);
      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      
      // Create referral relationship
      const referral = await storage.createReferral(referrer.id, userId);
      
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

  // Admin routes
  app.get('/api/admin/withdrawals', authenticateAdmin, async (req: any, res) => {
    try {
      const withdrawals = await storage.getAllPendingWithdrawals();
      
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
        error: error.message,
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

  const httpServer = createServer(app);
  return httpServer;
}
