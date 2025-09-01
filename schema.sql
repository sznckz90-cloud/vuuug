-- This file contains the database schema for the Lightning Sats bot
-- Run this SQL to set up your database tables

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    balance DECIMAL(15, 8) DEFAULT 0,
    hold_balance DECIMAL(15, 8) DEFAULT 0,
    earned_today DECIMAL(15, 8) DEFAULT 0,
    earned_total DECIMAL(15, 8) DEFAULT 0,
    watched_today INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    streak_multiplier DECIMAL(5, 4) DEFAULT 1.0,
    is_subscribed BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR(10) UNIQUE,
    referred_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_streak_claim DATE
);

CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    method VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 8) NOT NULL,
    address TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id),
    referred_id INTEGER REFERENCES users(id) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ad_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ad_type VARCHAR(50) NOT NULL,
    reward DECIMAL(15, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contest_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    contest_type VARCHAR(50) NOT NULL,
    link TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX idx_ad_views_user_id ON ad_views(user_id);
CREATE INDEX idx_contest_submissions_user_id ON contest_submissions(user_id);