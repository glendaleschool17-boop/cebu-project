const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyAdmin, filterBookingsByCity } = require('../middleware/auth');
const { generateBoardingPassQR, generatePerPassengerQRs } = require('../services/qrService');
const { sendBookingConfirmation, sendPaymentRejected, sendCancellationApproved, sendCancellationRejected, sendRescheduleApproved, sendRescheduleRejected, sendRefundSent } = require('../services/emailService');
const { notify } = require('../services/notificationService');

// GET all bookings (admin)
router.get('/bookings', verifyAdmin, async (req, res) => {
  try {
    const { status, flightId, date } = req.query;

    const snapshot = await db.collection('bookings').get();
    const rawBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ── Batch-fetch all unique flight IDs in one round (no N+1 reads) ────────
    const flightIdSet = new Set();
    rawBookings.forEach(b => {
      if (b.flightId) flightIdSet.add(b.flightId);
      if (b.returnFlightId) flightIdSet.add(b.returnFlightId);
    });
    const flightDocs = await Promise.all(
      [...flightIdSet].map(id => db.collection('flights').doc(id).get())
    );
    const flightMap = {};
    flightDocs.forEach(d => { if (d.exists) flightMap[d.id] = { id: d.id, ...d.data() }; });

    // Attach cached flight objects to each booking
    let bookings = rawBookings.map(b => ({
      ...b,
      flight:       flightMap[b.flightId]       || null,
      returnFlight: flightMap[b.returnFlightId] || null,
    }));

    // Apply city filter for regional admins
    bookings = filterBookingsByCity(bookings, req.adminCity, flightMap);

    // Sort descending
    bookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    // Apply filters
    if (status)   bookings = bookings.filter(b => b.status === status);
    if (flightId) bookings = bookings.filter(b => b.flightId === flightId);
    if (date) {
      bookings = bookings.filter(b => {
        const bookingDate = new Date(b.bookingDate).toISOString().split('T')[0];
        return bookingDate === date;
      });
    }

    res.json({ bookings });
  } catch (error) {
    console.error('Admin get bookings error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
  }
});

// POST approve booking
router.post('/approve/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    // Fetch flight
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (!flightDoc.exists) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    const flight = { id: flightDoc.id, ...flightDoc.data() };

    // Fetch return flight if round trip
    let returnFlight = null;
    if (booking.tripType === 'roundtrip' && booking.returnFlightId) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() };
    }

    // Generate QR codes — one per passenger for multi-pax, single for solo
    const isMultiPax = booking.passengers && booking.passengers.length > 1;
    let passengerQRs, qrCodeURL, boardingToken;

    if (isMultiPax) {
      passengerQRs = await generatePerPassengerQRs(booking);
      qrCodeURL = passengerQRs[0].qrDataUrl; // store lead passenger QR as main
      boardingToken = passengerQRs[0].token;
    } else {
      const result = await generateBoardingPassQR(booking);
      qrCodeURL = result.qrDataUrl;
      boardingToken = result.boardingToken;
      passengerQRs = [{ passengerIndex: 0, qrDataUrl: qrCodeURL, token: boardingToken }];
    }

    // Send confirmation email(s) with per-passenger tickets
    await sendBookingConfirmation(booking, flight, passengerQRs, returnFlight);

    // Update booking — store per-passenger tokens for verification
    const passengerTokenMap = passengerQRs.map(q => ({ index: q.passengerIndex, token: q.token }));
    await doc.ref.update({
      status: 'confirmed',
      paymentStatus: 'paid',
      qrCodeURL,
      boardingToken,
      passengerTokens: passengerTokenMap,
      emailSent: true,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await notify.bookingConfirmed({ ...booking }).catch(() => {});
    res.json({ message: 'Booking approved, email sent', bookingId });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({ error: 'Failed to approve booking' });
  }
});

