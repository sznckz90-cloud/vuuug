# Overview

CashWatch is a React-based web application that allows users to earn cryptocurrency by watching advertisements. It offers a gamified experience with features like daily streaks, a referral system, and cryptocurrency withdrawal capabilities. The platform aims to provide an engaging and user-friendly way for users to earn cryptocurrency, leveraging a modern full-stack architecture.

**Admin Features:**
*   Promo Code Creation
*   User Tracking
*   Withdrawal Management
*   Analytics Dashboard

# Recent Changes

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