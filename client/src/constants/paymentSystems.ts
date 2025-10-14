export interface PaymentSystem {
  id: string;
  name: string;
  emoji: string;
  minWithdrawal: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
}

export const PAYMENT_SYSTEMS: PaymentSystem[] = [
  { id: 'ton_coin', name: 'TON Coin', emoji: '💎', minWithdrawal: 0.5, fee: 0.1, feeType: 'fixed' },
  { id: 'telegram_premium', name: 'Telegram Premium', emoji: '⭐', minWithdrawal: 3.75, fee: 0.15, feeType: 'fixed' },
  { id: 'telegram_stars', name: 'Telegram Stars', emoji: '⭐', minWithdrawal: 1.00, fee: 1, feeType: 'percentage' }
];
