/**
 * Cebu Airlines — Cancellation & Reschedule Fee Calculator (frontend)
 */

export function getFeeRule(bookingDate, departureTime, now = new Date()) {
  const departure = new Date(departureTime);
  const booked    = new Date(bookingDate);

  const msToFlight    = departure - now;
  const msSinceBooked = now - booked;

  const hrsToFlight    = msToFlight    / (1000 * 60 * 60);
  const hrsSinceBooked = msSinceBooked / (1000 * 60 * 60);

  if (hrsSinceBooked <= 24) {
    return { feePercent: 0, label: 'Free cancellation (within 24 hrs of booking)', allowed: true };
  }
  if (hrsToFlight < 24) {
    return { feePercent: 0, label: 'Less than 24 hours before flight — changes not allowed', allowed: false };
  }
  if (hrsToFlight < 72) {
    return { feePercent: 30, label: '24–72 hours before flight', allowed: true };
  }
  if (hrsToFlight < 168) {
    return { feePercent: 20, label: '3–7 days before flight', allowed: true };
  }
  return { feePercent: 10, label: 'More than 7 days before flight', allowed: true };
}

export function calcCancellationFee(booking, flight, now = new Date()) {
  const rule           = getFeeRule(booking.bookingDate, flight.departureTime, now);
  const passengerCount = booking.passengerCount || 1;
  // Always use the VAT-inclusive grand total as the base (what the passenger actually paid)
  const vatRate        = 0.12;
  const subtotal       = booking.price || 0;
  const vatAmount      = booking.vatAmount  || Math.round(subtotal * vatRate);
  const grandTotal     = booking.grandTotal || (subtotal + vatAmount);
  const totalPrice     = grandTotal; // base for all calculations
  const pricePerPax    = Math.round(totalPrice / passengerCount);
  const feePerPax      = Math.round(pricePerPax * rule.feePercent / 100);
  const totalFee       = feePerPax * passengerCount;
  const refundPerPax   = pricePerPax - feePerPax;
  const totalRefund    = refundPerPax * passengerCount;

  return {
    allowed: rule.allowed, feePercent: rule.feePercent, ruleLabel: rule.label,
    passengerCount, pricePerPax, feePerPax, totalFee, refundPerPax, totalRefund,
    totalPrice,   // VAT-inclusive total (what was paid)
    subtotal,     // pre-VAT subtotal (for reference)
    vatAmount,
    grandTotal,
  };
}

export function calcRescheduleFee(booking, currentFlight, newFlight, now = new Date(), newSeatClass = null) {
  const rule           = getFeeRule(booking.bookingDate, currentFlight.departureTime, now);
  const passengerCount = booking.passengerCount || 1;
  const totalPrice     = booking.price || 0;
  const pricePerPax    = Math.round(totalPrice / passengerCount);

  // Support class upgrade/downgrade during reschedule
  const oldClass       = booking.seatClass || 'economy';
  const resolvedClass  = newSeatClass || oldClass;
  const isBiz          = resolvedClass === 'business';
  const wasAlreadyBiz  = oldClass === 'business';
  const newBasePrice   = newFlight.price || 0;
  const newPricePerPax = isBiz ? Math.round(newBasePrice * 1.5) : newBasePrice;

  // Old price per pax (in their original class)
  const oldBasePricePerPax = wasAlreadyBiz ? Math.round((booking.flight?.price || newBasePrice) * 1.5) : (booking.flight?.price || pricePerPax);

  const fareDiffPerPax      = Math.max(0, newPricePerPax - pricePerPax);
  const upgradePerPax       = (!wasAlreadyBiz && isBiz) ? Math.round(newBasePrice * 0.5) : 0;
  const rescheduleFeePerPax = Math.round(pricePerPax * rule.feePercent / 100);
  const totalFareDiff       = fareDiffPerPax * passengerCount;
  const totalUpgrade        = upgradePerPax * passengerCount;
  const totalRescheduleFee  = rescheduleFeePerPax * passengerCount;
  const totalPayment        = totalFareDiff + totalRescheduleFee;
  const classChanged        = resolvedClass !== oldClass;

  return {
    allowed: rule.allowed, feePercent: rule.feePercent, ruleLabel: rule.label,
    passengerCount, pricePerPax, newPricePerPax, fareDiffPerPax, totalFareDiff,
    rescheduleFeePerPax, totalRescheduleFee, totalPayment, originalTotal: totalPrice,
    upgradePerPax, totalUpgrade, classChanged, oldClass, newClass: resolvedClass,
  };
}
