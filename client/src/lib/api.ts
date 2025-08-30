import { apiRequest } from "./queryClient";
import type { User, WithdrawalRequest } from "@shared/schema";


export interface WatchAdResponse {
  success: boolean;
  earnings: number;
  user: User;
}

export interface ClaimEarningsResponse {
  success: boolean;
  claimed: string;
  user: User;
}

export interface WithdrawalRequestResponse {
  success: boolean;
  request: WithdrawalRequest;
}

// User API
export async function getOrCreateUser(telegramId: string, username: string, referralCode?: string | null): Promise<User> {
  const payload: { telegramId: string; username: string; referralCode?: string } = { telegramId, username };
  if (referralCode) {
    payload.referralCode = referralCode;
  }
  const response = await apiRequest('POST', '/api/user', payload);
  return response.json();
}

// Watch Ad API
export async function watchAd(userId: string): Promise<any> {
  console.log(`Calling watch-ad API for user: ${userId}`);
  try {
    const response = await fetch('/api/watch-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Watch-ad API raw response:', data);
    
    if (!response.ok) {
      const errorMessage = data.error || 'Failed to watch ad';
      console.error('Watch-ad API error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('Watch-ad API success:', data);
    return data;
  } catch (error) {
    console.error('Watch-ad API error:', error);
    throw error;
  }
}

// Withdrawal API
export async function createWithdrawalRequest(userId: string, amount: string, telegramUsername: string, lightningAddress: string): Promise<any> {
  const response = await apiRequest('POST', '/api/withdraw', {
    userId,
    amount,
    telegramUsername,
    lightningAddress
  });
  return response.json();
}



// Earnings API
export async function claimEarnings(userId: string): Promise<ClaimEarningsResponse> {
  const response = await apiRequest('POST', '/api/claim-earnings', { userId });
  return response.json();
}

// Withdrawal API
export async function createWithdrawalRequest(
  userId: string, 
  amount: string, 
  telegramUsername?: string,
  walletAddress?: string,
  method: string = 'telegram'
): Promise<WithdrawalRequestResponse> {
  const response = await apiRequest('POST', '/api/withdrawal-request', {
    userId,
    amount,
    telegramUsername,
    walletAddress,
    method
  });
  return response.json();
}

export async function getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
  const response = await apiRequest('GET', `/api/user/${userId}/withdrawals`);
  return response.json();
}

