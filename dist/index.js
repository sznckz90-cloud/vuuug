var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc3) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc3 = __getOwnPropDesc(from, key)) || desc3.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  earnings: () => earnings,
  insertEarningSchema: () => insertEarningSchema,
  insertPromoCodeSchema: () => insertPromoCodeSchema,
  insertUserSchema: () => insertUserSchema,
  insertWithdrawalSchema: () => insertWithdrawalSchema,
  promoCodeUsage: () => promoCodeUsage,
  promoCodes: () => promoCodes,
  referrals: () => referrals,
  sessions: () => sessions,
  users: () => users,
  withdrawals: () => withdrawals
});
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
  boolean,
  text
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var sessions, users, earnings, withdrawals, referrals, insertUserSchema, insertEarningSchema, insertWithdrawalSchema, promoCodes, promoCodeUsage, insertPromoCodeSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    sessions = pgTable(
      "sessions",
      {
        sid: varchar("sid").primaryKey(),
        sess: jsonb("sess").notNull(),
        expire: timestamp("expire").notNull()
      },
      (table) => [index("IDX_session_expire").on(table.expire)]
    );
    users = pgTable("users", {
      id: varchar("id").primaryKey(),
      email: text("email"),
      firstName: text("first_name"),
      lastName: text("last_name"),
      profileImageUrl: text("profile_image_url"),
      username: text("username"),
      personalCode: text("personal_code"),
      balance: decimal("balance", { precision: 10, scale: 8 }).default("0"),
      withdrawBalance: decimal("withdraw_balance", { precision: 10, scale: 8 }),
      totalEarnings: decimal("total_earnings", { precision: 10, scale: 8 }),
      totalEarned: decimal("total_earned", { precision: 10, scale: 8 }).default("0"),
      adsWatched: integer("ads_watched").default(0),
      dailyAdsWatched: integer("daily_ads_watched").default(0),
      adsWatchedToday: integer("ads_watched_today").default(0),
      dailyEarnings: decimal("daily_earnings", { precision: 10, scale: 8 }),
      lastAdWatch: timestamp("last_ad_watch"),
      lastAdDate: timestamp("last_ad_date"),
      currentStreak: integer("current_streak").default(0),
      lastStreakDate: timestamp("last_streak_date"),
      level: integer("level").default(1),
      referredBy: varchar("referred_by"),
      referralCode: text("referral_code"),
      flagged: boolean("flagged").default(false),
      flagReason: text("flag_reason"),
      banned: boolean("banned").default(false),
      lastLoginAt: timestamp("last_login_at"),
      lastLoginIp: text("last_login_ip"),
      lastLoginDevice: text("last_login_device"),
      lastLoginUserAgent: text("last_login_user_agent"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    earnings = pgTable("earnings", {
      id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
      source: varchar("source").notNull(),
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow()
    });
    withdrawals = pgTable("withdrawals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      status: varchar("status").default("pending"),
      // 'pending', 'processing', 'completed', 'failed'
      method: varchar("method").notNull(),
      // 'usdt_polygon', 'litecoin'
      details: jsonb("details"),
      // Store withdrawal method specific details
      transactionHash: varchar("transaction_hash"),
      // Blockchain transaction hash proof
      adminNotes: text("admin_notes"),
      // Admin notes for internal tracking
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    referrals = pgTable("referrals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      referrerId: varchar("referrer_id").references(() => users.id).notNull(),
      referredId: varchar("referred_id").references(() => users.id).notNull(),
      rewardAmount: decimal("reward_amount", { precision: 10, scale: 5 }).default("0.50"),
      status: varchar("status").default("pending"),
      // 'pending', 'completed'
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertEarningSchema = createInsertSchema(earnings).omit({
      createdAt: true
    });
    insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    promoCodes = pgTable("promo_codes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      code: varchar("code").unique().notNull(),
      rewardAmount: decimal("reward_amount", { precision: 10, scale: 8 }).notNull(),
      rewardCurrency: varchar("reward_currency").default("USDT"),
      // 'USDT', 'BTC', 'ETH'
      usageLimit: integer("usage_limit"),
      // null for unlimited
      usageCount: integer("usage_count").default(0),
      perUserLimit: integer("per_user_limit").default(1),
      // How many times each user can use it
      isActive: boolean("is_active").default(true),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    promoCodeUsage = pgTable("promo_code_usage", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      promoCodeId: varchar("promo_code_id").references(() => promoCodes.id).notNull(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      rewardAmount: decimal("reward_amount", { precision: 10, scale: 8 }).notNull(),
      usedAt: timestamp("used_at").defaultNow()
    });
    insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
      id: true,
      usageCount: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
var Pool, pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    ({ Pool } = pkg);
    if (!process.env.DATABASE_URL) {
      console.warn("\u26A0\uFE0F  DATABASE_URL not set - using temporary in-memory fallback");
      process.env.DATABASE_URL = "postgresql://temp:temp@localhost:5432/temp";
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/storage.ts
import { eq, desc, and, gte, sql as sql2 } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    DatabaseStorage = class {
      // User operations (mandatory for Replit Auth)
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      }
      async upsertUser(userData) {
        const existingUser = await this.getUser(userData.id);
        const isNewUser = !existingUser;
        const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: /* @__PURE__ */ new Date()
          }
        }).returning();
        if (isNewUser && !user.referralCode) {
          try {
            await this.generateReferralCode(user.id);
          } catch (error) {
            console.error("Failed to generate referral code for new user:", error);
          }
        }
        return { user, isNewUser };
      }
      // Earnings operations
      async addEarning(earning) {
        const [newEarning] = await db.insert(earnings).values(earning).returning();
        await db.update(users).set({
          balance: sql2`${users.balance} + ${earning.amount}`,
          totalEarned: sql2`${users.totalEarned} + ${earning.amount}`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, earning.userId));
        return newEarning;
      }
      async getUserEarnings(userId, limit = 20) {
        return db.select().from(earnings).where(eq(earnings.userId, userId)).orderBy(desc(earnings.createdAt)).limit(limit);
      }
      async getUserStats(userId) {
        const now = /* @__PURE__ */ new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        const [todayResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            gte(earnings.createdAt, today),
            sql2`${earnings.source} <> 'withdrawal'`
          )
        );
        const [weekResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            gte(earnings.createdAt, weekAgo),
            sql2`${earnings.source} <> 'withdrawal'`
          )
        );
        const [monthResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            gte(earnings.createdAt, monthAgo),
            sql2`${earnings.source} <> 'withdrawal'`
          )
        );
        const [totalResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            sql2`${earnings.source} <> 'withdrawal'`
          )
        );
        return {
          todayEarnings: todayResult.total,
          weekEarnings: weekResult.total,
          monthEarnings: monthResult.total,
          totalEarnings: totalResult.total
        };
      }
      async updateUserBalance(userId, amount) {
        await db.update(users).set({
          balance: sql2`${users.balance} + ${amount}`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
      }
      async updateUserStreak(userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user) {
          throw new Error("User not found");
        }
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const lastStreakDate = user.lastStreakDate;
        let newStreak = 1;
        let rewardEarned = "0";
        if (lastStreakDate) {
          const lastDate = new Date(lastStreakDate);
          lastDate.setHours(0, 0, 0, 0);
          const dayDiff = Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1e3));
          if (dayDiff === 1) {
            newStreak = (user.currentStreak || 0) + 1;
          } else if (dayDiff === 0) {
            newStreak = user.currentStreak || 1;
            return { newStreak, rewardEarned: "0" };
          }
        }
        if (newStreak > 0) {
          rewardEarned = "0.0012";
        }
        await db.update(users).set({
          currentStreak: newStreak,
          lastStreakDate: today,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
        if (parseFloat(rewardEarned) > 0) {
          await this.addEarning({
            userId,
            amount: rewardEarned,
            source: "streak_bonus",
            description: `Daily streak bonus`
          });
        }
        return { newStreak, rewardEarned };
      }
      async incrementAdsWatched(userId) {
        const today = /* @__PURE__ */ new Date();
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
        await db.update(users).set({
          adsWatchedToday: adsCount,
          lastAdDate: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
      }
      async resetDailyAdsCount(userId) {
        await db.update(users).set({
          adsWatchedToday: 0,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
      }
      async canWatchAd(userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user) return false;
        const today = /* @__PURE__ */ new Date();
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
        return currentCount < 250;
      }
      async createWithdrawal(withdrawal) {
        const [newWithdrawal] = await db.insert(withdrawals).values(withdrawal).returning();
        return newWithdrawal;
      }
      async getUserWithdrawals(userId) {
        return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
      }
      // Admin withdrawal operations
      async getAllPendingWithdrawals() {
        return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(desc(withdrawals.createdAt));
      }
      async getAllWithdrawals() {
        return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
      }
      async updateWithdrawalStatus(withdrawalId, status, transactionHash, adminNotes) {
        const [currentWithdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
        if (!currentWithdrawal) {
          throw new Error("Withdrawal not found");
        }
        const [updatedWithdrawal] = await db.update(withdrawals).set({
          status,
          transactionHash,
          adminNotes,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(withdrawals.id, withdrawalId)).returning();
        if (status === "completed" && currentWithdrawal.status === "pending") {
          await db.update(users).set({
            balance: sql2`${users.balance} - ${currentWithdrawal.amount}`,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(users.id, currentWithdrawal.userId));
          await this.addEarning({
            userId: currentWithdrawal.userId,
            amount: `-${currentWithdrawal.amount}`,
            source: "withdrawal",
            description: `Withdrawal via ${currentWithdrawal.method} - Completed`
          });
        } else if (status === "failed" && currentWithdrawal.status !== "failed") {
          await this.addEarning({
            userId: currentWithdrawal.userId,
            amount: `0`,
            source: "withdrawal_failed",
            description: `Withdrawal via ${currentWithdrawal.method} - Failed`
          });
        }
        return updatedWithdrawal;
      }
      async createReferral(referrerId, referredId) {
        const [referral] = await db.insert(referrals).values({
          referrerId,
          referredId,
          rewardAmount: "0.50",
          status: "completed"
        }).returning();
        await this.addEarning({
          userId: referrerId,
          amount: "0.50",
          source: "referral",
          description: "Referral bonus"
        });
        return referral;
      }
      async getUserReferrals(userId) {
        return db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
      }
      async getUserByReferralCode(referralCode) {
        const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
        return user || null;
      }
      // Helper method to ensure all users have referral codes
      async ensureAllUsersHaveReferralCodes() {
        const usersWithoutCodes = await db.select().from(users).where(sql2`${users.referralCode} IS NULL OR ${users.referralCode} = ''`);
        for (const user of usersWithoutCodes) {
          try {
            await this.generateReferralCode(user.id);
            console.log(`Generated referral code for user ${user.id}`);
          } catch (error) {
            console.error(`Failed to generate referral code for user ${user.id}:`, error);
          }
        }
      }
      async generateReferralCode(userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user && user.referralCode) {
          return user.referralCode;
        }
        let code = user?.username || userId;
        if (code.length > 8) {
          code = code.substring(0, 5) + Math.random().toString(36).substring(2, 5).toUpperCase();
        }
        code = code.toUpperCase();
        await db.update(users).set({
          referralCode: code,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
        return code;
      }
      // Admin operations
      async getAllUsers() {
        return db.select().from(users).orderBy(desc(users.createdAt));
      }
      async updateUserBanStatus(userId, banned) {
        await db.update(users).set({
          banned,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
      }
      // Promo code operations
      async createPromoCode(promoCodeData) {
        const [promoCode] = await db.insert(promoCodes).values(promoCodeData).returning();
        return promoCode;
      }
      async getAllPromoCodes() {
        return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
      }
      async getPromoCode(code) {
        const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));
        return promoCode;
      }
      async updatePromoCodeStatus(id, isActive) {
        const [promoCode] = await db.update(promoCodes).set({
          isActive,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(promoCodes.id, id)).returning();
        return promoCode;
      }
      async usePromoCode(code, userId) {
        const promoCode = await this.getPromoCode(code);
        if (!promoCode) {
          return { success: false, message: "Invalid promo code" };
        }
        if (!promoCode.isActive) {
          return { success: false, message: "Promo code is inactive" };
        }
        if (promoCode.expiresAt && /* @__PURE__ */ new Date() > new Date(promoCode.expiresAt)) {
          return { success: false, message: "Promo code has expired" };
        }
        if (promoCode.usageLimit && (promoCode.usageCount || 0) >= promoCode.usageLimit) {
          return { success: false, message: "Promo code usage limit reached" };
        }
        const userUsageCount = await db.select({ count: sql2`count(*)` }).from(promoCodeUsage).where(and(
          eq(promoCodeUsage.promoCodeId, promoCode.id),
          eq(promoCodeUsage.userId, userId)
        ));
        if (userUsageCount[0]?.count >= (promoCode.perUserLimit || 1)) {
          return { success: false, message: "You have reached the usage limit for this promo code" };
        }
        await db.insert(promoCodeUsage).values({
          promoCodeId: promoCode.id,
          userId,
          rewardAmount: promoCode.rewardAmount
        });
        await db.update(promoCodes).set({
          usageCount: sql2`${promoCodes.usageCount} + 1`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(promoCodes.id, promoCode.id));
        await this.addEarning({
          userId,
          amount: promoCode.rewardAmount,
          source: "promo_code",
          description: `Promo code reward: ${code}`
        });
        return {
          success: true,
          message: `Promo code redeemed! You earned ${promoCode.rewardAmount} ${promoCode.rewardCurrency}`,
          reward: `${promoCode.rewardAmount} ${promoCode.rewardCurrency}`
        };
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/telegram.ts
var telegram_exports = {};
__export(telegram_exports, {
  formatUserNotification: () => formatUserNotification,
  formatWelcomeMessage: () => formatWelcomeMessage,
  formatWithdrawalNotification: () => formatWithdrawalNotification,
  handleTelegramMessage: () => handleTelegramMessage,
  sendTelegramMessage: () => sendTelegramMessage,
  sendUserTelegramNotification: () => sendUserTelegramNotification,
  sendWelcomeMessage: () => sendWelcomeMessage,
  setupTelegramWebhook: () => setupTelegramWebhook
});
async function sendTelegramMessage(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_ID) {
    console.error("Telegram bot token or admin ID not configured");
    return false;
  }
  try {
    const telegramMessage = {
      chat_id: TELEGRAM_ADMIN_ID,
      text: message,
      parse_mode: "HTML"
    };
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(telegramMessage)
    });
    if (response.ok) {
      console.log("Telegram notification sent successfully");
      return true;
    } else {
      const errorData = await response.text();
      console.error("Failed to send Telegram notification:", errorData);
      return false;
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return false;
  }
}
function formatWithdrawalNotification(userId, amount, method, details, userName) {
  const displayName = userName || `User ${userId}`;
  const methodName = method === "usdt_polygon" ? "Tether (Polygon POS)" : "Litecoin (LTC)";
  let address = "";
  if (details.usdt_polygon) {
    address = details.usdt_polygon;
  } else if (details.litecoin) {
    address = details.litecoin;
  }
  const withdrawalAmount = parseFloat(amount);
  const commissionAmount = method === "usdt_polygon" ? 0.02 : 0.05;
  const netAmount = withdrawalAmount - commissionAmount;
  return `
\u{1F514} <b>New Withdrawal Request</b>

\u{1F464} <b>User:</b> ${displayName}
\u{1F194} <b>Telegram ID:</b> ${userId}
\u{1F4B0} <b>Withdrawal Amount:</b> $${amount}
\u{1F4B3} <b>Commission:</b> $${commissionAmount.toFixed(2)}
\u{1F3AF} <b>Send to User:</b> $${netAmount.toFixed(2)}
\u{1F3E6} <b>Method:</b> ${methodName}
\u{1F4CD} <b>Address:</b> <code>${address}</code>

\u23F0 <b>Time:</b> ${(/* @__PURE__ */ new Date()).toLocaleString()}

<i>\u26A0\uFE0F Send $${netAmount.toFixed(2)} to the address above (after commission deduction)</i>
  `.trim();
}
function formatUserNotification(amount, method, status, transactionHash) {
  const methodName = method === "usdt_polygon" ? "Tether (Polygon POS)" : "Litecoin (LTC)";
  const statusEmoji = {
    completed: "\u2705",
    failed: "\u274C",
    processing: "\u23F3"
  }[status] || "\u23F3";
  const statusText = {
    completed: "Completed",
    failed: "Failed",
    processing: "Processing"
  }[status] || "Processing";
  let message = `
${statusEmoji} <b>Withdrawal ${statusText}</b>

\u{1F4B0} <b>Amount:</b> $${amount}
\u{1F3E6} <b>Method:</b> ${methodName}
\u{1F4CA} <b>Status:</b> ${statusText}
\u23F0 <b>Updated:</b> ${(/* @__PURE__ */ new Date()).toLocaleString()}`;
  if (status === "completed" && transactionHash) {
    message += `
\u{1F517} <b>Transaction:</b> <code>${transactionHash}</code>`;
  }
  if (status === "completed") {
    message += `

\u{1F389} <i>Your payment has been sent successfully!</i>`;
  } else if (status === "failed") {
    message += `

\u{1F61E} <i>Payment failed. Please contact support.</i>`;
  } else {
    message += `

\u23F3 <i>Your withdrawal is being processed...</i>`;
  }
  return message.trim();
}
async function sendUserTelegramNotification(userId, message, replyMarkup) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("\u274C Telegram bot token not configured");
    return false;
  }
  try {
    console.log(`\u{1F4DE} Sending message to Telegram API for user ${userId}...`);
    const telegramMessage = {
      chat_id: userId,
      text: message,
      parse_mode: "HTML"
    };
    if (replyMarkup) {
      telegramMessage.reply_markup = replyMarkup;
    }
    console.log("\u{1F4E1} Request payload:", JSON.stringify(telegramMessage, null, 2));
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(telegramMessage)
    });
    console.log("\u{1F4CA} Telegram API response status:", response.status);
    if (response.ok) {
      const responseData = await response.json();
      console.log("\u2705 User notification sent successfully to", userId, responseData);
      return true;
    } else {
      const errorData = await response.text();
      console.error("\u274C Failed to send user notification:", errorData);
      return false;
    }
  } catch (error) {
    console.error("\u274C Error sending user notification:", error);
    return false;
  }
}
function formatWelcomeMessage() {
  const message = `\u{1F525} Welcome to the Future of Ad Earnings! \u{1F525}

\u{1F60F} Forget those trash apps giving you $0.1 after a month.
Here, every ad = real cash, fast payouts.

\u{1F680} Your time = Money. No excuses.
\u{1F4B8} Watch. Earn. Withdraw. Repeat.

\u{1F449} Ready to turn your screen-time into income? Let's go!`;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "\u{1F680} Start Earning",
          web_app: { url: "https://lighting-sats-app.onrender.com" }
          // Telegram Mini App
        }
      ],
      [
        {
          text: "\u{1F4E2} Stay Updated",
          url: "https://t.me/LightingSats"
        },
        {
          text: "\u{1F4AC} Need Help?",
          url: "https://t.me/szxzyz"
        }
      ]
    ]
  };
  return { message, inlineKeyboard };
}
async function sendWelcomeMessage(userId) {
  const { message, inlineKeyboard } = formatWelcomeMessage();
  return await sendUserTelegramNotification(userId, message, inlineKeyboard);
}
async function handleTelegramMessage(update) {
  try {
    console.log("\u{1F504} Processing Telegram update...");
    const message = update.message;
    if (!message || !message.text) {
      console.log("\u274C No message or text found in update");
      return false;
    }
    const chatId = message.chat.id.toString();
    const text2 = message.text.trim();
    const user = message.from;
    console.log(`\u{1F4DD} Received message: "${text2}" from user ${chatId}`);
    const { user: dbUser, isNewUser } = await storage.upsertUser({
      id: chatId,
      email: user.username ? `${user.username}@telegram.user` : `${chatId}@telegram.user`,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      personalCode: user.username || chatId,
      withdrawBalance: "0",
      totalEarnings: "0",
      adsWatched: 0,
      dailyAdsWatched: 0,
      dailyEarnings: "0",
      level: 1,
      flagged: false,
      banned: false
    });
    if (text2.startsWith("/start")) {
      console.log("\u{1F680} Processing /start command...");
      const referralCode = text2.split(" ")[1];
      if (isNewUser && referralCode && referralCode !== chatId) {
        try {
          const referrer = await storage.getUserByReferralCode(referralCode);
          if (referrer) {
            await storage.createReferral(referrer.id, chatId);
            console.log(`\u2705 Referral created: ${referrer.id} -> ${chatId}`);
          } else {
            console.log(`\u274C Invalid referral code: ${referralCode}`);
          }
        } catch (error) {
          console.log("Referral processing failed:", error);
        }
      }
      console.log("\u{1F4E4} Sending welcome message to:", chatId);
      const messageSent2 = await sendWelcomeMessage(chatId);
      console.log("\u{1F4E7} Welcome message sent successfully:", messageSent2);
      return true;
    }
    console.log("\u{1F4E4} Sending welcome message for any interaction to:", chatId);
    const messageSent = await sendWelcomeMessage(chatId);
    console.log("\u{1F4E7} Welcome message sent successfully:", messageSent);
    return true;
  } catch (error) {
    console.error("Error handling Telegram message:", error);
    return false;
  }
}
async function setupTelegramWebhook(webhookUrl) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("Telegram bot token not configured");
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"]
      })
    });
    if (response.ok) {
      console.log("Telegram webhook set successfully");
      return true;
    } else {
      const errorData = await response.text();
      console.error("Failed to set Telegram webhook:", errorData);
      return false;
    }
  } catch (error) {
    console.error("Error setting up Telegram webhook:", error);
    return false;
  }
}
var TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_ID;
var init_telegram = __esm({
  "server/telegram.ts"() {
    "use strict";
    init_storage();
    TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
  }
});

