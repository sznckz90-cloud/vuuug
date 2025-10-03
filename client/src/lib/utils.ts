import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with up to 5 decimal places, removing trailing zeros
 * Examples: 100.000990 → "100", 100.90101 → "100.9", 2.293892 → "2.293"
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || !numValue) {
    return includeSymbol ? '0 TON' : '0';
  }

  // Format to up to 5 decimal places and remove trailing zeros
  const formatted = parseFloat(numValue.toFixed(5)).toString();
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${formatted}${symbol}`;
}

/**
 * Format currency values with up to 5 decimal places for task rewards
 * Examples: 0.00033 TON, 1.23456 TON
 */
export function formatTaskReward(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 TON' : '0';
  }

  // Format to up to 5 decimal places and remove trailing zeros
  const formatted = parseFloat(numValue.toFixed(5)).toString();
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${formatted}${symbol}`;
}
