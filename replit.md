# Overview

CashWatch is a React-based web application that enables users to earn cryptocurrency by engaging with advertisements. It offers a gamified experience, including daily streaks, a referral program, and cryptocurrency withdrawal functionalities. The platform aims to provide an engaging and user-friendly method for cryptocurrency earning, built on a modern full-stack architecture.

**Key Features:**
*   Ad-watching for cryptocurrency rewards
*   Gamified earning (Spin & Win, Daily Streaks)
*   Multi-level referral system
*   Cryptocurrency withdrawal management
*   Admin panel for promo codes, user tracking, withdrawal management, and analytics
*   **Dynamic Settings**: All app parameters (task costs, rewards, fees, limits) are configurable through admin dashboard and stored in database

# Recent Changes (November 3, 2025)

## Leaderboard UI/UX Improvements (Latest - November 3, 2025)

### Home Page Leaderboard Preview
*   **Removed emoji decoration**: Removed 🏆 emoji from user display for cleaner look
*   **Profile photo emphasis**: User's Telegram profile photo now prominently displayed (40px circle)
*   **Horizontal layout**: Username and PAD amount arranged horizontally (PAD on the right side)
*   **Trophy icon**: Using proper SVG Trophy icon for the heading instead of emoji
*   **Balanced spacing**: Clean, minimal design with spacing consistent with other cards

### Leaderboard Page Updates
*   **Top 10 PAD Earners**: Changed from top 50 to top 10 users ranked by monthly PAD earnings
*   **Top 50 Referrers**: Maintained top 50 users ranked by total referrals count
*   **Updated display layout**: 
    - Profile photo + username + rank on the left
    - PAD amount/referral count on the right side for better readability
    - Real Telegram avatars displayed (not default placeholders)
*   **"Your Rank" Section**: 
    - Added below both leaderboards showing user's current position
    - Displays user's rank with total PAD earned or total referrals
    - Example: "You are currently #14 in PAD Earners"
    - Only shown if user is not in Top 10 (PAD Earners) or Top 50 (Top Referrers)
    - Uses special border styling (border-primary/30) to highlight user's position

### Backend Improvements
*   **User rank calculation**: `getMonthlyLeaderboard()` now accepts optional userId parameter
*   **Rank data included**: API returns `userEarnerRank` and `userReferrerRank` with rank and stats
*   **Optimized queries**: Separate queries for top lists and user rank calculation

## TON Wallet Integration (November 2, 2025)

### Wallet Validation Update
*   **TON Wallet Address Support**: Wallet system now exclusively accepts TON wallet addresses (UQ or EQ prefix, 48 characters total)
    - Frontend validation enforces regex pattern: `/^(UQ|EQ)[A-Za-z0-9_-]{46}$/`
    - Backend validation matches frontend across all 3 endpoints (`/api/wallet/cwallet`, `/api/set-wallet`, `/api/wallet/change`)
    - All user-facing text updated from "Cwallet ID" to "TON wallet address"
    - Close button removed from wallet setup dialog for cleaner UX
    - Clear validation error messages: "Please enter a valid TON wallet address"
    - Help text updated with link to official TON wallet resources
*   **Comprehensive Error Messaging**: All withdrawal and wallet-related error messages now use consistent "TON wallet address" terminology

## New Features & Bug Fixes - Leaderboard & Task System

### Leaderboard Feature
*   **Monthly Leaderboard Page**: New dedicated page (`/leaderboard`) showing top performers with tab switcher
    - **PAD Earners Tab**: Top 50 users ranked by monthly PAD earnings with compact number formatting (1k, 1.2M, 1B)
    - **Top Referrers Tab**: Top 50 users ranked by total referrals count
    - Swappable tabs similar to admin dashboard for easy navigation
    - Profile photos, usernames, and rankings (🥇🥈🥉) displayed for each user
*   **Home Page Leaderboard Preview**: Replaced "Income Statistics" section with clickable Leaderboard preview card showing #1 earner
*   **Backend API Endpoints**: Added `/api/leaderboard/top` and `/api/leaderboard/monthly` for real-time leaderboard data
*   **Number Formatting Helper**: Added `formatCompactNumber()` utility to display large numbers in readable format (1,000 → 1k, 1,200,000 → 1.2M, etc.)

### Task System Fix
*   **Start/Check Button Reset**: Fixed task button to show "Start" again when join verification fails, preventing users from getting stuck
    - When user clicks "Check" but hasn't joined the channel/bot, button now resets to "Start" allowing retry
    - Error handler in `clickTaskMutation.onError` removes task from clicked state on failure

## Bug Fixes - Task Deletion & Withdrawal Notifications

*   **Task Deletion Foreign Key Fixed**: Added CASCADE constraint to `task_clicks.task_id` foreign key. Tasks can now be deleted safely, automatically removing all associated click records without foreign key errors.
*   **Admin Settings Migration Fixed**: Updated migration logic to safely remove duplicate `setting_key` entries before adding unique constraint. Migration now works on both fresh and existing databases without data truncation.
*   **Withdrawal Notification Fixed**: Changed WithdrawDialog error notifications from shadcn/ui toast (hidden behind dialog) to `showNotification` with z-index 99,999. Users now see clear minimum withdrawal messages: "❌ Minimum withdrawal: 1,000,000 PAD (0.1 TON)"

