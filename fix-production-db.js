// One-time script to fix production database schema on Render
// Run this once on your deployed app to fix all database issues

import { Pool } from 'pg';

async function fixProductionDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found. Make sure you have a database connected.');
    return;
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Fixing production database schema...');
    
    // Check and add missing columns to withdrawals table
    const methodCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'withdrawals' AND column_name = 'method'
    `);
    
    if (methodCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE withdrawals ADD COLUMN method VARCHAR DEFAULT 'usdt_polygon'`);
      console.log('✅ Added method column to withdrawals table');
    } else {
      console.log('✓ Method column already exists in withdrawals');
    }

    // Check and add details column to withdrawals
    const detailsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'withdrawals' AND column_name = 'details'
    `);
    
    if (detailsCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE withdrawals ADD COLUMN details JSONB`);
      console.log('✅ Added details column to withdrawals table');
    } else {
      console.log('✓ Details column already exists in withdrawals');
    }

    // Check and add missing columns to referrals table
    const referredCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'referred_id'
    `);
    
    if (referredCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE referrals ADD COLUMN referred_id VARCHAR REFERENCES users(id)`);
      console.log('✅ Added referred_id column to referrals table');
    } else {
      console.log('✓ Referred_id column already exists in referrals');
    }

    // Check and add reward_amount column to referrals
    const rewardCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'reward_amount'
    `);
    
    if (rewardCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE referrals ADD COLUMN reward_amount DECIMAL(10, 5) DEFAULT 0.50`);
      console.log('✅ Added reward_amount column to referrals table');
    } else {
      console.log('✓ Reward_amount column already exists in referrals');
    }

    // Check and add status column to referrals
    const statusCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'referrals' AND column_name = 'status'
    `);
    
    if (statusCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE referrals ADD COLUMN status VARCHAR DEFAULT 'pending'`);
      console.log('✅ Added status column to referrals table');
    } else {
      console.log('✓ Status column already exists in referrals');
    }

    // Verify all tables are working
    console.log('🧪 Testing database...');
    
    const withdrawalTest = await pool.query('SELECT COUNT(*) FROM withdrawals');
    console.log(`✓ Withdrawals table: ${withdrawalTest.rows[0].count} records`);
    
    const referralTest = await pool.query('SELECT COUNT(*) FROM referrals');
    console.log(`✓ Referrals table: ${referralTest.rows[0].count} records`);
    
    const userTest = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`✓ Users table: ${userTest.rows[0].count} records`);

    console.log('🎉 Production database fixed successfully!');
    console.log('🚀 Your app should now work perfectly!');

  } catch (error) {
    console.error('❌ Error fixing database:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixProductionDatabase();
}

export { fixProductionDatabase };