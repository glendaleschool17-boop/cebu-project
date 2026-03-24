// delete-flights.js
// Run from your backend folder: node delete-flights.js

require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
  });
}

const db = admin.firestore();

const deleteAllFlights = async () => {
  console.log('🔍 Fetching all flights...');
  const snapshot = await db.collection('flights').get();

  if (snapshot.empty) {
    console.log('✅ No flights found. Nothing to delete.');
    process.exit(0);
  }

  console.log(`📋 Found ${snapshot.size} flights. Deleting...`);
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🗑️  Deleted ${Math.min(i + 400, docs.length)} / ${docs.length}`);
  }

  console.log('\n✅ Done! All flights deleted successfully.');
  console.log('You can now re-seed with: node seed-flights.js');
  process.exit(0);
};

deleteAllFlights().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
