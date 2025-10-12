# Overview

CashWatch is a React-based web application enabling users to earn money by watching advertisements. It features a gamified experience with daily streaks, a referral system, and withdrawal capabilities. The platform uses a modern full-stack architecture, integrating React, Express, PostgreSQL, shadcn/ui components, and Telegram Bot functionality. The project aims to provide a user-friendly and engaging way to earn cryptocurrency.

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
- **Ad Watching System**: Users earn 20 PAD (0.0002 TON) per ad, with a daily limit of 160 ads and a 4-second cooldown. Integrated with Spin & Win.
- **Spin & Win System**: Gamified reward system.
  - **Earning**: 1 free spin per 10 ads watched (max 16 daily). Additionally, 1 extra spin per 2 ads (max 10 daily), for a total of 26 max daily spins.
  - **Rewards**: Weighted random selection from 8 tiers (0.000071 TON to 1 TON).
  - **Daily Reset**: All spin counters reset at 00:00 UTC.
- **Daily Streak Rewards**:
  - **Rewards**: 10 PAD daily, with a 150 PAD bonus on the 5th consecutive day.
  - **Requirements**: Must watch an ad and be a member of the @PaidAdsNews Telegram channel to claim.
  - **Tracking**: Consecutive day logic with resets for missed days.
- **Referral Program**: Users get an instant 0.002 TON bonus when a referred friend joins and a 10% lifetime commission on their ad earnings.
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