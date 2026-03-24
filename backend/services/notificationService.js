/**
 * Notification Service — stores notifications in user subcollections.
 *
 * Path for passengers : /users/{uid}/notifications/{id}
 * Path for admins     : /users/ADMINS/notifications/{id}   (sentinel doc)
 *
 * This avoids composite indexes, complex Firestore rules, and collection-group
 * queries. Each user's onSnapshot listener only reads their own subcollection.
 */
const { db } = require('../config/firebase');

const ADMIN_SENTINEL = 'ADMINS'; // fixed doc ID for the admin notifications bucket

async function createNotification({
  userId = null,
  adminOnly = false,
  type, icon, title, message, color, link,
  bookingId = null,
}) {
  const payload = {
    type, icon, title, message, color, link,
    bookingId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const writes = [];

    if (adminOnly) {
      // Write to the shared admin bucket
      writes.push(
        db.collection('users').doc(ADMIN_SENTINEL)
          .collection('notifications').add(payload)
      );
    }

    if (userId) {
      // Write to the specific user's subcollection
      writes.push(
        db.collection('users').doc(userId)
          .collection('notifications').add(payload)
      );
    }

    await Promise.all(writes);
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

const notify = {
  bookingConfirmed: (booking) => createNotification({
    userId: booking.userId,
    type: 'booking_confirmed',
    icon: '✅', title: 'Booking Confirmed!',
    message: `Your booking ${booking.bookingId} has been approved. Check your email for your boarding pass.`,
    color: '#00aa55', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  paymentSubmitted: (booking) => Promise.all([
    createNotification({
      userId: booking.userId,
      type: 'payment_submitted',
      icon: '🔍', title: 'Payment Under Review',
      message: `Payment for ${booking.bookingId} has been submitted and is awaiting admin approval.`,
      color: '#f59e0b', link: '/my-bookings', bookingId: booking.bookingId,
    }),
    createNotification({
      adminOnly: true,
      type: 'payment_submitted_admin',
      icon: '💳', title: 'New Payment Submitted',
      message: `${booking.passengerName || 'A passenger'} submitted payment for booking ${booking.bookingId}.`,
      color: '#f59e0b', link: '/admin/bookings', bookingId: booking.bookingId,
    }),
  ]),

  paymentRejected: (booking) => createNotification({
    userId: booking.userId,
    type: 'payment_rejected',
    icon: '❌', title: 'Payment Rejected',
    message: `Your payment for ${booking.bookingId} was rejected. Please re-upload a valid screenshot.`,
    color: '#cc2222', link: `/payment/${booking.bookingId}`, bookingId: booking.bookingId,
  }),

  cancellationRequested: (booking) => createNotification({
    adminOnly: true,
    type: 'cancellation_requested',
    icon: '🔄', title: 'Cancellation Request',
    message: `${booking.passengerName || 'A passenger'} requested cancellation of ${booking.bookingId}.`,
    color: '#cc5500', link: '/admin/bookings', bookingId: booking.bookingId,
  }),

  cancellationApproved: (booking) => createNotification({
    userId: booking.userId,
    type: 'cancellation_approved',
    icon: '✅', title: 'Cancellation Approved',
    message: `Your cancellation for ${booking.bookingId} has been approved. Refund is being processed.`,
    color: '#00aa55', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  cancellationRejected: (booking) => createNotification({
    userId: booking.userId,
    type: 'cancellation_rejected',
    icon: '❌', title: 'Cancellation Rejected',
    message: `Your cancellation request for ${booking.bookingId} was rejected. Booking remains active.`,
    color: '#cc2222', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  reschedulePaymentPending: (booking) => createNotification({
    userId: booking.userId,
    type: 'reschedule_payment_pending',
    icon: '💳', title: 'Reschedule Fee Due',
    message: `Pay the reschedule fee for ${booking.bookingId} to confirm your new flight.`,
    color: '#cc8800', link: `/reschedule-payment/${booking.bookingId}`, bookingId: booking.bookingId,
  }),

  reschedulePaymentSubmitted: (booking) => createNotification({
    adminOnly: true,
    type: 'reschedule_payment_submitted',
    icon: '✈️', title: 'Reschedule Payment Received',
    message: `${booking.passengerName || 'A passenger'} paid the reschedule fee for ${booking.bookingId}.`,
    color: '#003399', link: '/admin/bookings', bookingId: booking.bookingId,
  }),

  rescheduleApproved: (booking) => createNotification({
    userId: booking.userId,
    type: 'reschedule_approved',
    icon: '✅', title: 'Reschedule Confirmed!',
    message: `Your reschedule for ${booking.bookingId} has been approved. Check your email for the updated ticket.`,
    color: '#00aa55', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  rescheduleRejected: (booking) => createNotification({
    userId: booking.userId,
    type: 'reschedule_rejected',
    icon: '❌', title: 'Reschedule Rejected',
    message: `Your reschedule request for ${booking.bookingId} was rejected. Original booking remains.`,
    color: '#cc2222', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  bookingExpired: (booking) => createNotification({
    userId: booking.userId,
    type: 'booking_expired',
    icon: '⏰', title: 'Booking Expired',
    message: `Your booking ${booking.bookingId} expired — payment was not received in time. Please book again.`,
    color: '#888', link: '/search', bookingId: booking.bookingId,
  }),

  flightCancelled: (booking, flight) => createNotification({
    userId: booking.userId,
    type: 'flight_cancelled',
    icon: '⚠️', title: 'Your Flight Has Been Cancelled',
    message: `Flight ${flight.flightNumber} (${flight.origin} → ${flight.destination}) on your booking ${booking.bookingId} has been cancelled. Please contact support or rebook.`,
    color: '#cc2222', link: '/my-bookings', bookingId: booking.bookingId,
  }),

  // Admin notification: passenger requested a refund after airline-cancelled flight
  refundRequested: (booking, flight) => createNotification({
    adminOnly: true,
    type: 'refund_requested',
    icon: '💸', title: 'Refund Request Received',
    message: `${booking.passengerName || 'A passenger'} requested a full refund for booking ${booking.bookingId} — ${flight ? `Flight ${flight.flightNumber} (${flight.origin} → ${flight.destination})` : 'cancelled flight'}.`,
    color: '#cc5500', link: '/admin/bookings', bookingId: booking.bookingId,
  }),

  // Admin notification: passenger requested to rebook after airline-cancelled flight
  rebookRequested: (booking, flight) => createNotification({
    adminOnly: true,
    type: 'rebook_requested',
    icon: '🔄', title: 'Rebooking Request Received',
    message: `${booking.passengerName || 'A passenger'} wants to rebook booking ${booking.bookingId} — ${flight ? `originally on Flight ${flight.flightNumber} (${flight.origin} → ${flight.destination})` : 'cancelled flight'}. Assign a new flight.`,
    color: '#003399', link: '/admin/bookings', bookingId: booking.bookingId,
  }),

  // User notification: admin has processed their rebook to a new flight
  rebookConfirmed: (booking, newFlight) => createNotification({
    userId: booking.userId,
    type: 'rebook_confirmed',
    icon: '✅', title: 'Rebooking Confirmed!',
    message: `Your booking ${booking.bookingId} has been moved to Flight ${newFlight.flightNumber} (${newFlight.origin} → ${newFlight.destination}). Check My Bookings for updated details.`,
    color: '#00aa55', link: '/my-bookings', bookingId: booking.bookingId,
  }),
};

module.exports = { createNotification, notify, ADMIN_SENTINEL };
