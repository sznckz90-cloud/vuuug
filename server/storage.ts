import {
  users,
  earnings,
  referrals,
  referralCommissions,
  promoCodes,
  promoCodeUsage,
  withdrawals,
  userBalances,
  transactions,
  dailyTasks,
  type User,
  type UpsertUser,
  type InsertEarning,
  type Earning,
  type Referral,
  type InsertReferral,
  type ReferralCommission,
  type InsertReferralCommission,
  type PromoCode,
  type InsertPromoCode,
  type PromoCodeUsage,
  type InsertPromoCodeUsage,
  type Withdrawal,
  type InsertWithdrawal,
  type UserBalance,
  type InsertUserBalance,
  type Transaction,
  type InsertTransaction,
  type DailyTask,
  type InsertDailyTask,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import crypto from "crypto";

// Payment system configuration
export interface PaymentSystem {
  id: string;
  name: string;
  emoji: string;
  minWithdrawal: number;
}

export const PAYMENT_SYSTEMS: PaymentSystem[] = [
  { id: 'telegram_stars', name: 'Telegram Stars', emoji: '⭐', minWithdrawal: 1.00 },
  { id: 'tether_polygon', name: 'Tether (Polygon POS)', emoji: '🌐', minWithdrawal: 0.01 },
  { id: 'ton_coin', name: 'Ton Coin', emoji: '💎', minWithdrawal: 0.35 },
  { id: 'litecoin', name: 'Litecoin', emoji: '⏺', minWithdrawal: 0.35 }
];

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<{ user: User; isNewUser: boolean }>;
  
  // Earnings operations
  addEarning(earning: InsertEarning): Promise<Earning>;
  getUserEarnings(userId: string, limit?: number): Promise<Earning[]>;
  getUserStats(userId: string): Promise<{
    todayEarnings: string;
    weekEarnings: string;
    monthEarnings: string;
    totalEarnings: string;
  }>;
  
  // Balance operations
  updateUserBalance(userId: string, amount: string): Promise<void>;
  
  // Streak operations
  updateUserStreak(userId: string): Promise<{ newStreak: number; rewardEarned: string }>;
  
  // Ads tracking
  incrementAdsWatched(userId: string): Promise<void>;
  resetDailyAdsCount(userId: string): Promise<void>;
  canWatchAd(userId: string): Promise<boolean>;
  
  // Withdrawal operations
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  getUserWithdrawals(userId: string): Promise<Withdrawal[]>;
  
  // Admin withdrawal operations
  getAllPendingWithdrawals(): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  updateWithdrawalStatus(withdrawalId: string, status: string, transactionHash?: string, adminNotes?: string): Promise<Withdrawal>;
  
  // Referral operations
  createReferral(referrerId: string, referredId: string): Promise<Referral>;
  getUserReferrals(userId: string): Promise<Referral[]>;
  
  // Generate referral code
  generateReferralCode(userId: string): Promise<string>;
  getUserByReferralCode(referralCode: string): Promise<User | null>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUserBanStatus(userId: string, banned: boolean): Promise<void>;
  
  // Telegram user operations
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  upsertTelegramUser(telegramId: string, userData: Omit<UpsertUser, 'id' | 'telegramId'>): Promise<{ user: User; isNewUser: boolean }>;
  
  
  // Daily reset system
  performDailyReset(): Promise<void>;
  checkAndPerformDailyReset(): Promise<void>;
  
  // User balance operations
  getUserBalance(userId: string): Promise<UserBalance | undefined>;
  createOrUpdateUserBalance(userId: string, balance?: string): Promise<UserBalance>;
  deductBalance(userId: string, amount: string): Promise<{ success: boolean; message: string }>;
  addBalance(userId: string, amount: string): Promise<void>;
  
  // Admin/Statistics operations
  getAppStats(): Promise<{
    totalUsers: number;
    activeUsersToday: number;
    totalInvites: number;
    totalEarnings: string;
    totalReferralEarnings: string;
    totalPayouts: string;
    newUsersLast24h: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    try {
      // Use raw SQL to avoid Drizzle ORM issues
      const result = await db.execute(sql`
        SELECT * FROM users WHERE telegram_id = ${telegramId} LIMIT 1
      `);
      const user = result.rows[0] as User | undefined;
      return user;
    } catch (error) {
      console.error('Error in getUserByTelegramId:', error);
      throw error;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<{ user: User; isNewUser: boolean }> {
    // Check if user already exists
    const existingUser = await this.getUser(userData.id!);
    const isNewUser = !existingUser;
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Auto-generate referral code for new users if they don't have one
    if (isNewUser && !user.referralCode) {
      try {
        await this.generateReferralCode(user.id);
      } catch (error) {
        console.error('Failed to generate referral code for new user:', error);
      }
    }
    
    // Auto-create balance record for new users
    if (isNewUser) {
      try {
        await this.createOrUpdateUserBalance(user.id, '0');
        console.log(`✅ Created balance record for new user: ${user.id}`);
      } catch (error) {
        console.error('Failed to create balance record for new user:', error);
      }
    }
    
    return { user, isNewUser };
  }

  async upsertTelegramUser(telegramId: string, userData: Omit<UpsertUser, 'id' | 'telegramId'>): Promise<{ user: User; isNewUser: boolean }> {
    // Sanitize user data to prevent SQL issues
    const sanitizedData = {
      ...userData,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      username: userData.username || null,
      personalCode: userData.personalCode || telegramId,
      withdrawBalance: userData.withdrawBalance || '0',
      totalEarnings: userData.totalEarnings || '0',
      adsWatched: userData.adsWatched || 0,
      dailyAdsWatched: userData.dailyAdsWatched || 0,
      dailyEarnings: userData.dailyEarnings || '0',
      level: userData.level || 1,
      flagged: userData.flagged || false,
      banned: userData.banned || false
      // NOTE: Don't generate referral code here - it will be handled separately for new users only
    };
    
    // Check if user already exists by Telegram ID
    let existingUser = await this.getUserByTelegramId(telegramId);
    
    // If not found by telegram_id, check if user exists by personal_code (for migration scenarios)
    if (!existingUser && sanitizedData.personalCode) {
      const result = await db.execute(sql`
        SELECT * FROM users WHERE personal_code = ${sanitizedData.personalCode} LIMIT 1
      `);
      const userByPersonalCode = result.rows[0] as User | undefined;
      
      if (userByPersonalCode) {
        // User exists but doesn't have telegram_id set - update it
        const updateResult = await db.execute(sql`
          UPDATE users 
          SET telegram_id = ${telegramId},
              first_name = ${sanitizedData.firstName}, 
              last_name = ${sanitizedData.lastName}, 
              username = ${sanitizedData.username},
              updated_at = NOW()
          WHERE personal_code = ${sanitizedData.personalCode}
          RETURNING *
        `);
        const user = updateResult.rows[0] as User;
        return { user, isNewUser: false };
      }
    }
    
    const isNewUser = !existingUser;
    
    if (existingUser) {
      // For existing users, update fields and ensure referral code exists
      const result = await db.execute(sql`
        UPDATE users 
        SET first_name = ${sanitizedData.firstName}, 
            last_name = ${sanitizedData.lastName}, 
            username = ${sanitizedData.username},
            updated_at = NOW()
        WHERE telegram_id = ${telegramId}
        RETURNING *
      `);
      const user = result.rows[0] as User;
      
      // Ensure existing user has referral code
      if (!user.referralCode) {
        console.log('🔄 Generating missing referral code for existing user:', user.id);
        try {
          await this.generateReferralCode(user.id);
          // Fetch updated user with referral code
          const updatedUser = await this.getUser(user.id);
          return { user: updatedUser || user, isNewUser };
        } catch (error) {
          console.error('Failed to generate referral code for existing user:', error);
          return { user, isNewUser };
        }
      }
      
      return { user, isNewUser };
    } else {
      // For new users, check if email already exists
      // If it does, we'll create a unique email by appending the telegram ID
      let finalEmail = userData.email;
      try {
        // Try to create with the provided email first
        const result = await db.execute(sql`
          INSERT INTO users (
            telegram_id, email, first_name, last_name, username, personal_code, 
            withdraw_balance, total_earnings, ads_watched, daily_ads_watched, 
            daily_earnings, level, flagged, banned
          )
          VALUES (
            ${telegramId}, ${finalEmail}, ${sanitizedData.firstName}, ${sanitizedData.lastName}, 
            ${sanitizedData.username}, ${sanitizedData.personalCode}, ${sanitizedData.withdrawBalance}, 
            ${sanitizedData.totalEarnings}, ${sanitizedData.adsWatched}, ${sanitizedData.dailyAdsWatched}, 
            ${sanitizedData.dailyEarnings}, ${sanitizedData.level}, ${sanitizedData.flagged}, 
            ${sanitizedData.banned}
          )
          RETURNING *
        `);
        const user = result.rows[0] as User;
        
        // Auto-generate referral code for new users
        try {
          await this.generateReferralCode(user.id);
        } catch (error) {
          console.error('Failed to generate referral code for new Telegram user:', error);
        }
        
        // Auto-create balance record for new users
        try {
          await this.createOrUpdateUserBalance(user.id, '0');
          console.log(`✅ Created balance record for new Telegram user: ${user.id}`);
        } catch (error) {
          console.error('Failed to create balance record for new Telegram user:', error);
        }
        
        // Fetch updated user with referral code
        const updatedUser = await this.getUser(user.id);
        return { user: updatedUser || user, isNewUser };
      } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
          if (error.constraint === 'users_email_unique') {
            finalEmail = `${telegramId}@telegram.user`;
          } else if (error.constraint === 'users_personal_code_unique') {
            // If personal_code conflict, use telegram ID as personal code
            sanitizedData.personalCode = `tg_${telegramId}`;
          }
          
          // Try again with modified data
          const result = await db.execute(sql`
            INSERT INTO users (
              telegram_id, email, first_name, last_name, username, personal_code, 
              withdraw_balance, total_earnings, ads_watched, daily_ads_watched, 
              daily_earnings, level, flagged, banned
            )
            VALUES (
              ${telegramId}, ${finalEmail}, ${sanitizedData.firstName}, ${sanitizedData.lastName}, 
              ${sanitizedData.username}, ${sanitizedData.personalCode}, ${sanitizedData.withdrawBalance}, 
              ${sanitizedData.totalEarnings}, ${sanitizedData.adsWatched}, ${sanitizedData.dailyAdsWatched}, 
              ${sanitizedData.dailyEarnings}, ${sanitizedData.level}, ${sanitizedData.flagged}, 
              ${sanitizedData.banned}
            )
            RETURNING *
          `);
          const user = result.rows[0] as User;
          
          // Auto-generate referral code for new users
          try {
            await this.generateReferralCode(user.id);
          } catch (error) {
            console.error('Failed to generate referral code for new Telegram user:', error);
          }
          
          // Auto-create balance record for new users
          try {
            await this.createOrUpdateUserBalance(user.id, '0');
            console.log(`✅ Created balance record for new Telegram user: ${user.id}`);
          } catch (error) {
            console.error('Failed to create balance record for new Telegram user:', error);
          }
          
          // Fetch updated user with referral code
          const updatedUser = await this.getUser(user.id);
          return { user: updatedUser || user, isNewUser };
        } else {
          throw error;
        }
      }
    }
  }

  // Transaction operations
  async addTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    
    console.log(`📊 Transaction recorded: ${transaction.type} of $${transaction.amount} for user ${transaction.userId} - ${transaction.source}`);
    return newTransaction;
  }

  // Helper function to log transactions for referral system
  async logTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    return this.addTransaction(transactionData);
  }

  // Earnings operations
  async addEarning(earning: InsertEarning): Promise<Earning> {
    const [newEarning] = await db
      .insert(earnings)
      .values(earning)
      .returning();
    
    // Log transaction for security and tracking
    await this.logTransaction({
      userId: earning.userId,
      amount: earning.amount,
      type: 'addition',
      source: earning.source,
      description: earning.description || `${earning.source} earning`,
      metadata: { earningId: newEarning.id }
    });
    
    // Update canonical user_balances table and keep users table in sync
    // All earnings contribute to available balance
    if (parseFloat(earning.amount) !== 0) {
      try {
        // Ensure user has a balance record first with improved error handling
        await this.createOrUpdateUserBalance(earning.userId);
        
        // Update canonical user_balances table
        await db
          .update(userBalances)
          .set({
            balance: sql`COALESCE(${userBalances.balance}, 0) + ${earning.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(userBalances.userId, earning.userId));
      } catch (balanceError) {
        console.error('Error updating user balance in addEarning:', balanceError);
        // Auto-create the record if it doesn't exist instead of throwing error
        try {
          console.log('🔄 Attempting to auto-create missing balance record...');
          await this.createOrUpdateUserBalance(earning.userId, '0');
          // Retry the balance update
          await db
            .update(userBalances)
            .set({
              balance: sql`COALESCE(${userBalances.balance}, 0) + ${earning.amount}`,
              updatedAt: new Date(),
            })
            .where(eq(userBalances.userId, earning.userId));
          console.log('✅ Successfully recovered from balance error');
        } catch (recoveryError) {
          console.error('❌ Failed to recover from balance error:', recoveryError);
          // Continue with the function - don't let balance errors block earnings
        }
      }
      
      try {
        // Keep users table in sync for compatibility
        await db
          .update(users)
          .set({
            balance: sql`COALESCE(${users.balance}, 0) + ${earning.amount}`,
            withdrawBalance: sql`COALESCE(${users.withdrawBalance}, 0) + ${earning.amount}`,
            totalEarned: sql`COALESCE(${users.totalEarned}, 0) + ${earning.amount}`,
            totalEarnings: sql`COALESCE(${users.totalEarnings}, 0) + ${earning.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, earning.userId));
      } catch (userUpdateError) {
        console.error('Error updating users table in addEarning:', userUpdateError);
        // Don't throw - the earning was already recorded
      }
    }
    
    // Process referral commission (10% of user's earnings)
    // Only process commissions for non-referral earnings to avoid recursion
    if (earning.source !== 'referral_commission' && earning.source !== 'referral') {
      await this.processReferralCommission(earning.userId, newEarning.id, earning.amount);
    }
    
    // Check and activate referral bonuses after ad watch (critical for referral system)
    if (earning.source === 'ad_watch') {
      await this.checkAndActivateReferralBonus(earning.userId);
    }
    
    return newEarning;
  }

  async getUserEarnings(userId: string, limit: number = 20): Promise<Earning[]> {
    return db
      .select()
      .from(earnings)
      .where(eq(earnings.userId, userId))
      .orderBy(desc(earnings.createdAt))
      .limit(limit);
  }

  async getUserStats(userId: string): Promise<{
    todayEarnings: string;
    weekEarnings: string;
    monthEarnings: string;
    totalEarnings: string;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const [todayResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
      })
      .from(earnings)
      .where(
        and(
          eq(earnings.userId, userId),
          gte(earnings.createdAt, today),
          sql`${earnings.source} <> 'withdrawal'`
        )
      );

    const [weekResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
      })
      .from(earnings)
      .where(
        and(
          eq(earnings.userId, userId),
          gte(earnings.createdAt, weekAgo),
          sql`${earnings.source} <> 'withdrawal'`
        )
      );

    const [monthResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
      })
      .from(earnings)
      .where(
        and(
          eq(earnings.userId, userId),
          gte(earnings.createdAt, monthAgo),
          sql`${earnings.source} <> 'withdrawal'`
        )
      );

    const [totalResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
      })
      .from(earnings)
      .where(
        and(
          eq(earnings.userId, userId),
          sql`${earnings.source} <> 'withdrawal'`
        )
      );

    return {
      todayEarnings: todayResult.total,
      weekEarnings: weekResult.total,
      monthEarnings: monthResult.total,
      totalEarnings: totalResult.total,
    };
  }

  async updateUserBalance(userId: string, amount: string): Promise<void> {
    // Ensure user has a balance record first
    await this.createOrUpdateUserBalance(userId);
    
    // Update the canonical user_balances table
    await db
      .update(userBalances)
      .set({
        balance: sql`${userBalances.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userBalances.userId, userId));
  }

  // Helper function to get the correct day bucket start (12:00 PM UTC)
  private getDayBucketStart(date: Date): Date {
    const bucketStart = new Date(date);
    bucketStart.setUTCHours(12, 0, 0, 0);
    
    // If the event occurred before 12:00 PM UTC on its calendar day,
    // it belongs to the previous day's bucket
    if (date.getTime() < bucketStart.getTime()) {
      bucketStart.setUTCDate(bucketStart.getUTCDate() - 1);
    }
    
    return bucketStart;
  }

  async updateUserStreak(userId: string): Promise<{ newStreak: number; rewardEarned: string }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error("User not found");
    }

    const now = new Date();
    const today = this.getDayBucketStart(now);
    
    const lastStreakDate = user.lastStreakDate;
    let newStreak = 1;
    let rewardEarned = "0";

    if (lastStreakDate) {
      const lastStreakBucket = this.getDayBucketStart(new Date(lastStreakDate));
      
      const dayDiff = Math.floor((today.getTime() - lastStreakBucket.getTime()) / (24 * 60 * 60 * 1000));
      
      if (dayDiff === 1) {
        // Consecutive day
        newStreak = (user.currentStreak || 0) + 1;
      } else if (dayDiff === 0) {
        // Same day, no change
        newStreak = user.currentStreak || 1;
        return { newStreak, rewardEarned: "0" };
      }
      // If dayDiff > 1, streak resets to 1
    }

    // Calculate streak reward (daily streak bonus)
    if (newStreak > 0) {
      rewardEarned = "0.00035"; // 0.00035 TON daily streak bonus
    }

    // Update user streak
    await db
      .update(users)
      .set({
        currentStreak: newStreak,
        lastStreakDate: today,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Add streak bonus earning if applicable
    if (parseFloat(rewardEarned) > 0) {
      await this.addEarning({
        userId,
        amount: rewardEarned,
        source: 'streak_bonus',
        description: `Daily streak bonus`,
      });
    }

    return { newStreak, rewardEarned };
  }

  // Helper function for consistent 12:00 PM UTC reset date calculation
  private getResetDate(date = new Date()): string {
    const utcDate = date.toISOString().split('T')[0];
    
    // If current time is before 12:00 PM UTC, consider it still "yesterday" for tasks
    if (date.getUTCHours() < 12) {
      const yesterday = new Date(date);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    
    return utcDate;
  }

  async incrementAdsWatched(userId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) return;

    const now = new Date();
    const currentResetDate = this.getCurrentResetDate(); // Use new reset method

    // Check if last ad was watched today (same reset period)
    let adsCount = 1; // Default for first ad of the day
    
    if (user.lastAdDate) {
      const lastAdResetDate = this.getCurrentResetDate(); // Use consistent method
      const lastAdDateString = user.lastAdDate.toISOString().split('T')[0];
      
      // If same reset period, increment current count
      if (lastAdDateString === currentResetDate) {
        adsCount = (user.adsWatchedToday || 0) + 1;
      }
    }

    console.log(`📊 ADS_COUNT_DEBUG: User ${userId}, Reset Date: ${currentResetDate}, New Count: ${adsCount}, Previous Count: ${user.adsWatchedToday || 0}`);

    await db
      .update(users)
      .set({
        adsWatchedToday: adsCount,
        adsWatched: sql`COALESCE(${users.adsWatched}, 0) + 1`, // Increment total ads watched
        lastAdDate: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // NEW: Update task progress for the new task system
    await this.updateTaskProgress(userId, adsCount);
  }

  async resetDailyAdsCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        adsWatchedToday: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async canWatchAd(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return false;
    
    const now = new Date();
    const currentResetDate = this.getResetDate(now);

    let currentCount = 0;
    
    if (user.lastAdDate) {
      const lastAdResetDate = this.getResetDate(user.lastAdDate);
      
      // If same reset period, use current count
      if (lastAdResetDate === currentResetDate) {
        currentCount = user.adsWatchedToday || 0;
      }
    }
    
    return currentCount < 160; // Daily limit of 160 ads
  }


  async createReferral(referrerId: string, referredId: string): Promise<Referral> {
    // Validate inputs
    if (!referrerId || !referredId) {
      throw new Error(`Invalid referral parameters: referrerId=${referrerId}, referredId=${referredId}`);
    }
    
    // Prevent self-referrals
    if (referrerId === referredId) {
      throw new Error('Users cannot refer themselves');
    }
    
    // Verify both users exist
    const referrer = await this.getUser(referrerId);
    const referred = await this.getUser(referredId);
    
    if (!referrer) {
      throw new Error(`Referrer user not found: ${referrerId}`);
    }
    
    if (!referred) {
      throw new Error(`Referred user not found: ${referredId}`);
    }
    
    // Check if referral already exists
    const existingReferral = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.refereeId, referredId)
      ))
      .limit(1);
    
    if (existingReferral.length > 0) {
      throw new Error('Referral relationship already exists');
    }
    
    // Create the referral relationship (initially pending)
    const [referral] = await db
      .insert(referrals)
      .values({
        referrerId,
        refereeId: referredId,
        rewardAmount: "0.01",
        status: 'pending', // Pending until friend watches 10 ads
      })
      .returning();
    
    // CRITICAL: Also update the referred user's referred_by field with the referrer's referral code
    // This ensures both the referrals table and the user's referred_by field are synchronized
    await db
      .update(users)
      .set({
        referredBy: referrer.referralCode, // Store the referrer's referral code, not their ID
        updatedAt: new Date(),
      })
      .where(eq(users.id, referredId));
    
    console.log(`✅ Referral relationship created (pending): ${referrerId} referred ${referredId}, referred_by updated to: ${referrer.referralCode}`);
    return referral;
  }

  // Check and activate referral bonus when friend completes FIRST ad (0.002 TON reward)
  async checkAndActivateReferralBonus(userId: string): Promise<void> {
    try {
      // Check if this user has already completed first ad
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || user.firstAdWatched) {
        // First ad already processed for this user
        return;
      }

      // Count ads watched by this user
      const [adCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(earnings)
        .where(and(
          eq(earnings.userId, userId),
          eq(earnings.source, 'ad_watch')
        ));

      const adsWatched = adCount?.count || 0;
      
      // If user has watched first ad, activate referral bonuses
      if (adsWatched >= 1) {
        // Mark this user as having completed first ad
        await db
          .update(users)
          .set({ firstAdWatched: true })
          .where(eq(users.id, userId));

        // Find pending referrals where this user is the referee
        const pendingReferrals = await db
          .select()
          .from(referrals)
          .where(and(
            eq(referrals.refereeId, userId),
            eq(referrals.status, 'pending')
          ));

        // Activate each pending referral
        for (const referral of pendingReferrals) {
          // Update referral status to completed
          await db
            .update(referrals)
            .set({ status: 'completed' })
            .where(eq(referrals.id, referral.id));

          // Award 0.002 TON referral bonus to referrer
          await this.addEarning({
            userId: referral.referrerId,
            amount: "0.002",
            source: 'referral',
            description: `Referral bonus - friend completed first ad`,
          });

          console.log(`✅ First ad referral bonus: 0.002 TON awarded to ${referral.referrerId} from ${userId}'s first ad`);
        }
      }
    } catch (error) {
      console.error('Error checking referral bonus activation:', error);
    }
  }

  async getUserReferrals(userId: string): Promise<Referral[]> {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));
  }

  async getUserByReferralCode(referralCode: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
    return user || null;
  }


  async getReferralByUsers(referrerId: string, refereeId: string): Promise<Referral | null> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.refereeId, refereeId)
      ))
      .limit(1);
    return referral || null;
  }

  // Helper method to ensure all users have referral codes
  async ensureAllUsersHaveReferralCodes(): Promise<void> {
    const usersWithoutCodes = await db
      .select()
      .from(users)
      .where(sql`${users.referralCode} IS NULL OR ${users.referralCode} = ''`);
    
    for (const user of usersWithoutCodes) {
      try {
        await this.generateReferralCode(user.id);
        console.log(`Generated referral code for user ${user.id}`);
      } catch (error) {
        console.error(`Failed to generate referral code for user ${user.id}:`, error);
      }
    }
  }

  // CRITICAL: Fix existing referral data by synchronizing referrals table with referred_by fields
  async fixExistingReferralData(): Promise<void> {
    try {
      console.log('🔄 Starting referral data synchronization...');
      
      // Find all users who have referred_by but no entry in referrals table
      const usersWithReferredBy = await db
        .select({
          userId: users.id,
          referredBy: users.referredBy,
          referralCode: users.referralCode
        })
        .from(users)
        .where(and(
          sql`${users.referredBy} IS NOT NULL`,
          sql`${users.referredBy} != ''`
        ));

      console.log(`Found ${usersWithReferredBy.length} users with referred_by field set`);

      for (const user of usersWithReferredBy) {
        try {
          // Skip if referredBy is null or empty
          if (!user.referredBy) continue;
          
          // Find the referrer by their referral code
          const referrer = await this.getUserByReferralCode(user.referredBy);
          
          if (referrer) {
            // Check if referral relationship already exists
            const existingReferral = await db
              .select()
              .from(referrals)
              .where(and(
                eq(referrals.referrerId, referrer.id),
                eq(referrals.refereeId, user.userId)
              ))
              .limit(1);

            if (existingReferral.length === 0) {
              // Create the missing referral relationship
              await db
                .insert(referrals)
                .values({
                  referrerId: referrer.id,
                  refereeId: user.userId,
                  rewardAmount: "0.01",
                  status: 'pending', // Will be updated by checkAndActivateReferralBonus if user has 10+ ads
                });
              
              console.log(`✅ Created missing referral: ${referrer.id} -> ${user.userId}`);
              
              // Check if this user should have activated referral bonus
              await this.checkAndActivateReferralBonus(user.userId);
            }
          } else {
            console.log(`⚠️  Referrer not found for referral code: ${user.referredBy}`);
          }
        } catch (error) {
          console.error(`❌ Error processing user ${user.userId}:`, error);
        }
      }
      
      console.log('✅ Referral data synchronization completed');
    } catch (error) {
      console.error('❌ Error in fixExistingReferralData:', error);
    }
  }

  async generateReferralCode(userId: string): Promise<string> {
    // First check if user already has a referral code
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (user && user.referralCode) {
      return user.referralCode;
    }
    
    // Generate a secure random referral code using crypto
    const code = crypto.randomBytes(6).toString('hex'); // 12-character hex code
    
    await db
      .update(users)
      .set({
        referralCode: code,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    
    return code;
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async updateUserBanStatus(userId: string, banned: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        banned,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Promo code operations
  async createPromoCode(promoCodeData: InsertPromoCode): Promise<PromoCode> {
    const [promoCode] = await db
      .insert(promoCodes)
      .values(promoCodeData)
      .returning();
    
    return promoCode;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return db
      .select()
      .from(promoCodes)
      .orderBy(desc(promoCodes.createdAt));
  }

  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code));
    
    return promoCode;
  }

  async updatePromoCodeStatus(id: string, isActive: boolean): Promise<PromoCode> {
    const [promoCode] = await db
      .update(promoCodes)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(promoCodes.id, id))
      .returning();
    
    return promoCode;
  }

  async usePromoCode(code: string, userId: string): Promise<{ success: boolean; message: string; reward?: string }> {
    // Get promo code
    const promoCode = await this.getPromoCode(code);
    
    if (!promoCode) {
      return { success: false, message: "Invalid promo code" };
    }

    if (!promoCode.isActive) {
      return { success: false, message: "Promo code is inactive" };
    }

    // Check if expired
    if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
      return { success: false, message: "Promo code has expired" };
    }

    // Check usage limit
    if (promoCode.usageLimit && (promoCode.usageCount || 0) >= promoCode.usageLimit) {
      return { success: false, message: "Promo code usage limit reached" };
    }

    // Check per-user limit
    const userUsageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(promoCodeUsage)
      .where(and(
        eq(promoCodeUsage.promoCodeId, promoCode.id),
        eq(promoCodeUsage.userId, userId)
      ));

    if (userUsageCount[0]?.count >= (promoCode.perUserLimit || 1)) {
      return { success: false, message: "You have reached the usage limit for this promo code" };
    }

    // Record usage
    await db.insert(promoCodeUsage).values({
      promoCodeId: promoCode.id,
      userId,
      rewardAmount: promoCode.rewardAmount,
    });

    // Update usage count
    await db
      .update(promoCodes)
      .set({
        usageCount: sql`${promoCodes.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promoCodes.id, promoCode.id));

    // Add reward to user balance
    await this.addEarning({
      userId,
      amount: promoCode.rewardAmount,
      source: 'promo_code',
      description: `Promo code reward: ${code}`,
    });

    return {
      success: true,
      message: `Promo code redeemed! You earned ${promoCode.rewardAmount} ${promoCode.rewardCurrency}`,
      reward: `${promoCode.rewardAmount} ${promoCode.rewardCurrency}`,
    };
  }

  // Process referral commission (10% of user's earnings)
  async processReferralCommission(userId: string, originalEarningId: number, earningAmount: string): Promise<void> {
    try {
      // Only process commissions for ad watching earnings
      const [earning] = await db
        .select()
        .from(earnings)
        .where(eq(earnings.id, originalEarningId))
        .limit(1);

      if (!earning || earning.source !== 'ad_watch') {
        // Only ad earnings generate commissions
        return;
      }

      // Find who referred this user (must be completed referral)
      const [referralInfo] = await db
        .select({ referrerId: referrals.referrerId })
        .from(referrals)
        .where(and(
          eq(referrals.refereeId, userId),
          eq(referrals.status, 'completed') // Only completed referrals earn commissions
        ))
        .limit(1);

      if (!referralInfo) {
        // User was not referred by anyone or referral not activated
        return;
      }

      // Calculate 8% commission on ad earnings only
      const commissionAmount = (parseFloat(earningAmount) * 0.08).toFixed(8);
      
      // Record the referral commission
      await db.insert(referralCommissions).values({
        referrerId: referralInfo.referrerId,
        referredUserId: userId,
        originalEarningId,
        commissionAmount,
      });

      // Add commission as earnings to the referrer
      await this.addEarning({
        userId: referralInfo.referrerId,
        amount: commissionAmount,
        source: 'referral_commission',
        description: `8% commission from referred user's ad earnings`,
      });

      // Log commission transaction
      await this.logTransaction({
        userId: referralInfo.referrerId,
        amount: commissionAmount,
        type: 'addition',
        source: 'referral_commission',
        description: `8% commission from referred user's ad earnings`,
        metadata: { 
          originalEarningId, 
          referredUserId: userId,
          commissionRate: '8%'
        }
      });

      console.log(`✅ Referral commission of ${commissionAmount} awarded to ${referralInfo.referrerId} from ${userId}'s ad earnings`);
    } catch (error) {
      console.error('Error processing referral commission:', error);
      // Don't throw error to avoid disrupting the main earning process
    }
  }

  async getUserReferralEarnings(userId: string): Promise<string> {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
      .from(earnings)
      .where(and(
        eq(earnings.userId, userId),
        sql`${earnings.source} IN ('referral_commission', 'referral')`
      ));

    return result.total;
  }


  async createPayoutRequest(userId: string, amount: string, paymentSystemId: string, paymentDetails?: string): Promise<{ success: boolean; message: string; withdrawalId?: string }> {
    try {
      // Get user data
      const user = await this.getUser(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Check balance (but don't deduct yet - wait for admin approval)
      // Note: Admins have unlimited balance, so skip balance check for them
      const isAdmin = user.telegram_id === process.env.TELEGRAM_ADMIN_ID;
      const userBalance = parseFloat(user.balance || '0');
      const payoutAmount = parseFloat(amount);
      
      if (!isAdmin && userBalance < payoutAmount) {
        return { success: false, message: 'Insufficient balance' };
      }

      // Find payment system
      const paymentSystem = PAYMENT_SYSTEMS.find(p => p.id === paymentSystemId);
      const paymentSystemName = paymentSystem ? paymentSystem.name : paymentSystemId;

      // Create pending withdrawal record (DO NOT deduct balance yet)
      const withdrawalDetails = {
        paymentSystem: paymentSystemName,
        paymentDetails: paymentDetails,
        paymentSystemId: paymentSystemId
      };

      const [withdrawal] = await db.insert(withdrawals).values({
        userId: userId,
        amount: amount,
        status: 'pending',
        method: paymentSystemName,
        details: withdrawalDetails
      }).returning();

      return { 
        success: true, 
        message: 'Payout request created successfully and is pending admin approval',
        withdrawalId: withdrawal.id
      };
    } catch (error) {
      console.error('Error creating payout request:', error);
      return { success: false, message: 'Error processing payout request' };
    }
  }

  async getAppStats(): Promise<{
    totalUsers: number;
    activeUsersToday: number;
    totalInvites: number;
    totalEarnings: string;
    totalReferralEarnings: string;
    totalPayouts: string;
    newUsersLast24h: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // Total users
    const [totalUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Active users today (users who earned something today)
    const [activeUsersResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${earnings.userId})` })
      .from(earnings)
      .where(gte(earnings.createdAt, today));

    // Total invites
    const [totalInvitesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(referrals);

    // Total earnings (positive amounts only)
    const [totalEarningsResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
      .from(earnings)
      .where(sql`${earnings.amount} > 0`);

    // Total referral earnings
    const [totalReferralEarningsResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${earnings.amount}), '0')` })
      .from(earnings)
      .where(sql`${earnings.source} IN ('referral_commission', 'referral')`);

    // Total payouts (negative amounts)
    const [totalPayoutsResult] = await db
      .select({ total: sql<string>`COALESCE(ABS(SUM(${earnings.amount})), '0')` })
      .from(earnings)
      .where(eq(earnings.source, 'payout'));

    // New users in last 24h
    const [newUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, yesterday));

    return {
      totalUsers: totalUsersResult.count || 0,
      activeUsersToday: activeUsersResult.count || 0,
      totalInvites: totalInvitesResult.count || 0,
      totalEarnings: totalEarningsResult.total || '0',
      totalReferralEarnings: totalReferralEarningsResult.total || '0',
      totalPayouts: totalPayoutsResult.total || '0',
      newUsersLast24h: newUsersResult.count || 0,
    };
  }

  // Withdrawal operations (missing implementations)
  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [result] = await db.insert(withdrawals).values(withdrawal).returning();
    return result;
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
  }

  async getAllPendingWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.status, 'pending')).orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async updateWithdrawalStatus(withdrawalId: string, status: string, transactionHash?: string, adminNotes?: string): Promise<Withdrawal> {
    const updateData: any = { status, updatedAt: new Date() };
    if (transactionHash) updateData.transactionHash = transactionHash;
    if (adminNotes) updateData.adminNotes = adminNotes;
    
    const [result] = await db.update(withdrawals).set(updateData).where(eq(withdrawals.id, withdrawalId)).returning();
    return result;
  }

  async approveWithdrawal(withdrawalId: string, adminNotes?: string): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal }> {
    try {
      // Get withdrawal details
      const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal not found' };
      }
      
      if (withdrawal.status !== 'pending') {
        return { success: false, message: 'Withdrawal is not pending' };
      }

      // Get user and check balance again
      const user = await this.getUser(withdrawal.userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const userBalance = parseFloat(user.balance || '0');
      const withdrawalAmount = parseFloat(withdrawal.amount);
      
      if (userBalance < withdrawalAmount) {
        return { success: false, message: 'User has insufficient balance' };
      }

      // Deduct balance and update withdrawal status
      await db
        .update(users)
        .set({
          balance: sql`COALESCE(${users.balance}, 0) - ${withdrawal.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, withdrawal.userId));

      // Add withdrawal record as earnings (negative amount)
      const paymentSystemName = withdrawal.method;
      const description = `Payout completed: $${withdrawal.amount} via ${paymentSystemName}`;

      await this.addEarning({
        userId: withdrawal.userId,
        amount: `-${withdrawal.amount}`,
        source: 'payout',
        description: description,
      });

      // Update withdrawal status to paid
      const updatedWithdrawal = await this.updateWithdrawalStatus(withdrawalId, 'paid', undefined, adminNotes);
      
      return { success: true, message: 'Withdrawal approved and processed', withdrawal: updatedWithdrawal };
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      return { success: false, message: 'Error processing withdrawal approval' };
    }
  }

  async rejectWithdrawal(withdrawalId: string, adminNotes?: string): Promise<{ success: boolean; message: string; withdrawal?: Withdrawal }> {
    try {
      // Get withdrawal details
      const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal not found' };
      }
      
      if (withdrawal.status !== 'pending') {
        return { success: false, message: 'Withdrawal is not pending' };
      }

      // Update withdrawal status to rejected (balance remains unchanged)
      const updatedWithdrawal = await this.updateWithdrawalStatus(withdrawalId, 'rejected', undefined, adminNotes);
      
      return { success: true, message: 'Withdrawal rejected', withdrawal: updatedWithdrawal };
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      return { success: false, message: 'Error processing withdrawal rejection' };
    }
  }

  async getWithdrawal(withdrawalId: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    return withdrawal;
  }


  // Ensure all required system tasks exist for production deployment
  async ensureSystemTasksExist(): Promise<void> {
    try {
      // Get first available user to be the owner, or create a system user
      let firstUser = await db.select({ id: users.id }).from(users).limit(1).then(users => users[0]);
      
      if (!firstUser) {
        console.log('⚠️ No users found, creating system user for task ownership');
        // Create a system user for task ownership
        const systemUser = await db.insert(users).values({
          id: 'system-user',
          username: 'System',
          firstName: 'System',
          lastName: 'Tasks',
          referralCode: 'SYSTEM',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning({ id: users.id });
        firstUser = systemUser[0];
        console.log('✅ System user created for task ownership');
      }

      // Define all system tasks with exact specifications
      const systemTasks = [
        // Fixed daily tasks
        {
          id: 'channel-visit-check-update',
          type: 'channel_visit',
          url: 'https://t.me/PaidAdsNews',
          rewardPerUser: '0.00015000', // 0.00015 TON formatted to 8 digits for precision
          title: 'Channel visit (Check Update)',
          description: 'Visit our Telegram channel for updates and news'
        },
        {
          id: 'app-link-share',
          type: 'share_link',
          url: 'share://referral',
          rewardPerUser: '0.00020000', // 0.00020 TON formatted to 8 digits for precision
          title: 'App link share (Share link)',
          description: 'Share your affiliate link with friends'
        },
        {
          id: 'invite-friend-valid',
          type: 'invite_friend',
          url: 'invite://friend',
          rewardPerUser: '0.00050000', // 0.00050 TON formatted to 8 digits for precision
          title: 'Invite friend (valid)',
          description: 'Invite 1 valid friend to earn rewards'
        },
        // Daily ads goal tasks
        {
          id: 'ads-goal-mini',
          type: 'ads_goal_mini',
          url: 'watch://ads/mini',
          rewardPerUser: '0.00045000', // 0.00045 TON formatted to 8 digits for precision
          title: 'Mini (Watch 15 ads)',
          description: 'Watch 15 ads to complete this daily goal'
        },
        {
          id: 'ads-goal-light',
          type: 'ads_goal_light',
          url: 'watch://ads/light',
          rewardPerUser: '0.00060000', // 0.00060 TON formatted to 8 digits for precision
          title: 'Light (Watch 25 ads)',
          description: 'Watch 25 ads to complete this daily goal'
        },
        {
          id: 'ads-goal-medium',
          type: 'ads_goal_medium',
          url: 'watch://ads/medium',
          rewardPerUser: '0.00070000', // 0.00070 TON formatted to 8 digits for precision
          title: 'Medium (Watch 45 ads)',
          description: 'Watch 45 ads to complete this daily goal'
        },
        {
          id: 'ads-goal-hard',
          type: 'ads_goal_hard',
          url: 'watch://ads/hard',
          rewardPerUser: '0.00080000', // 0.00080 TON formatted to 8 digits for precision
          title: 'Hard (Watch 75 ads)',
          description: 'Watch 75 ads to complete this daily goal'
        }
      ];

      // Create or update each system task
      for (const task of systemTasks) {
        const existingTask = await this.getPromotion(task.id);
        
        if (existingTask) {
          // Update existing task to match current specifications
          await db.update(promotions)
            .set({
              type: task.type,
              url: task.url,
              rewardPerUser: task.rewardPerUser,
              title: task.title,
              description: task.description,
              status: 'active',
              isApproved: true // System tasks are pre-approved
            })
            .where(eq(promotions.id, task.id));
          
          console.log(`✅ System task updated: ${task.title}`);
        } else {
          // Create new system task
          await db.insert(promotions).values({
            id: task.id,
            ownerId: firstUser.id,
            type: task.type,
            url: task.url,
            cost: '0',
            rewardPerUser: task.rewardPerUser,
            limit: 100000, // High limit for system tasks
            claimedCount: 0,
            status: 'active',
            isApproved: true, // System tasks are pre-approved
            title: task.title,
            description: task.description,
            createdAt: new Date()
          });
          
          console.log(`✅ System task created: ${task.title}`);
        }
      }

      console.log('✅ All system tasks ensured successfully');
    } catch (error) {
      console.error('❌ Error ensuring system tasks exist:', error);
      // Don't throw - server should still start even if task creation fails
    }
  }


  // Ensure admin user with unlimited balance exists for production deployment
  async ensureAdminUserExists(): Promise<void> {
    try {
      const adminTelegramId = '6653616672';
      const maxBalance = '99.999'; // Admin balance as requested
      
      // Check if admin user already exists
      const existingAdmin = await this.getUserByTelegramId(adminTelegramId);
      if (existingAdmin) {
        // Update balance if it's less than max
        if (parseFloat(existingAdmin.balance || '0') < parseFloat(maxBalance)) {
          await db.update(users)
            .set({ 
              balance: maxBalance,
              updatedAt: new Date()
            })
            .where(eq(users.telegram_id, adminTelegramId));
          
          // Also update user_balances table
          await db.insert(userBalances).values({
            userId: existingAdmin.id,
            balance: maxBalance,
            createdAt: new Date(),
            updatedAt: new Date()
          }).onConflictDoUpdate({
            target: [userBalances.userId],
            set: {
              balance: maxBalance,
              updatedAt: new Date()
            }
          });
          
          console.log('✅ Admin balance updated to unlimited:', adminTelegramId);
        } else {
          console.log('✅ Admin user already exists with unlimited balance:', adminTelegramId);
        }
        return;
      }

      // Create admin user with unlimited balance
      const adminUser = await db.insert(users).values({
        telegram_id: adminTelegramId,
        username: 'admin',
        balance: maxBalance,
        referralCode: 'ADMIN001',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      if (adminUser[0]) {
        // Also create user balance record
        await db.insert(userBalances).values({
          userId: adminUser[0].id,
          balance: maxBalance,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log('✅ Admin user created with unlimited balance:', adminTelegramId);
      }
    } catch (error) {
      console.error('❌ Error ensuring admin user exists:', error);
      // Don't throw - server should still start even if admin creation fails
    }
  }

  // Promotion system removed - using Ads Watch Tasks system only

  async getAvailablePromotionsForUser(userId: string): Promise<any> {
    // Get all active and approved promotions - ALWAYS show them
    const allPromotions = await db.select().from(promotions)
      .where(and(eq(promotions.status, 'active'), eq(promotions.isApproved, true)))
      .orderBy(desc(promotions.createdAt));

    const currentDate = this.getCurrentTaskDate();
    const availablePromotions = [];

    for (const promotion of allPromotions) {
      // Check if this is a daily task type
      const isDailyTask = [
        'channel_visit', 'share_link', 'invite_friend',
        'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'
      ].includes(promotion.type);

      const periodDate = isDailyTask ? currentDate : undefined;
      
      // Get current task status from the new system
      const taskStatus = await this.getTaskStatus(userId, promotion.id, periodDate);
      
      let completionStatus = 'locked';
      let statusMessage = 'Click to start';
      let progress = null;
      let buttonText = 'Start';

      if (taskStatus) {
        if (taskStatus.status === 'claimed') {
          completionStatus = 'claimed';
          statusMessage = '✅ Done';
          buttonText = '✅ Done';
        } else if (taskStatus.status === 'claimable') {
          completionStatus = 'claimable';
          statusMessage = 'Ready to claim!';
          buttonText = 'Claim';
        } else {
          // Status is 'locked' - check if we can make it claimable
          const verificationResult = await this.verifyTask(userId, promotion.id, promotion.type);
          if (verificationResult.status === 'claimable') {
            completionStatus = 'claimable';
            statusMessage = 'Ready to claim!';
            buttonText = 'Claim';
          } else {
            completionStatus = 'locked';
            if (promotion.type.startsWith('ads_goal_')) {
              const user = await this.getUser(userId);
              const adsWatchedToday = user?.adsWatchedToday || 0;
              const adsGoalThresholds = {
                'ads_goal_mini': 15,
                'ads_goal_light': 25,
                'ads_goal_medium': 45,
                'ads_goal_hard': 75
              };
              const requiredAds = adsGoalThresholds[promotion.type as keyof typeof adsGoalThresholds] || 0;
              statusMessage = `Watch ${Math.max(0, requiredAds - adsWatchedToday)} more ads (${adsWatchedToday}/${requiredAds})`;
              progress = {
                current: adsWatchedToday,
                required: requiredAds,
                percentage: Math.min(100, (adsWatchedToday / requiredAds) * 100)
              };
              buttonText = 'Watch Ads';
            } else if (promotion.type === 'invite_friend') {
              statusMessage = 'Invite a friend first';
              buttonText = 'Copy Link';
            } else if (promotion.type === 'share_link') {
              statusMessage = 'Share your affiliate link first';
              buttonText = 'Share Link';
            } else if (promotion.type === 'channel_visit') {
              statusMessage = 'Visit the channel';
              buttonText = 'Visit Channel';
            }
          }
        }
      } else {
        // No task status yet - create initial status
        await this.setTaskStatus(userId, promotion.id, 'locked', periodDate);
        
        // Set default messages based on task type
        if (promotion.type === 'channel_visit') {
          statusMessage = 'Visit the channel';
          buttonText = 'Visit Channel';
        } else if (promotion.type === 'share_link') {
          statusMessage = 'Share your affiliate link';
          buttonText = 'Share Link';
        } else if (promotion.type === 'invite_friend') {
          statusMessage = 'Invite a friend';
          buttonText = 'Copy Link';
        } else if (promotion.type.startsWith('ads_goal_')) {
          const adsGoalThresholds = {
            'ads_goal_mini': 15,
            'ads_goal_light': 25,
            'ads_goal_medium': 45,
            'ads_goal_hard': 75
          };
          const requiredAds = adsGoalThresholds[promotion.type as keyof typeof adsGoalThresholds] || 0;
          const user = await this.getUser(userId);
          const adsWatchedToday = user?.adsWatchedToday || 0;
          statusMessage = `Watch ${Math.max(0, requiredAds - adsWatchedToday)} more ads (${adsWatchedToday}/${requiredAds})`;
          progress = {
            current: adsWatchedToday,
            required: requiredAds,
            percentage: Math.min(100, (adsWatchedToday / requiredAds) * 100)
          };
          buttonText = 'Watch Ads';
        }
      }

      // ALWAYS add the task - never filter out
      availablePromotions.push({
        ...promotion,
        completionStatus,
        statusMessage,
        buttonText,
        progress
      });
    }

    return {
      success: true,
      tasks: availablePromotions.map(p => ({
        id: p.id,
        title: p.title || 'Untitled Task',
        description: p.description || '',
        type: p.type,
        channelUsername: p.url?.match(/t\.me\/([^/?]+)/)?.[1],
        botUsername: p.url?.match(/t\.me\/([^/?]+)/)?.[1],
        reward: p.rewardPerUser || '0',
        completedCount: p.claimedCount || 0,
        totalSlots: p.limit || 1000,
        isActive: p.status === 'active',
        createdAt: p.createdAt,
        claimUrl: p.url,
        // New task status system properties
        completionStatus: (p as any).completionStatus,
        statusMessage: (p as any).statusMessage,
        buttonText: (p as any).buttonText,
        progress: (p as any).progress
      })),
      total: availablePromotions.length
    };
  }


  // Task completion system removed - using Ads Watch Tasks system only


  // Get current date in YYYY-MM-DD format for 12:00 PM UTC reset
  private getCurrentTaskDate(): string {
    const now = new Date();
    const resetHour = 12; // 12:00 PM UTC
    
    // If current time is before 12:00 PM UTC, use yesterday's date
    if (now.getUTCHours() < resetHour) {
      now.setUTCDate(now.getUTCDate() - 1);
    }
    
    return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  }


  async completeDailyTask(promotionId: string, userId: string, rewardAmount: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if promotion exists
      const promotion = await this.getPromotion(promotionId);
      if (!promotion) {
        return { success: false, message: 'Daily task not found' };
      }

      // Check if user already completed this daily task today
      const hasCompleted = await this.hasUserCompletedDailyTask(promotionId, userId);
      if (hasCompleted) {
        return { success: false, message: 'You have already completed this daily task today' };
      }

      const currentDate = this.getCurrentTaskDate();

      // Record daily task completion
      await db.insert(dailyTaskCompletions).values({
        promotionId,
        userId,
        taskType: promotion.type, // Use promotion type as task type
        rewardAmount,
        progress: 1,
        required: 1,
        completed: true,
        claimed: true,
        completionDate: currentDate,
      });

      console.log(`📊 DAILY_TASK_COMPLETION_LOG: UserID=${userId}, TaskID=${promotionId}, AmountRewarded=${rewardAmount}, Date=${currentDate}, Status=SUCCESS, Title="${promotion.title}"`);

      // Add reward to user's earnings balance
      await this.addBalance(userId, rewardAmount);

      // Add earning record
      await this.addEarning({
        userId,
        amount: rewardAmount,
        source: 'daily_task_completion',
        description: `Daily task completed: ${promotion.title}`,
      });

      // Send task completion notification to user via Telegram
      try {
        const { sendTaskCompletionNotification } = await import('./telegram');
        await sendTaskCompletionNotification(userId, rewardAmount);
      } catch (error) {
        console.error('Failed to send task completion notification:', error);
        // Don't fail the task completion if notification fails
      }

      return { success: true, message: 'Daily task completed successfully' };
    } catch (error) {
      console.error('Error completing daily task:', error);
      return { success: false, message: 'Error completing daily task' };
    }
  }

  async checkAdsGoalCompletion(userId: string, adsGoalType: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    const currentDate = this.getCurrentTaskDate();
    const adsWatchedToday = user.adsWatchedToday || 0;

    // Define ads goal thresholds
    const adsGoalThresholds = {
      'ads_goal_mini': 15,
      'ads_goal_light': 25, 
      'ads_goal_medium': 45,
      'ads_goal_hard': 75
    };

    const requiredAds = adsGoalThresholds[adsGoalType as keyof typeof adsGoalThresholds];
    if (!requiredAds) return false;

    // Check if user has watched enough ads today
    return adsWatchedToday >= requiredAds;
  }

  // Helper method to check if user has valid referral today (only 1 allowed per day)
  async hasValidReferralToday(userId: string): Promise<boolean> {
    try {
      // Check if there's an actual new referral created today in the referrals table
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const todayReferrals = await db
        .select({ count: sql`count(*)` })
        .from(referrals)
        .where(
          and(
            eq(referrals.referrerId, userId),
            gte(referrals.createdAt, startOfDay),
            lt(referrals.createdAt, endOfDay)
          )
        );

      const count = Number(todayReferrals[0]?.count || 0);
      console.log(`🔍 Referral validation for user ${userId}: ${count} new referrals today`);
      
      return count >= 1;
    } catch (error) {
      console.error('Error checking valid referral today:', error);
      return false;
    }
  }

  // Helper method to check if user has shared their link today
  async hasSharedLinkToday(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      // Use the new appShared field for faster lookup
      return user.appShared || false;
    } catch (error) {
      console.error('Error checking link share today:', error);
      return false;
    }
  }

  // Helper method to check if user has visited channel today
  async hasVisitedChannelToday(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      // Use the new channelVisited field for faster lookup
      return user.channelVisited || false;
    } catch (error) {
      console.error('Error checking channel visit today:', error);
      return false;
    }
  }

  // Method to record that user shared their link (called from frontend)
  async recordLinkShare(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user already shared today
      const hasShared = await this.hasSharedLinkToday(userId);
      if (hasShared) {
        return { success: true, message: 'Link share already recorded today' };
      }

      // Update the appShared field
      await db.update(users)
        .set({ appShared: true })
        .where(eq(users.id, userId));

      return { success: true, message: 'Link share recorded successfully' };
    } catch (error) {
      console.error('Error recording link share:', error);
      return { success: false, message: 'Failed to record link share' };
    }
  }

  // ============== NEW TASK STATUS SYSTEM FUNCTIONS ==============
  
  // Get or create task status for user
  async getTaskStatus(userId: string, promotionId: string, periodDate?: string): Promise<TaskStatus | null> {
    try {
      const [taskStatus] = await db.select().from(taskStatuses)
        .where(and(
          eq(taskStatuses.userId, userId),
          eq(taskStatuses.promotionId, promotionId),
          periodDate ? eq(taskStatuses.periodDate, periodDate) : sql`${taskStatuses.periodDate} IS NULL`
        ));
      return taskStatus || null;
    } catch (error) {
      console.error('Error getting task status:', error);
      return null;
    }
  }

  // Update or create task status
  async setTaskStatus(
    userId: string, 
    promotionId: string, 
    status: 'locked' | 'claimable' | 'claimed',
    periodDate?: string,
    progressCurrent?: number,
    progressRequired?: number,
    metadata?: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const existingStatus = await this.getTaskStatus(userId, promotionId, periodDate);
      
      if (existingStatus) {
        // Update existing status
        await db.update(taskStatuses)
          .set({
            status,
            progressCurrent,
            progressRequired,
            metadata,
            updatedAt: sql`now()`
          })
          .where(eq(taskStatuses.id, existingStatus.id));
      } else {
        // Create new status
        await db.insert(taskStatuses).values({
          userId,
          promotionId,
          periodDate,
          status,
          progressCurrent: progressCurrent || 0,
          progressRequired: progressRequired || 0,
          metadata
        });
      }
      
      return { success: true, message: 'Task status updated successfully' };
    } catch (error) {
      console.error('Error setting task status:', error);
      return { success: false, message: 'Failed to update task status' };
    }
  }

  // Verify task and update status to claimable
  async verifyTask(userId: string, promotionId: string, taskType: string): Promise<{ success: boolean; message: string; status?: 'claimable' | 'locked' | 'claimed' }> {
    try {
      const promotion = await this.getPromotion(promotionId);
      if (!promotion) {
        return { success: false, message: 'Task not found' };
      }

      const isDailyTask = ['channel_visit', 'share_link', 'invite_friend', 'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'].includes(taskType);
      const periodDate = isDailyTask ? this.getCurrentTaskDate() : undefined;

      // Check current status
      const currentStatus = await this.getTaskStatus(userId, promotionId, periodDate);
      if (currentStatus?.status === 'claimed') {
        return { success: false, message: 'Task already claimed', status: 'claimed' };
      }

      let verified = false;
      let progressCurrent = 0;
      let progressRequired = 0;

      // Perform verification based on task type
      switch (taskType) {
        case 'channel_visit':
          // Channel visit is immediately claimable after user clicks
          verified = true;
          break;
          
        case 'share_link':
          // Check if user has shared their link
          verified = await this.hasSharedLinkToday(userId);
          break;
          
        case 'invite_friend':
          // Check if user has valid referral today
          verified = await this.hasValidReferralToday(userId);
          break;
          
        case 'ads_goal_mini':
        case 'ads_goal_light':
        case 'ads_goal_medium':
        case 'ads_goal_hard':
          // Check if user met ads goal
          const user = await this.getUser(userId);
          const adsWatchedToday = user?.adsWatchedToday || 0;
          
          const adsGoalThresholds = {
            'ads_goal_mini': 15,
            'ads_goal_light': 25,
            'ads_goal_medium': 45,
            'ads_goal_hard': 75
          };
          
          progressRequired = adsGoalThresholds[taskType as keyof typeof adsGoalThresholds] || 0;
          progressCurrent = adsWatchedToday;
          verified = adsWatchedToday >= progressRequired;
          break;
          
        default:
          verified = true; // For other task types, assume verified
      }

      const newStatus = verified ? 'claimable' : 'locked';
      await this.setTaskStatus(userId, promotionId, newStatus, periodDate, progressCurrent, progressRequired);

      return { 
        success: true, 
        message: verified ? 'Task verified, ready to claim!' : 'Task requirements not met yet',
        status: newStatus
      };
    } catch (error) {
      console.error('Error verifying task:', error);
      return { success: false, message: 'Failed to verify task' };
    }
  }

  // Claim task reward
  async claimTaskReward(userId: string, promotionId: string): Promise<{ success: boolean; message: string; rewardAmount?: string; newBalance?: string }> {
    try {
      const promotion = await this.getPromotion(promotionId);
      if (!promotion) {
        return { success: false, message: 'Task not found' };
      }

      const isDailyTask = ['channel_visit', 'share_link', 'invite_friend', 'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'].includes(promotion.type);
      const periodDate = isDailyTask ? this.getCurrentTaskDate() : undefined;

      // Check current status
      const currentStatus = await this.getTaskStatus(userId, promotionId, periodDate);
      if (!currentStatus) {
        return { success: false, message: 'Task status not found' };
      }
      
      if (currentStatus.status === 'claimed') {
        return { success: false, message: 'Task already claimed' };
      }
      
      if (currentStatus.status !== 'claimable') {
        return { success: false, message: 'Task not ready to claim' };
      }

      // Prevent users from claiming their own tasks
      if (promotion.ownerId === userId) {
        return { success: false, message: 'You cannot claim your own task' };
      }

      const rewardAmount = promotion.rewardPerUser || '0';
      
      // Record claim in appropriate table
      if (isDailyTask) {
        await db.insert(dailyTaskCompletions).values({
          promotionId,
          userId,
          taskType: promotion.type,
          rewardAmount,
          progress: 1,
          required: 1,
          completed: true,
          claimed: true,
          completionDate: periodDate!,
        });
      } else {
        await db.insert(taskCompletions).values({
          promotionId,
          userId,
          rewardAmount,
          verified: true,
        });
      }

      // Add reward to balance
      await this.addBalance(userId, rewardAmount);

      // Add earning record
      await this.addEarning({
        userId,
        amount: rewardAmount,
        source: isDailyTask ? 'daily_task_completion' : 'task_completion',
        description: `Task completed: ${promotion.title}`,
      });

      // Update task status to claimed
      await this.setTaskStatus(userId, promotionId, 'claimed', periodDate);

      // Get updated balance
      const updatedBalance = await this.getUserBalance(userId);

      console.log(`📊 TASK_CLAIM_LOG: UserID=${userId}, TaskID=${promotionId}, AmountRewarded=${rewardAmount}, Status=SUCCESS, Title="${promotion.title}"`);

      // Send notification
      try {
        const { sendTaskCompletionNotification } = await import('./telegram');
        await sendTaskCompletionNotification(userId, rewardAmount);
      } catch (error) {
        console.error('Failed to send task completion notification:', error);
      }

      return { 
        success: true, 
        message: 'Task claimed successfully!',
        rewardAmount,
        newBalance: updatedBalance?.balance || '0'
      };
    } catch (error) {
      console.error('Error claiming task reward:', error);
      return { success: false, message: 'Failed to claim task reward' };
    }
  }

  // ============== END NEW TASK STATUS SYSTEM FUNCTIONS ==============

  // Method to record that user visited channel (called from frontend)
  async recordChannelVisit(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user already visited today
      const hasVisited = await this.hasVisitedChannelToday(userId);
      if (hasVisited) {
        return { success: true, message: 'Channel visit already recorded today' };
      }

      // Update the channelVisited field
      await db.update(users)
        .set({ channelVisited: true })
        .where(eq(users.id, userId));

      return { success: true, message: 'Channel visit recorded successfully' };
    } catch (error) {
      console.error('Error recording channel visit:', error);
      return { success: false, message: 'Failed to record channel visit' };
    }
  }

  // Method to increment referrals today count when a referral is made
  async incrementReferralsToday(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get current user data
      const user = await this.getUser(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Increment referrals today count
      const newCount = (user.friendsInvited || 0) + 1;
      await db.update(users)
        .set({ friendsInvited: newCount })
        .where(eq(users.id, userId));

      return { success: true, message: `Referrals today count updated to ${newCount}` };
    } catch (error) {
      console.error('Error incrementing referrals today:', error);
      return { success: false, message: 'Failed to increment referrals today' };
    }
  }

  // Daily reset system - runs at 12:00 PM UTC
  async performDailyReset(): Promise<void> {
    try {
      console.log('🔄 Starting daily reset at 12:00 PM UTC...');
      
      const currentDate = new Date();
      const currentDateString = currentDate.toISOString().split('T')[0];
      const periodStart = new Date(currentDate);
      periodStart.setUTCHours(12, 0, 0, 0); // 12:00 PM UTC period start
      
      // 1. Check if reset was already performed for this period (idempotency)
      const usersNeedingReset = await db.select({ id: users.id })
        .from(users)
        .where(sql`${users.lastResetAt} < ${periodStart.toISOString()} OR ${users.lastResetAt} IS NULL`)
        .limit(1000); // Process in batches
      
      if (usersNeedingReset.length === 0) {
        console.log('🔄 Daily reset already completed for this period');
        return;
      }
      
      console.log(`🔄 Resetting ${usersNeedingReset.length} users for period ${currentDateString}`);
      
      // 2. Reset all users' daily counters and tracking fields
      await db.update(users)
        .set({ 
          adsWatchedToday: 0,
          channelVisited: false,
          appShared: false,
          linkShared: false,
          friendInvited: false,
          friendsInvited: 0,
          lastResetDate: currentDate,
          lastResetAt: periodStart,
          lastAdDate: currentDate 
        })
        .where(sql`${users.lastResetAt} < ${periodStart.toISOString()} OR ${users.lastResetAt} IS NULL`);
      
      // 3. Create daily task completion records for all task types for this period
      const taskTypes = ['channel_visit', 'share_link', 'invite_friend', 'ads_mini', 'ads_light', 'ads_medium', 'ads_hard'];
      const taskRewards = {
        'channel_visit': '0.000025',
        'share_link': '0.000025', 
        'invite_friend': '0.00005',
        'ads_mini': '0.000035', // 15 ads
        'ads_light': '0.000055', // 25 ads
        'ads_medium': '0.000095', // 45 ads
        'ads_hard': '0.000155' // 75 ads
      };
      const taskRequirements = {
        'channel_visit': 1,
        'share_link': 1,
        'invite_friend': 1,
        'ads_mini': 15,
        'ads_light': 25,
        'ads_medium': 45,
        'ads_hard': 75
      };
      
      for (const user of usersNeedingReset) {
        for (const taskType of taskTypes) {
          try {
            await db.insert(dailyTaskCompletions).values({
              userId: user.id,
              taskType,
              rewardAmount: taskRewards[taskType as keyof typeof taskRewards],
              progress: 0,
              required: taskRequirements[taskType as keyof typeof taskRequirements],
              completed: false,
              claimed: false,
              completionDate: currentDateString,
            }).onConflictDoNothing(); // Ignore if already exists
          } catch (error) {
            console.warn(`⚠️ Failed to create daily task ${taskType} for user ${user.id}:`, error);
          }
        }
      }
      
      // 4. Clean up old daily task completions (older than 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoString = weekAgo.toISOString().split('T')[0];
      
      await db.delete(dailyTaskCompletions)
        .where(sql`${dailyTaskCompletions.completionDate} < ${weekAgoString}`);
      
      console.log('✅ Daily reset completed successfully at 12:00 PM UTC');
      console.log(`   - Reset ${usersNeedingReset.length} users for period ${currentDateString}`);
      console.log('   - Reset ads watched today to 0');
      console.log('   - Reset channel visited, app shared, link shared, friend invited to false');
      console.log('   - Reset friends invited count to 0');
      console.log('   - Created daily task completion records');
      console.log('   - Cleaned up old task completions');
    } catch (error) {
      console.error('❌ Error during daily reset:', error);
    }
  }

  // Check if it's time for daily reset (12:00 PM UTC)
  async checkAndPerformDailyReset(): Promise<void> {
    const now = new Date();
    
    // Check if it's exactly 12:00 PM UTC (within 1 minute window)
    const isResetTime = now.getUTCHours() === 12 && now.getUTCMinutes() === 0;
    
    if (isResetTime) {
      await this.performDailyReset();
    }
  }

  // Simplified methods for the new schema - no complex tracking needed
  async updatePromotionCompletedCount(promotionId: string): Promise<void> {
    // No-op since we removed complex tracking
    return;
  }

  async updatePromotionMessageId(promotionId: string, messageId: string): Promise<void> {
    // Note: message_id field doesn't exist in promotions schema
    // This could be tracked separately if needed in the future
    console.log(`📌 Promotion ${promotionId} posted with message ID: ${messageId}`);
  }

  async deactivateCompletedPromotions(): Promise<void> {
    // No-op since we removed complex tracking  
    return;
  }

  // User balance operations
  async getUserBalance(userId: string): Promise<UserBalance | undefined> {
    try {
      const [balance] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
      return balance;
    } catch (error) {
      console.error('Error getting user balance:', error);
      return undefined;
    }
  }

  async createOrUpdateUserBalance(userId: string, balance?: string): Promise<UserBalance> {
    try {
      // Use upsert pattern with ON CONFLICT to handle race conditions
      const [result] = await db.insert(userBalances)
        .values({
          userId,
          balance: balance || '0',
        })
        .onConflictDoUpdate({
          target: userBalances.userId,
          set: {
            balance: balance ? balance : sql`${userBalances.balance}`,
            updatedAt: new Date()
          }
        })
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating/updating user balance:', error);
      // Fallback: try to get existing balance if upsert fails
      try {
        const existingBalance = await this.getUserBalance(userId);
        if (existingBalance) {
          return existingBalance;
        }
      } catch (fallbackError) {
        console.error('Fallback getUserBalance also failed:', fallbackError);
      }
      throw error;
    }
  }

  async deductBalance(userId: string, amount: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user is admin - admins have unlimited balance
      const user = await this.getUser(userId);
      const isAdmin = user?.telegram_id === process.env.TELEGRAM_ADMIN_ID;
      
      if (isAdmin) {
        console.log('🔑 Admin has unlimited balance - allowing deduction');
        return { success: true, message: 'Balance deducted successfully (admin unlimited)' };
      }

      let balance = await this.getUserBalance(userId);
      if (!balance) {
        // Create balance record with 0 if user not found
        balance = await this.createOrUpdateUserBalance(userId, '0');
      }

      const currentBalance = parseFloat(balance.balance || '0');
      const deductAmount = parseFloat(amount);

      if (currentBalance < deductAmount) {
        return { success: false, message: 'Insufficient balance' };
      }

      await db.update(userBalances)
        .set({
          balance: sql`${userBalances.balance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(userBalances.userId, userId));

      // Record transaction for balance deduction
      await this.addTransaction({
        userId,
        amount: `-${amount}`,
        type: 'deduction',
        source: 'task_creation',
        description: `Task creation cost deducted - fixed rate`,
        metadata: { 
          deductedAmount: amount,
          fixedCost: '0.01',
          reason: 'task_creation_fee'
        }
      });

      return { success: true, message: 'Balance deducted successfully' };
    } catch (error) {
      console.error('Error deducting balance:', error);
      return { success: false, message: 'Error deducting balance' };
    }
  }

  async addBalance(userId: string, amount: string): Promise<void> {
    try {
      // First ensure the user has a balance record
      let existingBalance = await this.getUserBalance(userId);
      if (!existingBalance) {
        // Create new balance record with the amount if user not found
        await this.createOrUpdateUserBalance(userId, amount);
      } else {
        // Add to existing balance
        await db.update(userBalances)
          .set({
            balance: sql`${userBalances.balance} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(userBalances.userId, userId));
      }
    } catch (error) {
      console.error('Error adding balance:', error);
      throw error;
    }
  }

  // Promotion claims methods
  async hasUserClaimedPromotion(promotionId: string, userId: string): Promise<boolean> {
    const [claim] = await db.select().from(promotionClaims)
      .where(and(
        eq(promotionClaims.promotionId, promotionId),
        eq(promotionClaims.userId, userId)
      ));
    return !!claim;
  }


  async incrementPromotionClaimedCount(promotionId: string): Promise<void> {
    await db.update(promotions)
      .set({
        claimedCount: sql`${promotions.claimedCount} + 1`,
      })
      .where(eq(promotions.id, promotionId));
  }

  // ===== NEW SIMPLE TASK SYSTEM =====
  
  // Fixed task configuration for the 9 sequential ads-based tasks
  private readonly TASK_CONFIG = [
    { level: 1, required: 10, reward: "0.00015000" },
    { level: 2, required: 12, reward: "0.00017000" },
    { level: 3, required: 13, reward: "0.00018000" },
    { level: 4, required: 15, reward: "0.00025000" },
    { level: 5, required: 18, reward: "0.00028000" },
    { level: 6, required: 20, reward: "0.00035000" },
    { level: 7, required: 25, reward: "0.00040000" },
    { level: 8, required: 28, reward: "0.00042000" },
    { level: 9, required: 30, reward: "0.00055000" },
  ];

  // Get current reset date in YYYY-MM-DD format (resets at 00:00 UTC)
  private getCurrentResetDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // Initialize or get daily tasks for a user
  async getUserDailyTasks(userId: string): Promise<DailyTask[]> {
    const resetDate = this.getCurrentResetDate();
    
    // Get existing tasks for today
    const existingTasks = await db
      .select()
      .from(dailyTasks)
      .where(and(
        eq(dailyTasks.userId, userId),
        eq(dailyTasks.resetDate, resetDate)
      ))
      .orderBy(dailyTasks.taskLevel);

    // If no tasks exist for today, create them
    if (existingTasks.length === 0) {
      const tasksToInsert: InsertDailyTask[] = this.TASK_CONFIG.map(config => ({
        userId,
        taskLevel: config.level,
        progress: 0,
        required: config.required,
        completed: false,
        claimed: false,
        rewardAmount: config.reward,
        resetDate,
      }));

      await db.insert(dailyTasks).values(tasksToInsert);
      
      // Fetch the newly created tasks
      return await db
        .select()
        .from(dailyTasks)
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.resetDate, resetDate)
        ))
        .orderBy(dailyTasks.taskLevel);
    }

    return existingTasks;
  }

  // Update task progress when user watches ads
  async updateTaskProgress(userId: string, adsWatchedToday: number): Promise<void> {
    const resetDate = this.getCurrentResetDate();
    
    // Get all tasks for today
    const tasks = await this.getUserDailyTasks(userId);
    
    // Update progress for each task and mark as completed if requirement is met
    for (const task of tasks) {
      const newProgress = Math.min(adsWatchedToday, task.required);
      const isCompleted = newProgress >= task.required;
      
      await db
        .update(dailyTasks)
        .set({
          progress: newProgress,
          completed: isCompleted,
          completedAt: isCompleted && !task.completed ? new Date() : task.completedAt,
          updatedAt: new Date(),
        })
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.taskLevel, task.taskLevel),
          eq(dailyTasks.resetDate, resetDate)
        ));
    }
  }

  // Claim a completed task reward
  async claimTaskReward(userId: string, taskLevel: number): Promise<{ success: boolean; message: string; rewardAmount?: string }> {
    const resetDate = this.getCurrentResetDate();
    
    // Get the specific task
    const [task] = await db
      .select()
      .from(dailyTasks)
      .where(and(
        eq(dailyTasks.userId, userId),
        eq(dailyTasks.taskLevel, taskLevel),
        eq(dailyTasks.resetDate, resetDate)
      ));

    if (!task) {
      return { success: false, message: "Task not found" };
    }

    if (!task.completed) {
      return { success: false, message: "Task not completed yet" };
    }

    if (task.claimed) {
      return { success: false, message: "Task already claimed" };
    }

    // Check if this is sequential (can only claim if previous tasks are claimed)
    if (taskLevel > 1) {
      const previousTask = await db
        .select()
        .from(dailyTasks)
        .where(and(
          eq(dailyTasks.userId, userId),
          eq(dailyTasks.taskLevel, taskLevel - 1),
          eq(dailyTasks.resetDate, resetDate)
        ));

      if (previousTask.length === 0 || !previousTask[0].claimed) {
        return { success: false, message: "Complete previous tasks first" };
      }
    }

    // Mark task as claimed
    await db
      .update(dailyTasks)
      .set({
        claimed: true,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(dailyTasks.userId, userId),
        eq(dailyTasks.taskLevel, taskLevel),
        eq(dailyTasks.resetDate, resetDate)
      ));

    // Add reward to user balance
    await this.addEarning({
      userId,
      amount: task.rewardAmount,
      source: 'task_completion',
      description: `Task ${taskLevel} completed: Watch ${task.required} ads`,
    });

    // Log transaction
    await this.logTransaction({
      userId,
      amount: task.rewardAmount,
      type: 'addition',
      source: 'task_completion',
      description: `Task ${taskLevel} reward`,
      metadata: { taskLevel, required: task.required, resetDate }
    });

    return {
      success: true,
      message: "Task reward claimed successfully",
      rewardAmount: task.rewardAmount
    };
  }

  // Get next available task (first unclaimed task)
  async getNextAvailableTask(userId: string): Promise<DailyTask | null> {
    const tasks = await this.getUserDailyTasks(userId);
    
    // Find the first unclaimed task
    for (const task of tasks) {
      if (!task.claimed) {
        return task;
      }
    }
    
    return null; // All tasks claimed
  }

  // New daily reset - runs at 00:00 UTC instead of 12:00 PM UTC
  async performDailyResetV2(): Promise<void> {
    try {
      console.log('🔄 Starting daily reset at 00:00 UTC (new task system)...');
      
      const currentDate = new Date();
      const currentDateString = currentDate.toISOString().split('T')[0];
      const resetTime = new Date(currentDate);
      resetTime.setUTCHours(0, 0, 0, 0); // 00:00 UTC reset
      
      // Check if today's reset has already been performed
      const usersNeedingReset = await db.select({ id: users.id })
        .from(users)
        .where(sql`${users.lastResetDate} != ${currentDateString} OR ${users.lastResetDate} IS NULL`)
        .limit(1000);
      
      if (usersNeedingReset.length === 0) {
        console.log('🔄 Daily reset already completed for today');
        return;
      }
      
      console.log(`🔄 Resetting ${usersNeedingReset.length} users for ${currentDateString}`);
      
      // Reset all users' daily counters
      await db.update(users)
        .set({ 
          adsWatchedToday: 0,
          lastResetDate: currentDate,
          updatedAt: new Date(),
        })
        .where(sql`${users.lastResetDate} != ${currentDateString} OR ${users.lastResetDate} IS NULL`);
      
      console.log('✅ Daily reset completed successfully (new task system)');
      
    } catch (error) {
      console.error('❌ Error in daily reset (new task system):', error);
      throw error;
    }
  }

  // Check and perform daily reset (called every 5 minutes)
  async checkAndPerformDailyResetV2(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      
      // Run reset at 00:00-00:05 UTC to catch the reset window
      if (currentHour === 0 && currentMinute < 5) {
        await this.performDailyResetV2();
      }
    } catch (error) {
      console.error('❌ Error checking daily reset:', error);
      // Don't throw to avoid disrupting the interval
    }
  }
}

export const storage = new DatabaseStorage();
