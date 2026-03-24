/**
 * clear-bookings.js
 * Deletes ALL documents from the bookings collection.
 * Does NOT touch flights, users, or any other collection.
 *
 * Run: node clear-bookings.js
 */

require('dotenv').config();
const { db } = require('./config/firebase');

const run = async () => {
  console.log('🗑️  Fetching all bookings...');

  const snapshot = await db.collection('bookings').get();

  if (snapshot.empty) {
    console.log('ℹ️  No bookings found. Nothing to delete.');
    process.exit(0);
  }

  console.log(`📦 Found ${snapshot.size} booking(s). Deleting in batches...`);

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  ✅ Deleted: ${Math.min(i + 400, docs.length)} / ${docs.length}`);
  }

  console.log(`\n🎉 Done! ${docs.length} booking(s) deleted.`);
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
