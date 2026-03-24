/**
 * Firebase Seed Script - Run once to populate sample data
 * Usage: node seed.js
 * Requires: FIREBASE_* env vars set in .env
 */

require('dotenv').config();
const { db, auth } = require('./config/firebase');

const sampleFlights = [
  {
    flightNumber: 'CEB-101',
    origin: 'MNL', originCity: 'Manila',
    destination: 'CEB', destinationCity: 'Cebu',
    departureTime: '2026-04-15T06:00:00.000Z',
    arrivalTime: '2026-04-15T07:15:00.000Z',
    price: 1899,
    totalSeats: 180, availableSeats: 180, bookedSeats: [],
    aircraft: 'Airbus A320', status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    flightNumber: 'CEB-202',
    origin: 'MNL', originCity: 'Manila',
    destination: 'DVO', destinationCity: 'Davao',
    departureTime: '2026-04-15T08:00:00.000Z',
    arrivalTime: '2026-04-15T09:55:00.000Z',
    price: 2299,
    totalSeats: 180, availableSeats: 180, bookedSeats: [],
    aircraft: 'Airbus A321', status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    flightNumber: 'CEB-305',
    origin: 'CEB', originCity: 'Cebu',
    destination: 'ILO', destinationCity: 'Iloilo',
    departureTime: '2026-04-15T10:30:00.000Z',
    arrivalTime: '2026-04-15T11:15:00.000Z',
    price: 1499,
    totalSeats: 72, availableSeats: 72, bookedSeats: [],
    aircraft: 'ATR 72-600', status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    flightNumber: 'CEB-412',
    origin: 'MNL', originCity: 'Manila',
    destination: 'PPS', destinationCity: 'Puerto Princesa',
    departureTime: '2026-04-15T12:00:00.000Z',
    arrivalTime: '2026-04-15T13:20:00.000Z',
    price: 2599,
    totalSeats: 180, availableSeats: 180, bookedSeats: [],
    aircraft: 'Boeing 737-800', status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    flightNumber: 'CEB-520',
    origin: 'MNL', originCity: 'Manila',
    destination: 'KLO', destinationCity: 'Kalibo',
    departureTime: '2026-04-15T14:00:00.000Z',
    arrivalTime: '2026-04-15T14:55:00.000Z',
    price: 1799,
    totalSeats: 180, availableSeats: 180, bookedSeats: [],
    aircraft: 'Airbus A320', status: 'active',
    createdAt: new Date().toISOString(),
  },
];

const seedAdmin = async () => {
  try {
    // Create admin user
    let adminUser;
    try {
      adminUser = await auth.createUser({
        email: 'admin@cebuairlines.com',
        password: 'admin123',
        displayName: 'System Administrator',
      });
    } catch (e) {
      console.log('Admin user may already exist:', e.message);
      adminUser = await auth.getUserByEmail('admin@cebuairlines.com');
    }

    await db.collection('users').doc(adminUser.uid).set({
      name: 'System Administrator',
      email: 'admin@cebuairlines.com',
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Admin user created: admin@cebuairlines.com / admin123');

    // Create sample passenger
    let userAccount;
    try {
      userAccount = await auth.createUser({
        email: 'user@cebuairlines.com',
        password: 'user1234',
        displayName: 'Juan Dela Cruz',
      });
    } catch (e) {
      console.log('User may already exist:', e.message);
      userAccount = await auth.getUserByEmail('user@cebuairlines.com');
    }

    await db.collection('users').doc(userAccount.uid).set({
      name: 'Juan Dela Cruz',
      email: 'user@cebuairlines.com',
      phone: '+63 912 345 6789',
      role: 'passenger',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Sample user created: user@cebuairlines.com / user1234');

    // Seed flights
    for (const flight of sampleFlights) {
      const ref = await db.collection('flights').add(flight);
      console.log(`✅ Flight ${flight.flightNumber} created [${ref.id}]`);
    }

    console.log('\n🎉 Seed complete! You can now login with the sample accounts.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedAdmin();
