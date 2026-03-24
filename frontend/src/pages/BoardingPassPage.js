import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const TicketVerificationPage = () => {
  const { bookingId, token } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    document.title = 'Boarding Pass – Cebu Airline';
    fetch(`${API_BASE}/boarding-pass/${bookingId}/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error);
        else { setData(json); setTimeout(() => setAnimate(true), 200); }
      })
      .catch(() => setError('Unable to verify ticket. Please try again.'))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  if (loading) return (
    <div style={s.page}>
      <style>{css}</style>
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={s.loadText}>Verifying ticket…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={s.page}>
      <style>{css}</style>
      <div style={s.card}>
        <AirlineBar />
        <div style={s.invalidBody}>
          <div style={s.invalidCircle}>✕</div>
          <div style={s.invalidTitle}>Invalid Ticket</div>
          <div style={s.invalidMsg}>{error}</div>
          <div style={s.invalidNote}>
            This QR code could not be verified. Please present your booking
            confirmation or contact Cebu Airlines staff for assistance.
          </div>
          <div style={s.invalidContact}>📞 (02) 8888-7777 · support@cebuairlines.com</div>
        </div>
        <Footer />
      </div>
    </div>
  );

  const { booking, flight, returnFlight } = data;
  const isRoundTrip    = booking.tripType === 'roundtrip' && !!returnFlight;
  const isBusiness     = booking.seatClass === 'business';
  const passengerCount = booking.passengerCount || 1;
  const passengers     = booking.passengers?.length > 0 ? booking.passengers : null;
  const allSeats       = booking.seatNumbers?.join(', ') || booking.seatNumber || '—';

  const classColor  = isBusiness ? '#b8860b' : '#003399';
  const classBg     = isBusiness ? '#fff8e1' : '#e8eeff';
  const classBorder = isBusiness ? '#ffd54f' : '#99aadd';
  const classLabel  = isBusiness ? '👑 Business Class' : '✈️ Economy Class';

  const fmtTime  = dt => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const fmtDate  = dt => new Date(dt).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtShort = dt => new Date(dt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const getDur   = (a, b) => { const m = (new Date(b) - new Date(a)) / 60000; return `${Math.floor(m/60)}h ${m%60}m`; };

  return (
    <div style={s.page}>
      <style>{css}</style>
      <div style={s.card}>

        {/* ── Airline header ── */}
        <AirlineBar />

        {/* ── ✅ Verified stamp ── */}
        <div style={s.validBanner}>
          <div style={{
            ...s.checkCircle,
            animation: animate ? 'popIn 0.5s ease forwards, pulse 2.5s ease 0.6s infinite' : 'none',
            opacity: animate ? 1 : 0,
          }}>✓</div>
          <div style={{ ...s.validTitle, animation: animate ? 'slideUp 0.4s ease 0.3s both' : 'none' }}>
            TICKET VERIFIED
          </div>
          <div style={{ ...s.validSub, animation: animate ? 'slideUp 0.4s ease 0.45s both' : 'none' }}>
            This is a valid, confirmed ticket issued by Cebu Airlines
          </div>
          <div style={{ ...s.refPill, animation: animate ? 'slideUp 0.4s ease 0.55s both' : 'none' }}>
            <span style={s.refLabel}>BOOKING REF</span>
            <span style={s.refValue}>{booking.bookingId}</span>
          </div>
        </div>

        {/* ── Trip / class badges ── */}
        <div style={s.badgeRow}>
          <span style={{ ...s.badge, background: isRoundTrip ? '#e8f5e9' : '#e8eeff', color: isRoundTrip ? '#007744' : '#003399', border: `1.5px solid ${isRoundTrip ? '#00aa55' : '#99aadd'}` }}>
            {isRoundTrip ? '🔄 Round Trip' : '➡️ One Way'}
          </span>
          <span style={{ ...s.badge, background: classBg, color: classColor, border: `1.5px solid ${classBorder}` }}>
            {classLabel}
          </span>
          {passengerCount > 1 && (
            <span style={{ ...s.badge, background: '#fff8e1', color: '#cc8800', border: '1.5px solid #ffd54f' }}>
              👥 {passengerCount} Passengers
            </span>
          )}
        </div>

        {/* ── Flight details ── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>✈️ {isRoundTrip ? 'Flight Itinerary' : 'Flight Details'}</div>
          <FlightStrip flight={flight} label={isRoundTrip ? '✈ OUTBOUND FLIGHT' : null} accent="#003399" fmtTime={fmtTime} fmtDate={fmtDate} getDur={getDur} />
          {isRoundTrip && returnFlight && (
            <FlightStrip flight={returnFlight} label="🔄 RETURN FLIGHT" accent="#007744" fmtTime={fmtTime} fmtDate={fmtDate} getDur={getDur} />
          )}
        </div>

        {/* ── Passenger details ── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>👤 {passengerCount > 1 ? `Passengers (${passengerCount})` : 'Passenger Details'}</div>
          {passengers ? (
            <div style={s.manifest}>
              <div style={s.manifestHead}>
                <span style={s.mhNum}>#</span>
                <span style={s.mhCol}>Passenger Name</span>
                <span style={s.mhCol}>Seat</span>
              </div>
              {passengers.map((p, i) => (
                <div key={i} style={{ ...s.manifestRow, background: i % 2 === 0 ? 'white' : '#f8faff' }}>
                  <div style={s.manifestBullet}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.manifestName}>{p.name}</div>
                    {p.phone && <div style={s.manifestPhone}>{p.phone}</div>}
                  </div>
                  <span style={{ ...s.seatChip, background: classBg, color: classColor, border: `1.5px solid ${classBorder}` }}>
                    {p.seat || booking.seatNumbers?.[i] || '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.paxGrid}>
              <InfoBox label="Passenger Name" value={booking.passengerName} />
              <InfoBox label="Email Address"  value={booking.passengerEmail} />
              {booking.passengerPhone && <InfoBox label="Phone" value={booking.passengerPhone} />}
              <InfoBox label="Seat" value={allSeats} large color={classColor} />
            </div>
          )}
        </div>

        {/* ── Verification details ── */}
        <div style={s.section}>
          <div style={s.sectionTitle}>🔍 Verification Details</div>
          <div style={s.verifyGrid}>
            <InfoBox label="Ticket Status"  value="✅ CONFIRMED & PAID"           color="#007744" />
            <InfoBox label="Seat(s)"        value={allSeats}     large            color={classColor} />
            <InfoBox label="Seat Class"     value={classLabel} />
            <InfoBox label="Aircraft"       value={flight.aircraft || 'Airbus A320'} />
            <InfoBox label="Confirmed On"   value={booking.confirmedAt ? fmtShort(booking.confirmedAt) : '—'} />
            <InfoBox label="Payment Method" value="✓ GCash Verified"              color="#007744" />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

/* ─── Sub-components ────────────────────────────────────────────── */

const AirlineBar = () => (
  <div style={s.airlineBar}>
    <span style={s.airlineIcon}>✈️</span>
    <div style={{ flex: 1 }}>
      <div style={s.airlineName}>CEBU AIRLINES</div>
      <div style={s.airlineSub}>Ticket Verification System</div>
    </div>
    <div style={s.secureBadge}>🔒 SECURE</div>
  </div>
);

const Footer = () => (
  <div style={s.footer}>
    <div style={s.footerLogo}>✈️ CEBU AIRLINES</div>
    <div style={s.footerText}>
      This verification was generated by the Cebu Airlines ticketing system.<br />
      Present this screen or your QR code to airport staff at check-in.
    </div>
    <div style={s.footerContact}>support@cebuairlines.com · (02) 8888-7777</div>
    <div style={s.footerCopy}>© 2026 Cebu Airlines. All rights reserved.</div>
  </div>
);

const FlightStrip = ({ flight, label, accent, fmtTime, fmtDate, getDur }) => (
  <div style={{ border: `2px solid ${accent}44`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
    {label && <div style={{ background: accent, padding: '6px 18px', fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: 2 }}>{label}</div>}
    <div style={s.flightRow}>
      <div style={s.airport}>
        <div style={{ ...s.iata, color: accent }}>{flight.origin}</div>
        <div style={s.airportCity}>{flight.originCity}</div>
        <div style={s.bigTime}>{fmtTime(flight.departureTime)}</div>
        <div style={s.timeLabel}>Departure</div>
      </div>
      <div style={s.flightMid}>
        <div style={{ fontSize: 13, fontWeight: 800, color: accent }}>{flight.flightNumber}</div>
        <div style={{ fontSize: 14, color: accent, letterSpacing: 2, margin: '6px 0' }}>── ✈ ──</div>
        <div style={{ fontSize: 11, color: '#888' }}>{getDur(flight.departureTime, flight.arrivalTime)}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#007744', marginTop: 3, letterSpacing: 1 }}>DIRECT</div>
      </div>
      <div style={s.airport}>
        <div style={{ ...s.iata, color: accent }}>{flight.destination}</div>
        <div style={s.airportCity}>{flight.destinationCity}</div>
        <div style={s.bigTime}>{fmtTime(flight.arrivalTime)}</div>
        <div style={s.timeLabel}>Arrival</div>
      </div>
    </div>
    <div style={s.flightDateBar}>{fmtDate(flight.departureTime)}</div>
  </div>
);

const InfoBox = ({ label, value, large, color }) => (
  <div style={s.infoBox}>
    <div style={s.infoLabel}>{label}</div>
    <div style={{ ...s.infoValue, fontSize: large ? 22 : 14, color: color || '#1a1a2e' }}>{value}</div>
  </div>
);

/* ─── CSS animations ────────────────────────────────────────────── */
const css = `
  @keyframes popIn {
    0%   { transform: scale(0.4); opacity: 0; }
    70%  { transform: scale(1.12); }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0   rgba(0,180,90,0.5); }
    50%       { box-shadow: 0 0 0 20px rgba(0,180,90,0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

/* ─── Styles ────────────────────────────────────────────────────── */
const s = {
  page:    { minHeight: '100vh', background: 'linear-gradient(160deg,#e8f5e9 0%,#eef2ff 55%,#e8eeff 100%)', padding: '24px 16px 56px', fontFamily: "'Helvetica Neue',Arial,sans-serif" },
  center:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16 },
  spinner: { width: 52, height: 52, border: '5px solid #dde4ff', borderTop: '5px solid #003399', borderRadius: '50%', animation: 'spin 0.75s linear infinite' },
  loadText:{ color: '#888', fontSize: 15, fontWeight: 600, margin: 0 },

  card: { maxWidth: 680, margin: '0 auto', background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 16px 64px rgba(0,51,153,0.15)' },

  airlineBar:  { display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg,#001040 0%,#003399 60%,#0055cc 100%)', padding: '20px 28px' },
  airlineIcon: { fontSize: 38 },
  airlineName: { color: 'white', fontWeight: 900, fontSize: 20, letterSpacing: 3 },
  airlineSub:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1, marginTop: 2 },
  secureBadge: { marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, border: '1px solid rgba(255,255,255,0.2)' },

  invalidBody:    { padding: '48px 32px', textAlign: 'center' },
  invalidCircle:  { width: 80, height: 80, borderRadius: '50%', background: '#ffebeb', color: '#cc2222', fontSize: 36, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  invalidTitle:   { fontSize: 24, fontWeight: 900, color: '#cc2222', marginBottom: 10 },
  invalidMsg:     { fontSize: 15, color: '#555', fontWeight: 600, marginBottom: 14 },
  invalidNote:    { fontSize: 13, color: '#888', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 16px' },
  invalidContact: { fontSize: 13, color: '#003399', fontWeight: 700 },

  validBanner: { background: 'linear-gradient(180deg,#e8fff4,#f2fff9)', padding: '44px 28px 32px', textAlign: 'center', borderBottom: '2px solid #c8f0dc' },
  checkCircle: { width: 92, height: 92, borderRadius: '50%', background: 'linear-gradient(135deg,#00cc66,#00aa44)', color: 'white', fontSize: 46, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', opacity: 0 },
  validTitle:  { fontSize: 30, fontWeight: 900, color: '#007744', letterSpacing: 4, marginBottom: 8 },
  validSub:    { fontSize: 14, color: '#555', marginBottom: 22, lineHeight: 1.5 },
  refPill:     { display: 'inline-flex', alignItems: 'center', gap: 12, background: 'white', border: '2px solid #00aa55', borderRadius: 50, padding: '9px 26px', boxShadow: '0 2px 14px rgba(0,170,85,0.12)' },
  refLabel:    { fontSize: 10, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5 },
  refValue:    { fontSize: 20, fontWeight: 900, color: '#003399', letterSpacing: 3 },

  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 24px', background: '#fafbff', borderBottom: '1px solid #f0f0ff' },
  badge:    { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800 },

  section:      { padding: '22px 24px', borderBottom: '1px solid #f0f0ff' },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#003399', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #e8eeff' },

  flightRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', background: '#f8faff' },
  airport:      { textAlign: 'center' },
  iata:         { fontSize: 44, fontWeight: 900, lineHeight: 1 },
  airportCity:  { fontSize: 11, color: '#888', marginTop: 4, fontWeight: 600 },
  bigTime:      { fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginTop: 8 },
  timeLabel:    { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  flightMid:    { flex: 1, textAlign: 'center', padding: '0 20px' },
  flightDateBar:{ background: '#eef2ff', borderTop: '1px solid #dde4ff', padding: '8px 20px', fontSize: 12, fontWeight: 600, color: '#555', textAlign: 'center' },

  manifest:     { border: '1.5px solid #dde4ff', borderRadius: 12, overflow: 'hidden' },
  manifestHead: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(90deg,#003399,#0055cc)', padding: '9px 16px' },
  mhNum:        { width: 28, fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 800 },
  mhCol:        { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 },
  manifestRow:  { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #eef0ff' },
  manifestBullet:{ width: 24, height: 24, borderRadius: '50%', background: '#003399', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 },
  manifestName: { fontWeight: 700, color: '#1a1a2e', fontSize: 14 },
  manifestPhone:{ fontSize: 11, color: '#888', marginTop: 1 },
  seatChip:     { padding: '4px 12px', borderRadius: 6, fontWeight: 800, fontSize: 13, flexShrink: 0 },

  paxGrid:   { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 },
  infoBox:   { background: '#f8faff', borderRadius: 10, padding: '12px 14px', border: '1px solid #dde4ff' },
  infoLabel: { fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontWeight: 800, lineHeight: 1.2 },

  verifyGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 },

  footer:        { background: 'linear-gradient(135deg,#001040,#003399)', padding: '28px 28px 32px', textAlign: 'center' },
  footerLogo:    { color: 'white', fontWeight: 900, fontSize: 15, letterSpacing: 3, marginBottom: 10 },
  footerText:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.8, marginBottom: 10 },
  footerContact: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 },
  footerCopy:    { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
};

export default TicketVerificationPage;
