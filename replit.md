# CashWatch - PAD Earning & Withdrawal Platform

## Overview
CashWatch is a Telegram-based earning platform designed for users to earn PAD currency through various activities such as watching ads, completing tasks, and referring new users. The platform allows users to convert their earned PAD into USD and facilitate withdrawals via multiple payment methods. Additionally, users can top-up PDZ tokens directly using the ArcPay payment gateway. The project aims to provide a seamless and engaging experience for earning and managing digital currency within the Telegram ecosystem.

## User Preferences
- Task type icons should be small and compact (w-4 h-4 with p-2.5 padding)
- Icon-only display for task categories (no text labels)

## System Architecture

### UI/UX Decisions
- **Iconography**: Utilizes `lucide-react` for professional icons across the platform, replacing emojis for a more refined look (e.g., Sparkles for "Create Task", CircleDollarSign for "Withdraw", Gem for TON, DollarSign for USD, Star for Telegram Stars).
- **Navigation**: Bottom navigation bar with 5 items in order: Store, Task, Home, Affiliates, Withdraw.
- **Component Design**: Consistent use of shadcn/ui components and Tailwind CSS for styling. Toggle systems (e.g., for Withdraw and Wallet Setup sections) match gradient styling (`from-cyan-500/20 to-blue-500/20`) and shadow effects.
- **Input Handling**: Decimal support for financial inputs (e.g., 0.1, 0.5, 1.25), with 2-decimal formatting for display.
- **Validation Feedback**: Real-time client-side validation and clear error messages for user inputs.

### Technical Implementations
- **Frontend**: Built with React, TypeScript, and Vite.
- **Backend**: Implemented using Express.js and Node.js.
- **Database**: PostgreSQL managed via Drizzle ORM.
- **Authentication**: Telegram WebApp Authentication.
- **PAD/USD Conversion**: Dedicated API endpoint (`/api/convert-to-usd`) to convert PAD to USD, deducting PAD and adding USD to user balances. Conversion rate: 10,000 PAD = 1 USD.
- **Withdrawal System**:
    - Supports TON blockchain payment method only (USDT and Telegram Stars removed December 2025)
    - Fee structure: TON (5% fee, $0.50 min)
    - Minimum withdrawal amounts enforced server-side
    - 3-tab layout: Withdraw • Wallet Setup • Wallet Activity
    - TON wallet required before withdrawal submission
    - Wallet activity moved from hamburger menu to withdraw page
- **ArcPay Integration**:
    - Full integration for PDZ token top-ups.
    - Secure handling of ArcPay API credentials via environment variables.
    - Robust error handling, retry logic (3 attempts with exponential backoff), and development mode for mock checkouts.
    - Webhook endpoint for payment notifications.
- **Wallet Management**:
    - Wallet setup integrated into the Withdraw page as a tab.
    - Fee (5000 PAD) charged for changing existing TON wallet details; first-time setup is free.
- **Earning Mechanics**:
    - **Faucetpay**: Renamed from "Daily Streak", rewards +1 PAD.
    - **Referral System**: Commissions stored as PAD integers.
    - **Ad Rewards**: Processed and stored as PAD integers.
- **Number Formatting**: Utilizes compact number notation (1k, 20k, 1M, 1B, 1T) for large PAD amounts, particularly in leaderboards.
- **PAD Balance Handling**: Critical fix ensures PAD rewards and balances are stored as integers rather than TON decimal formats, with auto-conversion for legacy TON balances upon display.

### Feature Specifications
- **Top-Up PDZ**: Dedicated `/topup-pdz` route with ArcPay integration. Minimum top-up amount of 0.1 TON, with clear UI/UX for input, summary, and payment flow.
- **Withdrawal Toggle**: Replaced Radix Tabs with a custom grid toggle for "Withdraw" and "Wallet Setup" sections.
- **Health Check Endpoint**: `/api/health` checks database connectivity, environment variables, and WebSocket activity.
- **Task Category System**: 
    - Three task types: Channel (blue), Bot (purple), Partner (green)
    - Icon-based category filtering on Tasks page
    - Partner tasks: Admin-only creation, any link type allowed, fixed 5 PAD reward
