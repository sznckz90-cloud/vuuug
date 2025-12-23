// TON price fetching service - gets live market data
let cachedPrice: { price: number; lastUpdated: number } | null = null;
const CACHE_DURATION = 60000; // Cache for 60 seconds

export async function getTONPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedPrice && now - cachedPrice.lastUpdated < CACHE_DURATION) {
    return cachedPrice.price;
  }

  try {
    // Fetch from CoinGecko free API (no key required)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch TON price');
    
    const data = await response.json();
    const price = data['the-open-network']?.usd;
    
    if (!price || typeof price !== 'number') {
      throw new Error('Invalid price data');
    }

    // Cache the price
    cachedPrice = { price, lastUpdated: now };
    return price;
  } catch (error) {
    console.error('Error fetching TON price:', error);
    
    // Fallback to cached price if available, even if expired
    if (cachedPrice) {
      return cachedPrice.price;
    }
    
    // Fallback to a reasonable default (will update when API works)
    return 5.5; // Conservative default
  }
}

export function calculateConversions(tonPriceUSD: number) {
  const PAD_PER_USD = 10000;
  
  return {
    tonPriceUSD: Number(tonPriceUSD.toFixed(4)),
    padPerDollar: PAD_PER_USD,
    dollarPerTon: Number((tonPriceUSD).toFixed(4)),
    tonPerDollar: Number((1 / tonPriceUSD).toFixed(8)),
    padPerTon: Number((tonPriceUSD * PAD_PER_USD).toFixed(0)),
    tonPerPad: Number((1 / (tonPriceUSD * PAD_PER_USD)).toFixed(12)),
  };
}
