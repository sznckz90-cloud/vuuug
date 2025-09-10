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
  referralCode: text("referral_code").notNull(),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  banned: boolean("banned").default(false),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  lastLoginUserAgent: text("last_login_user_agent"),
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

// Promotions/Tasks table - Simplified structure
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // Keep existing ID structure for safety
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  reward: integer("reward").notNull().default(0),
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

// User balances table for main balance tracking (for creating promotions)
export const userBalances = pgTable("user_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  mainBalance: decimal("main_balance", { precision: 12, scale: 8 }).default("0"), // For creating promotions
  earningsBalance: decimal("earnings_balance", { precision: 12, scale: 8 }).default("0"), // From completing tasks
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEarningSchema = createInsertSchema(earnings).omit({ createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, usageCount: true, createdAt: true, updatedAt: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true });
export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({ id: true, completedAt: true });
export const insertUserBalanceSchema = createInsertSchema(userBalances).omit({ id: true, createdAt: true, updatedAt: true });

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
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;
export type UserBalance = typeof userBalances.$inferSelect;
export type InsertUserBalance = z.infer<typeof insertUserBalanceSchema>;