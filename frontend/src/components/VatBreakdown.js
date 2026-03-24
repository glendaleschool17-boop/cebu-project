import { calcVAT } from '../utils/vatCalculator';

/**
 * Reusable VAT breakdown block.
 * Props:
 *  subtotal       — booking.price (pre-VAT amount)
 *  passengerCount — number of passengers (default 1)
 *  compact        — if true, renders a smaller inline version
 *  showPerPax     — show per-passenger rows (default true when pax > 1)
 */
const VatBreakdown = ({ subtotal = 0, passengerCount = 1, compact = false, showPerPax }) => {
  const vat = calcVAT(subtotal, passengerCount);
  const showPax = showPerPax !== undefined ? showPerPax : passengerCount > 1;

  if (compact) {
    return (
      <div style={S.compact}>
        <span style={S.compactLabel}>Subtotal</span>
        <span style={S.compactVal}>₱{vat.subtotal.toLocaleString()}</span>
        <span style={S.compactLabel}>VAT (12%)</span>
        <span style={S.compactVal}>₱{vat.vatAmount.toLocaleString()}</span>
        <span style={{ ...S.compactLabel, fontWeight: 800, color: '#1a1a2e' }}>Total incl. VAT</span>
        <span style={{ ...S.compactVal, fontWeight: 900, color: '#ff6600', fontSize: 16 }}>₱{vat.grandTotal.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>🧾 VAT Invoice Summary</div>

      {showPax && (
        <>
          <div style={S.row}>
            <span style={S.label}>Fare per passenger</span>
            <span style={S.val}>₱{vat.perPaxSubtotal.toLocaleString()}</span>
          </div>
          <div style={S.row}>
            <span style={{ ...S.label, color: '#888' }}>VAT 12% per passenger</span>
            <span style={{ ...S.val, color: '#888' }}>₱{vat.perPaxVat.toLocaleString()}</span>
          </div>
          <div style={{ ...S.row, borderBottom: '1px dashed #dde4ff', paddingBottom: 8, marginBottom: 4 }}>
            <span style={{ ...S.label, fontWeight: 700 }}>Total per passenger</span>
            <span style={{ ...S.val, fontWeight: 700 }}>₱{vat.perPaxTotal.toLocaleString()}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>× {passengerCount} passengers</span>
            <span style={S.val}></span>
          </div>
        </>
      )}

      <div style={S.row}>
        <span style={S.label}>Subtotal (excl. VAT)</span>
        <span style={S.val}>₱{vat.subtotal.toLocaleString()}</span>
      </div>
      <div style={S.row}>
        <span style={{ ...S.label, color: '#555' }}>VAT (12%)</span>
        <span style={{ ...S.val, color: '#555' }}>₱{vat.vatAmount.toLocaleString()}</span>
      </div>
      <div style={S.totalRow}>
        <span style={S.totalLabel}>Grand Total (incl. VAT)</span>
        <span style={S.totalVal}>₱{vat.grandTotal.toLocaleString()}</span>
      </div>
      <div style={S.note}>
        Philippines VAT (EVAT) at 12% per NIRC. This serves as your official VAT receipt.
      </div>
    </div>
  );
};

const S = {
  card: {
    background: '#f8faff',
    border: '1.5px solid #dde4ff',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: '#003399',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #eef0ff',
  },
  label: { fontSize: 13, color: '#555' },
  val:   { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 2,
    borderTop: '2px solid #003399',
  },
  totalLabel: { fontSize: 14, fontWeight: 800, color: '#1a1a2e' },
  totalVal:   { fontSize: 22, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' },
  note: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 1.4,
  },
  compact: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '4px 16px',
    background: '#f8faff',
    border: '1px solid #dde4ff',
    borderRadius: 8,
    padding: '10px 14px',
    marginTop: 8,
  },
  compactLabel: { fontSize: 12, color: '#888' },
  compactVal:   { fontSize: 12, fontWeight: 700, color: '#1a1a2e', textAlign: 'right' },
};

export default VatBreakdown;
