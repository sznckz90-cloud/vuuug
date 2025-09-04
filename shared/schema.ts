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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email"),
  username: text("username"),
  personalCode: text("personal_code"),
  withdrawBalance: decimal("withdraw_balance", { precision: 10, scale: 8 }),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 8 }),
  adsWatched: integer("ads_watched"),
  dailyAdsWatched: integer("daily_ads_watched"),
  dailyEarnings: decimal("daily_earnings", { precision: 10, scale: 8 }),
  lastAdWatch: timestamp("last_ad_watch"),
  level: integer("level"),
  referredBy: varchar("referred_by"),
  flagged: boolean("flagged"),
  flagReason: text("flag_reason"),
  banned: boolean("banned"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  lastLoginUserAgent: text("last_login_user_agent"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// Earnings history table
export const earnings = pgTable("earnings", {
  id: integer("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
  source: varchar("source").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Withdrawals table
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default('pending'), // 'pending', 'processing', 'completed', 'failed'
  method: varchar("method").notNull(), // 'usdt_polygon', 'litecoin'
  details: jsonb("details"), // Store withdrawal method specific details
  transactionHash: varchar("transaction_hash"), // Blockchain transaction hash proof
  adminNotes: text("admin_notes"), // Admin notes for internal tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referrals table
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredId: varchar("referred_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 5 }).default('0.50'),
  status: varchar("status").default('pending'), // 'pending', 'completed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEarningSchema = createInsertSchema(earnings).omit({
  id: true,
  createdAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertEarning = z.infer<typeof insertEarningSchema>;
export type Earning = typeof earnings.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
