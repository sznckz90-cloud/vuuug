export const APP_VERSION = "1.0.0";
export const PAD_TO_TON = 10000000; // ✅ 10,000,000 PAD = 1 TON
export const PAD_TO_USD = 100000; // Legacy: kept for compatibility
export const APP_COLORS = {
  primary: "#4aa8ff", // light blue
  background: "#000000", // pure black
  text: "#d9e6ff", // light white/blue
};

/**
 * Convert TON to PAD
 * @param tonAmount - Amount in TON (string or number)
 * @returns Amount in PAD (TON * 10,000,000)
 */
export function tonToPAD(tonAmount: number | string): number {
  const numValue = typeof tonAmount === 'string' ? parseFloat(tonAmount) : tonAmount;
  return Math.round(numValue * PAD_TO_TON);
}

/**
 * Convert PAD to TON
 * @param padAmount - Amount in PAD
 * @returns Amount in TON (PAD / 10,000,000)
 */
export function padToTON(padAmount: number | string): number {
  const numValue = typeof padAmount === 'string' ? parseFloat(padAmount) : padAmount;
  return numValue / PAD_TO_TON;
}

/**
 * Legacy function - Convert PAD to USD (kept for compatibility)
 * @param padAmount - Amount in PAD
 * @returns Amount in USD (PAD / 100,000)
 */
export function padToUSD(padAmount: number | string): number {
  const numValue = typeof padAmount === 'string' ? parseFloat(padAmount) : padAmount;
  return numValue / PAD_TO_USD;
}
