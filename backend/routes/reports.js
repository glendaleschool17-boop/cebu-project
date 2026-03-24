const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyAdmin, filterBookingsByCity } = require('../middleware/auth');
const { calcVAT } = require('../utils/vatCalculator');

// GET booking report (filtered)
router.get('/bookings', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, flightId, status } = req.query;

    const snapshot = await db.collection('bookings').get();
    const rawBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ── Batch-fetch all unique flight IDs (no N+1 reads) ─────────────────────
    const flightIdSet = new Set(rawBookings.map(b => b.flightId).filter(Boolean));
    const flightDocs = await Promise.all(
      [...flightIdSet].map(id => db.collection('flights').doc(id).get())
    );
    const flightMap = {};
    flightDocs.forEach(d => { if (d.exists) flightMap[d.id] = { id: d.id, ...d.data() }; });

    let bookings = rawBookings.map(b => ({ ...b, flight: flightMap[b.flightId] || null }));

    // Apply city filter for regional admins (superAdmin sees all)
    bookings = filterBookingsByCity(bookings, req.adminCity, flightMap);

    // Filters
    if (startDate) {
      bookings = bookings.filter(b => new Date(b.bookingDate) >= new Date(startDate));
    }
    if (endDate) {
      bookings = bookings.filter(b => new Date(b.bookingDate) <= new Date(endDate + 'T23:59:59'));
    }
    if (flightId) {
      bookings = bookings.filter(b => b.flightId === flightId);
    }
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }

    const report = bookings.map(b => {
      const pax = b.passengerCount || 1;
      const vat = calcVAT(b.price || 0, pax);
      const grandTotal = b.grandTotal || vat.grandTotal;
      const vatAmount  = b.vatAmount  || vat.vatAmount;
      return {
        bookingId:     b.bookingId,
        passengerName: b.passengerName,
        passengerCount: pax,
        flightNumber:  b.flight?.flightNumber || 'N/A',
        route:         b.flight ? `${b.flight.origin} → ${b.flight.destination}` : 'N/A',
        seatNumber:    b.seatNumber,
        tripType:      b.tripType || 'oneway',
        seatClass:     b.seatClass || 'economy',
        price:         b.price,       // pre-VAT subtotal (kept for backward compat)
        vatAmount,
        grandTotal,                   // VAT-inclusive total
        status:        b.status,
        paymentStatus: b.paymentStatus,
        bookingDate:   b.bookingDate,
      };
    });

    // Revenue uses grandTotal (VAT-inclusive) for confirmed bookings
    const totalRevenue = bookings
      .filter(b => b.status === 'confirmed')
      .reduce((sum, b) => {
        const vat = calcVAT(b.price || 0, b.passengerCount || 1);
        return sum + (b.grandTotal || vat.grandTotal);
      }, 0);

    // Also provide pre-VAT subtotal for reference
    const totalSubtotal = bookings
      .filter(b => b.status === 'confirmed')
      .reduce((sum, b) => sum + (b.price || 0), 0);

    res.json({ report, totalRevenue, totalSubtotal, count: report.length, adminCity: req.adminCity || null });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
