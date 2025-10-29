import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
  boolean,
  text,
  serial,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegram_id: varchar("telegram_id", { length: 20 }).unique(), // ✅ Telegram ID for authentication (stored as string for compatibility)
  username: varchar("username"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  personalCode: text("personal_code"),
  balance: decimal("balance", { precision: 12, scale: 8 }).default("0"),
  tonBalance: decimal("ton_balance", { precision: 12, scale: 8 }).default("0"),
  withdrawBalance: decimal("withdraw_balance", { precision: 12, scale: 8 }),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 8 }),
  totalEarned: decimal("total_earned", { precision: 12, scale: 8 }).default("0"),
  adsWatched: integer("ads_watched").default(0),
  dailyAdsWatched: integer("daily_ads_watched").default(0),
  adsWatchedToday: integer("ads_watched_today").default(0),
  dailyEarnings: decimal("daily_earnings", { precision: 12, scale: 8 }),
  lastAdWatch: timestamp("last_ad_watch"),
  lastAdDate: timestamp("last_ad_date"),
  currentStreak: integer("current_streak").default(0),
  lastStreakDate: timestamp("last_streak_date"),
  level: integer("level").default(1),
  referredBy: varchar("referred_by"),
  referralCode: text("referral_code"),
  friendsInvited: integer("friends_invited"),
  firstAdWatched: boolean("first_ad_watched").default(false),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  banned: boolean("banned").default(false),
  bannedReason: text("banned_reason"),
  bannedAt: timestamp("banned_at"),
  deviceId: text("device_id"),
  deviceFingerprint: jsonb("device_fingerprint"),
  isPrimaryAccount: boolean("is_primary_account").default(true),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  lastLoginUserAgent: text("last_login_user_agent"),
  // Daily task tracking fields for eligibility validation  
  channelVisited: boolean("channel_visited").default(false),
  appShared: boolean("app_shared").default(false),
  lastResetDate: timestamp("last_reset_date"),
  // Daily task completion tracking
  taskShareCompletedToday: boolean("task_share_completed_today").default(false),
  taskChannelCompletedToday: boolean("task_channel_completed_today").default(false),
  taskCommunityCompletedToday: boolean("task_community_completed_today").default(false),
  taskCheckinCompletedToday: boolean("task_checkin_completed_today").default(false),
  // Wallet details
  tonWalletAddress: text("ton_wallet_address"),
  tonWalletComment: text("ton_wallet_comment"),
  telegramUsername: text("telegram_username_wallet"),
  cwalletId: text("cwallet_id"),
  walletUpdatedAt: timestamp("wallet_updated_at"),
  pendingReferralBonus: decimal("pending_referral_bonus", { precision: 12, scale: 8 }).default("0"),
  totalClaimedReferralBonus: decimal("total_claimed_referral_bonus", { precision: 12, scale: 8 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Earnings table
export const earnings = pgTable("earnings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 8 }).notNull(),
  source: varchar("source").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions table - For tracking all balance changes (deductions and additions)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 8 }).notNull(),
  type: varchar("type").notNull(), // "deduction" or "addition"
  source: varchar("source").notNull(), // "task_creation", "task_completion", "withdrawal", "ad_reward", etc.
  description: text("description"),
  metadata: jsonb("metadata"), // Additional data like promotionId, taskType, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Withdrawals table
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 8 }).notNull(),
  status: varchar("status").default('pending'),
  method: varchar("method").notNull(),
  details: jsonb("details"),
  comment: text("comment"),
  transactionHash: varchar("transaction_hash"),
  adminNotes: text("admin_notes"),
  rejectionReason: text("rejection_reason"),
  deducted: boolean("deducted").default(false),
  refunded: boolean("refunded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referrals table
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 5 }).default("0.50"),
  status: varchar("status").default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Promo codes table
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 8 }).notNull(),
  rewardCurrency: varchar("reward_currency").default('USDT'),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  perUserLimit: integer("per_user_limit").default(1),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo code usage table
export const promoCodeUsage = pgTable("promo_code_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").references(() => promoCodes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 8 }).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// Referral commissions table
export const referralCommissions = pgTable("referral_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(),
  originalEarningId: integer("original_earning_id").references(() => earnings.id).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});


// User balances table - separate balance tracking  
export const userBalances = pgTable("user_balances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").unique().notNull().references(() => users.id),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Simple daily tasks system - fixed sequential ads-based tasks
export const dailyTasks = pgTable("daily_tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  taskLevel: integer("task_level").notNull(), // 1-9 for the 9 tasks
  progress: integer("progress").default(0), // current ads watched
  required: integer("required").notNull(), // ads required for this task
  completed: boolean("completed").default(false),
  claimed: boolean("claimed").default(false),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 8 }).notNull(),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  resetDate: varchar("reset_date").notNull(), // YYYY-MM-DD format for daily reset
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("daily_tasks_user_task_date_unique").on(table.userId, table.taskLevel, table.resetDate),
]);

// Admin settings table - for configurable app parameters
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by"), // Admin user ID who last updated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Advertiser tasks table
export const advertiserTasks = pgTable("advertiser_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advertiserId: varchar("advertiser_id").references(() => users.id).notNull(),
  taskType: varchar("task_type").notNull(), // "channel" or "bot"
  title: text("title").notNull(),
  link: text("link").notNull(),
  totalClicksRequired: integer("total_clicks_required").notNull(),
  currentClicks: integer("current_clicks").default(0).notNull(),
  costPerClick: decimal("cost_per_click", { precision: 12, scale: 8 }).default("0.0003").notNull(), // 0.0003 TON per click (500 clicks = 0.15 TON)
  totalCost: decimal("total_cost", { precision: 12, scale: 8 }).notNull(),
  status: varchar("status").default("active").notNull(), // active, completed, paused
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Task clicks tracking table - to prevent duplicate clicks
export const taskClicks = pgTable("task_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => advertiserTasks.id).notNull(),
  publisherId: varchar("publisher_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 8 }).default("0.0001750").notNull(), // 1750 PAD = 0.000175 TON
  clickedAt: timestamp("clicked_at").defaultNow(),
}, (table) => [
  unique("task_clicks_unique").on(table.taskId, table.publisherId),
]);


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEarningSchema = createInsertSchema(earnings).omit({ createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserBalanceSchema = createInsertSchema(userBalances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDailyTaskSchema = createInsertSchema(dailyTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export const insertReferralCommissionSchema = createInsertSchema(referralCommissions).omit({ id: true, createdAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoCodeUsageSchema = createInsertSchema(promoCodeUsage).omit({ id: true, usedAt: true });
export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdvertiserTaskSchema = createInsertSchema(advertiserTasks).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertTaskClickSchema = createInsertSchema(taskClicks).omit({ id: true, clickedAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertEarning = z.infer<typeof insertEarningSchema>;
export type Earning = typeof earnings.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type ReferralCommission = typeof referralCommissions.$inferSelect;
export type InsertReferralCommission = z.infer<typeof insertReferralCommissionSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCodeUsage = typeof promoCodeUsage.$inferSelect;
export type InsertPromoCodeUsage = z.infer<typeof insertPromoCodeUsageSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type UserBalance = typeof userBalances.$inferSelect;
export type InsertUserBalance = z.infer<typeof insertUserBalanceSchema>;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdvertiserTask = typeof advertiserTasks.$inferSelect;
export type InsertAdvertiserTask = z.infer<typeof insertAdvertiserTaskSchema>;
export type TaskClick = typeof taskClicks.$inferSelect;
export type InsertTaskClick = z.infer<typeof insertTaskClickSchema>;