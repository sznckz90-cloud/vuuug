// Production migration helper to ensure telegram_id column exists
import { db } from './db';
import { sql } from 'drizzle-orm';

export async function ensureTelegramIdColumn(): Promise<void> {
  try {
    console.log('🔄 Checking if telegram_id column exists...');
    
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'telegram_id'
    `);
    
    if (result.rows.length === 0) {
      console.log('➕ Adding telegram_id column to users table...');
      
      // Add the column safely
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN telegram_id VARCHAR(20) UNIQUE
      `);
      
      // Add index for performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
      `);
      
      console.log('✅ telegram_id column added successfully');
    } else {
      console.log('✅ telegram_id column already exists');
    }
  } catch (error) {
    console.error('❌ Error ensuring telegram_id column:', error);
    // Don't throw error to prevent server startup failure
    // The column might already exist or there might be a permission issue
  }
}