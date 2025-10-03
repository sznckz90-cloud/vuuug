import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with up to 5 decimal places, removing trailing zeros
 * Examples: 100.000990 → "100", 100.90101 → "100.90101", 2.293892 → "2.293892"
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  // Convert to string to work with original value
  let valueStr = typeof value === 'string' ? value : value.toString();
  
  // Parse to check if valid number (allow zero)
  const numValue = parseFloat(valueStr);
  if (isNaN(numValue)) {
    return includeSymbol ? '0 TON' : '0';
  }
  
  // Return zero immediately if value is zero
  if (numValue === 0) {
    return includeSymbol ? '0 TON' : '0';
  }
  
  // Keep working with original string (don't use numValue.toString() which loses precision)
  // Handle scientific notation by converting back only if needed
  if (valueStr.includes('e') || valueStr.includes('E')) {
    valueStr = numValue.toString();
  }
  
  // If there's a decimal point
  if (valueStr.includes('.')) {
    let [whole, decimals] = valueStr.split('.');
    
    // Remove trailing zeros from the FULL fractional part first
    decimals = decimals.replace(/0+$/, '');
    
    // Then limit to max 5 decimal places
    decimals = decimals.substring(0, 5);
    
    // If no significant decimals remain, return whole number only
    if (decimals.length === 0 || decimals === '' || parseInt(decimals) === 0) {
      valueStr = whole;
    } else {
      valueStr = `${whole}.${decimals}`;
    }
  }
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${valueStr}${symbol}`;
}

/**
 * Format currency values with up to 5 decimal places for task rewards
 * Examples: 0.00033 TON, 1.23456 TON
 */
export function formatTaskReward(value: string | number, includeSymbol: boolean = true): string {
  // Convert to string to work with original value
  let valueStr = typeof value === 'string' ? value : value.toString();
  
  // Parse to check if valid number (allow zero)
  const numValue = parseFloat(valueStr);
  if (isNaN(numValue)) {
    return includeSymbol ? '0 TON' : '0';
  }
  
  // Return zero immediately if value is zero
  if (numValue === 0) {
    return includeSymbol ? '0 TON' : '0';
  }
  
  // Keep working with original string (don't use numValue.toString() which loses precision)
  // Handle scientific notation by converting back only if needed
  if (valueStr.includes('e') || valueStr.includes('E')) {
    valueStr = numValue.toString();
  }
  
  // If there's a decimal point
  if (valueStr.includes('.')) {
    let [whole, decimals] = valueStr.split('.');
    
    // Remove trailing zeros from the FULL fractional part first
    decimals = decimals.replace(/0+$/, '');
    
    // Then limit to max 5 decimal places
    decimals = decimals.substring(0, 5);
    
    // If no significant decimals remain, return whole number only
    if (decimals.length === 0 || decimals === '' || parseInt(decimals) === 0) {
      valueStr = whole;
    } else {
      valueStr = `${whole}.${decimals}`;
    }
  }
  
  const symbol = includeSymbol ? ' TON' : '';
  return `${valueStr}${symbol}`;
}
