// VAT rate — 12% (Philippines standard)
export const VAT_RATE = 0.12;

/**
 * Calculate VAT breakdown from a subtotal (pre-VAT price).
 * booking.price is always stored as the pre-VAT subtotal.
 * @param {number} subtotal  — pre-VAT total (booking.price)
 * @param {number} [pax=1]   — passenger count
 */
export function calcVAT(subtotal, pax = 1) {
  const sub        = Math.round(subtotal);
  const vatAmount  = Math.round(sub * VAT_RATE);
  const grandTotal = sub + vatAmount;

  const perPaxSubtotal = pax > 0 ? Math.round(sub / pax) : sub;
  const perPaxVat      = pax > 0 ? Math.round(vatAmount / pax) : vatAmount;
  const perPaxTotal    = perPaxSubtotal + perPaxVat;

  return { subtotal: sub, vatAmount, grandTotal, vatPercent: 12, perPaxSubtotal, perPaxVat, perPaxTotal };
}
