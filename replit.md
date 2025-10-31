# Overview

CashWatch is a React-based web application that allows users to earn cryptocurrency by watching advertisements. It offers a gamified experience with features like daily streaks, a referral system, and cryptocurrency withdrawal capabilities. The platform aims to provide an engaging and user-friendly way for users to earn cryptocurrency, leveraging a modern full-stack architecture.

**Admin Features:**
*   Promo Code Creation
*   User Tracking
*   Withdrawal Management
*   Analytics Dashboard

# Recent Changes

**October 31, 2025 - Task System Security & UX Improvements + Ad Anti-Cheat**

*Task System Enhancements:*
*   **Title Validation**: Task titles now validate against URL patterns (https://, t.me/, .com, .net, .org, .io, www.) to prevent link spam
*   **Notification Update**: Task creation shows only "Task created successfully ✅" message
*   **Link Auto-Fix**: Task start button automatically prepends https:// to links missing protocol
*   **UI Cleanup**: Removed "Cost per click", "Reward per click", and "Total cost" fields from task creation form
*   **Verify Button Enhancement**: Verify Channel button changes from default to blue when valid Telegram link is entered, and green when verified
*   **Testing**: All changes verified by architect review

*Ad Watching Anti-Cheat System:*
*   **3-Second Minimum**: Implemented hidden timer requiring users to watch ads for at least 3 seconds
*   **Cheat Prevention**: If ad is closed before 3 seconds, user sees "Claiming too fast!" error (red) and receives no reward
*   **Normal Flow**: Users who watch for 3+ seconds receive reward as expected
*   **Implementation**: Silent background timer using Date.now() to track watch duration
*   **Status**: ✅ Complete and ready for production use

**October 30, 2025 - Create Task Page Routing Fix**

*Bug Fix:*
*   **Issue**: Task create page was not accessible - clicking "+Task" button resulted in a blank/loading screen
*   **Root Cause**: CreateTask component was not imported and no route was defined for `/create-task` in App.tsx
*   **Fix Applied**: 
    - Added lazy import for CreateTask component in App.tsx
    - Added route definition for `/create-task` path in the Router component
*   **Status**: ✅ Task create page now loads correctly and is fully functional

**October 30, 2025 - Pending Withdrawals Admin Button Added**

*Telegram Bot Admin Panel Enhancement:*
*   **New Feature**: Added "Pending Withdrawals" button to the `/szxzyz` admin panel
*   **Button Location**: Appears below the "Announce" and "Refresh" buttons in the admin control panel
*   **Functionality**:
    - Fetches all pending withdrawal requests from the database
    - Displays each withdrawal with user information, amount, method, wallet address, and creation date
    - Shows "Approve" and "Reject" buttons for each withdrawal request
    - Implements pagination for handling more than 10 pending requests (10 per page with Previous/Next buttons)
    - Shows "No pending withdrawal requests found" message when there are no pending withdrawals
*   **Admin Actions**:
    - Click "Approve" to approve a withdrawal (user receives notification with payment confirmation)
    - Click "Reject" to reject a withdrawal (admin is prompted to enter rejection reason, user receives notification)
*   **Security**: Only admins (verified via TELEGRAM_ADMIN_ID) can access and use this feature
*   **Testing**: Architect verified implementation follows existing patterns and has no security issues
*   **Status**: ✅ Complete and ready for production use

**October 30, 2025 - Task System UX Improvements & Notification Standardization**

*Task System UX Enhancements:*
*   **Task Creation Flow**: 
    - Modal now closes automatically after successful task creation
    - Replaced toast notifications with AppNotification for consistent UX
    - Feed automatically refreshes to show newly created tasks
*   **Task Card Layout**: 
    - Redesigned task cards to be compact and minimal
    - Display format: Icon + Title + Reward + [Start]/[Check] button
    - Removed progress bars and unnecessary text like click counters
    - Card padding reduced from p-4 to p-3 for tighter layout
*   **Add More Clicks System**: 
    - Added visible close (×) button in top-right corner of modal
    - Modal closes automatically after successful click addition
    - Updated all notifications to use AppNotification with message "Clicks added successfully!"
    - TON balance verification already implemented, now shows proper error: "Insufficient TON balance"
*   **Start/Check Button Behavior**: 
    - Button changes from "Start" to "Check" after user clicks task link
    - Properly handles Telegram channels with `tg://resolve?domain=` format
    - Telegram bots open directly in Telegram app
    - External websites open in new browser tab
    - After successful completion, task is removed from feed
*   **Notification System**: 
    - All notifications (success, error, validation) now use AppNotification component
    - Replaced all toast() calls with showNotification() for consistency
    - Smooth animations on all user-facing messages
    - Validation errors for task creation and click additions now use AppNotification
*   **Testing**: All changes verified by architect, ready for production deployment
*   **Status**: ✅ Complete UX overhaul verified, ready for production

**October 29, 2025 - Task Creation UI Updates & Database Fix**

*Task Creation System Improvements:*
*   **Database Fix**: Created missing `advertiser_tasks` and `task_clicks` tables in the database
*   **UI Updates**: 
    - Moved "+Task" button to top header (right side, next to "Set Wallet" button)
    - Removed "Cost Summary" section from task creation form
    - Updated submit button to show cost: "Pay X TON & Publish"
    - Removed emojis from notification messages
*   **Backend**: TON balance deduction logic already implemented in `/api/advertiser-tasks/create` endpoint (lines 3051-3056 in server/routes.ts)
*   **Migration**: Updated `server/migrate.ts` to automatically create task tables on future deployments
*   **Status**: ✅ Task creation system is now fully functional

**October 28, 2025 - Broadcast Functionality Enhancement**

*Telegram Bot Broadcast Improvements:*
*   **Issue**: Admin broadcast messages used plain text links instead of interactive buttons
*   **Fix Applied**: 
    - Replaced plain text footer links with Telegram inline buttons in `server/telegram.ts`
    - "🚀 Open App" button (web_app type) opens the application directly
    - "🤝 Join Community" button (URL type) links to Telegram channel
    - Improved rate limiting with batched sending (25 messages/batch, 1 second pause between batches)
    - Maintains ~25 messages/second to stay within Telegram's 30 msg/s rate limit
*   **How It Works**:
    - Admin uses `/szxzyz` command to open admin panel
    - Clicks "🔔 Announce" button to start broadcast
    - Types broadcast message (with "❌ Cancel Broadcast" option available)
    - Message is sent to all users with inline buttons
    - Deduplication ensures one message per unique telegram_id
    - Admin receives detailed summary: success count, failed count, skipped count
*   **Testing**: Requires TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_ID environment variables
*   **Status**: ✅ Verified by architect, ready for production use

**October 25, 2025 - Replit Environment Setup & Multi-Account Prevention Fix**

*Replit Environment Setup:*
*   **GitHub Import Setup**: Successfully configured project for Replit environment
*   **Database**: Provisioned PostgreSQL database and ran migrations successfully
*   **SQL Fix**: Replaced SQL template literals with parameterized queries in `upsertTelegramUser` function
    - Changed from `db.execute(sql`...`)` to `pool.query(query, values)` with `$1, $2, ...` syntax
    - Prevents SQL syntax errors and improves security
*   **Development Workflow**: Configured workflow on port 5000 with `allowedHosts: true` for Replit proxy compatibility
*   **Deployment**: Set up autoscale deployment configuration for production

*Multi-Account Prevention Fix:*
*   **Issue**: Users could create multiple accounts from the same device despite one-account-per-device policy
*   **Root Cause**: `useAuth.ts` authentication function was not sending device headers (`x-device-id`, `x-device-fingerprint`)
*   **Fix Applied**: 
    - Updated `authenticateWithTelegram` in `useAuth.ts` to include device tracking headers
    - Device ID and fingerprint now sent with all Telegram authentication requests
    - Added error handling for banned accounts
*   **How It Works**:
    - Each device generates a unique ID stored in localStorage
    - Backend checks if device ID already has an associated account
    - If duplicate detected: new account is banned, primary account receives warning
*   **Testing**: Device validation only works in production with real Telegram users (development mode bypasses device checks)
*   **Status**: ✅ Fix verified by architect, ready for production testing

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
*   **Frameworks**: React with TypeScript, Vite.
*   **Routing**: Wouter.
*   **State Management**: TanStack Query.
*   **UI/UX**: shadcn/ui, Radix UI, Tailwind CSS, custom CSS for theming (light/dark mode), Framer Motion for animations. Features a diamond-themed UI with a cyan and silver palette, frosted glass cards, glow effects, and sparkle animations.
*   **Forms**: React Hook Form with Zod validation.
*   **Navigation**: Curved bottom navigation with Lucide React icons.

## Backend Architecture
*   **Runtime**: Node.js with Express.js.
*   **Database ORM**: Drizzle ORM with PostgreSQL.
*   **API**: RESTful API with JSON responses.
*   **Session Management**: Express sessions with PostgreSQL store.

## Authentication & Authorization
*   **Provider**: Replit OAuth (OpenID Connect).
*   **Session Strategy**: Server-side sessions with secure HTTP-only cookies.
*   **Authorization**: Middleware-based route protection.
*   **User Management**: Automatic user creation/updates on authentication.

## Data Storage
*   **Primary Database**: PostgreSQL via Neon serverless.
*   **Schema Management**: Drizzle migrations.
*   **Key Entities**: Users (balance, streaks, referrals), Earnings, Withdrawals, Referral relationships, Sessions.

## Business Logic Features
*   **Ad Watching System**: Users earn 30 PAD (0.0003 TON) per ad with a cooldown.
*   **Spin & Win System**: Gamified reward system with daily resets at 00:00 UTC, offering various cryptocurrency rewards.
*   **Daily Streak Rewards**: Users earn daily PAD, with a bonus on the 5th consecutive day, requiring ad watch and Telegram channel membership. Resets daily at 00:00 UTC.
*   **Referral Program**: Multi-level commission system for referred users' ad earnings.
*   **Withdrawal System**: Supports multiple payment methods, requiring a minimum number of invited friends and admin approval.
*   **Currency Conversion**: All internal values are in TON, displayed as PAD (1 TON = 100,000 PAD).

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

## Ad Integration
*   **Ad Provider**: External advertisement service integrated via the global window object.