// Modern Telegram WebApp Authentication System
// Replaces legacy Replit OAuth with clean Telegram-only auth

import express, { type RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Verify Telegram WebApp data integrity
export function verifyTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; user?: any } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return { isValid: false };
    }
    
    // Remove hash from params and sort alphabetically
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Create HMAC secret key
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Generate HMAC hash
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    const isValid = calculatedHash === hash;
    
    if (!isValid) {
      console.log('❌ Telegram data verification failed - invalid hash');
      return { isValid: false };
    }
    
    // Parse user data
    const userString = urlParams.get('user');
    if (!userString) {
      return { isValid: false };
    }
    
    const user = JSON.parse(userString);
    console.log('✅ Telegram data verified successfully for user:', user.id);
    
    return { isValid: true, user };
  } catch (error) {
    console.error('❌ Error verifying Telegram data:', error);
    return { isValid: false };
  }
}

// Modern Telegram authentication middleware
export const authenticateTelegram: RequestHandler = async (req: any, res, next) => {
  try {
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
    // Development mode - allow test users (only in development, not production)
    if (!telegramData && (process.env.NODE_ENV === 'development' || process.env.REPL_ID)) {
      console.log('🔧 Development mode: Using test user authentication');
      
      const testUser = {
        id: '123456789',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };
      
      const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      const { user: upsertedUser } = await storage.upsertUser({
        id: testUserId,
        email: `${testUser.username}@telegram.user`,
        firstName: testUser.first_name,
        lastName: testUser.last_name,
        username: testUser.username,
        telegramId: testUser.id.toString(),
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
      
      // Ensure test user has referral code
      if (!upsertedUser.referralCode) {
        await storage.generateReferralCode(upsertedUser.id);
      }
      
      req.user = { 
        telegramUser: { ...testUser, id: testUserId },
        user: upsertedUser
      };
      return next();
    }
    
    if (!telegramData) {
      return res.status(401).json({ 
        message: "Telegram authentication required. Please access this app through Telegram WebApp.",
        telegram_required: true 
      });
    }
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ message: "Authentication service unavailable" });
    }
    
    // Verify Telegram data integrity
    const { isValid, user: telegramUser } = verifyTelegramWebAppData(telegramData, botToken);
    
    if (!isValid || !telegramUser) {
      return res.status(401).json({ message: "Invalid Telegram authentication data" });
    }
    
    // Get or create user in database using Telegram-specific method
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
    });
    
    // Send welcome message for new users with referral code
    if (isNewUser) {
      try {
        const { sendWelcomeMessage } = await import('./telegram');
        await sendWelcomeMessage(telegramUser.id.toString(), upsertedUser.referralCode || undefined);
      } catch (error) {
        console.error('❌ Failed to send welcome message:', error);
      }
    }
    
    req.user = { 
      telegramUser,
      user: upsertedUser 
    };
    
    next();
  } catch (error) {
    console.error("❌ Telegram authentication error:", error);
    res.status(500).json({ message: "Authentication failed" });
  }
};

// Setup modern authentication system
export async function setupAuth(app: express.Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  console.log('✅ Modern Telegram WebApp authentication configured');
  
  // Clean auth routes
  app.get("/api/login", (req, res) => {
    res.json({ 
      message: "Please use Telegram WebApp authentication",
      telegram_required: true 
    });
  });
  
  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });
}

// Simple authentication check middleware
export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.user || !req.user.user) {
    return res.status(401).json({ 
      message: "Authentication required. Please use Telegram WebApp.",
      telegram_required: true 
    });
  }
  next();
};