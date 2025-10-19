import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PAD_TO_USD, tonToPAD, padToUSD } from "@shared/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values - converts TON to PAD
 * Examples: 0.00033 → "33 PAD", 0.0002 → "20 PAD"
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = parseFloat(typeof value === 'string' ? value : value.toString());
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 PAD' : '0';
  }
  
  // Convert TON to PAD using shared constant
  const padValue = tonToPAD(numValue);
  
  const symbol = includeSymbol ? ' PAD' : '';
  return `${padValue.toLocaleString()}${symbol}`;
}

/**
 * Format task rewards - converts TON to PAD
 * Examples: 0.00033 → "33 PAD", 0.0002 → "20 PAD"
 */
export function formatTaskReward(value: string | number, includeSymbol: boolean = true): string {
  const numValue = parseFloat(typeof value === 'string' ? value : value.toString());
  
  if (isNaN(numValue)) {
    return includeSymbol ? '0 PAD' : '0';
  }
  
  // Convert TON to PAD using shared constant
  const padValue = tonToPAD(numValue);
  
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
