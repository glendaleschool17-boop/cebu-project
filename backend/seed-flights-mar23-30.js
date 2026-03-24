/**
 * Flight Seed Script — March 23–30, 2026
 * Run: node seed-flights-mar23-30.js
 *
 * ADDITIVE — does NOT delete existing bookings or flights.
 * Only inserts new flights for March 23–30 into Firestore.
 * Safe to re-run (will insert duplicates if run twice — check Firestore if needed).
 */

require('dotenv').config();
const { db } = require('./config/firebase');

const routes = [
  { origin: 'MNL', originCity: 'Manila',          destination: 'CEB', destinationCity: 'Cebu',            depHour: 6,  arrHour: 7,  arrMin: 15, price: 1899, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'CEB', originCity: 'Cebu',            destination: 'MNL', destinationCity: 'Manila',          depHour: 9,  arrHour: 10, arrMin: 15, price: 1899, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'CEB', destinationCity: 'Cebu',            depHour: 14, arrHour: 15, arrMin: 15, price: 2099, aircraft: 'Airbus A321',    seats: 180 },
  { origin: 'CEB', originCity: 'Cebu',            destination: 'MNL', destinationCity: 'Manila',          depHour: 17, arrHour: 18, arrMin: 15, price: 2099, aircraft: 'Airbus A321',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'DVO', destinationCity: 'Davao',           depHour: 7,  arrHour: 9,  arrMin: 0,  price: 2499, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'DVO', originCity: 'Davao',           destination: 'MNL', destinationCity: 'Manila',          depHour: 10, arrHour: 12, arrMin: 0,  price: 2499, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'DVO', destinationCity: 'Davao',           depHour: 16, arrHour: 18, arrMin: 0,  price: 2699, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'ILO', destinationCity: 'Iloilo',          depHour: 8,  arrHour: 9,  arrMin: 10, price: 1799, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'ILO', originCity: 'Iloilo',          destination: 'MNL', destinationCity: 'Manila',          depHour: 11, arrHour: 12, arrMin: 10, price: 1799, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'BCD', destinationCity: 'Bacolod',         depHour: 7,  arrHour: 8,  arrMin: 5,  price: 1699, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'BCD', originCity: 'Bacolod',         destination: 'MNL', destinationCity: 'Manila',          depHour: 10, arrHour: 11, arrMin: 5,  price: 1699, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'KLO', destinationCity: 'Kalibo',          depHour: 9,  arrHour: 10, arrMin: 0,  price: 1599, aircraft: 'ATR 72-600',     seats: 72  },
  { origin: 'KLO', originCity: 'Kalibo',          destination: 'MNL', destinationCity: 'Manila',          depHour: 12, arrHour: 13, arrMin: 0,  price: 1599, aircraft: 'ATR 72-600',     seats: 72  },
  { origin: 'MNL', originCity: 'Manila',          destination: 'PPS', destinationCity: 'Puerto Princesa', depHour: 8,  arrHour: 9,  arrMin: 20, price: 2599, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'PPS', originCity: 'Puerto Princesa', destination: 'MNL', destinationCity: 'Manila',          depHour: 12, arrHour: 13, arrMin: 20, price: 2599, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'ZAM', destinationCity: 'Zamboanga',       depHour: 10, arrHour: 12, arrMin: 10, price: 2799, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'ZAM', originCity: 'Zamboanga',       destination: 'MNL', destinationCity: 'Manila',          depHour: 14, arrHour: 16, arrMin: 10, price: 2799, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'MNL', originCity: 'Manila',          destination: 'LGP', destinationCity: 'Legazpi',         depHour: 7,  arrHour: 8,  arrMin: 10, price: 1399, aircraft: 'ATR 72-600',     seats: 72  },
  { origin: 'LGP', originCity: 'Legazpi',         destination: 'MNL', destinationCity: 'Manila',          depHour: 10, arrHour: 11, arrMin: 10, price: 1399, aircraft: 'ATR 72-600',     seats: 72  },
  { origin: 'MNL', originCity: 'Manila',          destination: 'GEN', destinationCity: 'General Santos',  depHour: 9,  arrHour: 11, arrMin: 15, price: 2699, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'GEN', originCity: 'General Santos',  destination: 'MNL', destinationCity: 'Manila',          depHour: 13, arrHour: 15, arrMin: 15, price: 2699, aircraft: 'Boeing 737-800', seats: 160 },
  { origin: 'CEB', originCity: 'Cebu',            destination: 'DVO', destinationCity: 'Davao',           depHour: 8,  arrHour: 9,  arrMin: 20, price: 1999, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'DVO', originCity: 'Davao',           destination: 'CEB', destinationCity: 'Cebu',            depHour: 11, arrHour: 12, arrMin: 20, price: 1999, aircraft: 'Airbus A320',    seats: 180 },
  { origin: 'CEB', originCity: 'Cebu',            destination: 'ILO', destinationCity: 'Iloilo',          depHour: 10, arrHour: 10, arrMin: 55, price: 1499, aircraft: 'ATR 72-600',     seats: 72  },
  { origin: 'ILO', originCity: 'Iloilo',          destination: 'CEB', destinationCity: 'Cebu',            depHour: 13, arrHour: 13, arrMin: 55, price: 1499, aircraft: 'ATR 72-600',     seats: 72  },
];

