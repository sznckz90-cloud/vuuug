# Overview

CashWatch is a React-based web application that enables users to earn money by watching advertisements. It offers a gamified experience including daily streaks, a referral system, and withdrawal functionalities. The platform is built using a modern full-stack architecture comprising React, Express, PostgreSQL, and shadcn/ui components. The project aims to provide a rewarding user experience and a robust backend for managing ad-based earnings.

# Recent Changes

## October 4, 2025 - Telegram Notification & Balance Fixes
- **Telegram Notification Formatting**: Fixed TON value formatting to handle up to 8 decimal places and properly remove trailing zeros (e.g., 261.01175 → 261.0117, 12.00000 → 12)
- **Plain Text Notifications**: Removed markdown formatting from all Telegram notifications for better display compatibility
- **Balance Deduction System**: Verified and confirmed the existing balance deduction logic prevents double deduction using the `deducted` flag system:
  - Balance is deducted once when withdrawal request is created
  - No additional deduction occurs during approval
  - Proper refund logic for rejected withdrawals
  - Safety checks prevent duplicate refunds

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite for building.
- **Routing**: Wouter for client-side routing with protected routes.
- **State Management**: TanStack Query for server state and caching.
- **UI Components**: shadcn/ui, Radix UI primitives, and Tailwind CSS for styling.
- **Form Handling**: React Hook Form with Zod validation.
- **Design System**: Custom CSS variables for theming, supporting light/dark modes.

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Database ORM**: Drizzle ORM with PostgreSQL dialect.
- **API Design**: RESTful API with JSON responses.
- **Session Management**: Express sessions with PostgreSQL session store.
- **Development Setup**: ESBuild for production bundling, tsx for development.

## Authentication & Authorization
- **Authentication Provider**: Replit OAuth integration using OpenID Connect (OIDC).
- **Session Strategy**: Server-side sessions with secure HTTP-only cookies.
- **Authorization Pattern**: Middleware-based route protection.
- **User Management**: Automatic user creation/updates and profile synchronization on authentication.

## Data Storage
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle migrations and TypeScript schema definitions.
- **Key Entities**: Users (balance, streaks, referrals), Earnings history, Withdrawals, Referral relationships, Sessions.

## Business Logic Features
- **Ad Watching System**: Integration with external ad providers for reward distribution.
- **Streak System**: Tracks daily logins for bonus rewards.
- **Referral Program**: User-generated referral codes with commission tracking.
- **Withdrawal System**: Supports multiple payment methods with status tracking.
- **Earnings Analytics**: Provides time-based earning summaries.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database.
- **Authentication**: Replit OAuth/OIDC service.
- **Session Storage**: PostgreSQL-backed session storage (connect-pg-simple).

## Frontend Libraries
- **UI Framework**: Radix UI primitives.
- **Styling**: Tailwind CSS.
- **State Management**: TanStack Query.
- **Form Management**: React Hook Form with Zod.
- **Date Handling**: date-fns.

## Development Tools
- **Build System**: Vite.
- **Code Quality**: TypeScript.
- **Development Experience**: Replit-specific plugins.
- **Package Management**: npm.

## Ad Integration
- **Ad Provider**: External advertisement service.
- **Reward System**: Fixed reward rates per ad view.
- **Anti-Fraud**: Daily ad viewing limits and timestamp verification.