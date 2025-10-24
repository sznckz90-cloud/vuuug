# Overview

CashWatch is a React-based web application that enables users to earn cryptocurrency by watching advertisements. It offers a gamified experience with features like daily streaks, a referral system, and cryptocurrency withdrawal capabilities. The platform aims to provide an engaging and user-friendly way for users to earn cryptocurrency through a modern full-stack architecture.

**Admin Features:**
*   **Promo Code Creation**: Admins can create customizable promotional codes.
*   **User Tracking**: Monitor user activity, balances, earnings, and withdrawals.
*   **Withdrawal Management**: Approve or reject user withdrawal requests.
*   **Analytics Dashboard**: View platform statistics.

# Recent Changes

## October 24, 2025
*   **Initial Setup**: Successfully configured GitHub import to run in Replit environment
    *   Installed all npm dependencies
    *   Pushed database schema to PostgreSQL
    *   Configured Server workflow on port 5000 with Vite dev server
    *   Set up autoscale deployment with build and run commands
*   **PAD → TON Conversion Fix**: Fixed conversion button glitch
    *   Updated minimum conversion from 100,000 PAD to 10,000 PAD (0.001 TON)
    *   Synchronized client and server validation for consistent experience
    *   Conversion rate remains: 10,000,000 PAD = 1 TON
    *   TON balance updates instantly after conversion via database transaction
*   **Admin Dashboard Redesign**: Improved layout and data display
    *   Updated title to "👑 Admin Dashboard" (single line, no overflow)
    *   Removed "Modern platform analytics & management" subtitle and admin badge for cleaner look
    *   Reorganized analytics into vertical layout with no horizontal scroll
    *   Structured sections: User Stats, Ad Stats, Balance Stats, Total Requests (Pending/Approved/Rejected)
    *   All analytics pull real data from PostgreSQL database
*   **Streak Section UX Enhancement**: Updated streak dialog to match withdrawal section behavior
    *   Removed X close button from streak dialog
    *   Added dedicated "Close" button at bottom for clear exit action
    *   Prevented dialog from closing when clicking outside (requires explicit close button click)
    *   Improved user experience with consistent modal behavior across app
*   **Database Connection Fixes**: Fixed admin dashboard and promo code issues
    *   Fixed admin stats endpoint by adding missing `promoCodes` import - now pulls real data from database
    *   Fixed promo code conversion glitch: Changed from wrong rate (100,000) to correct rate (10,000,000)
    *   When creating 1 PAD promo, users now correctly receive 1 PAD (not 100 PAD)
    *   All admin analytics now display accurate data from PostgreSQL
*   **Icon Improvements**: Replaced emoji with proper icon components
    *   Changed crown emoji (👑) to Crown icon from lucide-react in Admin Dashboard
    *   More consistent and professional appearance across the app
