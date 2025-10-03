import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with exactly 4 decimal places for TON display
 * Examples: 1.2345 TON, 0.1234 TON
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0.0000 TON' : '0.0000';
  }

  // Format to exactly 4 decimal places as requested
  const formatted = numValue.toFixed(4);
  
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
