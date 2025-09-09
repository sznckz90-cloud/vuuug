#!/usr/bin/env node
/**
 * CRITICAL: Production Referral Data Repair Script
 * This script fixes the missing referral data issue that caused:
 * - Friends referred showing as 0
 * - Referral earnings not appearing in balance
 * - Missing referral table entries
 * 
 * Run this ONCE on your production database to restore all referral data.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  users, 
  referrals, 
  earnings,
  referralCommissions 
} from './shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString, { ssl: { rejectUnauthorized: false } });
const db = drizzle(client);

async function repairReferralData() {
  try {
    console.log('🔧 STARTING PRODUCTION REFERRAL DATA REPAIR...');
    console.log('This will restore all missing referral data and earnings.');
    
    // Step 1: Find all users who have referred_by but no entry in referrals table
    console.log('\n📊 Step 1: Analyzing referral data...');
    
    const usersWithReferredBy = await db
      .select({
        userId: users.id,
        referredBy: users.referredBy,
        firstName: users.firstName,
        username: users.username,
        totalEarned: users.totalEarned,
        adsWatched: users.adsWatched
      })
      .from(users)
      .where(and(
        sql`${users.referredBy} IS NOT NULL`,
        sql`${users.referredBy} != ''`
      ));

    console.log(`Found ${usersWithReferredBy.length} users with referred_by field set`);
    
    if (usersWithReferredBy.length === 0) {
      console.log('✅ No users found with referred_by field. No repair needed.');
      return;
    }

    // Step 2: For each user with referred_by, create missing referral entries
    console.log('\n🔄 Step 2: Creating missing referral relationships...');
    let repairedCount = 0;
    let activatedBonuses = 0;

    for (const user of usersWithReferredBy) {
      try {
        if (!user.referredBy) continue;
        
        console.log(`Processing user: ${user.firstName || user.username || user.userId}`);
        
        // Find the referrer by their referral code
        const [referrer] = await db
          .select()
          .from(users)
          .where(eq(users.referralCode, user.referredBy))
          .limit(1);
        
        if (!referrer) {
          console.log(`  ⚠️  Referrer not found for code: ${user.referredBy}`);
          continue;
        }

        // Check if referral relationship already exists
        const [existingReferral] = await db
          .select()
          .from(referrals)
          .where(and(
            eq(referrals.referrerId, referrer.id),
            eq(referrals.refereeId, user.userId)
          ))
          .limit(1);

        if (existingReferral) {
          console.log(`  ✅ Referral already exists: ${referrer.firstName || referrer.username} -> ${user.firstName || user.username}`);
          continue;
        }

        // Create the missing referral relationship
        await db
          .insert(referrals)
          .values({
            referrerId: referrer.id,
            refereeId: user.userId,
            rewardAmount: "0.01",
            status: 'pending'
          });
        
        console.log(`  ✅ Created referral: ${referrer.firstName || referrer.username} -> ${user.firstName || user.username}`);
        repairedCount++;

        // Check if this user has watched enough ads to activate the bonus
        const [adCount] = await db
          .select({ count: sql`count(*)` })
          .from(earnings)
          .where(and(
            eq(earnings.userId, user.userId),
            eq(earnings.source, 'ad_watch')
          ));

        const adsWatched = parseInt(adCount?.count || '0');
        
        if (adsWatched >= 10) {
          // Activate the referral bonus
          await db
            .update(referrals)
            .set({ status: 'completed' })
            .where(and(
              eq(referrals.referrerId, referrer.id),
              eq(referrals.refereeId, user.userId)
            ));

          // Check if referral bonus already exists
          const [existingBonus] = await db
            .select()
            .from(earnings)
            .where(and(
              eq(earnings.userId, referrer.id),
              eq(earnings.source, 'referral'),
              sql`${earnings.description} LIKE '%${user.firstName || user.username || 'friend'}%'`
            ))
            .limit(1);

          if (!existingBonus) {
            // Add referral bonus earnings
            await db
              .insert(earnings)
              .values({
                userId: referrer.id,
                amount: "0.01",
                source: 'referral',
                description: `Referral bonus - ${user.firstName || user.username || 'friend'} watched ${adsWatched} ads`
              });

            // Update referrer's balance
            await db
              .update(users)
              .set({
                balance: sql`COALESCE(${users.balance}, 0) + 0.01`,
                withdrawBalance: sql`COALESCE(${users.withdrawBalance}, 0) + 0.01`,
                totalEarned: sql`COALESCE(${users.totalEarned}, 0) + 0.01`,
                totalEarnings: sql`COALESCE(${users.totalEarnings}, 0) + 0.01`,
                updatedAt: new Date()
              })
              .where(eq(users.id, referrer.id));

            console.log(`  💰 Activated $0.01 referral bonus for ${referrer.firstName || referrer.username}`);
            activatedBonuses++;
          }
        }

      } catch (error) {
        console.error(`  ❌ Error processing user ${user.userId}:`, error.message);
      }
    }

    // Step 3: Generate missing referral codes
    console.log('\n🔑 Step 3: Generating missing referral codes...');
    
    const usersWithoutCodes = await db
      .select({ id: users.id, firstName: users.firstName, username: users.username })
      .from(users)
      .where(sql`${users.referralCode} IS NULL OR ${users.referralCode} = ''`);
    
    for (const user of usersWithoutCodes) {
      const code = crypto.randomBytes(6).toString('hex');
      await db
        .update(users)
        .set({ referralCode: code })
        .where(eq(users.id, user.id));
    }

    // Step 4: Summary
    console.log('\n📋 REPAIR SUMMARY:');
    console.log(`✅ Repaired referral relationships: ${repairedCount}`);
    console.log(`💰 Activated referral bonuses: ${activatedBonuses}`);
    console.log(`🔑 Generated referral codes: ${usersWithoutCodes.length}`);
    
    // Get final stats
    const [totalReferrals] = await db
      .select({ count: sql`count(*)` })
      .from(referrals);
    
    const [completedReferrals] = await db
      .select({ count: sql`count(*)` })
      .from(referrals)
      .where(eq(referrals.status, 'completed'));

    const [totalReferralEarnings] = await db
      .select({ total: sql`COALESCE(SUM(${earnings.amount}), '0')` })
      .from(earnings)
      .where(sql`${earnings.source} IN ('referral', 'referral_commission')`);

    console.log('\n📈 CURRENT TOTALS:');
    console.log(`Total referrals in system: ${totalReferrals[0]?.count || 0}`);
    console.log(`Completed referrals: ${completedReferrals[0]?.count || 0}`);
    console.log(`Total referral earnings: $${totalReferralEarnings[0]?.total || '0'}`);
    
    console.log('\n🎉 REFERRAL DATA REPAIR COMPLETED SUCCESSFULLY!');
    console.log('Your referrals and earnings should now appear correctly in the app.');
    
  } catch (error) {
    console.error('❌ ERROR during referral data repair:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the repair
if (import.meta.url === `file://${process.argv[1]}`) {
  repairReferralData()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { repairReferralData };