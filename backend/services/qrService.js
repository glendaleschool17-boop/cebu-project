const QRCode = require('qrcode');
const crypto = require('crypto');

const SECRET = process.env.BOARDING_PASS_SECRET || 'cebu-airlines-secret';
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

// HMAC token for the whole booking (used for single-pax or the verification page)
const generateBoardingToken = (bookingId) =>
  crypto.createHmac('sha256', SECRET).update(bookingId).digest('hex').slice(0, 16);

// Per-passenger token: ties bookingId + passengerIndex together
const generatePassengerToken = (bookingId, passengerIndex) =>
  crypto.createHmac('sha256', SECRET)
    .update(`${bookingId}:${passengerIndex}`)
    .digest('hex')
    .slice(0, 16);

// Generate a single QR code image (data URL) for a given URL string
const makeQR = (url) =>
  QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#003399', light: '#FFFFFF' } });

// Single-booking QR (used for single-passenger bookings)
const generateBoardingPassQR = async (booking) => {
  const boardingToken = generateBoardingToken(booking.bookingId);
  const url = `${FRONTEND}/boarding/${booking.bookingId}/${boardingToken}`;
  const qrDataUrl = await makeQR(url);
  return { qrDataUrl, boardingToken };
};

// Per-passenger QRs for multi-passenger bookings
// Returns array: [{ passengerIndex, qrDataUrl, token, verifyUrl }]
const generatePerPassengerQRs = async (booking) => {
  const passengers = booking.passengers || [];
  const results = [];
  for (let i = 0; i < passengers.length; i++) {
    const token = generatePassengerToken(booking.bookingId, i);
    const url = `${FRONTEND}/boarding/${booking.bookingId}/${token}?p=${i}`;
    const qrDataUrl = await makeQR(url);
    results.push({ passengerIndex: i, qrDataUrl, token, verifyUrl: url });
  }
  return results;
};

module.exports = { generateBoardingPassQR, generatePerPassengerQRs, generateBoardingToken, generatePassengerToken };
