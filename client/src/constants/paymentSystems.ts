export interface PaymentSystem {
  id: string;
  name: string;
  emoji: string;
  minWithdrawal: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
  requiresStarPackage?: boolean;
}

export interface StarPackage {
  stars: number;
  usdCost: number;
}

export const STAR_PACKAGES: StarPackage[] = [
  { stars: 15, usdCost: 0.30 },
  { stars: 25, usdCost: 0.50 },
  { stars: 50, usdCost: 1.00 },
  { stars: 100, usdCost: 2.00 }
];

export const PAYMENT_SYSTEMS: PaymentSystem[] = [
  { id: 'TON', name: 'TON', emoji: '💎', minWithdrawal: 0, fee: 5, feeType: 'percentage' },
  { id: 'USDT', name: 'USDT', emoji: '💵', minWithdrawal: 0, fee: 5, feeType: 'percentage' },
  { id: 'STARS', name: 'Telegram Stars', emoji: '⭐', minWithdrawal: 0, fee: 5, feeType: 'percentage', requiresStarPackage: true }
];

export const PAD_TO_USD_RATE = 10000;
