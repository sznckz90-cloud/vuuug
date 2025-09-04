import {
  users,
  earnings,
  withdrawals,
  referrals,
  type User,
  type UpsertUser,
  type InsertEarning,
  type Earning,
  type InsertWithdrawal,
  type Withdrawal,
  type Referral,
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
  updateWithdrawalStatus(withdrawalId: string, status: string, transactionHash?: string, adminNotes?: string): Promise<Withdrawal>;
  
  // Referral operations
  createReferral(referrerId: string, referredId: string): Promise<Referral>;
  getUserReferrals(userId: string): Promise<Referral[]>;
  
  // Generate referral code
  generateReferralCode(userId: string): Promise<string>;
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
          sql`${earnings.type} != 'withdrawal'`
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
          sql`${earnings.type} != 'withdrawal'`
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
          sql`${earnings.type} != 'withdrawal'`
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
          sql`${earnings.type} != 'withdrawal'`
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
        type: 'streak_bonus',
        description: `Daily streak bonus`,
        metadata: { streakDay: newStreak },
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
    
    // Deduct from user balance
    await db
      .update(users)
      .set({
        balance: sql`${users.balance} - ${withdrawal.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, withdrawal.userId));
    
    // Add withdrawal record to earnings (negative amount)
    await this.addEarning({
      userId: withdrawal.userId,
      amount: `-${withdrawal.amount}`,
      type: 'withdrawal',
      description: `Withdrawal via ${withdrawal.method}`,
      metadata: { withdrawalId: newWithdrawal.id },
    });
    
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

  async updateWithdrawalStatus(
    withdrawalId: string, 
    status: string, 
    transactionHash?: string, 
    adminNotes?: string
  ): Promise<Withdrawal> {
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
    
    return updatedWithdrawal;
  }

  async createReferral(referrerId: string, referredId: string): Promise<Referral> {
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
      type: 'referral',
      description: 'Referral bonus',
      metadata: { referredUserId: referredId },
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

  async generateReferralCode(userId: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await db
      .update(users)
      .set({
        referralCode: code,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    
    return code;
  }
}

export const storage = new DatabaseStorage();
