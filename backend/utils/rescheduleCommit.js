/**
 * rescheduleCommit.js
 * Shared utility: applies a reschedule after payment is confirmed.
 * Extracted here to avoid circular imports between bookings.js and payments.js.
 *
 * FIX: seat swaps now use runTransaction() to prevent race conditions where
 * two concurrent operations could modify seat counts simultaneously.
 */

const { db } = require('../config/firebase');
const { calcVAT } = require('./vatCalculator');

/**
 * Atomically swap seats on a single flight pair inside a Firestore transaction.
 * Releases oldSeats from currentFlightId, reserves newSeats on newFlightId.
 */
async function swapSeatsTransactional(currentFlightId, newFlightId, oldSeats, newSeats) {
  const sameDoc = currentFlightId === newFlightId;

  await db.runTransaction(async (t) => {
    const currentRef = db.collection('flights').doc(currentFlightId);
    const newRef     = db.collection('flights').doc(newFlightId);

    const [currentDoc, newDoc] = sameDoc
      ? await Promise.all([t.get(currentRef)])  // single read
      : await Promise.all([t.get(currentRef), t.get(newRef)]);

    const actualNewDoc = sameDoc ? currentDoc : newDoc;

    if (!currentDoc.exists) throw new Error(`Flight ${currentFlightId} not found`);
    if (!actualNewDoc.exists) throw new Error(`Flight ${newFlightId} not found`);

    const cd = currentDoc.data();
    const nd = actualNewDoc.data();

    // Check new seats are still available (inside transaction)
    const conflicting = newSeats.filter(s => (nd.bookedSeats || []).includes(s));
    if (conflicting.length > 0)
      throw Object.assign(
        new Error(`Seat(s) ${conflicting.join(', ')} on new flight are no longer available.`),
        { status: 409 }
      );

    if (sameDoc) {
      // Same flight — single atomic update
      const updated = (cd.bookedSeats || [])
        .filter(s => !oldSeats.includes(s))
        .concat(newSeats);
      t.update(currentRef, {
        bookedSeats:    updated,
        availableSeats: (cd.availableSeats || 0) + oldSeats.length - newSeats.length,
      });
    } else {
      // Release from old flight
      t.update(currentRef, {
        bookedSeats:    (cd.bookedSeats || []).filter(s => !oldSeats.includes(s)),
        availableSeats: (cd.availableSeats || 0) + oldSeats.length,
      });
      // Reserve on new flight
      t.update(newRef, {
        bookedSeats:    [...(nd.bookedSeats || []), ...newSeats],
        availableSeats: (nd.availableSeats || 0) - newSeats.length,
      });
    }
  });
}

/**
 * Commit a reschedule: move seats between flights and update the booking doc.
 * Called either immediately (free reschedule) or after payment proof is uploaded.
 */
async function commitReschedule(doc, booking, {
  leg,
  newFlightId, newSeatNumbers, resolvedOutClass,
  newReturnFlightId, newReturnSeatNumbers, resolvedRetClass,
  currentFlight, newFlight, currentRetFlight, newRetFlight,
  combinedFee, reason,
}) {
  // Guard: return-leg reschedule requires returnSeatNumbers on the existing booking
  if ((leg === 'return' || leg === 'both') &&
      (!booking.returnSeatNumbers || booking.returnSeatNumbers.length === 0)) {
    throw Object.assign(
      new Error('Return seat numbers are required for return-leg reschedule.'),
      { status: 400 }
    );
  }

  const pax = booking.passengerCount || 1;
  const outOldSeats = booking.seatNumbers || [booking.seatNumber];
  const retOldSeats = booking.returnSeatNumbers; // safe: guard above ensures this exists

  // ── Move outbound seats (atomic transaction) ─────────────────────────────
  if (leg !== 'return' && newFlight && currentFlight) {
    await swapSeatsTransactional(
      currentFlight.id,
      newFlight.id,
      outOldSeats,
      newSeatNumbers
    );
  }

  // ── Move return seats (atomic transaction) ───────────────────────────────
  if ((leg === 'return' || leg === 'both') && newRetFlight && currentRetFlight) {
    await swapSeatsTransactional(
      currentRetFlight.id,
      newRetFlight.id,
      retOldSeats,
      newReturnSeatNumbers
    );
  }

  // ── Recalculate price server-side from Firestore flight prices ───────────
  const isBizOut  = resolvedOutClass === 'business';
  const newOutPrice = leg !== 'return'
    ? (isBizOut ? Math.round(newFlight.price * 1.5) : newFlight.price) * pax
    : (booking.outboundPrice || 0);

  let newRetPrice = booking.returnPrice || 0;
  if ((leg === 'return' || leg === 'both') && newRetFlight) {
    const isBizRet = resolvedRetClass === 'business';
    newRetPrice = (isBizRet ? Math.round(newRetFlight.price * 1.5) : newRetFlight.price) * pax;
  }

  const totalPrice = leg === 'both'
    ? newOutPrice + newRetPrice
    : leg === 'return'
      ? (booking.outboundPrice || 0) + newRetPrice
      : newOutPrice;

  const newVat = calcVAT(totalPrice, pax);

  // ── Build booking update ─────────────────────────────────────────────────
  const update = {
    status:                 'reschedule_requested',
    rescheduleFeeBreakdown: combinedFee,
    rescheduleReason:       reason || '',
    rescheduledAt:          new Date().toISOString(),
    updatedAt:              new Date().toISOString(),
    pendingReschedule:      null,
    price:                  totalPrice,
    vatAmount:              newVat.vatAmount,
    grandTotal:             newVat.grandTotal,
  };

  if (leg !== 'return') {
    update.flightId               = newFlight.id;
    update.seatNumbers            = newSeatNumbers;
    update.seatNumber             = newSeatNumbers[0];
    update.seatClass              = resolvedOutClass;
    update.previousSeatClass      = booking.seatClass;
    update.previousFlightId       = currentFlight.id;
    update.previousFlightNumber   = currentFlight.flightNumber;
    update.previousDeparture      = currentFlight.departureTime;
    update.previousSeatNumbers    = outOldSeats;
    update.outboundPrice          = newOutPrice;
  }

  if (leg === 'return' || leg === 'both') {
    update.returnFlightId               = newRetFlight.id;
    update.returnSeatNumbers            = newReturnSeatNumbers;
    update.returnSeatClass              = resolvedRetClass;
    update.previousReturnFlightId       = currentRetFlight.id;
    update.previousReturnFlightNumber   = currentRetFlight.flightNumber;
    update.previousReturnDeparture      = currentRetFlight.departureTime;
    update.previousReturnSeatNumbers    = retOldSeats;
    update.returnPrice                  = newRetPrice;
  }

  await doc.ref.update(update);
}

module.exports = { commitReschedule };
