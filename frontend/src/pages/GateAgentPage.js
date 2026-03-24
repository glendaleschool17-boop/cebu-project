import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #001a6b 0%, #003399 60%, #0044cc 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 16px 60px',
    fontFamily: 'Inter, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 44,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 900,
    fontFamily: 'Montserrat, sans-serif',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    padding: 28,
    width: '100%',
    maxWidth: 480,
    marginBottom: 20,
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    border: '2px solid #dde4ff',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    transition: 'border 0.15s',
  },
  btn: {
    padding: '12px 20px',
    borderRadius: 10,
    border: 'none',
    background: '#003399',
    color: '#fff',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  orDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    color: '#aaa',
    fontSize: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#eee',
  },
  validCard: {
    background: 'linear-gradient(135deg, #e8fff3 0%, #f0fff6 100%)',
    border: '2px solid #00cc77',
    borderRadius: 16,
    padding: 24,
    marginTop: 4,
  },
  invalidCard: {
    background: '#fff5f5',
    border: '2px solid #cc2222',
    borderRadius: 16,
    padding: 24,
    marginTop: 4,
  },
  validBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#00cc77',
    color: '#fff',
    borderRadius: 30,
    padding: '6px 16px',
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 16,
  },
  invalidBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#cc2222',
    color: '#fff',
    borderRadius: 30,
    padding: '6px 16px',
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 16,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 16px',
    marginTop: 12,
  },
  infoItem: {
    background: '#fff',
    borderRadius: 10,
    padding: '10px 14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  infoLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: 700,
  },
  flightRoute: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: '12px 16px',
    background: 'rgba(0,51,153,0.07)',
    borderRadius: 12,
  },
  routeCode: {
    fontSize: 22,
    fontWeight: 900,
    color: '#003399',
    fontFamily: 'Montserrat, sans-serif',
  },
  routeArrow: {
    fontSize: 16,
    color: '#003399',
    flex: 1,
    textAlign: 'center',
  },
  scannerArea: {
    border: '2px dashed #dde4ff',
    borderRadius: 14,
    padding: 24,
    textAlign: 'center',
    background: '#f8f9ff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: 16,
  },
  clearBtn: {
    marginTop: 16,
    width: '100%',
    padding: '11px',
    borderRadius: 10,
    border: '2px solid #dde4ff',
    background: '#f8f9ff',
    color: '#666',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: 6,
    background: '#00cc77',
    boxShadow: '0 0 0 3px rgba(0,204,119,0.25)',
  },
};

const fmtDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GateAgentPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [manualInput, setManualInput]   = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null); // { valid, booking, flight, error }
  const [scanCount, setScanCount]       = useState(0);
  const inputRef = useRef(null);

  // Access guard — only gate_agent or admin
  const role = userProfile?.role;
  const isAuthorized = role === 'gate_agent' || role === 'admin';

  // Auto-validate if URL has bookingId + token (from QR scan on mobile)
  useEffect(() => {
    const bookingId = searchParams.get('b');
    const token     = searchParams.get('t');
    const pIdx      = searchParams.get('p');
    if (bookingId && token) {
      validateTicket(bookingId, token, pIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateTicket = async (bookingId, token, passengerIndex) => {
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (passengerIndex !== null && passengerIndex !== undefined) {
        params.set('p', passengerIndex);
      }
      const data = await api.get(
        `/bookings/validate-ticket/${encodeURIComponent(bookingId)}/${encodeURIComponent(token)}?${params.toString()}`
      );
      setResult(data);
      setScanCount(c => c + 1);
    } catch (err) {
      setResult({ valid: false, error: err.message || 'Validation failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Parse a boarding URL or raw "bookingId/token" input
  const parseAndValidate = () => {
    const raw = manualInput.trim();
    if (!raw) return;

    // Match /boarding/BOOKINGID/TOKEN?p=N
    const urlMatch = raw.match(/\/boarding\/([^/?#]+)\/([^/?#]+)/);
    if (urlMatch) {
      const pMatch = raw.match(/[?&]p=(\d+)/);
      return validateTicket(urlMatch[1], urlMatch[2], pMatch ? pMatch[1] : null);
    }

    // Plain "BOOKINGID/TOKEN" format
    const slashMatch = raw.match(/^([A-Z0-9\-]+)\/([a-f0-9]+)$/i);
    if (slashMatch) {
      return validateTicket(slashMatch[1], slashMatch[2], null);
    }

    setResult({ valid: false, error: 'Unrecognized format. Paste the full boarding URL or BOOKINGID/TOKEN.' });
  };

  if (!user) {
    return (
      <div style={{ ...S.page, justifyContent: 'center' }}>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e', marginBottom: 8 }}>Login Required</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Gate Agent access requires authentication.</div>
            <button onClick={() => navigate('/login')} style={{ ...S.btn, width: '100%' }}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userProfile && !isAuthorized) {
    return (
      <div style={{ ...S.page, justifyContent: 'center' }}>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#cc2222', marginBottom: 8 }}>Access Denied</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              This page is only accessible to Gate Agents and Admins.<br />Your role: <strong>{role || 'passenger'}</strong>
            </div>
            <button onClick={() => navigate('/')} style={{ ...S.btn, width: '100%' }}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🛂</div>
        <div style={S.title}>Gate Agent Scanner</div>
        <div style={S.subtitle}>Cebu Airlines · Ticket Validation</div>
        {scanCount > 0 && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 14px', color: '#fff', fontSize: 12 }}>
            <span style={S.statusDot} />
            {scanCount} ticket{scanCount > 1 ? 's' : ''} validated this session
          </div>
        )}
      </div>

      {/* Scanner Card */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#003399', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📷 Scan or Enter Ticket
        </div>

        {/* Camera QR hint */}
        <div
          style={S.scannerArea}
          onClick={() => inputRef.current?.focus()}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Use your device camera to scan the QR code</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            The QR code will open a validation link automatically.
          </div>
        </div>

        <div style={S.orDivider}>
          <div style={S.dividerLine} />
          <span>or enter manually</span>
          <div style={S.dividerLine} />
        </div>

        {/* Manual input */}
        <div style={S.inputRow}>
          <input
            ref={inputRef}
            style={S.input}
            placeholder="Paste boarding URL or BOOKINGID/TOKEN…"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && parseAndValidate()}
          />
          <button
            style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}
            onClick={parseAndValidate}
            disabled={loading}
          >
            {loading ? '⏳' : '✓ Validate'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#aaa', marginTop: -8 }}>
          Tip: Paste the full URL from the QR code (e.g. https://…/boarding/CEB-XXXXXX/token)
        </div>
      </div>

      {/* Result Card */}
      {result && (
        <div style={S.card}>
          {result.valid ? (
            <div style={S.validCard}>
              {/* Valid badge */}
              <div style={S.validBadge}>
                <span>✅</span> VALID TICKET
              </div>

              {/* Flight Route */}
              {result.flight && (
                <div style={S.flightRoute}>
                  <div>
                    <div style={S.routeCode}>{result.flight.origin}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{result.flight.originCity}</div>
                  </div>
                  <div style={S.routeArrow}>✈ ──────</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={S.routeCode}>{result.flight.destination}</div>
                    <div style={{ fontSize: 11, color: '#666', textAlign: 'right' }}>{result.flight.destinationCity}</div>
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div style={S.infoGrid}>
                <div style={S.infoItem}>
                  <div style={S.infoLabel}>Passenger</div>
                  <div style={S.infoValue}>{result.booking.passengerName}</div>
                </div>
                <div style={S.infoItem}>
                  <div style={S.infoLabel}>Booking Ref</div>
                  <div style={{ ...S.infoValue, fontFamily: 'monospace', color: '#003399' }}>
                    {result.booking.bookingId}
                  </div>
                </div>
                <div style={S.infoItem}>
                  <div style={S.infoLabel}>Seat</div>
                  <div style={S.infoValue}>
                    {result.booking.seat}
                    <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>
                      ({result.booking.seatClass})
                    </span>
                  </div>
                </div>
                <div style={S.infoItem}>
                  <div style={S.infoLabel}>Flight</div>
                  <div style={S.infoValue}>{result.flight?.flightNumber || '—'}</div>
                </div>
                {result.flight?.departureTime && (
                  <div style={{ ...S.infoItem, gridColumn: '1 / -1' }}>
                    <div style={S.infoLabel}>Departure</div>
                    <div style={S.infoValue}>{fmtDT(result.flight.departureTime)}</div>
                  </div>
                )}
                {result.flight?.arrivalTime && (
                  <div style={{ ...S.infoItem, gridColumn: '1 / -1' }}>
                    <div style={S.infoLabel}>Arrival</div>
                    <div style={S.infoValue}>{fmtDT(result.flight.arrivalTime)}</div>
                  </div>
                )}
                {result.booking.tripType === 'roundtrip' && (
                  <div style={{ ...S.infoItem, gridColumn: '1 / -1', background: '#eef2ff' }}>
                    <div style={S.infoLabel}>Trip Type</div>
                    <div style={{ ...S.infoValue, color: '#003399' }}>🔄 Round Trip</div>
                  </div>
                )}
              </div>

              {/* Aircraft */}
              {result.flight?.aircraft && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#666', textAlign: 'right' }}>
                  ✈ {result.flight.aircraft}
                </div>
              )}
            </div>
          ) : (
            <div style={S.invalidCard}>
              <div style={S.invalidBadge}>
                <span>❌</span> INVALID TICKET
              </div>
              <div style={{ fontSize: 14, color: '#cc2222', fontWeight: 700, marginBottom: 8 }}>
                {result.error || 'This ticket could not be validated.'}
              </div>
              {result.status && result.status !== 'confirmed' && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Booking status: <strong>{result.status.replace(/_/g, ' ')}</strong>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#888', marginTop: 8, lineHeight: 1.6 }}>
                Please check the passenger's booking reference and ask them to contact the airline counter.
              </div>
            </div>
          )}

          <button
            style={S.clearBtn}
            onClick={() => { setResult(null); setManualInput(''); inputRef.current?.focus(); }}
          >
            🔄 Scan Next Ticket
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
        Cebu Airlines · Gate Agent Portal · {userProfile?.name || user?.email}
      </div>
    </div>
  );
}
