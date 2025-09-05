// One-time script to create promo_codes table on Render production database
// Run this once: node fix-promo-codes.js

import { Pool } from 'pg';

async function createPromoCodesTable() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found. Make sure you have a database connected.');
    return;
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Creating promo_codes table...');
    
    // Check if promo_codes table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'promo_codes'
    `);
    
    if (tableCheck.rows.length === 0) {
      // Create promo_codes table
      await pool.query(`
        CREATE TABLE "promo_codes" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "code" varchar NOT NULL,
          "reward_amount" numeric(10, 8) NOT NULL,
          "reward_currency" varchar DEFAULT 'USDT',
          "usage_limit" integer,
          "usage_count" integer DEFAULT 0,
          "per_user_limit" integer DEFAULT 1,
          "is_active" boolean DEFAULT true,
          "expires_at" timestamp,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now(),
          CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
        );
      `);
      console.log('✅ Created promo_codes table');
    } else {
      console.log('✓ promo_codes table already exists');
    }

    // Check if promo_code_usage table exists
    const usageTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'promo_code_usage'
    `);
    
    if (usageTableCheck.rows.length === 0) {
      // Create promo_code_usage table
      await pool.query(`
        CREATE TABLE "promo_code_usage" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "promo_code_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "reward_amount" numeric(10, 8) NOT NULL,
          "used_at" timestamp DEFAULT now(),
          CONSTRAINT "promo_code_usage_promo_code_id_promo_codes_id_fk" 
            FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE no action ON UPDATE no action,
          CONSTRAINT "promo_code_usage_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
        );
      `);
      console.log('✅ Created promo_code_usage table');
    } else {
      console.log('✓ promo_code_usage table already exists');
    }

    console.log('🎉 Database setup complete! Your promo codes APIs should now work.');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

createPromoCodesTable();