- **Ad Sequence for Claims**: Monetag popup first, then AdGram popup automatically for streak/promo code claims
- **Home Page Username Display**: Shows telegram_username > username > firstName > "Guest" in priority order

### System Design Choices
- **Environment Variable Driven Configuration**: All sensitive credentials (API keys, secrets) are loaded from environment variables (e.g., `ARCPAY_API_KEY`, `ARCPAY_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`).
- **Development Workflow**: Vite dev server integrates with Express backend on port 5000. Replit PostgreSQL (`helium`) is used for the database.
- **Security**: Zero hardcoded secrets, private keys are server-side only, and API keys are used exclusively in the backend.

### Data Persistence System (November 2025)
- **Dual Storage Strategy**: Uses IndexedDB as primary storage with localStorage fallback for maximum persistence
- **PersistentStorage Class**: Custom wrapper that handles IndexedDB initialization, error recovery, and graceful degradation
- **Write Strategy**: All writes go to localStorage synchronously first (for reliability), then to IndexedDB asynchronously
- **Read Strategy**: Reads from both storage layers and returns the most recent data based on timestamps
- **Event Handlers**: beforeunload uses synchronous saves; visibilitychange uses both sync and async saves
- **Auto-Sync**: User data automatically synced to persistent storage every 30 seconds and on page hide/unload
- **Fallback Handling**: Timeout-based fallback (3 seconds) if IndexedDB fails to initialize

### Responsive UI System (November 2025)
- **Fixed Base Font Size**: 16px on all screen sizes to prevent scaling inconsistencies
- **Viewport Meta**: `viewport-fit=cover` with `user-scalable=no` for consistent mobile rendering
- **Media Queries**: Device-specific padding for small (320px), standard (375px), larger (428px+) screens
- **Fixed Sizing Classes**: Custom utility classes for fixed text, button, and icon sizes
- **Safe Area Support**: Proper padding for notched devices using `env(safe-area-inset-*)
- **Touch Optimization**: Disabled tap highlight and prevented accidental zooming

### Bug Fixes (December 2025)
- **Withdrawal UI Loading States**: Added `isLoadingRequirements` flag to prevent "locked" state flashing before data loads
- **Ad Watch Updates**: Query invalidation for `/api/withdrawal-eligibility` and `/api/referrals/valid-count` after ad completion
- **Referral Stats Consistency**: `/api/referrals/stats` now returns valid referral count (users who watched 1+ ads, not banned)
- **Ad Watch Section**: Simplified to Monetag-only flow for faster ad loading and instant rewards
- **Daily Missions System**: 
  - Fixed Share with Friends and Daily Check-in reward claims by updating requireAuth middleware to populate user from session
  - Created `daily_missions` table for tracking mission completions and claims per day
  - Daily Check-in now uses 3-second countdown flow matching Share with Friends pattern
  - Added migration to ensure daily_missions table is auto-created on server startup
- **Lucky Slots Removal**: Completely disabled Lucky Slots/FreeSpin feature - page deleted, API routes blocked, UI references removed
- **Task Logic**: All task types (Channel, Bot, Partner) use 3-second countdown before claim is available
- **TypeScript Fixes**: Resolved switchInlineQuery type errors in Affiliates and Withdraw pages using type assertions
- **Native Share Dialog (December 2025)**: Implemented native Telegram share dialog using `shareMessage()` API
  - Uses Bot API 8.0 `savePreparedInlineMessage` on backend to prepare share messages
  - Frontend calls `Telegram.WebApp.shareMessage(messageId)` for native share dialog
  - Shows message preview with image + caption + inline WebApp button
  - User selects chat/group/channel directly from Telegram's native share interface
  - NO message goes to bot, NO forwarding required - direct share to selected contacts
  - Backend endpoint: `/api/share/prepare-message` prepares the share message
  - Fallback chain: `shareMessage()` → `openTelegramLink(t.me/share/url)` → `window.open()`
  - Applied to: Affiliates page, Withdraw page, Missions page

### New Features (December 2025)
- **Ad Watch System with Hourly/Daily Limits** (December 2025):
  - Hourly limit: 60 ads per hour (admin configurable)
  - Daily limit: 500 ads per day (admin configurable)
  - Timer lock: When hourly limit reached, countdown timer (HH:MM:SS) is displayed
  - Auto-reset: After timer expires, 60 new ads become available
  - UI shows progress bars for both hourly and daily limits
  - Admin panel: Hourly Ad Limit and Daily Ad Limit controls in Ads & Rewards section
  - New database fields: `adsWatchedThisHour`, `hourlyWindowStart` in users table
  - New API endpoint: `/api/ads/limits` returns current limit status and timer info
- **Daily Check-in Ads Requirement**: Users must watch Monetag + AdGram ads before claiming Daily Check-in reward
  - Created reusable `useAdFlow` hook for ad flow management
  - Ads shown sequentially: Monetag first (minimum 3 seconds), then AdGram
  - Claim button only becomes active after both ads are completed
- **Check for Updates Task**: New daily mission that rewards 5 PAD
  - Opens https://t.me/PaidADsNews when clicked
  - 3-second countdown after visiting, then claim becomes available
  - Backend route: `/api/missions/check-for-updates/claim`
- **Promo Code Ads Requirement**: Users must watch Monetag + AdGram ads before redeeming promo codes
  - Applied to HamburgerMenu promo code redemption flow
  - Same ad sequence as Daily Check-in
- **Native Share Dialog** (December 2025 Update): Share With Friends now uses Telegram's native `shareMessage()` API
  - Uses `savePreparedInlineMessage` (Bot API 8.0) to prepare rich media share messages
  - Share message includes: Image banner, caption, and "🚀 Start Earning" WebApp button
  - Referral links use WebApp deep-link format: `https://t.me/{bot}/{webAppName}?startapp={code}`
  - Backend endpoint `/api/share/prepare-message` returns messageId for `shareMessage()`
  - Share banner image stored in `/client/public/images/share-banner.jpg`
  - Fallback to `t.me/share/url` for older Telegram clients
