const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { generatePerPassengerQRs, generateBoardingPassQR } = require('../services/qrService');

// GET ticket data for printing/viewing
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    // Check ownership or admin
    if (booking.userId !== req.user.uid) {
      if (req.user.admin !== true) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') {
      return res.status(403).json({ error: 'Ticket not available. Payment must be confirmed first.' });
    }

    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    let returnFlight = null;
    if (booking.tripType === 'roundtrip' && booking.returnFlightId) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() }
    }

    // Generate per-passenger QRs for the ticket page
    let passengerQRs;
    const isMultiPax = booking.passengers && booking.passengers.length > 1;
    if (isMultiPax) {
      passengerQRs = await generatePerPassengerQRs(booking);
    } else {
      const { qrDataUrl, boardingToken } = await generateBoardingPassQR(booking);
      passengerQRs = [{ passengerIndex: 0, qrDataUrl, token: boardingToken }];
    }

    res.json({ booking, flight, returnFlight, passengerQRs });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

module.exports = router;