// POST reject booking
router.post('/reject/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    // Fetch flight for email details
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    await doc.ref.update({
      status: 'rejected',
      paymentStatus: 'rejected',
      rejectionReason: reason || 'Payment proof not valid',
      updatedAt: new Date().toISOString(),
    });

    // Release outbound seats
    if (flightDoc.exists) {
      const flightData = flightDoc.data();
      const seatsToRelease = booking.seatNumbers || [booking.seatNumber];
      const updatedSeats = (flightData.bookedSeats || []).filter(s => !seatsToRelease.includes(s));
      await flightDoc.ref.update({
        bookedSeats: updatedSeats,
        availableSeats: (flightData.availableSeats || 0) + seatsToRelease.length,
      });
    }

    // Release return seats for round-trip bookings
    if (booking.returnFlightId && booking.returnSeatNumbers?.length > 0) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) {
        const retFlight = retDoc.data();
        await retDoc.ref.update({
          bookedSeats: (retFlight.bookedSeats || []).filter(s => !booking.returnSeatNumbers.includes(s)),
          availableSeats: (retFlight.availableSeats || 0) + booking.returnSeatNumbers.length,
        });
      }
    }

    // Send rejection email
    try {
      await sendPaymentRejected(booking, flight, reason);
    } catch (emailErr) {
      console.error('Rejection email failed (non-fatal):', emailErr.message);
    }

    await notify.paymentRejected({ ...booking }).catch(() => {});
    res.json({ message: 'Booking rejected, email sent to passenger' });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

// POST approve cancellation request
router.post('/approve-cancellation/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.status !== 'cancellation_requested') {
      return res.status(400).json({ error: 'Booking does not have a pending cancellation request' });
    }

    const now = new Date().toISOString();
    const { calcVAT } = require('../utils/vatCalculator');
    const pax = booking.passengerCount || 1;
    const vat = calcVAT(booking.price || 0, pax);
    const refundAmount = booking.cancellationFeeBreakdown?.totalRefund
      || vat.grandTotal;  // fallback to full grand total if no fee breakdown

    await doc.ref.update({
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationApprovedAt: now,
      cancelledAt: now,
      updatedAt: now,
      // Refund audit trail
      refundAmount,
      refundSent: false,          // admin must manually mark as sent after processing
      refundProcessedAt: null,
      refundProcessedBy: null,
    });

    // Release outbound seats back to the flight
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;
    if (flightDoc.exists) {
      const flightData = flightDoc.data();
      const seatsToRelease = booking.seatNumbers || [booking.seatNumber];
      await flightDoc.ref.update({
        bookedSeats: (flightData.bookedSeats || []).filter(s => !seatsToRelease.includes(s)),
        availableSeats: (flightData.availableSeats || 0) + seatsToRelease.length,
      });
    }

    // Release return seats for round-trip bookings
    if (booking.returnFlightId && booking.returnSeatNumbers?.length > 0) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) {
        const retFlight = retDoc.data();
        await retDoc.ref.update({
          bookedSeats: (retFlight.bookedSeats || []).filter(s => !booking.returnSeatNumbers.includes(s)),
          availableSeats: (retFlight.availableSeats || 0) + booking.returnSeatNumbers.length,
        });
      }
    }

    // Send cancellation approved email
    try {
      await sendCancellationApproved({ id: doc.id, ...booking }, flight);
    } catch (emailErr) {
      console.error('Cancellation approved email failed (non-fatal):', emailErr.message);
    }

    await notify.cancellationApproved({ ...booking }).catch(() => {});
    res.json({ message: 'Cancellation approved, seat released, email sent', bookingId });
  } catch (error) {
    console.error('Approve cancellation error:', error);
    res.status(500).json({ error: 'Failed to approve cancellation' });
  }
});

