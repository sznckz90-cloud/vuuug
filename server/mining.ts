import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Purchase a mining booster - deducts TON from user balance
 */
export async function purchaseBooster(
  userId: string,
  boosterId: string,
  boosterName: string,
  price: number,
  durationHours: number,
  maxProfit: number
) {
  try {
    if (!userId) {
      console.error('❌ Mining purchase: No userId provided');
      throw new Error('User ID is required');
    }

    console.log(`📦 Attempting to purchase booster for user: ${userId}`);

    // Get current user balance
    const user = await db
      .select({ tonBalance: users.tonBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.length === 0) {
      console.error(`❌ User not found: ${userId}`);
      throw new Error('User not found');
    }

    console.log(`✅ User found, current TON balance: ${user[0].tonBalance}`);

    const currentBalance = parseFloat(user[0].tonBalance || '0');

    if (currentBalance < price) {
      throw new Error('Insufficient TON balance');
    }

    // Deduct TON from balance
    const newBalance = (currentBalance - price).toFixed(10);
    
    await db
      .update(users)
      .set({ tonBalance: newBalance })
      .where(eq(users.id, userId));

    return {
      success: true,
      message: `${boosterName} purchased successfully`,
      boosterId,
      boosterName,
      durationHours,
      maxProfit,
      tonDeducted: price,
      newBalance,
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to purchase booster');
  }
}

/**
 * Claim mined TON - adds mined amount to user balance
 */
export async function claimMining(userId: string, minedAmount: number) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (minedAmount <= 0) {
      throw new Error('Invalid mined amount');
    }

    // Get current user balance
    const user = await db
      .select({ tonBalance: users.tonBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.length === 0) {
      throw new Error('User not found');
    }

    const currentBalance = parseFloat(user[0].tonBalance || '0');
    const newBalance = (currentBalance + minedAmount).toFixed(10);

    // Add mined amount to balance
    await db
      .update(users)
      .set({ tonBalance: newBalance })
      .where(eq(users.id, userId));

    return {
      success: true,
      message: `Mining claim successful! Earned ${minedAmount} TON`,
      minedAmount,
      newBalance,
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to claim mining rewards');
  }
}
