var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  botStats: () => botStats,
  insertReferralSchema: () => insertReferralSchema,
  insertUserSchema: () => insertUserSchema,
  insertWithdrawalRequestSchema: () => insertWithdrawalRequestSchema,
  referrals: () => referrals,
  users: () => users,
  withdrawalRequests: () => withdrawalRequests
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").unique(),
  username: text("username").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  withdrawBalance: decimal("withdraw_balance", { precision: 10, scale: 5 }).default("0"),
  dailyEarnings: decimal("daily_earnings", { precision: 10, scale: 5 }).default("0"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 5 }).default("0"),
  adsWatched: integer("ads_watched").default(0),
  dailyAdsWatched: integer("daily_ads_watched").default(0),
  lastAdWatch: timestamp("last_ad_watch"),
  level: integer("level").default(1),
  referredBy: varchar("referred_by"),
  banned: boolean("banned").default(false),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 5 }).notNull(),
  status: text("status").default("pending"),
  // pending, approved, rejected
  telegramUsername: text("telegram_username"),
  walletAddress: text("wallet_address"),
  method: text("method").default("telegram"),
  // telegram, wallet
  createdAt: timestamp("created_at").default(sql`now()`),
  processedAt: timestamp("processed_at"),
  adminNotes: text("admin_notes")
});
var referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  commission: decimal("commission", { precision: 10, scale: 5 }).default("0"),
  createdAt: timestamp("created_at").default(sql`now()`)
});
var botStats = pgTable("bot_stats", {
  id: varchar("id").primaryKey().default("main"),
  totalUsers: integer("total_users").default(0),
  totalAdsWatched: integer("total_ads_watched").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 5 }).default("0"),
  totalWithdrawals: decimal("total_withdrawals", { precision: 10, scale: 5 }).default("0"),
  activeUsers24h: integer("active_users_24h").default(0),
  cpmRate: decimal("cpm_rate", { precision: 10, scale: 5 }).default("0.35"),
  // $0.35 per 1000 ads
  earningsPerAd: decimal("earnings_per_ad", { precision: 10, scale: 5 }).default("0.00035"),
  // $0.00035 per ad
  dailyAdLimit: integer("daily_ad_limit").default(250),
  // Max ads per day
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true
});
var insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  // Initialize default bot stats if they don't exist
  async ensureBotStats() {
    const [existingStats] = await db.select().from(botStats).where(eq(botStats.id, "main"));
    if (!existingStats) {
      await db.insert(botStats).values({
        id: "main",
        totalUsers: 0,
        totalAdsWatched: 0,
        totalEarnings: "0",
        totalWithdrawals: "0",
        activeUsers24h: 0,
        cpmRate: "0.35",
        earningsPerAd: "0.00035",
        dailyAdLimit: 250
      });
    }
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByTelegramId(telegramId) {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user || void 0;
  }
  async getUserByReferralCode(referralCode) {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    await this.ensureBotStats();
    await db.update(botStats).set({
      totalUsers: sql2`${botStats.totalUsers} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(botStats.id, "main"));
    return user;
  }
  async updateUser(id, updates) {
    const [updatedUser] = await db.update(users).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  async createWithdrawalRequest(insertRequest) {
    const [request] = await db.insert(withdrawalRequests).values(insertRequest).returning();
    return request;
  }
  async getWithdrawalRequest(id) {
    const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return request || void 0;
  }
  async getUserWithdrawalRequests(userId) {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId));
  }
  async updateWithdrawalRequest(id, updates) {
    const updateData = { ...updates };
    if (updates.status && updates.status !== "pending") {
      updateData.processedAt = /* @__PURE__ */ new Date();
    }
    const [updatedRequest] = await db.update(withdrawalRequests).set(updateData).where(eq(withdrawalRequests.id, id)).returning();
    if (!updatedRequest) {
      throw new Error("Withdrawal request not found");
    }
    return updatedRequest;
  }
  async getPendingWithdrawalRequests() {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.status, "pending"));
  }
  async createReferral(insertReferral) {
    const [referral] = await db.insert(referrals).values(insertReferral).returning();
    return referral;
  }
  async getUserReferrals(userId) {
    return await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  }
  async getBotStats() {
    await this.ensureBotStats();
    const [stats] = await db.select().from(botStats).where(eq(botStats.id, "main"));
    return stats;
  }
  async updateBotStats(updates) {
    await this.ensureBotStats();
    const [updatedStats] = await db.update(botStats).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(botStats.id, "main")).returning();
    return updatedStats;
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
function generateReferralCode() {
  return "LSATS" + Math.random().toString(36).substr(2, 6).toUpperCase();
}
async function registerRoutes(app2) {
  const checkAdminAccess = (req, res, next) => {
    const adminTelegramId = "6653616672";
    const telegramId = req.body?.telegramId || req.query?.telegramId;
    if (telegramId !== adminTelegramId) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
  const checkChannelMembership = async (telegramId) => {
    try {
      const channelId = "-1002480439556";
      console.log(`Checking channel membership for user ${telegramId} in ${channelId}`);
      return true;
    } catch (error) {
      console.error("Channel membership check failed:", error);
      return false;
    }
  };
  app2.post("/ads/callback", async (req, res) => {
    try {
      const { userId, status, reward } = req.body;
      console.log("Monetag callback received:", { userId, status, reward });
      if (status === "completed" && userId) {
        const user = await storage.getUser(userId);
        if (!user || user.banned) {
          return res.json({ success: false, error: "User not found or banned" });
        }
        const stats = await storage.getBotStats();
        const earnings = parseFloat(stats.earningsPerAd || "0.00035");
        await storage.updateUser(userId, {
          dailyEarnings: (parseFloat(user.dailyEarnings || "0") + earnings).toFixed(5),
          totalEarnings: (parseFloat(user.totalEarnings || "0") + earnings).toFixed(5),
          adsWatched: (user.adsWatched || 0) + 1,
          dailyAdsWatched: (user.dailyAdsWatched || 0) + 1,
          lastAdWatch: /* @__PURE__ */ new Date()
        });
        console.log(`Ad reward processed for user ${userId}: +$${earnings}`);
        return res.json({ success: true });
      }
      res.json({ success: false });
    } catch (error) {
      console.error("Monetag callback error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });
  app2.post("/api/user", async (req, res) => {
    try {
      const { telegramId, username, referralCode: referrerCode } = req.body;
      if (!telegramId || !username) {
        return res.status(400).json({ error: "Telegram ID and username required" });
      }
      let user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        const referralCode = generateReferralCode();
        let referredBy = null;
        if (referrerCode) {
          const referrer = await storage.getUserByReferralCode(referrerCode);
          if (referrer) {
            referredBy = referrer.id;
            console.log(`New user ${telegramId} referred by ${referrerCode}`);
          }
        }
        const userData = insertUserSchema.parse({
          telegramId,
          username,
          referralCode,
          referredBy
        });
        user = await storage.createUser(userData);
        if (referredBy) {
          await storage.createReferral({
            referrerId: referredBy,
            refereeId: user.id,
            commission: "0"
          });
          console.log(`Referral record created: ${referredBy} -> ${user.id}`);
        }
      }
      res.json(user);
    } catch (error) {
      console.error("Error in /api/user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/watch-ad", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.banned) {
        return res.status(403).json({ error: "Account has been banned" });
      }
      if (process.env.NODE_ENV === "production") {
        const isMember = await checkChannelMembership(user.telegramId || "");
        if (!isMember) {
          return res.status(403).json({
            error: "Channel membership required",
            channelUrl: "https://t.me/TesterMen"
          });
        }
      }
      const now = /* @__PURE__ */ new Date();
      if (user.lastAdWatch && now.getTime() - new Date(user.lastAdWatch).getTime() < 3e3) {
        return res.status(429).json({ error: "Cooldown active" });
      }
      const today = (/* @__PURE__ */ new Date()).toDateString();
      const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : "";
      let dailyAdsWatched = user.dailyAdsWatched || 0;
      if (lastAdToday !== today) {
        dailyAdsWatched = 0;
      }
      const stats = await storage.getBotStats();
      const dailyLimit = stats.dailyAdLimit || 250;
      if (dailyAdsWatched >= dailyLimit) {
        return res.status(429).json({ error: "Daily limit reached" });
      }
      const earnings = parseFloat(stats.earningsPerAd || "0.00035");
      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: (parseFloat(user.dailyEarnings || "0") + earnings).toFixed(5),
        totalEarnings: (parseFloat(user.totalEarnings || "0") + earnings).toFixed(5),
        adsWatched: (user.adsWatched || 0) + 1,
        dailyAdsWatched: dailyAdsWatched + 1,
        lastAdWatch: now
      });
      await storage.updateBotStats({
        totalAdsWatched: (stats.totalAdsWatched || 0) + 1,
        totalEarnings: (parseFloat(stats.totalEarnings || "0") + earnings).toFixed(5)
      });
      if (user.referredBy) {
        const referrer = await storage.getUser(user.referredBy);
        if (referrer) {
          const commission = earnings * 0.1;
          await storage.updateUser(referrer.id, {
            totalEarnings: (parseFloat(referrer.totalEarnings || "0") + commission).toFixed(5),
            dailyEarnings: (parseFloat(referrer.dailyEarnings || "0") + commission).toFixed(5)
          });
          const referrals2 = await storage.getUserReferrals(referrer.id);
          const referralRecord = referrals2.find((r) => r.refereeId === user.id);
          if (referralRecord) {
            const newCommission = parseFloat(referralRecord.commission || "0") + commission;
            console.log(`Referral commission: +$${commission.toFixed(5)} to ${referrer.telegramId || "unknown"}`);
          }
        }
      }
      res.json({
        success: true,
        earnings,
        user: updatedUser
      });
    } catch (error) {
      console.error("Error in /api/watch-ad:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/claim-earnings", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.banned) {
        return res.status(403).json({ error: "Account has been banned" });
      }
      if (parseFloat(user.dailyEarnings || "0") <= 0) {
        return res.status(400).json({ error: "No earnings to claim" });
      }
      const claimed = parseFloat(user.dailyEarnings || "0");
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + claimed).toFixed(5),
        dailyEarnings: "0"
      });
      res.json({
        success: true,
        claimed: claimed.toFixed(5),
        user: updatedUser
      });
    } catch (error) {
      console.error("Error in /api/claim-earnings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/withdrawal-request", async (req, res) => {
    try {
      const requestData = insertWithdrawalRequestSchema.parse(req.body);
      const user = await storage.getUser(requestData.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const requestAmount = parseFloat(requestData.amount);
      const userBalance = parseFloat(user.withdrawBalance || "0");
      const minWithdrawalUSD = 1;
      if (requestAmount < minWithdrawalUSD) {
        return res.status(400).json({ error: `Minimum withdrawal is $${minWithdrawalUSD.toFixed(2)}` });
      }
      if (requestAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      const withdrawalRequest = await storage.createWithdrawalRequest(requestData);
      res.json({
        success: true,
        request: withdrawalRequest
      });
    } catch (error) {
      console.error("Error in /api/withdrawal-request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/user/:userId/withdrawals", async (req, res) => {
    try {
      const { userId } = req.params;
      const requests = await storage.getUserWithdrawalRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error in /api/user/withdrawals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/user/:userId/referrals", async (req, res) => {
    try {
      const { userId } = req.params;
      const referrals2 = await storage.getUserReferrals(userId);
      const enrichedReferrals = await Promise.all(
        referrals2.map(async (referral) => {
          const referee = await storage.getUser(referral.refereeId);
          return {
            ...referral,
            referee: referee ? {
              username: referee.username,
              totalEarnings: referee.totalEarnings,
              adsWatched: referee.adsWatched
            } : null
          };
        })
      );
      res.json(enrichedReferrals);
    } catch (error) {
      console.error("Error in /api/user/referrals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/bot/webhook", async (req, res) => {
    try {
      const { message, callback_query } = req.body;
      if (message) {
        const { from, text: text2, chat } = message;
        console.log(`Bot message from ${from.id}: ${text2}`);
        if (text2 && text2.startsWith("/start")) {
          const startParam = text2.split(" ")[1];
          const welcomeMessage = `\u{1F44B} Welcome to LightingSats!

\u{1F4B0} Earn money by watching ads
\u{1F465} Invite friends for 10% commission
\u{1F48E} Daily earnings up to $0.0875 (250 ads)

\u{1F680} Open the app to start earning:`;
          console.log(`Welcome message sent to ${from.id}`);
          console.log("Start parameter:", startParam || "none");
          if (startParam) {
            console.log(`User ${from.id} came via referral: ${startParam}`);
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Bot webhook error:", error);
      res.status(500).json({ success: false });
    }
  });
  app2.get("/api/admin/stats", checkAdminAccess, async (req, res) => {
    try {
      const stats = await storage.getBotStats();
      const users2 = await storage.getAllUsers();
      const pendingWithdrawals = await storage.getPendingWithdrawalRequests();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      const activeUsers24h = users2.filter(
        (user) => user.lastAdWatch && new Date(user.lastAdWatch) > twentyFourHoursAgo
      ).length;
      await storage.updateBotStats({ activeUsers24h });
      res.json({
        ...stats,
        activeUsers24h,
        pendingWithdrawals: pendingWithdrawals.length,
        totalPendingAmount: pendingWithdrawals.reduce((sum, req2) => sum + parseFloat(req2.amount), 0)
      });
    } catch (error) {
      console.error("Error in /api/admin/stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/admin/pending-withdrawals", checkAdminAccess, async (req, res) => {
    try {
      const pendingRequests = await storage.getPendingWithdrawalRequests();
      const enrichedRequests = await Promise.all(
        pendingRequests.map(async (request) => {
          const user = await storage.getUser(request.userId);
          return {
            ...request,
            user: user ? { username: user.username, telegramId: user.telegramId } : null
          };
        })
      );
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error in /api/admin/pending-withdrawals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/process-withdrawal", checkAdminAccess, async (req, res) => {
    try {
      const { requestId, status, adminNotes } = req.body;
      if (!requestId || !status) {
        return res.status(400).json({ error: "Request ID and status required" });
      }
      const request = await storage.getWithdrawalRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }
      if (status === "approved") {
        const user = await storage.getUser(request.userId);
        if (user) {
          const newBalance = (parseFloat(user.withdrawBalance || "0") - parseFloat(request.amount)).toFixed(5);
          await storage.updateUser(user.id, {
            withdrawBalance: newBalance >= "0" ? newBalance : "0"
          });
          const stats = await storage.getBotStats();
          await storage.updateBotStats({
            totalWithdrawals: (parseFloat(stats.totalWithdrawals || "0") + parseFloat(request.amount)).toFixed(5)
          });
        }
      }
      const updatedRequest = await storage.updateWithdrawalRequest(requestId, {
        status,
        adminNotes: adminNotes || null
      });
      res.json({ success: true, request: updatedRequest });
    } catch (error) {
      console.error("Error in /api/admin/process-withdrawal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/admin/users", checkAdminAccess, async (req, res) => {
    try {
      const { search, filter } = req.query;
      let users2 = await storage.getAllUsers();
      if (search) {
        const searchLower = search.toLowerCase();
        users2 = users2.filter(
          (user) => user.username.toLowerCase().includes(searchLower) || user.telegramId?.includes(searchLower) || user.id.toLowerCase().includes(searchLower)
        );
      }
      if (filter === "banned") {
        users2 = users2.filter((user) => user.banned);
      } else if (filter === "flagged") {
        users2 = users2.filter((user) => user.flagged);
      } else if (filter === "pending-claims") {
        users2 = users2.filter((user) => parseFloat(user.dailyEarnings || "0") > 0);
      }
      users2.sort((a, b) => {
        const aDate = a.lastAdWatch ? new Date(a.lastAdWatch).getTime() : 0;
        const bDate = b.lastAdWatch ? new Date(b.lastAdWatch).getTime() : 0;
        return bDate - aDate;
      });
      res.json(users2);
    } catch (error) {
      console.error("Error in /api/admin/users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/user/ban", checkAdminAccess, async (req, res) => {
    try {
      const { userId, banned, reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        banned,
        flagged: banned ? true : user.flagged,
        flagReason: banned ? reason || "Banned by admin" : user.flagReason
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/user/ban:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/claim/approve", checkAdminAccess, async (req, res) => {
    try {
      const { userId } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const claimed = parseFloat(user.dailyEarnings || "0");
      if (claimed <= 0) {
        return res.status(400).json({ error: "No earnings to approve" });
      }
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + claimed).toFixed(5),
        dailyEarnings: "0"
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/claim/approve:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/claim/reject", checkAdminAccess, async (req, res) => {
    try {
      const { userId, reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: "0"
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/claim/reject:", error);
      res.status(500).json({ error: "Internal server error" });
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
  }, () => {
    log(`serving on port ${port}`);
  });
})();
