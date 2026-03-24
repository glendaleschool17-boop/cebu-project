import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import { calcVAT } from '../utils/vatCalculator';

const ReviewBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state;
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    document.title = 'Review Booking – Cebu Airline';
    if (!state?.flight) {
      toast.error('No booking data found. Please start over.');
      navigate('/search');
    }
  }, []);

  if (!state?.flight) return null;

  const {
    flightId, flight, returnFlightId, returnFlight,
    passengers, selectedSeats, selectedReturnSeats, seatClass, returnSeatClass, passengerCount,
    tripType, baseFare, returnFare, classFare, returnClassFare,
    surcharge, returnSurcharge, totalFare, isRoundTrip,
  } = state;

  const effectiveReturnSeatClass = returnSeatClass || seatClass;

  const fmt = (dt) => new Date(dt).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const vat = calcVAT(totalFare, passengerCount);
  const grandTotal = vat.grandTotal;
  const vatAmount  = vat.vatAmount;

  const handleConfirm = async () => {
    setBooking(true);
    try {
      const passengerList = passengers.map((p, i) => ({
        name: p.name.trim(),
        email: p.email.trim(),
        phone: p.phone?.trim() || '',
        seat: selectedSeats[i],
        returnSeat: isRoundTrip ? (selectedReturnSeats?.[i] || null) : undefined,
        seatClass,
        ...(isRoundTrip ? { returnSeatClass: effectiveReturnSeatClass } : {}),
      }));

      const result = await api.post('/bookings', {
        flightId,
        seatNumbers: selectedSeats,
        seatNumber: selectedSeats[0],
        seatClass,
        returnSeatClass: isRoundTrip ? effectiveReturnSeatClass : undefined,
        price: totalFare,
        passengerCount,
        passengers: passengerList,
        passengerName: passengerList[0].name,
        passengerEmail: passengerList[0].email,
        passengerPhone: passengerList[0].phone,
        tripType,
        ...(isRoundTrip && {
          returnFlightId,
          returnSeatNumbers: selectedReturnSeats || [],
          outboundPrice: classFare * passengerCount,
          returnPrice: returnClassFare * passengerCount,
        }),
      });
      navigate(`/payment/${result.bookingId}`);
    } catch (err) {
      toast.error(err.message || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const Row = ({ label, value, highlight }) => (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowValue, ...(highlight ? { color: '#ff6600', fontWeight: 900, fontSize: 16 } : {}) }}>{value}</span>
    </div>
  );

  const FlightSummary = ({ f, label, fare, extra, legClass }) => (
    <div style={S.flightBox}>
      <div style={S.flightBoxLabel}>{label}</div>
      <div style={S.flightRoute}>{f.origin} <span style={S.arrow}>→</span> {f.destination}</div>
      <div style={S.flightMeta}>
        <span>✈️ {f.flightNumber}</span>
        <span>📅 {fmt(f.departureTime)}</span>
        {f.arrivalTime && <span>🏁 {fmt(f.arrivalTime)}</span>}
        {legClass && <span style={{ fontWeight: 700, color: legClass === 'business' ? '#b8860b' : '#003399' }}>{legClass === 'business' ? '👑 Business' : '✈️ Economy'}</span>}
      </div>
      <div style={S.flightFare}>
        ₱{fare?.toLocaleString()} / pax
        {extra > 0 && <span style={S.surcharge}> (+₱{extra?.toLocaleString()} {legClass} surcharge)</span>}
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div className="container" style={{ maxWidth: 760 }}>

        {/* Header */}
        <div style={S.header}>
          <button onClick={() => navigate(-1)} style={S.backBtn}>← Edit Booking</button>
          <div>
            <h1 style={S.title}>Review Your Booking</h1>
            <p style={S.sub}>Please confirm all details before proceeding to payment.</p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={S.steps}>
          {['Select Flight', 'Passenger & Seat', 'Review & Confirm', 'Payment'].map((s, i) => (
            <div key={s} style={S.stepItem}>
              <div style={{ ...S.stepCircle, ...(i === 2 ? S.stepActive : i < 2 ? S.stepDone : {}) }}>
                {i < 2 ? '✓' : i + 1}
              </div>
              <span style={{ ...S.stepLabel, ...(i === 2 ? { color: '#003399', fontWeight: 700 } : {}) }}>{s}</span>
              {i < 3 && <div style={S.stepLine} />}
            </div>
          ))}
        </div>

        {/* Trip Type Badge */}
        <div style={S.tripBadge}>
          {isRoundTrip ? '🔄 Round Trip' : '➡️ One Way'} · {passengerCount} Passenger{passengerCount > 1 ? 's' : ''}
          {isRoundTrip && effectiveReturnSeatClass !== seatClass
            ? ` · Out: ${seatClass === 'business' ? '👑 Business' : '✈️ Economy'} / Ret: ${effectiveReturnSeatClass === 'business' ? '👑 Business' : '✈️ Economy'}`
            : ` · ${seatClass === 'business' ? '👑 Business' : '✈️ Economy'}`}
        </div>

        {/* Flight Details */}
        <div style={S.card}>
          <div style={S.cardTitle}>✈️ Flight Details</div>
          <FlightSummary f={flight} label="Outbound" fare={classFare} extra={surcharge} legClass={seatClass} />
          {isRoundTrip && returnFlight && (
            <FlightSummary f={returnFlight} label="Return" fare={returnClassFare} extra={returnSurcharge} legClass={effectiveReturnSeatClass} />
          )}
        </div>

        {/* Passenger Details */}
        <div style={S.card}>
          <div style={S.cardTitle}>👤 Passenger Details</div>
          {passengers.slice(0, passengerCount).map((p, i) => (
            <div key={i} style={S.passengerBlock}>
              <div style={S.passengerHeader}>
                Passenger {i + 1}
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={S.seatBadge}>
                    {isRoundTrip ? '✈️ Out: ' : 'Seat: '}<strong>{selectedSeats[i] || '—'}</strong>
                  </span>
                  {isRoundTrip && (
                    <span style={{ ...S.seatBadge, background: '#e8f5e9', color: '#005533', border: '1.5px solid #00aa55' }}>
                      🔄 Ret: <strong>{(selectedReturnSeats || [])[i] || '—'}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div style={S.passengerGrid}>
                <Row label="Full Name" value={p.name || '—'} />
                <Row label="Email" value={p.email || '—'} />
                {p.phone && <Row label="Phone" value={p.phone} />}
              </div>
            </div>
          ))}
        </div>

        {/* Price Breakdown */}
        <div style={S.card}>
          <div style={S.cardTitle}>💰 Price Breakdown</div>

          {isRoundTrip ? (
            <>
              <Row label={`Outbound Fare — ${seatClass === 'business' ? '👑 Business' : '✈️ Economy'} (${passengerCount} pax × ₱${classFare?.toLocaleString()})`} value={`₱${(classFare * passengerCount).toLocaleString()}`} />
              {surcharge > 0 && <Row label="  · Business surcharge incl." value="" />}
              <Row label={`Return Fare — ${effectiveReturnSeatClass === 'business' ? '👑 Business' : '✈️ Economy'} (${passengerCount} pax × ₱${returnClassFare?.toLocaleString()})`} value={`₱${(returnClassFare * passengerCount).toLocaleString()}`} />
              {returnSurcharge > 0 && <Row label="  · Business surcharge incl." value="" />}
            </>
          ) : (
            <>
              <Row label={`Base Fare (${passengerCount} pax × ₱${baseFare?.toLocaleString()})`} value={`₱${(baseFare * passengerCount).toLocaleString()}`} />
              {surcharge > 0 && <Row label="Business class surcharge" value={`+₱${(surcharge * passengerCount).toLocaleString()}`} />}
            </>
          )}

          <div style={S.divider} />
          <Row label="Subtotal (excl. VAT)" value={`₱${totalFare?.toLocaleString()}`} />
          <Row label="VAT (12%)" value={`+₱${vatAmount.toLocaleString()}`} />
          <div style={{ ...S.divider, background: '#003399', height: 2, margin: '8px 0' }} />
          <div style={S.grandTotalRow}>
            <span style={S.grandTotalLabel}>Grand Total (incl. VAT)</span>
            <span style={S.grandTotalValue}>₱{grandTotal.toLocaleString()}</span>
          </div>
          <div style={S.vatNote}>
            Philippines VAT (EVAT) at 12% per NIRC. This serves as your official VAT receipt.
          </div>
        </div>

        {/* Payment note */}
        <div style={S.paymentNote}>
          <span style={{ fontSize: 20 }}>💳</span>
          <div>
            <strong>Payment via GCash</strong>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
              After confirming, you'll upload your GCash payment screenshot. Your booking will be confirmed once an admin approves it.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={S.actions}>
          <button onClick={() => navigate(-1)} style={S.editBtn} disabled={booking}>
            ← Edit Details
          </button>
          <button
            onClick={handleConfirm}
            style={{ ...S.confirmBtn, opacity: booking ? 0.7 : 1 }}
            disabled={booking}
          >
            {booking ? '⏳ Creating Booking…' : `✅ Confirm & Proceed to Payment → ₱${grandTotal.toLocaleString()}`}
          </button>
        </div>

      </div>
    </div>
  );
};

const S = {
  page: { padding: '32px 0 60px', minHeight: '80vh', background: '#f4f7ff' },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  backBtn: {
    background: 'white', color: '#003399', border: '2px solid #dde4ff',
    borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0, marginTop: 4,
  },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 26, fontWeight: 800, color: '#003399', margin: '0 0 4px' },
  sub: { color: '#666', fontSize: 14, margin: 0 },

  steps: { display: 'flex', alignItems: 'center', background: 'white', borderRadius: 14, padding: '14px 20px', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,51,153,0.06)', flexWrap: 'wrap', gap: 4 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120 },
  stepCircle: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: '#eef0ff', color: '#888', flexShrink: 0 },
  stepActive: { background: '#003399', color: 'white' },
  stepDone: { background: '#007744', color: 'white' },
  stepLabel: { fontSize: 12, color: '#888', fontWeight: 600 },
  stepLine: { flex: 1, height: 2, background: '#eef0ff', minWidth: 16 },

  tripBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, #001f66, #003399)', color: 'white',
    borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700,
    marginBottom: 20,
  },

  card: { background: 'white', borderRadius: 16, padding: '24px 28px', marginBottom: 16, boxShadow: '0 4px 20px rgba(0,51,153,0.07)', border: '1px solid #dde4ff' },
  cardTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 15, fontWeight: 800, color: '#003399', marginBottom: 18, textTransform: 'uppercase', letterSpacing: 0.5 },

  flightBox: { background: '#f4f7ff', borderRadius: 12, padding: '16px 20px', marginBottom: 12, border: '1px solid #dde4ff' },
  flightBoxLabel: { fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  flightRoute: { fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 900, color: '#1a1a2e', marginBottom: 8 },
  arrow: { color: '#003399', margin: '0 8px' },
  flightMeta: { display: 'flex', gap: 16, fontSize: 13, color: '#555', flexWrap: 'wrap', marginBottom: 8 },
  flightFare: { fontSize: 14, fontWeight: 700, color: '#007744' },
  surcharge: { fontWeight: 600, color: '#cc5500', fontSize: 13 },

  passengerBlock: { borderBottom: '1px solid #eef0ff', paddingBottom: 16, marginBottom: 16 },
  passengerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  seatBadge: { background: '#e8eeff', color: '#003399', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 },
  passengerGrid: { display: 'flex', flexDirection: 'column', gap: 0 },

  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f0f2ff' },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: { fontSize: 14, fontWeight: 700, color: '#1a1a2e' },
  divider: { height: 2, background: '#eef0ff', margin: '12px 0' },
  grandTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 4px' },
  grandTotalLabel: { fontSize: 15, fontWeight: 800, color: '#1a1a2e' },
  grandTotalValue: { fontSize: 26, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' },
  vatNote: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 6, lineHeight: 1.4 },

  paymentNote: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: '#fff8e1', border: '2px solid #ffd54f',
    borderRadius: 12, padding: '16px 20px', marginBottom: 24,
  },

  actions: { display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' },
  editBtn: {
    background: 'white', color: '#003399', border: '2px solid #dde4ff',
    borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', flex: '0 0 auto',
  },
  confirmBtn: {
    background: 'linear-gradient(135deg, #003399, #0055cc)',
    color: 'white', border: 'none', borderRadius: 12,
    padding: '14px 28px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', flex: 1,
  },
};

export default ReviewBookingPage;
