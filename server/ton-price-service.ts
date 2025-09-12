import { storage } from "./storage";

/**
 * TON Price Integration Service
 * Fetches real-time TON prices from CoinGecko API and updates PADZ pricing
 */
export class TONPriceService {
  private static instance: TONPriceService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  // Update every 2 minutes (CoinGecko rate limit: 30 calls/min)
  private readonly UPDATE_INTERVAL = 2 * 60 * 1000; 

  constructor() {
    if (TONPriceService.instance) {
      return TONPriceService.instance;
    }
    TONPriceService.instance = this;
  }

  /**
   * Fetch current TON price from CoinGecko API
   */
  private async fetchTONPrice(): Promise<number | null> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.error(`❌ TON price API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      const tonPrice = data['the-open-network']?.usd;

      if (typeof tonPrice === 'number' && tonPrice > 0) {
        console.log(`📈 TON price fetched: $${tonPrice.toFixed(4)}`);
        return tonPrice;
      } else {
        console.error('❌ Invalid TON price data received:', data);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching TON price:', error);
      return null;
    }
  }

  /**
   * Update TON price and recalculate PADZ pricing
   */
  private async updateTONPrice(): Promise<void> {
    try {
      const tonPrice = await this.fetchTONPrice();
      
      if (tonPrice !== null) {
        await storage.updateTONPrice(tonPrice.toString());
        console.log(`✅ TON price updated in database: $${tonPrice.toFixed(4)}`);
      } else {
        console.warn('⚠️ Skipping TON price update due to fetch failure');
      }
    } catch (error) {
      console.error('❌ Error updating TON price in database:', error);
    }
  }

  /**
   * Start the TON price monitoring service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ TON price service is already running');
      return;
    }

    console.log('🚀 Starting TON price monitoring service...');
    
    // Initial price fetch
    await this.updateTONPrice();
    
    // Set up periodic updates
    this.intervalId = setInterval(async () => {
      await this.updateTONPrice();
    }, this.UPDATE_INTERVAL);

    this.isRunning = true;
    console.log(`✅ TON price service started (updates every ${this.UPDATE_INTERVAL / 1000} seconds)`);
  }

  /**
   * Stop the TON price monitoring service
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ TON price service is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 TON price service stopped');
  }

  /**
   * Get the current status of the service
   */
  public getStatus(): { running: boolean; updateInterval: number } {
    return {
      running: this.isRunning,
      updateInterval: this.UPDATE_INTERVAL
    };
  }

  /**
   * Manual TON price update (for testing or immediate updates)
   */
  public async forceUpdate(): Promise<void> {
    console.log('🔄 Force updating TON price...');
    await this.updateTONPrice();
  }
}

// Export singleton instance
export const tonPriceService = new TONPriceService();