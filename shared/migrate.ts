// Migration helper to ensure all database tables exist with correct schema
import { db } from './db';
import { sql } from 'drizzle-orm';

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    console.log('🔄 [MIGRATION] Ensuring all database tables exist...');
    
    // Enable pgcrypto extension for gen_random_uuid() support
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      console.log('✅ [MIGRATION] pgcrypto extension enabled');
    } catch (error) {
      console.log('⚠️ [MIGRATION] pgcrypto extension already exists or not available');
    }
    
    // Create all essential tables with correct schema
    
    // Sessions table - CRITICAL for connect-pg-simple authentication
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    console.log('✅ [MIGRATION] Sessions table ensured');
    
    // Users table with full schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id VARCHAR(20) UNIQUE,
        username VARCHAR,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        personal_code TEXT,
        balance DECIMAL(12, 8) DEFAULT '0',
        withdraw_balance DECIMAL(12, 8),
        total_earnings DECIMAL(12, 8),
        total_earned DECIMAL(12, 8) DEFAULT '0',
        ads_watched INTEGER DEFAULT 0,
        daily_ads_watched INTEGER DEFAULT 0,
        ads_watched_today INTEGER DEFAULT 0,
        daily_earnings DECIMAL(12, 8),
        last_ad_watch TIMESTAMP,
        last_ad_date TIMESTAMP,
        current_streak INTEGER DEFAULT 0,
        last_streak_date TIMESTAMP,
        level INTEGER DEFAULT 1,
        referred_by VARCHAR,
        referral_code TEXT,
        flagged BOOLEAN DEFAULT false,
        flag_reason TEXT,
        banned BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP,
        last_login_ip TEXT,
        last_login_device TEXT,
        last_login_user_agent TEXT,
        channel_visited BOOLEAN DEFAULT false,
        app_shared BOOLEAN DEFAULT false,
        friends_invited INTEGER DEFAULT 0,
        first_ad_watched BOOLEAN DEFAULT false,
        last_reset_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add missing columns to existing users table (for production databases)
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_visited BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS app_shared BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS friends_invited INTEGER DEFAULT 0`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_ad_watched BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMP`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_address TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_comment TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username_wallet TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_updated_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_referral_bonus DECIMAL(12, 8) DEFAULT '0'`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_claimed_referral_bonus DECIMAL(12, 8) DEFAULT '0'`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_balance DECIMAL(12, 8) DEFAULT '0'`);
      console.log('✅ [MIGRATION] Missing user task and wallet columns added');
    } catch (error) {
      // Columns might already exist - this is fine
      console.log('ℹ️ [MIGRATION] User task and wallet columns already exist or cannot be added');
    }
    
    // Ensure referral_code column exists and has proper constraints
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
      
      // Backfill referral codes for users that don't have them
      await db.execute(sql`
        UPDATE users 
        SET referral_code = 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
        WHERE referral_code IS NULL OR referral_code = ''
      `);
      
      // Create unique constraint if it doesn't exist
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'users_referral_code_unique'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);
          END IF;
        END $$
      `);
      
      console.log('✅ [MIGRATION] Referral code column and constraints ensured');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Referral code setup complete or already exists');
    }
    
    // Earnings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS earnings (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        amount DECIMAL(12, 8) NOT NULL,
        source VARCHAR NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        amount DECIMAL(12, 8) NOT NULL,
        type VARCHAR NOT NULL,
        source VARCHAR NOT NULL,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Withdrawals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        amount DECIMAL(12, 8) NOT NULL,
        status VARCHAR DEFAULT 'pending',
        method VARCHAR NOT NULL,
        details JSONB,
        comment TEXT,
        transaction_hash VARCHAR,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add comment column to existing withdrawals table if missing
    try {
      await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS comment TEXT`);
      console.log('✅ [MIGRATION] Comment column added to withdrawals table');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Comment column already exists in withdrawals table');
    }
    
    // Add deducted and refunded columns to prevent double deduction/refund bugs
    try {
      await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS deducted BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT false`);
      
      // For existing withdrawals created under OLD system (balance was deducted during approval, not submission):
      // - Approved/Completed ones: Mark as deducted=true (balance was already taken during approval)
      // - Rejected ones: Mark as deducted=false and refunded=false (balance was never taken, or was returned)
      // - Pending ones: Mark as deducted=false (balance will be deducted when approved with compatibility logic)
      
      await db.execute(sql`
        UPDATE withdrawals 
        SET deducted = true 
        WHERE status IN ('Approved', 'Successfull', 'paid') AND (deducted IS NULL OR deducted = false)
      `);
      
      await db.execute(sql`
        UPDATE withdrawals 
        SET deducted = false, refunded = false
        WHERE status = 'rejected' AND (deducted IS NULL OR refunded IS NULL)
      `);
      
      await db.execute(sql`
        UPDATE withdrawals 
        SET deducted = false, refunded = false
        WHERE status = 'pending' AND (deducted IS NULL OR refunded IS NULL)
      `);
      
      console.log('✅ [MIGRATION] Deducted and refunded columns added to withdrawals table with correct legacy states');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Deducted and refunded columns already exist in withdrawals table');
    }
    
    // Promotions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id VARCHAR NOT NULL REFERENCES users(id),
        type VARCHAR NOT NULL,
        url TEXT NOT NULL,
        cost DECIMAL(12, 8) NOT NULL DEFAULT '0.01',
        reward_per_user DECIMAL(12, 8) NOT NULL DEFAULT '0.00025',
        "limit" INTEGER NOT NULL DEFAULT 1000,
        claimed_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'active',
        title VARCHAR(255),
        description TEXT,
        reward INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Task completions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_completions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id VARCHAR NOT NULL REFERENCES promotions(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        reward_amount DECIMAL(12, 8) NOT NULL,
        verified BOOLEAN DEFAULT false,
        completed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(promotion_id, user_id)
      )
    `);
    
    // User balances table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR UNIQUE NOT NULL REFERENCES users(id),
        balance DECIMAL(20, 8) DEFAULT '0',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Referrals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id VARCHAR NOT NULL REFERENCES users(id),
        referee_id VARCHAR NOT NULL REFERENCES users(id),
        reward_amount DECIMAL(12, 5) DEFAULT '0.01',
        status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(referrer_id, referee_id)
      )
    `);
    
    // Referral commissions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id VARCHAR NOT NULL REFERENCES users(id),
        referred_user_id VARCHAR NOT NULL REFERENCES users(id),
        original_earning_id INTEGER NOT NULL REFERENCES earnings(id),
        commission_amount DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Promo codes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR UNIQUE NOT NULL,
        reward_amount DECIMAL(12, 2) NOT NULL,
        reward_currency VARCHAR DEFAULT 'USDT',
        usage_limit INTEGER,
        usage_count INTEGER DEFAULT 0,
        per_user_limit INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Promo code usage tracking table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promo_code_usage (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        promo_code_id VARCHAR NOT NULL REFERENCES promo_codes(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        reward_amount DECIMAL(12, 2) NOT NULL,
        used_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Daily tasks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_tasks (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        task_level INTEGER NOT NULL,
        progress INTEGER DEFAULT 0,
        required INTEGER NOT NULL,
        completed BOOLEAN DEFAULT false,
        claimed BOOLEAN DEFAULT false,
        reward_amount DECIMAL(12, 8) NOT NULL,
        completed_at TIMESTAMP,
        claimed_at TIMESTAMP,
        reset_date VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, task_level, reset_date)
      )
    `);
    
    // Promotion claims table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotion_claims (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id VARCHAR NOT NULL REFERENCES promotions(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        reward_amount DECIMAL(12, 8) NOT NULL,
        claimed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(promotion_id, user_id)
      )
    `);
    
    // Create indexes for performance
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id)`);
    
    console.log('✅ [MIGRATION] All tables and indexes created successfully');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Critical error ensuring database schema:', error);
    throw new Error(`Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}