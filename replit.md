# CashWatch - PAD Earning & Withdrawal Platform

## Overview
CashWatch is a Telegram-based earning platform where users earn PAD currency by watching ads, completing tasks, and referring others. It enables conversion of PAD to USD and offers multi-payment withdrawals. The platform also supports direct PDZ token top-ups via ArcPay, aiming to provide a seamless experience for digital currency management within Telegram. The project's vision is to become a leading platform for micro-tasking and digital currency earning within the Telegram ecosystem, targeting a broad user base interested in supplementary income.

## User Preferences
- Task type icons should be small and compact (w-4 h-4 with p-2.5 padding)
- Icon-only display for task categories (no text labels)

## System Architecture

### UI/UX Decisions
- **Iconography**: Uses `lucide-react` for a professional icon set.
- **Navigation**: Features a 5-item bottom navigation bar: Store, Task, Home, Affiliates, Withdraw.
- **Component Design**: Leverages shadcn/ui and Tailwind CSS for consistent styling, including gradient effects for toggles.
- **Input Handling**: Supports decimal inputs for financial transactions with 2-decimal display formatting.
- **Validation**: Provides real-time client-side validation and clear error messages.
- **Responsive Design**: Fixed 16px base font size, `viewport-fit=cover`, device-specific padding, custom fixed sizing classes, safe area support, and touch optimization for consistent mobile experience.

### Technical Implementations
- **Stack**: React, TypeScript, Vite (frontend); Express.js, Node.js (backend); PostgreSQL with Drizzle ORM (database).
- **Authentication**: Telegram WebApp Authentication.
- **Currency Conversion**: API endpoint for PAD to USD conversion (10,000 PAD = 1 USD).
- **Withdrawal System**: Supports TON blockchain only with package-based withdrawals. Users select from preset packages ($0.20, $0.40, $0.80) or FULL balance withdrawal. Each package requires proportional BUG balance (calculated via `bugPerUsd` multiplier). Both USD and BUG are deducted on successful withdrawal. 5% fee with server-enforced minimums. Fee (5000 PAD) for changing existing TON wallet details.
- **ArcPay Integration**: Full integration for PDZ top-ups, including secure API credential handling, retry logic, and a webhook for payment notifications.
- **Earning Mechanics**: Includes Faucetpay (+1 PAD), Referral System, and Ad Rewards, all managed as PAD integers.
- **Number Formatting**: Uses compact notation (1k, 1M) for large PAD amounts.
- **PAD Balance Handling**: Ensures PAD rewards are stored as integers, with auto-conversion for legacy TON balances.
- **Data Persistence**: Employs a dual storage strategy (IndexedDB primary, localStorage fallback) with a custom `PersistentStorage` class for robust data saving, auto-sync, and fallback handling.
- **Mandatory Channel & Group Join Security**: Locks app access until users join specified Telegram channel and group, verified in real-time on every app launch.
- **Ad Watch System**: Implements hourly (60 ads) and daily (500 ads) limits with a countdown timer for hourly resets.
- **Ad Requirements**: Requires watching Monetag + AdGram ads for Daily Check-in and Promo Code redemption.
- **Native Share Dialog**: Utilizes Telegram's `shareMessage()` API for rich, native sharing experiences, with fallbacks.

### Feature Specifications
- **Top-Up PDZ**: `/topup-pdz` route with ArcPay, minimum 0.1 TON.
- **Withdrawal Toggle**: Custom grid toggle for "Withdraw" and "Wallet Setup".
- **Health Check**: `/api/health` endpoint for system diagnostics.
- **Task Category System**: Three icon-based task types (Channel, Bot, Partner) with a 3-second countdown before claim. Partner tasks are admin-only with a fixed 5 PAD reward.
- **Ad Sequence**: Monetag popup first, then AdGram for streak/promo code claims.
- **Home Page Display**: Prioritized display of Telegram username.
- **Withdrawal Requirements**: Admin-controlled for invites and ad watches, with dynamic error messages.
- **Daily Missions**: Includes "Check for Updates" mission rewarding 5 PAD, requiring an ad flow for claiming.
- **Store Page**: New `/store` route showcasing income boosters with various durations and a 0% withdrawal fee booster (UI only).

### System Design Choices
- **Configuration**: Environment variable-driven for all sensitive credentials.
- **Development Workflow**: Vite dev server with Express backend, Replit PostgreSQL for database.
- **Security**: No hardcoded secrets, server-side private keys, backend-only API key usage.
- **Auto-Ban System**: Detects suspicious multi-account activity (device ID, IP, fingerprint, self-referral), logs ban history, and provides admin controls for management and unban.

## External Dependencies
- **PostgreSQL**: Main database, managed by Drizzle ORM.
- **Telegram WebApp Auth**: For user authentication.
- **ArcPay Payment Gateway**: For PDZ token top-ups and payment processing.
- **lucide-react**: Icon library.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Styling framework.

## Recent Changes

### December 2024 - Country Blocking System Fix
- **Complete country blocking system**: Server-side middleware blocks users from restricted countries before serving the app.
- **Admin panel improvements**: CountryControls.tsx now displays admin's current country/IP and has working toggle buttons.
- **API endpoints**: 
  - `GET /api/countries` - List all countries
  - `GET /api/blocked` - List blocked country codes
  - `GET /api/user-info` - Get user's IP and detected country
  - `POST /api/block-country` - Block a country (admin only)
  - `POST /api/unblock-country` - Unblock a country (admin only)
- **Middleware flow**: IP detection via x-forwarded-for → ip-api.com lookup → database check → block with HTML page or allow.
- **Database table**: `blocked_countries` stores blocked country codes.

### December 2024 - Promo Code Bug Fix
- **Fixed double-reward bug**: Removed duplicate `addEarning()` call from `storage.usePromoCode()` since `routes.ts` already handles balance updates for different reward types (PAD, TON, USD).
- **Fixed return format**: `usePromoCode()` now returns just the reward amount string, not "amount currency" format.
- **Consistent tracking**: All promo code redemptions now properly record earnings via `storage.addEarning()` in routes.ts after balance update.

## Development Setup

### Running the Application
```bash
npm install
npm run dev
```

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: For Telegram bot functionality
- `SESSION_SECRET`: For session management
- `TELEGRAM_ADMIN_ID`: Admin user's Telegram ID

### Port Configuration
- Frontend/Backend: Port 5000 (combined server)
- WebSocket: `/ws` endpoint on same port