import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PAD_TO_USD, padToUSD } from "@shared/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values - displays PAD amount
 * Handles both integer PAD values and legacy decimal values
 * Examples: 1000 → "1,000 PAD", 0.0001 → "1,000 PAD" (legacy TON format)
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = parseFloat(typeof value === 'string' ? value : value.toString());
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 PAD' : '0';
  }
  
  // If value is very small (< 1), it might be legacy TON format - convert to PAD
  // Otherwise, treat as PAD integer
  const padValue = numValue < 1 ? Math.round(numValue * 10000000) : Math.round(numValue);
  
  const symbol = includeSymbol ? ' PAD' : '';
  return `${padValue.toLocaleString()}${symbol}`;
}

/**
 * Format task rewards - displays PAD amount
 * Handles both integer PAD values and legacy decimal values
 * Examples: 1000 → "1,000 PAD", 0.0001 → "1,000 PAD" (legacy TON format)
 */
export function formatTaskReward(value: string | number, includeSymbol: boolean = true): string {
  const numValue = parseFloat(typeof value === 'string' ? value : value.toString());
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 PAD' : '0';
  }
  
  // If value is very small (< 1), it might be legacy TON format - convert to PAD
  // Otherwise, treat as PAD integer
  const padValue = numValue < 1 ? Math.round(numValue * 10000000) : Math.round(numValue);
  
  const symbol = includeSymbol ? ' PAD' : '';
  return `${padValue.toLocaleString()}${symbol}`;
}

/**
 * Convert PAD to USD
 * 100,000 PAD = $1.00
 */
export function formatPADtoUSD(padAmount: number | string): string {
  const usd = padToUSD(padAmount);
  return usd.toFixed(2);
}

/**
 * Format TON values without converting to PAD
 * For admin panel and withdrawal displays
 * Examples: 0.0003 → "0.0003 TON", 1.5 → "1.5 TON"
 */
export function formatTON(value: string | number, includeSymbol: boolean = true): string {
  const numValue = parseFloat(typeof value === 'string' ? value : value.toString());
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 TON' : '0';
  }
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${numValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}${symbol}`;
}

/**
 * Shorten wallet address for display
 * Examples: 
 * - UQCW9LwFkPRsL...PvJ (TON addresses)
 * - 0x1234...5678 (USDT addresses)
 */
export function shortenAddress(address: string, startChars: number = 13, endChars: number = 3): string {
  if (!address || typeof address !== 'string') {
    return '';
  }
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Canonicalize Telegram username - strips all leading @ symbols and whitespace
 * Returns clean username for storage and API submission
 * Examples: "@@username" -> "username", "@user" -> "user", "user" -> "user"
 */
export function canonicalizeTelegramUsername(value: string): string {
  return value?.trim().replace(/^@+/, '').replace(/\s+/g, '') ?? '';
}

/**
 * Format Telegram username for display - adds single @ prefix
 * Examples: "username" -> "@username", "" -> ""
 */
export function formatTelegramUsername(value: string): string {
  return value ? `@${value}` : '';
}
