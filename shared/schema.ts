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
  referralCode: text("referral_code").notNull().unique(),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  banned: boolean("banned").default(false),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  lastLoginUserAgent: text("last_login_user_agent"),
  // Daily task tracking fields for eligibility validation
  channelVisited: boolean("channel_visited").default(false),
  appShared: boolean("app_shared").default(false),
  linkShared: boolean("link_shared").default(false),
  friendInvited: boolean("friend_invited").default(false),
  friendsInvited: integer("friends_invited").default(0),
  lastResetDate: timestamp("last_reset_date"),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
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
  transactionHash: varchar("transaction_hash"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referrals table
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 5 }).default("0.01"),
  status: varchar("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueReferral: unique().on(table.referrerId, table.refereeId),
}));

// Referral commissions table
export const referralCommissions = pgTable("referral_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(),
  originalEarningId: integer("original_earning_id").references(() => earnings.id).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Promo codes table
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique().notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 2 }).notNull(),
  rewardCurrency: varchar("reward_currency").default("USDT"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  perUserLimit: integer("per_user_limit").default(1),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo code usage tracking
export const promoCodeUsage = pgTable("promo_code_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").references(() => promoCodes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 2 }).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// Promotions/Tasks table - Enhanced for Telegram bot promotion campaigns
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(), // User who created the promotion
  type: varchar("type").notNull(), // "channel", "bot", or "daily"
  url: text("url").notNull(), // Channel or bot link
  cost: decimal("cost", { precision: 12, scale: 8 }).notNull().default("0.01"), // Ad cost
  rewardPerUser: decimal("reward_per_user", { precision: 12, scale: 8 }).notNull().default("0.00025"), // Reward per completion
  limit: integer("limit").notNull().default(1000), // Max number of users who can claim
  claimedCount: integer("claimed_count").notNull().default(0), // Current number of claims
  status: varchar("status").notNull().default("active"), // "active", "paused", "completed", "deleted"
  isApproved: boolean("is_approved").notNull().default(false), // Admin approval required
  channelMessageId: varchar("channel_message_id"), // Telegram channel message ID for linking
  title: varchar("title", { length: 255 }),
  description: text("description"),
  reward: integer("reward").default(0), // Keep for backward compatibility
  createdAt: timestamp("created_at").defaultNow(),
});

// Task completions tracking
export const taskCompletions = pgTable("task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id").references(() => promotions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 8 }).notNull(),
  verified: boolean("verified").default(false),
  completedAt: timestamp("completed_at").defaultNow(),
}, (table) => ({
  uniqueTaskCompletion: unique().on(table.promotionId, table.userId),
}));

// Promotion claims tracking for user claim verification
export const promotionClaims = pgTable("promotion_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id").references(() => promotions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 8 }).notNull(),
  claimedAt: timestamp("claimed_at").defaultNow(),
}, (table) => ({
  uniqueClaim: unique().on(table.promotionId, table.userId),
}));

// Daily task completions tracking for tasks that reset daily
export const dailyTaskCompletions = pgTable("daily_task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id").references(() => promotions.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  taskType: varchar("task_type").notNull(), // 'channel_visit', 'share_link', 'invite_friend', 'ads_mini', 'ads_light', 'ads_medium', 'ads_hard'
  rewardAmount: decimal("reward_amount", { precision: 12, scale: 8 }).notNull(),
  progress: integer("progress").default(0),
  required: integer("required").default(1),
  completed: boolean("completed").default(false),
  claimed: boolean("claimed").default(false),
  completionDate: varchar("completion_date").notNull(), // Date in YYYY-MM-DD format
  completedAt: timestamp("completed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueDailyCompletion: unique().on(table.userId, table.taskType, table.completionDate),
}));

// User balances table - separate balance tracking  
export const userBalances = pgTable("user_balances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").unique().notNull().references(() => users.id),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task statuses table - tracks per-user task states (locked/claimable/claimed)
export const taskStatuses = pgTable("task_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  promotionId: varchar("promotion_id").references(() => promotions.id).notNull(),
  periodDate: varchar("period_date"), // Date in YYYY-MM-DD format for daily tasks, null for one-time
  status: varchar("status").notNull().default("locked"), // 'locked', 'claimable', 'claimed'
  progressCurrent: integer("progress_current").default(0),
  progressRequired: integer("progress_required").default(0),
  metadata: jsonb("metadata"), // Additional data like share message hash, channel username
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserTaskPeriod: unique().on(table.userId, table.promotionId, table.periodDate),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEarningSchema = createInsertSchema(earnings).omit({ createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, usageCount: true, createdAt: true, updatedAt: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true });
export const insertPromotionClaimSchema = createInsertSchema(promotionClaims).omit({ id: true, claimedAt: true });
export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({ id: true, completedAt: true });
export const insertDailyTaskCompletionSchema = createInsertSchema(dailyTaskCompletions).omit({ id: true, completedAt: true, updatedAt: true });
export const insertUserBalanceSchema = createInsertSchema(userBalances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskStatusSchema = createInsertSchema(taskStatuses).omit({ id: true, updatedAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertEarning = z.infer<typeof insertEarningSchema>;
export type Earning = typeof earnings.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type ReferralCommission = typeof referralCommissions.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCodeUsage = typeof promoCodeUsage.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type PromotionClaim = typeof promotionClaims.$inferSelect;
export type InsertPromotionClaim = z.infer<typeof insertPromotionClaimSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;
export type DailyTaskCompletion = typeof dailyTaskCompletions.$inferSelect;
export type InsertDailyTaskCompletion = z.infer<typeof insertDailyTaskCompletionSchema>;
export type UserBalance = typeof userBalances.$inferSelect;
export type InsertUserBalance = z.infer<typeof insertUserBalanceSchema>;
export type TaskStatus = typeof taskStatuses.$inferSelect;
export type InsertTaskStatus = z.infer<typeof insertTaskStatusSchema>;