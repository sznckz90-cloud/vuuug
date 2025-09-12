# Overview

CashWatch is a React-based web application that allows users to earn money by watching advertisements. The platform features a gamified experience with daily streaks, referral systems, and withdrawal capabilities. Built with a modern full-stack architecture using React, Express, PostgreSQL, and shadcn/ui components.

# Recent Changes

**September 12, 2025 (Telegram WebApp Authentication Fix for Render):**
- **Fixed critical Telegram WebApp authentication for Render deployment**: Resolved "Telegram authentication required" errors that prevented users from creating promotions and completing tasks when accessing through legitimate Telegram WebApp
- **Removed unsafe initDataUnsafe fallback**: Eliminated security-breaking fallback that lacked proper HMAC hash verification, ensuring all production authentication requires valid Telegram WebApp initData
- **Enhanced environment detection**: Improved development vs production detection for Render deployments with proper REPL_ID dependency removal
- **Fixed task reward calculation**: Resolved hardcoded $0.00 reward display bug, now showing correct dynamic reward amounts from promotion data
- **Strengthened authentication security**: Implemented strict HMAC signature verification using TELEGRAM_BOT_TOKEN for all production environments
- **Production-ready for Render**: Code now fully supports Render deployment without authentication bypass issues while maintaining development mode compatibility

**September 8, 2025 (Referral System Fix):**
- **Fixed referral system database errors**: Resolved "null value in column 'referee_id'" errors by improving input validation and error handling in createReferral function
- **Enhanced referral creation logic**: Added comprehensive user verification, duplicate checking, and self-referral prevention
- **Improved Telegram integration**: Updated webhook handler to properly process referral codes from /start commands for new users only
- **Enhanced affiliates API**: Extended API to return detailed referral list including referee IDs, rewards, status, and creation dates
- **Added referral notifications**: Implemented Telegram notifications to referrers when someone uses their referral link
- **Production testing verified**: End-to-end testing confirmed referral system works correctly in production environment

**September 7, 2025 (v2.0 - Code Modernization):**
- **Complete code modernization**: Removed all legacy authentication patterns and outdated implementations
- **Unified authentication system**: Consolidated all authentication logic into `server/auth.ts` for better organization and maintainability  
- **Removed deprecated routes**: Eliminated manual database setup routes (`/api/init-database`) and legacy schema fixes in favor of proper Drizzle migrations
- **Cleaner codebase**: Removed duplicate middleware functions and consolidated authentication into a single, modern system
- **Enhanced type safety**: Improved TypeScript usage throughout the authentication system
- **Production-ready**: Authentication system now works seamlessly across development, Replit, and external deployment environments (like Render)

**Earlier September 7, 2025:**
- Fixed authentication for Render deployment - removed Replit OAuth dependency for non-Replit environments
- Updated authentication system to work with Telegram WebApp authentication only on external platforms
- Made REPLIT_DOMAINS environment variable optional for deployment flexibility
- Added fallback authentication routes for non-Replit environments
- Modified session management to work without OAuth tokens in production

**September 5, 2025:**
- Fixed authentication persistence - users no longer need to authenticate repeatedly
- Automatic account creation on any bot interaction (not just /start command)  
- Auto-generation of referral codes for new users
- Fixed ad reward crediting system with proper authentication headers
- Fixed streak claim functionality to work regardless of ad SDK status
- Created comprehensive React-based admin panel with user management, withdrawal oversight, and system monitoring
- Added admin API endpoints with proper authentication and statistics

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with protected routes based on authentication state
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: shadcn/ui component library with Radix UI primitives and Tailwind CSS for styling
- **Form Handling**: React Hook Form with Zod validation schemas
- **Design System**: Custom CSS variables for theming with light/dark mode support

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **API Design**: RESTful API with JSON responses and proper HTTP status codes
- **Session Management**: Express sessions with PostgreSQL session store for persistence
- **Development Setup**: ESBuild for production bundling, tsx for development server

## Authentication & Authorization
- **Authentication Provider**: Replit OAuth integration using OpenID Connect (OIDC)
- **Session Strategy**: Server-side sessions with secure HTTP-only cookies
- **Authorization Pattern**: Middleware-based route protection with user context injection
- **User Management**: Automatic user creation/updates on authentication with profile sync

## Data Storage
- **Primary Database**: PostgreSQL with connection pooling via Neon serverless
- **Schema Management**: Drizzle migrations with schema definitions in TypeScript
- **Key Entities**:
  - Users with balance tracking, streak counters, and referral codes
  - Earnings history with metadata for different earning types
  - Withdrawals with status tracking and payment method details
  - Referral relationships for user acquisition tracking
  - Sessions table for authentication persistence

## Business Logic Features
- **Ad Watching System**: Integration with external ad providers for reward distribution
- **Streak System**: Daily login tracking with bonus rewards for consecutive days
- **Referral Program**: User-generated referral codes with commission tracking
- **Withdrawal System**: Multiple payment methods with pending/completed status tracking
- **Earnings Analytics**: Time-based earning summaries (daily, weekly, monthly)

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database with connection pooling
- **Authentication**: Replit OAuth/OIDC service for user authentication
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple

## Frontend Libraries
- **UI Framework**: Radix UI primitives for accessible component foundations
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state caching and synchronization
- **Form Management**: React Hook Form with Zod schema validation
- **Date Handling**: date-fns for date manipulation and formatting

## Development Tools
- **Build System**: Vite with React plugin and TypeScript support
- **Code Quality**: TypeScript for type safety across the entire stack
- **Development Experience**: Replit-specific plugins for cartographer and error overlays
- **Package Management**: npm with lockfile for dependency consistency

## Ad Integration
- **Ad Provider**: External advertisement service accessed via global window object
- **Reward System**: Fixed reward rates per ad view with metadata tracking
- **Anti-Fraud**: Daily ad viewing limits and timestamp verification