// POST mark refund as sent (admin only)
router.post('/mark-refund-sent/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });
    const doc = snapshot.docs[0];
    const booking = doc.data();
    // Accept bookings that are cancelled (user-requested) OR flight-cancelled with a pending refund
    const isEligible = booking.status === 'cancelled'
      || (booking.status === 'flight_cancelled' && booking.paymentStatus === 'refund_pending');
    if (!isEligible) {
      return res.status(400).json({ error: 'Booking is not eligible for refund processing.' });
    }
    const now = new Date().toISOString();
    const adminDoc = await db.collection('users').doc(req.user.uid).get();
    const adminName = adminDoc.exists ? (adminDoc.data().name || adminDoc.data().email) : req.user.email;
    await doc.ref.update({
      refundSent: true,
      paymentStatus: 'refunded',
      refundProcessedAt: now,
      refundProcessedBy: adminName,
      updatedAt: now,
    });

    // Send refund confirmation email to passenger
    const updatedBooking = { ...booking, refundSent: true, refundProcessedAt: now, refundProcessedBy: adminName };
    try {
      await sendRefundSent(updatedBooking);
    } catch (emailErr) {
      console.error('Refund sent email failed (non-fatal):', emailErr.message);
    }

    res.json({ message: 'Refund marked as sent.', bookingId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark refund as sent' });
  }
});

// POST approve reschedule request
router.post('/approve-reschedule/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.status === 'reschedule_payment_pending') {
      return res.status(400).json({ error: 'Cannot approve reschedule: passenger has not yet uploaded GCash payment proof. Wait for payment submission before approving.' });
    }
    if (booking.status !== 'reschedule_requested') {
      return res.status(400).json({ error: 'Booking does not have a pending reschedule request' });
    }

    const now = new Date().toISOString();
    await doc.ref.update({
      status: 'confirmed',
      rescheduleApprovedAt: now,
      updatedAt: now,
    });

    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    // Also load return flight if round trip
    let returnFlight = null;
    if (booking.returnFlightId) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() };
    }

    // Regenerate QR codes for the updated booking
    const isMultiPax = booking.passengers && booking.passengers.length > 1;
    let passengerQRs, qrCodeURL, boardingToken;
    if (isMultiPax) {
      passengerQRs = await generatePerPassengerQRs(booking);
      qrCodeURL    = passengerQRs[0].qrDataUrl;
      boardingToken = passengerQRs[0].token;
    } else {
      const result = await generateBoardingPassQR(booking);
      qrCodeURL     = result.qrDataUrl;
      boardingToken = result.boardingToken;
      passengerQRs  = [{ passengerIndex: 0, qrDataUrl: qrCodeURL, token: boardingToken }];
    }

    // Update QR codes in Firestore
    const passengerTokenMap = passengerQRs.map(q => ({ index: q.passengerIndex, token: q.token }));
    await doc.ref.update({
      qrCodeURL,
      boardingToken,
      passengerTokens: passengerTokenMap,
      updatedAt: now,
    });

    try {
      await sendRescheduleApproved({ id: doc.id, ...booking, returnFlight }, flight, passengerQRs, returnFlight);
    } catch (e) { console.error('Reschedule approved email failed:', e.message); }

    await notify.rescheduleApproved({ ...booking }).catch(() => {});
    res.json({ message: 'Reschedule approved', bookingId });
  } catch (error) {
    console.error('Approve reschedule error:', error);
    res.status(500).json({ error: 'Failed to approve reschedule' });
  }
});

