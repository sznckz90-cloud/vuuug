# Overview

CashWatch is a React-based web application that enables users to earn cryptocurrency by watching advertisements. It offers a gamified experience with features like daily streaks, a referral system, and cryptocurrency withdrawal capabilities. The platform aims to provide an engaging and user-friendly way for users to earn cryptocurrency through a modern full-stack architecture.

**Admin Features:**
*   **Promo Code Creation**: Admins can create customizable promotional codes.
*   **User Tracking**: Monitor user activity, balances, earnings, and withdrawals.
*   **Withdrawal Management**: Approve or reject user withdrawal requests.
*   **Analytics Dashboard**: View platform statistics.

# Recent Changes

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