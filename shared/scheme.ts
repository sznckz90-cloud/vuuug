import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  username: text("username").notNull(),
  personalCode: text("personal_code").notNull().unique(), // Match existing column
  withdrawBalance: decimal("withdraw_balance", { precision: 10, scale: 2 }).default("55"), // Match existing
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("55"), // Match existing
  adsWatched: integer("ads_watched").default(0),
  dailyAdsWatched: integer("daily_ads_watched").default(0),
  dailyEarnings: decimal("daily_earnings", { precision: 10, scale: 2 }).default("0"), // Match existing
  lastAdWatch: timestamp("last_ad_watch"),
  level: integer("level").default(1), // Match existing
  referredBy: varchar("referred_by"),
  flagged: boolean("flagged").default(false), // Match existing
  flagReason: text("flag_reason"), // Match existing
  banned: boolean("banned").default(false), // Match existing
  // Login tracking fields
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  lastLoginUserAgent: text("last_login_user_agent"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  email: text("email").notNull(), // Match existing
  name: text("name"), // User's full name
  telegramUsername: text("telegram_username"), // User's telegram username
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  walletAddress: text("wallet_address").notNull(), // Match existing column name
  method: text("method").default("lightning"), // Match existing
  status: text("status").default("pending"), // pending, completed, rejected
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  processedAt: timestamp("processed_at"),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).default("0"),
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const dailyStreaks = pgTable("daily_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastClaimDate: timestamp("last_claim_date"),
  streakMultiplier: decimal("streak_multiplier", { precision: 6, scale: 6 }).default("0"),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  filename: text("filename").notNull(), // File name on server
  duration: integer("duration").default(0), // Duration in seconds
  isActive: boolean("is_active").default(true), // Can be played
  uploadedBy: text("uploaded_by").notNull(), // Admin email who uploaded
  playCount: integer("play_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("main"),
  baseEarningsPerAd: decimal("base_earnings_per_ad", { precision: 10, scale: 2 }).default("0.25"),
  dailyAdLimit: integer("daily_ad_limit").default(250),
  minWithdrawal: decimal("min_withdrawal", { precision: 10, scale: 2 }).default("2500"),
  maxWithdrawal: decimal("max_withdrawal", { precision: 10, scale: 2 }).default("100000"), // Maximum withdrawal limit
  withdrawalCooldown: integer("withdrawal_cooldown").default(7), // Days between withdrawals
  minAdsForWithdrawal: integer("min_ads_for_withdrawal").default(500), // Minimum ads watched for withdrawal
  dailyStreakMultiplier: decimal("daily_streak_multiplier", { precision: 6, scale: 6 }).default("0.002"),
  newUserBonus: decimal("new_user_bonus", { precision: 10, scale: 2 }).default("55"),
  referralCommissionRate: decimal("referral_commission_rate", { precision: 5, scale: 4 }).default("0.10"),
  // Audio/Music Settings
  soundEnabled: boolean("sound_enabled").default(true),
  backgroundMusic: boolean("background_music").default(false),
  musicVolume: integer("music_volume").default(50), // 0-100
  soundEffects: boolean("sound_effects").default(true),
  currentSongId: varchar("current_song_id"), // Currently playing song
  autoPlay: boolean("auto_play").default(false), // Auto play next song
  shuffleMode: boolean("shuffle_mode").default(false),
  repeatMode: text("repeat_mode").default("off"), // off, one, all
  // System Stats
  totalUsers: integer("total_users").default(0),
  totalSatsPaidOut: decimal("total_sats_paid_out", { precision: 15, scale: 2 }).default("0"),
  totalAdsWatched: integer("total_ads_watched").default(0),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type DailyStreak = typeof dailyStreaks.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