// POST reject reschedule request
router.post('/reject-reschedule/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.status !== 'reschedule_requested') {
      return res.status(400).json({ error: 'Booking does not have a pending reschedule request' });
    }

    // Revert flight assignment: release new flight seats, re-book old flight
    const pending = booking.pendingReschedule;
    const leg = pending?.leg || (booking.previousFlightId ? 'outbound' : null);

    if (leg !== 'return' && booking.previousFlightId && booking.flightId !== booking.previousFlightId) {
      const seats = booking.seatNumbers || [booking.seatNumber];
      const [oldDoc, newDoc] = await Promise.all([
        db.collection('flights').doc(booking.previousFlightId).get(),
        db.collection('flights').doc(booking.flightId).get(),
      ]);
      if (newDoc.exists) {
        const nd = newDoc.data();
        await newDoc.ref.update({
          bookedSeats: (nd.bookedSeats || []).filter(s => !seats.includes(s)),
          availableSeats: (nd.availableSeats || 0) + seats.length,
        });
      }
      if (oldDoc.exists) {
        const od = oldDoc.data();
        await oldDoc.ref.update({
          bookedSeats: [...(od.bookedSeats || []), ...seats],
          availableSeats: (od.availableSeats || 0) - seats.length,
        });
      }
    }

    if ((leg === 'return' || leg === 'both') && booking.previousReturnFlightId) {
      const retSeats = booking.returnSeatNumbers || booking.seatNumbers || [booking.seatNumber];
      const [oldRetDoc, newRetDoc] = await Promise.all([
        db.collection('flights').doc(booking.previousReturnFlightId).get(),
        db.collection('flights').doc(booking.returnFlightId).get(),
      ]);
      if (newRetDoc.exists) {
        const nd = newRetDoc.data();
        await newRetDoc.ref.update({
          bookedSeats: (nd.bookedSeats || []).filter(s => !retSeats.includes(s)),
          availableSeats: (nd.availableSeats || 0) + retSeats.length,
        });
      }
      if (oldRetDoc.exists) {
        const od = oldRetDoc.data();
        await oldRetDoc.ref.update({
          bookedSeats: [...(od.bookedSeats || []), ...retSeats],
          availableSeats: (od.availableSeats || 0) - retSeats.length,
        });
      }
    }

    await doc.ref.update({
      status: 'confirmed',
      flightId: booking.previousFlightId || booking.flightId,
      ...(booking.previousReturnFlightId ? { returnFlightId: booking.previousReturnFlightId } : {}),
      ...(booking.previousSeatNumbers ? { seatNumbers: booking.previousSeatNumbers, seatNumber: booking.previousSeatNumbers[0] } : {}),
      ...(booking.previousReturnSeatNumbers ? { returnSeatNumbers: booking.previousReturnSeatNumbers } : {}),
      ...(booking.previousSeatClass ? { seatClass: booking.previousSeatClass } : {}),
      pendingReschedule: null,
      rescheduleRejectedAt: new Date().toISOString(),
      rescheduleRejectionReason: reason || 'Request rejected by admin',
      updatedAt: new Date().toISOString(),
    });

    const flightDoc = await db.collection('flights').doc(booking.previousFlightId || booking.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    try {
      await sendRescheduleRejected({ id: doc.id, ...booking }, flight, reason);
    } catch (e) { console.error('Reschedule rejected email failed:', e.message); }

    await notify.rescheduleRejected({ ...booking }).catch(() => {});
    res.json({ message: 'Reschedule rejected, booking restored', bookingId });
  } catch (error) {
    console.error('Reject reschedule error:', error);
    res.status(500).json({ error: 'Failed to reject reschedule' });
  }
});

// POST reject cancellation request
router.post('/reject-cancellation/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const bookingData = { id: doc.id, ...doc.data() };

    if (bookingData.status !== 'cancellation_requested') {
      return res.status(400).json({ error: 'Booking does not have a pending cancellation request' });
    }

    await doc.ref.update({
      status: 'confirmed',
      cancellationRejectedAt: new Date().toISOString(),
      cancellationRejectionReason: reason || 'Request rejected by admin',
      updatedAt: new Date().toISOString(),
    });

    // Fetch flight for email
    const flightDoc = await db.collection('flights').doc(bookingData.flightId).get();
    const flight = flightDoc.exists ? { id: flightDoc.id, ...flightDoc.data() } : null;

    // Send cancellation rejected email
    try {
      await sendCancellationRejected(bookingData, flight, reason);
    } catch (emailErr) {
      console.error('Cancellation rejected email failed (non-fatal):', emailErr.message);
    }

    await notify.cancellationRejected({ ...bookingData }).catch(() => {});
    res.json({ message: 'Cancellation request rejected, booking remains confirmed, email sent', bookingId });
  } catch (error) {
    console.error('Reject cancellation error:', error);
    res.status(500).json({ error: 'Failed to reject cancellation request' });
  }
});

