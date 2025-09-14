import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with a maximum of 7 significant digits
 * Examples: $0.000083, $1.234567, $123.4567, $1234567
 */
export function formatCurrency(value: string | number, includeSymbol: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || numValue === 0) {
    return includeSymbol ? '$0' : '0';
  }

  // Use toLocaleString to properly enforce 7 significant digits for all values
  let formatted = numValue.toLocaleString('en-US', {
    maximumSignificantDigits: 7,
    useGrouping: false,
    notation: 'standard'
  });
  
  // Remove trailing decimal zeros
  if (formatted.includes('.')) {
    formatted = formatted.replace(/0+$/, '').replace(/\.$/, '');
  }
  
  const symbol = includeSymbol ? '$' : '';
  return `${symbol}${formatted}`;
}
