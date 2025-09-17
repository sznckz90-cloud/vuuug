import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with exactly 7 decimal places for TON precision
 * Examples: 0.0001500 TON, 0.0002000 TON, 0.0008000 TON
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0.0000000 TON' : '0.0000000';
  }

  // Format to exactly 7 decimal places as requested by user
  const formatted = numValue.toFixed(7);
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${formatted}${symbol}`;
}