// Flight number counters — use a high starting range (5000+) to avoid
// colliding with the April seed which starts at 100-series numbers.
const routeCounters = {};
const getFlightNumber = (origin, destination) => {
  const key = `${origin}-${destination}`;
  if (!routeCounters[key]) routeCounters[key] = 5000 + Object.keys(routeCounters).length * 100;
  return `CEB-${++routeCounters[key]}`;
};

const run = async () => {
  console.log('🛫 Seeding flights for March 23–30, 2026 (additive — no deletes)...\n');

  const flights = [];

  for (let day = 23; day <= 30; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;

    for (const route of routes) {
      const dep = new Date(`${dateStr}T${String(route.depHour).padStart(2,'0')}:00:00+08:00`);
      const arr = new Date(`${dateStr}T${String(route.arrHour).padStart(2,'0')}:${String(route.arrMin).padStart(2,'0')}:00+08:00`);

      // Weekends cost 10% more (Sat=6, Sun=0)
      const isWeekend = dep.getDay() === 0 || dep.getDay() === 6;
      const finalPrice = isWeekend ? Math.round(route.price * 1.1) : route.price;

      flights.push({
        flightNumber: getFlightNumber(route.origin, route.destination),
        origin: route.origin,
        originCity: route.originCity,
        destination: route.destination,
        destinationCity: route.destinationCity,
        departureTime: dep.toISOString(),
        arrivalTime: arr.toISOString(),
        price: finalPrice,
        totalSeats: route.seats,
        availableSeats: route.seats,
        bookedSeats: [],
        aircraft: route.aircraft,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
  }

  console.log(`📦 Total flights to seed: ${flights.length} (${routes.length} routes × 8 days)\n`);

  // Write in batches of 400
  for (let i = 0; i < flights.length; i += 400) {
    const batch = db.batch();
    flights.slice(i, i + 400).forEach(flight => {
      const ref = db.collection('flights').doc();
      batch.set(ref, flight);
    });
    await batch.commit();
    console.log(`  ✅ Committed: ${Math.min(i + 400, flights.length)} / ${flights.length}`);
  }

  console.log(`\n🎉 Done! ${flights.length} flights seeded for March 23–30, 2026.`);
  console.log('\nDates covered: March 23 (Sun) through March 30 (Sun)');
  console.log('Routes covered:');
  const unique = [...new Set(routes.map(r => `${r.origin} → ${r.destination}`))];
  unique.forEach(r => console.log(`  ✈️  ${r}`));
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
