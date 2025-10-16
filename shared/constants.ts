export const APP_VERSION = "1.0.0";
export const PAD_TO_USD = 100000; // ✅ Correct: 100,000 PAD = $1
export const APP_COLORS = {
  primary: "#007BFF", // blue
  background: "#000000", // black
  text: "#FFFFFF", // white
};

/**
 * Convert TON to PAD
 * @param tonAmount - Amount in TON
 * @returns Amount in PAD (TON * 100,000)
 */
export function tonToPAD(tonAmount: number): number {
  return tonAmount * PAD_TO_USD;
}

/**
 * Convert PAD to USD
 * @param padAmount - Amount in PAD
 * @returns Amount in USD (PAD / 100,000)
 */
export function padToUSD(padAmount: number | string): number {
  const numValue = typeof padAmount === 'string' ? parseFloat(padAmount) : padAmount;
  return numValue / PAD_TO_USD;
}
