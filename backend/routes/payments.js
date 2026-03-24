const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { commitReschedule } = require('../utils/rescheduleCommit');

// ── Multer: memory storage only — no filesystem writes ───────────────────────
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
  },
});

const gcashUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

/** Convert multer memory buffer → base64 data URI */
const toDataURI = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

// ── POST upload payment proof (regular booking) ───────────────────────────────
router.post('/upload-proof', verifyToken, memoryUpload.single('paymentProof'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();
    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

    // Allow upload for pending_payment OR rejected (re-upload after rejection)
    if (!['pending_payment', 'rejected'].includes(booking.status)) {
      return res.status(400).json({ error: 'Payment cannot be uploaded for this booking status.' });
    }

    await doc.ref.update({
      paymentProofData: toDataURI(req.file),
      paymentProofURL:  null,
      status:           'payment_submitted',
      paymentStatus:    'pending_review',
      rejectionReason:  null, // clear previous rejection
      updatedAt:        new Date().toISOString(),
    });

    await notify.paymentSubmitted({ ...booking }).catch(() => {});

    res.json({ message: 'Payment proof uploaded successfully' });
  } catch (error) {
    console.error('Upload proof error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload payment proof' });
  }
});

// ── POST upload reschedule fee payment proof ──────────────────────────────────
router.post('/upload-reschedule-proof', verifyToken, memoryUpload.single('paymentProof'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const snapshot = await db.collection('bookings')
      .where('bookingId', '==', bookingId).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Booking not found' });

    const doc = snapshot.docs[0];
    const booking = doc.data();

    if (booking.userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
    if (booking.status !== 'reschedule_payment_pending') {
      return res.status(400).json({ error: 'No reschedule payment pending for this booking.' });
    }

    const pending = booking.pendingReschedule;
    if (!pending) {
      return res.status(400).json({ error: 'No pending reschedule details found. Please start the reschedule again.' });
    }

    // Load flight docs needed to commit the reschedule
    const flightIds = [booking.flightId, pending.newFlightId];
    if (pending.newReturnFlightId) {
      flightIds.push(booking.returnFlightId, pending.newReturnFlightId);
    }
    const uniqueIds = [...new Set(flightIds.filter(Boolean))];
    const flightDocs = await Promise.all(uniqueIds.map(id => db.collection('flights').doc(id).get()));
    const flightMap = {};
    flightDocs.forEach(d => { if (d.exists) flightMap[d.id] = { id: d.id, ...d.data() }; });

    // Now commit the actual seat swap
    await commitReschedule(doc, booking, {
      leg:                  pending.leg || 'outbound',
      newFlightId:          pending.newFlightId,
      newSeatNumbers:       pending.newSeatNumbers,
      resolvedOutClass:     pending.newSeatClass,
      newReturnFlightId:    pending.newReturnFlightId,
      newReturnSeatNumbers: pending.newReturnSeatNumbers,
      resolvedRetClass:     pending.newReturnSeatClass,
      currentFlight:        flightMap[booking.flightId],
      newFlight:            flightMap[pending.newFlightId],
      currentRetFlight:     flightMap[booking.returnFlightId],
      newRetFlight:         flightMap[pending.newReturnFlightId],
      combinedFee:          pending.fee,
      reason:               pending.reason,
    });

    // Save payment proof on top of the committed reschedule
    await doc.ref.update({
      reschedulePaymentProofData:   toDataURI(req.file),
      reschedulePaymentProofURL:    null,
      reschedulePaymentSubmittedAt: new Date().toISOString(),
      updatedAt:                    new Date().toISOString(),
    });

    await notify.reschedulePaymentSubmitted({ ...booking }).catch(() => {});

    res.json({ message: 'Reschedule payment proof submitted. Awaiting admin review.' });
  } catch (error) {
    console.error('Upload reschedule proof error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload reschedule payment proof' });
  }
});

// ── POST upload GCash QR (admin only) ────────────────────────────────────────
router.post('/upload-gcash-qr', verifyAdmin, gcashUpload.single('gcashQR'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const qrDataURI = toDataURI(req.file);

    await db.collection('settings').doc('gcash').set({
      qrDataURI,
      qrURL:     null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: 'GCash QR uploaded', qrURL: qrDataURI });
  } catch (error) {
    console.error('Upload GCash QR error:', error);
    res.status(500).json({ error: 'Failed to upload GCash QR' });
  }
});

// ── GET GCash QR ──────────────────────────────────────────────────────────────
router.get('/gcash-qr', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('gcash').get();
    if (!doc.exists) return res.json({ qrURL: null });
    const data = doc.data();
    res.json({ qrURL: data.qrDataURI || data.qrURL || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GCash QR' });
  }
});

module.exports = router;
