// Production migration helper to ensure telegram_id column exists
import { db } from './db';
import { sql } from 'drizzle-orm';

export async function ensureTelegramIdColumn(): Promise<void> {
  try {
    console.log('🔄 [MIGRATION] Checking if telegram_id column exists...');
    
    // First ensure the users table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR,
        balance DECIMAL(10, 2) DEFAULT 0,
        streak_count INTEGER DEFAULT 0,
        streak_last_date DATE,
        referral_code VARCHAR UNIQUE,
        referred_by VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if telegram_id column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'telegram_id'
    `);
    
    if (result.rows.length === 0) {
      console.log('➕ [MIGRATION] Adding telegram_id column to users table...');
      
      // Add the column safely
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN telegram_id VARCHAR(20) UNIQUE
      `);
      
      // Add index for performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
      `);
      
      console.log('✅ [MIGRATION] telegram_id column added successfully');
    } else {
      console.log('✅ [MIGRATION] telegram_id column already exists');
    }
    
    // Fix username column to allow NULL values (for users without Telegram usernames)
    try {
      await db.execute(sql`
        ALTER TABLE users ALTER COLUMN username DROP NOT NULL
      `);
      console.log('✅ [MIGRATION] Username column constraint fixed');
    } catch (error) {
      // Column might already be nullable, ignore the error
      console.log('ℹ️ [MIGRATION] Username column already nullable or constraint doesn\'t exist');
    }
    
    // Also ensure all other essential tables exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS earnings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR DEFAULT 'pending',
        payment_method VARCHAR NOT NULL,
        payment_details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ [MIGRATION] All tables verified/created');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Critical error ensuring database schema:', error);
    // This IS critical - we need to throw to prevent startup with broken schema
    throw new Error(`Database migration failed: ${error.message}`);
  }
}