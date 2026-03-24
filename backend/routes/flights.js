const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { sendFlightCancelledNotice } = require('../services/emailService');

// GET all flights (with optional search and cursor-based pagination)
router.get('/', async (req, res) => {
  try {
    const { origin, destination, date, startAfter, limit: rawLimit } = req.query;
    const PAGE_SIZE = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 100);

    // Fetch all active flights — no orderBy to avoid requiring a composite index.
    // Sorting and pagination are applied in-memory after the fetch.
    const snapshot = await db.collection('flights')
      .where('status', '==', 'active')
      .get();

    let flights = [];
    snapshot.forEach(doc => {
      flights.push({ id: doc.id, ...doc.data() });
    });

    // Filter out past flights (departed more than 2 hours ago)
    const now = new Date();
    const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    flights = flights.filter(f => new Date(f.departureTime) > cutoff);

    // Apply search filters
    if (origin) {
      flights = flights.filter(f => f.origin.toLowerCase() === origin.toLowerCase());
    }
    if (destination) {
      flights = flights.filter(f => f.destination.toLowerCase() === destination.toLowerCase());
    }
    if (date) {
      flights = flights.filter(f => {
        const flightDate = new Date(f.departureTime).toISOString().split('T')[0];
        return flightDate === date;
      });
    }

    // Sort ascending by departure time
    flights.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

    // Cursor-based pagination: startAfter is the departureTime ISO string of the
    // last item on the previous page. Find its position and slice from there.
    let startIndex = 0;
    if (startAfter) {
      const cursorIndex = flights.findIndex(f => f.departureTime === startAfter);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }

    const page = flights.slice(startIndex, startIndex + PAGE_SIZE);
    const nextCursor = startIndex + PAGE_SIZE < flights.length
      ? page[page.length - 1].departureTime
      : null;

    res.json({ flights: page, nextCursor });
  } catch (error) {
    console.error('Get flights error:', error);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

// GET all flights for admin (includes cancelled flights) — admin only
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('flights').get();
    const flights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    flights.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
    res.json({ flights });
  } catch (error) {
    console.error('Admin get all flights error:', error);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

// GET active flights available for rebooking — authenticated users only
// Returns all active future flights (no pagination, sorted ascending) so the
// rebook modal can show the full list without the public 2-hour cutoff issue.
router.get('/available-for-rebook', verifyToken, async (req, res) => {
  try {
    const { origin, destination, seatClass } = req.query;

    const snapshot = await db.collection('flights')
      .where('status', '==', 'active')
      .get();

    let flights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Only exclude flights that have already departed
    const now = new Date();
    flights = flights.filter(f => new Date(f.departureTime) > now);

    // ── Same-route enforcement: filter by origin + destination if provided ──
    if (origin && destination) {
      const orig = origin.toUpperCase().trim();
      const dest = destination.toUpperCase().trim();
      flights = flights.filter(f =>
        f.origin?.toUpperCase() === orig &&
        f.destination?.toUpperCase() === dest
      );
    }

    // ── Seat class enforcement: only return flights with seats in the required class ──
    // Business class = rows 1–4 (seats A–D), Economy = rows 5–24 (seats A–F)
    if (seatClass) {
      const cls = seatClass.toLowerCase();
      const businessSeats = [];
      for (let row = 1; row <= 4; row++) {
        ['A','B','C','D'].forEach(col => businessSeats.push(`${row}${col}`));
      }
      const economySeats = [];
      for (let row = 5; row <= 24; row++) {
        ['A','B','C','D','E','F'].forEach(col => economySeats.push(`${row}${col}`));
      }

      flights = flights.filter(f => {
        const bookedSeats = f.bookedSeats || [];
        if (cls === 'business') {
          const availableBusiness = businessSeats.filter(s => !bookedSeats.includes(s));
          return availableBusiness.length > 0;
        } else {
          // economy — check there are economy seats remaining
          const availableEconomy = economySeats.filter(s => !bookedSeats.includes(s));
          return availableEconomy.length > 0;
        }
      });
    }

    // Sort ascending by departure
    flights.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

    res.json({ flights });
  } catch (error) {
    console.error('Available for rebook error:', error);
    res.status(500).json({ error: 'Failed to fetch available flights' });
  }
});

// GET single flight
router.get('/:flightId', async (req, res) => {
  try {
    const doc = await db.collection('flights').doc(req.params.flightId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flight' });
  }
});

// POST create flight (admin only)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const {
      flightNumber, origin, originCity, destination, destinationCity,
      departureTime, arrivalTime, price, totalSeats, aircraft, status
    } = req.body;

    // Basic required field validation
    if (!flightNumber?.trim()) return res.status(400).json({ error: 'flightNumber is required.' });
    if (!origin?.trim())       return res.status(400).json({ error: 'origin is required.' });
    if (!destination?.trim())  return res.status(400).json({ error: 'destination is required.' });
    if (!departureTime)        return res.status(400).json({ error: 'departureTime is required.' });
    if (!arrivalTime)          return res.status(400).json({ error: 'arrivalTime is required.' });
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0)
      return res.status(400).json({ error: 'price must be a non-negative number.' });
    if (origin.toUpperCase() === destination.toUpperCase())
      return res.status(400).json({ error: 'origin and destination cannot be the same.' });
    if (new Date(departureTime) < new Date())
      return res.status(400).json({ error: 'departureTime must be in the future.' });
    if (new Date(arrivalTime) <= new Date(departureTime))
      return res.status(400).json({ error: 'arrivalTime must be after departureTime.' });

    // Check for duplicate flight number on the same departure time
    const dupSnap = await db.collection('flights')
      .where('flightNumber', '==', flightNumber.trim().toUpperCase())
      .where('departureTime', '==', new Date(departureTime).toISOString())
      .limit(1).get();
    if (!dupSnap.empty)
      return res.status(409).json({ error: `Flight ${flightNumber} already exists at that departure time.` });

    const flightData = {
      flightNumber: flightNumber.trim().toUpperCase(),
      origin: origin.toUpperCase().trim(),
      originCity: (originCity || '').trim(),
      destination: destination.toUpperCase().trim(),
      destinationCity: (destinationCity || '').trim(),
      departureTime: new Date(departureTime).toISOString(),
      arrivalTime: new Date(arrivalTime).toISOString(),
      price: parseFloat(price),
      totalSeats: parseInt(totalSeats) || 180,
      availableSeats: parseInt(totalSeats) || 180,
      bookedSeats: [],
      aircraft: (aircraft || 'Airbus A320').trim(),
      status: status || 'active',
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('flights').add(flightData);
    res.status(201).json({ id: docRef.id, ...flightData });
  } catch (error) {
    console.error('Create flight error:', error);
    res.status(500).json({ error: 'Failed to create flight' });
  }
});

