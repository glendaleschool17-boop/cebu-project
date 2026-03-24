/**
 * migrate-admin-claims.js
 *
 * One-time migration: reads every Firestore user document that has
 * role === 'admin' and sets the Firebase Auth custom claim
 * { admin: true, adminCity: <value or null> }
 *
 * adminCity: null  = Super Admin (sees all bookings)
 * adminCity: 'CEB' = Regional Admin (sees only Cebu bookings)
 *
 * Run once from the project root:
 *   node backend/scripts/migrate-admin-claims.js
 *
 * Safe to re-run — setCustomUserClaims is idempotent.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { db, auth } = require('../config/firebase');

async function migrateAdminClaims() {
  console.log('🔍 Querying Firestore for users with role === "admin"...');

  const snapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .get();

  if (snapshot.empty) {
    console.log('ℹ️  No admin users found in Firestore. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`✅ Found ${snapshot.size} admin user(s). Setting custom claims...\n`);

  let success = 0, failed = 0;

  for (const doc of snapshot.docs) {
    const { email, adminCity } = doc.data();
    const uid = doc.id;
    try {
      await auth.setCustomUserClaims(uid, {
        admin: true,
        adminCity: adminCity || null,
      });
      const role = adminCity ? `Regional Admin (${adminCity})` : 'Super Admin';
      console.log(`  ✓ ${uid}  (${email || 'no email'}) — ${role}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${uid}  (${email || 'no email'}) — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Migration complete: ${success} succeeded, ${failed} failed.`);
  console.log('\n⚠️  Remind admins to sign out and back in for the new claims to take effect.');
  process.exit(failed > 0 ? 1 : 0);
}

migrateAdminClaims().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
