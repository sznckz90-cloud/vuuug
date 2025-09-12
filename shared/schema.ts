import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  decimal,
  bigint,
  integer,
  timestamp,
  serial,
  index,
  unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  telegramId: text("telegram_id").unique(),
  balance: decimal("balance", { precision: 20, scale: 10 }).default("0"),
  withdrawBalance: decimal("withdraw_balance", { precision: 20, scale: 10 }).default("0"),
  totalEarned: decimal("total_earned", { precision: 20, scale: 10 }).default("0"),
  adsWatched: integer("ads_watched").default(0),
  dailyAdsWatched: integer("daily_ads_watched").default(0),
  level: integer("level").default(1),
  banned: integer("banned").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Earnings table for tracking user earnings
export const earnings = pgTable("earnings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: text("amount").notNull(),
  source: text("source").notNull(), // 'ad', 'task', 'streak', 'exchange'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Global counters for atomic operations
export const counters = pgTable("counters", {
  id: text("id").primaryKey(),
  value: bigint("value", { mode: "bigint" }).notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market state for PADZ token pricing
export const marketState = pgTable("market_state", {
  id: integer("id").primaryKey().default(1), // Singleton table
  basePriceUsd: decimal("base_price_usd", { precision: 20, scale: 10 }).notNull().default("0.00000317"),
  currentPriceUsd: decimal("current_price_usd", { precision: 20, scale: 10 }).notNull().default("0.00000317"),
  lastMilestone: integer("last_milestone").notNull().default(0),
  tonPriceUsd: decimal("ton_price_usd", { precision: 20, scale: 10 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price history for charts
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  priceUsd: decimal("price_usd", { precision: 20, scale: 10 }).notNull(),
  totalAds: bigint("total_ads", { mode: "bigint" }).notNull(),
  reason: varchar("reason").notNull(), // 'milestone' | 'tick' | 'ton_update'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_price_history_created_at").on(table.createdAt),
]);

// Exchange transactions
export const exchanges = pgTable("exchanges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  padzAmount: text("padz_amount").notNull(),
  usdtAmount: text("usdt_amount").notNull(),
  exchangeRate: text("exchange_rate").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Withdrawals
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, completed, rejected
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema validations
export const insertUserSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  email: true,
  telegramId: true,
});

export const insertEarningSchema = createInsertSchema(earnings).pick({
  userId: true,
  amount: true,
  source: true,
  description: true,
});

export const insertExchangeSchema = createInsertSchema(exchanges).pick({
  userId: true,
  padzAmount: true,
  usdtAmount: true,
  exchangeRate: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).pick({
  userId: true,
  amount: true,
  walletAddress: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = z.infer<typeof insertEarningSchema>;
export type MarketState = typeof marketState.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;