# Overview

CashWatch is a React-based web application that allows users to earn money by watching advertisements. The platform features a gamified experience with daily streaks, referral systems, and withdrawal capabilities. Built with a modern full-stack architecture using React, Express, PostgreSQL, and shadcn/ui components.

# Recent Changes

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