## Earlier Bug Fixes - Error Handling & Notifications

*   **Error Notification Display Fixed**: Updated API error handling to display clean, user-friendly error messages instead of raw JSON strings. The `throwIfResNotOk` function now parses JSON error responses and extracts the `message` field, ensuring users see messages like "Insufficient balance. You need 5000 PAD" instead of `"{\"success\":false,\"message\":\"...\"}"`.
*   **Currency Precision Fix**: Changed all TON↔PAD conversions from `Math.floor()` to `Math.round()` to prevent sub-PAD precision loss (e.g., 5,500 PAD no longer truncates to 5,499 PAD).
*   **Task Reward Calculation Fixed**: Corrected TON↔PAD conversion in admin settings API. Task per-click rewards now properly convert between PAD (user-facing) and TON (database storage) using 10,000,000 multiplier.
*   **Withdrawal Button UX Improved**: Withdrawal button no longer disabled when balance is below minimum. Users can click to see informative notification displaying minimum withdrawal amount in both PAD and TON formats.
*   **Admin Settings Notifications**: Added success notifications with visual feedback (✅) when admin updates settings. Both /api/admin/settings and /api/app-settings caches are invalidated to ensure immediate propagation of new values.
*   **Notification Z-Index**: Increased notification z-index from 9,999 to 99,999 to ensure notifications appear above all UI layers including modals and dialogs.

## Earlier Changes

*   **Removed All Hardcoded Values**: Replaced all hardcoded constants with dynamic values fetched from admin settings API
*   **Expanded /api/app-settings Endpoint**: Now returns all admin settings (taskCostPerClick, taskRewardPAD, walletChangeFee, affiliateCommissionPercent, minimumWithdrawal, minimumConvertPAD)
*   **Task System Updates**: Backend filters out completed tasks before sending to frontend; task rewards use direct PAD values from database
*   **Converter UI Fix**: Minimum converter amount now displays in PAD format for clarity
*   **Real-time Updates**: All settings refresh automatically on page load from database without requiring redeployment

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
*   **Frameworks**: React with TypeScript, Vite.
*   **Routing**: Wouter.
*   **State Management**: TanStack Query.
*   **UI/UX**: shadcn/ui, Radix UI, Tailwind CSS, custom CSS for theming (light/dark mode), Framer Motion for animations. Features a diamond-themed UI with a cyan and silver palette, frosted glass cards, glow effects, and sparkle animations.
*   **Forms**: React Hook Form with Zod validation.
*   **Navigation**: Curved bottom navigation with Lucide React icons.
*   **Anti-Cheat**: Implemented a 3-second minimum ad watch time to prevent fast claiming.

## Backend
*   **Runtime**: Node.js with Express.js.
*   **Database ORM**: Drizzle ORM with PostgreSQL.
*   **API**: RESTful API with JSON responses.
*   **Session Management**: Express sessions with PostgreSQL store.
*   **Telegram Bot**: Integration for admin controls, broadcasts, and user notifications.
*   **Security**: Parameterized queries for database interactions, device tracking for multi-account prevention.

## Authentication & Authorization
*   **Provider**: Replit OAuth (OpenID Connect).
*   **Session Strategy**: Server-side sessions with secure HTTP-only cookies.
*   **Authorization**: Middleware-based route protection.
*   **User Management**: Automatic user creation/updates on authentication, device ID-based multi-account prevention.

## Data Storage
*   **Primary Database**: PostgreSQL.
*   **Schema Management**: Drizzle migrations.
*   **Key Entities**: Users (balance, streaks, referrals), Earnings, Withdrawals, Referral relationships, Sessions, Advertiser Tasks, Task Clicks.

## Business Logic
*   **Ad Watching System**: Users earn 30 PAD (0.0003 TON) per ad with cooldowns and a 3-second minimum watch time.
*   **Spin & Win System**: Daily gamified rewards.
*   **Daily Streak Rewards**: Earn PAD daily with bonuses for consecutive days, requiring ad watch and Telegram channel membership.
*   **Referral Program**: Multi-level commission on referred users' ad earnings.
*   **Withdrawal System**: Multiple payment methods, minimum friend invite requirement, admin approval.
*   **Currency Conversion**: Internal values in TON, displayed as PAD (1 TON = 100,000 PAD).
*   **Admin Controls**: Comprehensive settings for affiliate commission, wallet change fees, minimum withdrawal, task rewards, task creation cost, and balance conversion. Broadcast functionality with inline Telegram buttons.
*   **Task System**: Users can create tasks (e.g., join Telegram channels) for others to complete, with title validation and auto-link correction.

# External Dependencies

## Core Infrastructure
*   **Database**: Neon PostgreSQL serverless.
*   **Authentication**: Replit OAuth/OIDC.
*   **Session Storage**: `connect-pg-simple`.
*   **Telegram Bot API**: `node-telegram-bot-api`.

## Frontend Libraries
*   **UI**: Radix UI, Tailwind CSS.
*   **State Management**: TanStack Query.
*   **Form Management**: React Hook Form, Zod.
*   **Date Handling**: `date-fns`.
*   **Animations**: Framer Motion.

## Ad Integration
*   **Ad Provider**: External advertisement service integrated via the global window object.