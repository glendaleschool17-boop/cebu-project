import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import { calcVAT } from '../utils/vatCalculator';

const PaymentSuccess = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Booking Confirmed – Cebu Airline';
    const fetchBooking = async () => {
      try {
        const data = await api.get(`/bookings/${bookingId}`);
        setBooking(data);
      } catch {
        toast.error('Could not load booking details');
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const formatDate = (dt) => new Date(dt).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const formatTime = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="container"><div className="spinner" /></div>;

  const isReschedule = booking?.status === 'reschedule_requested';
  const wasReschedulePmt = booking?.reschedulePaymentProofURL != null || isReschedule;

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Animated success icon */}
        <div style={styles.iconWrap}>
          <div style={styles.iconCircle}>
            <svg viewBox="0 0 52 52" style={styles.checkSvg}>
              <circle cx="26" cy="26" r="25" fill="none" stroke="#00aa55" strokeWidth="2" style={styles.checkCircle} />
              <path fill="none" stroke="#00aa55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                d="M14 27l8 8 16-16" style={styles.checkMark} />
            </svg>
          </div>
        </div>

        <h1 style={styles.title}>
          {wasReschedulePmt ? 'Reschedule Fee Submitted!' : 'Payment Submitted!'}
        </h1>
        <p style={styles.subtitle}>
          {wasReschedulePmt
            ? 'Your reschedule fee payment has been uploaded and is awaiting admin verification. Your new flight will be confirmed once reviewed.'
            : 'Your payment proof has been successfully uploaded and is now awaiting admin verification. You\'ll receive a confirmation email once your booking is approved.'}
        </p>

        {/* Status timeline */}
        <div style={styles.timeline}>
          <div style={styles.timelineItem}>
            <div style={{ ...styles.timelineDot, background: '#00aa55' }}>✓</div>
            <div style={styles.timelineContent}>
              <div style={styles.timelineTitle}>
                {wasReschedulePmt ? 'Reschedule Fee Paid' : 'Payment Proof Submitted'}
              </div>
              <div style={styles.timelineSub}>
                {wasReschedulePmt ? 'GCash screenshot received' : 'Your GCash screenshot has been received'}
              </div>
            </div>
          </div>
          <div style={styles.timelineLine} />
          <div style={styles.timelineItem}>
            <div style={{ ...styles.timelineDot, background: '#ffa000', animation: 'pulse 1.5s infinite' }}>⏳</div>
            <div style={styles.timelineContent}>
              <div style={styles.timelineTitle}>Admin Review</div>
              <div style={styles.timelineSub}>
                {wasReschedulePmt ? 'Payment is being verified (1–24 hours)' : 'Payment is being verified (1–24 hours)'}
              </div>
            </div>
          </div>
          <div style={styles.timelineLine} />
          <div style={styles.timelineItem}>
            <div style={{ ...styles.timelineDot, background: '#dde4ff', color: '#99aadd' }}>○</div>
            <div style={styles.timelineContent}>
              <div style={{ ...styles.timelineTitle, color: '#aaa' }}>
                {wasReschedulePmt ? 'Reschedule Confirmed' : 'Booking Confirmed'}
              </div>
              <div style={styles.timelineSub}>
                {wasReschedulePmt ? 'New boarding pass QR will be sent' : 'Email + QR boarding pass will be sent'}
              </div>
            </div>
          </div>
        </div>

        {/* Booking details card */}
        {booking && (
          <div style={styles.detailsCard}>
            <div style={styles.detailsHeader}>
              <div>
                <div style={styles.detailsLabel}>Booking Reference</div>
                <div style={styles.detailsRef}>{booking.bookingId}</div>
              </div>
              <div style={styles.statusChip}>📤 Under Review</div>
            </div>

            {booking.flight && (
              <div style={styles.flightRow}>
                <div style={styles.flightPoint}>
                  <div style={styles.flightCode}>{booking.flight.origin}</div>
                  <div style={styles.flightCity}>{booking.flight.originCity}</div>
                  <div style={styles.flightTime}>{formatTime(booking.flight.departureTime)}</div>
                </div>
                <div style={styles.flightMiddle}>
                  <div style={styles.flightNum}>{booking.flight.flightNumber}</div>
                  <div style={styles.flightLine}>✈</div>
                  <div style={styles.flightDate}>{formatDate(booking.flight.departureTime)}</div>
                </div>
                <div style={styles.flightPoint}>
                  <div style={styles.flightCode}>{booking.flight.destination}</div>
                  <div style={styles.flightCity}>{booking.flight.destinationCity}</div>
                  <div style={styles.flightTime}>{formatTime(booking.flight.arrivalTime)}</div>
                </div>
              </div>
            )}

            {/* Return flight row */}
            {booking.tripType === 'roundtrip' && booking.returnFlight && (
              <div style={{ ...styles.flightRow, borderTop: '1px dashed #dde4ff', paddingTop: 16, marginTop: 4 }}>
                <div style={styles.flightPoint}>
                  <div style={styles.flightCode}>{booking.returnFlight.origin}</div>
                  <div style={styles.flightCity}>{booking.returnFlight.originCity}</div>
                  <div style={styles.flightTime}>{formatTime(booking.returnFlight.departureTime)}</div>
                </div>
                <div style={styles.flightMiddle}>
                  <div style={{ ...styles.flightNum, color: '#007744' }}>{booking.returnFlight.flightNumber}</div>
                  <div style={{ ...styles.flightLine, color: '#007744' }}>🔄</div>
                  <div style={styles.flightDate}>{formatDate(booking.returnFlight.departureTime)}</div>
                </div>
                <div style={styles.flightPoint}>
                  <div style={styles.flightCode}>{booking.returnFlight.destination}</div>
                  <div style={styles.flightCity}>{booking.returnFlight.destinationCity}</div>
                  <div style={styles.flightTime}>{formatTime(booking.returnFlight.arrivalTime)}</div>
                </div>
              </div>
            )}

            <div style={styles.detailsGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailItemLabel}>Passenger</div>
                <div style={styles.detailItemVal}>{booking.passengerName}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailItemLabel}>Seat</div>
                <div style={styles.detailItemVal}>
                  {booking.seatNumber}
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
                    background: booking.seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                    color: booking.seatClass === 'business' ? '#b8860b' : '#003399',
                  }}>
                    {booking.seatClass === 'business' ? '👑 Business' : '✈️ Economy'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailItemLabel}>Trip Type</div>
                <div style={styles.detailItemVal}>
                  {booking.tripType === 'roundtrip' ? '🔄 Round Trip' : '➡️ One Way'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailItemLabel}>Passengers</div>
                <div style={styles.detailItemVal}>{booking.passengerCount || 1}</div>
              </div>
            </div>

            {/* VAT-inclusive amount breakdown */}
            {(() => {
              const pax = booking.passengerCount || 1;
              const vat = calcVAT(booking.price || 0, pax);
              const grandTotal = booking.grandTotal || vat.grandTotal;
              const vatAmount  = booking.vatAmount  || vat.vatAmount;
              const subtotal   = booking.price || 0;
              return (
                <div style={styles.amountBreakdown}>
                  <div style={styles.amountRow}>
                    <span style={styles.amountLabel}>Subtotal (excl. VAT)</span>
                    <span style={styles.amountVal}>₱{subtotal.toLocaleString()}</span>
                  </div>
                  <div style={styles.amountRow}>
                    <span style={styles.amountLabel}>VAT (12%)</span>
                    <span style={styles.amountVal}>+₱{vatAmount.toLocaleString()}</span>
                  </div>
                  <div style={styles.amountTotal}>
                    <span style={styles.amountTotalLabel}>Total Amount (incl. VAT)</span>
                    <span style={styles.amountTotalVal}>₱{grandTotal.toLocaleString()}</span>
                  </div>
                  <div style={styles.amountNote}>
                    Philippines VAT (EVAT) at 12% per NIRC. This serves as your official VAT receipt.
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Info box */}
        <div style={styles.infoBox}>
          <div style={styles.infoIcon}>📧</div>
          <div>
            <div style={styles.infoTitle}>What happens next?</div>
            <div style={styles.infoText}>
              {wasReschedulePmt
                ? <>Our admin team will verify your reschedule fee payment within <strong>1–24 hours</strong>. Once approved, your new flight will be confirmed and an updated ticket with a new <strong>QR boarding pass</strong> will be sent to <strong>{booking?.passengerEmail}</strong>.</>
                : <>Our admin team will verify your GCash payment within <strong>1–24 hours</strong>. Once approved, a confirmation email with your <strong>QR boarding pass</strong> will be sent to <strong>{booking?.passengerEmail}</strong>. You can also check the status anytime in My Bookings.</>
              }
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={() => navigate('/my-bookings')}
            style={styles.primaryBtn}
          >
            🎫 View My Bookings
          </button>
          <button
            onClick={() => navigate('/search')}
            style={styles.secondaryBtn}
          >
            ✈️ Book Another Flight
          </button>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes popIn { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes drawCheck {
          0%{stroke-dashoffset:100}
          100%{stroke-dashoffset:0}
        }
        @keyframes drawCircle {
          0%{stroke-dashoffset:160}
          100%{stroke-dashoffset:0}
        }
      `}</style>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '80vh', padding: '48px 24px 80px',
    background: 'linear-gradient(160deg, #f0f4ff 0%, #e8f5e9 100%)',
  },
  container: { maxWidth: 640, margin: '0 auto' },

  // Success icon
  iconWrap: { textAlign: 'center', marginBottom: 24 },
  iconCircle: {
    width: 96, height: 96, margin: '0 auto',
    animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
  },
  checkSvg: { width: 96, height: 96 },
  checkCircle: {
    strokeDasharray: 160, strokeDashoffset: 160,
    animation: 'drawCircle 0.6s ease forwards',
  },
  checkMark: {
    strokeDasharray: 100, strokeDashoffset: 100,
    animation: 'drawCheck 0.5s 0.4s ease forwards',
  },

  title: {
    fontFamily: 'Montserrat, sans-serif', fontSize: 30, fontWeight: 900,
    color: '#00aa55', textAlign: 'center', marginBottom: 12,
  },
  subtitle: {
    color: '#555', fontSize: 15, textAlign: 'center', lineHeight: 1.7,
    marginBottom: 32, maxWidth: 520, margin: '0 auto 32px',
  },

  // Timeline
  timeline: {
    background: 'white', borderRadius: 16, padding: '24px 28px',
    marginBottom: 24, border: '1px solid #dde4ff',
    boxShadow: '0 4px 20px rgba(0,51,153,0.07)',
  },
  timelineItem: { display: 'flex', alignItems: 'flex-start', gap: 16 },
  timelineDot: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 900, fontSize: 14, flexShrink: 0,
  },
  timelineLine: {
    width: 2, height: 24, background: '#dde4ff',
    margin: '4px 0 4px 17px',
  },
  timelineContent: { flex: 1, paddingTop: 6 },
  timelineTitle: { fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 3 },
  timelineSub: { fontSize: 12, color: '#888' },

  // Details card
  detailsCard: {
    background: 'white', borderRadius: 20,
    border: '1px solid #dde4ff', marginBottom: 24,
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,51,153,0.08)',
  },
  detailsHeader: {
    background: 'linear-gradient(135deg, #001f66, #003399)',
    padding: '20px 28px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  detailsLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  detailsRef: { color: 'white', fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: 2 },
  statusChip: {
    background: 'rgba(255,255,255,0.15)', color: 'white',
    fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
    border: '1.5px solid rgba(255,255,255,0.3)',
  },

  flightRow: { display: 'flex', alignItems: 'center', padding: '20px 28px', gap: 16 },
  flightPoint: { textAlign: 'center', flex: 1 },
  flightCode: { fontSize: 26, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif' },
  flightCity: { fontSize: 11, color: '#888', marginTop: 2 },
  flightTime: { fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginTop: 4 },
  flightMiddle: { textAlign: 'center', flex: 1 },
  flightNum: { fontSize: 12, fontWeight: 700, color: '#003399', marginBottom: 4 },
  flightLine: { fontSize: 18, color: '#003399' },
  flightDate: { fontSize: 11, color: '#888', marginTop: 4 },

  detailsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
    borderTop: '1px solid #f0f4ff', background: '#f0f4ff',
  },
  detailItem: { background: 'white', padding: '14px 24px' },
  detailItemLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, fontWeight: 700 },
  detailItemVal: { fontSize: 15, fontWeight: 700, color: '#1a1a2e' },

  amountBreakdown: {
    margin: '0 0 0', padding: '16px 28px 20px',
    borderTop: '1px solid #f0f4ff', background: '#fafbff',
  },
  amountRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eef0ff' },
  amountLabel: { fontSize: 13, color: '#666' },
  amountVal:   { fontSize: 13, fontWeight: 700, color: '#1a1a2e' },
  amountTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 4, borderTop: '2px solid #003399' },
  amountTotalLabel: { fontSize: 14, fontWeight: 800, color: '#1a1a2e' },
  amountTotalVal:   { fontSize: 24, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' },
  amountNote: { fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 8, lineHeight: 1.4 },

  // Info box
  infoBox: {
    background: '#e8f5e9', border: '1.5px solid #00aa55',
    borderRadius: 14, padding: '18px 20px', marginBottom: 28,
    display: 'flex', gap: 14, alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 28, flexShrink: 0 },
  infoTitle: { fontWeight: 800, color: '#006633', fontSize: 14, marginBottom: 6 },
  infoText: { fontSize: 13, color: '#444', lineHeight: 1.6 },

  // Action buttons
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  primaryBtn: {
    flex: 1, padding: '14px 24px', fontSize: 15, fontWeight: 700,
    background: 'linear-gradient(135deg, #003399, #0055cc)',
    color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
    minWidth: 200,
  },
  secondaryBtn: {
    flex: 1, padding: '14px 24px', fontSize: 15, fontWeight: 700,
    background: 'white', color: '#003399',
    border: '2px solid #dde4ff', borderRadius: 12, cursor: 'pointer',
    minWidth: 200,
  },
};

export default PaymentSuccess;
