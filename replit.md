# CashWatch - PAD Earning & Withdrawal Platform

## Overview
CashWatch is a Telegram-based earning platform designed for users to earn PAD currency through various activities such as watching ads, completing tasks, and referring new users. The platform allows users to convert their earned PAD into USD and facilitate withdrawals via multiple payment methods. Additionally, users can top-up PDZ tokens directly using the ArcPay payment gateway. The project aims to provide a seamless and engaging experience for earning and managing digital currency within the Telegram ecosystem.

## User Preferences
None documented yet.

## System Architecture

### UI/UX Decisions
- **Iconography**: Utilizes `lucide-react` for professional icons across the platform, replacing emojis for a more refined look (e.g., Sparkles for "Create Task", CircleDollarSign for "Withdraw", Gem for TON, DollarSign for USD, Star for Telegram Stars).
- **Navigation**: Bottom navigation bar with "Withdraw" button.
- **Component Design**: Consistent use of shadcn/ui components and Tailwind CSS for styling. Toggle systems (e.g., for Withdraw and Wallet Setup sections) match gradient styling (`from-cyan-500/20 to-blue-500/20`) and shadow effects.
- **Input Handling**: Decimal support for financial inputs (e.g., 0.1, 0.5, 1.25), with 2-decimal formatting for display.
- **Validation Feedback**: Real-time client-side validation and clear error messages for user inputs.

### Technical Implementations
- **Frontend**: Built with React, TypeScript, and Vite.
- **Backend**: Implemented using Express.js and Node.js.
- **Database**: PostgreSQL managed via Drizzle ORM.
- **Authentication**: Telegram WebApp Authentication.
- **PAD/USD Conversion**: Dedicated API endpoint (`/api/convert-to-usd`) to convert PAD to USD, deducting PAD and adding USD to user balances. Conversion rate: 10,000 PAD = 1 USD.
- **Withdrawal System**:
    - Supports multiple methods: TON (TON blockchain payment method), USD, Telegram Stars.
    - Updated fee structure: TON (5% fee, $0.50 min), USD (3% fee, $0.50 min), STARS (5% fee).
    - Minimum withdrawal amounts enforced server-side.
    - Admin panel displays withdrawal requests with USD equivalents for all methods, including special handling for Stars (e.g., `Y ⭐ ($X.XX)`).
- **ArcPay Integration**:
    - Full integration for PDZ token top-ups.
    - Secure handling of ArcPay API credentials via environment variables.
    - Robust error handling, retry logic (3 attempts with exponential backoff), and development mode for mock checkouts.
    - Webhook endpoint for payment notifications.
- **Wallet Management**:
    - Wallet setup integrated into the Withdraw page with a toggle.
    - Fees (5000 PAD) are charged for changing existing USDT and Telegram Stars wallet details; first-time setup is free.
- **Earning Mechanics**:
    - **Faucetpay**: Renamed from "Daily Streak", rewards +1 PAD.
    - **Referral System**: Commissions stored as PAD integers.
    - **Ad Rewards**: Processed and stored as PAD integers.
- **Number Formatting**: Utilizes compact number notation (1k, 20k, 1M, 1B, 1T) for large PAD amounts, particularly in leaderboards.
- **PAD Balance Handling**: Critical fix ensures PAD rewards and balances are stored as integers rather than TON decimal formats, with auto-conversion for legacy TON balances upon display.

### Feature Specifications
- **Top-Up PDZ**: Dedicated `/topup-pdz` route with ArcPay integration. Minimum top-up amount of 0.1 TON, with clear UI/UX for input, summary, and payment flow.
- **Withdrawal Toggle**: Replaced Radix Tabs with a custom grid toggle for "Withdraw" and "Wallet Setup" sections.
- **Health Check Endpoint**: `/api/health` checks database connectivity, environment variables, and WebSocket activity.

### System Design Choices
- **Environment Variable Driven Configuration**: All sensitive credentials (API keys, secrets) are loaded from environment variables (e.g., `ARCPAY_API_KEY`, `ARCPAY_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`).
- **Development Workflow**: Vite dev server integrates with Express backend on port 5000. Replit PostgreSQL (`helium`) is used for the database.
- **Security**: Zero hardcoded secrets, private keys are server-side only, and API keys are used exclusively in the backend.

## External Dependencies
- **PostgreSQL**: Primary database for all application data, managed via Drizzle ORM.
- **Telegram WebApp Auth**: Used for user authentication.
- **ArcPay Payment Gateway**: Integrated for PDZ token top-ups, handling payment creation and webhook notifications.
- **lucide-react**: Icon library for UI elements.
- **shadcn/ui**: Component library for UI elements.
- **Tailwind CSS**: Utility-first CSS framework for styling.