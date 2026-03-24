const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { generateBoardingToken, generatePassengerToken } = require('../services/qrService');

// GET /api/boarding-pass/:bookingId/:token?p=passengerIndex
// Public — no auth. Secured by HMAC token.
router.get('/:bookingId/:token', async (req, res) => {
  try {
    const { bookingId, token } = req.params;
    const passengerIndex = req.query.p !== undefined ? parseInt(req.query.p) : null;

    // Verify token — booking-level, passenger-level (computed), or stored passengerTokens
    const bookingToken = generateBoardingToken(bookingId);
    const passengerToken = passengerIndex !== null
      ? generatePassengerToken(bookingId, passengerIndex)
      : null;

    // Also allow tokens stored on the booking document itself
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    // Check stored passenger tokens too
    const storedTokens = (booking.passengerTokens || []).map(t => t.token);
    const isValid = token === bookingToken
      || (passengerToken && token === passengerToken)
      || storedTokens.includes(token);

    if (!isValid) {
      return res.status(403).json({ error: 'Invalid boarding pass token' });
    }

    if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') {
      return res.status(403).json({ error: 'Boarding pass not available. Booking must be confirmed.' });
    }

    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    let returnFlight = null;
    if (booking.tripType === 'roundtrip' && booking.returnFlightId) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() };
    }

    // Strip sensitive fields
    const { userId, paymentProofURL, boardingToken: _bt, passengerQRs: _qrs, ...publicBooking } = booking;

    // If this is a passenger-specific scan, narrow the response to just that passenger
    if (passengerIndex !== null && booking.passengers?.[passengerIndex]) {
      publicBooking.scannedPassenger = booking.passengers[passengerIndex];
      publicBooking.scannedPassengerIndex = passengerIndex;
    }

    res.json({ booking: publicBooking, flight, returnFlight });
  } catch (error) {
    console.error('Boarding pass error:', error);
    res.status(500).json({ error: 'Failed to fetch boarding pass' });
  }
});

module.exports = router;
