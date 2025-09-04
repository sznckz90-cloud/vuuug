var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  earnings: () => earnings,
  insertEarningSchema: () => insertEarningSchema,
  insertUserSchema: () => insertUserSchema,
  insertWithdrawalSchema: () => insertWithdrawalSchema,
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
var sessions, users, earnings, withdrawals, referrals, insertUserSchema, insertEarningSchema, insertWithdrawalSchema;
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
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      email: varchar("email").unique(),
      firstName: varchar("first_name"),
      lastName: varchar("last_name"),
      profileImageUrl: varchar("profile_image_url"),
      balance: decimal("balance", { precision: 10, scale: 5 }).default("0"),
      totalEarned: decimal("total_earned", { precision: 10, scale: 5 }).default("0"),
      currentStreak: integer("current_streak").default(0),
      lastStreakDate: timestamp("last_streak_date"),
      adsWatchedToday: integer("ads_watched_today").default(0),
      lastAdDate: timestamp("last_ad_date"),
      referralCode: varchar("referral_code").unique(),
      referredBy: varchar("referred_by"),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    earnings = pgTable("earnings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      amount: decimal("amount", { precision: 10, scale: 5 }).notNull(),
      type: varchar("type").notNull(),
      // 'ad_watch', 'streak_bonus', 'referral', 'withdrawal'
      description: text("description"),
      metadata: jsonb("metadata"),
      // Store additional data like ad type, streak day, etc.
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
      id: true,
      createdAt: true
    });
    insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema: schema_exports });
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
            sql2`${earnings.type} != 'withdrawal'`
          )
        );
        const [weekResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            gte(earnings.createdAt, weekAgo),
            sql2`${earnings.type} != 'withdrawal'`
          )
        );
        const [monthResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            gte(earnings.createdAt, monthAgo),
            sql2`${earnings.type} != 'withdrawal'`
          )
        );
        const [totalResult] = await db.select({
          total: sql2`COALESCE(SUM(${earnings.amount}), 0)`
        }).from(earnings).where(
          and(
            eq(earnings.userId, userId),
            sql2`${earnings.type} != 'withdrawal'`
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
            type: "streak_bonus",
            description: `Daily streak bonus`,
            metadata: { streakDay: newStreak }
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
        await db.update(users).set({
          balance: sql2`${users.balance} - ${withdrawal.amount}`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, withdrawal.userId));
        await this.addEarning({
          userId: withdrawal.userId,
          amount: `-${withdrawal.amount}`,
          type: "withdrawal",
          description: `Withdrawal via ${withdrawal.method}`,
          metadata: { withdrawalId: newWithdrawal.id }
        });
        return newWithdrawal;
      }
      async getUserWithdrawals(userId) {
        return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
      }
      // Admin withdrawal operations
      async getAllPendingWithdrawals() {
        return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(desc(withdrawals.createdAt));
      }
      async updateWithdrawalStatus(withdrawalId, status, transactionHash, adminNotes) {
        const [updatedWithdrawal] = await db.update(withdrawals).set({
          status,
          transactionHash,
          adminNotes,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(withdrawals.id, withdrawalId)).returning();
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
          type: "referral",
          description: "Referral bonus",
          metadata: { referredUserId: referredId }
        });
        return referral;
      }
      async getUserReferrals(userId) {
        return db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
      }
      async generateReferralCode(userId) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await db.update(users).set({
          referralCode: code,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId));
        return code;
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
  const message = `\u{1F60F} Why waste time? Our app pays higher per Ad than anyone else!

\u{1F91D} Invite your friends & earn up to 10% extra from their ads!
\u26A1 Fast Earnings \u2013 3x more than other apps \u{1F5FF}

\u{1F6AE}Other apps Slow + $0.0001 peanuts \u{1F634}

\u23F3 Don't waste time, make it money\u2026
\u{1F449} Tap below & Get Paid Now!`;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "\u{1F680} Get Paid Now",
          url: "https://lighting-sats-app.onrender.com"
        }
      ],
      [
        {
          text: "\u{1F4E1} Project Vibes",
          url: "https://t.me/LightingSats"
        },
        {
          text: "\u{1F60E} Help Desk",
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
    if (text2.startsWith("/start")) {
      console.log("\u{1F680} Processing /start command...");
      const referralCode = text2.split(" ")[1];
      const { user: dbUser, isNewUser } = await storage.upsertUser({
        id: chatId,
        email: user.username ? `${user.username}@telegram.user` : null,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: null,
        referredBy: referralCode || null
      });
      console.log("\u{1F4E4} Sending welcome message to:", chatId);
      const messageSent = await sendWelcomeMessage(chatId);
      console.log("\u{1F4E7} Welcome message sent successfully:", messageSent);
      if (isNewUser && referralCode && referralCode !== chatId) {
        try {
          await storage.createReferral(referralCode, chatId);
        } catch (error) {
          console.log("Referral processing failed:", error);
        }
      }
      return true;
    }
    return false;
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

// server/index.ts
import express2 from "express";

// server/routes.ts
init_storage();
init_schema();
init_db();
init_telegram();
import { createServer } from "http";
import { eq as eq2 } from "drizzle-orm";
var isAdmin = (telegramId) => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  return adminId === telegramId;
};
var authenticateAdmin = async (req, res, next) => {
  try {
    const telegramData = req.headers["x-telegram-data"] || req.query.tgData;
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
      const mockUser = {
        id: "12345",
        first_name: "Demo",
        last_name: "User",
        username: "demo_user"
      };
      const { user: upsertedUser2, isNewUser: isNewUser2 } = await storage.upsertUser({
        id: mockUser.id,
        email: `${mockUser.username}@telegram.user`,
        firstName: mockUser.first_name,
        lastName: mockUser.last_name,
        profileImageUrl: null
      });
      if (isNewUser2) {
        await sendWelcomeMessage(mockUser.id.toString());
      }
      req.user = { telegramUser: mockUser };
      return next();
    }
    const urlParams = new URLSearchParams(telegramData);
    const userString = urlParams.get("user");
    if (!userString) {
      return res.status(401).json({ message: "Invalid Telegram data" });
    }
    const telegramUser = JSON.parse(userString);
    const { user: upsertedUser, isNewUser } = await storage.upsertUser({
      id: telegramUser.id.toString(),
      email: telegramUser.username ? `${telegramUser.username}@telegram.user` : null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      profileImageUrl: telegramUser.photo_url || null
    });
    if (isNewUser) {
      await sendWelcomeMessage(telegramUser.id.toString());
    }
    req.user = { telegramUser };
    next();
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
        type: "ad_watch",
        description: "Watched advertisement",
        metadata: { adType: adType || "rewarded" }
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
      const referrer = await storage.getUser(referralCode);
      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      const referral = await storage.createReferral(referrer.id, userId);
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
      const withdrawals2 = await storage.getAllPendingWithdrawals();
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
  app2.get("/admin", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>CashWatch Admin</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .withdrawal { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
            .pending { border-left: 4px solid #ffa500; }
            .completed { border-left: 4px solid #4CAF50; }
            .failed { border-left: 4px solid #f44336; }
            .processing { border-left: 4px solid #2196F3; }
            button { padding: 5px 10px; margin: 2px; cursor: pointer; }
            input { margin: 5px; padding: 5px; }
            .actions { margin-top: 10px; }
        </style>
    </head>
    <body>
        <h1>CashWatch Admin - Withdrawal Management</h1>
        <div id="withdrawals"></div>
        
        <script>
            const API_BASE = '/api/admin';
            
            async function loadWithdrawals() {
                try {
                    const response = await fetch(API_BASE + '/withdrawals');
                    const withdrawals = await response.json();
                    
                    const container = document.getElementById('withdrawals');
                    container.innerHTML = withdrawals.map(w => \`
                        <div class="withdrawal \${w.status}">
                            <h3>Withdrawal #\${w.id.substring(0, 8)}</h3>
                            <p><strong>User:</strong> \${w.user?.firstName || ''} \${w.user?.lastName || ''} (ID: \${w.userId})</p>
                            <p><strong>Amount:</strong> $\${w.amount}</p>
                            <p><strong>Method:</strong> \${w.method === 'usdt_polygon' ? 'Tether (Polygon POS)' : 'Litecoin (LTC)'}</p>
                            <p><strong>Address:</strong> \${JSON.stringify(w.details)}</p>
                            <p><strong>Status:</strong> \${w.status}</p>
                            <p><strong>Created:</strong> \${new Date(w.createdAt).toLocaleString()}</p>
                            \${w.transactionHash ? \`<p><strong>TX Hash:</strong> \${w.transactionHash}</p>\` : ''}
                            \${w.adminNotes ? \`<p><strong>Notes:</strong> \${w.adminNotes}</p>\` : ''}
                            
                            <div class="actions">
                                <select id="status-\${w.id}">
                                    <option value="pending" \${w.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="processing" \${w.status === 'processing' ? 'selected' : ''}>Processing</option>
                                    <option value="completed" \${w.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    <option value="failed" \${w.status === 'failed' ? 'selected' : ''}>Failed</option>
                                </select>
                                <input type="text" id="txhash-\${w.id}" placeholder="Transaction Hash" value="\${w.transactionHash || ''}">
                                <input type="text" id="notes-\${w.id}" placeholder="Admin Notes" value="\${w.adminNotes || ''}">
                                <button onclick="updateWithdrawal('\${w.id}')">Update</button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load withdrawals:', error);
                }
            }
            
            async function updateWithdrawal(id) {
                const status = document.getElementById(\`status-\${id}\`).value;
                const transactionHash = document.getElementById(\`txhash-\${id}\`).value;
                const adminNotes = document.getElementById(\`notes-\${id}\`).value;
                
                try {
                    const response = await fetch(\`\${API_BASE}/withdrawals/\${id}/update\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status, transactionHash, adminNotes })
                    });
                    
                    if (response.ok) {
                        alert('Withdrawal updated successfully!');
                        loadWithdrawals();
                    } else {
                        alert('Failed to update withdrawal');
                    }
                } catch (error) {
                    console.error('Update failed:', error);
                    alert('Update failed');
                }
            }
            
            // Load withdrawals on page load
            loadWithdrawals();
            
            // Refresh every 30 seconds
            setInterval(loadWithdrawals, 30000);
        </script>
    </body>
    </html>
    `);
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
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
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
  const port = parseInt(process.env.PORT || "5000", 10);
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
