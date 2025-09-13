import {
  users,
  earnings,
  referrals,
  referralCommissions,
  promoCodes,
  promoCodeUsage,
  withdrawals,
  promotions,
  promotionClaims,
  taskCompletions,
  userBalances,
  type User,
  type UpsertUser,
  type InsertEarning,
  type Earning,
  type Referral,
  type ReferralCommission,
  type PromoCode,
  type InsertPromoCode,
  type PromoCodeUsage,
  type Withdrawal,
  type InsertWithdrawal,
  type Promotion,
  type InsertPromotion,
  type PromotionClaim,
  type InsertPromotionClaim,
  type TaskCompletion,
  type InsertTaskCompletion,
  type UserBalance,
  type InsertUserBalance,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
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
  
  // Promo code operations
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  updatePromoCodeStatus(id: string, isActive: boolean): Promise<PromoCode>;
  usePromoCode(code: string, userId: string): Promise<{ success: boolean; message: string; reward?: string }>;
  
  // Task/Promotion operations
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  getAllActivePromotions(): Promise<Promotion[]>;
  getPromotion(id: string): Promise<Promotion | undefined>;
  completeTask(promotionId: string, userId: string, rewardAmount: string): Promise<{ success: boolean; message: string }>;
  hasUserCompletedTask(promotionId: string, userId: string): Promise<boolean>;
  updatePromotionCompletedCount(promotionId: string): Promise<void>;
  deactivateCompletedPromotions(): Promise<void>;
  
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

  // Earnings operations
  async addEarning(earning: InsertEarning): Promise<Earning> {
    const [newEarning] = await db
      .insert(earnings)
      .values(earning)
      .returning();
    
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

  async updateUserStreak(userId: string): Promise<{ newStreak: number; rewardEarned: string }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error("User not found");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastStreakDate = user.lastStreakDate;
    let newStreak = 1;
    let rewardEarned = "0";

    if (lastStreakDate) {
      const lastDate = new Date(lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      
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
      rewardEarned = "0.0012"; // $0.0012 daily streak bonus
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

  async incrementAdsWatched(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) return;

    const lastAdDate = user.lastAdDate;
    let adsCount = 1;
    
    if (lastAdDate) {
      const lastDate = new Date(lastAdDate);
      lastDate.setHours(0, 0, 0, 0);
      
      if (today.getTime() === lastDate.getTime()) {
        adsCount = (user.adsWatchedToday || 0) + 1;
      }
    }

    await db
      .update(users)
      .set({
        adsWatchedToday: adsCount,
        adsWatched: sql`COALESCE(${users.adsWatched}, 0) + 1`, // Increment total ads watched
        lastAdDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastAdDate = user.lastAdDate;
    let currentCount = 0;
    
    if (lastAdDate) {
      const lastDate = new Date(lastAdDate);
      lastDate.setHours(0, 0, 0, 0);
      
      if (today.getTime() === lastDate.getTime()) {
        currentCount = user.adsWatchedToday || 0;
      }
    }
    
    return currentCount < 250; // Daily limit of 250 ads
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

  // New method to check and activate referral bonus when friend reaches 10 ads
  async checkAndActivateReferralBonus(userId: string): Promise<void> {
    try {
      // Count ads watched by this user
      const [adCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(earnings)
        .where(and(
          eq(earnings.userId, userId),
          eq(earnings.source, 'ad_watch')
        ));

      const adsWatched = adCount?.count || 0;
      
      // If user has watched 10+ ads, activate pending referral bonuses
      if (adsWatched >= 10) {
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

          // Award referral bonus to referrer
          await this.addEarning({
            userId: referral.referrerId,
            amount: "0.01",
            source: 'referral',
            description: `Referral bonus - friend watched ${adsWatched} ads`,
          });

          console.log(`✅ Referral bonus activated: $0.01 awarded to ${referral.referrerId}`);
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

      // Calculate 10% commission on ad earnings only
      const commissionAmount = (parseFloat(earningAmount) * 0.1).toFixed(8);
      
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
        description: `10% commission from referred user's ad earnings`,
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

  // Task/Promotion operations (new implementations)
  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [result] = await db.insert(promotions).values(promotion).returning();
    return result;
  }

  // Ensure default daily task exists for production deployment
  async ensureDailyTaskExists(): Promise<void> {
    try {
      const dailyTaskId = 'daily-check-update';
      
      // Check if daily task already exists
      const existingTask = await this.getPromotion(dailyTaskId);
      if (existingTask) {
        console.log('✅ Daily task already exists:', dailyTaskId);
        return;
      }

      // Get first available user to be the owner (needed for foreign key)
      const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
      if (!firstUser) {
        console.log('⚠️ No users found, skipping daily task creation');
        return;
      }

      // Create the daily task
      await db.insert(promotions).values({
        id: dailyTaskId,
        ownerId: firstUser.id,
        type: 'daily',
        url: 'https://t.me/PaidAdsNews',
        cost: '0',
        rewardPerUser: '0.00045',
        limit: 1000,
        claimedCount: 0,
        status: 'active',
        title: 'check update',
        description: 'Check our latest updates and news',
        reward: 1000,
        createdAt: new Date()
      });

      console.log('✅ Daily task created successfully:', dailyTaskId);
    } catch (error) {
      console.error('❌ Error ensuring daily task exists:', error);
      // Don't throw - server should still start even if daily task creation fails
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

  async getAllActivePromotions(): Promise<Promotion[]> {
    return db.select().from(promotions)
      .orderBy(desc(promotions.createdAt));
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async completeTask(promotionId: string, userId: string, rewardAmount: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if promotion exists
      const promotion = await this.getPromotion(promotionId);
      if (!promotion) {
        return { success: false, message: 'Promotion not found' };
      }

      // Check if user already completed this task
      const hasCompleted = await this.hasUserCompletedTask(promotionId, userId);
      if (hasCompleted) {
        return { success: false, message: 'You have already completed this task' };
      }

      // Record task completion
      await db.insert(taskCompletions).values({
        promotionId,
        userId,
        rewardAmount,
        verified: true,
      });

      // Add reward to user's earnings balance
      await this.addBalance(userId, rewardAmount);

      // Add earning record
      await this.addEarning({
        userId,
        amount: rewardAmount,
        source: 'task_completion',
        description: `Task completed: ${promotion.title}`,
      });

      // Send task completion notification to user via Telegram
      try {
        const { sendTaskCompletionNotification } = await import('./telegram');
        await sendTaskCompletionNotification(userId, rewardAmount);
      } catch (error) {
        console.error('Failed to send task completion notification:', error);
        // Don't fail the task completion if notification fails
      }

      return { success: true, message: 'Task completed successfully' };
    } catch (error) {
      console.error('Error completing task:', error);
      return { success: false, message: 'Error completing task' };
    }
  }

  async hasUserCompletedTask(promotionId: string, userId: string): Promise<boolean> {
    const [completion] = await db.select().from(taskCompletions)
      .where(and(
        eq(taskCompletions.promotionId, promotionId),
        eq(taskCompletions.userId, userId)
      ));
    return !!completion;
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

  async createPromotionClaim(claim: InsertPromotionClaim): Promise<PromotionClaim> {
    const [result] = await db.insert(promotionClaims).values(claim).returning();
    return result;
  }

  async incrementPromotionClaimedCount(promotionId: string): Promise<void> {
    await db.update(promotions)
      .set({
        claimedCount: sql`${promotions.claimedCount} + 1`,
      })
      .where(eq(promotions.id, promotionId));
  }
}

export const storage = new DatabaseStorage();