- **Performance Optimizations**:
  - Affiliates page: Increased staleTime to 60s, gcTime to 300s, disabled refetchOnMount for faster loading
  - Withdraw page: Optimized referral count and withdrawal eligibility queries with better caching
  - Share banner image stored in `/client/public/images/share-banner.jpg`
- **Store Page** (December 2025): New booster shop UI at `/store` route
  - Displays 8 income boosters with modern dark theme cards
  - Booster types: +10%, +20%, +25%, +50% income boosts (1 day or 1 week durations)
  - One-time 0% withdrawal fee booster option
  - Premium card design with gradient backgrounds, icons, duration badges, and Buy buttons
  - UI only - no backend logic implemented yet

### Auto-Ban System (November 2025)
- **Detection Triggers**: 
  - Multiple accounts on same device ID
  - Same IP + device fingerprint correlation
  - Self-referral (same device/IP/fingerprint as referrer)
  - Multi-account ad watching patterns
- **Ban History Logging**: Complete ban logs stored with UID, device ID, IP, telegram ID, app version, browser fingerprint, reason, date/time, referrer UID
- **Admin Panel Features**:
  - "Bans" tab with banned users list and ban history
  - Filtering by date, device ID, IP, and reason
  - Manual unban button with confirmation
  - Search functionality for ban records
- **Ban Screen**: Banned users see "Your account has been banned due to suspicious multi-account activity" message with all features disabled
- **Key Tables**: `ban_logs` (stores all ban events), enhanced `users` table with `app_version`, `browser_fingerprint`, `registered_at`, `referrer_uid` columns

## External Dependencies
- **PostgreSQL**: Primary database for all application data, managed via Drizzle ORM.
- **Telegram WebApp Auth**: Used for user authentication.
- **ArcPay Payment Gateway**: Integrated for PDZ token top-ups, handling payment creation and webhook notifications.
- **lucide-react**: Icon library for UI elements.
- **shadcn/ui**: Component library for UI elements.
- **Tailwind CSS**: Utility-first CSS framework for styling.