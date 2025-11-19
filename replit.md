# CashWatch - PAD Earning & Withdrawal Platform

## Project Overview
CashWatch is a Telegram-based earning platform where users can earn PAD currency by watching ads, completing tasks, and referring friends. Users can convert their PAD to USD and withdraw via multiple payment methods.

## Recent Changes

### November 18, 2025 - UI/UX Updates

**Navigation & Icon Improvements**:
- Bottom navigation updated: Replaced "Leaderboard" with "Withdraw" button (`client/src/components/Layout.tsx`)
- **New Icons Applied**:
  - ✨ **Sparkles icon** for "Create Task" (replaced PlusCircle) - more creative and attractive
  - 💲 **CircleDollarSign icon** for "Withdraw" (replaced Download) - unique money-related icon
- Icons updated in: Layout.tsx, Withdraw.tsx, CreateTask.tsx

**Withdraw Page Toggle System**:
- Replaced Radix Tabs with CreateTask-style grid toggle buttons (`client/src/pages/Withdraw.tsx`)
- Two-button toggle: "Withdraw" and "Wallet Setup" sections
- Matching gradient styling: `from-cyan-500/20 to-blue-500/20` with shadow effects
- Same visual style as CreateTask's "Add Task" / "My Task" toggle

**Wallet Setup Integration**:
- Wallet Setup section integrated into Withdraw page (accessible via toggle)
- Wallet type selector with icons: Gem (TON), DollarSign (USDT), Star (Telegram Stars)
- Consistent UI with popup dialog layout

### November 17, 2025 - Latest Updates

**Wallet Change Fee Bug Fixed**:
- USDT and Telegram Stars wallet changes were not charging fees (only TON wallet had fees)
- **Backend Changes** (`server/routes.ts`):
  - `/api/wallet/usdt`: Now checks if wallet exists and charges 5000 PAD fee for changes
  - `/api/wallet/telegram-stars`: Now checks if username exists and charges 5000 PAD fee for changes
  - First-time setup remains free, only changes are charged
  - Fee validation and transaction recording implemented
- **Frontend Changes** (`client/src/components/CwalletSetupDialog.tsx`):
  - Added fee warning for USDT wallet changes (shows 5000 PAD deduction)
  - Added fee warning for Telegram Stars username changes (shows 5000 PAD deduction)
  - Consistent UI across all wallet types (TON, USDT, Stars)

**Faucetpay System Updates**:
- Renamed from "Daily Streak" to "Faucetpay" (`client/src/components/StreakCard.tsx`)
- Display changed from "Day X" to "+1 PAD"
- Backend source changed from 'daily_streak' to 'faucetpay' (`server/storage.ts`)
- Success message updated to "You've claimed +1 PAD from Faucetpay!"

**Leaderboard Improvements**:
- Added compact number notation: 1k, 20k, 1M, 1B, 1T (`shared/constants.ts`)
- Trillion (T) support added for future-proofing
- PAD amounts now display in compact format throughout leaderboard

### November 17, 2025 - TON→PAD Conversion Bug Fixes

**Critical Bug Fixed**: PAD rewards were being stored in TON decimal format (0.00008390) instead of PAD integer format (839), causing balance to display as 0.

**Changes Made**:
1. **Fixed Streak Reward System** (`server/storage.ts`)
   - Changed from: `rewardInTON = randomPAD / 10000000; rewardEarned = rewardInTON.toFixed(8)`
   - Changed to: `rewardEarned = randomPAD.toString()` 
   - Now correctly stores 200-1000 PAD as integers

2. **Fixed Referral Commission System** (`server/storage.ts`)
   - Changed from: `commission = (earningAmount * 0.10).toFixed(8)`
   - Changed to: `commission = Math.round(parseFloat(earningAmount) * 0.10).toString()`
   - Referral bonuses now stored as PAD integers instead of TON decimals

3. **Fixed Claim Referral Bonus** (`server/storage.ts`)
   - Removed `.toFixed(8)` conversions
   - All balance calculations now use integer PAD format

4. **Fixed WebSocket Ad Reward** (`server/routes.ts`)
   - Fixed undefined variable `adRewardTON` → changed to `adRewardPAD.toString()`

5. **Updated Display Functions** (`client/src/lib/utils.ts`)
   - `formatCurrency()` and `formatTaskReward()` now handle both:
     - New PAD integer format (1000 PAD)
     - Legacy TON decimal format (0.0001 TON → converts to 1000 PAD)
   - Auto-detects format: if value < 1, multiply by 10,000,000 to convert TON→PAD

6. **Removed Leftover TON References**
   - Removed unused imports: `tonToPAD`, `PAD_TO_TON` from utils.ts
   - Removed `PAD_TO_TON` import from Admin.tsx
   - Updated promo code creation to use PAD directly

**Impact**: New rewards (ads, streaks, referrals) now correctly display and accumulate. Legacy balances in TON format are auto-converted when displayed.

### November 16, 2025

### Bug Fixes Implemented

1. **PAD → USD Conversion Fix**
   - Updated WalletSection component to display actual `usdBalance` from database instead of calculating from PAD balance
   - Fixed API endpoint to use `/api/convert-to-usd` for converting PAD to USD
   - Updated Home.tsx to pass `usdBalance` prop to WalletSection
   - Conversion now correctly:
     - Deducts PAD from balance
     - Adds USD to usdBalance
     - Both balances display correctly after conversion

2. **Withdrawal System Overhaul**
   - Removed TON conversion display in withdrawal dialog
   - All withdrawals now show USD amount only
   - Methods display as: TON, USD, Stars (method names only)
   - Server handles fee calculation (5%) - frontend no longer sends amount for non-STARS withdrawals
   - Updated payment systems to use 'USD' instead of 'USDT'
   - Server now accepts both 'USD' and 'USDT' as valid withdrawal methods

3. **Admin Panel Updates**
   - Admin withdrawal requests now display USD amounts for all methods
   - Special handling for Stars: shows star count + USD equivalent
   - Format: `$X.XX [METHOD]` for TON/USD, `Y ⭐ ($X.XX)` for Stars

4. **Icons & UI**
   - Using lucide-react icons: Gem (TON), DollarSign (USD), Star (Stars)
   - Stars selection uses simple dropdown (not popup)
   - Clean, consistent UI across all withdrawal methods

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (via Drizzle ORM)
- **Authentication**: Telegram WebApp Auth
- **Styling**: Tailwind CSS + shadcn/ui components

## Database Schema
- Users table includes: `balance` (PAD as integer), `usdBalance` (USD), `tonBalance` (TON for advertiser tasks)
- Withdrawals table stores: amount, method, status, details (including payment addresses)
- Conversion rates:
  - 10,000 PAD = 1 USD
  - Note: "TON" in withdrawal methods refers to TON blockchain payment method, not currency conversion

## Deployment Configuration
- Development: Port 5000 (Vite dev server + Express backend)
- Environment variables required: DATABASE_URL
- Optional: TELEGRAM_BOT_TOKEN (for Telegram notifications)

## User Preferences
None documented yet.

## Known Issues
None currently tracked.