// fix-production-db.js
var fix_production_db_exports = {};
__export(fix_production_db_exports, {
  fixProductionDatabase: () => fixProductionDatabase
});
import { Pool as Pool2 } from "pg";
async function fixProductionDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error("\u274C DATABASE_URL not found. Make sure you have a database connected.");
    return;
  }
  const pool2 = new Pool2({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    console.log("\u{1F527} Fixing production database schema...");
    const methodCheck = await pool2.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'withdrawals' AND column_name = 'method'
    `);
    if (methodCheck.rows.length === 0) {
      await pool2.query(`ALTER TABLE withdrawals ADD COLUMN method VARCHAR DEFAULT 'usdt_polygon'`);
      console.log("\u2705 Added method column to withdrawals table");
    } else {
      console.log("\u2713 Method column already exists in withdrawals");
    }
    const detailsCheck = await pool2.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'withdrawals' AND column_name = 'details'
    `);
    if (detailsCheck.rows.length === 0) {
      await pool2.query(`ALTER TABLE withdrawals ADD COLUMN details JSONB`);
      console.log("\u2705 Added details column to withdrawals table");
    } else {
      console.log("\u2713 Details column already exists in withdrawals");
    }
    const referredCheck = await pool2.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'referred_id'
    `);
    if (referredCheck.rows.length === 0) {
      await pool2.query(`ALTER TABLE referrals ADD COLUMN referred_id VARCHAR REFERENCES users(id)`);
      console.log("\u2705 Added referred_id column to referrals table");
    } else {
      console.log("\u2713 Referred_id column already exists in referrals");
    }
    const rewardCheck = await pool2.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'reward_amount'
    `);
    if (rewardCheck.rows.length === 0) {
      await pool2.query(`ALTER TABLE referrals ADD COLUMN reward_amount DECIMAL(10, 5) DEFAULT 0.50`);
      console.log("\u2705 Added reward_amount column to referrals table");
    } else {
      console.log("\u2713 Reward_amount column already exists in referrals");
    }
    const statusCheck = await pool2.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'status'
    `);
    if (statusCheck.rows.length === 0) {
      await pool2.query(`ALTER TABLE referrals ADD COLUMN status VARCHAR DEFAULT 'pending'`);
      console.log("\u2705 Added status column to referrals table");
    } else {
      console.log("\u2713 Status column already exists in referrals");
    }
    console.log("\u{1F9EA} Testing database...");
    const withdrawalTest = await pool2.query("SELECT COUNT(*) FROM withdrawals");
    console.log(`\u2713 Withdrawals table: ${withdrawalTest.rows[0].count} records`);
    const referralTest = await pool2.query("SELECT COUNT(*) FROM referrals");
    console.log(`\u2713 Referrals table: ${referralTest.rows[0].count} records`);
    const userTest = await pool2.query("SELECT COUNT(*) FROM users");
    console.log(`\u2713 Users table: ${userTest.rows[0].count} records`);
    console.log("\u{1F389} Production database fixed successfully!");
    console.log("\u{1F680} Your app should now work perfectly!");
  } catch (error) {
    console.error("\u274C Error fixing database:", error.message);
  } finally {
    await pool2.end();
  }
}
var init_fix_production_db = __esm({
  "fix-production-db.js"() {
    "use strict";
    if (import.meta.url === `file://${process.argv[1]}`) {
      fixProductionDatabase();
    }
  }
});