*   **Streak Section Styling**: Updated streak dialog to match withdrawal section colors
    *   Applied frosted-glass effect with white/10 border for consistency
    *   Changed title and icon color to cyan (#4cd3ff) to match withdrawal section
    *   Updated streak counter display with dark background (bg-[#0d0d0d])
    *   Changed claim button to cyan color scheme with black text
    *   Unified visual language between streak and withdrawal dialogs

## October 23, 2025
*   **Critical Fixes**: Fixed three major user-facing issues
    *   **Ad Reward Notifications**: Made ad watching endpoint extremely robust with nested error handling to ensure success notifications always display. Non-critical failures (referral bonuses, commissions) are logged but don't affect user experience.
    *   **Withdrawal Unlock (Friends Count)**: Fixed 0/3 friends display issue. The `/api/auth/user` endpoint now always calculates `friendsInvited` from actual referrals in database and syncs the count, ensuring withdrawal unlock logic works correctly.
    *   **Wallet Setup Notifications**: Removed ⚠️ emoji from wallet error messages for cleaner, professional error handling.
*   **Data Persistence**: All fixes ensure proper database synchronization and data persistence across app reloads.
*   **Deployment**: Configured autoscale deployment with build and run commands for production.

## October 22, 2025
*   **Feature Removal**: Completely removed Task page from application
    *   Removed /tasks route from client routing
    *   Removed Tasks navigation item from bottom navigation bar
    *   Added middleware to block all /api/tasks/* endpoints (returns 403 error)
*   **UI Enhancement**: Added "Claim Streak" button directly to Home page for easier access
*   **Telegram Bot**: Complete bot overhaul - inline buttons only
    *   Simplified welcome message: "👋 Welcome to Paid Ads! Start earning crypto rewards now!"
    *   Removed all keyboard navigation (Account, Affiliates, How-to buttons)
    *   Removed task completion and referral commission notifications
    *   Bot now only handles: welcome messages, withdrawal notifications, and admin approval/rejection
    *   Admin receives withdrawal requests with inline Approve/Reject buttons
    *   Users receive instant notifications for approval/rejection via Telegram bot
*   **Withdrawal Flow Enhancements**:
    *   3 friend invite requirement: Withdrawal button locked until user invites ≥3 friends
    *   Balance deduction only occurs after admin approval (not on request submission)
    *   Wallet ID uniqueness validation prevents duplicate addresses
    *   Admin approval flow: Balance deducted → User notified → Buttons disabled
    *   Admin rejection flow: No balance change → User notified → Buttons disabled
    *   Added loading spinner animation to withdrawal request button
*   **Real-time Updates**: Enhanced withdrawal approval system with instant WebSocket updates
    *   Admin dashboard now gets real-time updates when withdrawals are approved/rejected
    *   User dashboard updates instantly without manual refresh
    *   Added WebSocket connection to admin page
    *   Broadcasts withdrawal status changes to all connected clients

## October 21, 2025
*   **Setup**: Successfully configured the project to run in Replit environment with PostgreSQL database
*   **Fix**: Admin withdrawal approval button now works correctly (status='success' is properly recognized)
*   **Fix**: Ad reward delay reduced to instant (<0.5s) - rewards now credit immediately when ad completes instead of waiting 4-5 seconds for SDK cleanup
*   **Deployment**: Configured autoscale deployment with proper build and run commands

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
*   **Frameworks**: React with TypeScript, Vite.
*   **Routing**: Wouter for client-side routing.
*   **State Management**: TanStack Query.
*   **UI/UX**: shadcn/ui, Radix UI, Tailwind CSS, custom CSS for theming (light/dark mode), Framer Motion for animations. Features a diamond-themed UI with a cyan and silver palette, frosted glass cards, glow effects, and sparkle animations.
*   **Forms**: React Hook Form with Zod validation.
*   **Navigation**: Curved bottom navigation with Lucide React icons.

## Backend Architecture
*   **Runtime**: Node.js with Express.js.
*   **Database ORM**: Drizzle ORM with PostgreSQL.
*   **API**: RESTful API with JSON responses.
*   **Session Management**: Express sessions with PostgreSQL store.
*   **Development**: ESBuild for bundling, tsx for development.

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
*   **Ad Watching System**: Users earn 30 PAD (0.0003 TON) per ad with a 3-4 second cooldown.
*   **Spin & Win System**: Gamified reward system. Users earn spins based on ads watched (up to 26 daily) and can win rewards across 8 tiers (0.000071 TON to 1 TON). Resets daily at 00:00 UTC.
*   **Daily Streak Rewards**: Users earn 10 PAD daily, with a 150 PAD bonus on the 5th consecutive day. Requires ad watch and Telegram channel membership.
*   **Referral Program**: Up to 20% commission from 1st level referrals and 4% from 2nd level referrals on ad earnings.
*   **Withdrawal System**: Supports multiple payment methods with status tracking. Automatic full TON balance withdrawal.
*   **Currency Conversion**: All internal values are in TON, displayed as PAD (1 TON = 100,000 PAD) throughout the UI.

# External Dependencies

## Core Infrastructure
*   **Database**: Neon PostgreSQL serverless.
*   **Authentication**: Replit OAuth/OIDC.
*   **Session Storage**: `connect-pg-simple`.
*   **Telegram Bot API**: `node-telegram-bot-api` for channel membership verification and user interaction.

## Frontend Libraries
*   **UI**: Radix UI, Tailwind CSS.
*   **State Management**: TanStack Query.
*   **Form Management**: React Hook Form, Zod.
*   **Date Handling**: `date-fns`.

## Ad Integration
*   **Ad Provider**: External advertisement service integrated via the global window object.