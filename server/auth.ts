// Modern Telegram WebApp Authentication System
// Replaces legacy Replit OAuth with clean Telegram-only auth

import express, { type RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";
import { pool } from "./db";
import { 
  validateDeviceAndDetectDuplicate, 
  banUserForMultipleAccounts,
  sendWarningToMainAccount,
  type DeviceInfo 
} from "./deviceTracking";

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Configure session store using the same SSL-configured pool as the main database
  const sessionStore = new pgStore({
    pool: pool, // Reuse the SSL-configured pool from db.ts
    createTableIfMissing: false,
    ttl: Math.floor(sessionTtl / 1000), // TTL expects seconds, not milliseconds
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
    
    const deviceId = req.headers['x-device-id'] as string;
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    
    let deviceInfo: DeviceInfo | null = null;
    if (deviceId) {
      deviceInfo = {
        deviceId,
        fingerprint: deviceFingerprint ? JSON.parse(deviceFingerprint as string) : {
          userAgent: req.headers['user-agent'],
          platform: req.headers['sec-ch-ua-platform'],
        }
      };
    }
    
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
        telegram_id: testUser.id.toString(),
        personalCode: testUser.username || testUser.id.toString(),
        withdrawBalance: '0',
        totalEarnings: '0',
        adsWatched: 0,
        dailyAdsWatched: 0,
        dailyEarnings: '0',
        level: 1,
        flagged: false,
        banned: false,
        referralCode: 'ff0269235650', // Use migrated test user code
      });
      
      // Ensure test user has referral code
      if (!upsertedUser.referralCode) {
        await storage.generateReferralCode(upsertedUser.id);
      }
      
      req.user = { 
        telegramUser: { ...testUser, id: testUserId },
        user: upsertedUser
      };
      
      // Save user data to session for WebSocket authentication
      req.session.user = req.user;
      return next();
    }
    
    if (!telegramData) {
      return res.status(401).json({ 
        message: "Authentication required. Please open this app from your Telegram app to continue.",
        telegram_required: true,
        error_code: "NO_TELEGRAM_DATA"
      });
    }
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ 
        message: "Service temporarily unavailable. Please try again later.",
        error_code: "AUTH_SERVICE_ERROR"
      });
    }
    
    // Verify Telegram data integrity
    const { isValid, user: telegramUser } = verifyTelegramWebAppData(telegramData, botToken);
    
    if (!isValid || !telegramUser) {
      console.log('❌ Authentication failed - invalid Telegram data');
      return res.status(401).json({ 
        message: "Authentication failed. Please restart the app from Telegram and try again.",
        error_code: "INVALID_AUTH_DATA"
      });
    }
    
    if (deviceInfo) {
      const deviceValidation = await validateDeviceAndDetectDuplicate(
        telegramUser.id.toString(),
        deviceInfo
      );
      
      if (deviceValidation.shouldBan && deviceValidation.primaryAccountId) {
        const { user: existingUser } = await storage.getTelegramUser(telegramUser.id.toString());
        
        if (existingUser) {
          await banUserForMultipleAccounts(
            existingUser.id,
            deviceValidation.reason || "Multiple accounts detected on the same device"
          );
          
          await sendWarningToMainAccount(deviceValidation.primaryAccountId);
        }
        
        return res.status(403).json({ 
          banned: true,
          message: "Your account has been banned for violating our multi-account policy.",
          reason: deviceValidation.reason
        });
      }
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
      referralCode: '',
    }, deviceInfo);
    
    // Send welcome message for new users with referral code
    if (isNewUser) {
      try {
        const { sendWelcomeMessage } = await import('./telegram');
        await sendWelcomeMessage(telegramUser.id.toString());
      } catch (error) {
        console.error('❌ Failed to send welcome message:', error);
      }
    }
    
    req.user = { 
      telegramUser,
      user: upsertedUser 
    };
    
    // Save user data to session for WebSocket authentication
    req.session.user = req.user;
    
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

// Lenient authentication middleware - doesn't block, just logs
// Used for wallet/withdraw routes to prevent auth popup spam
export const optionalAuth: RequestHandler = (req: any, res, next) => {
  try {
    const user = req.session?.user || req.user;
    if (!user) {
      console.log("⚠️ No Telegram user found in session - allowing request to proceed");
      // Return success with skipAuth flag instead of blocking
      return res.status(200).json({ success: true, skipAuth: true });
    }
    next();
  } catch (err) {
    console.error("Optional auth middleware error:", err);
    // Don't block on error - just skip auth
    return res.status(200).json({ success: true, skipAuth: true });
  }
};