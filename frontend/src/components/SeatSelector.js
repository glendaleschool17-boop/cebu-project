// SeatSelector — supports multi-seat selection for group bookings
// Business: rows 1-4, 2+2 layout (A B | C D)
// Economy:  rows 5-24, 3+3 layout (A B C | D E F)

const BUSINESS_ROWS = 4;
const ECONOMY_ROWS = 20;
const BUSINESS_COLS = ['A', 'B', 'C', 'D'];
const ECONOMY_COLS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const getSeatClass = (seat) => {
  const row = parseInt(seat);
  return row <= BUSINESS_ROWS ? 'business' : 'economy';
};

// Props:
//   bookedSeats    — array of already-taken seat strings
//   selectedSeats  — array of currently selected seat strings  (multi-select mode)
//   selectedSeat   — single string (legacy / single-select mode, still supported)
//   passengerCount — how many seats must be selected (default 1)
//   onSelect       — called with the new array of selected seats
//   onClassChange  — called with 'business' | 'economy' based on first selected seat

const SeatSelector = ({
  bookedSeats = [],
  selectedSeats,   // preferred: array
  selectedSeat,    // legacy: single string
  passengerCount = 1,
  onSelect,
  onClassChange,
  lockedClass,     // optional: 'business'|'economy' — hides class banner, locks zone
}) => {

  // Normalise to array regardless of which prop was passed
  const selected = selectedSeats
    ? selectedSeats
    : selectedSeat
      ? [selectedSeat]
      : [];

  const isMulti = passengerCount > 1;

  const getSeatStatus = (seat) => {
    if (selected.includes(seat)) return 'selected';
    if (bookedSeats.includes(seat)) return 'booked';
    return 'available';
  };

  const handleSelect = (seat) => {
    // If class is locked, block seats from the wrong zone
    if (lockedClass && getSeatClass(seat) !== lockedClass) return;

    const alreadySelected = selected.includes(seat);

    if (alreadySelected) {
      // Always allow deselecting
      const next = selected.filter(s => s !== seat);
      onSelect(next);
      if (onClassChange) {
        const remaining = next.filter(Boolean);
        if (remaining.length > 0) onClassChange(getSeatClass(remaining[0]));
      }
      return;
    }

    if (isMulti) {
      if (selected.length >= passengerCount) {
        // Already at limit — replace oldest selection
        const next = [...selected.slice(1), seat];
        onSelect(next);
        if (onClassChange) onClassChange(getSeatClass(next[0]));
      } else {
        const next = [...selected, seat];
        onSelect(next);
        if (onClassChange) onClassChange(getSeatClass(next[0]));
      }
    } else {
      onSelect([seat]);
      if (onClassChange) onClassChange(getSeatClass(seat));
    }
  };

  const resolvedClass = selected.length > 0 ? getSeatClass(selected[0]) : null;

  const businessStyle = (status) => {
    const base = {
      width: 42, height: 42, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 800,
      transition: 'all 0.15s', userSelect: 'none', flexShrink: 0,
    };
    if (status === 'selected')
      return { ...base, background: 'linear-gradient(135deg,#b8860b,#ffd700)', color: '#3a2800', border: '2px solid #b8860b', cursor: 'pointer', boxShadow: '0 2px 8px #ffd70066' };
    if (status === 'booked')
      return { ...base, background: '#f0f0f0', color: '#ccc', border: '2px solid #e0e0e0', cursor: 'not-allowed' };
    return { ...base, background: 'linear-gradient(135deg,#fff8e1,#ffe082)', color: '#7a5800', border: '2px solid #ffd54f', cursor: 'pointer' };
  };

  const economyStyle = (status) => {
    const base = {
      width: 36, height: 36, borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700,
      transition: 'all 0.15s', userSelect: 'none', flexShrink: 0,
    };
    if (status === 'selected')
      return { ...base, background: '#003399', color: 'white', border: '2px solid #001f66', cursor: 'pointer' };
    if (status === 'booked')
      return { ...base, background: '#f0f0f0', color: '#bbb', border: '2px solid #ddd', cursor: 'not-allowed' };
    return { ...base, background: '#e8eeff', color: '#003399', border: '2px solid #99aadd', cursor: 'pointer' };
  };

  const getLabel = (seat, status) => {
    if (status !== 'selected') return seat;
    const idx = selected.indexOf(seat);
    return passengerCount > 1 ? `P${idx + 1}` : '✓';
  };

  return (
    <div>

      {/* Progress indicator for multi-seat */}
      {isMulti && (
        <div style={styles.progressBar}>
          <div style={styles.progressLabel}>
            <span style={{ fontWeight: 800, color: selected.length === passengerCount ? '#007744' : '#003399' }}>
              {selected.length} / {passengerCount} seats selected
            </span>
            {selected.length < passengerCount && (
              <span style={{ color: '#888', fontSize: 12 }}>
                — select {passengerCount - selected.length} more
              </span>
            )}
            {selected.length === passengerCount && (
              <span style={{ color: '#007744', fontSize: 12, fontWeight: 700 }}> ✓ All seats chosen</span>
            )}
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${(selected.length / passengerCount) * 100}%`,
              background: selected.length === passengerCount
                ? 'linear-gradient(90deg,#007744,#00aa55)'
                : 'linear-gradient(90deg,#003399,#0055ff)',
            }} />
          </div>
          {/* Seat chips */}
          <div style={styles.seatChips}>
            {Array.from({ length: passengerCount }, (_, i) => (
              <div key={i} style={{
                ...styles.seatChip,
                background: selected[i] ? '#003399' : '#f0f4ff',
                color: selected[i] ? 'white' : '#aaa',
                border: selected[i] ? '1.5px solid #001f66' : '1.5px dashed #ccd4ee',
              }}>
                {selected[i] ? `P${i + 1}: ${selected[i]}` : `P${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.ldot, background: 'linear-gradient(135deg,#fff8e1,#ffe082)', border: '2px solid #ffd54f' }} />
          <span style={styles.lLabel}>Business</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.ldot, background: '#e8eeff', border: '2px solid #99aadd' }} />
          <span style={styles.lLabel}>Economy</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.ldot, background: 'linear-gradient(135deg,#b8860b,#ffd700)', border: '2px solid #b8860b' }} />
          <span style={styles.lLabel}>Selected</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.ldot, background: '#f0f0f0', border: '2px solid #ddd' }} />
          <span style={styles.lLabel}>Taken</span>
        </div>
      </div>

      <div style={styles.planeWrap}>

        {/* ── BUSINESS CLASS ── */}
        <div style={{ ...styles.classSection, ...(lockedClass === 'economy' ? { opacity: 0.35, pointerEvents: 'none' } : {}) }}>
          <div style={styles.classBanner('#b8860b', '#fff8e1')}>
            <span style={{ fontSize: 18 }}>👑</span>
            <div>
              <div style={styles.classTitle}>Business Class</div>
              <div style={styles.classSub}>Rows 1–4 · 2+2 Layout · +50% fare{lockedClass === 'economy' ? ' · Not available (class locked)' : ''}</div>
            </div>
          </div>

          <div style={styles.colHeaders}>
            <div style={styles.rowNumCell} />
            <div style={styles.colHead}>A</div>
            <div style={styles.colHead}>B</div>
            <div style={{ width: 28 }} />
            <div style={styles.colHead}>C</div>
            <div style={styles.colHead}>D</div>
          </div>

          {Array.from({ length: BUSINESS_ROWS }, (_, i) => {
            const row = i + 1;
            return (
              <div key={row} style={styles.seatRow}>
                <div style={styles.rowNum}>{row}</div>
                {BUSINESS_COLS.slice(0, 2).map(col => {
                  const seat = `${row}${col}`;
                  const status = getSeatStatus(seat);
                  return (
                    <div key={col} style={businessStyle(status)}
                      onClick={() => status !== 'booked' && handleSelect(seat)}
                      title={`Seat ${seat} — Business`}>
                      {getLabel(seat, status)}
                    </div>
                  );
                })}
                <div style={{ width: 28, textAlign: 'center', fontSize: 11, color: '#ccc' }}>│</div>
                {BUSINESS_COLS.slice(2).map(col => {
                  const seat = `${row}${col}`;
                  const status = getSeatStatus(seat);
                  return (
                    <div key={col} style={businessStyle(status)}
                      onClick={() => status !== 'booked' && handleSelect(seat)}
                      title={`Seat ${seat} — Business`}>
                      {getLabel(seat, status)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={styles.classDivider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>✈ Economy Class Begins</span>
          <div style={styles.dividerLine} />
        </div>

        {/* ── ECONOMY CLASS ── */}
        <div style={{ ...styles.classSection, ...(lockedClass === 'business' ? { opacity: 0.35, pointerEvents: 'none' } : {}) }}>
          <div style={styles.classBanner('#003399', '#e8eeff')}>
            <span style={{ fontSize: 18 }}>✈️</span>
            <div>
              <div style={styles.classTitle}>Economy Class</div>
              <div style={styles.classSub}>Rows 5–24 · 3+3 Layout · Standard fare{lockedClass === 'business' ? ' · Not available (class locked)' : ''}</div>
            </div>
          </div>

          <div style={styles.colHeaders}>
            <div style={styles.rowNumCell} />
            <div style={styles.colHead}>A</div>
            <div style={styles.colHead}>B</div>
            <div style={styles.colHead}>C</div>
            <div style={{ width: 20 }} />
            <div style={styles.colHead}>D</div>
            <div style={styles.colHead}>E</div>
            <div style={styles.colHead}>F</div>
          </div>

          <div style={styles.econGrid}>
            {Array.from({ length: ECONOMY_ROWS }, (_, i) => {
              const row = BUSINESS_ROWS + i + 1;
              return (
                <div key={row} style={styles.seatRow}>
                  <div style={styles.rowNum}>{row}</div>
                  {ECONOMY_COLS.slice(0, 3).map(col => {
                    const seat = `${row}${col}`;
                    const status = getSeatStatus(seat);
                    return (
                      <div key={col} style={economyStyle(status)}
                        onClick={() => status !== 'booked' && handleSelect(seat)}
                        title={`Seat ${seat} — Economy`}>
                        {getLabel(seat, status)}
                      </div>
                    );
                  })}
                  <div style={{ width: 20, textAlign: 'center', fontSize: 11, color: '#ddd' }}>│</div>
                  {ECONOMY_COLS.slice(3).map(col => {
                    const seat = `${row}${col}`;
                    const status = getSeatStatus(seat);
                    return (
                      <div key={col} style={economyStyle(status)}
                        onClick={() => status !== 'booked' && handleSelect(seat)}
                        title={`Seat ${seat} — Economy`}>
                        {getLabel(seat, status)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Selected seats summary */}
      {selected.length > 0 && (
        <div style={{
          ...styles.selectedInfo,
          background: resolvedClass === 'business' ? 'linear-gradient(135deg,#fff8e1,#ffe082)' : '#e8eeff',
          borderColor: resolvedClass === 'business' ? '#ffd54f' : '#99aadd',
          color: resolvedClass === 'business' ? '#7a5800' : '#003399',
        }}>
          {resolvedClass === 'business' ? '👑' : '✈️'}{' '}
          {isMulti
            ? <><strong>{selected.join(', ')}</strong> — <strong>{resolvedClass === 'business' ? 'Business Class (+50%)' : 'Economy Class'}</strong></>
            : <><strong>Seat {selected[0]}</strong> — <strong>{resolvedClass === 'business' ? 'Business Class (+50%)' : 'Economy Class'}</strong></>
          }
        </div>
      )}
    </div>
  );
};

const styles = {
  progressBar: {
    background: '#f8faff', border: '1.5px solid #dde4ff',
    borderRadius: 12, padding: '14px 18px', marginBottom: 20,
  },
  progressLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, marginBottom: 10,
  },
  progressTrack: {
    height: 8, background: '#dde4ff', borderRadius: 99, overflow: 'hidden', marginBottom: 12,
  },
  progressFill: {
    height: '100%', borderRadius: 99, transition: 'width 0.3s ease',
  },
  seatChips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  seatChip: {
    fontSize: 11, fontWeight: 700, padding: '4px 10px',
    borderRadius: 20, transition: 'all 0.2s',
  },

  legend: { display: 'flex', gap: 16, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  ldot: { width: 20, height: 20, borderRadius: 4 },
  lLabel: { fontSize: 12, color: '#666' },

  planeWrap: { maxWidth: 420, margin: '0 auto' },
  classSection: { marginBottom: 8 },
  classBanner: (borderColor, bg) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    background: bg, border: `2px solid ${borderColor}`,
    borderRadius: 10, padding: '10px 16px', marginBottom: 12,
  }),
  classTitle: { fontWeight: 800, fontSize: 14, color: '#1a1a2e' },
  classSub: { fontSize: 11, color: '#888', marginTop: 2 },
  colHeaders: { display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginBottom: 4 },
  rowNumCell: { width: 28 },
  colHead: { width: 42, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa' },
  seatRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 },
  rowNum: { width: 28, textAlign: 'center', fontSize: 11, color: '#bbb', fontWeight: 600 },
  econGrid: { maxHeight: 300, overflowY: 'auto', paddingRight: 4 },
  classDivider: { display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', padding: '0 8px' },
  dividerLine: { flex: 1, height: 1, background: '#dde4ff' },
  dividerText: { fontSize: 11, fontWeight: 700, color: '#888', whiteSpace: 'nowrap' },
  selectedInfo: {
    textAlign: 'center', marginTop: 16,
    padding: '12px 20px', borderRadius: 10,
    fontSize: 14, border: '2px solid', fontWeight: 500,
  },
};

export default SeatSelector;
