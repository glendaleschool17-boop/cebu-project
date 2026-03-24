/**
 * Cebu Airlines — Cancellation & Reschedule Fee Calculator
 * Mirrors Cebu Pacific / PAL style rules.
 *
 * Rules (based on time BEFORE the flight's departure):
 *   • Within 24 hrs AFTER booking date  → 0%   (grace period)
 *   • > 7 days before flight            → 10%
 *   • 3–7 days before flight            → 20%
 *   • 24–72 hrs before flight           → 30%
 *   • < 24 hrs before flight            → NOT ALLOWED
 */

/**
 * Returns { feePercent, label, allowed }
 * @param {string} bookingDate   ISO string — when the booking was created
 * @param {string} departureTime ISO string — flight departure
 * @param {Date}   [now]         Optional override for "current time" (testing)
 */
function getFeeRule(bookingDate, departureTime, now = new Date()) {
  const departure = new Date(departureTime);
  const booked    = new Date(bookingDate);

  const msToFlight    = departure - now;          // ms until departure (negative = past)
  const msSinceBooked = now - booked;             // ms since booking

  const hrsToFlight    = msToFlight    / (1000 * 60 * 60);
  const hrsSinceBooked = msSinceBooked / (1000 * 60 * 60);

  // Grace period: within 24 hrs of booking
  if (hrsSinceBooked <= 24) {
    return { feePercent: 0, label: 'Free cancellation (within 24 hrs of booking)', allowed: true };
  }

  // Flight already departed or < 24 hrs away
  if (hrsToFlight < 24) {
    return { feePercent: 0, label: 'Less than 24 hours before flight', allowed: false };
  }

  // 24–72 hrs before flight
  if (hrsToFlight < 72) {
    return { feePercent: 30, label: '24–72 hours before flight (30% fee)', allowed: true };
  }

  // 3–6 days (72–168 hrs) before flight
  if (hrsToFlight < 168) {
    return { feePercent: 20, label: '3–7 days before flight (20% fee)', allowed: true };
  }

  // > 7 days before flight
  return { feePercent: 10, label: 'More than 7 days before flight (10% fee)', allowed: true };
}

/**
 * Calculate cancellation amounts.
 * @param {object} booking  — booking document data
 * @param {object} flight   — flight document data (needs departureTime)
 * @param {Date}   [now]
 * @returns {object} breakdown
 */
function calcCancellationFee(booking, flight, now = new Date()) {
  const rule         = getFeeRule(booking.bookingDate, flight.departureTime, now);
  const passengerCount = booking.passengerCount || 1;
  // Use the VAT-inclusive grand total as the base (what the passenger actually paid)
  const vatRate      = 0.12;
  const subtotal     = booking.price || 0;
  const vatAmount    = booking.vatAmount  || Math.round(subtotal * vatRate);
  const grandTotal   = booking.grandTotal || (subtotal + vatAmount);
  const totalPrice   = grandTotal;
  const pricePerPax  = Math.round(totalPrice / passengerCount);

  const feePerPax    = Math.round(pricePerPax * rule.feePercent / 100);
  const totalFee     = feePerPax * passengerCount;
  const refundPerPax = pricePerPax - feePerPax;
  const totalRefund  = refundPerPax * passengerCount;

  return {
    allowed:        rule.allowed,
    feePercent:     rule.feePercent,
    ruleLabel:      rule.label,
    passengerCount,
    pricePerPax,
    feePerPax,
    totalFee,
    refundPerPax,
    totalRefund,
    totalPrice,   // VAT-inclusive total
    subtotal,     // pre-VAT subtotal for reference
    vatAmount,
    grandTotal,
  };
}

/**
 * Calculate rescheduling amounts.
 * @param {object} booking       — existing booking
 * @param {object} flight        — current flight (for departure time)
 * @param {object} newFlight     — new flight the passenger wants to switch to
 * @param {Date}   [now]
 * @returns {object} breakdown
 */
function calcRescheduleFee(booking, flight, newFlight, now = new Date(), newSeatClass = null) {
  const rule           = getFeeRule(booking.bookingDate, flight.departureTime, now);
  const passengerCount = booking.passengerCount || 1;
  const totalPrice     = booking.price || 0;
  const pricePerPax    = Math.round(totalPrice / passengerCount);

  // Support class upgrade/downgrade
  const oldClass       = booking.seatClass || 'economy';
  const resolvedClass  = newSeatClass || oldClass;
  const isBiz          = resolvedClass === 'business';
  const newBasePrice   = newFlight.price || 0;
  const newPricePerPax = isBiz ? Math.round(newBasePrice * 1.5) : newBasePrice;

  const upgradePerPax       = (oldClass !== 'business' && isBiz) ? Math.round(newBasePrice * 0.5) : 0;
  const fareDiffPerPax      = Math.max(0, newPricePerPax - pricePerPax);
  const rescheduleFeePerPax = Math.round(pricePerPax * rule.feePercent / 100);

  const totalFareDiff      = fareDiffPerPax   * passengerCount;
  const totalUpgrade       = upgradePerPax    * passengerCount;
  const totalRescheduleFee = rescheduleFeePerPax * passengerCount;
  const totalPayment       = totalFareDiff + totalRescheduleFee;
  const classChanged       = resolvedClass !== oldClass;

  return {
    allowed:             rule.allowed,
    feePercent:          rule.feePercent,
    ruleLabel:           rule.label,
    passengerCount,
    pricePerPax,
    newPricePerPax,
    fareDiffPerPax,
    totalFareDiff,
    upgradePerPax,
    totalUpgrade,
    rescheduleFeePerPax,
    totalRescheduleFee,
    totalPayment,
    originalTotal:       totalPrice,
    classChanged,
    oldClass,
    newClass:            resolvedClass,
  };
}

module.exports = { getFeeRule, calcCancellationFee, calcRescheduleFee };
