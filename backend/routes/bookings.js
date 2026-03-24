const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { sendBookingExpired, sendCancellationRequested, sendRescheduleRequested, sendBookingConfirmation } = require('../services/emailService');
const { generateBoardingPassQR, generatePerPassengerQRs } = require('../services/qrService');
const { calcCancellationFee, calcRescheduleFee } = require('../utils/feeCalculator');
const { commitReschedule } = require('../utils/rescheduleCommit');
const { notify } = require('../services/notificationService');
const { calcVAT } = require('../utils/vatCalculator');
const { sanitizePassengers, stripHtml } = require('../utils/sanitize');

/**
 * Generates a booking reference using a UUID-derived suffix to eliminate
 * Math.random() collision risk. Collision check happens inside the Firestore
 * transaction when the booking document is created.
 */
const generateBookingRef = () => {
  const prefix = 'CEB';
  // Use first 6 chars of a UUID (hex) — vastly lower collision probability than Math.random().toString(36)
  const suffix = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

// POST create booking
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      flightId, seatNumber, seatNumbers, seatClass,
      returnSeatClass: rawReturnSeatClass,
      // NOTE: price/outboundPrice/returnPrice from req.body are IGNORED.
      // All prices are recalculated server-side from Firestore flight documents.
      passengerName, passengerEmail, passengerPhone,
      passengers: passengerList,
      tripType, returnFlightId,
      returnSeatNumbers: rawReturnSeatNumbers,
      passengerCount: rawPassengerCount,
    } = req.body;

    // ── Validate & sanitize passenger data ───────────────────────────────────
    const seats = Array.isArray(seatNumbers) && seatNumbers.length > 0
      ? seatNumbers : [seatNumber];
    const returnSeats = Array.isArray(rawReturnSeatNumbers) && rawReturnSeatNumbers.length > 0
      ? rawReturnSeatNumbers : [];
    const passengerCount = Math.max(1, parseInt(rawPassengerCount) || seats.length);
    const isRoundTrip = tripType === 'roundtrip' && !!returnFlightId;

    // Build passenger list from either multi-pax array or single-pax fields
    const rawPassengers = Array.isArray(passengerList) && passengerList.length > 0
      ? passengerList
      : [{ name: passengerName, email: passengerEmail, phone: passengerPhone || '', seat: seats[0] }];

    const sanResult = sanitizePassengers(rawPassengers);
    if (!sanResult.ok) return res.status(400).json({ error: sanResult.error });
    const cleanPassengers = sanResult.passengers;

    if (!flightId) return res.status(400).json({ error: 'flightId is required.' });
    if (!seats[0]) return res.status(400).json({ error: 'At least one seat must be selected.' });
    if (isRoundTrip && returnFlightId === flightId) {
      return res.status(400).json({ error: 'Outbound and return flights cannot be the same.' });
    }
    if (isRoundTrip && returnSeats.length === 0) {
      return res.status(400).json({ error: 'Return seat selection is required for round-trip bookings.' });
    }
    if (isRoundTrip && returnSeats.length > 0 && returnSeats.length !== seats.length) {
      return res.status(400).json({ error: `Return seat count (${returnSeats.length}) must match outbound seat count (${seats.length}).` });
    }

    // ── Pre-fetch return flight outside transaction (read-only) ──────────────
    let returnFlightData = null;
    if (isRoundTrip) {
      const retDoc = await db.collection('flights').doc(returnFlightId).get();
      if (!retDoc.exists) return res.status(404).json({ error: 'Return flight not found' });
      returnFlightData = retDoc.data();
    }

    // ── Seat reservation inside Firestore transaction (Fix: race condition) ──
    const bookingId = generateBookingRef();
    const TIMEOUT_MINUTES = 20;
    const expiresAt = new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000).toISOString();

    let bookingData;
    const bookingRef = db.collection('bookings').doc(); // pre-allocate doc ref

    await db.runTransaction(async (t) => {
      const flightDoc = await t.get(db.collection('flights').doc(flightId));
      if (!flightDoc.exists) throw Object.assign(new Error('Flight not found'), { status: 404 });
      const flight = flightDoc.data();

      // Read return flight inside transaction for atomicity
      let retFlightDoc = null;
      if (isRoundTrip && returnSeats.length > 0) {
        retFlightDoc = await t.get(db.collection('flights').doc(returnFlightId));
        if (!retFlightDoc.exists) throw Object.assign(new Error('Return flight not found'), { status: 404 });
      }
      const retFlightData = retFlightDoc ? retFlightDoc.data() : returnFlightData;

      // ── All prices calculated server-side from Firestore data ────────────
      const rowNum = parseInt(seats[0]);
      const resolvedClass = seatClass || (rowNum <= 4 ? 'business' : 'economy');
      // Return class: use client-provided value if valid, else infer from first return seat row
      const retRowNum = returnSeats.length > 0 ? parseInt(returnSeats[0]) : null;
      const resolvedReturnClass = isRoundTrip
        ? (['business', 'economy'].includes(rawReturnSeatClass) ? rawReturnSeatClass
            : (retRowNum !== null ? (retRowNum <= 4 ? 'business' : 'economy') : resolvedClass))
        : resolvedClass;
      const basePrice = flight.price || 0;
      const perSeatOutbound = resolvedClass === 'business' ? Math.round(basePrice * 1.5) : basePrice;
      const perSeatReturn = isRoundTrip
        ? (resolvedReturnClass === 'business'
            ? Math.round((retFlightData.price || 0) * 1.5)
            : (retFlightData.price || 0))
        : 0;
      const totalPrice = (perSeatOutbound + perSeatReturn) * passengerCount;
      const vat = calcVAT(totalPrice, passengerCount);

      // ── Atomic outbound seat availability check ───────────────────────────
      const alreadyBooked = seats.filter(s => (flight.bookedSeats || []).includes(s));
      if (alreadyBooked.length > 0)
        throw Object.assign(new Error(`Seat(s) already booked: ${alreadyBooked.join(', ')}`), { status: 400 });
      if ((flight.availableSeats || 0) < seats.length)
        throw Object.assign(new Error(`Not enough seats. Only ${flight.availableSeats} left.`), { status: 400 });

      // ── Atomic return seat availability check ─────────────────────────────
      if (isRoundTrip && returnSeats.length > 0 && retFlightDoc) {
        const retAlreadyBooked = returnSeats.filter(s => (retFlightData.bookedSeats || []).includes(s));
        if (retAlreadyBooked.length > 0)
          throw Object.assign(new Error(`Return seat(s) already booked: ${retAlreadyBooked.join(', ')}`), { status: 400 });
        if ((retFlightData.availableSeats || 0) < returnSeats.length)
          throw Object.assign(new Error(`Not enough return seats. Only ${retFlightData.availableSeats} left.`), { status: 400 });
      }

      // ── Collision check: ensure bookingId is unique ───────────────────────
      const existing = await t.get(
        db.collection('bookings').where('bookingId', '==', bookingId).limit(1)
      );
      if (!existing.empty)
        throw Object.assign(new Error('Booking reference collision — please try again.'), { status: 409 });

      // ── Build enriched passenger list with per-passenger seat assignments ──
      const enrichedPassengers = cleanPassengers.map((p, i) => ({
        ...p,
        seat: seats[i] || seats[0],
        ...(isRoundTrip && returnSeats.length > 0 ? { returnSeat: returnSeats[i] || returnSeats[0] } : {}),
      }));

      bookingData = {
        bookingId,
        userId: req.user.uid,
        flightId,
        seatNumber: seats[0],
        seatNumbers: seats,
        ...(isRoundTrip && returnSeats.length > 0 && { returnSeatNumbers: returnSeats }),
        passengerCount,
        passengers: enrichedPassengers,
        seatClass: resolvedClass,
        ...(isRoundTrip && { returnSeatClass: resolvedReturnClass }),
        passengerName:  enrichedPassengers[0].name,
        passengerEmail: enrichedPassengers[0].email,
        passengerPhone: enrichedPassengers[0].phone || '',
        tripType: tripType || 'oneway',
        // Server-calculated prices — client values are ignored
        price:        totalPrice,
        vatAmount:    vat.vatAmount,
        grandTotal:   vat.grandTotal,
        vatPercent:   12,
        basePrice,
        outboundPrice: perSeatOutbound * passengerCount,
        ...(isRoundTrip && {
          returnFlightId,
          returnPrice:     perSeatReturn * passengerCount,
          returnBasePrice: (retFlightData?.price || 0) * passengerCount,
        }),
        status: 'pending_payment',
        paymentStatus: 'unpaid',
        paymentProofURL: null,
        emailSent: false,
        qrCodeURL: null,
        bookingDate: new Date().toISOString(),
        expiresAt,
        updatedAt: new Date().toISOString(),
      };

      // ── Atomically reserve outbound seats + create booking ────────────────
      t.set(bookingRef, bookingData);
      t.update(flightDoc.ref, {
        bookedSeats:    [...(flight.bookedSeats || []), ...seats],
        availableSeats: (flight.availableSeats || flight.totalSeats || 0) - seats.length,
      });
      // ── Atomically reserve return seats ───────────────────────────────────
      if (isRoundTrip && returnSeats.length > 0 && retFlightDoc) {
        t.update(retFlightDoc.ref, {
          bookedSeats:    [...(retFlightData.bookedSeats || []), ...returnSeats],
          availableSeats: (retFlightData.availableSeats || retFlightData.totalSeats || 0) - returnSeats.length,
        });
      }
    });

    res.status(201).json({ id: bookingRef.id, ...bookingData });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to create booking' });
  }
});

