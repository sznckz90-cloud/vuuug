# replit.md

## Overview

This is a standalone web application called "LightingSats" that allows users to earn money by watching advertisements. Users can create accounts using email/username, watch ads to earn $0.01 per ad, refer friends using personal codes for 10% commission, and withdraw funds. The application features a mobile-first design with a modern authentication system and real-time features. **Major Update (August 27, 2025)**: Converted from Telegram WebApp to standalone webapp for broader accessibility and deployment flexibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Optimized for Telegram WebApp with responsive layout

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API endpoints with JSON responses
- **Storage Layer**: Abstracted storage interface with in-memory implementation (ready for database integration)
- **Development Setup**: Vite middleware integration for development with HMR support
- **Error Handling**: Centralized error handling with structured JSON responses

### Data Storage Solutions
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Database**: PostgreSQL (fully connected and operational)
- **Schema Design**: 
  - Users table with Telegram integration, earnings tracking, and referral system
  - Withdrawal requests with multiple payment methods
  - Referrals table for tracking commission structure
  - Bot statistics for admin dashboard metrics
- **Migrations**: Drizzle Kit for database schema migrations

### Authentication and Authorization
- **Email-Based Authentication**: Users register and login using email addresses and usernames
- **Local Storage Session**: User authentication state maintained in browser localStorage
- **Personal Code System**: Each user gets a unique personal code (PC + 8 characters) for referrals
- **Admin Access**: Special admin email (admin@lightingsats.com) for administrative functions
- **Security**: Simple but secure authentication without external dependencies

### Key Features
- **Ad Watching System**: Monetag SDK integration with real ad viewing earning $0.01 per ad (demo mode available)
- **Earnings Management**: Real-time balance tracking with withdrawal functionality (minimum $1.00)
- **Personal Code Referral System**: Users share personal codes for 10% commission on referral earnings
- **Login/Registration Pages**: Modern authentication UI with email and username requirements
- **Mobile-First Design**: Touch-friendly interface optimized for mobile and desktop
- **Admin Dashboard**: Full user management, withdrawal processing, and system statistics

## External Dependencies

### Third-Party Services
- **Telegram Bot API**: Core authentication and user management through Telegram WebApp
- **CoinGecko API**: Real-time TON cryptocurrency price data with 24h change tracking
- **Neon Database**: PostgreSQL database hosting service (configured via DATABASE_URL)

### Key Libraries
- **UI Framework**: React 18 with TypeScript support
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **HTTP Client**: Native fetch API for external service integration
- **Form Handling**: React Hook Form with Zod validation
- **Component Library**: Radix UI primitives with Shadcn/ui styling
- **Build Tools**: Vite with ESBuild for production builds
- **Development Tools**: TSX for TypeScript execution, Replit integration plugins

### API Integrations
- **TON Price Feed**: CoinGecko API endpoint for The Open Network price data
- **Telegram WebApp**: Integration with Telegram's WebApp platform for user authentication
- **Database Connection**: PostgreSQL via connection string with SSL support

## Deployment Configuration

### Render Deployment Setup
- **Platform**: Render web service configured via `render.yaml`
- **Build Process**: Custom build script (`build.sh`) that creates both `dist/public` and `dist/client` directories
- **Build Command**: `npm install && ./build.sh`
- **Start Command**: `npm run start`
- **Environment**: Node.js with PostgreSQL database integration
- **Build Fix**: Added `dist/client` directory creation to resolve Render's deployment expectations (August 26, 2025)
- **Deployment Status**: ✅ Ready for deployment - All features tested and working (August 26, 2025)

### Recent Changes (August 27, 2025)
- **Major Transformation**: ✅ Converted from Telegram WebApp to standalone web application
- **Database Migration**: ✅ Updated schema to use email + personalCode instead of telegramId + referralCode
- **New Authentication**: ✅ Implemented login/register pages with email-based authentication
- **Personal Code System**: ✅ Each user gets unique personal code for referrals (10% commission)
- **Updated Earnings**: ✅ Increased earnings to $0.01 per ad (from $0.00035)
- **Removed Telegram Dependencies**: ✅ Eliminated all Telegram bot integration and channel verification
- **Admin Updates**: ✅ Updated admin dashboard to work with email-based user system

### Recent Changes (August 28, 2025)
- **Database Connection**: ✅ Fixed PostgreSQL database connection issues
- **Environment Setup**: ✅ Properly configured DATABASE_URL and environment variables
- **Schema Migration**: ✅ Successfully pushed database schema with all tables
- **Code Quality**: ✅ Fixed TypeScript null safety errors in routes and frontend
- **Monetag Integration**: ✅ Added complete Monetag ad network integration with Zone ID 9368336
- **Real Ad Support**: ✅ Application now supports real Monetag ads with three formats
- **Multiple Ad Types**: ✅ Rewarded interstitial, rewarded popup, and in-app interstitial implemented
- **Revenue Optimization**: ✅ Background ads every 25 seconds for passive monetization
- **Documentation**: ✅ Updated MONETAG_SETUP.md with live integration details