// PUT update flight (admin only)
// Only whitelisted fields are accepted — any other keys are silently dropped.
router.put('/:flightId', verifyAdmin, async (req, res) => {
  try {
    const ALLOWED_FIELDS = [
      'flightNumber', 'origin', 'originCity', 'destination', 'destinationCity',
      'departureTime', 'arrivalTime', 'price', 'totalSeats', 'aircraft', 'status',
      'cancellationReason',
    ];

    // Whitelist: only pick known safe fields from the body
    const raw = req.body;
    const updates = {};

    for (const key of ALLOWED_FIELDS) {
      if (raw[key] === undefined) continue;

      switch (key) {
        case 'price':
          updates.price = parseFloat(raw.price);
          if (isNaN(updates.price) || updates.price < 0)
            return res.status(400).json({ error: 'price must be a non-negative number.' });
          break;
        case 'totalSeats': {
          updates.totalSeats = parseInt(raw.totalSeats);
          if (isNaN(updates.totalSeats) || updates.totalSeats < 1)
            return res.status(400).json({ error: 'totalSeats must be a positive integer.' });
          break;
        }
        case 'origin':
        case 'destination':
          updates[key] = String(raw[key]).toUpperCase().trim().slice(0, 10);
          break;
        case 'status':
          if (!['active', 'cancelled', 'delayed'].includes(raw.status))
            return res.status(400).json({ error: 'status must be active, cancelled, or delayed.' });
          updates.status = raw.status;
          break;
        case 'cancellationReason':
          updates.cancellationReason = String(raw.cancellationReason).trim().slice(0, 500);
          break;
        case 'departureTime':
        case 'arrivalTime':
          if (isNaN(Date.parse(raw[key])))
            return res.status(400).json({ error: `${key} must be a valid ISO date string.` });
          updates[key] = new Date(raw[key]).toISOString();
          break;
        default:
          updates[key] = String(raw[key]).trim().slice(0, 200); // safe string cap
      }
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No valid fields provided for update.' });

    // If departureTime is updated, validate it is in the future
    if (updates.departureTime && new Date(updates.departureTime) < new Date())
      return res.status(400).json({ error: 'departureTime must be in the future.' });

    // If arrivalTime is updated, validate it is after departureTime
    if (updates.arrivalTime && updates.departureTime) {
      if (new Date(updates.arrivalTime) <= new Date(updates.departureTime))
        return res.status(400).json({ error: 'arrivalTime must be after departureTime.' });
    }

    updates.updatedAt = new Date().toISOString();
    await db.collection('flights').doc(req.params.flightId).update(updates);
    res.json({ message: 'Flight updated successfully', updated: Object.keys(updates) });
  } catch (error) {
    console.error('Update flight error:', error);
    res.status(500).json({ error: 'Failed to update flight' });
  }
});

// POST cancel flight (admin only) — requires a cancellation reason
// Marks the flight as cancelled, flags all affected confirmed bookings with
// flight_cancelled status and pending_action so users see refund/rebook options,
// and sends email notifications to every affected passenger.
router.post('/:flightId/cancel', verifyAdmin, async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    if (!cancellationReason || !cancellationReason.trim()) {
      return res.status(400).json({ error: 'A cancellation reason is required.' });
    }

    const flightDoc = await db.collection('flights').doc(req.params.flightId).get();
    if (!flightDoc.exists) return res.status(404).json({ error: 'Flight not found' });
    const flight = { id: flightDoc.id, ...flightDoc.data() };

    if (flight.status === 'cancelled') {
      return res.status(400).json({ error: 'Flight is already cancelled.' });
    }

    const now = new Date().toISOString();

    // Mark flight as cancelled with reason
    await flightDoc.ref.update({
      status: 'cancelled',
      cancellationReason: cancellationReason.trim(),
      cancelledAt: now,
      updatedAt: now,
    });

    // Find all confirmed (and payment_submitted) bookings on this flight
    const [confirmedSnap, pendingSnap] = await Promise.all([
      db.collection('bookings').where('flightId', '==', req.params.flightId).where('status', '==', 'confirmed').get(),
      db.collection('bookings').where('flightId', '==', req.params.flightId).where('status', '==', 'payment_submitted').get(),
    ]);

    const affectedDocs = [...confirmedSnap.docs, ...pendingSnap.docs];

    // Process each affected booking: update Firestore, then notify
    const updatePromises = affectedDocs.map(async (doc) => {
      const booking = { id: doc.id, ...doc.data() };
      const trimmedReason = cancellationReason.trim();

      // Calculate full refund amount (airline-initiated = 100% refund, no penalty)
      const grandTotal = booking.grandTotal || (booking.price || 0) * 1.12;
      const refundAmount = Math.round(grandTotal);

      // Update booking: mark as flight_cancelled with pending_action for the user
      // Save reason under BOTH field names for full compatibility
      await doc.ref.update({
        status: 'flight_cancelled',
        flightCancelledAt: now,
        flightCancellationReason: trimmedReason,  // used by MyBookings banner
        cancellationReason: trimmedReason,          // used by AdminBookings panel
        pendingAction: 'refund_or_rebook',
        // Pre-calculate the full refund amount so it's ready when user requests it
        refundAmount,
        updatedAt: now,
      });

      return { booking, refundAmount };
    });

    const updatedBookings = await Promise.all(updatePromises);

    // Send notifications AFTER all Firestore writes succeed
    // Run in parallel but log individual failures — never block the response
    const notifyPromises = updatedBookings.map(({ booking }) => {
      const trimmedReason = cancellationReason.trim();

      const emailPromise = sendFlightCancelledNotice(booking, flight, trimmedReason)
        .then(() => console.log(`Flight cancel email sent → ${booking.passengerEmail} [${booking.bookingId}]`))
        .catch(e => console.error(`Flight cancel email FAILED for ${booking.bookingId}: ${e.message}`));

      const inAppPromise = notify.flightCancelled(booking, flight)
        .catch(e => console.error(`In-app notify FAILED for ${booking.bookingId}: ${e.message}`));

      return Promise.all([emailPromise, inAppPromise]);
    });

    // Fire-and-forget the notifications so slow SMTP doesn't delay the HTTP response
    Promise.all(notifyPromises).catch(e => console.error('Notify batch error:', e.message));

    res.json({
      message: 'Flight cancelled successfully',
      passengersNotified: affectedDocs.length,
    });
  } catch (error) {
    console.error('Cancel flight error:', error);
    res.status(500).json({ error: 'Failed to cancel flight' });
  }
});

// DELETE flight (admin only) — legacy, kept for compatibility
router.delete('/:flightId', verifyAdmin, async (req, res) => {
  try {
    const flightDoc = await db.collection('flights').doc(req.params.flightId).get();
    if (!flightDoc.exists) return res.status(404).json({ error: 'Flight not found' });
    const flight = { id: flightDoc.id, ...flightDoc.data() };
    const now = new Date().toISOString();
    await flightDoc.ref.update({ status: 'cancelled', cancelledAt: now, updatedAt: now });
    res.json({ message: 'Flight cancelled', passengersNotified: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel flight' });
  }
});

module.exports = router;
