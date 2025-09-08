-- Migration to add telegram_id column to users table
-- This is safe to run multiple times

-- Add telegram_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'telegram_id'
    ) THEN
        ALTER TABLE users ADD COLUMN telegram_id VARCHAR(20) UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    END IF;
END $$;