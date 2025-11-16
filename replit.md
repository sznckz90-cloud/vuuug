# CashWatch - PAD Earning & Withdrawal Platform

## Project Overview
CashWatch is a Telegram-based earning platform where users can earn PAD currency by watching ads, completing tasks, and referring friends. Users can convert their PAD to USD and withdraw via multiple payment methods.

## Recent Changes (November 16, 2025)

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
- Users table includes: `balance` (PAD as TON), `usdBalance` (USD), `tonBalance` (TON wallet)
- Withdrawals table stores: amount, method, status, details (including payment addresses)
- Conversion rate: 10,000 PAD = 1 USD

## Deployment Configuration
- Development: Port 5000 (Vite dev server + Express backend)
- Environment variables required: DATABASE_URL
- Optional: TELEGRAM_BOT_TOKEN (for Telegram notifications)

## User Preferences
None documented yet.

## Known Issues
None currently tracked.
