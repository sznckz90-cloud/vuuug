// PADZ Token Earning Rates
export const EARNING_RATES = {
  STREAK_REWARD_PADZ: 80,
  TASK_REWARD_PADZ: 80, 
  PER_AD_REWARD_PADZ: 80,
  DAILY_AD_LIMIT: 250,
} as const;

// PADZ Token Price Configuration
export const PRICE_CONFIG = {
  BASE_PRICE_USD: 0.00000317,
  PRICE_INCREASE_PERCENT: 3,
  PRICE_INCREASE_ADS_THRESHOLD: 1000,
} as const;

// Toncoin Integration
export const TONCOIN_CONFIG = {
  TON_TO_PADZ_RATIO: 1000000, // 1 TON = 1,000,000 PADZ
} as const;