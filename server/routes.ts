import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertWithdrawalRequestSchema } from "@shared/schema";
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
        u.lastAdWatch && new Date(u.lastAdWatch).toDateString() === today
      ).length;

      // Ads watched today
      const adsWatchedToday = users.reduce((sum, u) => {
        if (u.lastAdWatch && new Date(u.lastAdWatch).toDateString() === today) {
          return sum + (u.dailyAdsWatched || 0);
        }
        return sum;
      }, 0);

      // Ads watched in last 7 days
      const adsWatched7Days = users.reduce((sum, u) => {
        if (u.lastAdWatch && new Date(u.lastAdWatch) >= sevenDaysAgo) {
          return sum + (u.adsWatched || 0);
        }
        return sum;
      }, 0);

      // Ads watched in last 30 days  
      const adsWatched30Days = users.reduce((sum, u) => {
        if (u.lastAdWatch && new Date(u.lastAdWatch) >= thirtyDaysAgo) {
          return sum + (u.adsWatched || 0);
        }
        return sum;
      }, 0);

      const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
      const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
      
      const totalSatsPaidOut = completedWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
      const totalAdsWatched = users.reduce((sum, u) => sum + (u.adsWatched || 0), 0);

      // 7-day revenue (total earnings from ads in last 7 days)
      const revenue7Days = users.reduce((sum, u) => {
        if (u.lastAdWatch && new Date(u.lastAdWatch) >= sevenDaysAgo) {
          return sum + parseFloat(u.totalEarnings || "0");
        }
        return sum;
      }, 0);

      // 30-day revenue
      const revenue30Days = users.reduce((sum, u) => {
        if (u.lastAdWatch && new Date(u.lastAdWatch) >= thirtyDaysAgo) {
          return sum + parseFloat(u.totalEarnings || "0");
        }
        return sum;
      }, 0);

      // Calculate daily data for last 7 days
      const dailyData7 = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toDateString();
        
        const dailyAds = users.reduce((sum, u) => {
          if (u.lastAdWatch && new Date(u.lastAdWatch).toDateString() === dateStr) {
            return sum + (u.dailyAdsWatched || 0);
          }
          return sum;
        }, 0);
        
        dailyData7.push({
          date: date.toISOString().split('T')[0],
          ads: dailyAds,
        });
      }

      // Calculate daily data for last 30 days (simplified for performance)
      const dailyData30 = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toDateString();
        
        const dailyAds = users.reduce((sum, u) => {
          if (u.lastAdWatch && new Date(u.lastAdWatch).toDateString() === dateStr) {
            return sum + (u.dailyAdsWatched || 0);
          }
          return sum;
        }, 0);
        
        dailyData30.push({
          date: date.toISOString().split('T')[0],
          ads: dailyAds,
        });
      }

      res.json({
        totalUsers: users.length,
        activeUsersToday,
        totalSatsPaidOut: Math.floor(totalSatsPaidOut),
        totalAdsWatched,
        adsWatchedToday,
        adsWatched7Days,
        adsWatched30Days,
        revenue7Days: Math.floor(revenue7Days),
        revenue30Days: Math.floor(revenue30Days),
        pendingWithdrawals: pendingWithdrawals.length,
        pendingWithdrawalAmount: pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0),
        dailyAdsChart7Days: dailyData7,
        dailyAdsChart30Days: dailyData30,
      });
    } catch (error) {
      console.error('Error in /api/admin/stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Get all users
  app.get('/api/admin/users', checkAdminAccess, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const withdrawals = await storage.getWithdrawalRequests();
      
      // Add additional info for each user
      const usersWithInfo = await Promise.all(users.map(async user => {
        // Get referral count
        const referrals = await storage.getReferralsByUser(user.id);
        
        // Get user's payouts
        const userWithdrawals = withdrawals.filter(w => w.userId === user.id && w.status === 'completed');
        const totalPayouts = userWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
        
        // Calculate pending withdrawals
        const pendingWithdrawals = withdrawals.filter(w => w.userId === user.id && w.status === 'pending');
        const totalPending = pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
        
        // Calculate available balance
        const totalBalance = parseFloat(user.withdrawBalance || "0");
        const availableBalance = totalBalance - totalPending;
        
        return {
          ...user,
          referralCount: referrals.length,
          totalPayouts: Math.floor(totalPayouts),
          pendingWithdrawals: totalPending,
          availableBalance: availableBalance,
          loginStreak: 1, // Default streak
          streakMultiplier: "0.002",
        };
      }));
      
      res.json(usersWithInfo);
    } catch (error) {
      console.error('Error in /api/admin/users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Get all withdrawals with user information
  app.get('/api/admin/withdrawals', checkAdminAccess, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawalRequestsWithUserInfo();
      res.json(withdrawals);
    } catch (error) {
      console.error('Error in /api/admin/withdrawals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Process withdrawal
  app.post('/api/admin/withdrawal/:id/process', checkAdminAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      
      if (!['completed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const withdrawal = await storage.updateWithdrawalRequest(id, {
        status,
        adminNotes,
        processedAt: new Date(),
      });

      // Handle balance changes based on status
      console.log('Processing withdrawal:', { id, status, withdrawalUserId: withdrawal.userId, withdrawalAmount: withdrawal.amount });
      
      const user = await storage.getUser(withdrawal.userId);
      console.log('Found user for withdrawal:', user ? { id: user.id, email: user.email, currentBalance: user.withdrawBalance } : 'No user found');
      
      if (user) {
        if (status === 'completed') {
          const currentBalance = parseFloat(user.withdrawBalance || "0");
          const withdrawalAmount = parseFloat(withdrawal.amount || "0");
          
          // Critical validation: ensure we're subtracting, not adding
          if (withdrawalAmount <= 0) {
            return res.status(400).json({ error: 'Invalid withdrawal amount' });
          }
          
          if (currentBalance < withdrawalAmount) {
            return res.status(400).json({ error: 'Insufficient balance for withdrawal' });
          }
          
          // IMPORTANT: Subtract the withdrawal amount from balance
          const newBalance = currentBalance - Math.abs(withdrawalAmount); // Use Math.abs to ensure positive amount is subtracted
          
          console.log('WITHDRAWAL PROCESSING:', { 
            currentBalance, 
            withdrawalAmount, 
            operation: 'SUBTRACTION', 
            calculation: `${currentBalance} - ${withdrawalAmount} = ${newBalance}`,
            newBalance 
          });
          
          // Safety check: ensure balance decreased
          if (newBalance >= currentBalance) {
            console.error('CRITICAL ERROR: Balance did not decrease!', { currentBalance, newBalance, withdrawalAmount });
            return res.status(500).json({ error: 'Balance calculation error' });
          }
          
          // Deduct balance when withdrawal is approved
          await storage.updateUser(user.id, {
            withdrawBalance: newBalance.toFixed(2),
          });
          
          // Verify the update was successful
          const updatedUser = await storage.getUser(user.id);
          console.log('Balance verification after update:', { 
            previousBalance: currentBalance,
            newBalance: parseFloat(updatedUser?.withdrawBalance || "0"),
            amountDeducted: withdrawalAmount,
            success: parseFloat(updatedUser?.withdrawBalance || "0") < currentBalance
          });
          
          console.log('WITHDRAWAL COMPLETED: Balance successfully deducted');
        }
        // If rejected, no need to refund since balance was never deducted
      } else {
        console.error('User not found for withdrawal processing:', withdrawal.userId);
      }

      res.json(withdrawal);
    } catch (error) {
      console.error('Error in /api/admin/withdrawal/process:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Update user
  app.post('/api/admin/user/:id/update', checkAdminAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { email, ...updates } = req.body; // Extract email, use the rest as updates
      
      const user = await storage.updateUser(id, updates);
      res.json(user);
    } catch (error) {
      console.error('Error in /api/admin/user/update:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Get app settings
  app.get('/api/admin/settings', checkAdminAccess, async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error in /api/admin/settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Update app settings
  app.post('/api/admin/settings', checkAdminAccess, async (req, res) => {
    try {
      const updates = req.body;
      const settings = await storage.updateAppSettings(updates);
      res.json(settings);
    } catch (error) {
      console.error('Error in /api/admin/settings/update:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Music Management API Routes

  // Admin: Upload music file with automatic metadata detection
  app.post('/api/admin/songs/upload', checkAdminAccess, upload.single('audioFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      const { email } = req.body;
      const filePath = req.file.path;
      
      try {
        // Extract metadata from audio file
        const metadata = await parseFile(filePath);
        
        const title = metadata.common.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
        const artist = metadata.common.artist || 'Unknown Artist';
        const duration = Math.round(metadata.format.duration || 0);
        
        // Create permanent filename
        const fileExtension = path.extname(req.file.originalname);
        const permanentFilename = `${Date.now()}-${title.replace(/[^a-zA-Z0-9]/g, '_')}${fileExtension}`;
        const permanentPath = path.join('uploads/music', permanentFilename);
        
        // Move file to permanent location
        fs.renameSync(filePath, permanentPath);
        
        // Create song record in database
        const song = await storage.createSong({
          title,
          artist,
          filename: permanentPath,
          duration,
          uploadedBy: email,
          isActive: true,
          playCount: 0
        });

        res.json({
          success: true,
          song,
          metadata: {
            title,
            artist,
            duration,
            album: metadata.common.album,
            year: metadata.common.year
          }
        });
      } catch (metadataError) {
        console.error('Error parsing audio metadata:', metadataError);
        
        // Fallback: use filename as title
        const title = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const permanentFilename = `${Date.now()}-${title.replace(/[^a-zA-Z0-9]/g, '_')}${path.extname(req.file.originalname)}`;
        const permanentPath = path.join('uploads/music', permanentFilename);
        
        fs.renameSync(filePath, permanentPath);
        
        const song = await storage.createSong({
          title,
          artist: 'Unknown Artist',
          filename: permanentPath,
          duration: 0,
          uploadedBy: email,
          isActive: true,
          playCount: 0
        });

        res.json({
          success: true,
          song,
          metadata: { title, artist: 'Unknown Artist', duration: 0 }
        });
      }
    } catch (error) {
      console.error('Error in /api/admin/songs/upload:', error);
      
      // Clean up uploaded file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ error: 'Failed to upload audio file' });
    }
  });

  // Admin: Get all songs
  app.get('/api/admin/songs', checkAdminAccess, async (req, res) => {
    try {
      const songs = await storage.getAllSongs();
      res.json(songs);
    } catch (error) {
      console.error('Error in /api/admin/songs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  // Admin: Update song
  app.put('/api/admin/songs/:id', checkAdminAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const song = await storage.updateSong(id, updates);
      res.json(song);
    } catch (error) {
      console.error('Error in /api/admin/songs update:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin: Delete song
  app.delete('/api/admin/songs/:id', checkAdminAccess, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSong(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error in /api/admin/songs delete:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Public: Get active songs for users
  app.get('/api/songs', async (req, res) => {
    try {
      const songs = await storage.getActiveSongs();
      res.json(songs);
    } catch (error) {
      console.error('Error in /api/songs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Public: Get music settings for music player (non-admin access)
  app.get('/api/music/settings', async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      
      // Return only music-related settings for public access
      const musicSettings = {
        backgroundMusic: settings.backgroundMusic,
        musicVolume: settings.musicVolume,
        autoPlay: settings.autoPlay,
        shuffleMode: settings.shuffleMode,
        soundEnabled: settings.soundEnabled
      };
      res.json(musicSettings);
    } catch (error) {
      console.error('Error in /api/music/settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Public: Update play count when song is played
  app.post('/api/songs/:id/play', async (req, res) => {
    try {
      const { id } = req.params;
      const song = await storage.getSong(id);
      
      if (!song) {
        return res.status(404).json({ error: 'Song not found' });
      }

      const updatedSong = await storage.updateSong(id, {
        playCount: (song.playCount || 0) + 1
      });

      res.json(updatedSong);
    } catch (error) {
      console.error('Error in /api/songs/play:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}