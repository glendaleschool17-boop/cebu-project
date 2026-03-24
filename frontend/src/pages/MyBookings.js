import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { calcCancellationFee, calcRescheduleFee } from '../utils/feeCalculator';
import StatusBadge from '../components/StatusBadge';
import SeatSelector, { getSeatClass } from '../components/SeatSelector';
import { toast } from 'react-toastify';

// ── Rebook Modal — full flight picker + seat selector ─────────────────────────
const RebookModal = ({ booking, onClose, onSuccess, affectedLeg }) => {
  // affectedLeg: 'outbound' | 'return' | undefined (for one-way)
  const STEPS = { FLIGHT: 'flight', SEATS: 'seats', CONFIRM: 'confirm' };
  const [step, setStep]             = useState(STEPS.FLIGHT);
  const [flights, setFlights]       = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [chosenFlight, setChosenFlight]     = useState(null);
  const [selectedSeats, setSelectedSeats]   = useState([]);
  // Lock seat class to the original booking's class — no switching allowed during rebooking
  const originalSeatClass = booking.seatClass || 'economy';
  const [seatClass, setSeatClass]           = useState(originalSeatClass);
  const [submitting, setSubmitting]         = useState(false);
  const [flightSearch, setFlightSearch]     = useState('');
  const pax = booking.passengerCount || 1;

  // Determine which route to enforce based on affected leg
  const routeOrigin = affectedLeg === 'return'
    ? booking.returnFlight?.origin || booking.flight?.destination
    : booking.flight?.origin || booking.flight?.origin;
  const routeDest = affectedLeg === 'return'
    ? booking.returnFlight?.destination || booking.flight?.origin
    : booking.flight?.destination || booking.flight?.destination;

  useEffect(() => {
    const params = new URLSearchParams();
    if (routeOrigin) params.set('origin', routeOrigin);
    if (routeDest)   params.set('destination', routeDest);
    // Only show flights that match the original booking's seat class
    params.set('seatClass', originalSeatClass);
    api.get(`/flights/available-for-rebook?${params.toString()}`)
      .then(data => {
        const active = (data.flights || []).filter(
          f => f.status === 'active' && f.id !== booking.flightId
        );
        setFlights(active);
      })
      .catch(() => toast.error('Failed to load available flights'))
      .finally(() => setLoadingFlights(false));
  }, [booking.flightId, routeOrigin, routeDest]);

  const filteredFlights = flights.filter(f => {
    if (!flightSearch.trim()) return true;
    const q = flightSearch.trim().toLowerCase();
    return [f.flightNumber, f.origin, f.destination, f.originCity, f.destinationCity]
      .join(' ').toLowerCase().includes(q);
  });

  const handleChooseFlight = (f) => {
    setChosenFlight(f);
    setSelectedSeats([]);
    setSeatClass(originalSeatClass);
    setStep(STEPS.SEATS);
  };

  const handleConfirmRebook = async () => {
    if (selectedSeats.length !== pax) {
      return toast.error(`Please select exactly ${pax} seat${pax > 1 ? 's' : ''}.`);
    }
    setSubmitting(true);
    try {
      const result = await api.post(`/bookings/${booking.bookingId}/confirm-rebook`, {
        newFlightId: chosenFlight.id,
        newSeatNumbers: selectedSeats,
        newSeatClass: seatClass,
      });
      toast.success(result.message || 'Rebooking confirmed! Check your email for updated tickets.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to confirm rebooking');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDT = (dt) => new Date(dt).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={RBS.overlay}>
      <div style={RBS.modal}>
        {/* ── Header ── */}
        <div style={RBS.header}>
          <div>
            <div style={RBS.headerTitle}>🔄 Rebook Your Flight</div>
            <div style={RBS.headerSub}>
              Booking {booking.bookingId} · {pax} passenger{pax > 1 ? 's' : ''}
              {routeOrigin && routeDest && (
                <span style={{ marginLeft: 8, color: '#ff6600', fontWeight: 800 }}>
                  · {routeOrigin} → {routeDest}
                  {affectedLeg === 'return' ? ' (Return)' : affectedLeg === 'outbound' ? ' (Outbound)' : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={RBS.closeBtn}>✕</button>
        </div>

        {/* ── Step indicator ── */}
        <div style={RBS.stepBar}>
          {[
            { key: STEPS.FLIGHT, label: '1. Choose Flight' },
            { key: STEPS.SEATS,  label: '2. Select Seats'  },
            { key: STEPS.CONFIRM,label: '3. Confirm'       },
          ].map((s, i) => {
            const done    = (step === STEPS.SEATS && i === 0) ||
                            (step === STEPS.CONFIRM && i <= 1);
            const current = step === s.key;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <div style={{ width: 24, height: 2, background: done ? '#003399' : '#dde4ff' }} />}
                <div style={{
                  ...RBS.stepDot,
                  background: current ? '#003399' : done ? '#00aa55' : '#f0f4ff',
                  color: current || done ? '#fff' : '#aaa',
                  border: `2px solid ${current ? '#003399' : done ? '#00aa55' : '#dde4ff'}`,
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: current ? 700 : 500, color: current ? '#003399' : done ? '#00aa55' : '#aaa' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div style={RBS.body}>

          {/* ══ STEP 1: Choose Flight ══ */}
          {step === STEPS.FLIGHT && (
            <div>
              {/* Original cancelled flight info */}
              <div style={RBS.cancelledInfo}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ fontSize: 12, color: '#cc2222' }}>
                  <strong>Cancelled flight:</strong>{' '}
                  {booking.flight?.flightNumber || booking.flightId}
                  {booking.flight && ` — ${booking.flight.origin} → ${booking.flight.destination}`}
                  {booking.flightCancellationReason && (
                    <span style={{ color: '#888' }}> · Reason: {booking.flightCancellationReason}</span>
                  )}
                </div>
              </div>

              {/* Search within flights */}
              {routeOrigin && routeDest && (
                <div style={{ background: '#eef2ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#003399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🛫 Showing only <strong>{routeOrigin} → {routeDest}</strong> flights to keep your same route.
                </div>
              )}
              {/* Class restriction notice */}
              <div style={{ background: originalSeatClass === 'business' ? '#fff8e1' : '#e8eeff',
                borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, fontWeight: 700,
                color: originalSeatClass === 'business' ? '#b8860b' : '#003399',
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1.5px solid ${originalSeatClass === 'business' ? '#ffd54f' : '#99aadd'}` }}>
                {originalSeatClass === 'business' ? '👑' : '✈️'} Only <strong>{originalSeatClass === 'business' ? 'Business' : 'Economy'} Class</strong> flights shown — your seat class cannot change during rebooking.
              </div>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>🔍</span>
                <input
                  className="input-field"
                  style={{ paddingLeft: 36, width: '100%', height: 40, fontSize: 13 }}
                  placeholder="Search flight number, city, route…"
                  value={flightSearch}
                  onChange={e => setFlightSearch(e.target.value)}
                />
              </div>

              {loadingFlights ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>⏳ Loading available flights…</div>
              ) : filteredFlights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                  {flightSearch ? 'No flights match your search.' : 'No available flights right now.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                  {filteredFlights.map(f => (
                    <button key={f.id} onClick={() => handleChooseFlight(f)} style={RBS.flightCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#003399', fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
                            {f.flightNumber}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', marginTop: 2 }}>
                            {f.origin} → {f.destination}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                            {f.originCity} → {f.destinationCity}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontWeight: 800, color: '#ff6600', fontSize: 14 }}>
                            ₱{(f.price || 0).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: f.availableSeats < pax ? '#cc2222' : '#007744', fontWeight: 700, marginTop: 2 }}>
                            {f.availableSeats} seat{f.availableSeats !== 1 ? 's' : ''} left
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#555' }}>
                        <span>🛫 {fmtDT(f.departureTime)}</span>
                        <span>🛬 {fmtDT(f.arrivalTime)}</span>
                        <span>✈ {f.aircraft}</span>
                      </div>
                      {f.availableSeats < pax && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#cc2222', fontWeight: 700 }}>
                          ⚠️ Not enough seats for {pax} passenger{pax > 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2: Select Seats ══ */}
          {step === STEPS.SEATS && chosenFlight && (
            <div>
              <div style={RBS.chosenFlightBadge}>
                <div>
                  <div style={{ fontWeight: 800, color: '#003399', fontSize: 14 }}>
                    ✈️ {chosenFlight.flightNumber}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    {chosenFlight.origin} → {chosenFlight.destination} · {fmtDT(chosenFlight.departureTime)}
                  </div>
                </div>
                <button onClick={() => setStep(STEPS.FLIGHT)} style={RBS.changeBtn}>
                  Change
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12 }}>
                Select {pax} seat{pax > 1 ? 's' : ''} for your journey:
              </div>

              {/* Class notice — shown above seat map */}
              <div style={{ background: originalSeatClass === 'business' ? '#fff8e1' : '#e8eeff',
                border: `1.5px solid ${originalSeatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                fontSize: 12, fontWeight: 700,
                color: originalSeatClass === 'business' ? '#b8860b' : '#003399',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                {originalSeatClass === 'business' ? '👑' : '✈️'}
                {originalSeatClass === 'business' ? 'Business' : 'Economy'} Class Only
                — your rebooking must stay in the same class as your original booking.
              </div>
              <SeatSelector
                bookedSeats={chosenFlight.bookedSeats || []}
                selectedSeats={selectedSeats}
                passengerCount={pax}
                onSelect={seats => setSelectedSeats(seats)}
                onClassChange={cls => setSeatClass(cls)}
                lockedClass={originalSeatClass}
              />

              <button
                onClick={() => {
                  if (selectedSeats.length !== pax) {
                    return toast.error(`Please select ${pax} seat${pax > 1 ? 's' : ''} before continuing.`);
                  }
                  setStep(STEPS.CONFIRM);
                }}
                disabled={selectedSeats.length !== pax}
                style={{
                  ...RBS.primaryBtn,
                  marginTop: 16,
                  background: selectedSeats.length !== pax ? '#e0e0e0' : '#003399',
                  color: selectedSeats.length !== pax ? '#aaa' : '#fff',
                  cursor: selectedSeats.length !== pax ? 'not-allowed' : 'pointer',
                }}
              >
                Continue → Review Booking
              </button>
              <button onClick={() => setStep(STEPS.FLIGHT)} style={RBS.secondaryBtn}>← Back to Flights</button>
            </div>
          )}

          {/* ══ STEP 3: Confirm ══ */}
          {step === STEPS.CONFIRM && chosenFlight && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#003399', marginBottom: 14 }}>
                Review your rebooking details:
              </div>

              {/* Summary card */}
              <div style={RBS.summaryCard}>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>New Flight</span>
                  <span style={RBS.summaryValue}>{chosenFlight.flightNumber}</span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Route</span>
                  <span style={RBS.summaryValue}>{chosenFlight.origin} → {chosenFlight.destination}</span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Departure</span>
                  <span style={RBS.summaryValue}>{fmtDT(chosenFlight.departureTime)}</span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Arrival</span>
                  <span style={RBS.summaryValue}>{fmtDT(chosenFlight.arrivalTime)}</span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Seat{selectedSeats.length > 1 ? 's' : ''}</span>
                  <span style={RBS.summaryValue}>{selectedSeats.join(', ')}</span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Class</span>
                  <span style={{ ...RBS.summaryValue, color: seatClass === 'business' ? '#b8860b' : '#003399' }}>
                    {seatClass === 'business' ? '👑 Business' : '✈️ Economy'}
                  </span>
                </div>
                <div style={RBS.summaryRow}>
                  <span style={RBS.summaryLabel}>Passengers</span>
                  <span style={RBS.summaryValue}>
                    {(booking.passengers || [{ name: booking.passengerName }])
                      .map(p => p.name).join(', ')}
                  </span>
                </div>
                <div style={{ ...RBS.summaryRow, borderTop: '1.5px solid #dde4ff', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ ...RBS.summaryLabel, fontWeight: 700, color: '#333' }}>Booking Ref</span>
                  <span style={{ ...RBS.summaryValue, fontWeight: 800, color: '#003399' }}>{booking.bookingId}</span>
                </div>
              </div>

              <div style={{ background: '#e8f5e9', border: '1.5px solid #99ddaa', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#007744' }}>
                ✅ <strong>No additional charge.</strong> This is a complimentary rebooking due to airline-initiated cancellation. A new boarding pass will be emailed to you.
              </div>

              <button
                onClick={handleConfirmRebook}
                disabled={submitting}
                style={{ ...RBS.primaryBtn, background: submitting ? '#e0e0e0' : '#007744', color: submitting ? '#aaa' : '#fff', cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: 10 }}
              >
                {submitting ? '⏳ Confirming Rebooking…' : '✅ Confirm Rebooking'}
              </button>
              <button onClick={() => setStep(STEPS.SEATS)} disabled={submitting} style={RBS.secondaryBtn}>
                ← Back to Seat Selection
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Flight Cancelled by Airline — refund / rebook banner ─────────────────────
const FlightCancelledBanner = ({ booking, onAction }) => {
  const [loading, setLoading]               = useState(false);

  // Derive the user's prior choice from backend-persisted fields.
  // This ensures the correct state is shown after page refresh or re-login,
  // without relying on ephemeral frontend state.
  const deriveChosenFromBooking = (b) => {
    // Refund was chosen: status moved to cancelled with refund paymentStatus
    if (
      b.status === 'cancelled' &&
      (b.paymentStatus === 'refund_pending' || b.paymentStatus === 'refunded')
    ) return 'refund';
    // Still flight_cancelled but refund was requested
    if (b.status === 'flight_cancelled' && b.paymentStatus === 'refund_pending') return 'refund';
    // Rebook was initiated: pendingAction set to rebook_pending by backend
    if (b.pendingAction === 'rebook_pending') return 'rebook';
    return null;
  };

  const [chosen, setChosen]                 = useState(() => deriveChosenFromBooking(booking));
  const [showRebookModal, setShowRebookModal] = useState(false);
  const [affectedLeg, setAffectedLeg]       = useState(null);

  // ₱0 refund detection — auto-force rebook
  const refundAmount = booking.refundAmount ?? booking.grandTotal ?? Math.round((booking.price || 0) * 1.12);
  const isZeroRefund = refundAmount === 0;

  // Auto-open rebook when ₱0 and still awaiting action
  useEffect(() => {
    if (isZeroRefund && booking.pendingAction === 'refund_or_rebook' && !chosen) {
      initiateRebook(null, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefund = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.post(`/bookings/${booking.bookingId}/flight-cancelled-action`, { action: 'refund' });
      toast.success('Refund request submitted! An admin will process it within 5–7 business days.');
      setChosen('refund');
      onAction();
    } catch (err) { toast.error(err.message || 'Failed to submit refund request'); }
    finally { setLoading(false); }
  };

  const initiateRebook = async (leg = null, skipServerCall = false) => {
    setAffectedLeg(leg);
    if (booking.pendingAction !== 'rebook_pending' && !skipServerCall) {
      setLoading(true);
      try {
        await api.post(`/bookings/${booking.bookingId}/flight-cancelled-action`, { action: 'rebook' });
        onAction();
      } catch (err) {
        toast.error(err.message || 'Failed to initiate rebook');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setShowRebookModal(true);
  };

  const isRoundTrip = booking.tripType === 'roundtrip';

  return (
    <>
      <div style={{ borderTop: '2px solid #ffcccc', background: '#fff5f5' }}>
        {/* Cancelled notice */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>✈️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#cc2222', marginBottom: 4 }}>
              Flight Cancelled by Airline
            </div>
            {booking.flightCancellationReason && (
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                <strong>Reason:</strong> {booking.flightCancellationReason}
              </div>
            )}
            {isZeroRefund && (
              <div style={{ fontSize: 12, color: '#884400', fontWeight: 700, marginBottom: 6,
                background: '#fff3e0', borderRadius: 6, padding: '5px 10px', display: 'inline-block' }}>
                ⚠️ This ticket is non-refundable (₱0). You will be rebooked at no extra charge.
              </div>
            )}
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              We sincerely apologize for the inconvenience. Please choose one of the options below.
            </div>
          </div>
        </div>

        {/* Action buttons — only if no final choice made and refund > 0 */}
        {(booking.pendingAction === 'refund_or_rebook' || booking.pendingAction === 'rebook_pending') && !chosen && !isZeroRefund && (
          <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isRoundTrip ? (
              <>
                <div style={{ fontSize: 12, color: '#555', fontWeight: 700 }}>Which flight do you want to rebook?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => initiateRebook('outbound')} disabled={loading}
                    style={{ flex: 1, minWidth: 130, padding: '10px 12px', borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12,
                      border: '2px solid #003399', background: '#e8eeff', color: '#003399' }}>
                    🛫 Outbound Only
                  </button>
                  <button onClick={() => initiateRebook('return')} disabled={loading}
                    style={{ flex: 1, minWidth: 130, padding: '10px 12px', borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12,
                      border: '2px solid #7733cc', background: '#f3eeff', color: '#7733cc' }}>
                    🛬 Return Only
                  </button>
                  <button onClick={() => initiateRebook(null)} disabled={loading}
                    style={{ flex: 1, minWidth: 130, padding: '10px 12px', borderRadius: 8,
                      cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12,
                      border: '2px solid #007744', background: '#e8fff3', color: '#007744' }}>
                    🔄 Both Flights
                  </button>
                </div>
                <button onClick={handleRefund} disabled={loading}
                  style={{ padding: '10px 16px', borderRadius: 8,
                    cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12,
                    border: '2px solid #cc2222', background: '#fff0f0', color: '#cc2222' }}>
                  {loading ? '⏳' : '💸'} Request Full Refund Instead
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={handleRefund} disabled={loading}
                  style={{ flex: 1, minWidth: 130, padding: '11px 16px', borderRadius: 8,
                    cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                    border: '2px solid #cc2222', background: '#fff0f0', color: '#cc2222' }}>
                  {loading ? '⏳' : '💸'} Request Full Refund
                </button>
                <button onClick={() => initiateRebook(null)} disabled={loading}
                  style={{ flex: 1, minWidth: 130, padding: '11px 16px', borderRadius: 8,
                    cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                    border: '2px solid #003399', background: '#e8eeff', color: '#003399' }}>
                  {loading ? '⏳' : '🔄'} Rebook to New Flight
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zero-refund: single CTA */}
        {isZeroRefund && !chosen && booking.pendingAction === 'refund_or_rebook' && (
          <div style={{ padding: '0 20px 16px' }}>
            <button onClick={() => initiateRebook(null)} disabled={loading}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14,
                border: 'none', background: '#003399', color: '#fff' }}>
              {loading ? '⏳ Please wait…' : '🔄 Choose My Replacement Flight'}
            </button>
          </div>
        )}

        {/* Re-open modal if rebook_pending but not yet confirmed */}
        {booking.pendingAction === 'rebook_pending' && !chosen && (
          <div style={{ padding: '0 20px 16px' }}>
            <button onClick={() => setShowRebookModal(true)}
              style={{ width: '100%', padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, border: '2px solid #003399',
                background: '#e8eeff', color: '#003399' }}>
              🔄 Continue Rebooking
            </button>
          </div>
        )}

        {/* Refund chosen */}
        {chosen === 'refund' && (
          <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <div style={{ fontSize: 12, color: '#cc5500', lineHeight: 1.6 }}>
              <strong>Refund request submitted.</strong> Your refund will be processed within 5–7 business days.
              You will receive an email confirmation once it has been sent.
            </div>
          </div>
        )}
      </div>

      {/* Rebook modal */}
      {showRebookModal && (
        <RebookModal
          booking={booking}
          affectedLeg={affectedLeg}
          onClose={() => setShowRebookModal(false)}
          onSuccess={onAction}
        />
      )}
    </>
  );
};
const fmtCountdown = (ms) => {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const fmt = (dt, opts) => new Date(dt).toLocaleDateString('en-PH', opts);
const fmtFull  = (dt) => fmt(dt, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtShort = (dt) => fmt(dt, { weekday:'short', month:'short', day:'numeric' });

// ── Fee Breakdown Card ────────────────────────────────────────────────────
const FeeBreakdownCard = ({ fee, type = 'cancellation' }) => {
  if (!fee) return null;
  const isCancel  = type === 'cancellation';
  const vatAmount = fee.vatAmount || 0;
  const grandTotal = fee.totalPrice || fee.grandTotal || 0;
  const subtotal  = fee.subtotal || Math.round(grandTotal / 1.12);
  return (
    <div style={S.feeCard}>
      <div style={S.feeCardTitle}>
        {isCancel ? '💰 Cancellation Fee Breakdown' : '🔄 Reschedule Fee Breakdown'}
      </div>
      <div style={S.feeTable}>
        {isCancel ? (
          <>
            <div style={S.feeRow}>
              <span style={S.feeLabel}>Subtotal (ex. VAT)</span>
              <span style={S.feeVal}>₱{subtotal.toLocaleString()}</span>
            </div>
            <div style={S.feeRow}>
              <span style={S.feeLabel}>VAT (12%)</span>
              <span style={S.feeVal}>+₱{vatAmount.toLocaleString()}</span>
            </div>
            <div style={S.feeRow}>
              <span style={{ ...S.feeLabel, fontWeight:700 }}>Total Paid (incl. VAT)</span>
              <span style={{ ...S.feeVal, fontWeight:800 }}>₱{grandTotal.toLocaleString()}</span>
            </div>
            <div style={{ ...S.feeRow, borderTop:'1px dashed #ffaa66', paddingTop:10, marginTop:4 }}>
              <span style={{ ...S.feeLabel, color:'#cc5500' }}>
                Cancellation Fee ({fee.feePercent}%{fee.passengerCount > 1 ? ` × ${fee.passengerCount} pax` : ''})
              </span>
              <span style={{ ...S.feeVal, color:'#cc5500' }}>−₱{(fee.totalFee||0).toLocaleString()}</span>
            </div>
            <div style={{ ...S.feeRow, borderTop:'2px solid #ffaa66', paddingTop:10, marginTop:2 }}>
              <span style={{ ...S.feeLabel, fontWeight:800, fontSize:14, color:'#1a1a2e' }}>Refund Amount (incl. VAT)</span>
              <span style={{ ...S.feeVal, fontSize:20, fontWeight:900, color:'#00aa55' }}>₱{(fee.totalRefund||0).toLocaleString()}</span>
            </div>
          </>
        ) : (
          <>
            <div style={S.feeRow}>
              <span style={S.feeLabel}>Price per Passenger</span>
              <span style={S.feeVal}>₱{(fee.pricePerPax||0).toLocaleString()}</span>
            </div>
            <div style={S.feeRow}>
              <span style={S.feeLabel}>Number of Passengers</span>
              <span style={S.feeVal}>× {fee.passengerCount}</span>
            </div>
            {fee.classChanged && (
              <div style={{ ...S.feeRow, borderTop:'1px dashed #ffaa66', paddingTop:10, marginTop:4, background:'#fff8e1', borderRadius:6, padding:'8px 10px' }}>
                <span style={{ ...S.feeLabel, color:'#cc5500', fontWeight:700 }}>
                  🎖️ Class Upgrade ({fee.oldClass} → {fee.newClass}){fee.passengerCount > 1 ? ` × ${fee.passengerCount} pax` : ''}
                </span>
                <span style={{ ...S.feeVal, color:'#cc5500' }}>+₱{(fee.totalUpgrade||0).toLocaleString()}</span>
              </div>
            )}
            {(fee.totalFareDiff||0) > 0 && (
              <div style={{ ...S.feeRow, borderTop:'1px dashed #99aadd', paddingTop:10, marginTop:4 }}>
                <span style={{ ...S.feeLabel, color:'#003399' }}>
                  Fare Difference/pax (₱{(fee.fareDiffPerPax||0).toLocaleString()}{fee.passengerCount > 1 ? ` × ${fee.passengerCount}` : ''})
                </span>
                <span style={{ ...S.feeVal, color:'#003399' }}>₱{(fee.totalFareDiff||0).toLocaleString()}</span>
              </div>
            )}
            <div style={{ ...S.feeRow, borderTop:'1px dashed #ffaa66', paddingTop:10, marginTop:4 }}>
              <span style={{ ...S.feeLabel, color:'#cc5500' }}>
                Reschedule Fee ({fee.feePercent}%{fee.passengerCount > 1 ? ` × ${fee.passengerCount} pax` : ''})
              </span>
              <span style={{ ...S.feeVal, color:'#cc5500' }}>₱{(fee.totalRescheduleFee||0).toLocaleString()}</span>
            </div>
            <div style={{ ...S.feeRow, borderTop:'2px solid #99aadd', paddingTop:10, marginTop:2 }}>
              <span style={{ ...S.feeLabel, fontWeight:800, fontSize:14, color:'#1a1a2e' }}>Total Payment Required</span>
              <span style={{ ...S.feeVal, fontSize:20, fontWeight:900, color:'#cc5500' }}>₱{(fee.totalPayment||0).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
      <div style={S.feePolicy}>📋 Policy: {fee.ruleLabel}</div>
      {fee.feePercent === 0 && fee.allowed && (
        <div style={S.feeFreeBadge}>🎉 Free — no charge applies</div>
      )}
    </div>
  );
};


const MyBookings = () => {
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [now, setNow]               = useState(Date.now());
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // Cancellation
  const [cancelFeeModal, setCancelFeeModal]       = useState(null);
  const [cancelReasonModal, setCancelReasonModal] = useState(null);
  const [cancelReason, setCancelReason]           = useState('');
  const [cancelling, setCancelling]               = useState(false);

  // Reschedule
  const [rescheduleModal, setRescheduleModal]       = useState(null);
  const [rescheduleFlights, setRescheduleFlights]   = useState([]);
  const [rescheduleSearch, setRescheduleSearch]     = useState('');
  const [rescheduleLoading, setRescheduleLoading]   = useState(false);
  const [rescheduleFeeModal, setRescheduleFeeModal] = useState(null);
  const [rescheduleReason, setRescheduleReason]     = useState('');
  const [rescheduleSeatModal, setRescheduleSeatModal] = useState(null);
  const [rescheduleNewSeats, setRescheduleNewSeats]   = useState([]);
  const [rescheduleNewClass, setRescheduleNewClass]   = useState('economy');
  const [seatModalLoading, setSeatModalLoading]       = useState(false);
  const [rescheduling, setRescheduling]             = useState(false);
  // Round-trip leg selection
  const [rescheduleLeg, setRescheduleLeg]           = useState('outbound'); // 'outbound'|'return'|'both'
  // For "both" legs — return leg seat/flight selection
  const [rtReturnSeatModal, setRtReturnSeatModal]     = useState(null);
  const [rtReturnNewSeats, setRtReturnNewSeats]       = useState([]);
  const [rtReturnNewClass, setRtReturnNewClass]       = useState('economy');
  const [rtReturnFlight, setRtReturnFlight]           = useState(null);
  const [rtReturnSeatLoading, setRtReturnSeatLoading] = useState(false);
  // Date picker for rescheduling
  const [rescheduleDate, setRescheduleDate]           = useState('');   // selected date filter (YYYY-MM-DD)
  const [rtReturnMinDate, setRtReturnMinDate]         = useState('');   // minimum allowed date for return leg
  const [allRescheduleFlights, setAllRescheduleFlights] = useState([]); // unfiltered list for date filtering

  useEffect(() => {
    document.title = 'My Bookings – Cebu Airline';
    fetchBookings();
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => { api.post('/bookings/expire-timeouts', {}).catch(() => {}); }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.get('/bookings/my');
      setBookings(data.bookings || []);
    } catch { toast.error('Failed to load bookings'); }
    finally  { setLoading(false); }
  };

  // Direct cancel (pending_payment / payment_submitted)
  const handleDirectCancelClick = (booking) => {
    setCancelReasonModal({ ...booking, mode: 'cancel' });
    setCancelReason('');
  };

  // Confirmed booking cancel — show fee first
  const handleRequestCancelClick = (booking) => {
    if (!booking.flight) return toast.error('Flight data missing');
    const fee = calcCancellationFee(booking, booking.flight);
    setCancelFeeModal({ booking, fee });
  };

  const handleCancelFeeConfirm = () => {
    if (!cancelFeeModal.fee.allowed) return;
    setCancelReasonModal({ ...cancelFeeModal.booking, mode: 'request', fee: cancelFeeModal.fee });
    setCancelReason('');
    setCancelFeeModal(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return toast.error('Please enter a reason');
    setCancelling(true);
    try {
      if (cancelReasonModal.mode === 'request') {
        await api.put(`/bookings/${cancelReasonModal.bookingId}/request-cancel`, { reason: cancelReason });
        toast.success('Cancellation request submitted. Awaiting admin review.');
      } else {
        await api.put(`/bookings/${cancelReasonModal.bookingId}/cancel`, { reason: cancelReason });
        toast.success('Booking cancelled successfully.');
      }
      fetchBookings();
      setCancelReasonModal(null);
      setCancelReason('');
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally { setCancelling(false); }
  };

  // Reschedule flow
  // Helper: filter flights by date string (YYYY-MM-DD), returns filtered list
  const filterFlightsByDate = (flights, dateStr) => {
    if (!dateStr) return flights;
    return flights.filter(fl => {
      const d = new Date(fl.departureTime);
      const flDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      return flDate === dateStr;
    });
  };

  const handleRescheduleClick = async (booking, leg = 'outbound') => {
    setRescheduleLeg(leg);
    setRtReturnFlight(null);
    setRtReturnNewSeats([]);
    setRtReturnNewClass(booking.seatClass || 'economy');
    setRescheduleDate('');
    setAllRescheduleFlights([]);

    // Compute minimum date for return leg (must be day after outbound)
    if (leg === 'return' && booking.flight?.departureTime) {
      const outboundDate = new Date(booking.flight.departureTime);
      outboundDate.setDate(outboundDate.getDate() + 1);
      setRtReturnMinDate(outboundDate.toISOString().split('T')[0]);
    } else if (leg === 'both') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRtReturnMinDate(tomorrow.toISOString().split('T')[0]);
    } else {
      setRtReturnMinDate('');
    }

    // For return/both legs, load return route flights
    const targetFlight = (leg === 'return') ? booking.returnFlight : booking.flight;
    const legLabel = leg === 'return' ? 'Return' : 'Outbound';

    setRescheduleModal({ booking, leg });
    setRescheduleSearch('');
    setRescheduleFlights([]);
    setRescheduleLoading(true);
    try {
      const params = new URLSearchParams();
      if (targetFlight?.origin)      params.append('origin', targetFlight.origin);
      if (targetFlight?.destination) params.append('destination', targetFlight.destination);
      const data = await api.get(`/flights?${params.toString()}`);
      const excludeId = leg === 'return' ? booking.returnFlightId : booking.flightId;
      const now = new Date();
      const outboundDep = booking.flight?.departureTime ? new Date(booking.flight.departureTime) : null;
      const available = (data.flights || []).filter(fl => {
        if (fl.id === excludeId) return false;
        const flDep = new Date(fl.departureTime);
        if (flDep <= now) return false; // must be in the future
        // For return-leg reschedule: new return must be strictly after the outbound departure date
        if (leg === 'return' && outboundDep) {
          // Compare dates only (day-level), return must be next day or later
          const outboundDay = new Date(outboundDep);
          outboundDay.setHours(0,0,0,0);
          const returnDay = new Date(flDep);
          returnDay.setHours(0,0,0,0);
          if (returnDay <= outboundDay) return false;
        }
        return true;
      });
      setAllRescheduleFlights(available);
      setRescheduleFlights(available);
    } catch { toast.error(`Failed to load available ${legLabel} flights`); }
    finally { setRescheduleLoading(false); }
  };

  // When user picks a date in the reschedule modal, filter the flights
  const handleRescheduleDateChange = (dateStr) => {
    setRescheduleDate(dateStr);
    setRescheduleFlights(filterFlightsByDate(allRescheduleFlights, dateStr));
  };

  const handleSelectNewFlight = async (newFlight) => {
    if (!rescheduleModal) return;
    const { booking } = rescheduleModal;
    setRescheduleModal(null);
    setRescheduleNewSeats([]);
    setRescheduleNewClass(booking.seatClass || 'economy');
    setSeatModalLoading(true);
    setRescheduleSeatModal({ booking, newFlight, leg: rescheduleLeg });
    try {
      const fresh = await api.get(`/flights/${newFlight.id}`);
      setRescheduleSeatModal({ booking, newFlight: { ...newFlight, bookedSeats: fresh.bookedSeats || [] }, leg: rescheduleLeg });
    } catch {
      toast.warning('Could not refresh seat availability — some seats may appear incorrectly.');
    } finally {
      setSeatModalLoading(false);
    }
  };

  // For "both" legs: called after outbound seat is chosen, to pick return flight seats
  const handleSelectReturnFlight = async (flight, booking) => {
    setRtReturnFlight(flight);
    setRtReturnNewSeats([]);
    setRtReturnNewClass(booking.seatClass || 'economy');
    setRtReturnSeatLoading(true);
    setRtReturnSeatModal({ booking, flight });
    try {
      const fresh = await api.get(`/flights/${flight.id}`);
      setRtReturnSeatModal({ booking, flight: { ...flight, bookedSeats: fresh.bookedSeats || [] } });
    } catch {
      toast.warning('Could not refresh return seat availability.');
    } finally {
      setRtReturnSeatLoading(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleFeeModal?.fee.allowed) return;
    setRescheduling(true);
    const { booking, newFlight, newSeats, newSeatClass, leg, returnFlight: returnFlightData, returnSeats, returnSeatClass } = rescheduleFeeModal;
    try {
      const payload = {
        leg: leg || 'outbound',
        reason: rescheduleReason,
      };

      if (leg === 'return') {
        // Return-only: only send return flight data
        payload.newReturnFlightId    = newFlight.id;
        payload.newReturnSeatNumbers = newSeats;
        payload.newReturnSeatClass   = newSeatClass || booking.seatClass;
        // Backend still needs newSeatNumbers (outbound unchanged)
        payload.newSeatNumbers = booking.seatNumbers || [booking.seatNumber];
      } else if (leg === 'both') {
        // Both legs
        payload.newFlightId          = newFlight.id;
        payload.newSeatNumbers       = newSeats;
        payload.newSeatClass         = newSeatClass || booking.seatClass;
        payload.newReturnFlightId    = (returnFlightData || rtReturnFlight)?.id;
        payload.newReturnSeatNumbers = returnSeats || rtReturnNewSeats;
        payload.newReturnSeatClass   = returnSeatClass || rtReturnNewClass;
      } else {
        // Outbound only
        payload.newFlightId    = newFlight.id;
        payload.newSeatNumbers = newSeats;
        payload.newSeatClass   = newSeatClass || booking.seatClass;
      }
      const result = await api.put(`/bookings/${booking.bookingId}/reschedule`, payload);

      setRescheduleFeeModal(null);
      setRescheduleReason('');

      if (result.requiresPayment) {
        // Fees apply — send user to the payment page immediately
        toast.info('Reschedule held. Please complete payment to confirm.');
        navigate(`/reschedule-payment/${booking.bookingId}`);
      } else {
        // Free reschedule (0% fee, same price) — no payment needed
        toast.success('Reschedule request submitted. Awaiting admin review.');
        fetchBookings();
      }
    } catch (err) {
      toast.error(err.message || 'Reschedule failed');
    } finally { setRescheduling(false); }
  };

  // Filter
  const displayedBookings = bookings.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q
      || (b.bookingId||'').toLowerCase().includes(q)
      || (b.flight?.flightNumber||'').toLowerCase().includes(q)
      || (b.flight?.origin||'').toLowerCase().includes(q)
      || (b.flight?.destination||'').toLowerCase().includes(q)
      || (b.passengerName||'').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const filteredRescheduleFlights = rescheduleFlights.filter(f => {
    const q = rescheduleSearch.toLowerCase();
    return !q || f.flightNumber?.toLowerCase().includes(q)
      || f.origin?.toLowerCase().includes(q)
      || f.destination?.toLowerCase().includes(q);
  });

  if (loading) return <div className="container"><div className="spinner" /></div>;

  return (
    <div style={{ padding:'32px 0 60px' }}>
      <div className="container">
        <div style={S.header}>
          <h1 style={S.title}>My Bookings</h1>
          <button onClick={() => navigate('/search')} className="btn-primary">+ Book New Flight</button>
        </div>

        {bookings.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize:64, marginBottom:20 }}>✈️</div>
            <h3 style={{ color:'#003399', marginBottom:12 }}>No bookings yet</h3>
            <p style={{ color:'#888', marginBottom:24 }}>Start your journey by searching for available flights.</p>
            <button onClick={() => navigate('/search')} className="btn-primary">Search Flights</button>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div style={S.filterBar}>
              <div style={S.searchWrap}>
                <span style={S.searchIcon}>🔍</span>
                <input style={S.searchInput} placeholder="Search by booking ref, flight number, route…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button onClick={() => setSearchQuery('')} style={S.clearBtn}>✕</button>}
              </div>
              <div style={S.statusTabs}>
                {[
                  { key:'all',                   label:'All',             emoji:'📋' },
                  { key:'confirmed',             label:'Confirmed',       emoji:'✅' },
                  { key:'pending_payment',       label:'Pending Pmt',     emoji:'⏳' },
                  { key:'payment_submitted',     label:'Under Review',    emoji:'📤' },
                  { key:'cancellation_requested',label:'Cancel Req.',     emoji:'🔄' },
                  { key:'reschedule_requested',  label:'Reschedule Req.', emoji:'✈️' },
                  { key:'reschedule_payment_pending', label:'Reschedule Pmt.', emoji:'💳' },
                  { key:'cancelled',             label:'Cancelled',       emoji:'🚫' },
                  { key:'rejected',              label:'Rejected',        emoji:'❌' },
                ].map(tab => {
                  const count = tab.key==='all' ? bookings.length : bookings.filter(b=>b.status===tab.key).length;
                  if (count===0 && tab.key!=='all') return null;
                  return (
                    <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                      style={{ ...S.statusTab, ...(statusFilter===tab.key ? S.statusTabActive : {}) }}>
                      {tab.emoji} {tab.label}
                      <span style={{ ...S.tabCount, ...(statusFilter===tab.key ? S.tabCountActive : {}) }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {displayedBookings.length === 0 ? (
              <div style={{ ...S.empty, padding:'48px 20px' }}>
                <div style={{ fontSize:48, marginBottom:14 }}>🔍</div>
                <h3 style={{ color:'#003399', marginBottom:8 }}>No bookings match</h3>
                <p style={{ color:'#888', marginBottom:20 }}>Try a different status or clear your search.</p>
                <button onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                  style={{ background:'#f0f4ff', color:'#003399', border:'2px solid #dde4ff', borderRadius:8, padding:'10px 24px', fontWeight:700, cursor:'pointer', fontSize:14 }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div style={S.list}>
                {displayedBookings.map(booking => {
                  const isRT = booking.tripType === 'roundtrip';
                  const statusBorderColor = {
                    cancelled: '#cc2222',
                    flight_cancelled: '#cc2222',
                    cancellation_requested: '#cc5500',
                    expired: '#888888',
                    confirmed: '#007744',
                    pending: '#cc8800',
                  }[booking.status] || (isRT ? '#00aa55' : '#003399');
                  return (
                    <div key={booking.id} style={{
                      ...S.bookingCard,
                      borderLeft: `5px solid ${statusBorderColor}`,
                      ...(booking.status === 'cancelled' ? { background: '#fff8f8', opacity: 0.92 } : {}),
                      ...(booking.status === 'flight_cancelled' ? { background: '#fff5f5' } : {}),
                      ...(booking.status === 'expired' ? { background: '#f8f8f8', opacity: 0.85 } : {}),
                    }}>

                      {/* Header */}
                      <div style={S.cardHeader}>
                        <div style={S.refInfo}>
                          <span style={S.refLabel}>Booking Ref</span>
                          <span style={S.refNum}>{booking.bookingId}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <div style={{ fontSize:11, fontWeight:800, padding:'4px 12px', borderRadius:20,
                            background:isRT?'#e8f5e9':'#e8eeff', color:isRT?'#007744':'#003399',
                            border:`1.5px solid ${isRT?'#00aa55':'#99aadd'}` }}>
                            {isRT ? '🔄 Round Trip' : '➡️ One Way'}
                          </div>
                          <StatusBadge status={booking.status} />
                        </div>
                      </div>

                      {/* Flight info */}
                      <div style={S.cardBody}>
                        {booking.flight && (
                          <div style={S.flightInfo}>
                            {isRT && <div style={S.legTag('#003399')}>✈️ Outbound</div>}
                            <div style={S.flightRoute}>
                              <div style={S.routeCode}>{booking.flight.origin}</div>
                              <div style={S.routeArrow}>✈ ─────</div>
                              <div style={S.routeCode}>{booking.flight.destination}</div>
                            </div>
                            <div style={S.flightMeta}>
                              <span>🛫 {booking.flight.flightNumber}</span>
                              <span>📅 {fmtShort(booking.flight.departureTime)}</span>
                              <span>💺 Seat {booking.seatNumber}</span>
                              <span style={{ fontSize:11, fontWeight:800, padding:'2px 8px', borderRadius:8,
                                background:booking.seatClass==='business'?'#fff8e1':'#e8eeff',
                                color:booking.seatClass==='business'?'#b8860b':'#003399',
                                border:`1px solid ${booking.seatClass==='business'?'#ffd54f':'#99aadd'}` }}>
                                {booking.seatClass==='business'?'👑 Business':'✈️ Economy'}
                              </span>
                            </div>
                          </div>
                        )}

                        {isRT && booking.returnFlight && (
                          <div style={{ ...S.flightInfo, marginTop:12, paddingTop:12, borderTop:'1px dashed #dde4ff' }}>
                            <div style={S.legTag('#007744')}>🔄 Return</div>
                            <div style={S.flightRoute}>
                              <div style={S.routeCode}>{booking.returnFlight.origin}</div>
                              <div style={S.routeArrow}>✈ ─────</div>
                              <div style={S.routeCode}>{booking.returnFlight.destination}</div>
                            </div>
                            <div style={S.flightMeta}>
                              <span>🛫 {booking.returnFlight.flightNumber}</span>
                              <span>📅 {fmtShort(booking.returnFlight.departureTime)}</span>
                            </div>
                          </div>
                        )}

                        {booking.previousFlightNumber && (
                          <div style={S.rescheduleNote}>
                            📋 Previously: <strong>{booking.previousFlightNumber}</strong>
                            {booking.previousDeparture && ` (${fmtShort(booking.previousDeparture)})`}
                            {booking.previousSeatNumbers?.length > 0 && (
                              <span> · Seats: <strong>{booking.previousSeatNumbers.join(', ')}</strong> → <strong>{(booking.seatNumbers || [booking.seatNumber]).join(', ')}</strong></span>
                            )}
                            {booking.previousSeatClass && booking.previousSeatClass !== booking.seatClass && (
                              <span style={{ color: '#cc5500', fontWeight: 800 }}> · 🎖️ {booking.previousSeatClass} → {booking.seatClass}</span>
                            )}
                          </div>
                        )}

                        {booking.cancellationFeeBreakdown && ['cancellation_requested','cancelled'].includes(booking.status) && (
                          <FeeBreakdownCard fee={booking.cancellationFeeBreakdown} type="cancellation" />
                        )}
                        {booking.rescheduleFeeBreakdown && ['reschedule_requested','confirmed','reschedule_payment_pending'].includes(booking.status) && booking.previousFlightNumber && (
                          <FeeBreakdownCard fee={booking.rescheduleFeeBreakdown} type="reschedule" />
                        )}

                        {/* Price */}
                        <div style={S.priceRow}>
                          {(() => {
                            const vatRate = 0.12;
                            const sub = booking.price || 0;
                            const vat = booking.vatAmount || Math.round(sub * vatRate);
                            const grand = booking.grandTotal || (sub + vat);
                            return isRT ? (
                              <div style={S.priceBreakdown}>
                                <span style={{ fontSize:12, color:'#888' }}>₱{(booking.outboundPrice||0).toLocaleString()} + ₱{(booking.returnPrice||0).toLocaleString()} + ₱{vat.toLocaleString()} VAT</span>
                                <span style={{ fontSize:18, fontWeight:900, color:'#ff6600', marginLeft:8 }}>= ₱{grand.toLocaleString()}</span>
                              </div>
                            ) : (
                              <div>
                                <span style={{ fontWeight:700, color:'#ff6600', fontSize:18 }}>₱{grand.toLocaleString()}</span>
                                <span style={{ fontSize:11, color:'#888', marginLeft:6 }}>incl. VAT</span>
                              </div>
                            );
                          })()}
                          <div style={S.paymentStatus}>
                            <span style={{ fontSize:13, color:'#666' }}>Payment: </span>
                            <StatusBadge status={(() => {
                              // Refund flow: once refundSent=true, always show 'refunded'
                              if (booking.refundSent) return 'refunded';
                              // If refund was requested (airline-cancelled or user-cancelled)
                              if (booking.paymentStatus === 'refund_pending') return 'refund_pending';
                              // Standard: refunded paymentStatus but not yet sent — show pending
                              if (booking.status === 'cancelled' && booking.paymentStatus === 'refunded') return 'refund_pending';
                              return booking.paymentStatus;
                            })()} />
                          </div>
                        </div>
                      </div>

                      {/* Countdown */}
                      {booking.status==='pending_payment' && booking.expiresAt && (() => {
                        const msLeft = new Date(booking.expiresAt) - now;
                        const soon = msLeft < 5*60*1000 && msLeft > 0;
                        if (msLeft <= 0) return <div style={S.expiredBanner}>⏰ Booking expired — please refresh.</div>;
                        return (
                          <div style={{ ...S.timerBanner, background:soon?'#ffe8e8':'#fff8e1', borderColor:soon?'#ffaaaa':'#ffc107', borderLeftColor:soon?'#cc2222':'#ffa000' }}>
                            <span style={{ fontSize:16 }}>{soon?'🚨':'⏳'}</span>
                            <span style={{ fontSize:13, color:soon?'#cc2222':'#856404', fontWeight:700 }}>
                              {soon?'Expiring soon! ':'Complete payment within '}
                              <span style={{ fontFamily:'monospace', fontSize:15, background:soon?'#cc2222':'#ffa000', color:'white', padding:'1px 7px', borderRadius:6 }}>
                                {fmtCountdown(msLeft)}
                              </span>
                              {' — seat released if unpaid'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Reschedule payment pending banner */}
                      {booking.status==='reschedule_payment_pending' && (
                        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 24px', background:'#fff8e1', borderTop:'1px solid #ffd54f', borderLeft:'4px solid #ff9900' }}>
                          <span style={{ fontSize:20 }}>💳</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'#cc5500', marginBottom:2 }}>
                              Reschedule payment required
                            </div>
                            <div style={{ fontSize:12, color:'#856404' }}>
                              Pay ₱{(booking.rescheduleFeeBreakdown?.totalPayment||0).toLocaleString()} via GCash to confirm your new flight.
                            </div>
                          </div>
                          <button className="btn-primary"
                            onClick={() => navigate(`/reschedule-payment/${booking.bookingId}`)}
                            style={{ padding:'8px 18px', fontSize:13, whiteSpace:'nowrap', background:'linear-gradient(135deg,#cc5500,#ff7700)' }}>
                            Pay Now →
                          </button>
                        </div>
                      )}

                      {/* Footer actions */}
                      <div style={S.cardFooter}>
                        <span style={S.bookingDate}>Booked: {fmtFull(booking.bookingDate)}</span>
                        <div style={S.actions}>
                          {booking.status==='pending_payment' && (
                            <button className="btn-primary" onClick={() => navigate(`/payment/${booking.bookingId}`)} style={{ padding:'8px 20px', fontSize:13 }}>
                              Pay Now 💳
                            </button>
                          )}
                          {booking.status==='rejected' && (
                            <button className="btn-primary" onClick={() => navigate(`/payment/${booking.bookingId}`)}
                              style={{ padding:'8px 20px', fontSize:13, background:'linear-gradient(135deg,#cc2222,#ee4444)' }}>
                              🔄 Re-upload Payment
                            </button>
                          )}
                          {booking.status==='reschedule_payment_pending' && (
                            <button className="btn-primary" onClick={() => navigate(`/reschedule-payment/${booking.bookingId}`)}
                              style={{ padding:'8px 20px', fontSize:13, background:'linear-gradient(135deg,#cc5500,#ff7700)' }}>
                              💳 Pay Reschedule Fee
                            </button>
                          )}
                          {booking.status==='confirmed' && booking.paymentStatus==='paid' && (
                            <button className="btn-success" onClick={() => navigate(`/ticket/${booking.bookingId}`)} style={{ padding:'8px 20px', fontSize:13 }}>
                              🖨️ Print Ticket
                            </button>
                          )}
                          {booking.status==='confirmed' && (() => {
                            const isRT = booking.tripType === 'roundtrip' && booking.returnFlight;
                            if (!isRT) return (
                              <button onClick={() => handleRescheduleClick(booking, 'outbound')} style={S.rescheduleBtn}>
                                ✈️ Reschedule
                              </button>
                            );
                            return (
                              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5 }}>Reschedule</div>
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                  <button onClick={() => handleRescheduleClick(booking, 'outbound')} style={{ ...S.rescheduleBtn, fontSize:12, padding:'6px 12px' }}>
                                    ✈️ Outbound
                                  </button>
                                  <button onClick={() => handleRescheduleClick(booking, 'return')} style={{ ...S.rescheduleBtn, fontSize:12, padding:'6px 12px', color:'#007744', borderColor:'#99ddaa' }}>
                                    🔄 Return
                                  </button>
                                  <button onClick={() => handleRescheduleClick(booking, 'both')} style={{ ...S.rescheduleBtn, fontSize:12, padding:'6px 12px', color:'#cc5500', borderColor:'#ffaa66' }}>
                                    🔁 Both
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                          {['pending_payment','payment_submitted'].includes(booking.status) && (
                            <button className="btn-danger" onClick={() => handleDirectCancelClick(booking)} style={{ padding:'8px 16px', fontSize:13 }}>
                              Cancel
                            </button>
                          )}
                          {booking.status==='confirmed' && (
                            <button onClick={() => handleRequestCancelClick(booking)} style={S.requestCancelBtn}>
                              Request Cancellation
                            </button>
                          )}
                          {['cancellation_requested','reschedule_requested'].includes(booking.status) && (
                            <span style={S.pendingNote}>🔄 Awaiting admin review</span>
                          )}
                          {booking.status==='reschedule_payment_pending' && (
                            <span style={{ ...S.pendingNote, background:'#fff8e1', border:'1px solid #ffd54f', color:'#cc8800' }}>
                              ⏳ Payment required to confirm
                            </span>
                          )}
                        </div>
                      </div>

                      {booking.status==='rejected' && booking.rejectionReason && (
                        <div style={S.rejectionNote}>⚠️ Rejection reason: {booking.rejectionReason}</div>
                      )}
                      {booking.status==='cancellation_requested' && booking.cancellationReason && (
                        <div style={{ ...S.rejectionNote, background:'#fff0e0', borderTop:'1px solid #ffccaa', color:'#cc5500' }}>
                          🔄 Cancellation requested: "{booking.cancellationReason}"
                        </div>
                      )}
                      {/* ── Flight Cancelled by Airline banner ── */}
                      {booking.status==='flight_cancelled' && (
                        <FlightCancelledBanner booking={booking} onAction={() => fetchBookings()} />
                      )}
                      {booking.rescheduleRejectionReason && (
                        <div style={{ ...S.rejectionNote, background:'#fff0e0', borderTop:'1px solid #ffccaa', color:'#cc5500' }}>
                          ❌ Reschedule rejected: "{booking.rescheduleRejectionReason}"
                        </div>
                      )}
                      {/* Refund Processing — pending admin action */}
                      {(
                        (booking.status==='cancelled' && (booking.paymentStatus==='refunded' || booking.paymentStatus==='refund_pending') && !booking.refundSent) ||
                        (booking.status==='flight_cancelled' && booking.paymentStatus==='refund_pending' && !booking.refundSent)
                      ) && (
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px', background:'#fff8f0', borderTop:'1px solid #ffccaa' }}>
                          <span style={{ fontSize:20, flexShrink:0 }}>⏳</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:800, color:'#cc5500', marginBottom:2 }}>Refund Processing</div>
                            <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>
                              Your refund of <strong style={{ color:'#cc5500' }}>₱{(booking.refundAmount || booking.grandTotal || 0).toLocaleString()}</strong> is being processed. You will receive a confirmation email once the GCash transfer is sent. Please allow 1–3 business days.
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Refund Sent — completed */}
                      {((booking.status==='cancelled' || booking.status==='flight_cancelled') && booking.refundSent) && (
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px', background:'#e8f5e9', borderTop:'1px solid #99ddaa' }}>
                          <span style={{ fontSize:20, flexShrink:0 }}>✅</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:800, color:'#007744', marginBottom:2 }}>Refund Sent</div>
                            <div style={{ fontSize:12, color:'#555', lineHeight:1.5 }}>
                              Your refund of <strong style={{ color:'#007744' }}>₱{(booking.refundAmount || booking.grandTotal || 0).toLocaleString()}</strong> has been sent to your GCash account.
                              {booking.refundProcessedAt && (
                                <span> Processed on {new Date(booking.refundProcessedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: Cancellation Fee Preview ── */}
      {cancelFeeModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:480 }}>
            <div style={{ background:'#fff8f0', borderRadius:'20px 20px 0 0', padding:'28px 28px 20px', borderBottom:'1px solid #ffe4cc' }}>
              <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>💰</div>
              <h2 style={{ fontFamily:'Montserrat, sans-serif', fontSize:20, fontWeight:800, color:'#cc5500', textAlign:'center', margin:0 }}>
                Cancellation Fee
              </h2>
              <p style={{ textAlign:'center', fontSize:13, color:'#888', margin:'8px 0 0' }}>
                {cancelFeeModal.booking.flight?.flightNumber} · {cancelFeeModal.booking.flight?.origin} → {cancelFeeModal.booking.flight?.destination}
              </p>
            </div>
            <div style={{ padding:'24px 28px 28px' }}>
              {!cancelFeeModal.fee.allowed ? (
                <div style={{ background:'#ffe8e8', border:'1.5px solid #ffaaaa', borderRadius:12, padding:'20px', marginBottom:20, textAlign:'center' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🚫</div>
                  <div style={{ fontWeight:800, color:'#cc2222', fontSize:15, marginBottom:6 }}>Cancellation Not Allowed</div>
                  <div style={{ color:'#cc2222', fontSize:13 }}>Less than 24 hours before departure. Cancellations are not permitted at this stage.</div>
                </div>
              ) : (
                <FeeBreakdownCard fee={cancelFeeModal.fee} type="cancellation" />
              )}
              <div style={{ display:'flex', gap:12 }}>
                <button onClick={() => setCancelFeeModal(null)} style={S.keepBtn}>Keep Booking</button>
                {cancelFeeModal.fee.allowed && (
                  <button onClick={handleCancelFeeConfirm}
                    style={{ flex:1, padding:'13px', fontSize:14, fontWeight:700, background:'#cc5500', color:'white', border:'none', borderRadius:10, cursor:'pointer' }}>
                    Continue →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Cancellation Reason ── */}
      {cancelReasonModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ ...S.modalHeader, background: cancelReasonModal.mode==='request'?'#fff0e0':'#fff5f5' }}>
              <div>
                <h2 style={{ ...S.modalTitle, color: cancelReasonModal.mode==='request'?'#cc5500':'#cc2222' }}>
                  {cancelReasonModal.mode==='request' ? '🔄 Request Cancellation' : '❌ Cancel Booking'}
                </h2>
                <div style={S.modalRef}>{cancelReasonModal.bookingId}</div>
              </div>
              <button onClick={() => setCancelReasonModal(null)} style={S.closeBtn}>✕</button>
            </div>
            <div style={S.modalBody}>
              {cancelReasonModal.mode==='request' && cancelReasonModal.fee && (
                <FeeBreakdownCard fee={cancelReasonModal.fee} type="cancellation" />
              )}
              <div style={{ ...S.warningBox, background: cancelReasonModal.mode==='request'?'#fff0e0':'#fff3cd',
                borderColor: cancelReasonModal.mode==='request'?'#ffaa66':'#ffc107',
                color: cancelReasonModal.mode==='request'?'#cc5500':'#856404' }}>
                {cancelReasonModal.mode==='request'
                  ? '🔄 Your request will be reviewed by admin. Refund will be processed based on the fee breakdown above.'
                  : '⚠️ This action cannot be undone. Your seat will be released.'}
              </div>
              <div style={S.reasonSection}>
                <label style={S.reasonLabel}>Reason for Cancellation <span style={{ color:'#cc2222' }}>*</span></label>
                <div style={S.reasonQuickPicks}>
                  {['Change of plans','Found a better fare','Medical emergency','Travel restrictions','Personal reasons'].map(r => (
                    <button key={r} type="button" onClick={() => setCancelReason(r)}
                      style={{ ...S.quickPickBtn, ...(cancelReason===r?S.quickPickBtnActive:{}) }}>{r}</button>
                  ))}
                </div>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="Or type your reason here..." style={S.reasonTextarea} rows={3} />
              </div>
              <div style={S.modalActions}>
                <button onClick={() => setCancelReasonModal(null)} style={S.keepBtn}>Keep Booking</button>
                <button className="btn-danger" onClick={handleCancelConfirm}
                  disabled={cancelling || !cancelReason.trim()}
                  style={{ flex:1, padding:'14px', fontSize:15, opacity:!cancelReason.trim()?0.5:1,
                    background: cancelReasonModal.mode==='request'?'#cc5500':undefined }}>
                  {cancelling ? '⏳ Submitting...' : cancelReasonModal.mode==='request' ? '🔄 Submit Request' : '❌ Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reschedule Step 1 – Pick Flight ── */}
      {rescheduleModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:620 }}>
            <div style={{ background:'linear-gradient(135deg,#001f66,#003399)', borderRadius:'20px 20px 0 0', padding:'24px 28px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h2 style={{ fontFamily:'Montserrat, sans-serif', fontSize:20, fontWeight:800, color:'white', margin:0 }}>
                    {rescheduleModal.leg === 'return' ? '🔄 Reschedule Return Flight' : rescheduleModal.leg === 'both' ? '🔁 Reschedule Both – Step 1: Outbound' : '✈️ Reschedule Outbound Flight'}
                  </h2>
                  <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, margin:'6px 0 0' }}>
                    {rescheduleModal.leg === 'return'
                      ? `${rescheduleModal.booking.returnFlight?.origin} → ${rescheduleModal.booking.returnFlight?.destination}`
                      : `${rescheduleModal.booking.flight?.origin} → ${rescheduleModal.booking.flight?.destination}`
                    }
                    {rescheduleModal.leg === 'both' && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:8 }}>· Return flight picked next</span>}
                  </p>
                </div>
                <button onClick={() => { setRescheduleModal(null); setRescheduleDate(''); }} style={{ ...S.closeBtn, background:'rgba(255,255,255,0.15)', color:'white' }}>✕</button>
              </div>
            </div>
            <div style={{ padding:'20px 24px 28px' }}>
              <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>
                Select a new flight on the same route. A reschedule fee may apply.
              </p>

              {/* ── Date Picker ── */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#444', display:'block', marginBottom:6, letterSpacing:'0.3px' }}>
                  📅 Filter by Date
                </label>
                <input
                  type="date"
                  min={(() => {
                    const isReturnStep = rescheduleModal.leg === 'return' || rescheduleModal.forBoth;
                    if (isReturnStep && rtReturnMinDate) return rtReturnMinDate;
                    const t = new Date(); t.setDate(t.getDate() + 1);
                    return t.toISOString().split('T')[0];
                  })()}
                  value={rescheduleDate}
                  onChange={e => handleRescheduleDateChange(e.target.value)}
                  style={{ border:'1.5px solid #dde4ff', borderRadius:10, padding:'10px 14px', width:'100%', boxSizing:'border-box', fontSize:14, outline:'none', fontFamily:'Inter, sans-serif', background:'#f8f9ff' }}
                />
                {rescheduleDate && (
                  <button
                    onClick={() => handleRescheduleDateChange('')}
                    style={{ background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer', marginTop:5, padding:0, textDecoration:'underline' }}
                  >
                    ✕ Clear date filter
                  </button>
                )}
                {(rescheduleModal.leg === 'return' || rescheduleModal.forBoth) && rtReturnMinDate && (
                  <div style={{ fontSize:11, color:'#cc5500', marginTop:5, fontWeight:600 }}>
                    ⚠️ Return must be on or after{' '}
                    {new Date(rtReturnMinDate + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                  </div>
                )}
              </div>

              <input style={{ border:'1.5px solid #dde4ff', borderRadius:10, padding:'10px 14px', width:'100%', boxSizing:'border-box', marginBottom:14, fontSize:14, outline:'none', fontFamily:'Inter, sans-serif' }}
                placeholder="Search by flight number, city…"
                value={rescheduleSearch} onChange={e => setRescheduleSearch(e.target.value)} />

              {rescheduleLoading ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}><div className="spinner" /></div>
              ) : filteredRescheduleFlights.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'#888' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                  {rescheduleDate ? (
                    <>
                      <p style={{ fontWeight:600, color:'#555' }}>No flights on this date.</p>
                      <p style={{ fontSize:12, marginTop:4 }}>Try a different date or clear the filter.</p>
                      <button
                        onClick={() => handleRescheduleDateChange('')}
                        style={{ marginTop:10, background:'#003399', color:'white', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}
                      >
                        Clear Date Filter
                      </button>
                    </>
                  ) : (
                    <p>No other available flights on this route.</p>
                  )}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:360, overflowY:'auto' }}>
                  {filteredRescheduleFlights.map(fl => {
                    const econPrice = fl.price;
                    const bizPrice = Math.round(fl.price * 1.5);
                    const currentLegFlight = (rescheduleModal.leg === 'return' || rescheduleModal.forBoth)
                      ? rescheduleModal.booking.returnFlight
                      : rescheduleModal.booking.flight;
                    const feeEcon = calcRescheduleFee(rescheduleModal.booking, currentLegFlight, fl, new Date(), 'economy');
                    const feeBiz  = calcRescheduleFee(rescheduleModal.booking, currentLegFlight, fl, new Date(), 'business');
                    return (
                      <div key={fl.id} style={S.flightOption} onClick={() => {
                        if (rescheduleModal.forBoth) {
                          // Step 2: selecting return flight for "both" mode — go to return seat modal
                          handleSelectReturnFlight(fl, rescheduleModal.booking);
                          setRescheduleModal(null);
                        } else {
                          handleSelectNewFlight(fl);
                        }
                      }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:'Montserrat, sans-serif', fontWeight:800, fontSize:15, color:'#003399' }}>{fl.flightNumber}</div>
                          <div style={{ fontSize:13, color:'#555', marginTop:2 }}>
                            📅 {fmtShort(fl.departureTime)} · {new Date(fl.departureTime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
                          </div>
                          <div style={{ fontSize:12, color:'#888', marginTop:2, display:'flex', gap:10 }}>
                            <span>{fl.availableSeats} seats left</span>
                            <span>✈️ ₱{econPrice?.toLocaleString()}</span>
                            <span>👑 ₱{bizPrice?.toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>est. payment</div>
                          <div style={{ fontSize:12, color:'#555' }}>✈️ {feeEcon.totalPayment>0?`+₱${feeEcon.totalPayment.toLocaleString()}`:'Free'}</div>
                          <div style={{ fontSize:12, color:'#cc5500' }}>👑 {feeBiz.totalPayment>0?`+₱${feeBiz.totalPayment.toLocaleString()}`:'Free'}</div>
                          {feeEcon.feePercent>0 && <div style={{ fontSize:11, color:'#aaa' }}>{feeEcon.feePercent}% reschedule fee</div>}
                          <div style={{ marginTop:8, background:'#003399', color:'white', fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, cursor:'pointer' }}>
                            Select →
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reschedule Step 1.5 – Pick New Seats ── */}
      {rescheduleSeatModal && (() => {
        const { booking, newFlight } = rescheduleSeatModal;
        const passengerCount = booking.passengerCount || 1;
        const oldClass = booking.seatClass || 'economy';
        const currentLegFlight = rescheduleLeg === 'return' ? booking.returnFlight : booking.flight;
        const liveFee = calcRescheduleFee(booking, currentLegFlight, newFlight, new Date(), rescheduleNewClass);
        return (
          <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 620 }}>
              <div style={{ background: 'linear-gradient(135deg,#001f66,#003399)', borderRadius: '20px 20px 0 0', padding: '24px 28px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>
                      {rescheduleLeg === 'return' ? '🔄 Select New Return Seats' : rescheduleLeg === 'both' ? '🔁 Outbound Seats (Step 1 of 2)' : '💺 Select New Seats'}
                    </h2>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                      {newFlight.flightNumber} · {newFlight.origin} → {newFlight.destination}
                    </div>
                  </div>
                  <button onClick={() => { setRescheduleSeatModal(null); setRescheduleModal({ booking, leg: rescheduleLeg }); }} style={{ ...S.closeBtn, background: 'rgba(255,255,255,0.15)', color: 'white' }}>✕</button>
                </div>
              </div>

              <div style={{ padding: '20px 24px 28px', maxHeight: '75vh', overflowY: 'auto' }}>

                {/* Class selector */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Seat Class {oldClass !== rescheduleNewClass && <span style={{ color: '#cc5500', fontWeight: 700 }}>(changing from {oldClass})</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['economy', 'business'].map(cls => (
                      <button
                        key={cls}
                        onClick={() => { setRescheduleNewClass(cls); setRescheduleNewSeats([]); }}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                          border: `2px solid ${rescheduleNewClass === cls ? (cls === 'business' ? '#ffd54f' : '#003399') : '#dde4ff'}`,
                          background: rescheduleNewClass === cls ? (cls === 'business' ? '#fff8e1' : '#e8eeff') : 'white',
                          color: rescheduleNewClass === cls ? (cls === 'business' ? '#7a5800' : '#003399') : '#888',
                        }}
                      >
                        {cls === 'business' ? '👑 Business' : '✈️ Economy'}
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: '#888' }}>
                          ₱{cls === 'business' ? Math.round(newFlight.price * 1.5).toLocaleString() : newFlight.price?.toLocaleString()}/pax
                        </div>
                        {cls !== oldClass && cls === 'business' && (
                          <div style={{ fontSize: 11, color: '#cc5500', fontWeight: 700, marginTop: 2 }}>+50% upgrade</div>
                        )}
                        {cls !== oldClass && cls === 'economy' && oldClass === 'business' && (
                          <div style={{ fontSize: 11, color: '#007744', fontWeight: 700, marginTop: 2 }}>downgrade</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live fee preview */}
                {liveFee.allowed && (
                  <div style={{
                    background: liveFee.totalPayment > 0 ? '#fff8e1' : '#e8f5e9',
                    border: `1.5px solid ${liveFee.totalPayment > 0 ? '#ffd54f' : '#00aa55'}`,
                    borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13,
                  }}>
                    <div style={{ fontWeight: 800, color: '#333', marginBottom: 6 }}>💰 Estimated Total Payment</div>
                    {liveFee.classChanged && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                        <span>Class upgrade ({oldClass} → {rescheduleNewClass})</span>
                        <span style={{ fontWeight: 700, color: '#cc5500' }}>+₱{liveFee.totalUpgrade?.toLocaleString()}</span>
                      </div>
                    )}
                    {liveFee.totalFareDiff > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                        <span>Fare difference</span>
                        <span style={{ fontWeight: 700 }}>+₱{liveFee.totalFareDiff?.toLocaleString()}</span>
                      </div>
                    )}
                    {liveFee.totalRescheduleFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                        <span>Reschedule fee ({liveFee.feePercent}%)</span>
                        <span style={{ fontWeight: 700 }}>+₱{liveFee.totalRescheduleFee?.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 6, marginTop: 4 }}>
                      <span style={{ fontWeight: 800 }}>Total Due</span>
                      <span style={{ fontWeight: 900, fontSize: 16, color: liveFee.totalPayment > 0 ? '#cc5500' : '#007744' }}>
                        {liveFee.totalPayment > 0 ? `₱${liveFee.totalPayment.toLocaleString()}` : '✅ Free'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ background: '#fff8e1', border: '1.5px solid #ffd54f', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#856404', fontWeight: 600 }}>
                  ⚠️ Your old seat{passengerCount > 1 ? 's' : ''} (<strong>{(booking.seatNumbers || [booking.seatNumber]).join(', ')}</strong>) may already be taken. Please choose new seats below.
                </div>

                {seatModalLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: '#888' }}>Loading seat availability…</div>
                  </div>
                ) : (
                  <SeatSelector
                    flight={newFlight}
                    bookedSeats={newFlight.bookedSeats || []}
                    passengerCount={passengerCount}
                    seatClass={rescheduleNewClass}
                    onSelect={(seats) => setRescheduleNewSeats(seats)}
                    selectedSeats={rescheduleNewSeats}
                  />
                )}

                {rescheduleNewSeats.length > 0 && (
                  <div style={{ background: '#e8eeff', borderRadius: 10, padding: '10px 16px', marginTop: 12, fontSize: 13, color: '#003399', fontWeight: 600 }}>
                    ✅ Selected: <strong>{rescheduleNewSeats.join(', ')}</strong> · {rescheduleNewClass === 'business' ? '👑 Business' : '✈️ Economy'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button onClick={() => { setRescheduleSeatModal(null); setRescheduleModal({ booking, leg: rescheduleLeg }); }} style={S.keepBtn}>← Back</button>
                  <button
                    disabled={rescheduleNewSeats.length < passengerCount}
                    onClick={() => {
                      const currentFlight = rescheduleLeg === 'return' ? booking.returnFlight : booking.flight;
                      const outFee = calcRescheduleFee(booking, currentFlight, newFlight, new Date(), rescheduleNewClass);

                      if (rescheduleLeg === 'both') {
                        // Store outbound selection, then open return FLIGHT picker (forBoth=true)
                        const outboundSelection = {
                          ...rescheduleSeatModal,
                          leg: 'both',
                          newSeats: rescheduleNewSeats,
                          newSeatClass: rescheduleNewClass,
                          fee: outFee,
                          awaitingReturn: true,
                        };
                        setRescheduleFeeModal(outboundSelection);
                        setRescheduleSeatModal(null);
                        // Load return flights directly (don't use handleRescheduleClick — it resets rescheduleLeg)
                        setRescheduleSearch('');
                        setRescheduleFlights([]);
                        setRescheduleLoading(true);
                        const retFlight = booking.returnFlight;
                        const params = new URLSearchParams();
                        if (retFlight?.origin)      params.append('origin', retFlight.origin);
                        if (retFlight?.destination) params.append('destination', retFlight.destination);
                        api.get(`/flights?${params.toString()}`)
                          .then(data => {
                            // For "both" legs: return must be the DAY AFTER the new outbound flight
                            const newOutboundDep = newFlight?.departureTime
                              ? new Date(newFlight.departureTime)
                              : new Date();
                            const outboundDay = new Date(newOutboundDep);
                            outboundDay.setHours(0,0,0,0);
                            // Set the min date for the return date picker
                            const nextDay = new Date(outboundDay);
                            nextDay.setDate(nextDay.getDate() + 1);
                            const minReturnDate = nextDay.getFullYear() + '-' + String(nextDay.getMonth()+1).padStart(2,'0') + '-' + String(nextDay.getDate()).padStart(2,'0');
                            setRtReturnMinDate(minReturnDate);
                            setRescheduleDate(''); // reset date filter for return step
                            const now = new Date();
                            const available = (data.flights || []).filter(fl => {
                              if (fl.id === booking.returnFlightId) return false;
                              const flDep = new Date(fl.departureTime);
                              if (flDep <= now) return false;
                              // Return must be NEXT DAY or later after outbound
                              const returnDay = new Date(flDep);
                              returnDay.setHours(0,0,0,0);
                              if (returnDay <= outboundDay) return false;
                              return true;
                            });
                            setAllRescheduleFlights(available);
                            setRescheduleFlights(available);
                          })
                          .catch(() => toast.error('Failed to load return flights'))
                          .finally(() => setRescheduleLoading(false));
                        // Open flight picker marked as "forBoth" (step 2) — reset date filter
                        setRescheduleDate('');
                        setRescheduleSearch('');
                        setRescheduleModal({ booking, leg: 'return', forBoth: true });
                      } else {
                        setRescheduleFeeModal({
                          ...rescheduleSeatModal,
                          leg: rescheduleLeg,
                          newSeats: rescheduleNewSeats,
                          newSeatClass: rescheduleNewClass,
                          fee: { ...outFee, leg: rescheduleLeg },
                        });
                        setRescheduleSeatModal(null);
                        setRescheduleReason('');
                      }
                    }}
                    style={{
                      flex: 1, padding: '14px', fontSize: 15, fontWeight: 700,
                      background: rescheduleNewSeats.length < passengerCount ? '#aabbdd' : '#003399',
                      color: 'white', border: 'none', borderRadius: 10,
                      cursor: rescheduleNewSeats.length < passengerCount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {rescheduleNewSeats.length < passengerCount
                      ? `Select ${passengerCount - rescheduleNewSeats.length} more seat(s)…`
                      : rescheduleLeg === 'both' ? 'Next: Pick Return Seats →' : 'Continue to Fee Review →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: Reschedule Step 1.75 – Return Seats (for "both" legs) ── */}
      {rtReturnSeatModal && (() => {
        const { booking, flight: retFlight } = rtReturnSeatModal;
        const pax = booking.passengerCount || 1;
        // Calculate live combined fee
        const outFee = rescheduleFeeModal?.fee;
        const livRetFee = calcRescheduleFee(booking, booking.returnFlight, retFlight, new Date(), rtReturnNewClass);
        const combinedPayment = (outFee?.totalPayment || 0) + (livRetFee?.totalPayment || 0);
        return (
          <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 620 }}>
              <div style={{ background: 'linear-gradient(135deg,#004400,#006633)', borderRadius: '20px 20px 0 0', padding: '24px 28px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>
                      🔄 Return Seats (Step 2 of 2)
                    </h2>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                      {retFlight.flightNumber} · {retFlight.origin} → {retFlight.destination}
                    </div>
                  </div>
                  <button onClick={() => setRtReturnSeatModal(null)} style={{ ...S.closeBtn, background: 'rgba(255,255,255,0.15)', color: 'white' }}>✕</button>
                </div>
              </div>

              <div style={{ padding: '20px 24px 28px', maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Class selector */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Return Seat Class
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['economy', 'business'].map(cls => (
                      <button key={cls} onClick={() => { setRtReturnNewClass(cls); setRtReturnNewSeats([]); }}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                          border: `2px solid ${rtReturnNewClass === cls ? (cls === 'business' ? '#ffd54f' : '#003399') : '#dde4ff'}`,
                          background: rtReturnNewClass === cls ? (cls === 'business' ? '#fff8e1' : '#e8eeff') : 'white',
                          color: rtReturnNewClass === cls ? (cls === 'business' ? '#7a5800' : '#003399') : '#888' }}>
                        {cls === 'business' ? '👑 Business' : '✈️ Economy'}
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          ₱{cls === 'business' ? Math.round(retFlight.price * 1.5).toLocaleString() : retFlight.price?.toLocaleString()}/pax
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Combined fee preview */}
                <div style={{ background: combinedPayment > 0 ? '#fff8e1' : '#e8f5e9', border: `1.5px solid ${combinedPayment > 0 ? '#ffd54f' : '#00aa55'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 800, color: '#333', marginBottom: 6 }}>💰 Combined Total (Both Legs)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                    <span>Outbound reschedule fee</span>
                    <span style={{ fontWeight: 700 }}>₱{(outFee?.totalPayment || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                    <span>Return reschedule fee</span>
                    <span style={{ fontWeight: 700 }}>₱{(livRetFee?.totalPayment || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 6, marginTop: 4 }}>
                    <span style={{ fontWeight: 800 }}>Total Due</span>
                    <span style={{ fontWeight: 900, fontSize: 16, color: combinedPayment > 0 ? '#cc5500' : '#007744' }}>
                      {combinedPayment > 0 ? `₱${combinedPayment.toLocaleString()}` : '✅ Free'}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#fff8e1', border: '1.5px solid #ffd54f', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#856404', fontWeight: 600 }}>
                  ⚠️ Old return seats (<strong>{(booking.returnSeatNumbers || booking.seatNumbers || [booking.seatNumber]).join(', ')}</strong>) may be taken. Please choose new seats.
                </div>

                {rtReturnSeatLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: '#888' }}>Loading return seat availability…</div>
                  </div>
                ) : (
                  <SeatSelector
                    flight={retFlight}
                    bookedSeats={retFlight.bookedSeats || []}
                    passengerCount={pax}
                    seatClass={rtReturnNewClass}
                    onSelect={setRtReturnNewSeats}
                    selectedSeats={rtReturnNewSeats}
                  />
                )}

                {rtReturnNewSeats.length > 0 && (
                  <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#007744', fontWeight: 600 }}>
                    ✅ Return seats selected: <strong>{rtReturnNewSeats.join(', ')}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button onClick={() => {
                    setRtReturnSeatModal(null);
                    // Restore outbound seat modal with the stored outbound flight & seats
                    if (rescheduleFeeModal?.newFlight) {
                      setRescheduleSeatModal({ booking, newFlight: rescheduleFeeModal.newFlight, leg: 'both' });
                      setRescheduleNewSeats(rescheduleFeeModal.newSeats || []);
                      setRescheduleNewClass(rescheduleFeeModal.newSeatClass || booking.seatClass || 'economy');
                    }
                  }} style={S.keepBtn}>← Back</button>
                  <button
                    disabled={rtReturnNewSeats.length < pax}
                    onClick={() => {
                      const finalRetFee = calcRescheduleFee(booking, booking.returnFlight, retFlight, new Date(), rtReturnNewClass);
                      const finalCombined = {
                        leg: 'both',
                        totalPayment: (outFee?.totalPayment || 0) + (finalRetFee?.totalPayment || 0),
                        outbound: outFee,
                        return: finalRetFee,
                        allowed: (outFee?.allowed !== false) && (finalRetFee?.allowed !== false),
                        feePercent: outFee?.feePercent,
                        ruleLabel: outFee?.ruleLabel,
                        totalRescheduleFee: (outFee?.totalRescheduleFee || 0) + (finalRetFee?.totalRescheduleFee || 0),
                        totalFareDiff: (outFee?.totalFareDiff || 0) + (finalRetFee?.totalFareDiff || 0),
                      };
                      setRescheduleFeeModal(prev => ({
                        ...prev,
                        leg: 'both',
                        fee: finalCombined,
                        awaitingReturn: false,
                        returnFlight: retFlight,
                        returnSeats: rtReturnNewSeats,
                        returnSeatClass: rtReturnNewClass,
                      }));
                      setRtReturnSeatModal(null);
                      setRtReturnFlight(retFlight);
                      setRescheduleReason('');
                    }}
                    style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 700,
                      background: rtReturnNewSeats.length < pax ? '#aabbdd' : '#006633',
                      color: 'white', border: 'none', borderRadius: 10,
                      cursor: rtReturnNewSeats.length < pax ? 'not-allowed' : 'pointer' }}>
                    {rtReturnNewSeats.length < pax
                      ? `Select ${pax - rtReturnNewSeats.length} more seat(s)…`
                      : 'Review Combined Fee →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: Reschedule Step 2 – Confirm Fee ── */}
      {rescheduleFeeModal && !rescheduleFeeModal.awaitingReturn && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:520 }}>
            <div style={{ background:'linear-gradient(135deg,#001f66,#003399)', borderRadius:'20px 20px 0 0', padding:'24px 28px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h2 style={{ fontFamily:'Montserrat, sans-serif', fontSize:20, fontWeight:800, color:'white', margin:0 }}>✈️ Confirm Reschedule</h2>
                  {rescheduleFeeModal.fee?.leg === 'both' && (
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)', marginTop:4 }}>Both outbound + return legs</div>
                  )}
                  {rescheduleFeeModal.fee?.classChanged && (
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:4, fontWeight:600 }}>
                      Class change: {rescheduleFeeModal.fee.oldClass} → {rescheduleFeeModal.fee.newClass}
                    </div>
                  )}
                </div>
                <button onClick={() => { setRescheduleFeeModal(null); }} style={{ ...S.closeBtn, background:'rgba(255,255,255,0.15)', color:'white' }}>✕</button>
              </div>
            </div>
            <div style={{ padding:'24px 28px 28px', maxHeight:'75vh', overflowY:'auto' }}>

              {/* Flight change summary */}
              {rescheduleFeeModal.fee?.leg === 'both' ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ flex:1, background:'#fff5f5', borderRadius:10, padding:'10px 14px', border:'1.5px solid #ffcccc' }}>
                      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>✈️ Outbound (old)</div>
                      <div style={{ fontWeight:800, color:'#cc2222', fontSize:14 }}>{rescheduleFeeModal.booking.flight?.flightNumber}</div>
                    </div>
                    <div style={{ fontSize:18, color:'#99aadd' }}>→</div>
                    <div style={{ flex:1, background:'#f0fff4', borderRadius:10, padding:'10px 14px', border:'1.5px solid #99ddaa' }}>
                      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>✈️ Outbound (new)</div>
                      <div style={{ fontWeight:800, color:'#00aa55', fontSize:14 }}>{rescheduleFeeModal.newFlight?.flightNumber}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ flex:1, background:'#fff5f5', borderRadius:10, padding:'10px 14px', border:'1.5px solid #ffcccc' }}>
                      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>🔄 Return (old)</div>
                      <div style={{ fontWeight:800, color:'#cc2222', fontSize:14 }}>{rescheduleFeeModal.booking.returnFlight?.flightNumber}</div>
                    </div>
                    <div style={{ fontSize:18, color:'#99aadd' }}>→</div>
                    <div style={{ flex:1, background:'#f0fff4', borderRadius:10, padding:'10px 14px', border:'1.5px solid #99ddaa' }}>
                      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>🔄 Return (new)</div>
                      <div style={{ fontWeight:800, color:'#00aa55', fontSize:14 }}>{rescheduleFeeModal.returnFlight?.flightNumber}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
                  <div style={{ flex:1, background:'#fff5f5', borderRadius:12, padding:'12px 16px', border:'1.5px solid #ffcccc' }}>
                    <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>
                      {rescheduleFeeModal.fee?.leg === 'return' ? '🔄 Return — Original' : '✈️ Original Flight'}
                    </div>
                    <div style={{ fontWeight:800, color:'#cc2222', fontSize:15 }}>
                      {rescheduleFeeModal.fee?.leg === 'return'
                        ? rescheduleFeeModal.booking.returnFlight?.flightNumber
                        : rescheduleFeeModal.booking.flight?.flightNumber}
                    </div>
                    <div style={{ fontSize:12, color:'#666', marginTop:2 }}>
                      {rescheduleFeeModal.fee?.leg === 'return'
                        ? (rescheduleFeeModal.booking.returnFlight?.departureTime && fmtShort(rescheduleFeeModal.booking.returnFlight.departureTime))
                        : (rescheduleFeeModal.booking.flight?.departureTime && fmtShort(rescheduleFeeModal.booking.flight.departureTime))}
                    </div>
                  </div>
                  <div style={{ fontSize:24, color:'#99aadd' }}>→</div>
                  <div style={{ flex:1, background:'#f0fff4', borderRadius:12, padding:'12px 16px', border:'1.5px solid #99ddaa' }}>
                    <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>New Flight</div>
                    <div style={{ fontWeight:800, color:'#00aa55', fontSize:15 }}>{rescheduleFeeModal.newFlight?.flightNumber}</div>
                    <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{rescheduleFeeModal.newFlight?.departureTime && fmtShort(rescheduleFeeModal.newFlight.departureTime)}</div>
                  </div>
                </div>
              )}

              {!rescheduleFeeModal.fee.allowed ? (
                <div style={{ background:'#ffe8e8', border:'1.5px solid #ffaaaa', borderRadius:12, padding:'20px', marginBottom:20, textAlign:'center' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🚫</div>
                  <div style={{ fontWeight:800, color:'#cc2222', fontSize:15 }}>Rescheduling Not Allowed</div>
                  <div style={{ color:'#cc2222', fontSize:13, marginTop:4 }}>Less than 24 hours before departure.</div>
                </div>
              ) : (
                <>
                  {/* For both-leg, show per-leg breakdowns */}
                  {rescheduleFeeModal.fee?.leg === 'both' ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                      {rescheduleFeeModal.fee.outbound && (
                        <div style={{ background:'#f0f4ff', border:'1px solid #dde4ff', borderRadius:10, padding:'12px 16px' }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#003399', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>✈️ Outbound fee</div>
                          <FeeBreakdownCard fee={rescheduleFeeModal.fee.outbound} type="reschedule" />
                        </div>
                      )}
                      {rescheduleFeeModal.fee.return && (
                        <div style={{ background:'#f0fff4', border:'1px solid #99ddaa', borderRadius:10, padding:'12px 16px' }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#007744', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>🔄 Return fee</div>
                          <FeeBreakdownCard fee={rescheduleFeeModal.fee.return} type="reschedule" />
                        </div>
                      )}
                      <div style={{ background:'#fff8e1', border:'2px solid #ffd54f', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:800, fontSize:14 }}>Combined Total</span>
                        <span style={{ fontWeight:900, fontSize:20, color:'#cc5500', fontFamily:'Montserrat, sans-serif' }}>
                          ₱{(rescheduleFeeModal.fee.totalPayment||0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <FeeBreakdownCard fee={rescheduleFeeModal.fee} type="reschedule" />
                  )}

                  <div style={S.reasonSection}>
                    <label style={S.reasonLabel}>Reason for Rescheduling (optional)</label>
                    <textarea value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)}
                      placeholder="e.g. Change of travel plans..." style={S.reasonTextarea} rows={2} />
                  </div>
                  <div style={{ ...S.warningBox, marginBottom:20,
                    background: (rescheduleFeeModal.fee.totalPayment||0) > 0 ? '#fff8e1' : '#e8f5e9',
                    borderColor: (rescheduleFeeModal.fee.totalPayment||0) > 0 ? '#ffc107' : '#00aa55',
                    color: (rescheduleFeeModal.fee.totalPayment||0) > 0 ? '#856404' : '#006633',
                  }}>
                    {(rescheduleFeeModal.fee.totalPayment||0) > 0
                      ? `💳 Payment of ₱${(rescheduleFeeModal.fee.totalPayment||0).toLocaleString()} required. You will be redirected to GCash payment after confirming.`
                      : '✅ No payment required. Your request will go directly to admin review.'}
                  </div>
                </>
              )}

              <div style={S.modalActions}>
                <button onClick={() => {
                  const fm = rescheduleFeeModal;
                  setRescheduleFeeModal(null);
                  setRescheduleSeatModal({ booking: fm.booking, newFlight: fm.newFlight, leg: fm.leg || rescheduleLeg });
                  setRescheduleNewSeats(fm.newSeats || []);
                  setRescheduleNewClass(fm.newSeatClass || fm.booking?.seatClass || 'economy');
                }} style={S.keepBtn}>← Back</button>
                {rescheduleFeeModal.fee.allowed && (
                  <button onClick={handleRescheduleConfirm} disabled={rescheduling}
                    style={{ flex:1, padding:'14px', fontSize:15, fontWeight:700,
                      background: (rescheduleFeeModal.fee.totalPayment||0) > 0 ? 'linear-gradient(135deg,#cc5500,#ff7700)' : '#003399',
                      color:'white', border:'none', borderRadius:10, cursor:'pointer', opacity:rescheduling?0.6:1 }}>
                    {rescheduling
                      ? '⏳ Processing...'
                      : (rescheduleFeeModal.fee.totalPayment||0) > 0
                        ? `💳 Confirm & Pay ₱${(rescheduleFeeModal.fee.totalPayment||0).toLocaleString()}`
                        : '✈️ Submit Reschedule Request'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────
// ── RebookModal styles ────────────────────────────────────────────────────────
const RBS = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600,
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,51,0.35)', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', background: 'linear-gradient(135deg,#001f66,#003399)',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: 'Montserrat, sans-serif' },
  headerSub:   { fontSize: 12, color: '#aabfff', marginTop: 3 },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16,
  },
  stepBar: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '14px 24px', background: '#f8faff', borderBottom: '1px solid #eef0ff',
    flexShrink: 0,
  },
  stepDot: {
    width: 26, height: 26, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
  },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  cancelledInfo: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#fff5f5', border: '1.5px solid #ffcccc', borderRadius: 10,
    padding: '10px 14px', marginBottom: 14,
  },
  flightCard: {
    width: '100%', padding: '14px 16px', borderRadius: 10, textAlign: 'left',
    border: '1.5px solid #dde4ff', background: '#fafbff', cursor: 'pointer',
    transition: 'all 0.15s', fontFamily: 'inherit',
  },
  chosenFlightBadge: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#e8eeff', border: '1.5px solid #99aadd', borderRadius: 10,
    padding: '12px 16px', marginBottom: 16,
  },
  changeBtn: {
    fontSize: 12, fontWeight: 700, color: '#003399', background: 'none',
    border: '1.5px solid #99aadd', borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
  },
  summaryCard: {
    background: '#f8faff', border: '1.5px solid #dde4ff', borderRadius: 12,
    padding: '14px 18px', marginBottom: 14,
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid #eef0ff',
  },
  summaryLabel: { fontSize: 12, color: '#888', fontWeight: 500 },
  summaryValue: { fontSize: 13, color: '#1a1a2e', fontWeight: 700 },
  primaryBtn: {
    width: '100%', padding: '13px', borderRadius: 8,
    fontWeight: 700, fontSize: 14, border: 'none',
    transition: 'background 0.2s',
  },
  secondaryBtn: {
    width: '100%', padding: '11px', borderRadius: 8, fontWeight: 700, fontSize: 13,
    background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', cursor: 'pointer',
    marginTop: 8,
  },
};

const S = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 },
  title:  { fontFamily:'Montserrat, sans-serif', fontSize:28, fontWeight:800, color:'#003399' },
  empty:  { textAlign:'center', padding:'80px 20px', background:'white', borderRadius:16, border:'1px solid #dde4ff' },
  list:   { display:'flex', flexDirection:'column', gap:16 },
  filterBar:  { background:'white', borderRadius:14, border:'1px solid #dde4ff', padding:'16px 20px', marginBottom:20, display:'flex', flexDirection:'column', gap:12, boxShadow:'0 2px 12px rgba(0,51,153,0.06)' },
  searchWrap: { display:'flex', alignItems:'center', background:'#f8faff', border:'1.5px solid #dde4ff', borderRadius:10, padding:'0 12px', gap:8 },
  searchIcon: { fontSize:16, opacity:0.5 },
  searchInput:{ flex:1, border:'none', background:'transparent', padding:'10px 4px', fontSize:14, color:'#1a1a2e', outline:'none', fontFamily:'Inter, sans-serif' },
  clearBtn:   { background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, padding:'4px', lineHeight:1 },
  statusTabs: { display:'flex', gap:8, flexWrap:'wrap' },
  statusTab:  { display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, border:'1.5px solid #dde4ff', background:'white', color:'#555', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif' },
  statusTabActive: { background:'#003399', borderColor:'#003399', color:'white' },
  tabCount:   { background:'#eef0ff', color:'#555', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:800 },
  tabCountActive: { background:'rgba(255,255,255,0.25)', color:'white' },
  bookingCard: { background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,51,153,0.08)', border:'1px solid #dde4ff' },
  cardHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', background:'#f8faff', borderBottom:'1px solid #eef0ff', flexWrap:'wrap', gap:8 },
  refInfo:     { display:'flex', flexDirection:'column' },
  refLabel:    { fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:0.5 },
  refNum:      { fontSize:18, fontWeight:800, color:'#003399', fontFamily:'Montserrat, sans-serif', letterSpacing:1 },
  cardBody:    { padding:'20px 24px' },
  flightInfo:  { marginBottom:12 },
  flightRoute: { display:'flex', alignItems:'center', gap:12, marginBottom:10 },
  routeCode:   { fontSize:28, fontWeight:900, color:'#1a1a2e', fontFamily:'Montserrat, sans-serif' },
  routeArrow:  { color:'#99aadd', fontSize:14 },
  flightMeta:  { display:'flex', gap:16, flexWrap:'wrap', fontSize:14, color:'#555' },
  legTag: (color) => ({ display:'inline-block', fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase', color, marginBottom:6, padding:'2px 8px', borderRadius:4, background:`${color}12`, border:`1px solid ${color}33` }),
  priceRow:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, flexWrap:'wrap', gap:8 },
  priceBreakdown: { display:'flex', alignItems:'center', flexWrap:'wrap' },
  paymentStatus:  { display:'flex', alignItems:'center', gap:8 },
  cardFooter:  { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px', background:'#f8faff', borderTop:'1px solid #eef0ff', flexWrap:'wrap', gap:12 },
  bookingDate: { fontSize:12, color:'#888' },
  actions:     { display:'flex', gap:10, flexWrap:'wrap' },
  timerBanner: { display:'flex', alignItems:'center', gap:10, padding:'10px 24px', borderLeft:'4px solid #ffa000', borderTop:'1px solid #ffc107' },
  expiredBanner:  { background:'#ffe8e8', padding:'10px 24px', fontSize:13, color:'#cc2222', fontWeight:700, borderTop:'1px solid #ffcccc' },
  rescheduleNote: { background:'#e8eeff', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#003399', fontWeight:600, marginBottom:12 },
  requestCancelBtn: { background:'white', color:'#cc5500', border:'2px solid #ffaa66', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' },
  rescheduleBtn:    { background:'white', color:'#003399', border:'2px solid #99aadd', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' },
  pendingNote: { fontSize:12, fontWeight:700, color:'#cc5500', background:'#fff0e0', padding:'6px 12px', borderRadius:8, border:'1px solid #ffaa66' },
  rejectionNote: { background:'#ffe8e8', padding:'10px 24px', fontSize:13, color:'#cc2222', borderTop:'1px solid #ffcccc' },
  feeCard:      { background:'#fff8f0', border:'1.5px solid #ffaa66', borderRadius:12, padding:'16px 20px', margin:'12px 0' },
  feeCardTitle: { fontSize:12, fontWeight:800, color:'#cc5500', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 },
  feeTable:     { display:'flex', flexDirection:'column' },
  feeRow:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #ffe0cc' },
  feeLabel:     { fontSize:13, color:'#555' },
  feeVal:       { fontSize:13, fontWeight:700, color:'#1a1a2e' },
  feePolicy:    { fontSize:11, color:'#888', fontStyle:'italic', marginTop:10 },
  feeFreeBadge: { background:'#e6fff3', color:'#007744', fontWeight:800, fontSize:12, borderRadius:8, padding:'6px 14px', marginTop:10, textAlign:'center' },
  flightOption: { display:'flex', alignItems:'center', gap:12, background:'#f8faff', borderRadius:12, padding:'14px 16px', border:'1.5px solid #dde4ff', cursor:'pointer' },
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 },
  modal:    { background:'white', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'90vh', overflow:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.35)' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'24px 28px 20px', borderBottom:'1px solid #eef0ff', background:'#fff5f5' },
  modalTitle:  { fontFamily:'Montserrat, sans-serif', fontSize:20, fontWeight:800, color:'#cc2222', margin:'0 0 4px' },
  modalRef:    { fontSize:13, fontWeight:700, color:'#003399', fontFamily:'Montserrat, sans-serif', letterSpacing:1 },
  closeBtn:    { background:'#f0f0f0', border:'none', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, color:'#666', flexShrink:0 },
  modalBody:   { padding:'24px 28px' },
  warningBox:  { background:'#fff3cd', border:'1.5px solid #ffc107', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#856404', marginBottom:20, lineHeight:1.5 },
  reasonSection: { marginBottom:20 },
  reasonLabel: { fontSize:14, fontWeight:700, color:'#1a1a2e', display:'block', marginBottom:10 },
  reasonQuickPicks: { display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 },
  quickPickBtn: { padding:'6px 14px', borderRadius:20, border:'1.5px solid #dde4ff', background:'white', fontSize:12, fontWeight:600, color:'#555', cursor:'pointer' },
  quickPickBtnActive: { background:'#cc2222', color:'white', borderColor:'#cc2222' },
  reasonTextarea: { width:'100%', padding:'12px 14px', border:'2px solid #dde4ff', borderRadius:10, fontSize:14, fontFamily:'Inter, sans-serif', resize:'vertical', boxSizing:'border-box', outline:'none' },
  modalActions: { display:'flex', gap:12 },
  keepBtn:     { flex:1, padding:'14px', fontSize:15, fontWeight:700, background:'white', color:'#003399', border:'2px solid #dde4ff', borderRadius:10, cursor:'pointer' },
};

export default MyBookings;
