import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format TON values with up to 4 decimal places, removing trailing zeros
 * Examples: 0.0001500 TON → 0.00015 TON, 0.100000 TON → 0.1 TON, 2.0000 TON → 2 TON
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || !numValue) {
    return includeSymbol ? '0 TON' : '0';
  }

  // Format to 4 decimal places and remove trailing zeros
  const formatted = parseFloat(numValue.toFixed(4)).toString();
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${formatted}${symbol}`;
}