// POST resend confirmation email (uses existing tokens — no booking data changes)
router.post('/resend-email/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed bookings can have their email resent.' });
    }

    // Fetch flight
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (!flightDoc.exists) return res.status(404).json({ error: 'Flight not found' });
    const flight = { id: flightDoc.id, ...flightDoc.data() };

    // Fetch return flight if round trip
    let returnFlight = null;
    if (booking.tripType === 'roundtrip' && booking.returnFlightId) {
      const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
      if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() };
    }

    // Regenerate QR images from the same deterministic tokens — produces identical QRs
    const isMultiPax = booking.passengers && booking.passengers.length > 1;
    let passengerQRs;

    if (isMultiPax) {
      passengerQRs = await generatePerPassengerQRs(booking);
    } else {
      const result = await generateBoardingPassQR(booking);
      passengerQRs = [{ passengerIndex: 0, qrDataUrl: result.qrDataUrl, token: result.boardingToken }];
    }

    await sendBookingConfirmation(booking, flight, passengerQRs, returnFlight);

    res.json({ message: 'Confirmation email resent successfully.' });
  } catch (error) {
    console.error('Resend email error:', error);
    res.status(500).json({ error: 'Failed to resend email.' });
  }
});

// GET admin dashboard stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const bookingsSnap = await db.collection('bookings').get();
    const flightsSnap = await db.collection('flights').where('status', '==', 'active').get();

    const { calcVAT } = require('../utils/vatCalculator');

    // Build flight map for city filtering
    const flightMap = {};
    flightsSnap.forEach(d => { flightMap[d.id] = { id: d.id, ...d.data() }; });
    // Also fetch flights referenced in bookings but not in active list
    const allBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const extraFlightIds = new Set();
    allBookings.forEach(b => {
      if (b.flightId && !flightMap[b.flightId]) extraFlightIds.add(b.flightId);
      if (b.returnFlightId && !flightMap[b.returnFlightId]) extraFlightIds.add(b.returnFlightId);
    });
    if (extraFlightIds.size > 0) {
      const extraDocs = await Promise.all([...extraFlightIds].map(id => db.collection('flights').doc(id).get()));
      extraDocs.forEach(d => { if (d.exists) flightMap[d.id] = { id: d.id, ...d.data() }; });
    }

    const filteredBookings = filterBookingsByCity(allBookings, req.adminCity, flightMap);

    let stats = {
      total: 0, confirmed: 0, pending: 0, rejected: 0, cancelled: 0,
      cancellationRequested: 0, rescheduleRequested: 0, revenue: 0,
    };

    filteredBookings.forEach(b => {
      stats.total++;
      if (b.status === 'confirmed') {
        stats.confirmed++;
        const pax = b.passengerCount || 1;
        const vat = calcVAT(b.price || 0, pax);
        stats.revenue += (b.grandTotal || vat.grandTotal);
      }
      if (b.status === 'payment_submitted') stats.pending++;
      if (b.status === 'rejected') stats.rejected++;
      if (b.status === 'cancelled') stats.cancelled++;
      if (b.status === 'cancellation_requested') stats.cancellationRequested++;
      if (b.status === 'reschedule_requested') stats.rescheduleRequested++;
      if (b.status === 'reschedule_payment_pending') stats.rescheduleRequested++;
    });

    // Active flights: superAdmin sees all, regional admin sees only their city's flights
    let activeFlights = flightsSnap.size;
    if (req.adminCity) {
      activeFlights = flightsSnap.docs.filter(d => {
        const f = d.data();
        return f.origin === req.adminCity || f.destination === req.adminCity;
      }).length;
    }

    res.json({
      ...stats,
      activeFlights,
      adminCity: req.adminCity || null,
      isSuperAdmin: req.isSuperAdmin,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Regional Admin Management (superAdmin only) ───────────────────────────────

// GET all admin users (superAdmin only)
router.get('/admin-users', verifyAdmin, async (req, res) => {
  if (!req.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage admin users.' });
  try {
    const [adminSnap, gateSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'admin').get(),
      db.collection('users').where('role', '==', 'gate_agent').get(),
    ]);
    const admins = [
      ...adminSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
      ...gateSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
    ];
    res.json({ admins });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// POST create/update a regional admin or gate_agent (superAdmin only)
router.post('/admin-users', verifyAdmin, async (req, res) => {
  if (!req.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage admin users.' });
  try {
    const { uid, adminCity, role: assignedRole } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const role = assignedRole === 'gate_agent' ? 'gate_agent' : 'admin';

    await db.collection('users').doc(uid).set({
      role,
      adminCity: role === 'admin' ? (adminCity || null) : null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Only set admin Firebase claims for actual admins
    if (role === 'admin') {
      const { setAdminClaim } = require('../middleware/auth');
      await setAdminClaim(uid, true, adminCity || null);
    } else {
      // Gate agents: revoke any admin claim they may have had
      const { setAdminClaim } = require('../middleware/auth');
      await setAdminClaim(uid, false);
    }

    res.json({ message: `${role === 'gate_agent' ? 'Gate Agent' : 'Admin'} updated successfully`, uid, role });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user: ' + e.message });
  }
});

// DELETE revoke admin access (superAdmin only)
router.delete('/admin-users/:uid', verifyAdmin, async (req, res) => {
  if (!req.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage admin users.' });
  try {
    const { uid } = req.params;
    // Use set+merge so it works even if doc doesn't exist
    await db.collection('users').doc(uid).set({
      role: 'passenger',
      adminCity: null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    const { setAdminClaim } = require('../middleware/auth');
    await setAdminClaim(uid, false);
    res.json({ message: 'Admin access revoked', uid });
  } catch (e) {
    res.status(500).json({ error: 'Failed to revoke admin access: ' + e.message });
  }
});

// POST process a rebooking — admin assigns passenger to a new flight
// body: { newFlightId, newSeatNumbers: string[] }
router.post('/process-rebook/:bookingId', verifyAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newFlightId, newSeatNumbers } = req.body;

    if (!newFlightId) return res.status(400).json({ error: 'newFlightId is required.' });
    if (!Array.isArray(newSeatNumbers) || newSeatNumbers.length === 0) {
      return res.status(400).json({ error: 'newSeatNumbers (array) is required.' });
    }

    // ── Fetch booking ──────────────────────────────────────────────────────
    const snap = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Booking not found' });
    const bookingDoc = snap.docs[0];
    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    if (booking.status !== 'flight_cancelled') {
      return res.status(400).json({ error: 'Booking is not in a flight-cancelled state.' });
    }
    if (booking.pendingAction !== 'rebook_pending') {
      return res.status(400).json({ error: 'Passenger has not requested a rebook yet.' });
    }

    // ── Fetch new flight ───────────────────────────────────────────────────
    const newFlightDoc = await db.collection('flights').doc(newFlightId).get();
    if (!newFlightDoc.exists) return res.status(404).json({ error: 'New flight not found' });
    const newFlight = { id: newFlightDoc.id, ...newFlightDoc.data() };

    if (newFlight.status !== 'active') {
      return res.status(400).json({ error: 'Selected flight is not active.' });
    }

    const pax = booking.passengerCount || newSeatNumbers.length || 1;

    // Check enough seats are available on the new flight
    const alreadyBooked = newFlight.bookedSeats || [];
    const conflicts = newSeatNumbers.filter(s => alreadyBooked.includes(s));
    if (conflicts.length > 0) {
      return res.status(409).json({ error: `Seat(s) already taken on new flight: ${conflicts.join(', ')}` });
    }
    if ((newFlight.availableSeats || 0) < pax) {
      return res.status(409).json({ error: 'Not enough available seats on the selected flight.' });
    }

    const now = new Date().toISOString();

    // ── Reserve seats on new flight ────────────────────────────────────────
    await newFlightDoc.ref.update({
      bookedSeats: [...alreadyBooked, ...newSeatNumbers],
      availableSeats: (newFlight.availableSeats || 0) - pax,
      updatedAt: now,
    });

    // ── Release seats from the old (cancelled) flight if they exist ────────
    const oldFlightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (oldFlightDoc.exists) {
      const oldFlight = oldFlightDoc.data();
      const oldBooked = (oldFlight.bookedSeats || [])
        .filter(s => !(booking.seatNumbers || [booking.seatNumber]).includes(s));
      const seatsReleased = (booking.seatNumbers || [booking.seatNumber]).length;
      await oldFlightDoc.ref.update({
        bookedSeats: oldBooked,
        availableSeats: (oldFlight.availableSeats || 0) + seatsReleased,
        updatedAt: now,
      });
    }

    // ── Rebuild updated booking data for QR / email ────────────────────────
    const updatedBooking = {
      ...booking,
      flightId: newFlightId,
      seatNumbers: newSeatNumbers,
      seatNumber: newSeatNumbers[0],
      status: 'confirmed',
      paymentStatus: 'paid',
      pendingAction: null,
      rebookedAt: now,
      rebookedFromFlightId: booking.flightId,
      rebookedToFlightId: newFlightId,
      updatedAt: now,
    };

    // ── Regenerate QR codes ────────────────────────────────────────────────
    const isMultiPax = booking.passengers && booking.passengers.length > 1;
    let passengerQRs, qrCodeURL, boardingToken;

    if (isMultiPax) {
      passengerQRs = await generatePerPassengerQRs(updatedBooking);
      qrCodeURL    = passengerQRs[0].qrDataUrl;
      boardingToken = passengerQRs[0].token;
    } else {
      const result  = await generateBoardingPassQR(updatedBooking);
      qrCodeURL     = result.qrDataUrl;
      boardingToken = result.boardingToken;
      passengerQRs  = [{ passengerIndex: 0, qrDataUrl: qrCodeURL, token: boardingToken }];
    }
    const passengerTokenMap = passengerQRs.map(q => ({ index: q.passengerIndex, token: q.token }));

    // ── Persist the rebooking on the booking document ──────────────────────
    await bookingDoc.ref.update({
      flightId: newFlightId,
      seatNumbers: newSeatNumbers,
      seatNumber: newSeatNumbers[0],
      status: 'confirmed',
      paymentStatus: 'paid',
      pendingAction: null,
      rebookedAt: now,
      rebookedFromFlightId: booking.flightId,
      rebookedToFlightId: newFlightId,
      qrCodeURL,
      boardingToken,
      passengerTokens: passengerTokenMap,
      updatedAt: now,
    });

    // ── Send confirmation email with new boarding pass ─────────────────────
    try {
      await sendBookingConfirmation(updatedBooking, newFlight, passengerQRs, null);
    } catch (emailErr) {
      console.error('Rebook confirmation email failed (non-fatal):', emailErr.message);
    }

    // ── Notify passenger ───────────────────────────────────────────────────
    notify.rebookConfirmed(booking, newFlight).catch(() => {});

    res.json({
      message: `Rebooking confirmed. Passenger assigned to Flight ${newFlight.flightNumber}.`,
      bookingId,
      newFlightId,
      newSeatNumbers,
    });
  } catch (error) {
    console.error('Process rebook error:', error);
    res.status(500).json({ error: 'Failed to process rebooking: ' + error.message });
  }
});

module.exports = router;