// GET user bookings
router.get('/my', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bookings')
      .where('userId', '==', req.user.uid)
      .get();

    const rawBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Batch-fetch all unique flight IDs in one round (no N+1 reads)
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

    const bookings = rawBookings.map(b => ({
      ...b,
      flight:       flightMap[b.flightId]       || null,
      returnFlight: flightMap[b.returnFlightId] || null,
    }));

    bookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
    res.json({ bookings });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
  }
});

// GET single booking
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    if (booking.userId !== req.user.uid) {
      if (req.user.admin !== true) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (flightDoc.exists) booking.flight = { id: flightDoc.id, ...flightDoc.data() };

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// PUT cancel booking (pending_payment / payment_submitted only)
router.put('/:bookingId/cancel', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

    const CANCELLABLE_STATUSES = ['pending_payment', 'payment_submitted', 'rejected'];
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a booking with status "${booking.status}".` });
    }

    await doc.ref.update({
      status: 'cancelled',
      cancellationReason: req.body.reason || 'No reason provided',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Release outbound seats
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (flightDoc.exists) {
      const flight = flightDoc.data();
      const seatsToRelease = booking.seatNumbers || [booking.seatNumber];
      await flightDoc.ref.update({
        bookedSeats: (flight.bookedSeats || []).filter(s => !seatsToRelease.includes(s)),
        availableSeats: (flight.availableSeats || 0) + seatsToRelease.length,
      });
    }

    // Release return seats if round trip
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

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// PUT request cancellation for confirmed booking (with fee calculation)
router.put('/:bookingId/request-cancel', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed bookings can be cancelled.' });
    if (!req.body.reason?.trim()) return res.status(400).json({ error: 'Cancellation reason is required.' });

    // Fetch flight for fee calculation
    const flightDoc = await db.collection('flights').doc(booking.flightId).get();
    if (!flightDoc.exists) return res.status(404).json({ error: 'Flight not found' });
    const flight = { id: flightDoc.id, ...flightDoc.data() };

    const fee = calcCancellationFee(booking, flight);

    if (!fee.allowed) {
      return res.status(400).json({
        error: 'Cancellation not allowed within 24 hours of departure.',
        feeBreakdown: fee,
      });
    }

    await doc.ref.update({
      status: 'cancellation_requested',
      cancellationReason: req.body.reason,
      cancellationRequestedAt: new Date().toISOString(),
      cancellationFeeBreakdown: fee,
      updatedAt: new Date().toISOString(),
    });

    try {
      await sendCancellationRequested({ id: doc.id, ...booking }, flight, fee);
    } catch (e) { console.error('Cancellation request email failed:', e.message); }

    await notify.cancellationRequested({ ...booking }).catch(() => {});

    res.json({ message: 'Cancellation request submitted. Awaiting admin review.', feeBreakdown: fee });
  } catch (error) {
    console.error('Request cancel error:', error);
    res.status(500).json({ error: 'Failed to submit cancellation request' });
  }
});

// GET reschedule fee preview
router.get('/:bookingId/reschedule-fee', verifyToken, async (req, res) => {
  try {
    const { newFlightId } = req.query;
    if (!newFlightId) return res.status(400).json({ error: 'newFlightId is required' });

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();
    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

    const [flightDoc, newFlightDoc] = await Promise.all([
      db.collection('flights').doc(booking.flightId).get(),
      db.collection('flights').doc(newFlightId).get(),
    ]);

    if (!flightDoc.exists) return res.status(404).json({ error: 'Current flight not found' });
    if (!newFlightDoc.exists) return res.status(404).json({ error: 'New flight not found' });

    const flight    = { id: flightDoc.id,    ...flightDoc.data() };
    const newFlight = { id: newFlightDoc.id, ...newFlightDoc.data() };

    const fee = calcRescheduleFee(booking, flight, newFlight);
    res.json({ fee, newFlight });
  } catch (error) {
    console.error('Reschedule fee error:', error);
    res.status(500).json({ error: 'Failed to calculate reschedule fee' });
  }
});

// PUT reschedule booking — PAYMENT-FIRST approach
// leg: 'outbound' | 'return' | 'both'
// For free reschedules, commits immediately. For paid, stores pendingReschedule and waits for payment proof.
router.put('/:bookingId/reschedule', verifyToken, async (req, res) => {
  try {
    const {
      leg = 'outbound',
      // outbound leg
      newFlightId, newSeatNumbers, newSeatClass,
      // return leg (only when leg === 'return' or 'both')
      newReturnFlightId, newReturnSeatNumbers, newReturnSeatClass,
      reason,
    } = req.body;

    if (!newSeatNumbers?.length) return res.status(400).json({ error: 'newSeatNumbers is required' });
    if ((leg === 'return' || leg === 'both') && (!newReturnFlightId || !newReturnSeatNumbers?.length)) {
      return res.status(400).json({ error: 'newReturnFlightId and newReturnSeatNumbers are required for return/both leg reschedule' });
    }
    // For return-only, newFlightId is the unchanged outbound — don't require it to be "new"
    if (leg !== 'return' && !newFlightId) {
      return res.status(400).json({ error: 'newFlightId is required' });
    }

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed bookings can be rescheduled.' });

    // ── Load current & new flights ──────────────────────────────────────────
    const outboundCurrentId = booking.flightId;
    const returnCurrentId   = booking.returnFlightId;
    // For return-only, outbound flight is unchanged — use booking's current flight
    const effectiveNewOutboundId = leg === 'return' ? outboundCurrentId : newFlightId;

    const flightIds = [outboundCurrentId, effectiveNewOutboundId];
    if (leg === 'return' || leg === 'both') flightIds.push(returnCurrentId, newReturnFlightId);
    const unique = [...new Set(flightIds.filter(Boolean))];
    const flightDocs = await Promise.all(unique.map(id => db.collection('flights').doc(id).get()));
    const flightMap = {};
    flightDocs.forEach(d => { if (d.exists) flightMap[d.id] = { id: d.id, ...d.data() }; });

    const currentFlight    = flightMap[outboundCurrentId];
    const newFlight        = flightMap[effectiveNewOutboundId];
    const currentRetFlight = flightMap[returnCurrentId];
    const newRetFlight     = flightMap[newReturnFlightId];

    if (!currentFlight) return res.status(404).json({ error: 'Current outbound flight not found' });
    if (leg !== 'return' && !newFlight) return res.status(404).json({ error: 'New outbound flight not found' });
    if ((leg === 'return' || leg === 'both') && !currentRetFlight) return res.status(404).json({ error: 'Current return flight not found' });
    if ((leg === 'return' || leg === 'both') && !newRetFlight) return res.status(404).json({ error: 'New return flight not found' });

    // ── Calculate fees ───────────────────────────────────────────────────────
    const resolvedOutClass = newSeatClass || booking.seatClass || 'economy';
    const resolvedRetClass = newReturnSeatClass || booking.seatClass || 'economy';

    const outFee = leg !== 'return'
      ? calcRescheduleFee(booking, currentFlight, newFlight, new Date(), resolvedOutClass)
      : null;
    const retFee = (leg === 'return' || leg === 'both')
      ? calcRescheduleFee(booking, currentRetFlight, newRetFlight, new Date(), resolvedRetClass)
      : null;

    if (outFee && !outFee.allowed) return res.status(400).json({ error: 'Rescheduling outbound not allowed within 24 hours of departure.' });
    if (retFee && !retFee.allowed) return res.status(400).json({ error: 'Rescheduling return not allowed within 24 hours of departure.' });

    const totalFeePayment = (outFee?.totalPayment || 0) + (retFee?.totalPayment || 0);
    const requiresPayment = totalFeePayment > 0;

    // ── Validate seats availability ──────────────────────────────────────────
    if (outFee && leg !== 'return') {
      const taken = (newFlight.bookedSeats || []).filter(s => newSeatNumbers.includes(s));
      if (taken.length > 0) return res.status(400).json({ error: `Outbound seat(s) ${taken.join(', ')} are already taken.` });
      if ((newFlight.availableSeats || 0) < newSeatNumbers.length) return res.status(400).json({ error: 'Not enough seats on new outbound flight.' });
    }
    if (retFee) {
      const taken = (newRetFlight.bookedSeats || []).filter(s => newReturnSeatNumbers.includes(s));
      if (taken.length > 0) return res.status(400).json({ error: `Return seat(s) ${taken.join(', ')} are already taken.` });
      if ((newRetFlight.availableSeats || 0) < newReturnSeatNumbers.length) return res.status(400).json({ error: 'Not enough seats on new return flight.' });
    }

    // ── Combined fee breakdown for storage ───────────────────────────────────
    const combinedFee = {
      leg,
      totalPayment: totalFeePayment,
      outbound: outFee,
      return: retFee,
      allowed: true,
      // Flatten for single-leg backward-compat display (never applied to 'both')
      ...(outFee && leg === 'outbound' ? outFee : {}),
      ...(retFee && leg === 'return'   ? retFee : {}),
      // For both-leg reschedules: only explicit summed totals — no spread that would
      // overwrite per-leg feePercent/ruleLabel with outbound-only values
      ...(leg === 'both' ? {
        totalRescheduleFee: (outFee?.totalRescheduleFee || 0) + (retFee?.totalRescheduleFee || 0),
        totalFareDiff:      (outFee?.totalFareDiff      || 0) + (retFee?.totalFareDiff      || 0),
        totalUpgrade:       (outFee?.totalUpgrade       || 0) + (retFee?.totalUpgrade       || 0),
      } : {}),
    };

    // ── PAYMENT-FIRST: store intent without moving seats ────────────────────
    if (requiresPayment) {
      await doc.ref.update({
        status: 'reschedule_payment_pending',
        pendingReschedule: {
          leg,
          newFlightId: leg !== 'return' ? newFlightId : outboundCurrentId,
          newSeatNumbers: leg !== 'return' ? newSeatNumbers : (booking.seatNumbers || [booking.seatNumber]),
          newSeatClass: resolvedOutClass,
          ...(retFee ? { newReturnFlightId, newReturnSeatNumbers, newReturnSeatClass: resolvedRetClass } : {}),
          reason: reason || '',
          fee: combinedFee,
          createdAt: new Date().toISOString(),
        },
        rescheduleFeeBreakdown: combinedFee,
        updatedAt: new Date().toISOString(),
      });

      await notify.reschedulePaymentPending({ ...booking }).catch(() => {});

      return res.json({
        message: 'Payment required. Please complete GCash payment to confirm your reschedule.',
        feeBreakdown: combinedFee,
        requiresPayment: true,
        bookingId: booking.bookingId,
      });
    }

    // ── FREE reschedule: commit immediately ──────────────────────────────────
    await commitReschedule(doc, booking, {
      leg,
      newFlightId:      leg !== 'return' ? newFlightId : outboundCurrentId,
      newSeatNumbers:   leg !== 'return' ? newSeatNumbers : (booking.seatNumbers || [booking.seatNumber]),
      resolvedOutClass,
      newReturnFlightId,
      newReturnSeatNumbers,
      resolvedRetClass,
      currentFlight,
      newFlight:        leg !== 'return' ? newFlight : currentFlight,
      currentRetFlight,
      newRetFlight,
      combinedFee,
      reason,
    });

    try { await sendRescheduleRequested({ id: doc.id, ...booking }, currentFlight, newFlight, combinedFee); }
    catch (e) { console.error('Reschedule email failed:', e.message); }

    res.json({
      message: 'Reschedule request submitted. Awaiting admin review.',
      feeBreakdown: combinedFee,
      requiresPayment: false,
      bookingId: booking.bookingId,
    });
  } catch (error) {
    console.error('Reschedule error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

// Helper: apply seat swaps and update booking doc after payment is confirmed

// POST upload reschedule fee payment proof
router.post('/:bookingId/reschedule-payment', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', req.params.bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
    if (booking.status !== 'reschedule_payment_pending') {
      return res.status(400).json({ error: 'No reschedule payment pending for this booking.' });
    }

    const { proofURL } = req.body;
    if (!proofURL) return res.status(400).json({ error: 'proofURL is required' });

    await doc.ref.update({
      status: 'reschedule_requested',
      reschedulePaymentProofURL: proofURL,
      reschedulePaymentSubmittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: 'Reschedule payment submitted. Awaiting admin review.' });
  } catch (error) {
    console.error('Reschedule payment error:', error);
    res.status(500).json({ error: 'Failed to submit reschedule payment' });
  }
});

// POST expire timed-out bookings (called by a cron or on-demand)
//
// ⚠️  DEMO LIMITATION — Expiry only runs when a client calls this endpoint.
//    In production this should be a scheduled job. Options:
//
//    1. Firebase Cloud Functions (recommended):
//       exports.expireBookings = functions.pubsub
//         .schedule('every 5 minutes').onRun(() => expireLogic());
//
//    2. Firestore TTL policy (simpler, no code):
//       Set a TTL policy on the 'expiresAt' field in the Firestore console.
//       Firestore will auto-delete expired documents (but won't release seats).
//       You'd still need a Cloud Function to release seats on deletion.
//
//    3. External cron (e.g. Cloud Scheduler hitting this endpoint):
//       POST https://your-api.com/api/bookings/expire-timeouts
//       every 5 minutes via Google Cloud Scheduler.
//
//    For the free-tier demo, this is called on every My Bookings page load
//    and every admin bookings fetch. Seats may remain locked for ghost
//    bookings until a user visits either page.
//
router.post('/expire-timeouts', verifyAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const snapshot = await db.collection('bookings')
      .where('status', '==', 'pending_payment')
      .get();

    let expired = 0;
    for (const doc of snapshot.docs) {
      const booking = doc.data();
      if (booking.expiresAt && booking.expiresAt < now) {
        await doc.ref.update({
          status: 'cancelled',
          cancellationReason: 'Booking expired — payment not submitted within 20 minutes.',
          cancelledAt: now,
          expiredAt: now,
          updatedAt: now,
        });

        // Release all seats
        const flightDoc = await db.collection('flights').doc(booking.flightId).get();
        if (flightDoc.exists) {
          const flight = flightDoc.data();
          const seatsToRelease = booking.seatNumbers || [booking.seatNumber];
          await flightDoc.ref.update({
            bookedSeats: (flight.bookedSeats || []).filter(s => !seatsToRelease.includes(s)),
            availableSeats: (flight.availableSeats || 0) + seatsToRelease.length,
          });

          // Also release return seats if round trip
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

          // Send expiry notification email (non-fatal)
          try {
            await sendBookingExpired(booking, { id: flightDoc.id, ...flight });
          } catch (emailErr) {
            console.error('Expiry email failed (non-fatal):', emailErr.message);
          }
          await notify.bookingExpired(booking).catch(() => {});
        }
        expired++;
      }
    }

    res.json({ message: `Expired ${expired} booking(s).`, expired });
  } catch (error) {
    console.error('Expire timeouts error:', error);
    res.status(500).json({ error: 'Failed to expire bookings' });
  }
});

// POST handle user action for a flight-cancelled booking (refund or rebook)
// body: { action: 'refund' | 'rebook', newFlightId?: string }
router.post('/:bookingId/flight-cancelled-action', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action } = req.body;

    if (!['refund', 'rebook'].includes(action)) {
      return res.status(400).json({ error: "action must be 'refund' or 'rebook'." });
    }

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    if (booking.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (booking.status !== 'flight_cancelled') {
      return res.status(400).json({ error: 'Booking is not in a flight-cancelled state.' });
    }

    const now = new Date().toISOString();

    // Fetch flight for notification messages (non-fatal if missing)
    let flight = null;
    try {
      const flightDoc = await db.collection('flights').doc(booking.flightId).get();
      if (flightDoc.exists) flight = { id: flightDoc.id, ...flightDoc.data() };
    } catch (_) {}

    if (action === 'refund') {
      // Airline-initiated cancellation = full refund, no penalty fee
      const refundAmount = booking.refundAmount
        || booking.grandTotal
        || Math.round((booking.price || 0) * 1.12);

      await doc.ref.update({
        status: 'cancelled',
        paymentStatus: 'refund_pending',
        pendingAction: null,
        refundRequestedAt: now,
        refundAmount,
        refundSent: false,
        updatedAt: now,
      });

      // Notify admin about the refund request (fire-and-forget)
      notify.refundRequested(booking, flight).catch(e =>
        console.error('Refund request notification failed:', e.message)
      );

      return res.json({ message: 'Refund request submitted. An admin will process it shortly.' });
    }

    if (action === 'rebook') {
      await doc.ref.update({
        pendingAction: 'rebook_pending',
        rebookRequestedAt: now,
        updatedAt: now,
      });

      // Notify admin about the rebook request (fire-and-forget)
      notify.rebookRequested(booking, flight).catch(e =>
        console.error('Rebook request notification failed:', e.message)
      );

      return res.json({ message: 'Rebook request submitted. An admin will contact you with a new flight.' });
    }
  } catch (error) {
    console.error('flight-cancelled-action error:', error);
    res.status(500).json({ error: 'Failed to process action.' });
  }
});

// POST user confirms their rebook: picks a new flight + seats
// body: { newFlightId, newSeatNumbers: string[], newSeatClass: string }
// This is user-authenticated — no admin needed.
router.post('/:bookingId/confirm-rebook', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newFlightId, newSeatNumbers, newSeatClass } = req.body;

    // ── Validate inputs ────────────────────────────────────────────────────
    if (!newFlightId)
      return res.status(400).json({ error: 'newFlightId is required.' });
    if (!Array.isArray(newSeatNumbers) || newSeatNumbers.length === 0)
      return res.status(400).json({ error: 'newSeatNumbers (array) is required.' });

    // ── Fetch booking ──────────────────────────────────────────────────────
    const snap = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Booking not found' });
    const bookingDoc = snap.docs[0];
    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    if (booking.userId !== req.user.uid)
      return res.status(403).json({ error: 'Unauthorized.' });
    if (booking.status !== 'flight_cancelled')
      return res.status(400).json({ error: 'Booking is not in a flight-cancelled state.' });

    const pax = booking.passengerCount || newSeatNumbers.length || 1;

    if (newSeatNumbers.length !== pax)
      return res.status(400).json({ error: `You must select exactly ${pax} seat${pax > 1 ? 's' : ''}.` });

    // ── Fetch + validate new flight ────────────────────────────────────────
    const newFlightDoc = await db.collection('flights').doc(newFlightId).get();
    if (!newFlightDoc.exists)
      return res.status(404).json({ error: 'New flight not found.' });
    const newFlight = { id: newFlightDoc.id, ...newFlightDoc.data() };

    if (newFlight.status !== 'active')
      return res.status(400).json({ error: 'Selected flight is not active.' });

    const alreadyBooked = newFlight.bookedSeats || [];
    const conflicts = newSeatNumbers.filter(s => alreadyBooked.includes(s));
    if (conflicts.length > 0)
      return res.status(409).json({ error: `Seat(s) already taken: ${conflicts.join(', ')}` });
    if ((newFlight.availableSeats || 0) < pax)
      return res.status(409).json({ error: `Not enough seats available. Only ${newFlight.availableSeats} left.` });

    // ── Enforce seat class: rebooking must stay in the original class ──────
    const originalClass = (booking.seatClass || 'economy').toLowerCase();
    const requestedClass = (newSeatClass || originalClass).toLowerCase();

    if (requestedClass !== originalClass) {
      return res.status(400).json({
        error: `Class change not allowed during rebooking. Your original booking is ${originalClass}. Please select ${originalClass} seats only.`,
      });
    }

    // Validate each chosen seat belongs to the correct class section
    // Business class = rows 1–4, Economy = rows 5–24
    const businessRowMax = 4;
    const wrongClassSeats = newSeatNumbers.filter(seat => {
      const rowNum = parseInt(seat, 10); // seat is like "3A" → parseInt gives 3
      const isBusinessSeat = rowNum >= 1 && rowNum <= businessRowMax;
      return originalClass === 'business' ? !isBusinessSeat : isBusinessSeat;
    });
    if (wrongClassSeats.length > 0) {
      return res.status(400).json({
        error: `Seat(s) ${wrongClassSeats.join(', ')} are not in the ${originalClass} section. Please select only ${originalClass} seats.`,
      });
    }

    const now = new Date().toISOString();
    const resolvedClass = originalClass;

    // ── Reserve seats on new flight ────────────────────────────────────────
    await newFlightDoc.ref.update({
      bookedSeats: [...alreadyBooked, ...newSeatNumbers],
      availableSeats: (newFlight.availableSeats || 0) - pax,
      updatedAt: now,
    });

    // ── Release seats from the old cancelled flight ────────────────────────
    try {
      const oldFlightDoc = await db.collection('flights').doc(booking.flightId).get();
      if (oldFlightDoc.exists) {
        const oldFlight = oldFlightDoc.data();
        const oldSeats = booking.seatNumbers || (booking.seatNumber ? [booking.seatNumber] : []);
        await oldFlightDoc.ref.update({
          bookedSeats: (oldFlight.bookedSeats || []).filter(s => !oldSeats.includes(s)),
          availableSeats: (oldFlight.availableSeats || 0) + oldSeats.length,
          updatedAt: now,
        });
      }
    } catch (e) {
      console.warn('Could not release old flight seats (non-fatal):', e.message);
    }

    // ── Build updated booking object for QR generation ─────────────────────
    const updatedBooking = {
      ...booking,
      flightId: newFlightId,
      seatNumbers: newSeatNumbers,
      seatNumber: newSeatNumbers[0],
      seatClass: resolvedClass,
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
      passengerQRs  = await generatePerPassengerQRs(updatedBooking);
      qrCodeURL     = passengerQRs[0].qrDataUrl;
      boardingToken = passengerQRs[0].token;
    } else {
      const result  = await generateBoardingPassQR(updatedBooking);
      qrCodeURL     = result.qrDataUrl;
      boardingToken = result.boardingToken;
      passengerQRs  = [{ passengerIndex: 0, qrDataUrl: qrCodeURL, token: boardingToken }];
    }
    const passengerTokenMap = passengerQRs.map(q => ({ index: q.passengerIndex, token: q.token }));

    // ── Persist rebooking ──────────────────────────────────────────────────
    await bookingDoc.ref.update({
      flightId: newFlightId,
      seatNumbers: newSeatNumbers,
      seatNumber: newSeatNumbers[0],
      seatClass: resolvedClass,
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

    // ── Send confirmation email with updated boarding pass(es) ─────────────
    // returnFlight stays the same for round-trip (only outbound was cancelled)
    let returnFlight = null;
    if (booking.tripType === 'roundtrip' && booking.returnFlightId) {
      try {
        const retDoc = await db.collection('flights').doc(booking.returnFlightId).get();
        if (retDoc.exists) returnFlight = { id: retDoc.id, ...retDoc.data() };
      } catch (_) {}
    }

    sendBookingConfirmation(updatedBooking, newFlight, passengerQRs, returnFlight)
      .then(() => console.log(`Rebook confirmation email sent → ${updatedBooking.passengerEmail}`))
      .catch(e => console.error('Rebook confirmation email failed (non-fatal):', e.message));

    // ── In-app notification ────────────────────────────────────────────────
    notify.rebookConfirmed(booking, newFlight).catch(() => {});

    res.json({
      message: `Rebooking confirmed on Flight ${newFlight.flightNumber}. Check your email for updated tickets.`,
      bookingId,
      newFlightId,
      newSeatNumbers,
      newFlightNumber: newFlight.flightNumber,
    });
  } catch (error) {
    console.error('confirm-rebook error:', error);
    res.status(500).json({ error: 'Failed to confirm rebooking: ' + error.message });
  }
});

// ── Gate Agent: Validate QR ticket ───────────────────────────────────────────
// GET /api/bookings/validate-ticket/:bookingId/:token
// Public endpoint — no auth required (gate agents scan QR codes)
const { generateBoardingToken, generatePassengerToken } = require('../services/qrService');

router.get('/validate-ticket/:bookingId/:token', async (req, res) => {
  try {
    const { bookingId, token } = req.params;
    const passengerIndex = req.query.p !== undefined ? parseInt(req.query.p) : null;

    // Fetch booking
    const snap = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snap.empty) return res.status(404).json({ valid: false, error: 'Booking not found.' });

    const doc = snap.docs[0];
    const booking = { id: doc.id, ...doc.data() };

    // Verify token — per-passenger or whole-booking
    let tokenValid = false;
    if (passengerIndex !== null && !isNaN(passengerIndex)) {
      const expected = generatePassengerToken(bookingId, passengerIndex);
      tokenValid = (token === expected);
    } else {
      const expected = generateBoardingToken(bookingId);
      tokenValid = (token === expected);
    }

    if (!tokenValid) {
      return res.status(401).json({ valid: false, error: 'Invalid or tampered QR code.' });
    }

    // Check booking status
    const validStatuses = ['confirmed'];
    const isValid = validStatuses.includes(booking.status);

    // Fetch flight details
    let flight = null;
    try {
      const fDoc = await db.collection('flights').doc(booking.flightId).get();
      if (fDoc.exists) flight = { id: fDoc.id, ...fDoc.data() };
    } catch (_) {}

    // Build passenger info for this scan
    const pax = passengerIndex !== null && booking.passengers?.[passengerIndex]
      ? booking.passengers[passengerIndex]
      : (booking.passengers?.[0] || { name: booking.passengerName, email: booking.passengerEmail });

    res.json({
      valid: isValid,
      status: booking.status,
      booking: {
        bookingId: booking.bookingId,
        passengerName: pax.name || booking.passengerName,
        passengerEmail: pax.email || booking.passengerEmail,
        seat: pax.seat || booking.seatNumber,
        seatClass: booking.seatClass,
        passengerCount: booking.passengerCount,
        tripType: booking.tripType,
      },
      flight: flight ? {
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        originCity: flight.originCity,
        destination: flight.destination,
        destinationCity: flight.destinationCity,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        aircraft: flight.aircraft,
        status: flight.status,
      } : null,
    });
  } catch (error) {
    console.error('validate-ticket error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

module.exports = router;
