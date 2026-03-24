import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { toast } from 'react-toastify';
import { calcVAT } from '../utils/vatCalculator';
import { useAuth } from '../context/AuthContext';

const CITY_NAMES = {
  MNL: 'Manila', CEB: 'Cebu', DVO: 'Davao', ILO: 'Iloilo',
  BCD: 'Bacolod', ZAM: 'Zamboanga', GEN: 'General Santos',
  LGP: 'Legazpi', KLO: 'Kalibo', PPS: 'Puerto Princesa',
};

// ── Custom confirm dialog (replaces window.confirm which shows "localhost says") ──
const ConfirmModal = ({ title, message, confirmLabel = 'Confirm', confirmColor = '#003399', onConfirm, onCancel }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ background:'white', borderRadius:16, padding:'32px 28px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
      <div style={{ fontSize:22, fontWeight:800, color:'#1a1a2e', marginBottom:12, fontFamily:'Montserrat, sans-serif' }}>{title}</div>
      <div style={{ fontSize:14, color:'#555', lineHeight:1.6, marginBottom:28 }}>{message}</div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'12px', fontSize:14, fontWeight:600, background:'#f0f4ff', color:'#003399', border:'2px solid #dde4ff', borderRadius:10, cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{ flex:1, padding:'12px', fontSize:14, fontWeight:700, background:confirmColor, color:'white', border:'none', borderRadius:10, cursor:'pointer' }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resending, setResending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const navigate = useNavigate();
  const { adminCity, isSuperAdmin } = useAuth();
  const cityLabel = adminCity ? (CITY_NAMES[adminCity] || adminCity) : null;

  // Helper: show custom confirm and return a promise
  const showConfirm = ({ title, message, confirmLabel, confirmColor }) =>
    new Promise(resolve => setConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm: () => { setConfirmModal(null); resolve(true); }, onCancel: () => { setConfirmModal(null); resolve(false); } }));

  useEffect(() => {
    document.title = 'Admin Bookings – Cebu Airline';
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.get('/admin/bookings');
      setBookings(data.bookings || []);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookingId) => {
    const ok = await showConfirm({ title: '✅ Approve Booking', message: 'Approve this booking and send a confirmation email to the passenger?', confirmLabel: 'Approve & Send Email', confirmColor: '#00aa55' });
    if (!ok) return;
    try {
      await api.post(`/admin/approve/${bookingId}`);
      toast.success('✅ Booking approved! Email sent to passenger.');
      fetchBookings();
      setSelectedBooking(null);
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (bookingId) => {
    if (!rejectReason.trim()) return toast.error('Please enter a rejection reason');
    try {
      await api.post(`/admin/reject/${bookingId}`, { reason: rejectReason });
      toast.success('Booking rejected');
      fetchBookings();
      setSelectedBooking(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    }
  };

  const handleApproveCancellation = async (bookingId) => {
    const ok = await showConfirm({ title: '🚫 Approve Cancellation', message: 'Approve this cancellation? The seat will be released and the booking will be marked as cancelled.', confirmLabel: 'Approve Cancellation', confirmColor: '#cc5500' });
    if (!ok) return;
    try {
      await api.post(`/admin/approve-cancellation/${bookingId}`);
      toast.success('✅ Cancellation approved. Booking cancelled and seat released.');
      fetchBookings();
      setSelectedBooking(null);
    } catch (err) {
      toast.error(err.message || 'Failed to approve cancellation');
    }
  };

  const handleRejectCancellation = async (bookingId) => {
    if (!rejectReason.trim()) return toast.error('Please enter a reason for rejecting the cancellation request');
    try {
      await api.post(`/admin/reject-cancellation/${bookingId}`, { reason: rejectReason });
      toast.success('Cancellation request rejected. Booking remains confirmed.');
      fetchBookings();
      setSelectedBooking(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to reject cancellation');
    }
  };

  const handleApproveReschedule = async (bookingId) => {
    const ok = await showConfirm({ title: '🔄 Approve Reschedule', message: 'Approve this reschedule request? The booking will be confirmed on the new flight.', confirmLabel: 'Approve Reschedule', confirmColor: '#003399' });
    if (!ok) return;
    try {
      await api.post(`/admin/approve-reschedule/${bookingId}`);
      toast.success('✅ Reschedule approved.');
      fetchBookings();
      setSelectedBooking(null);
    } catch (err) {
      toast.error(err.message || 'Failed to approve reschedule');
    }
  };

  const handleRejectReschedule = async (bookingId) => {
    if (!rejectReason.trim()) return toast.error('Please enter a reason for rejecting');
    try {
      await api.post(`/admin/reject-reschedule/${bookingId}`, { reason: rejectReason });
      toast.success('Reschedule request rejected. Booking restored to original flight.');
      fetchBookings();
      setSelectedBooking(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to reject reschedule');
    }
  };

  const handleResendEmail = async (bookingId) => {
    const ok = await showConfirm({ title: '📨 Resend Email', message: 'Resend the confirmation email with QR tickets to all passengers on this booking?', confirmLabel: 'Resend Email', confirmColor: '#003399' });
    if (!ok) return;
    setResending(true);
    try {
      await api.post(`/admin/resend-email/${bookingId}`);
      toast.success('📧 Confirmation email resent successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  const filtered = (() => {
    const byStatus = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(b => {
      const route = `${b.flight?.origin || ''} ${b.flight?.destination || ''}`.toLowerCase();
      return (
        (b.bookingId || '').toLowerCase().includes(q) ||
        (b.passengerName || '').toLowerCase().includes(q) ||
        (b.flight?.flightNumber || '').toLowerCase().includes(q) ||
        route.includes(q)
      );
    });
  })();

  const formatDate = (dt) => new Date(dt).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const API_BASE = process.env.REACT_APP_API_URL || '/api';
  // Use relative base for asset URLs so they work on any host, never hardcode localhost
  const serverBase = API_BASE.startsWith('http') ? new URL(API_BASE).origin : '';

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container">
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Booking Management</h1>
            {cityLabel && (
              <div style={scopeBanner}>
                📍 Showing bookings for <strong>{cityLabel}</strong> — flights where {cityLabel} is the origin or destination
              </div>
            )}
            {isSuperAdmin && (
              <div style={{ ...scopeBanner, background: '#f3e8ff', color: '#7700cc', borderColor: '#ddb8ff' }}>
                ⭐ Super Admin — viewing all bookings across all cities
              </div>
            )}
          </div>
          {/* Search bar */}
          <div style={{ display:'flex', alignItems:'center', background:'#f8faff', border:'1.5px solid #dde4ff', borderRadius:10, padding:'0 12px', gap:8, marginBottom:12, maxWidth:420 }}>
            <span style={{ fontSize:16, opacity:0.5 }}>🔍</span>
            <input
              style={{ flex:1, border:'none', background:'transparent', padding:'10px 4px', fontSize:14, color:'#1a1a2e', outline:'none', fontFamily:'Inter, sans-serif' }}
              placeholder="Search by booking ref, passenger, flight, route…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, padding:'4px', lineHeight:1 }}>✕</button>
            )}
          </div>
          <div style={styles.filterTabs}>
            {[
              { key: 'all', label: 'All' },
              { key: 'payment_submitted', label: '📤 Pending Review' },
              { key: 'cancellation_requested', label: '🔄 Cancel Requests' },
              { key: 'reschedule_requested', label: '✈️ Reschedule Requests' },
              { key: 'reschedule_payment_pending', label: '💳 Reschedule Pmt.' },
              { key: 'confirmed', label: '✅ Confirmed' },
              { key: 'rejected', label: '❌ Rejected' },
              { key: 'pending_payment', label: '⏳ Awaiting Payment' },
              { key: 'cancelled', label: '🚫 Cancelled' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{ ...styles.tab, ...(filter === tab.key ? styles.activeTab : {}) }}
              >
                {tab.label} ({tab.key === 'all' ? bookings.length : bookings.filter(b => b.status === tab.key).length})
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="spinner" /> : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Passenger</th>
                    <th>Flight</th>
                    <th>Seat</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(booking => {
                    const isRT = booking.tripType === 'roundtrip';
                    return (
                    <tr key={booking.id}>
                      <td>
                        <span style={styles.refNum}>{booking.bookingId}</span>
                        <div style={{
                          display: 'inline-block', marginLeft: 6,
                          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
                          background: isRT ? '#e8f5e9' : '#e8eeff',
                          color: isRT ? '#007744' : '#003399',
                          border: `1px solid ${isRT ? '#00aa55' : '#99aadd'}`,
                        }}>
                          {isRT ? '🔄 Round' : '➡️ One Way'}
                        </div>
                      </td>
                      <td>
                        <div style={styles.passengerName}>{booking.passengerName}</div>
                        <div style={styles.passengerEmail}>{booking.passengerEmail}</div>
                        {booking.passengerCount > 1 && (
                          <div style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: '#fff8e1', color: '#cc8800', border: '1px solid #ffd54f' }}>
                            👥 {booking.passengerCount} passengers
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={styles.flightNum}>{booking.flight?.flightNumber}</div>
                        <div style={styles.route}>{booking.flight?.origin} → {booking.flight?.destination}</div>
                        {isRT && booking.returnFlight && (
                          <div style={{ color: '#007744', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                            🔄 {booking.returnFlight.flightNumber} {booking.returnFlight.origin} → {booking.returnFlight.destination}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>
                          {booking.seatNumbers && booking.seatNumbers.length > 1
                            ? booking.seatNumbers.join(', ')
                            : booking.seatNumber}
                        </strong>
                        <div style={{
                          display: 'inline-block', marginLeft: 6,
                          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
                          background: booking.seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                          color: booking.seatClass === 'business' ? '#b8860b' : '#003399',
                          border: `1px solid ${booking.seatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                        }}>
                          {booking.seatClass === 'business' ? '👑 Business' : '✈️ Economy'}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const pax = booking.passengerCount || 1;
                          const vat = calcVAT(booking.price || 0, pax);
                          const display = booking.grandTotal || vat.grandTotal;
                          return (
                            <>
                              <div style={{ fontWeight: 700, color: '#ff6600' }}>₱{display.toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>incl. VAT</div>
                              {isRT && (
                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                  ₱{(booking.outboundPrice||0).toLocaleString()} + ₱{(booking.returnPrice||0).toLocaleString()}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td><StatusBadge status={booking.status} />
                        {booking.status === 'cancelled' && booking.cancellationReason && (
                          <div style={{ fontSize: 11, color: '#cc2222', marginTop: 4, maxWidth: 140, fontStyle: 'italic' }}>
                            "{booking.cancellationReason.length > 40 ? booking.cancellationReason.slice(0, 40) + '…' : booking.cancellationReason}"
                          </div>
                        )}
                        {booking.status === 'flight_cancelled' && (booking.cancellationReason || booking.flightCancellationReason) && (
                          <div style={{ fontSize: 11, color: '#cc2222', marginTop: 4, maxWidth: 140, fontStyle: 'italic' }}>
                            ✈️ "{(booking.cancellationReason || booking.flightCancellationReason).length > 35
                              ? (booking.cancellationReason || booking.flightCancellationReason).slice(0, 35) + '…'
                              : (booking.cancellationReason || booking.flightCancellationReason)}"
                          </div>
                        )}
                        {booking.status === 'cancellation_requested' && booking.cancellationReason && (
                          <div style={{ fontSize: 11, color: '#cc5500', marginTop: 4, maxWidth: 140, fontStyle: 'italic' }}>
                            "{booking.cancellationReason.length > 40 ? booking.cancellationReason.slice(0, 40) + '…' : booking.cancellationReason}"
                          </div>
                        )}
                        {booking.status === 'reschedule_requested' && booking.previousFlightNumber && (
                          <div style={{ fontSize: 11, color: '#003399', marginTop: 4, fontStyle: 'italic' }}>
                            ✈️ from {booking.previousFlightNumber}
                          </div>
                        )}
                        {booking.status === 'reschedule_payment_pending' && (
                          <div style={{ fontSize: 11, color: '#cc8800', marginTop: 4, fontWeight: 700 }}>
                            💳 Fee: ₱{(booking.rescheduleFeeBreakdown?.totalPayment||0).toLocaleString()} pending
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: '#888' }}>{formatDate(booking.bookingDate)}</td>
                      <td>
                        <div style={styles.actionBtns}>
                          {booking.status === 'payment_submitted' && (
                            <button onClick={() => setSelectedBooking(booking)} style={styles.reviewBtn}>Review</button>
                          )}
                          {booking.status === 'cancellation_requested' && (
                            <button onClick={() => setSelectedBooking(booking)} style={{ ...styles.reviewBtn, background: '#fff0e0', color: '#cc5500', borderColor: '#ffaa66' }}>Review</button>
                          )}
                          {booking.status === 'reschedule_requested' && (
                            <button onClick={() => setSelectedBooking(booking)} style={{ ...styles.reviewBtn, background: '#e8f0ff', color: '#003399', borderColor: '#99aadd' }}>Review</button>
                          )}
                          {booking.status === 'reschedule_payment_pending' && (
                            <button onClick={() => setSelectedBooking(booking)} style={{ ...styles.reviewBtn, background: '#fff8e1', color: '#cc8800', borderColor: '#ffd54f' }}>Review Pmt.</button>
                          )}
                          {booking.status === 'confirmed' && (
                            <>
                              <button onClick={() => setSelectedBooking(booking)} style={styles.viewBtn}>Details</button>
                              <button onClick={() => navigate(`/ticket/${booking.bookingId}`)} style={styles.printBtn}>🖨️ Ticket</button>
                            </>
                          )}
                          {booking.status === 'cancelled' && (
                            <button onClick={() => setSelectedBooking(booking)} style={styles.viewBtn}>View</button>
                          )}
                          {booking.status === 'flight_cancelled' && (
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              style={{ ...styles.viewBtn, ...(booking.pendingAction === 'rebook_pending' ? { background: '#e8f0ff', color: '#003399', borderColor: '#99aadd' } : {}) }}
                            >
                              {booking.pendingAction === 'rebook_pending' ? '🔄 Rebooking' : 'View'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        No bookings found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedBooking && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={{
                    ...styles.modalTitle,
                    color: selectedBooking.status === 'cancelled' ? '#cc2222'
                         : selectedBooking.status === 'flight_cancelled' ? '#cc2222'
                         : selectedBooking.status === 'cancellation_requested' ? '#cc5500'
                         : selectedBooking.status === 'reschedule_requested' ? '#003399'
                         : selectedBooking.status === 'reschedule_payment_pending' ? '#cc8800'
                         : '#003399',
                  }}>
                    {selectedBooking.status === 'cancelled' ? '🚫 Cancelled Booking'
                     : selectedBooking.status === 'flight_cancelled' ? '✈️ Flight Cancelled by Airline'
                     : selectedBooking.status === 'cancellation_requested' ? '🔄 Cancellation Request'
                     : selectedBooking.status === 'reschedule_requested' ? '✈️ Reschedule Request'
                     : selectedBooking.status === 'reschedule_payment_pending' ? '💳 Reschedule Fee Payment'
                     : 'Review Payment Proof'}
                  </h2>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
                    fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
                    background: selectedBooking.tripType === 'roundtrip' ? '#e8f5e9' : '#e8eeff',
                    color: selectedBooking.tripType === 'roundtrip' ? '#007744' : '#003399',
                    border: `1.5px solid ${selectedBooking.tripType === 'roundtrip' ? '#00aa55' : '#99aadd'}`,
                  }}>
                    {selectedBooking.tripType === 'roundtrip' ? '🔄 ROUND TRIP' : '➡️ ONE WAY TRIP'}
                  </div>
                </div>
                <button onClick={() => setSelectedBooking(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.modalInfo}>
                  {/* Booking ref */}
                  <div style={styles.infoRow}>
                    <span>Booking Ref</span>
                    <strong style={{ fontFamily: 'Montserrat', letterSpacing: 1 }}>{selectedBooking.bookingId}</strong>
                  </div>

                  {/* Passenger count badge */}
                  <div style={styles.infoRow}>
                    <span>Passengers</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{selectedBooking.passengerCount || 1}</strong>
                      {(selectedBooking.passengerCount || 1) > 1 && (
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 10, background: '#fff8e1', color: '#cc8800', border: '1px solid #ffd54f' }}>
                          👥 Group Booking
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Seat class */}
                  <div style={styles.infoRow}>
                    <span>Class</span>
                    <span style={{
                      fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
                      background: selectedBooking.seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                      color: selectedBooking.seatClass === 'business' ? '#b8860b' : '#003399',
                      border: `1px solid ${selectedBooking.seatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                    }}>
                      {selectedBooking.seatClass === 'business' ? '👑 Business Class' : '✈️ Economy Class'}
                    </span>
                  </div>

                  {/* ── Passenger Manifest ── */}
                  <div style={{ paddingTop: 12, paddingBottom: 4 }}>
                    <div style={styles.manifestTitle}>👥 Passenger Manifest</div>
                    <div style={styles.manifestTable}>
                      {/* Header */}
                      <div style={styles.manifestHeader}>
                        <div style={styles.mhNum}>#</div>
                        <div style={styles.mhName}>Passenger Name</div>
                        <div style={styles.mhSeat}>Seat</div>
                        <div style={styles.mhEmail}>Email</div>
                      </div>
                      {/* Rows */}
                      {(selectedBooking.passengers && selectedBooking.passengers.length > 0
                        ? selectedBooking.passengers
                        : [{ name: selectedBooking.passengerName, email: selectedBooking.passengerEmail, phone: selectedBooking.passengerPhone, seat: selectedBooking.seatNumber }]
                      ).map((p, i) => (
                        <div key={i} style={{ ...styles.manifestRow, background: i % 2 === 0 ? 'white' : '#f8faff' }}>
                          <div style={styles.manifestNum}>{i + 1}</div>
                          <div style={styles.manifestName}>
                            <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>{p.name}</div>
                            {p.phone && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.phone}</div>}
                          </div>
                          <div style={styles.manifestSeat}>
                            <span style={{
                              display: 'inline-block',
                              background: selectedBooking.seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                              color: selectedBooking.seatClass === 'business' ? '#b8860b' : '#003399',
                              border: `1.5px solid ${selectedBooking.seatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                              padding: '3px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13,
                            }}>
                              {p.seat || selectedBooking.seatNumbers?.[i] || selectedBooking.seatNumber || '—'}
                            </span>
                          </div>
                          <div style={styles.manifestEmail}>{p.email}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact (lead passenger) */}
                  <div style={{ ...styles.infoRow, marginTop: 8 }}>
                    <span>Lead Contact</span>
                    <span style={{ color: '#555', fontSize: 13 }}>
                      {selectedBooking.passengerName} · {selectedBooking.passengerEmail}
                    </span>
                  </div>

                  {/* Flight legs */}
                  <div style={{ ...styles.infoRow, flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                    <span style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Flight(s)</span>
                    <div style={styles.legBox('#003399')}>
                      <div style={styles.legBoxLabel}>✈️ {selectedBooking.tripType === 'roundtrip' ? 'Outbound' : 'Flight'}</div>
                      <div style={styles.legBoxRoute}>
                        <strong>{selectedBooking.flight?.flightNumber}</strong>
                        <span style={{ color: '#555' }}>{selectedBooking.flight?.origin} → {selectedBooking.flight?.destination}</span>
                        <span style={{ color: '#888', fontSize: 12 }}>
                          {selectedBooking.flight?.departureTime
                            ? new Date(selectedBooking.flight.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                            : ''}
                        </span>
                      </div>
                    </div>
                    {selectedBooking.tripType === 'roundtrip' && selectedBooking.returnFlight && (
                      <div style={styles.legBox('#007744')}>
                        <div style={styles.legBoxLabel}>🔄 Return</div>
                        <div style={styles.legBoxRoute}>
                          <strong>{selectedBooking.returnFlight.flightNumber}</strong>
                          <span style={{ color: '#555' }}>{selectedBooking.returnFlight.origin} → {selectedBooking.returnFlight.destination}</span>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            {new Date(selectedBooking.returnFlight.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price breakdown */}
                  {(() => {
                    const pax = selectedBooking.passengerCount || 1;
                    const vat = calcVAT(selectedBooking.price || 0, pax);
                    const grandTotal = selectedBooking.grandTotal || vat.grandTotal;
                    const vatAmount  = selectedBooking.vatAmount  || vat.vatAmount;
                    const subtotal   = selectedBooking.price || 0;
                    const isRT = selectedBooking.tripType === 'roundtrip';
                    return (
                      <div style={{ ...styles.infoRow, flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                        <span style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                          Price Breakdown
                        </span>
                        {isRT ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555' }}>
                              <span>Outbound ({selectedBooking.flight?.origin}→{selectedBooking.flight?.destination})</span>
                              <span>₱{(selectedBooking.outboundPrice || 0).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555' }}>
                              <span>Return ({selectedBooking.returnFlight?.origin}→{selectedBooking.returnFlight?.destination})</span>
                              <span>₱{(selectedBooking.returnPrice || 0).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', borderTop: '1px dashed #eef0ff', paddingTop: 6, marginTop: 2 }}>
                              <span>Subtotal</span>
                              <span>₱{subtotal.toLocaleString()}</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555' }}>
                            <span>Base fare ({pax} pax)</span>
                            <span>₱{subtotal.toLocaleString()}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888' }}>
                          <span>VAT (12%)</span>
                          <span>+₱{vatAmount.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, color: '#ff6600', borderTop: '2px solid #dde4ff', paddingTop: 8, marginTop: 4 }}>
                          <span>{isRT ? 'Grand Total (incl. VAT)' : 'Total (incl. VAT)'}</span>
                          <span>₱{grandTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Cancelled booking: show cancellation reason prominently */}
                {(selectedBooking.status === 'cancelled' || selectedBooking.status === 'flight_cancelled') ? (
                  <>
                    <div style={{
                      ...styles.cancellationBox,
                      ...(selectedBooking.status === 'flight_cancelled' ? { background: '#fff5f5', border: '2px solid #ffaaaa' } : {}),
                    }}>
                      <div style={styles.cancellationHeader}>
                        <span style={styles.cancellationIcon}>
                          {selectedBooking.status === 'flight_cancelled' ? '✈️' : '🚫'}
                        </span>
                        <div>
                          <div style={styles.cancellationLabel}>
                            {selectedBooking.status === 'flight_cancelled'
                              ? 'Flight Cancelled by Airline'
                              : 'Cancellation Reason'}
                          </div>
                          {(selectedBooking.cancelledAt || selectedBooking.flightCancelledAt) && (
                            <div style={styles.cancelledAt}>
                              Cancelled on {new Date(selectedBooking.cancelledAt || selectedBooking.flightCancelledAt).toLocaleDateString('en-PH', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={styles.cancellationReason}>
                        "{selectedBooking.cancellationReason || selectedBooking.flightCancellationReason || 'No reason provided'}"
                      </div>
                      {selectedBooking.status === 'flight_cancelled' && (
                        <div style={{ marginTop: 10, padding: '8px 12px', background: '#e8f5e9', border: '1px solid #99ddaa', borderRadius: 8, fontSize: 12, color: '#007744', fontWeight: 600 }}>
                          ✅ Full refund — no cancellation penalty (airline-initiated)
                        </div>
                      )}
                    </div>

                    {/* Refund Tracking Panel */}
                    {(() => {
                      const isFlightCancelled = selectedBooking.status === 'flight_cancelled';
                      const refundRequested = selectedBooking.paymentStatus === 'refund_pending' || selectedBooking.paymentStatus === 'refunded';
                      const refundAmount = selectedBooking.refundAmount
                        || selectedBooking.grandTotal
                        || Math.round((selectedBooking.price || 0) * 1.12);

                      // For flight_cancelled bookings, only show refund panel if user has chosen refund
                      if (isFlightCancelled && !refundRequested && !selectedBooking.refundSent) {
                        // ── Rebook pending: passenger is self-serving via My Bookings ─
                        if (selectedBooking.pendingAction === 'rebook_pending') {
                          return (
                            <div style={{ background: '#e8f0ff', border: '1.5px solid #99aadd', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#003399', marginBottom: 6 }}>
                                🔄 Passenger is Selecting a New Flight
                              </div>
                              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                                <strong>{selectedBooking.passengerName}</strong> has chosen to rebook and is currently
                                selecting a new flight and seats via their My Bookings page.
                              </div>
                              {selectedBooking.rebookRequestedAt && (
                                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                                  Requested: {new Date(selectedBooking.rebookRequestedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              <div style={{ marginTop: 10, fontSize: 12, color: '#555', background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #c8d4ff' }}>
                                ℹ️ No action needed — the passenger completes their own rebooking. This booking will automatically update to <strong>Confirmed</strong> once they finish.
                              </div>
                            </div>
                          );
                        }

                        // ── Still awaiting passenger choice ──────────────────
                        return (
                          <div style={{ background: '#fff8e1', border: '1.5px solid #ffd54f', borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontSize: 13, color: '#856404' }}>
                            <strong>⏳ Awaiting Passenger Decision</strong>
                            <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>
                              The passenger has been notified and must choose between a refund or rebooking via their My Bookings page.
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div style={{ background: selectedBooking.refundSent ? '#e8f5e9' : '#fff8f0', border: `2px solid ${selectedBooking.refundSent ? '#00aa55' : '#ffaa66'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: selectedBooking.refundSent ? '#007744' : '#cc5500', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                            💸 Refund Status
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#555' }}>Refund Amount</span>
                              <strong style={{ color: '#00aa55' }}>₱{refundAmount.toLocaleString()}</strong>
                            </div>
                            {isFlightCancelled && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#555' }}>Refund Type</span>
                                <span style={{ fontWeight: 600, color: '#007744', fontSize: 12 }}>Full refund (airline-initiated)</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#555' }}>Refund Sent</span>
                              <span style={{ fontWeight: 700, color: selectedBooking.refundSent ? '#007744' : '#cc5500' }}>
                                {selectedBooking.refundSent ? '✅ Yes' : '⏳ Not yet sent'}
                              </span>
                            </div>
                            {selectedBooking.refundProcessedAt && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#555' }}>Processed On</span>
                                <span style={{ fontWeight: 600, color: '#333' }}>
                                  {new Date(selectedBooking.refundProcessedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}
                            {selectedBooking.refundProcessedBy && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#555' }}>Processed By</span>
                                <span style={{ fontWeight: 600, color: '#333' }}>{selectedBooking.refundProcessedBy}</span>
                              </div>
                            )}
                          </div>
                          {!selectedBooking.refundSent && (
                            <button
                              onClick={async () => {
                                const ok = await showConfirm({
                                  title: '💸 Mark Refund as Sent',
                                  message: `Confirm that you have sent the refund of ₱${refundAmount.toLocaleString()} to ${selectedBooking.passengerName}?`,
                                  confirmLabel: '✅ Mark as Sent',
                                  confirmColor: '#003399',
                                });
                                if (!ok) return;
                                try {
                                  await api.post(`/admin/mark-refund-sent/${selectedBooking.bookingId}`);
                                  toast.success('Refund marked as sent.');
                                  fetchBookings();
                                  setSelectedBooking(prev => ({ ...prev, refundSent: true, refundProcessedAt: new Date().toISOString() }));
                                } catch (err) {
                                  toast.error(err.message || 'Failed to mark refund as sent');
                                }
                              }}
                          style={{ marginTop: 12, width: '100%', padding: '11px', fontSize: 14, fontWeight: 700, background: '#003399', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                            >
                              ✅ Mark Refund as Sent
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <button onClick={() => setSelectedBooking(null)} style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 700, background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', borderRadius: 10, cursor: 'pointer' }}>
                      Close
                    </button>
                  </>
                ) : selectedBooking.status === 'cancellation_requested' ? (
                  <>
                    <div style={{ ...styles.cancellationBox, background: '#fff0e0', border: '2px solid #ffaa66' }}>
                      <div style={styles.cancellationHeader}>
                        <span style={styles.cancellationIcon}>🔄</span>
                        <div>
                          <div style={{ ...styles.cancellationLabel, color: '#cc5500' }}>Cancellation Requested</div>
                          {selectedBooking.cancellationRequestedAt && (
                            <div style={styles.cancelledAt}>
                              Requested on {new Date(selectedBooking.cancellationRequestedAt).toLocaleDateString('en-PH', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ ...styles.cancellationReason, border: '1px solid #ffaa66' }}>
                        "{selectedBooking.cancellationReason || 'No reason provided'}"
                      </div>
                    </div>

                    {/* Fee breakdown from booking */}
                    {selectedBooking.cancellationFeeBreakdown && (() => {
                      const fee = selectedBooking.cancellationFeeBreakdown;
                      return (
                        <div style={{ background: '#fff8f0', border: '1.5px solid #ffaa66', borderRadius: 12, padding: '14px 18px', margin: '12px 0' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#cc5500', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>💰 Cancellation Fee Breakdown</div>
                          <table width="100%" style={{ fontSize: 13 }}>
                            <tbody>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>Subtotal (ex. VAT)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₱{(fee.subtotal || Math.round((fee.totalPrice||0) / 1.12)).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>VAT (12%)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>+₱{(fee.vatAmount||0).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0', fontWeight: 700 }}>Total Paid (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 800 }}>₱{(fee.totalPrice || fee.grandTotal ||0).toLocaleString()}</td></tr>
                              <tr style={{ borderTop: '1px dashed #ffaa66' }}><td style={{ color: '#cc5500', padding: '6px 0 4px', fontWeight: 700 }}>Cancellation Fee ({fee.feePercent}%)</td><td style={{ textAlign: 'right', color: '#cc5500', fontWeight: 700 }}>−₱{(fee.totalFee||0).toLocaleString()}</td></tr>
                              <tr style={{ borderTop: '2px solid #ffaa66' }}><td style={{ fontWeight: 800, fontSize: 14, padding: '8px 0 2px' }}>Refund Amount (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#00aa55' }}>₱{(fee.totalRefund||0).toLocaleString()}</td></tr>
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 8 }}>Policy: {fee.ruleLabel}</div>
                        </div>
                      );
                    })()}

                    <div style={styles.rejectSection}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8, display: 'block' }}>
                        Reason for rejecting this cancellation request:
                      </label>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                        <button key="Ticket is non-refundable" type="button"
                          onClick={() => setRejectReason("Ticket is non-refundable")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Ticket is non-refundable" ? styles.quickPickBtnActive : {}) }}>
                          Ticket is non-refundable
                        </button>
                        <button key="Flight is within 24 hours" type="button"
                          onClick={() => setRejectReason("Flight is within 24 hours")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Flight is within 24 hours" ? styles.quickPickBtnActive : {}) }}>
                          Flight is within 24 hours
                        </button>
                        <button key="Cancellation window expired" type="button"
                          onClick={() => setRejectReason("Cancellation window expired")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Cancellation window expired" ? styles.quickPickBtnActive : {}) }}>
                          Cancellation window expired
                        </button>
                        <button key="Insufficient reason provided" type="button"
                          onClick={() => setRejectReason("Insufficient reason provided")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Insufficient reason provided" ? styles.quickPickBtnActive : {}) }}>
                          Insufficient reason provided
                        </button>
                        <button key="Booking already used / checked in" type="button"
                          onClick={() => setRejectReason("Booking already used / checked in")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Booking already used / checked in" ? styles.quickPickBtnActive : {}) }}>
                          Booking already used / checked in
                        </button>
                      </div>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Or type a custom reason…"
                        style={{ ...styles.textarea, marginTop:0 }}
                        rows={2}
                      />
                    </div>
                    <div style={styles.modalActions}>
                      <button
                        onClick={() => handleApproveCancellation(selectedBooking.bookingId)}
                        style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, background: '#cc5500', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
                      >
                        ✅ Approve Cancellation
                      </button>
                      <button
                        onClick={() => handleRejectCancellation(selectedBooking.bookingId)}
                        style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, background: '#003399', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
                      >
                        ❌ Reject Request
                      </button>
                    </div>
                  </>
                ) : selectedBooking.status === 'reschedule_requested' ? (
                  <>
                    <div style={{ background: '#e8f0ff', border: '2px solid #99aadd', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>✈️</span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#003399', fontSize: 14 }}>
                            Reschedule Requested
                            {selectedBooking.rescheduleFeeBreakdown?.leg && (
                              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, background: '#003399', color: 'white', borderRadius: 20, padding: '2px 10px' }}>
                                {selectedBooking.rescheduleFeeBreakdown.leg === 'both' ? '🔄 Both Legs'
                                  : selectedBooking.rescheduleFeeBreakdown.leg === 'return' ? '🔄 Return Leg Only'
                                  : '✈️ Outbound Leg Only'}
                              </span>
                            )}
                          </div>
                          {selectedBooking.rescheduledAt && (
                            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                              Requested on {new Date(selectedBooking.rescheduledAt).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Outbound flight change */}
                      {selectedBooking.rescheduleFeeBreakdown?.leg !== 'return' && selectedBooking.previousFlightNumber && (
                        <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#003399', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>✈️ Outbound</div>
                          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                            Old: <strong>{selectedBooking.previousFlightNumber}</strong>
                            {selectedBooking.previousDeparture && ` · ${new Date(selectedBooking.previousDeparture).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </div>
                          <div style={{ fontSize: 13, color: '#003399', fontWeight: 700, marginBottom: 4 }}>
                            New: <strong>{selectedBooking.flight?.flightNumber}</strong>
                            {selectedBooking.flight?.departureTime && ` · ${new Date(selectedBooking.flight.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </div>
                          {selectedBooking.previousSeatNumbers?.length > 0 && (
                            <div style={{ fontSize: 13, color: '#555' }}>
                              Seats: <strong>{selectedBooking.previousSeatNumbers.join(', ')}</strong> → <strong>{(selectedBooking.seatNumbers || [selectedBooking.seatNumber]).join(', ')}</strong>
                            </div>
                          )}
                          {selectedBooking.previousSeatClass && selectedBooking.previousSeatClass !== selectedBooking.seatClass && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#cc5500', marginTop: 4 }}>
                              🎖️ Class: {selectedBooking.previousSeatClass} → {selectedBooking.seatClass}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Return flight change */}
                      {(selectedBooking.rescheduleFeeBreakdown?.leg === 'return' || selectedBooking.rescheduleFeeBreakdown?.leg === 'both') && selectedBooking.previousReturnFlightNumber && (
                        <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#007744', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>🔄 Return</div>
                          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                            Old: <strong>{selectedBooking.previousReturnFlightNumber}</strong>
                            {selectedBooking.previousReturnDeparture && ` · ${new Date(selectedBooking.previousReturnDeparture).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </div>
                          <div style={{ fontSize: 13, color: '#007744', fontWeight: 700, marginBottom: 4 }}>
                            New: <strong>{selectedBooking.returnFlight?.flightNumber}</strong>
                            {selectedBooking.returnFlight?.departureTime && ` · ${new Date(selectedBooking.returnFlight.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </div>
                          {selectedBooking.previousReturnSeatNumbers?.length > 0 && (
                            <div style={{ fontSize: 13, color: '#555' }}>
                              Seats: <strong>{selectedBooking.previousReturnSeatNumbers.join(', ')}</strong> → <strong>{(selectedBooking.returnSeatNumbers || []).join(', ')}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedBooking.rescheduleReason && (
                        <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic', marginTop: 6 }}>
                          Reason: "{selectedBooking.rescheduleReason}"
                        </div>
                      )}
                    </div>

                    {selectedBooking.rescheduleFeeBreakdown && (() => {
                      const fee = selectedBooking.rescheduleFeeBreakdown;
                      return (
                        <div style={{ background: '#fff8f0', border: '1.5px solid #ffaa66', borderRadius: 12, padding: '14px 18px', margin: '12px 0' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#cc5500', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🔄 Reschedule Fee Breakdown</div>
                          <table width="100%" style={{ fontSize: 13 }}>
                            <tbody>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>Original price / pax (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₱{(fee.pricePerPax||0).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>New price / pax (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₱{(fee.newPricePerPax||0).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>Passengers</td><td style={{ textAlign: 'right', fontWeight: 700 }}>× {fee.passengerCount}</td></tr>
                              {fee.classChanged && (
                                <tr>
                                  <td style={{ color: '#cc5500', padding: '4px 0', fontWeight: 700 }}>
                                    🎖️ Class Upgrade ({fee.oldClass} → {fee.newClass})
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#cc5500', fontWeight: 700 }}>+₱{(fee.totalUpgrade||0).toLocaleString()}</td>
                                </tr>
                              )}
                              {(fee.totalFareDiff||0) > 0 && <tr><td style={{ color: '#003399', padding: '4px 0', fontWeight: 700 }}>Fare Difference</td><td style={{ textAlign: 'right', color: '#003399', fontWeight: 700 }}>₱{(fee.totalFareDiff||0).toLocaleString()}</td></tr>}
                              <tr><td style={{ color: '#cc5500', padding: '4px 0', fontWeight: 700 }}>Reschedule Fee ({fee.feePercent}%)</td><td style={{ textAlign: 'right', color: '#cc5500', fontWeight: 700 }}>₱{(fee.totalRescheduleFee||0).toLocaleString()}</td></tr>
                              <tr style={{ borderTop: '2px solid #ffaa66' }}><td style={{ fontWeight: 800, fontSize: 14, padding: '8px 0 2px' }}>Total Payment Required (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#cc5500' }}>₱{(fee.totalPayment||0).toLocaleString()}</td></tr>
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 8 }}>Policy: {fee.ruleLabel}</div>
                        </div>
                      );
                    })()}

                    <div style={styles.rejectSection}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8, display: 'block' }}>
                        Reason for rejecting (required if rejecting):
                      </label>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                        <button key="Requested flight is fully booked" type="button"
                          onClick={() => setRejectReason("Requested flight is fully booked")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Requested flight is fully booked" ? styles.quickPickBtnActive : {}) }}>
                          Requested flight is fully booked
                        </button>
                        <button key="Reschedule window has passed" type="button"
                          onClick={() => setRejectReason("Reschedule window has passed")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Reschedule window has passed" ? styles.quickPickBtnActive : {}) }}>
                          Reschedule window has passed
                        </button>
                        <button key="Payment proof is invalid" type="button"
                          onClick={() => setRejectReason("Payment proof is invalid")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Payment proof is invalid" ? styles.quickPickBtnActive : {}) }}>
                          Payment proof is invalid
                        </button>
                        <button key="New flight not available" type="button"
                          onClick={() => setRejectReason("New flight not available")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="New flight not available" ? styles.quickPickBtnActive : {}) }}>
                          New flight not available
                        </button>
                        <button key="Insufficient reason provided" type="button"
                          onClick={() => setRejectReason("Insufficient reason provided")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Insufficient reason provided" ? styles.quickPickBtnActive : {}) }}>
                          Insufficient reason provided
                        </button>
                      </div>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Or type a custom reason…"
                        style={{ ...styles.textarea, marginTop:0 }}
                        rows={2}
                      />
                    </div>

                    {/* Show reschedule payment proof if passenger submitted one */}
                    {(selectedBooking.reschedulePaymentProofData || selectedBooking.reschedulePaymentProofURL) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#003399', marginBottom: 8 }}>
                          💳 Reschedule Fee Payment Proof
                        </div>
                        <img
                          src={
                            selectedBooking.reschedulePaymentProofData ||
                            (selectedBooking.reschedulePaymentProofURL?.startsWith('http')
                              ? selectedBooking.reschedulePaymentProofURL
                              : `${serverBase}${selectedBooking.reschedulePaymentProofURL}`)
                          }
                          alt="Reschedule payment proof"
                          style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 10, border: '1.5px solid #dde4ff', cursor: 'pointer' }}
                          onClick={() => window.open(
                            selectedBooking.reschedulePaymentProofData ||
                            (selectedBooking.reschedulePaymentProofURL?.startsWith('http')
                              ? selectedBooking.reschedulePaymentProofURL
                              : `${serverBase}${selectedBooking.reschedulePaymentProofURL}`),
                            '_blank'
                          )}
                        />
                        {selectedBooking.reschedulePaymentSubmittedAt && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                            Submitted: {new Date(selectedBooking.reschedulePaymentSubmittedAt).toLocaleString('en-PH')}
                            <span style={{ marginLeft: 8, color: '#003399' }}>· Click to open full size</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={styles.modalActions}>
                      <button onClick={() => handleApproveReschedule(selectedBooking.bookingId)}
                        style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, background: '#003399', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                        ✅ Approve Reschedule
                      </button>
                      <button onClick={() => handleRejectReschedule(selectedBooking.bookingId)}
                        style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, background: '#cc2222', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                        ❌ Reject
                      </button>
                    </div>
                  </>
                ) : selectedBooking.status === 'reschedule_payment_pending' ? (
                  <>
                    {/* Reschedule fee payment — awaiting proof from passenger */}
                    <div style={{ background: '#fff8e1', border: '2px solid #ffd54f', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>💳</span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#cc8800', fontSize: 14 }}>Awaiting Reschedule Fee Payment</div>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                            Passenger has been notified to pay the reschedule fee before this change is confirmed.
                          </div>
                        </div>
                      </div>
                      {selectedBooking.previousFlightNumber && (
                        <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                          📋 Previous: <strong>{selectedBooking.previousFlightNumber}</strong>
                          {selectedBooking.previousDeparture && ` · ${new Date(selectedBooking.previousDeparture).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
                          {' '}→ New: <strong>{selectedBooking.flight?.flightNumber}</strong>
                        </div>
                      )}
                    </div>

                    {selectedBooking.rescheduleFeeBreakdown && (() => {
                      const fee = selectedBooking.rescheduleFeeBreakdown;
                      return (
                        <div style={{ background: '#fff8f0', border: '1.5px solid #ffaa66', borderRadius: 12, padding: '14px 18px', margin: '12px 0' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#cc5500', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>💰 Fee Due from Passenger</div>
                          <table width="100%" style={{ fontSize: 13 }}>
                            <tbody>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>Original Price / pax</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₱{(fee.pricePerPax||0).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>New Price / pax</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₱{(fee.newPricePerPax||0).toLocaleString()}</td></tr>
                              <tr><td style={{ color: '#555', padding: '4px 0' }}>Passengers</td><td style={{ textAlign: 'right', fontWeight: 700 }}>× {fee.passengerCount}</td></tr>
                              {(fee.totalFareDiff||0) > 0 && <tr><td style={{ color: '#003399', padding: '4px 0', fontWeight: 700 }}>Fare Difference</td><td style={{ textAlign: 'right', color: '#003399', fontWeight: 700 }}>₱{(fee.totalFareDiff||0).toLocaleString()}</td></tr>}
                              <tr><td style={{ color: '#cc5500', padding: '4px 0', fontWeight: 700 }}>Reschedule Fee ({fee.feePercent}%)</td><td style={{ textAlign: 'right', color: '#cc5500', fontWeight: 700 }}>₱{(fee.totalRescheduleFee||0).toLocaleString()}</td></tr>
                              <tr style={{ borderTop: '2px solid #ffaa66' }}><td style={{ fontWeight: 800, fontSize: 14, padding: '8px 0 2px' }}>Total Payment Required (incl. VAT)</td><td style={{ textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#cc5500' }}>₱{(fee.totalPayment||0).toLocaleString()}</td></tr>
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 8 }}>Policy: {fee.ruleLabel}</div>
                        </div>
                      );
                    })()}

                    <div style={{ background: '#f8faff', border: '1px solid #dde4ff', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#666' }}>
                      ⏳ Waiting for passenger to upload GCash payment proof. Once submitted, status will change to "Reschedule Requested" for final approval.
                    </div>

                    <div style={styles.modalActions}>
                      <button onClick={() => handleApproveReschedule(selectedBooking.bookingId)}
                        style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700, background: '#003399', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                        ✅ Approve Without Payment
                      </button>
                      <button onClick={() => setSelectedBooking(null)}
                        style={{ flex: 1, padding: '14px', fontSize: 14, fontWeight: 700, background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', borderRadius: 10, cursor: 'pointer' }}>
                        Close
                      </button>
                    </div>
                  </>
                ) : selectedBooking.status === 'confirmed' ? (
                  <>
                    {/* Confirmed booking — resend email + ticket link */}
                    <div style={styles.confirmedBox}>
                      <div style={styles.confirmedHeader}>
                        <span style={{ fontSize: 28 }}>✅</span>
                        <div>
                          <div style={styles.confirmedLabel}>Booking Confirmed</div>
                          {selectedBooking.confirmedAt && (
                            <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                              Approved on {new Date(selectedBooking.confirmedAt).toLocaleDateString('en-PH', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={styles.resendBox}>
                      <div style={styles.resendTitle}>📧 Resend Confirmation Email</div>
                      <p style={styles.resendDesc}>
                        Use this if the passenger did not receive their ticket email, or if it was lost or deleted.
                        This resends the original confirmation with the same QR codes — no booking data is changed.
                      </p>
                      <button
                        onClick={() => handleResendEmail(selectedBooking.bookingId)}
                        disabled={resending}
                        style={styles.resendBtn}
                      >
                        {resending ? '⏳ Sending…' : '📨 Resend Email to Passenger'}
                      </button>
                    </div>

                    <div style={styles.modalActions}>
                      <button
                        onClick={() => navigate(`/ticket/${selectedBooking.bookingId}`)}
                        style={{ flex: 1, padding: '13px', fontSize: 14, fontWeight: 700, background: '#003399', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
                      >
                        🖨️ View / Print Ticket
                      </button>
                      <button
                        onClick={() => setSelectedBooking(null)}
                        style={{ flex: 1, padding: '13px', fontSize: 14, fontWeight: 700, background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', borderRadius: 10, cursor: 'pointer' }}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <> 
                    {(selectedBooking.paymentProofData || selectedBooking.paymentProofURL) && (
                      <div style={styles.proofSection}>
                        <div style={styles.proofLabel}>Payment Proof Screenshot:</div>
                        <img
                          src={
                            selectedBooking.paymentProofData ||
                            (selectedBooking.paymentProofURL?.startsWith('http')
                              ? selectedBooking.paymentProofURL
                              : `${serverBase}${selectedBooking.paymentProofURL}`)
                          }
                          alt="Payment Proof"
                          style={styles.proofImage}
                          onClick={() => window.open(
                            selectedBooking.paymentProofData ||
                            (selectedBooking.paymentProofURL?.startsWith('http')
                              ? selectedBooking.paymentProofURL
                              : `${serverBase}${selectedBooking.paymentProofURL}`),
                            '_blank'
                          )}
                        />
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                          Click image to open full size
                        </div>
                      </div>
                    )}
                    <div style={styles.rejectSection}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8, display: 'block' }}>
                        Rejection Reason (required if rejecting):
                      </label>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                        <button key="Payment screenshot is unclear" type="button"
                          onClick={() => setRejectReason("Payment screenshot is unclear")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Payment screenshot is unclear" ? styles.quickPickBtnActive : {}) }}>
                          Payment screenshot is unclear
                        </button>
                        <button key="Wrong amount sent" type="button"
                          onClick={() => setRejectReason("Wrong amount sent")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Wrong amount sent" ? styles.quickPickBtnActive : {}) }}>
                          Wrong amount sent
                        </button>
                        <button key="Payment not received" type="button"
                          onClick={() => setRejectReason("Payment not received")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Payment not received" ? styles.quickPickBtnActive : {}) }}>
                          Payment not received
                        </button>
                        <button key="Screenshot appears edited" type="button"
                          onClick={() => setRejectReason("Screenshot appears edited")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Screenshot appears edited" ? styles.quickPickBtnActive : {}) }}>
                          Screenshot appears edited
                        </button>
                        <button key="Wrong GCash reference" type="button"
                          onClick={() => setRejectReason("Wrong GCash reference")}
                          style={{ ...styles.quickPickBtn, ...(rejectReason==="Wrong GCash reference" ? styles.quickPickBtnActive : {}) }}>
                          Wrong GCash reference
                        </button>
                      </div>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Or type a custom reason…"
                        style={{ ...styles.textarea, marginTop:0 }}
                        rows={2}
                      />
                    </div>
                    <div style={styles.modalActions}>
                      <button className="btn-success" onClick={() => handleApprove(selectedBooking.bookingId)} style={{ flex: 1, padding: '14px', fontSize: 15 }}>
                        ✅ Approve & Send Email
                      </button>
                      <button className="btn-danger" onClick={() => handleReject(selectedBooking.bookingId)} style={{ flex: 1, padding: '14px', fontSize: 15 }}>
                        ❌ Reject Booking
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom confirm dialog — no localhost:3000 says */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          confirmColor={confirmModal.confirmColor}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}
    </div>
  );
};

const scopeBanner = {
  marginTop: 8,
  marginBottom: 4,
  padding: '7px 14px',
  background: '#e8eeff',
  color: '#003399',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #c0ccff',
  display: 'inline-block',
};

const styles = {
  header: { marginBottom: 28 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399', marginBottom: 20 },
  filterTabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '8px 16px',
    borderRadius: 20,
    border: '2px solid #dde4ff',
    background: 'white',
    color: '#666',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#003399',
    color: 'white',
    borderColor: '#003399',
  },
  refNum: { fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#003399', fontSize: 13, letterSpacing: 0.5 },
  passengerName: { fontWeight: 600, color: '#1a1a2e', fontSize: 14 },
  passengerEmail: { color: '#888', fontSize: 12 },
  flightNum: { fontWeight: 700, color: '#003399', fontSize: 13 },
  route: { color: '#888', fontSize: 12 },
  actionBtns: { display: 'flex', gap: 6 },
  reviewBtn: {
    background: '#ff9900',
    color: 'white',
    border: 'none',
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  printBtn: {
    background: '#003399',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 740,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 80px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 28px',
    borderBottom: '1px solid #eef0ff',
  },
  modalTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 800, color: '#003399' },
  closeBtn: {
    background: '#f0f0f0',
    border: 'none',
    width: 32,
    height: 32,
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 16,
    color: '#666',
  },
  modalBody: { padding: 28 },
  modalInfo: { background: '#f8faff', borderRadius: 10, padding: 18, marginBottom: 20 },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    padding: '8px 0',
    borderBottom: '1px solid #eef0ff',
    color: '#555',
    alignItems: 'center',
  },
  legBox: (color) => ({
    background: `${color}08`,
    border: `1.5px solid ${color}33`,
    borderRadius: 8,
    padding: '8px 12px',
  }),
  legBoxLabel: { fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  legBoxRoute: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 },
  proofSection: { marginBottom: 20 },
  proofLabel: { fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 10 },
  proofImage: { width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid #dde4ff' },
  rejectSection: { marginBottom: 20 },
  quickPickBtn: {
    padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1.5px solid #dde4ff', borderRadius: 20, background: '#f8faff',
    color: '#555', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
  },
  quickPickBtnActive: {
    background: '#003399', color: 'white', borderColor: '#003399',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '2px solid #dde4ff',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    resize: 'vertical',
  },
  viewBtn: {
    background: '#f0f4ff',
    color: '#003399',
    border: '1.5px solid #99aadd',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancellationBox: {
    background: '#fff5f5',
    border: '2px solid #ffcccc',
    borderRadius: 12,
    padding: '20px',
    marginBottom: 20,
  },
  cancellationHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14,
  },
  cancellationIcon: { fontSize: 28, flexShrink: 0 },
  cancellationLabel: { fontSize: 13, fontWeight: 800, color: '#cc2222', textTransform: 'uppercase', letterSpacing: 0.5 },
  cancelledAt: { fontSize: 12, color: '#888', marginTop: 4 },
  cancellationReason: {
    fontSize: 15, color: '#333', fontStyle: 'italic',
    background: 'white', borderRadius: 8, padding: '12px 16px',
    border: '1px solid #ffcccc', lineHeight: 1.6,
  },

  // Confirmed booking
  confirmedBox: {
    background: '#f0fff8',
    border: '2px solid #00cc66',
    borderRadius: 12,
    padding: '18px 20px',
    marginBottom: 16,
  },
  confirmedHeader: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  confirmedLabel: { fontSize: 15, fontWeight: 800, color: '#007744' },

  // Resend email
  resendBox: {
    background: '#fffbf0',
    border: '2px solid #ffcc44',
    borderRadius: 12,
    padding: '18px 20px',
    marginBottom: 20,
  },
  resendTitle: { fontWeight: 800, fontSize: 14, color: '#996600', marginBottom: 8 },
  resendDesc: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 },
  resendBtn: {
    padding: '11px 22px',
    fontSize: 14,
    fontWeight: 700,
    background: '#ff9900',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },

  // Passenger manifest
  manifestTitle: {
    fontSize: 11, fontWeight: 800, color: '#003399',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 8,
  },
  manifestTable: {
    border: '1.5px solid #dde4ff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  manifestHeader: {
    display: 'flex', gap: 0,
    background: 'linear-gradient(90deg, #003399, #0055cc)',
    padding: '8px 14px',
  },
  mhNum:   { width: 28, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  mhName:  { flex: 1, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  mhSeat:  { width: 70, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', flexShrink: 0 },
  mhEmail: { width: 180, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  manifestRow: {
    display: 'flex', alignItems: 'center', gap: 0,
    padding: '10px 14px', borderBottom: '1px solid #eef0ff',
  },
  manifestNum: {
    width: 28, height: 22, borderRadius: '50%',
    background: '#003399', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 11, flexShrink: 0,
  },
  manifestName: { flex: 1, paddingRight: 12 },
  manifestSeat: { width: 70, textAlign: 'center', flexShrink: 0 },
  manifestEmail: { width: 180, fontSize: 12, color: '#888', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

export default AdminBookings;
