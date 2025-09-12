import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { EARNING_RATES } from "@shared/constants";

// Simple auth middleware for development
const authenticateTelegram = (req: any, res: any, next: any) => {
  // For development, create a test user with proper Telegram ID structure
  req.user = {
    user: {
      id: "123456789", // Telegram ID format (numeric string)
      first_name: "Test",
      last_name: "User",
      username: "testuser"
    }
  };
  next();
};

// Internal API key for TON price updates
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "dev-internal-key-2024";

// Middleware to authenticate internal API calls
const authenticateInternal = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Invalid or missing API key' 
    });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Market state endpoint
  app.get('/api/market-state', async (req, res) => {
    try {
      const marketState = await storage.getCurrentMarketState();
      const currentPrice = await storage.getCurrentPADZPrice();
      const globalAds = await storage.getGlobalAdCount();
      
      res.json({
        currentPrice,
        globalAds: globalAds.toString(),
        tonPrice: marketState.tonPriceUsd,
        currentPadz: currentPrice
      });
    } catch (error) {
      console.error('Error fetching market state:', error);
      res.status(500).json({ error: 'Failed to fetch market state' });
    }
  });

  /**
   * Get PADZ Price History
   * Returns historical price data for charting PADZ/USDT trends
   */
  app.get('/api/price-history', async (req, res) => {
    try {
      const { period = '24h' } = req.query;
      const priceHistory = await storage.getPriceHistory(period as string);
      
      res.json({
        success: true,
        data: priceHistory,
        period: period
      });
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch price history' 
      });
    }
  });

  // User stats endpoint
  app.get('/api/user/stats', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch user stats' });
    }
  });

  // Auth endpoints for development
  app.get('/api/auth/user', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      let user = await storage.getUser(userId);
      
      if (!user) {
        // Create test user if doesn't exist
        user = await storage.createUser({
          firstName: req.user.user.first_name,
          lastName: req.user.user.last_name,
          email: `${req.user.user.username}@example.com`,
          telegramId: userId // This will be used as the primary key
        });
      }
      
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        telegramId: user.telegramId
      });
    } catch (error) {
      console.error('Error in auth/user:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.get('/api/auth/session-token', (req, res) => {
    res.json({
      sessionToken: 'test-session',
      message: 'Development session token'
    });
  });

  // Exchange endpoint
  app.post('/api/exchange', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const { padzAmount } = req.body;

      if (!padzAmount || Number(padzAmount) <= 0) {
        return res.status(400).json({ message: 'Invalid PADZ amount' });
      }

      // Get current price and calculate USDT amount
      const currentPrice = await storage.getCurrentPADZPrice();
      const usdtAmount = (Number(padzAmount) * Number(currentPrice)).toFixed(6);

      const result = await storage.exchangePADZToUSDT(userId, padzAmount, usdtAmount);

      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Exchange completed successfully',
          usdtReceived: usdtAmount
        });
      } else {
        res.status(400).json({ message: result.message });
      }
    } catch (error) {
      console.error('Error in exchange:', error);
      res.status(500).json({ message: 'Exchange failed' });
    }
  });

  // Withdrawals endpoint
  app.get('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      const withdrawals = await storage.getWithdrawals(userId);
      res.json(withdrawals);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
  });

  // Ad watching endpoint
  app.post('/api/watch-ad', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.user.id;
      
      // Add ad earning
      await storage.addEarning({
        userId,
        amount: EARNING_RATES.PER_AD_REWARD_PADZ.toString(),
        source: 'ad',
        description: 'Watched advertisement'
      });

      // Update global ad counter
      // This would need to be implemented properly with atomic operations
      
      // Check for milestone updates
      await storage.updateMarketStateWithAdMilestone();

      res.json({ 
        success: true, 
        earned: EARNING_RATES.PER_AD_REWARD_PADZ,
        message: 'Ad watched successfully' 
      });
    } catch (error) {
      console.error('Error in watch-ad:', error);
      res.status(500).json({ message: 'Failed to process ad view' });
    }
  });

  // TON Price Update endpoint (for background service)
  app.post('/api/internal/update-ton-price', authenticateInternal, async (req, res) => {
    try {
      const { tonPriceUsd } = req.body;
      
      if (!tonPriceUsd || Number(tonPriceUsd) <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid TON price - must be a positive number' 
        });
      }

      await storage.updateTONPrice(tonPriceUsd);
      
      res.json({ 
        success: true, 
        message: 'TON price updated successfully',
        tonPrice: tonPriceUsd,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating TON price:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update TON price',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}