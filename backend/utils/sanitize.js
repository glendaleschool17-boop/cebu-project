/**
 * sanitize.js
 * Server-side input sanitization and validation utilities.
 * Prevents XSS injection and validates passenger data format.
 */

/** Strip HTML tags and trim whitespace to prevent XSS */
const stripHtml = (str) =>
  typeof str === 'string'
    ? str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim()
    : '';

/** Validate email format */
const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Validate passenger name — letters, spaces, hyphens, apostrophes only */
const isValidName = (name) =>
  typeof name === 'string' &&
  name.trim().length >= 2 &&
  /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'\-\.]+$/.test(name.trim());

/**
 * Validate and sanitize a single passenger object.
 * Returns { ok, error, passenger } — throws on invalid data.
 */
const sanitizePassenger = (p, index) => {
  const name  = stripHtml(p.name  || '');
  const email = (p.email || '').trim().toLowerCase();
  const phone = stripHtml(p.phone || '');

  if (!isValidName(name)) {
    return { ok: false, error: `Passenger ${index + 1}: name is required and must contain only letters (min 2 chars).` };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: `Passenger ${index + 1}: a valid email address is required.` };
  }

  return {
    ok: true,
    passenger: { ...p, name, email, phone },
  };
};

/**
 * Sanitize all passengers in a list.
 * Returns { ok, error, passengers }.
 */
const sanitizePassengers = (list) => {
  const sanitized = [];
  for (let i = 0; i < list.length; i++) {
    const result = sanitizePassenger(list[i], i);
    if (!result.ok) return { ok: false, error: result.error };
    sanitized.push(result.passenger);
  }
  return { ok: true, passengers: sanitized };
};

module.exports = { stripHtml, isValidEmail, isValidName, sanitizePassenger, sanitizePassengers };
