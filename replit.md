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

### December 19, 2024 - Task Verification and Claim System Fixes
- **Channel/Group Join Task Verification**: Added Telegram bot verification to `/api/tasks/complete/channel` and `/api/tasks/complete/community` endpoints. Users must now verify they joined the channel/group before receiving the reward.
- **Advertiser Task Claim System**: Modified advertiser tasks to require explicit claim step:
  - `/api/advertiser-tasks/:taskId/click` now only records the click without giving reward (shows "Task started! Click the claim button to earn your reward.")
  - New endpoint `/api/advertiser-tasks/:taskId/claim` for users to claim their earned reward after completing the task
  - Task clicks stored with `claimedAt` field to track claim status
  - Prevents auto-reward and ensures user intentionally claims after task completion

### December 2024 - Withdrawal Approval Bug Fix
- **Fixed "Insufficient USD balance" error during admin approval**: Previously, balance was incorrectly deducted at withdrawal request time AND checked again during approval, causing approval to fail.
- **Correct withdrawal flow now implemented**:
  1. On withdrawal REQUEST: Only validates balance (checks if sufficient funds exist), does NOT deduct balance
  2. On admin APPROVAL: Deducts both USD and BUG balance from user account
  3. On admin REJECTION: Balance remains unchanged (since it was never deducted)
- **Balance integrity**: User balance stays unchanged while withdrawal status is PENDING; balance is only deducted when admin approves
- **Legacy withdrawal support**: Handles withdrawals created before this fix (where balance was already deducted at request time):
  - APPROVAL: Detects legacy withdrawals (insufficient balance) and approves without deducting again
  - REJECTION: Automatically refunds the balance that was deducted at request time
- **Files modified**: `server/routes.ts` (removed balance deduction from request creation), `server/storage.ts` (approveWithdrawal and rejectWithdrawal now handle both new and legacy flows)

### December 2024 - Telegram Bot Notification Fixes
- **Referral Notification**: Only ONE message sent on FIRST AD with USD reward from Admin Settings (uses `firstAdWatched` flag to prevent duplicate notifications)
- **Commission Notification Removed**: Disabled spam notification on every ad watch - referral commission is still awarded but no Telegram notification is sent
- **Ban Message Fix**: Telegram bot ban message uses inline button "Contact Support" pointing to https://t.me/PaidAdzGroup (no plain text URL)
- **BanScreen Component**: Updated to redirect to https://t.me/PaidAdzGroup instead of PaidAdsCommunity
- **Payout Approved Message**: Uses "Share in Group" inline button pointing to https://t.me/PaidAdzGroup
- **Affiliate Page USD Balance**: Calculates totalUsdEarned as successfulInvitesCount * referralRewardUSD from admin settings (accurate real-time calculation)
- **Group Notification for Withdrawals**: Sends notification to PaidAdzGroup (chat ID: -1003402950172) with exact same format as admin notification when withdrawal request is created

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

### December 2024 - Referral Notification System Fix
- **Added missing notification functions**: Implemented `sendReferralRewardNotification` and `sendReferralCommissionNotification` in telegram.ts.
- **Referral activation notifications**: Referrers now receive Telegram notifications when their invited friends watch their first ad.
- **HTML escaping**: All user-provided names are properly sanitized before being included in notification messages to prevent Telegram parsing errors.
- **Notification format**: "New Referral Activity! Your friend watched their first ad. You earned X PAD."

### December 2024 - Real-time TON Balance Updates
- **Instant TON Balance Sync**: Implemented WebSocket-based real-time updates for TON top-ups.
- **Backend**: Added `sendRealtimeUpdate` call in ArcPay webhook handler to push new balance to the user.
- **Frontend**: Updated `useWebSocket` hook to handle `balance_update` messages, directly updating the React Query cache and invalidating user data for instant UI reflection.
- **UI Consistency**: TON Wallet Setup dialog updated to match Promo Popup design pattern (spacing, theme, buttons).

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