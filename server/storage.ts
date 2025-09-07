import {
  users,
  earnings,
  withdrawals,
  referrals,
  referralCommissions,
  promoCodes,
  promoCodeUsage,
  type User,
  type UpsertUser,
  type InsertEarning,
  type Earning,
  type InsertWithdrawal,
  type Withdrawal,
  type Referral,
  type ReferralCommission,
  type PromoCode,
  type InsertPromoCode,
  type PromoCodeUsage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

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
  
  // Promo code operations
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  updatePromoCodeStatus(id: string, isActive: boolean): Promise<PromoCode>;
  usePromoCode(code: string, userId: string): Promise<{ success: boolean; message: string; reward?: string }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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
    
    return { user, isNewUser };
  }

  // Earnings operations
  async addEarning(earning: InsertEarning): Promise<Earning> {
    const [newEarning] = await db
      .insert(earnings)
      .values(earning)
      .returning();
    
    // Update user totals
    await db
      .update(users)
      .set({
        balance: sql`${users.balance} + ${earning.amount}`,
        totalEarned: sql`${users.totalEarned} + ${earning.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, earning.userId));
    
    // Process referral commission (10% of user's earnings)
    // Only process commissions for non-referral earnings to avoid recursion
    if (earning.source !== 'referral_commission' && earning.source !== 'referral') {
      await this.processReferralCommission(earning.userId, newEarning.id, earning.amount);
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
    await db
      .update(users)
      .set({
        balance: sql`${users.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [newWithdrawal] = await db
      .insert(withdrawals)
      .values(withdrawal)
      .returning();
    
    // Only create withdrawal request - don't deduct balance yet
    // Balance will be deducted when admin marks as completed
    
    return newWithdrawal;
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    return db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }

  // Admin withdrawal operations
  async getAllPendingWithdrawals(): Promise<Withdrawal[]> {
    return db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.status, 'pending'))
      .orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return db
      .select()
      .from(withdrawals)
      .orderBy(desc(withdrawals.createdAt));
  }

  async updateWithdrawalStatus(
    withdrawalId: string, 
    status: string, 
    transactionHash?: string, 
    adminNotes?: string
  ): Promise<Withdrawal> {
    // Get current withdrawal info
    const [currentWithdrawal] = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, withdrawalId));
    
    if (!currentWithdrawal) {
      throw new Error('Withdrawal not found');
    }
    
    // Update withdrawal status
    const [updatedWithdrawal] = await db
      .update(withdrawals)
      .set({
        status,
        transactionHash,
        adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId))
      .returning();
    
    // Handle balance changes based on status
    if (status === 'completed' && currentWithdrawal.status === 'pending') {
      // Deduct balance when payment is completed
      await db
        .update(users)
        .set({
          balance: sql`${users.balance} - ${currentWithdrawal.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, currentWithdrawal.userId));
      
      // Add withdrawal record to earnings (negative amount)
      await this.addEarning({
        userId: currentWithdrawal.userId,
        amount: `-${currentWithdrawal.amount}`,
        source: 'withdrawal',
        description: `Withdrawal via ${currentWithdrawal.method} - Completed`,
      });
    } else if (status === 'failed' && currentWithdrawal.status !== 'failed') {
      // Don't deduct balance for failed withdrawals - balance stays as is
      // Add a note to earnings for tracking
      await this.addEarning({
        userId: currentWithdrawal.userId,
        amount: `0`,
        source: 'withdrawal_failed',
        description: `Withdrawal via ${currentWithdrawal.method} - Failed`,
      });
    }
    
    return updatedWithdrawal;
  }

  async createReferral(referrerId: string, referredId: string): Promise<Referral> {
    // Prevent self-referrals
    if (referrerId === referredId) {
      throw new Error('Users cannot refer themselves');
    }
    
    // Check if referral already exists
    const existingReferral = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.referredId, referredId)
      ))
      .limit(1);
    
    if (existingReferral.length > 0) {
      throw new Error('Referral relationship already exists');
    }
    
    // Create the referral
    const [referral] = await db
      .insert(referrals)
      .values({
        referrerId,
        referredId,
        rewardAmount: "0.50",
        status: 'completed',
      })
      .returning();
    
    // Add referral bonus to referrer
    await this.addEarning({
      userId: referrerId,
      amount: "0.50",
      source: 'referral',
      description: 'Referral bonus',
    });
    
    return referral;
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

  async generateReferralCode(userId: string): Promise<string> {
    // First check if user already has a referral code
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (user && user.referralCode) {
      return user.referralCode;
    }
    
    // Generate a referral code using user's username or Telegram ID for better tracking
    let code = user?.username || userId;
    
    // If it's too long, truncate and add random suffix
    if (code.length > 8) {
      code = code.substring(0, 5) + Math.random().toString(36).substring(2, 5).toUpperCase();
    }
    
    // Make sure it's uppercase
    code = code.toUpperCase();
    
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
      // Find who referred this user
      const [referralInfo] = await db
        .select({ referrerId: referrals.referrerId })
        .from(referrals)
        .where(eq(referrals.referredId, userId))
        .limit(1);

      if (!referralInfo) {
        // User was not referred by anyone, no commission to process
        return;
      }

      // Calculate 10% commission
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
        description: `10% commission from referred user`,
      });

      console.log(`✅ Referral commission of ${commissionAmount} awarded to ${referralInfo.referrerId} from ${userId}'s earnings`);
    } catch (error) {
      console.error('Error processing referral commission:', error);
      // Don't throw error to avoid disrupting the main earning process
    }
  }
}

export const storage = new DatabaseStorage();
