import { 
  type User, 
  type InsertUser,
  type Earning,
  type InsertEarning,
  type MarketState,
  type PriceHistory,
  type Exchange,
  type InsertExchange,
  type Withdrawal,
  type InsertWithdrawal
} from "@shared/schema";
import { EARNING_RATES, PRICE_CONFIG, TONCOIN_CONFIG } from "@shared/constants";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Stats methods
  getUserStats(userId: string): Promise<{
    todayEarnings: string;
    weekEarnings: string;
    monthEarnings: string;
    currentPadz: string;
    withdrawBalance: string;
    totalEarned: string;
    adsWatched: number;
    dailyAdsWatched: number;
    level: number;
  }>;
  
  // Earning methods
  addEarning(earning: InsertEarning): Promise<void>;
  getGlobalAdCount(): Promise<bigint>;
  
  // Market methods
  getCurrentMarketState(): Promise<MarketState>;
  getCurrentPADZPrice(): Promise<string>;
  updateTONPrice(tonPriceUsd: string): Promise<void>;
  updateMarketStateWithAdMilestone(): Promise<void>;
  
  // Price history
  getPriceHistory(period: string): Promise<Array<{ time: string; price: string; totalAds: string; reason: string }>>;
  
  // Exchange methods
  exchangePADZToUSDT(userId: string, padzAmount: string, usdtAmount: string): Promise<{ success: boolean; message?: string }>;
  
  // Withdrawal methods
  getWithdrawals(userId?: string): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map(); // email -> userId
  private usersByTelegramId: Map<string, string> = new Map(); // telegramId -> userId
  private earnings: Earning[] = [];
  private globalCounters: Map<string, bigint> = new Map();
  private marketStateData: MarketState;
  private priceHistoryData: PriceHistory[] = [];
  private exchangesData: Exchange[] = [];
  private withdrawalsData: Withdrawal[] = [];
  private nextEarningId = 1;
  private nextExchangeId = 1;
  private nextWithdrawalId = 1;
  private nextPriceHistoryId = 1;

  constructor() {
    // Initialize market state
    this.marketStateData = {
      id: 1,
      basePriceUsd: PRICE_CONFIG.BASE_PRICE_USD.toString(),
      currentPriceUsd: PRICE_CONFIG.BASE_PRICE_USD.toString(),
      lastMilestone: 0,
      tonPriceUsd: "0",
      updatedAt: new Date(),
    };
    
    // Initialize global ad counter
    this.globalCounters.set("global_ads", BigInt(0));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = this.usersByEmail.get(email);
    return userId ? this.users.get(userId) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: insertUser.telegramId || this.generateId(), // Use telegramId as primary key if available
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      email: insertUser.email,
      telegramId: insertUser.telegramId || null,
      balance: "0",
      withdrawBalance: "0",
      totalEarned: "0",
      adsWatched: 0,
      dailyAdsWatched: 0,
      level: 1,
      banned: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    if (user.telegramId) {
      this.usersByTelegramId.set(user.telegramId, user.id);
    }
    
    return user;
  }

  async getUserStats(userId: string): Promise<{
    todayEarnings: string;
    weekEarnings: string;
    monthEarnings: string;
    currentPadz: string;
    withdrawBalance: string;
    totalEarned: string;
    adsWatched: number;
    dailyAdsWatched: number;
    level: number;
  }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate earnings from memory
      const userEarnings = this.earnings.filter(e => e.userId === userId);
      
      // Calculate time-based earnings
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const todayEarnings = userEarnings
        .filter(e => e.createdAt >= today)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const weekEarnings = userEarnings
        .filter(e => e.createdAt >= weekAgo)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const monthEarnings = userEarnings
        .filter(e => e.createdAt >= monthAgo)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const currentPadz = userEarnings
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        todayEarnings: todayEarnings.toString(),
        weekEarnings: weekEarnings.toString(),
        monthEarnings: monthEarnings.toString(),
        currentPadz: currentPadz.toString(),
        withdrawBalance: user.withdrawBalance || "0",
        totalEarned: user.totalEarned || "0",
        adsWatched: user.adsWatched || 0,
        dailyAdsWatched: user.dailyAdsWatched || 0,
        level: user.level || 1,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        todayEarnings: "0",
        weekEarnings: "0",
        monthEarnings: "0",
        currentPadz: "0",
        withdrawBalance: "0",
        totalEarned: "0",
        adsWatched: 0,
        dailyAdsWatched: 0,
        level: 1,
      };
    }
  }

  async addEarning(earning: InsertEarning): Promise<void> {
    const now = new Date();
    const newEarning: Earning = {
      id: this.nextEarningId++,
      userId: earning.userId,
      amount: earning.amount,
      source: earning.source,
      description: earning.description || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.earnings.push(newEarning);
    
    // Update user's total earned
    const user = this.users.get(earning.userId);
    if (user) {
      const newTotalEarned = Number(user.totalEarned || "0") + Number(earning.amount);
      user.totalEarned = newTotalEarned.toString();
      user.updatedAt = now;
      
      // Increment ads watched if this is from an ad
      if (earning.source === 'ad') {
        user.adsWatched = (user.adsWatched || 0) + 1;
        user.dailyAdsWatched = (user.dailyAdsWatched || 0) + 1;
        
        // Increment global ad counter
        const currentAds = this.globalCounters.get("global_ads") || BigInt(0);
        this.globalCounters.set("global_ads", currentAds + BigInt(1));
      }
    }
  }

  async getGlobalAdCount(): Promise<bigint> {
    return this.globalCounters.get("global_ads") || BigInt(0);
  }

  async getCurrentMarketState(): Promise<MarketState> {
    return this.marketStateData;
  }

  async getCurrentPADZPrice(): Promise<string> {
    try {
      const globalAds = await this.getGlobalAdCount();
      const marketStateData = await this.getCurrentMarketState();
      
      // Calculate PADZ price based on TON price with 1 TON = 1,000,000 PADZ relationship
      const tonPriceUsd = Number(marketStateData.tonPriceUsd || "0");
      
      if (tonPriceUsd > 0) {
        // If TON price is available, use it to calculate PADZ price
        const padzPriceFromTon = tonPriceUsd / TONCOIN_CONFIG.TON_TO_PADZ_RATIO;
        
        // Apply milestone bonuses on top of TON-based price
        const completedMilestones = Math.floor(Number(globalAds) / PRICE_CONFIG.PRICE_INCREASE_ADS_THRESHOLD);
        const priceMultiplier = Math.pow(1 + (PRICE_CONFIG.PRICE_INCREASE_PERCENT / 100), completedMilestones);
        
        const finalPrice = padzPriceFromTon * priceMultiplier;
        return finalPrice.toFixed(8);
      } else {
        // Fallback to milestone-based pricing
        const basePriceUSD = PRICE_CONFIG.BASE_PRICE_USD;
        const completedMilestones = Math.floor(Number(globalAds) / PRICE_CONFIG.PRICE_INCREASE_ADS_THRESHOLD);
        const priceMultiplier = Math.pow(1 + (PRICE_CONFIG.PRICE_INCREASE_PERCENT / 100), completedMilestones);
        const currentPrice = basePriceUSD * priceMultiplier;
        
        return currentPrice.toFixed(8);
      }
    } catch (error) {
      console.error('Error calculating PADZ price:', error);
      return PRICE_CONFIG.BASE_PRICE_USD.toString();
    }
  }

  async updateTONPrice(tonPriceUsd: string): Promise<void> {
    try {
      const now = new Date();
      this.marketStateData.tonPriceUsd = tonPriceUsd;
      this.marketStateData.updatedAt = now;

      // Calculate new PADZ price based on TON
      const newPADZPrice = await this.getCurrentPADZPrice();
      this.marketStateData.currentPriceUsd = newPADZPrice;

      // Record price change in history
      const globalAds = await this.getGlobalAdCount();
      
      const priceHistoryEntry: PriceHistory = {
        id: this.nextPriceHistoryId++,
        priceUsd: newPADZPrice,
        totalAds: globalAds,
        reason: 'ton_update',
        createdAt: now,
      };
      
      this.priceHistoryData.push(priceHistoryEntry);

      console.log(`✅ Updated TON price to $${tonPriceUsd}, PADZ price now $${newPADZPrice}`);
    } catch (error) {
      console.error('Error updating TON price:', error);
    }
  }

  async updateMarketStateWithAdMilestone(): Promise<void> {
    try {
      const globalAds = await this.getGlobalAdCount();
      const currentMilestone = Math.floor(Number(globalAds) / PRICE_CONFIG.PRICE_INCREASE_ADS_THRESHOLD);
      
      const lastMilestone = this.marketStateData.lastMilestone;

      if (currentMilestone > lastMilestone) {
        // New milestone reached, update price
        const newPrice = await this.getCurrentPADZPrice();
        const now = new Date();
        
        this.marketStateData.currentPriceUsd = newPrice;
        this.marketStateData.lastMilestone = currentMilestone;
        this.marketStateData.updatedAt = now;

        // Record in price history
        const priceHistoryEntry: PriceHistory = {
          id: this.nextPriceHistoryId++,
          priceUsd: newPrice,
          totalAds: globalAds,
          reason: 'milestone',
          createdAt: now,
        };
        
        this.priceHistoryData.push(priceHistoryEntry);

        console.log(`🎉 Milestone ${currentMilestone} reached! New PADZ price: $${newPrice}`);
      }
    } catch (error) {
      console.error('Error updating market state with ad milestone:', error);
    }
  }

  async getPriceHistory(period: string = '24h'): Promise<Array<{ time: string; price: string; totalAds: string; reason: string }>> {
    try {
      // Determine time range based on period
      let timeCondition;
      const now = new Date();
      
      switch (period) {
        case '1h':
          timeCondition = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          timeCondition = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeCondition = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeCondition = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeCondition = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const history = this.priceHistoryData
        .filter(entry => entry.createdAt >= timeCondition)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(entry => ({
          time: entry.createdAt.toISOString(),
          price: entry.priceUsd,
          totalAds: entry.totalAds.toString(),
          reason: entry.reason
        }));

      // If no historical data exists, create a current price point
      if (history.length === 0) {
        const currentPrice = await this.getCurrentPADZPrice();
        const globalAds = await this.getGlobalAdCount();
        
        return [{
          time: new Date().toISOString(),
          price: currentPrice,
          totalAds: globalAds.toString(),
          reason: 'current'
        }];
      }

      return history;
    } catch (error) {
      console.error('Error getting price history:', error);
      // Return current price as fallback
      const currentPrice = await this.getCurrentPADZPrice();
      const globalAds = await this.getGlobalAdCount();
      
      return [{
        time: new Date().toISOString(),
        price: currentPrice,
        totalAds: globalAds.toString(),
        reason: 'current'
      }];
    }
  }

  async exchangePADZToUSDT(userId: string, padzAmount: string, usdtAmount: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Get current user
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Calculate current PADZ balance from earnings
      const userEarnings = this.earnings.filter(e => e.userId === userId);
      const currentPadzBalance = userEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
      const requestedPadz = Number(padzAmount);

      if (requestedPadz > currentPadzBalance) {
        return { success: false, message: 'Insufficient PADZ balance' };
      }

      const now = new Date();

      // Deduct PADZ tokens by adding a negative earning
      await this.addEarning({
        userId,
        amount: `-${padzAmount}`,
        source: 'exchange',
        description: `Exchanged ${padzAmount} PADZ for ${usdtAmount} USDT`
      });

      // Add USDT to withdraw balance
      const currentWithdrawBalance = Number(user.withdrawBalance || '0');
      const newWithdrawBalance = (currentWithdrawBalance + Number(usdtAmount)).toFixed(6);
      user.withdrawBalance = newWithdrawBalance;
      user.updatedAt = now;

      // Create exchange record for history
      const newExchange: Exchange = {
        id: this.nextExchangeId++,
        userId,
        padzAmount,
        usdtAmount,
        exchangeRate: (Number(usdtAmount) / Number(padzAmount)).toFixed(8),
        status: 'completed',
        createdAt: now,
        updatedAt: now
      };
      
      this.exchangesData.push(newExchange);

      console.log(`✅ Exchange completed: ${padzAmount} PADZ → ${usdtAmount} USDT for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error in exchangePADZToUSDT:', error);
      return { success: false, message: 'Exchange transaction failed' };
    }
  }

  async getWithdrawals(userId?: string): Promise<Withdrawal[]> {
    try {
      let withdrawals = this.withdrawalsData;
      
      if (userId) {
        withdrawals = withdrawals.filter(w => w.userId === userId);
      }
      
      return withdrawals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting withdrawals:', error);
      return [];
    }
  }

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const now = new Date();
    const newWithdrawal: Withdrawal = {
      id: this.nextWithdrawalId++,
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      status: 'pending',
      walletAddress: withdrawal.walletAddress || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.withdrawalsData.push(newWithdrawal);
    return newWithdrawal;
  }
}

export const storage = new MemStorage();