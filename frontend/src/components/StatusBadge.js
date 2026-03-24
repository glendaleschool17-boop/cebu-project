const StatusBadge = ({ status }) => {
  const configs = {
    confirmed: { label: '✓ Confirmed', bg: '#e6fff3', color: '#007744' },
    pending_payment: { label: '⏳ Pending Payment', bg: '#fff8e1', color: '#cc8800' },
    payment_submitted: { label: '📤 Under Review', bg: '#e8eeff', color: '#003399' },
    rejected: { label: '✕ Rejected', bg: '#ffe8e8', color: '#cc2222' },
    cancelled: { label: '⊘ Cancelled', bg: '#f0f0f0', color: '#666' },
    flight_cancelled: { label: '✈️ Flight Cancelled', bg: '#fff0f0', color: '#cc2222' },
    cancellation_requested: { label: '🔄 Cancel Requested', bg: '#fff0e0', color: '#cc5500' },
    reschedule_requested:        { label: '✈️ Reschedule Req.', bg: '#e8f0ff', color: '#0044cc' },
    reschedule_payment_pending:  { label: '💳 Reschedule Pmt.', bg: '#fff8e1', color: '#cc8800' },
    paid: { label: '✓ Paid', bg: '#e6fff3', color: '#007744' },
    unpaid: { label: '⏳ Unpaid', bg: '#fff8e1', color: '#cc8800' },
    pending_review: { label: '👁 In Review', bg: '#e8eeff', color: '#0044cc' },
    refunded:       { label: '✓ Refunded', bg: '#e6fff3', color: '#007744' },
    refund_pending: { label: '⏳ Refund Processing', bg: '#fff0e0', color: '#cc5500' },
  };

  const cfg = configs[status] || { label: status, bg: '#f0f0f0', color: '#666' };

  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-block',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    }}>
      {cfg.label}
    </span>
  );
};

export default StatusBadge;
