#!/usr/bin/env node

// Production database fix for referral system
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function fixProductionReferrals() {
  console.log('🔧 Fixing production referral system...');
  
  try {
    // 1. Update existing referral bonuses from $0.50 to $0.01
    console.log('📝 Updating referral bonus amounts from $0.50 to $0.01...');
    await sql`
      UPDATE earnings 
      SET amount = '0.01', 
          description = REPLACE(description, '$0.50', '$0.01')
      WHERE source = 'referral' 
      AND amount = '0.50'
    `;
    
    // 2. Ensure all necessary tables exist with proper structure
    console.log('🏗️  Creating/updating referrals table...');
    await sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id VARCHAR NOT NULL,
        referee_id VARCHAR NOT NULL,
        reward_amount DECIMAL(12,5) DEFAULT 0.01,
        status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(referrer_id, referee_id)
      )
    `;
    
    console.log('🏗️  Creating/updating referral_commissions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id VARCHAR NOT NULL,
        referred_user_id VARCHAR NOT NULL,
        original_earning_id INTEGER NOT NULL,
        commission_amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // 3. Add missing columns to users table if needed
    console.log('🔧 Adding missing columns to users table...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`;
    
    // 4. Add missing columns to earnings table
    console.log('🔧 Adding missing columns to earnings table...');
    await sql`ALTER TABLE earnings ADD COLUMN IF NOT EXISTS source VARCHAR`;
    await sql`ALTER TABLE earnings ADD COLUMN IF NOT EXISTS description TEXT`;
    
    // 5. Add missing columns to withdrawals table
    console.log('🔧 Adding missing columns to withdrawals table...');
    await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS method VARCHAR`;
    await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS details JSONB`;
    await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR`;
    await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_notes TEXT`;
    
    // 6. Regenerate referral codes for users who don't have them
    console.log('🔑 Generating referral codes for users...');
    const usersWithoutCodes = await sql`
      SELECT id FROM users 
      WHERE referral_code IS NULL OR referral_code = ''
    `;
    
    for (const user of usersWithoutCodes) {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await sql`
        UPDATE users 
        SET referral_code = ${referralCode}
        WHERE id = ${user.id}
      `;
    }
    
    console.log('✅ Production referral system fixed successfully!');
    console.log('📊 Summary of changes:');
    console.log('  - Updated existing $0.50 bonuses to $0.01');
    console.log('  - Created/updated referrals tracking table');
    console.log('  - Added missing database columns');
    console.log('  - Generated referral codes for users');
    console.log('');
    console.log('🚀 Your referral system should now work correctly!');
    
  } catch (error) {
    console.error('❌ Error fixing production referrals:', error);
    process.exit(1);
  }
}

fixProductionReferrals();