// server/index.ts
import express2 from "express";

// server/routes.ts
init_storage();
init_schema();
init_db();
init_telegram();
import { createServer } from "http";
import { eq as eq2, sql as sql3 } from "drizzle-orm";
import crypto from "crypto";
var isAdmin = (telegramId) => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  if (!adminId) {
    console.warn("\u26A0\uFE0F TELEGRAM_ADMIN_ID not set - admin access disabled");
    return false;
  }
  return adminId.toString() === telegramId.toString();
};
var authenticateAdmin = async (req, res, next) => {
  try {
    const telegramData = req.headers["x-telegram-data"] || req.query.tgData;
    if (process.env.NODE_ENV === "development" && !telegramData) {
      console.log("\u{1F527} Development mode: Granting admin access to test user");
      req.user = {
        telegramUser: {
          id: "123456789",
          username: "testuser",
          first_name: "Test",
          last_name: "Admin"
        }
      };
      return next();
    }
    if (!telegramData) {
      return res.status(401).json({ message: "Admin access denied" });
    }
    const urlParams = new URLSearchParams(telegramData);
    const userString = urlParams.get("user");
    if (!userString) {
      return res.status(401).json({ message: "Invalid Telegram data" });
    }
    const telegramUser = JSON.parse(userString);
    if (!isAdmin(telegramUser.id.toString())) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.user = { telegramUser };
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};
var authenticateTelegram = async (req, res, next) => {
  try {
    const telegramData = req.headers["x-telegram-data"] || req.query.tgData;
    if (!telegramData) {
      if (process.env.NODE_ENV === "development") {
        console.log("\u{1F527} Development mode: Using test user authentication");
        const testUser = {
          id: "123456789",
          username: "testuser",
          first_name: "Test",
          last_name: "User"
        };
        const { user: upsertedUser, isNewUser } = await storage.upsertUser({
          id: testUser.id.toString(),
          email: `${testUser.username}@telegram.user`,
          firstName: testUser.first_name,
          lastName: testUser.last_name,
          username: testUser.username,
          personalCode: testUser.username || testUser.id.toString(),
          withdrawBalance: "0",
          totalEarnings: "0",
          adsWatched: 0,
          dailyAdsWatched: 0,
          dailyEarnings: "0",
          level: 1,
          flagged: false,
          banned: false
        });
        req.user = { telegramUser: testUser };
        return next();
      }
      return res.status(401).json({ message: "Telegram authentication required. Please access this app through Telegram." });
    }
    try {
      const urlParams = new URLSearchParams(telegramData);
      const userString = urlParams.get("user");
      if (!userString) {
        return res.status(401).json({ message: "Invalid Telegram data" });
      }
      const telegramUser = JSON.parse(userString);
      const { user: upsertedUser, isNewUser } = await storage.upsertUser({
        id: telegramUser.id.toString(),
        email: `${telegramUser.username || telegramUser.id}@telegram.user`,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        personalCode: telegramUser.username || telegramUser.id.toString(),
        withdrawBalance: "0",
        totalEarnings: "0",
        adsWatched: 0,
        dailyAdsWatched: 0,
        dailyEarnings: "0",
        level: 1,
        flagged: false,
        banned: false
      });
      if (isNewUser) {
        await sendWelcomeMessage(telegramUser.id.toString());
      }
      req.user = { telegramUser };
      next();
    } catch (parseError) {
      console.error("Failed to parse Telegram data:", parseError);
      return res.status(401).json({ message: "Invalid Telegram data format" });
    }
  } catch (error) {
    console.error("Telegram auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};
async function registerRoutes(app2) {
  console.log("\u{1F527} Registering API routes...");
  app2.get("/api/test", (req, res) => {
    console.log("\u2705 Test route called!");
    res.json({ status: "API routes working!", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/api/debug/db-schema", async (req, res) => {
    try {
      const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await pool2.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `);
      res.json({
        success: true,
        columns: result.rows,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Schema check failed:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  app2.get("/api/init-database", async (req, res) => {
    try {
      console.log("\u{1F527} Initializing database tables...");
      const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY,
          email VARCHAR NOT NULL UNIQUE,
          first_name VARCHAR NOT NULL,
          last_name VARCHAR NOT NULL,
          profile_image_url VARCHAR,
          balance DECIMAL(10,8) DEFAULT 0,
          total_earned DECIMAL(10,8) DEFAULT 0,
          ads_watched_today INTEGER DEFAULT 0,
          last_ad_date DATE,
          streak_count INTEGER DEFAULT 0,
          last_streak_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS earnings (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,8) NOT NULL,
          source VARCHAR NOT NULL,
          description VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS withdrawals (
          id VARCHAR PRIMARY KEY,
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10,8) NOT NULL,
          wallet_address VARCHAR NOT NULL,
          status VARCHAR DEFAULT 'pending',
          transaction_hash VARCHAR,
          admin_notes VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          referrer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          referred_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(referrer_id, referred_id)
        );
      `);
      console.log("\u2705 Database tables initialized successfully");
      res.json({
        success: true,
        message: "Database tables created successfully!",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Database initialization failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Failed to initialize database"
      });
    }
  });
  app2.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;
      console.log("\u{1F4E8} Received Telegram update:", JSON.stringify(update, null, 2));
      const handled = await handleTelegramMessage(update);
      console.log("\u2705 Message handled:", handled);
      if (handled) {
        res.status(200).json({ ok: true });
      } else {
        res.status(200).json({ ok: true, message: "No action taken" });
      }
    } catch (error) {
      console.error("\u274C Telegram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  function verifyTelegramWebAppData(initData, botToken) {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get("hash");
      if (!hash) {
        return { isValid: false };
      }
      urlParams.delete("hash");
      const sortedParams = Array.from(urlParams.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
      const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
      const expectedHash = crypto.createHmac("sha256", secretKey).update(sortedParams).digest("hex");
      const isValid = expectedHash === hash;
      if (isValid) {
        const userString = urlParams.get("user");
        if (userString) {
          try {
            const user = JSON.parse(userString);
            return { isValid: true, user };
          } catch (parseError) {
            console.error("Error parsing user data:", parseError);
            return { isValid: false };
          }
        }
      }
      return { isValid };
    } catch (error) {
      console.error("Error verifying Telegram data:", error);
      return { isValid: false };
    }
  }
  app2.post("/api/auth/telegram", async (req, res) => {
    try {
      const { initData } = req.body;
      if (!initData) {
        return res.status(400).json({ message: "Missing initData" });
      }
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ message: "Bot token not configured" });
      }
      const { isValid, user: telegramUser } = verifyTelegramWebAppData(initData, botToken);
      if (!isValid || !telegramUser) {
        return res.status(401).json({ message: "Invalid Telegram authentication data" });
      }
      const { user: upsertedUser, isNewUser } = await storage.upsertUser({
        id: telegramUser.id.toString(),
        email: `${telegramUser.username || telegramUser.id}@telegram.user`,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        personalCode: telegramUser.username || telegramUser.id.toString(),
        withdrawBalance: "0",
        totalEarnings: "0",
        adsWatched: 0,
        dailyAdsWatched: 0,
        dailyEarnings: "0",
        level: 1,
        flagged: false,
        banned: false
      });
      if (isNewUser) {
        try {
          await sendWelcomeMessage(telegramUser.id.toString());
        } catch (welcomeError) {
          console.error("Error sending welcome message:", welcomeError);
        }
      }
      res.json(upsertedUser);
    } catch (error) {
      console.error("Telegram authentication error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });
  app2.get("/api/auth/user", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.post("/api/ads/watch", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { adType } = req.body;
      const earning = await storage.addEarning({
        userId,
        amount: "0.00021",
        source: "ad_watch",
        description: "Watched advertisement"
      });
      await storage.incrementAdsWatched(userId);
      res.json({
        success: true,
        earning,
        message: "Ad reward added successfully"
      });
    } catch (error) {
      console.error("Error processing ad watch:", error);
      res.status(500).json({ message: "Failed to process ad reward" });
    }
  });
  app2.post("/api/streak/claim", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const result = await storage.updateUserStreak(userId);
      res.json({
        success: true,
        newStreak: result.newStreak,
        rewardEarned: result.rewardEarned,
        message: "Streak updated successfully"
      });
    } catch (error) {
      console.error("Error processing streak:", error);
      res.status(500).json({ message: "Failed to process streak" });
    }
  });
  app2.get("/api/user/stats", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });
  app2.get("/api/earnings", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const limit = parseInt(req.query.limit) || 20;
      const earnings2 = await storage.getUserEarnings(userId, limit);
      res.json(earnings2);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });
  app2.post("/api/withdrawals", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawalData = insertWithdrawalSchema.parse({
        ...req.body,
        userId
      });
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.balance || "0") < parseFloat(withdrawalData.amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      const withdrawal = await storage.createWithdrawal(withdrawalData);
      const userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || `User ${userId}`;
      const notificationMessage = formatWithdrawalNotification(
        userId,
        withdrawalData.amount,
        withdrawalData.method,
        withdrawalData.details,
        userName
      );
      if (notificationMessage) {
        sendTelegramMessage(notificationMessage).catch((error) => {
          console.error("Failed to send withdrawal notification:", error);
        });
      }
      res.json({
        success: true,
        withdrawal,
        message: "Withdrawal request created successfully"
      });
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });
  app2.get("/api/withdrawals", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawals2 = await storage.getUserWithdrawals(userId);
      res.json(withdrawals2);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });
  app2.get("/api/referrals", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const referrals2 = await storage.getUserReferrals(userId);
      res.json(referrals2);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });
  app2.post("/api/referrals/generate", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const code = await storage.generateReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });
  app2.post("/api/referrals/process", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { referralCode } = req.body;
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code required" });
      }
      const referrer = await db.select().from(users).where(eq2(users.referralCode, referralCode)).limit(1);
      if (!referrer[0]) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      const referral = await storage.createReferral(referrer[0].id, userId);
      res.json({
        success: true,
        referral,
        message: "Referral processed successfully"
      });
    } catch (error) {
      console.error("Error processing referral:", error);
      res.status(500).json({ message: "Failed to process referral" });
    }
  });
  app2.get("/api/admin/withdrawals", authenticateAdmin, async (req, res) => {
    try {
      const withdrawals2 = await storage.getAllWithdrawals();
      const withdrawalsWithUsers = await Promise.all(
        withdrawals2.map(async (withdrawal) => {
          const user = await storage.getUser(withdrawal.userId);
          return {
            ...withdrawal,
            user: user ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            } : null
          };
        })
      );
      res.json(withdrawalsWithUsers);
    } catch (error) {
      console.error("Error fetching admin withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });
  app2.post("/api/admin/withdrawals/:id/update", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, transactionHash, adminNotes } = req.body;
      if (!["pending", "processing", "completed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const withdrawal = await db.select().from(withdrawals).where(eq2(withdrawals.id, id)).limit(1);
      if (!withdrawal[0]) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      const user = await storage.getUser(withdrawal[0].userId);
      const updatedWithdrawal = await storage.updateWithdrawalStatus(
        id,
        status,
        transactionHash,
        adminNotes
      );
      if ((status === "completed" || status === "failed") && user) {
        const userNotification = formatUserNotification(
          withdrawal[0].amount,
          withdrawal[0].method,
          status,
          transactionHash
        );
        sendUserTelegramNotification(withdrawal[0].userId, userNotification).catch((error) => {
          console.error("Failed to send user notification:", error);
        });
      }
      res.json({
        success: true,
        withdrawal: updatedWithdrawal,
        message: "Withdrawal status updated successfully"
      });
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });
  app2.post("/api/telegram/setup-webhook", async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ message: "Webhook URL is required" });
      }
      const success = await setupTelegramWebhook(webhookUrl);
      if (success) {
        res.json({ success: true, message: "Webhook set up successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to set up webhook" });
      }
    } catch (error) {
      console.error("Setup webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/fix-production-db", async (req, res) => {
    try {
      const { fixProductionDatabase: fixProductionDatabase2 } = (init_fix_production_db(), __toCommonJS(fix_production_db_exports));
      console.log("\u{1F527} Running production database fix...");
      await fixProductionDatabase2();
      res.json({
        success: true,
        message: "Production database fixed successfully! Your app should work now.",
        instructions: "Try using your Telegram bot - it should now send messages properly!"
      });
    } catch (error) {
      console.error("Fix production DB error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Database fix failed. Check the logs for details."
      });
    }
  });
  app2.get("/api/telegram/auto-setup", async (req, res) => {
    try {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
      console.log("Setting up Telegram webhook:", webhookUrl);
      const success = await setupTelegramWebhook(webhookUrl);
      if (success) {
        res.json({
          success: true,
          message: "Webhook set up successfully",
          webhookUrl
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to set up webhook",
          webhookUrl
        });
      }
    } catch (error) {
      console.error("Auto-setup webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/telegram/test/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      console.log("\u{1F9EA} Testing bot with chat ID:", chatId);
      const { sendWelcomeMessage: sendWelcomeMessage2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
      const success = await sendWelcomeMessage2(chatId);
      res.json({
        success,
        message: success ? "Test message sent!" : "Failed to send test message",
        chatId
      });
    } catch (error) {
      console.error("Test endpoint error:", error);
      res.status(500).json({ error: "Test failed", details: error });
    }
  });
  app2.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
    try {
      const totalUsersCount = await db.select({ count: sql3`count(*)` }).from(users);
      const totalEarningsSum = await db.select({ total: sql3`COALESCE(SUM(${users.totalEarned}), '0')` }).from(users);
      const totalWithdrawalsSum = await db.select({ total: sql3`COALESCE(SUM(${withdrawals.amount}), '0')` }).from(withdrawals).where(eq2(withdrawals.status, "completed"));
      const pendingWithdrawalsCount = await db.select({ count: sql3`count(*)` }).from(withdrawals).where(eq2(withdrawals.status, "pending"));
      const dailyActiveCount = await db.select({ count: sql3`count(distinct ${earnings.userId})` }).from(earnings).where(sql3`DATE(${earnings.createdAt}) = CURRENT_DATE`);
      const totalAdsSum = await db.select({ total: sql3`COALESCE(SUM(${users.adsWatched}), 0)` }).from(users);
      res.json({
        totalUsers: totalUsersCount[0]?.count || 0,
        totalEarnings: totalEarningsSum[0]?.total || "0",
        totalWithdrawals: totalWithdrawalsSum[0]?.total || "0",
        pendingWithdrawals: pendingWithdrawalsCount[0]?.count || 0,
        dailyActiveUsers: dailyActiveCount[0]?.count || 0,
        totalAdsWatched: totalAdsSum[0]?.total || 0
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });
  app2.get("/api/admin/users", authenticateAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.post("/api/admin/users/:id/ban", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { banned } = req.body;
      await storage.updateUserBanStatus(id, banned);
      res.json({
        success: true,
        message: banned ? "User banned successfully" : "User unbanned successfully"
      });
    } catch (error) {
      console.error("Error updating user ban status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });
  app2.post("/api/admin/promo-codes", authenticateAdmin, async (req, res) => {
    try {
      const { code, rewardAmount, rewardCurrency, usageLimit, perUserLimit, expiresAt } = req.body;
      if (!code || !rewardAmount) {
        return res.status(400).json({ message: "Code and reward amount are required" });
      }
      const existingCode = await storage.getPromoCode(code);
      if (existingCode) {
        return res.status(400).json({ message: "Promo code already exists" });
      }
      const promoCode = await storage.createPromoCode({
        code: code.toUpperCase(),
        rewardAmount,
        rewardCurrency: rewardCurrency || "USDT",
        usageLimit,
        perUserLimit: perUserLimit || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
      res.json({
        success: true,
        promoCode,
        message: "Promo code created successfully"
      });
    } catch (error) {
      console.error("Error creating promo code:", error);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });
  app2.get("/api/admin/promo-codes", authenticateAdmin, async (req, res) => {
    try {
      const promoCodes2 = await storage.getAllPromoCodes();
      res.json(promoCodes2);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });
  app2.post("/api/admin/promo-codes/:id/toggle", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const promoCode = await storage.updatePromoCodeStatus(id, isActive);
      res.json({
        success: true,
        promoCode,
        message: `Promo code ${isActive ? "activated" : "deactivated"} successfully`
      });
    } catch (error) {
      console.error("Error updating promo code status:", error);
      res.status(500).json({ message: "Failed to update promo code status" });
    }
  });
  app2.post("/api/promo-codes/redeem", authenticateTelegram, async (req, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Promo code is required" });
      }
      const result = await storage.usePromoCode(code.toUpperCase(), userId);
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          reward: result.reward
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("Error redeeming promo code:", error);
      res.status(500).json({ message: "Failed to redeem promo code" });
    }
  });
  app2.post("/api/setup-database", async (req, res) => {
    try {
      const { setupKey } = req.body;
      if (setupKey !== "setup-database-schema-2024") {
        return res.status(403).json({ message: "Invalid setup key" });
      }
      console.log("\u{1F527} Setting up database schema...");
      const { execSync } = await import("child_process");
      try {
        execSync("npx drizzle-kit push --force", {
          stdio: "inherit",
          cwd: process.cwd()
        });
        await storage.ensureAllUsersHaveReferralCodes();
        console.log("\u2705 Database setup completed successfully");
        res.json({
          success: true,
          message: "Database schema setup completed successfully"
        });
      } catch (dbError) {
        console.error("Database setup error:", dbError);
        res.status(500).json({
          success: false,
          message: "Database setup failed",
          error: String(dbError)
        });
      }
    } catch (error) {
      console.error("Error setting up database:", error);
      res.status(500).json({ message: "Failed to setup database" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      // Only load Replit plugins in development
      await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()).catch(() => null),
      await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()).catch(() => null)
    ].filter(Boolean) : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    console.log("\u{1F4E8} Direct webhook called!", JSON.stringify(req.body, null, 2));
    const { handleTelegramMessage: handleTelegramMessage2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const handled = await handleTelegramMessage2(req.body);
    console.log("\u2705 Message handled:", handled);
    res.status(200).json({ ok: true, handled });
  } catch (error) {
    console.error("\u274C Direct webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/api/test-direct", (req, res) => {
  console.log("\u2705 Direct test route called!");
  res.json({ status: "Direct API route working!", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5e3;
  if (isNaN(port) || port <= 0 || port >= 65536) {
    console.error(`Invalid port: ${process.env.PORT}, using default 5000`);
    port = 5e3;
  }
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, async () => {
    log(`serving on port ${port}`);
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const { setupTelegramWebhook: setupTelegramWebhook2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
        const domain = process.env.REPLIT_DOMAIN || (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.app` : null) || "lighting-sats-app.onrender.com";
        const webhookUrl = `https://${domain}/api/telegram/webhook`;
        log(`Setting up Telegram webhook: ${webhookUrl}`);
        const success = await setupTelegramWebhook2(webhookUrl);
        if (success) {
          log("\u2705 Telegram webhook configured successfully");
        } else {
          log("\u274C Failed to configure Telegram webhook");
        }
      } catch (error) {
        log("\u274C Error setting up Telegram webhook:", String(error));
      }
    }
  });
})();
