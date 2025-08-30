import { users, withdrawalRequests, referrals, dailyStreaks, appSettings, songs, type User, type InsertUser, type WithdrawalRequest, type InsertWithdrawalRequest, type Referral, type InsertReferral, type DailyStreak, type AppSettings, type Song, type InsertSong } from "@shared/scheme";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPersonalCode(code: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Withdrawal requests
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getWithdrawalRequests(userId?: string): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest>;
  
  // Referrals
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralsByUser(userId: string): Promise<Referral[]>;
  markReferralsAsClaimed(userId: string): Promise<void>;
  
  // Daily streaks
  getUserStreak(userId: string): Promise<DailyStreak | undefined>;
  updateStreak(userId: string, updates: Partial<DailyStreak>): Promise<DailyStreak>;
  
  // App settings
  getAppSettings(): Promise<AppSettings>;
  updateAppSettings(updates: Partial<AppSettings>): Promise<AppSettings>;
  
  // Song management
  getAllSongs(): Promise<Song[]>;
  getActiveSongs(): Promise<Song[]>;
  getSong(id: string): Promise<Song | undefined>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, updates: Partial<Song>): Promise<Song>;
  deleteSong(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPersonalCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.personalCode, code));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Skip streak initialization for now since table doesn't exist yet
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [withdrawal] = await db
      .insert(withdrawalRequests)
      .values(request)
      .returning();
    return withdrawal;
  }

  async getWithdrawalRequests(userId?: string): Promise<WithdrawalRequest[]> {
    if (userId) {
      return db.select().from(withdrawalRequests)
        .where(eq(withdrawalRequests.userId, userId))
        .orderBy(desc(withdrawalRequests.createdAt));
    }
    return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
  }

  async getWithdrawalRequestsWithUserInfo(): Promise<any[]> {
    const withdrawalsWithUserInfo = await db
      .select({
        // Withdrawal Request Info
        id: withdrawalRequests.id,
        userId: withdrawalRequests.userId,
        amount: withdrawalRequests.amount,
        walletAddress: withdrawalRequests.walletAddress,
        method: withdrawalRequests.method,
        status: withdrawalRequests.status,
        adminNotes: withdrawalRequests.adminNotes,
        createdAt: withdrawalRequests.createdAt,
        processedAt: withdrawalRequests.processedAt,
        email: withdrawalRequests.email,
        name: withdrawalRequests.name,
        telegramUsername: withdrawalRequests.telegramUsername,
        
        // User Basic Info
        userEmail: users.email,
        username: users.username,
        personalCode: users.personalCode,
        userCreatedAt: users.createdAt,
        withdrawBalance: users.withdrawBalance,
        totalEarnings: users.totalEarnings,
        adsWatched: users.adsWatched,
        level: users.level,
        banned: users.banned,
        
        // Login Info
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        lastLoginDevice: users.lastLoginDevice,
        lastLoginUserAgent: users.lastLoginUserAgent,
      })
      .from(withdrawalRequests)
      .leftJoin(users, eq(withdrawalRequests.userId, users.id))
      .orderBy(desc(withdrawalRequests.createdAt));
    
    return withdrawalsWithUserInfo;
  }

  async updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest> {
    const [withdrawal] = await db
      .update(withdrawalRequests)
      .set(updates)
      .where(eq(withdrawalRequests.id, id))
      .returning();
    return withdrawal;
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [ref] = await db
      .insert(referrals)
      .values(referral)
      .returning();
    return ref;
  }

  async getReferralsByUser(userId: string): Promise<Referral[]> {
    // Get referrals with user information
    const referralData = await db
      .select({
        id: referrals.id,
        referrerId: referrals.referrerId,
        refereeId: referrals.refereeId,
        commission: referrals.commission,
        claimed: referrals.claimed,
        createdAt: referrals.createdAt,
        refereeEmail: users.email,
        refereeUsername: users.username
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.refereeId, users.id))
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));
    
    return referralData as any;
  }

  async markReferralsAsClaimed(userId: string): Promise<void> {
    // Only mark unclaimed referrals as claimed
    await db
      .update(referrals)
      .set({ claimed: true, updatedAt: new Date() })
      .where(and(
        eq(referrals.referrerId, userId),
        eq(referrals.claimed, false)
      ));
  }

  async getUserStreak(userId: string): Promise<DailyStreak | undefined> {
    const [streak] = await db.select().from(dailyStreaks).where(eq(dailyStreaks.userId, userId));
    return streak || undefined;
  }

  async updateStreak(userId: string, updates: Partial<DailyStreak>): Promise<DailyStreak> {
    // Check if streak exists
    const existing = await this.getUserStreak(userId);
    
    if (!existing) {
      // Create new streak
      const [streak] = await db
        .insert(dailyStreaks)
        .values({ ...updates, userId, updatedAt: new Date() })
        .returning();
      return streak;
    } else {
      // Update existing streak
      const [streak] = await db
        .update(dailyStreaks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(dailyStreaks.userId, userId))
        .returning();
      return streak;
    }
  }

  async getAppSettings(): Promise<AppSettings> {
    let [settings] = await db.select().from(appSettings).where(eq(appSettings.id, "main"));
    
    // Create default settings if they don't exist
    if (!settings) {
      [settings] = await db
        .insert(appSettings)
        .values({ id: "main" })
        .returning();
    }
    
    return settings;
  }

  async updateAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    // First ensure settings record exists
    await this.getAppSettings();
    
    // Convert numeric strings to proper numbers
    const processedUpdates = { ...updates };
    if (processedUpdates.baseEarningsPerAd) {
      processedUpdates.baseEarningsPerAd = processedUpdates.baseEarningsPerAd.toString();
    }
    if (processedUpdates.minWithdrawal) {
      processedUpdates.minWithdrawal = processedUpdates.minWithdrawal.toString();
    }
    if (processedUpdates.maxWithdrawal) {
      processedUpdates.maxWithdrawal = processedUpdates.maxWithdrawal.toString();
    }
    if (processedUpdates.newUserBonus) {
      processedUpdates.newUserBonus = processedUpdates.newUserBonus.toString();
    }
    if (processedUpdates.referralCommissionRate) {
      processedUpdates.referralCommissionRate = processedUpdates.referralCommissionRate.toString();
    }
    if (processedUpdates.dailyStreakMultiplier) {
      processedUpdates.dailyStreakMultiplier = processedUpdates.dailyStreakMultiplier.toString();
    }
    
    const [settings] = await db
      .update(appSettings)
      .set({ ...processedUpdates, updatedAt: new Date() })
      .where(eq(appSettings.id, "main"))
      .returning();
    
    console.log('Database settings updated:', settings);
    return settings;
  }

  // Song management functions
  async getAllSongs(): Promise<Song[]> {
    return await db.select().from(songs).orderBy(desc(songs.createdAt));
  }

  async getActiveSongs(): Promise<Song[]> {
    return await db.select().from(songs).where(eq(songs.isActive, true)).orderBy(desc(songs.createdAt));
  }

  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song || undefined;
  }

  async createSong(insertSong: InsertSong): Promise<Song> {
    const [song] = await db
      .insert(songs)
      .values(insertSong)
      .returning();
    return song;
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    const [song] = await db
      .update(songs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(songs.id, id))
      .returning();
    return song;
  }

  async deleteSong(id: string): Promise<void> {
    await db.delete(songs).where(eq(songs.id, id));
  }
}

export const storage = new DatabaseStorage();