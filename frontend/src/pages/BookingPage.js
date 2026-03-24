import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import SeatSelector, { getSeatClass } from '../components/SeatSelector';
import { toast } from 'react-toastify';

const BUSINESS_SURCHARGE = 0.5;

const BookingPage = () => {
  const { flightId } = useParams();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const returnFlightId = queryParams.get('returnFlightId');
  const tripType = queryParams.get('tripType') || 'oneway';
  const isRoundTrip = tripType === 'roundtrip' && !!returnFlightId;
  const passengerCount = Math.min(9, Math.max(1, parseInt(queryParams.get('passengers') || '1', 10)));

  const [flight, setFlight] = useState(null);
  const [returnFlight, setReturnFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedReturnSeats, setSelectedReturnSeats] = useState([]);
  const [seatClass, setSeatClass] = useState('economy');
  const [returnSeatClass, setReturnSeatClass] = useState('economy');

  // Per-passenger details: array of { name, email, phone }
  const [passengers, setPassengers] = useState(
    Array.from({ length: passengerCount }, () => ({ name: '', email: '', phone: '' }))
  );
  // Track which passenger accordion is expanded
  const [activePassenger, setActivePassenger] = useState(0);
  const [formTouched, setFormTouched] = useState(false);
  const formTouchedRef = useRef(false);

  // Keep ref in sync so event listeners always see current value
  useEffect(() => { formTouchedRef.current = formTouched; }, [formTouched]);

  // Guard 1: browser refresh / tab close
  useEffect(() => {
    const handler = (e) => {
      if (!formTouchedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Guard 2: browser back button (popstate)
  useEffect(() => {
    const handler = (e) => {
      if (!formTouchedRef.current) return;
      // Push state back so the URL doesn't change yet
      window.history.pushState(null, '', window.location.href);
      const confirmed = window.confirm(
        'Are you sure you want to leave? Your seat reservation may be lost.'
      );
      if (confirmed) {
        formTouchedRef.current = false;
        setFormTouched(false);
        window.history.back();
      }
    };
    // Push a dummy state so the first back press is interceptable
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    document.title = 'Book a Flight – Cebu Airline'; fetchFlights(); }, [flightId]);

  useEffect(() => {
    if (userProfile) {
      setPassengers(prev => prev.map((p, i) =>
        i === 0
          ? { name: userProfile.name || '', email: userProfile.email || '', phone: userProfile.phone || '' }
          : p
      ));
    }
  }, [userProfile]);

  const fetchFlights = async () => {
    try {
      const data = await api.get(`/flights/${flightId}`);
      setFlight(data);
      if (isRoundTrip) {
        const retData = await api.get(`/flights/${returnFlightId}`);
        setReturnFlight(retData);
      }
    } catch {
      toast.error('Flight not found');
      navigate('/search');
    } finally {
      setLoading(false);
    }
  };

  const baseFare = flight?.price || 0;
  const returnFare = returnFlight?.price || 0;
  const classFare = seatClass === 'business' ? Math.round(baseFare * (1 + BUSINESS_SURCHARGE)) : baseFare;
  const returnClassFare = (isRoundTrip ? returnSeatClass : seatClass) === 'business'
    ? Math.round(returnFare * (1 + BUSINESS_SURCHARGE))
    : returnFare;
  const surcharge = classFare - baseFare;
  const returnSurcharge = returnClassFare - returnFare;
  const totalFare = isRoundTrip
    ? (classFare + returnClassFare) * passengerCount
    : classFare * passengerCount;

  const handleClassChange = (cls) => setSeatClass(cls);
  const handleReturnClassChange = (cls) => setReturnSeatClass(cls);

  const updatePassenger = (index, field, value) => {
    setFormTouched(true);
    setPassengers(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedSeats.length < passengerCount) {
      return toast.error(`Please select ${passengerCount} outbound seat${passengerCount > 1 ? 's' : ''}. You've selected ${selectedSeats.length}.`);
    }
    if (isRoundTrip && selectedReturnSeats.length < passengerCount) {
      return toast.error(`Please select ${passengerCount} return seat${passengerCount > 1 ? 's' : ''}. You've selected ${selectedReturnSeats.length}.`);
    }
    for (let i = 0; i < passengerCount; i++) {
      if (!passengers[i]?.name?.trim()) return toast.error(`Please enter a name for Passenger ${i + 1}`);
      if (!passengers[i]?.email?.trim()) return toast.error(`Please enter an email for Passenger ${i + 1}`);
    }
    // Navigate to review page with all booking data
    setFormTouched(false);
    navigate('/review-booking', {
      state: {
        flightId,
        flight,
        returnFlightId: isRoundTrip ? returnFlightId : null,
        returnFlight: isRoundTrip ? returnFlight : null,
        passengers,
        selectedSeats,
        selectedReturnSeats: isRoundTrip ? selectedReturnSeats : [],
        seatClass,
        returnSeatClass: isRoundTrip ? returnSeatClass : seatClass,
        passengerCount,
        tripType,
        baseFare,
        returnFare,
        classFare,
        returnClassFare,
        surcharge,
        returnSurcharge,
        totalFare,
        isRoundTrip,
      }
    });
  };

  const formatTime = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dt) => new Date(dt).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatDateShort = (dt) => new Date(dt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <div className="container"><div className="spinner" /></div>;
  if (!flight) return null;

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container">
        <div style={styles.header}>
          <h1 style={styles.title}>Book Your Flight</h1>
          <div style={styles.flightBadge}>{flight.flightNumber}</div>
          <div style={{
            ...styles.tripTypeBadge,
            background: isRoundTrip ? '#e8f5e9' : '#e8eeff',
            color: isRoundTrip ? '#007744' : '#003399',
            border: `1.5px solid ${isRoundTrip ? '#00aa55' : '#99aadd'}`,
          }}>
            {isRoundTrip ? '🔄 Round Trip' : '➡️ One Way'}
          </div>
          {passengerCount > 1 && (
            <div style={{ background: '#fff8e1', color: '#cc8800', border: '1.5px solid #ffd54f', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
              👥 {passengerCount} Passengers
            </div>
          )}
        </div>

        {/* Outbound Flight Summary */}
        <div style={styles.flightSummary}>
          {isRoundTrip && <div style={styles.legLabel}>✈️ Outbound Flight</div>}
          <div style={styles.summaryRoute}>
            <div style={styles.summaryPoint}>
              <div style={styles.summaryCode}>{flight.origin}</div>
              <div style={styles.summaryCity}>{flight.originCity}</div>
              <div style={styles.summaryTime}>{formatTime(flight.departureTime)}</div>
            </div>
            <div style={styles.summaryArrow}>✈ ─────────</div>
            <div style={styles.summaryPoint}>
              <div style={styles.summaryCode}>{flight.destination}</div>
              <div style={styles.summaryCity}>{flight.destinationCity}</div>
              <div style={styles.summaryTime}>{formatTime(flight.arrivalTime)}</div>
            </div>
          </div>
          <div style={styles.summaryMeta}>
            <div style={styles.metaItem}>📅 {formatDate(flight.departureTime)}</div>
            <div style={styles.metaItem}>✈️ {flight.aircraft}</div>
            <div style={styles.metaItem}>💺 {flight.availableSeats} seats available</div>
            <div style={styles.metaPrice}>₱{flight.price?.toLocaleString()}</div>
          </div>
        </div>

        {/* Return Flight Summary (Round Trip only) */}
        {isRoundTrip && returnFlight && (
          <div style={{ ...styles.flightSummary, background: 'linear-gradient(135deg, #005533, #007744)', marginBottom: 20 }}>
            <div style={styles.legLabel}>🔄 Return Flight</div>
            <div style={styles.summaryRoute}>
              <div style={styles.summaryPoint}>
                <div style={styles.summaryCode}>{returnFlight.origin}</div>
                <div style={styles.summaryCity}>{returnFlight.originCity}</div>
                <div style={styles.summaryTime}>{formatTime(returnFlight.departureTime)}</div>
              </div>
              <div style={styles.summaryArrow}>✈ ─────────</div>
              <div style={styles.summaryPoint}>
                <div style={styles.summaryCode}>{returnFlight.destination}</div>
                <div style={styles.summaryCity}>{returnFlight.destinationCity}</div>
                <div style={styles.summaryTime}>{formatTime(returnFlight.arrivalTime)}</div>
              </div>
            </div>
            <div style={styles.summaryMeta}>
              <div style={styles.metaItem}>📅 {formatDate(returnFlight.departureTime)}</div>
              <div style={styles.metaItem}>✈️ {returnFlight.aircraft}</div>
              <div style={styles.metaItem}>💺 {returnFlight.availableSeats} seats available</div>
              <div style={styles.metaPrice}>₱{returnFlight.price?.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Class Info — one-way: shared toggle; round-trip: per-leg info note */}
        {isRoundTrip ? (
          <div style={{ background: '#f0f4ff', border: '1.5px solid #dde4ff', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#003399', fontWeight: 600 }}>
            💡 Select seats in each section below — class is set independently per leg (Business = rows 1–4, Economy = rows 5–24).
          </div>
        ) : (
          <div style={styles.classBadges}>
            <div style={styles.classBadge('#ffd54f', '#7a5800', seatClass === 'business')}>
              <span>👑</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Business Class</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Rows 1–4 · ₱{Math.round(baseFare * 1.5).toLocaleString()}</div>
              </div>
            </div>
            <div style={styles.classBadge('#99aadd', '#003399', seatClass === 'economy')}>
              <span>✈️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Economy Class</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Rows 5–24 · ₱{baseFare.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.grid}>
          {/* Left: Seat Selection */}
          <div>
            <div className="card" style={{ marginBottom: isRoundTrip ? 20 : 0 }}>
              <h2 style={styles.sectionTitle}>
                {isRoundTrip ? '✈️ Outbound Seats' : 'Select Your Seat'}{passengerCount > 1 ? ` (${passengerCount} required)` : ''}
              </h2>
              {isRoundTrip && (
                <div style={{ fontSize: 13, color: '#003399', fontWeight: 700, marginBottom: 12, background: '#e8eeff', borderRadius: 8, padding: '6px 12px' }}>
                  {flight.origin} → {flight.destination} · {flight.flightNumber}
                </div>
              )}
              <SeatSelector
                bookedSeats={flight.bookedSeats || []}
                selectedSeats={selectedSeats}
                passengerCount={passengerCount}
                onSelect={(seats) => {
                  setFormTouched(true);
                  setSelectedSeats(seats);
                }}
                onClassChange={handleClassChange}
              />
            </div>

            {/* Return flight seat selector — round trip only */}
            {isRoundTrip && returnFlight && (
              <div className="card">
                <h2 style={styles.sectionTitle}>
                  🔄 Return Seats{passengerCount > 1 ? ` (${passengerCount} required)` : ''}
                </h2>
                <div style={{ fontSize: 13, color: '#007744', fontWeight: 700, marginBottom: 12, background: '#e8f5e9', borderRadius: 8, padding: '6px 12px' }}>
                  {returnFlight.origin} → {returnFlight.destination} · {returnFlight.flightNumber}
                </div>
                <SeatSelector
                  bookedSeats={returnFlight.bookedSeats || []}
                  selectedSeats={selectedReturnSeats}
                  passengerCount={passengerCount}
                  onSelect={(seats) => {
                    setFormTouched(true);
                    setSelectedReturnSeats(seats);
                  }}
                  onClassChange={handleReturnClassChange}
                />
              </div>
            )}
          </div>

          {/* Right: Passenger Info + Price */}
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <h2 style={styles.sectionTitle}>
                Passenger Details
                {passengerCount > 1 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#888', marginLeft: 10 }}>
                    ({passengerCount} passengers)
                  </span>
                )}
              </h2>
              <form onSubmit={handleSubmit}>

                {/* Per-passenger accordion */}
                {passengers.map((p, i) => {
                  const seat = selectedSeats[i];
                  const returnSeat = isRoundTrip ? selectedReturnSeats[i] : null;
                  const isOpen = activePassenger === i;
                  const isFilled = p.name?.trim() && p.email?.trim();
                  return (
                    <div key={i} style={{
                      border: `2px solid ${isOpen ? '#003399' : isFilled ? '#00aa55' : '#dde4ff'}`,
                      borderRadius: 12, marginBottom: 12, overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}>
                      {/* Accordion header */}
                      <div
                        onClick={() => setActivePassenger(isOpen ? -1 : i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', cursor: 'pointer',
                          background: isOpen ? '#f0f4ff' : isFilled ? '#f0fff8' : '#f8faff',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: isFilled ? '#00aa55' : isOpen ? '#003399' : '#dde4ff',
                          color: isFilled || isOpen ? 'white' : '#888',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 13,
                        }}>
                          {isFilled ? '✓' : i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                            Passenger {i + 1}
                            {p.name && <span style={{ color: '#888', fontWeight: 400 }}> — {p.name}</span>}
                          </div>
                          {seat && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                              {isRoundTrip ? 'Out ' : ''}Seat <strong style={{ color: seatClass === 'business' ? '#b8860b' : '#003399' }}>{seat}</strong>
                              {returnSeat && <span> · Ret <strong style={{ color: '#007744' }}>{returnSeat}</strong></span>}
                              {' '}· {seatClass === 'business' ? '👑 Business' : '✈️ Economy'}
                            </div>
                          )}
                        </div>
                        <span style={{ color: '#888', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* Accordion body */}
                      {isOpen && (
                        <div style={{ padding: '16px 16px 8px', background: 'white' }}>
                          {seat && (
                            <div style={{
                              background: seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                              border: `1.5px solid ${seatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                              borderRadius: 8, padding: '8px 14px', marginBottom: returnSeat ? 8 : 14,
                              fontSize: 13, color: seatClass === 'business' ? '#7a5800' : '#003399',
                              fontWeight: 600,
                            }}>
                              {seatClass === 'business' ? '👑' : '✈️'} {isRoundTrip ? 'Outbound' : 'Assigned'} Seat: <strong>{seat}</strong>
                            </div>
                          )}
                          {returnSeat && (
                            <div style={{
                              background: '#e8f5e9', border: '1.5px solid #00aa55',
                              borderRadius: 8, padding: '8px 14px', marginBottom: 14,
                              fontSize: 13, color: '#005533', fontWeight: 600,
                            }}>
                              🔄 Return Seat: <strong>{returnSeat}</strong>
                            </div>
                          )}
                          <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Full Name <span style={{ color: '#cc2222' }}>*</span></label>
                            <input className="input-field" value={p.name}
                              onChange={e => updatePassenger(i, 'name', e.target.value)}
                              placeholder="As shown on valid ID" required={i === 0} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 12 }}>
                            <label>Email Address <span style={{ color: '#cc2222' }}>*</span></label>
                            <input type="email" className="input-field" value={p.email}
                              onChange={e => updatePassenger(i, 'email', e.target.value)}
                              placeholder={i === 0 ? 'For e-ticket delivery' : 'Passenger email'} required={i === 0} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label>Phone Number</label>
                            <input type="tel" className="input-field" value={p.phone}
                              onChange={e => updatePassenger(i, 'phone', e.target.value)}
                              placeholder="+63 912 345 6789" />
                          </div>
                          {i < passengerCount - 1 && (
                            <button type="button"
                              onClick={() => setActivePassenger(i + 1)}
                              style={{ background: 'none', border: 'none', color: '#003399', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0 8px' }}>
                              Next Passenger →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Price Summary */}
                <div style={styles.priceSummary}>
                  {isRoundTrip ? (
                    <>
                      <div style={styles.priceSection}>✈️ Outbound — {flight.origin} → {flight.destination}</div>
                      <div style={styles.priceRow}>
                        <span>Base Fare × {passengerCount}</span><span>₱{(baseFare * passengerCount).toLocaleString()}</span>
                      </div>
                      {seatClass === 'business' && (
                        <div style={{ ...styles.priceRow, color: '#b8860b' }}>
                          <span>👑 Business Surcharge × {passengerCount}</span><span>+₱{(surcharge * passengerCount).toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ ...styles.priceRow, fontWeight: 700, color: '#333', marginBottom: 12 }}>
                        <span>Subtotal ({seatClass === 'business' ? '👑 Business' : '✈️ Economy'})</span><span>₱{(classFare * passengerCount).toLocaleString()}</span>
                      </div>

                      <div style={styles.priceSection}>🔄 Return — {returnFlight?.origin} → {returnFlight?.destination}</div>
                      <div style={styles.priceRow}>
                        <span>Base Fare × {passengerCount}</span><span>₱{(returnFare * passengerCount).toLocaleString()}</span>
                      </div>
                      {returnSeatClass === 'business' && (
                        <div style={{ ...styles.priceRow, color: '#b8860b' }}>
                          <span>👑 Business Surcharge × {passengerCount}</span><span>+₱{(returnSurcharge * passengerCount).toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ ...styles.priceRow, fontWeight: 700, color: '#333' }}>
                        <span>Subtotal ({returnSeatClass === 'business' ? '👑 Business' : '✈️ Economy'})</span><span>₱{(returnClassFare * passengerCount).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.priceRow}>
                        <span>Base Fare × {passengerCount}</span><span>₱{(baseFare * passengerCount).toLocaleString()}</span>
                      </div>
                      {seatClass === 'business' && (
                        <div style={{ ...styles.priceRow, color: '#b8860b', fontWeight: 600 }}>
                          <span>👑 Business Surcharge (+50%) × {passengerCount}</span><span>+₱{(surcharge * passengerCount).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div style={styles.priceRow}><span>Taxes & Fees</span><span>₱0.00</span></div>
                  <div style={styles.priceTotal}>
                    <span>{isRoundTrip ? 'Round Trip Total' : 'Total'}</span>
                    <span style={{ color: '#ff6600' }}>₱{totalFare.toLocaleString()}</span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div style={{
                      ...styles.seatChosen,
                      background: seatClass === 'business' ? '#fff8e1' : '#e8eeff',
                      color: seatClass === 'business' ? '#7a5800' : '#003399',
                      border: `1px solid ${seatClass === 'business' ? '#ffd54f' : '#99aadd'}`,
                    }}>
                      {seatClass === 'business' ? '👑' : '✈️'}{' '}
                      {isRoundTrip ? 'Outbound' : ''} Seat{selectedSeats.length > 1 ? 's' : ''} <strong>{selectedSeats.join(', ')}</strong> — <strong>{seatClass === 'business' ? 'Business' : 'Economy'}</strong>
                    </div>
                  )}
                  {isRoundTrip && selectedReturnSeats.length > 0 && (
                    <div style={{
                      ...styles.seatChosen,
                      marginTop: 6,
                      background: returnSeatClass === 'business' ? '#fff8e1' : '#e8f5e9',
                      color: returnSeatClass === 'business' ? '#7a5800' : '#005533',
                      border: `1px solid ${returnSeatClass === 'business' ? '#ffd54f' : '#00aa55'}`,
                    }}>
                      {returnSeatClass === 'business' ? '👑' : '🔄'} Return Seat{selectedReturnSeats.length > 1 ? 's' : ''} <strong>{selectedReturnSeats.join(', ')}</strong> — <strong>{returnSeatClass === 'business' ? 'Business' : 'Economy'}</strong>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary"
                  style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 8 }}
                  disabled={selectedSeats.length < passengerCount || (isRoundTrip && selectedReturnSeats.length < passengerCount)}>
                  {(() => {
                    if (selectedSeats.length < passengerCount) {
                      const n = passengerCount - selectedSeats.length;
                      return `Select ${n} more outbound seat${n !== 1 ? 's' : ''}…`;
                    }
                    if (isRoundTrip && selectedReturnSeats.length < passengerCount) {
                      const n = passengerCount - selectedReturnSeats.length;
                      return `Select ${n} more return seat${n !== 1 ? 's' : ''}…`;
                    }
                    return 'Review Booking →';
                  })()}
                </button>
              </form>
            </div>

            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>💳 Payment via GCash</div>
              <p style={styles.paymentText}>
                After booking, you'll be directed to upload your GCash payment proof.
                Your booking will be confirmed once an admin approves your payment.
                {isRoundTrip && <strong> Total payment covers both outbound and return flights.</strong>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399' },
  flightBadge: { background: '#e8eeff', color: '#003399', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 14 },
  tripTypeBadge: { padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13 },
  legLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  flightSummary: {
    background: 'linear-gradient(135deg, #001f66, #003399)',
    borderRadius: 16, padding: '20px 28px', marginBottom: 12,
    display: 'flex', flexDirection: 'column', gap: 8, color: 'white',
  },
  summaryRoute: { display: 'flex', alignItems: 'center', gap: 20 },
  summaryPoint: { textAlign: 'center' },
  summaryCode: { fontSize: 28, fontWeight: 900, fontFamily: 'Montserrat, sans-serif' },
  summaryCity: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  summaryTime: { fontSize: 15, fontWeight: 700, marginTop: 4 },
  summaryArrow: { fontSize: 14, opacity: 0.5, flex: 1, textAlign: 'center' },
  summaryMeta: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  metaItem: { fontSize: 13, opacity: 0.85 },
  metaPrice: { fontSize: 20, fontWeight: 900, color: '#ffcc44', fontFamily: 'Montserrat, sans-serif', marginLeft: 'auto' },
  classBadges: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  classBadge: (borderColor, color, active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
    borderRadius: 12, flex: 1, border: `2px solid ${active ? borderColor : '#eee'}`,
    background: active ? `${borderColor}22` : 'white', color,
    opacity: active ? 1 : 0.6, transition: 'all 0.2s', fontSize: 13,
  }),
  grid: { display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, alignItems: 'start' },
  sectionTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#003399', marginBottom: 20 },
  priceSummary: { background: '#f8faff', borderRadius: 10, padding: 16, marginTop: 20, border: '1px solid #dde4ff' },
  priceSection: { fontSize: 11, fontWeight: 800, color: '#003399', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  priceRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 6 },
  priceTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#1a1a2e', borderTop: '2px solid #dde4ff', paddingTop: 10, marginTop: 6 },
  seatChosen: { fontSize: 13, marginTop: 10, textAlign: 'center', padding: '8px 12px', borderRadius: 8 },
  paymentInfo: { background: '#fff8e1', border: '2px solid #ffc107', borderRadius: 12, padding: 20 },
  paymentTitle: { fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#cc8800' },
  paymentText: { fontSize: 14, color: '#666', lineHeight: 1.6 },
};

export default BookingPage;
