import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertWithdrawalRequestSchema } from "@shared/scheme";
import multer from "multer";
import { parseFile } from "music-metadata";
import path from "path";
import fs from "fs";

// Generate referral code
function generateReferralCode(): string {
  return 'LS' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/music/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve uploaded music files statically
  app.use('/uploads', express.static('uploads'));
  
  // Admin access control
  const ADMIN_EMAILS = ["sznofficial.store@gmail.com", "official.me.szn@gmail.com"];
  
  const checkAdminAccess = (req: any, res: any, next: any) => {
    const email = req.body?.email || req.query?.email;
    console.log('Admin access check - received email:', email);
    console.log('Allowed admin emails:', ADMIN_EMAILS);
    console.log('Email match found:', ADMIN_EMAILS.includes(email));
    
    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // Register/Login endpoint
  app.post('/api/register', async (req, res) => {
    try {
      const { email, referralCode, agreedToTerms } = req.body;
      
      if (!email || !email.includes('@gmail.com')) {
        return res.status(400).json({ error: 'Gmail address required' });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (user) {
        // Simply return existing user without streak updates for now
        return res.json(user);
      }

      if (!agreedToTerms) {
        return res.status(400).json({ error: 'Must agree to Terms & Conditions' });
      }

      // Create new user
      const newPersonalCode = generateReferralCode();
      let referredBy = null;
      let newUserBonus = "0"; // No bonus without referral code
      
      // Handle referral
      if (referralCode) {
        const referrer = await storage.getUserByPersonalCode(referralCode);
        if (referrer) {
          referredBy = referrer.id;
          newUserBonus = "20"; // 20 sats bonus with referral code
          console.log(`New user ${email} referred by ${referralCode}`);
        }
      }
      
      const userData = {
        email,
        username: email.split('@')[0],
        personalCode: newPersonalCode,
        referredBy,
        withdrawBalance: newUserBonus,
        totalEarnings: newUserBonus,
      };
      
      user = await storage.createUser(userData);
      
      // Process referral bonus
      if (referredBy && referralCode) {
        const referrer = await storage.getUser(referredBy);
        if (referrer) {
          // 10% commission on the new user bonus
          const commission = (parseFloat(newUserBonus) * 0.1).toFixed(2); // 2.0 sats for 20 bonus
          
          await storage.updateUser(referrer.id, {
            withdrawBalance: (parseFloat(referrer.withdrawBalance || "0") + parseFloat(commission)).toString(),
            totalEarnings: (parseFloat(referrer.totalEarnings || "0") + parseFloat(commission)).toString(),
          });
          
          await storage.createReferral({
            referrerId: referrer.id,
            refereeId: user.id,
            commission,
          });
          
          console.log(`Referral bonus: +${commission} sats to ${referrer.email}`);
        }
      }

      res.json(user);
    } catch (error) {
      console.error('Error in /api/register:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Login endpoint (same as register for existing users)
  app.post('/api/login', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@gmail.com')) {
        return res.status(400).json({ error: 'Gmail address required' });
      }

      // Capture login information
      const loginIp = req.ip || req.connection.remoteAddress || 'Unknown';
      const userAgent = req.get('User-Agent') || 'Unknown';
      const loginDevice = userAgent.includes('Mobile') ? 'Mobile' : 
                         userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';

      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Auto-create admin accounts for specific emails
        if (ADMIN_EMAILS.includes(email)) {
          const newPersonalCode = generateReferralCode();
          const userData = {
            email,
            username: email.split('@')[0],
            personalCode: newPersonalCode,
            withdrawBalance: "50", // Admin starting balance
            totalEarnings: "50",
            lastLoginAt: new Date(),
            lastLoginIp: loginIp,
            lastLoginDevice: loginDevice,
            lastLoginUserAgent: userAgent,
          };
          
          user = await storage.createUser(userData);
          console.log(`Auto-created admin account for ${email}`);
        } else {
          return res.status(404).json({ error: 'User not found. Please sign up first.' });
        }
      } else {
        // Update login information for existing user
        user = await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          lastLoginIp: loginIp,
          lastLoginDevice: loginDevice,
          lastLoginUserAgent: userAgent,
        });
      }

      // Simply return the user without streak updates for now
      res.json(user);
    } catch (error) {
      console.error('Error in /api/login:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Watch ad endpoint
  app.post('/api/watch-ad', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.banned) {
        return res.status(403).json({ error: 'Account is banned' });
      }

      // Check cooldown (3 seconds)
      const now = new Date();
      if (user.lastAdWatch && (now.getTime() - new Date(user.lastAdWatch).getTime()) < 3000) {
        return res.status(429).json({ error: 'Cooldown active' });
      }

      // Check daily limit
      const today = new Date().toDateString();
      const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
      
      let dailyAdsWatched = user.dailyAdsWatched || 0;
      if (lastAdToday !== today) {
        dailyAdsWatched = 0; // Reset daily count
      }

      // Get current app settings for dynamic limits and earnings
      const settings = await storage.getAppSettings();
      const dailyLimit = settings.dailyAdLimit || 250;
      
      if (dailyAdsWatched >= dailyLimit) {
        return res.status(429).json({ error: 'Daily limit reached' });
      }

      // Get streak multiplier
      const streak = await storage.getUserStreak(userId);
      const streakMultiplier = parseFloat(streak?.streakMultiplier || "0");

      // Calculate earnings using dynamic settings (base + streak multiplier)
      const baseEarnings = parseFloat(settings.baseEarningsPerAd || "0.25");
      const totalEarnings = (baseEarnings + streakMultiplier).toFixed(6);
      const earnedAmount = parseFloat(totalEarnings);

      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + earnedAmount).toString(),
        totalEarnings: (parseFloat(user.totalEarnings || "0") + earnedAmount).toString(),
        adsWatched: (user.adsWatched || 0) + 1,
        dailyAdsWatched: dailyAdsWatched + 1,
        dailyEarnings: (parseFloat(user.dailyEarnings || "0") + earnedAmount).toString(),
        lastAdWatch: now,
      });

      // Process referral commission if user was referred
      if (user.referredBy) {
        const referrer = await storage.getUser(user.referredBy);
        if (referrer) {
          const commissionRate = parseFloat(settings.referralCommissionRate || "0.10");
          const commission = (earnedAmount * commissionRate).toFixed(6); // Dynamic commission rate
          if (parseFloat(commission) > 0) {
            await storage.updateUser(referrer.id, {
              withdrawBalance: (parseFloat(referrer.withdrawBalance || "0") + parseFloat(commission)).toString(),
            });
            
            console.log(`Referral commission: +${commission} sats to ${referrer.email}`);
          }
        }
      }

      res.json({ ...updatedUser, earnedAmount: totalEarnings });
    } catch (error) {
      console.error('Error in /api/watch-ad:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get referrals
  app.get('/api/referrals', async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const referrals = await storage.getReferralsByUser(userId as string);
      res.json(referrals);
    } catch (error) {
      console.error('Error in /api/referrals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Claim commission endpoint
  app.post('/api/claim-commission', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const referrals = await storage.getReferralsByUser(userId);
      const unclaimedReferrals = referrals.filter((ref: any) => !ref.claimed);
      const totalCommission = unclaimedReferrals.reduce((sum: any, ref: any) => sum + parseFloat(ref.commission || "0"), 0);
      
      if (totalCommission <= 0 || unclaimedReferrals.length === 0) {
        return res.status(400).json({ error: 'No commission available to claim' });
      }

      // Add commission to user's balance
      await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + totalCommission).toString(),
        totalEarnings: (parseFloat(user.totalEarnings || "0") + totalCommission).toString(),
      });

      // Mark referrals as claimed to prevent double claiming
      await storage.markReferralsAsClaimed(userId);

      res.json({ 
        success: true, 
        claimedAmount: totalCommission.toFixed(2),
        newBalance: (parseFloat(user.withdrawBalance || "0") + totalCommission).toString()
      });
    } catch (error) {
      console.error('Error in /api/claim-commission:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Claim daily streak endpoint
  app.post('/api/claim-daily-streak', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.banned) {
        return res.status(403).json({ error: 'Account is banned' });
      }

      // Get or create user streak
      let streak = await storage.getUserStreak(userId);
      const now = new Date();
      const today = now.toDateString();
      
      if (!streak) {
        // Create new streak record by updating with initial values
        streak = await storage.updateStreak(userId, {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastClaimDate: now,
          streakMultiplier: "0.002"
        });
      } else {
        // Check if already claimed today
        const lastClaim = streak.lastClaimDate ? new Date(streak.lastClaimDate).toDateString() : '';
        
        if (lastClaim === today) {
          return res.status(400).json({ error: 'Daily bonus already claimed today. Come back tomorrow!' });
        }

        // Check if streak should continue or reset
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
        let newStreak = 1;
        
        if (lastClaim === yesterday) {
          // Continue streak
          newStreak = (streak.currentStreak || 0) + 1;
        }
        
        const newMultiplier = (newStreak * 0.002).toFixed(6);
        
        // Update streak
        streak = await storage.updateStreak(userId, {
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak || 0, newStreak),
          lastClaimDate: now,
          streakMultiplier: newMultiplier
        });
      }

      // Add bonus to user balance
      const bonusAmount = 1; // 1 sat bonus for claiming streak
      await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + bonusAmount).toString(),
        totalEarnings: (parseFloat(user.totalEarnings || "0") + bonusAmount).toString(),
      });

      res.json({ 
        success: true,
        streak: streak.currentStreak,
        multiplier: streak.streakMultiplier,
        bonusAmount
      });
    } catch (error) {
      console.error('Error in /api/claim-daily-streak:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user streak data
  app.get('/api/user-streak', async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const streak = await storage.getUserStreak(userId as string);
      const today = new Date().toDateString();
      
      if (!streak) {
        return res.json({
          currentStreak: 0,
          multiplier: "0.000",
          canClaim: true
        });
      }
      
      const lastClaim = streak.lastClaimDate ? new Date(streak.lastClaimDate).toDateString() : '';
      const canClaim = lastClaim !== today;
      
      res.json({
        currentStreak: streak.currentStreak || 0,
        multiplier: streak.streakMultiplier || "0.000",
        canClaim
      });
    } catch (error) {
      console.error('Error in /api/user-streak:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Withdrawal request
  app.post('/api/withdraw', async (req, res) => {
    try {
      const { userId, amount, lightningAddress, telegramUsername } = req.body;
      
      if (!userId || !amount || !lightningAddress || !telegramUsername) {
        return res.status(400).json({ error: 'All fields required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userBalance = parseFloat(user.withdrawBalance || "0");
      const adsWatched = user.adsWatched || 0;
      
      // Get user's pending withdrawals to calculate available balance
      const userWithdrawals = await storage.getWithdrawalRequests(userId);
      const pendingWithdrawals = userWithdrawals.filter(w => w.status === 'pending');
      const totalPending = pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
      const availableBalance = userBalance - totalPending;
      
      // Get dynamic settings for validation
      const settings = await storage.getAppSettings();
      const minAdsRequired = settings.minAdsForWithdrawal || 500;
      const minWithdrawal = parseFloat(settings.minWithdrawal || "2500");

      // Minimum ads requirement
      if (adsWatched < minAdsRequired) {
        return res.status(400).json({ error: `You need to watch ${minAdsRequired - adsWatched} more ads. Minimum ${minAdsRequired} ads required for withdrawal.` });
      }

      // Minimum withdrawal amount check
      if (parseFloat(amount) < minWithdrawal) {
        return res.status(400).json({ error: `Minimum withdrawal amount is ${minWithdrawal.toLocaleString()} sats` });
      }

      if (parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Withdrawal amount must be greater than 0' });
      }

      // Check if user has sufficient available balance (after pending withdrawals)
      if (parseFloat(amount) > availableBalance) {
        return res.status(400).json({ 
          error: `Insufficient available balance. You have ${availableBalance.toLocaleString()} sats available (${totalPending.toLocaleString()} sats pending withdrawal)` 
        });
      }

      // TEMPORARY: 1-week cooldown disabled for testing
      // const userWithdrawals = await storage.getWithdrawalRequests(userId);
      // const completedWithdrawals = userWithdrawals.filter(w => w.status === 'completed');
      // 
      // if (completedWithdrawals.length > 0) {
      //   const lastCompletedWithdrawal = completedWithdrawals
      //     .sort((a, b) => new Date(b.processedAt || '').getTime() - new Date(a.processedAt || '').getTime())[0];
      //   
      //   if (lastCompletedWithdrawal.processedAt) {
      //     const lastWithdrawalTime = new Date(lastCompletedWithdrawal.processedAt);
      //     const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      //     
      //     if (lastWithdrawalTime > oneWeekAgo) {
      //       const nextAllowedTime = new Date(lastWithdrawalTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      //       return res.status(400).json({ 
      //         error: `You can only withdraw once per week. Next withdrawal available on ${nextAllowedTime.toLocaleDateString()}` 
      //       });
      //     }
      //   }
      // }

      const withdrawal = await storage.createWithdrawalRequest({
        userId,
        email: user.email,
        name: null, // Name field removed from frontend, set to null
        telegramUsername,
        amount: amount.toString(),
        walletAddress: lightningAddress,
        method: 'lightning',
        status: 'pending',
      });

      // Balance will be deducted when admin approves the withdrawal
      // No balance deduction here to prevent premature deduction

      res.json(withdrawal);
    } catch (error) {
      console.error('Error in /api/withdraw:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get withdrawal history
  app.get('/api/withdrawals', async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const withdrawals = await storage.getWithdrawalRequests(userId as string);
      res.json(withdrawals);
    } catch (error) {
      console.error('Error in /api/withdrawals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Get dashboard stats
  app.get('/api/admin/stats', checkAdminAccess, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const withdrawals = await storage.getWithdrawalRequests();
      
      const now = new Date();
      const today = now.toDateString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Active users today
      const activeUsersToday = users.filter(u => 
        u.lastAdWatch && new Date(u.lastAdWatch).toDateString() ===