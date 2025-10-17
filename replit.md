# Overview

CashWatch is a React-based web application enabling users to earn money by watching advertisements. It features a gamified experience with daily streaks, a referral system, and withdrawal capabilities. The platform uses a modern full-stack architecture, integrating React, Express, PostgreSQL, shadcn/ui components, and Telegram Bot functionality. The project aims to provide a user-friendly and engaging way to earn cryptocurrency.

## Admin Features
- **Promo Code Creation**: Admins can create promotional codes with customizable rewards, usage limits, and expiry dates
- **User Tracking**: Search and monitor users by UID (referral code) to view their balance, earnings, withdrawals, and activity
- **Withdrawal Management**: Approve or reject user withdrawal requests
- **Analytics Dashboard**: View platform statistics including active users, total earnings, and withdrawal analytics

For detailed instructions on using admin features, see [ADMIN_GUIDE.md](./ADMIN_GUIDE.md).

# Recent Changes (October 17, 2025)

## GitHub Import Setup Complete + UI Enhancements + Performance Fix
- ✅ Configured development environment and database migrations
- ✅ Fixed missing wallet columns in database schema (ton_wallet_address, telegram_username_wallet, etc.)
- ✅ Applied UI fixes:
  - Changed chart outlines from blue (#3b82f6) to white (#ffffff) for better visibility
  - Added white borders to all inputs, buttons, textareas, and select elements
  - Made popup and card backgrounds visible with #0d0d0d background and white borders
  - Added scroll overflow handling to Promo Creator tab (max-height: 80vh)
  - Updated CSS border color to white for enhanced visibility
- ✅ **Ad Reward Performance Fix**: Optimized ad reward flow for instant delivery
  - Reward is now processed immediately when ad starts (0ms delay)
  - Eliminated 2-3 second delay that occurred after ad close
  - API call no longer blocks reward notification
  - User receives reward notification instantly while ad continues in background
- ✅ Configured autoscale deployment with build and start scripts
- ✅ Vite dev server running on 0.0.0.0:5000 with HMR proxy support (clientPort 443)
- ✅ Database schema verified with all tables and migrations applied
- ✅ Development workflow "CashWatch Server" configured and running successfully

# Recent Changes (October 16, 2025)

## GitHub Import Setup Complete
- ✅ Created missing `shared/constants.ts` file with PAD_TO_USD conversion utilities
- ✅ Fixed TypeScript configuration and LSP diagnostics
- ✅ Configured Vite dev server for Replit environment (0.0.0.0:5000, HMR with clientPort 443)
- ✅ Set up database schema and migrations
- ✅ Added `.gitignore` for proper version control
- ✅ Configured deployment settings for autoscale deployment
- ✅ Created comprehensive Admin Guide documentation (ADMIN_GUIDE.md)

# Recent Changes (October 13, 2025)

## Project Setup & Configuration
- **GitHub Import Setup**: Successfully configured the project for Replit environment
- **Missing Constants File**: Created `shared/constants.ts` with currency conversion utilities (PAD_TO_USD constant and helper functions)
- **Vite Configuration**: Fixed HMR WebSocket configuration for Replit proxy environment (clientPort: 443)
- **Database**: Configured PostgreSQL database connection with proper SSL settings for development
- **Build System**: Verified and tested build pipeline (Vite + ESBuild) working correctly
- **Development Workflow**: Set up dev server on port 5000 with proper host configuration (0.0.0.0)
- **Deployment**: Configured autoscale deployment with build and start scripts
- **Dependencies**: Updated browserslist database and installed all required packages
- **.gitignore**: Created to exclude build artifacts and node_modules from version control

# Recent Changes (October 13, 2025)

## UI/UX Updates
- **Full Screen Layout**: Removed top balance section from header to enable full-screen app experience
- **Balance Display**: Balance now only visible in Wallet page with prominent gradient card display
- **Income Statistics**: Added compact widget to Home page showing Today, All time, and Referrals earnings
- **Wallet Navigation**: Updated to 3-tab system (Wallets | Withdraw | History) with clear visual indicators
- **Admin Access**: Admin dashboard now accessible only via Wallet tab for admin users

## Feature Updates
- **Ad Rewards**: Increased from 20 PAD to 30 PAD per ad watch (0.0003 TON)
- **Ad Cooldown**: Adjusted to 3-4 seconds between ads
- **Referral System**: 
  - Removed instant TON reward on friend join
  - Updated commission structure: 20% from 1st level, 4% from 2nd level
- **Admin Dashboard**: Added withdrawal statistics box showing Total Requests, Successful, and Pending withdrawals

## Technical Changes
- Balance hidden from all pages except Wallet
- Smooth page transitions maintained
- Compact layout optimizations across all sections

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Frameworks**: React with TypeScript, Vite for building.
- **Routing**: Wouter for client-side routing and protected routes.
- **State Management**: TanStack Query for server state and caching.
- **UI/UX**: shadcn/ui component library, Radix UI primitives, Tailwind CSS for styling, custom CSS variables for theming with light/dark mode.
- **Forms**: React Hook Form with Zod validation.
- **Navigation**: Modern curved bottom navigation with Framer Motion for animations, featuring Lucide React icons.

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Database ORM**: Drizzle ORM with PostgreSQL.
- **API**: RESTful API with JSON responses.
- **Session Management**: Express sessions with PostgreSQL store.
- **Development**: ESBuild for bundling, tsx for development.

## Authentication & Authorization
- **Provider**: Replit OAuth (OpenID Connect).
- **Session Strategy**: Server-side sessions with secure HTTP-only cookies.
- **Authorization**: Middleware-based route protection.
- **User Management**: Automatic user creation/updates on authentication.

## Data Storage
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle migrations.
- **Key Entities**: Users (balance, streaks, referrals), Earnings, Withdrawals, Referral relationships, Sessions.

## Business Logic Features
- **Ad Watching System**: Users earn 30 PAD (0.0003 TON) per ad with a 3-4 second cooldown. Integrated with Spin & Win.
- **Spin & Win System**: Gamified reward system.
  - **Earning**: 1 free spin per 10 ads watched (max 16 daily). Additionally, 1 extra spin per 2 ads (max 10 daily), for a total of 26 max daily spins.
  - **Rewards**: Weighted random selection from 8 tiers (0.000071 TON to 1 TON).
  - **Daily Reset**: All spin counters reset at 00:00 UTC.
- **Daily Streak Rewards**:
  - **Rewards**: 10 PAD daily, with a 150 PAD bonus on the 5th consecutive day.
  - **Requirements**: Must watch an ad and be a member of the @PaidAdsNews Telegram channel to claim.
  - **Tracking**: Consecutive day logic with resets for missed days.
- **Referral Program**: Users earn up to 20% commission from 1st level referrals and up to 4% from 2nd level referrals on their ad earnings. No instant reward on friend join.
- **Withdrawal System**: Supports multiple payment methods with status tracking.
- **Currency Conversion**: All internal values are in TON, displayed as PAD (1 TON = 100,000 PAD) throughout the UI.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless.
- **Authentication**: Replit OAuth/OIDC.
- **Session Storage**: `connect-pg-simple` (PostgreSQL-backed).
- **Telegram Bot API**: `node-telegram-bot-api` for channel membership verification and user interaction.

## Frontend Libraries
- **UI**: Radix UI, Tailwind CSS.
- **State Management**: TanStack Query.
- **Form Management**: React Hook Form, Zod.
- **Date Handling**: `date-fns`.

## Ad Integration
- **Ad Provider**: External advertisement service integrated via the global window object.