import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { calcVAT } from '../utils/vatCalculator';
import { toast } from 'react-toastify';

const PaymentPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [gcashQR, setGcashQR] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const inProgressRef = useRef(false);

  // Block browser refresh/tab-close while payment is pending
  useEffect(() => {
    const handler = (e) => {
      if (!inProgressRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Block browser back button while payment is pending
  useEffect(() => {
    const handler = () => {
      if (!inProgressRef.current) return;
      window.history.pushState(null, '', window.location.href);
      const confirmed = window.confirm(
        'Are you sure you want to leave? Your seat reservation may be lost.'
      );
      if (confirmed) {
        inProgressRef.current = false;
        window.history.back();
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = 'Payment – Cebu Airline'; fetchData(); }, [bookingId]);

  const fetchData = async () => {
    try {
      const [bookingData, qrData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get('/payments/gcash-qr'),
      ]);
      // Redirect if booking is in a state that shouldn't reach this page
      if (bookingData.status === 'reschedule_payment_pending') {
        navigate(`/reschedule-payment/${bookingId}`, { replace: true });
        return;
      }
      if (bookingData.status === 'confirmed' && bookingData.paymentStatus === 'paid') {
        toast.info('This booking is already confirmed and paid.');
        navigate('/my-bookings', { replace: true });
        return;
      }
      if (bookingData.status === 'payment_submitted') {
        toast.info('Payment is already submitted and awaiting review.');
        navigate('/my-bookings', { replace: true });
        return;
      }
      if (bookingData.status === 'cancelled' || bookingData.status === 'expired') {
        toast.error('This booking is no longer active.');
        navigate('/my-bookings', { replace: true });
        return;
      }
      // Allow: pending_payment and rejected (re-upload)
      inProgressRef.current = true;
      setBooking(bookingData);
      setGcashQR(qrData.qrURL);
    } catch (err) {
      toast.error('Failed to load payment info');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!proofFile) return toast.error('Please select a file');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('paymentProof', proofFile);
      formData.append('bookingId', bookingId);
      await api.uploadFile('/payments/upload-proof', formData);
      // Payment submitted — safe to navigate away
      inProgressRef.current = false;
      navigate(`/payment-success/${bookingId}`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="container"><div className="spinner" /></div>;

  // Countdown helpers
  const fmtCountdown = (ms) => {
    if (ms <= 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const msLeft   = booking?.expiresAt ? new Date(booking.expiresAt) - now : null;
  const expired  = msLeft !== null && msLeft <= 0;
  const soonWarn = msLeft !== null && msLeft > 0 && msLeft < 5 * 60 * 1000;

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <h1 style={styles.title}>💳 GCash Payment</h1>
        <p style={styles.sub}>Complete your payment via GCash to confirm your booking.</p>

        {/* Booking Summary Banner */}
        <div style={styles.bookingSummary}>
          <div style={styles.summaryHeader}>Booking Reference</div>
          <div style={styles.refNumber}>{bookingId}</div>
          {booking?.flight && (() => {
            const pax   = booking.passengerCount || 1;
            const vat   = calcVAT(booking.price || 0, pax);
            const seats = booking.seatNumbers?.length > 1
              ? booking.seatNumbers.join(', ')
              : (booking.seatNumber || '—');
            return (
              <div style={styles.summaryDetails}>
                <span>✈️ {booking.flight.flightNumber}</span>
                <span>📍 {booking.flight.origin} → {booking.flight.destination}</span>
                <span>💺 {pax > 1 ? `Seats ${seats}` : `Seat ${seats}`}</span>
                {pax > 1 && <span>👥 {pax} passengers</span>}
                <span style={styles.amount}>
                  ₱{vat.grandTotal.toLocaleString()}{' '}
                  <span style={{ fontSize: 11, opacity: 0.75 }}>(incl. VAT)</span>
                </span>
              </div>
            );
          })()}
        </div>

        {/* Countdown Timer */}
        {booking?.expiresAt && (
          expired ? (
            <div style={styles.expiredBanner}>
              <span style={{ fontSize: 20 }}>⏰</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Booking Expired</div>
                <div style={{ fontSize: 13 }}>Your booking has expired and the seat has been released. Please start a new booking.</div>
              </div>
              <button onClick={() => navigate('/search')} style={styles.expiredBtn}>Search Again →</button>
            </div>
          ) : (
            <div style={{
              ...styles.timerBanner,
              background: soonWarn ? '#fff0f0' : '#fff8e1',
              borderColor: soonWarn ? '#ffaaaa' : '#ffc107',
              borderLeftColor: soonWarn ? '#cc2222' : '#ffa000',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{soonWarn ? '🚨' : '⏳'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: soonWarn ? '#cc2222' : '#856404', marginBottom: 2 }}>
                  {soonWarn ? 'Expiring soon! Complete payment now' : 'Booking held — complete payment within'}
                </div>
                <div style={{ fontSize: 12, color: soonWarn ? '#cc2222' : '#666' }}>
                  Your seat is reserved for a limited time. If payment is not submitted before the timer runs out, your booking will be automatically cancelled and the seat released.
                </div>
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 28, fontWeight: 900, flexShrink: 0,
                background: soonWarn ? '#cc2222' : '#ffa000',
                color: 'white', padding: '6px 14px', borderRadius: 10, minWidth: 80, textAlign: 'center',
              }}>
                {fmtCountdown(msLeft)}
              </div>
            </div>
          )
        )}

        {/* Steps */}
        <div style={styles.steps}>

          {/* Step 1 — QR + breakdown */}
          <div style={styles.step}>
            <div style={styles.stepNum}>1</div>
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Scan GCash QR Code</h3>
              <p style={styles.stepDesc}>
                Open your GCash app and scan the QR code below to send your payment.
              </p>
              <div style={styles.qrContainer}>
                {gcashQR ? (
                  <img src={gcashQR} alt="GCash QR" style={styles.qrImage} />
                ) : (
                  <div style={styles.qrPlaceholder}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📲</div>
                    <p style={{ color: '#888', fontSize: 14 }}>
                      GCash QR not yet uploaded by admin.<br />
                      Please contact us for payment instructions.
                    </p>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              {(() => {
                const pax            = booking?.passengerCount || 1;
                const isRT           = booking?.tripType === 'roundtrip';
                const isBiz          = booking?.seatClass === 'business';
                const subtotal       = booking?.price || 0;
                const vat            = calcVAT(subtotal, pax);
                const perPaxOutbound = pax > 0 ? Math.round((booking?.outboundPrice || 0) / pax) : 0;
                const perPaxReturn   = pax > 0 ? Math.round((booking?.returnPrice   || 0) / pax) : 0;

                return (
                  <div style={styles.breakdownBox}>
                    <div style={styles.breakdownTitle}>💰 Payment Breakdown</div>

                    {isRT ? (
                      <>
                        <div style={styles.breakdownRow}>
                          <span style={styles.breakdownLabel}>✈️ Outbound fare / pax</span>
                          <span style={styles.breakdownVal}>
                            ₱{perPaxOutbound.toLocaleString()}
                            {pax > 1 && <span style={styles.breakdownMult}> × {pax} pax</span>}
                          </span>
                        </div>
                        <div style={styles.breakdownRow}>
                          <span style={styles.breakdownLabel}>🔄 Return fare / pax</span>
                          <span style={styles.breakdownVal}>
                            ₱{perPaxReturn.toLocaleString()}
                            {pax > 1 && <span style={styles.breakdownMult}> × {pax} pax</span>}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={styles.breakdownRow}>
                        <span style={styles.breakdownLabel}>
                          ✈️ Ticket price / pax{pax > 1 ? ` × ${pax}` : ''}
                        </span>
                        <span style={styles.breakdownVal}>
                          ₱{vat.perPaxSubtotal.toLocaleString()}
                          {pax > 1 && <span style={styles.breakdownMult}> × {pax}</span>}
                        </span>
                      </div>
                    )}

                    {isBiz && (
                      <div style={styles.breakdownRow}>
                        <span style={{ ...styles.breakdownLabel, color: '#b8860b' }}>👑 Business class (+50%)</span>
                        <span style={{ ...styles.breakdownVal, color: '#b8860b' }}>included</span>
                      </div>
                    )}

                    <div style={{ ...styles.breakdownRow, borderTop: '1px dashed #c8d8ff', marginTop: 4, paddingTop: 10 }}>
                      <span style={styles.breakdownLabel}>
                        {pax > 1 ? `Subtotal (${pax} passengers)` : 'Subtotal'}
                      </span>
                      <span style={styles.breakdownVal}>₱{vat.subtotal.toLocaleString()}</span>
                    </div>
                    <div style={styles.breakdownRow}>
                      <span style={{ ...styles.breakdownLabel, color: '#555' }}>🧾 VAT (12%)</span>
                      <span style={{ ...styles.breakdownVal, color: '#555' }}>₱{vat.vatAmount.toLocaleString()}</span>
                    </div>
                    <div style={styles.breakdownTotal}>
                      <span style={styles.breakdownTotalLabel}>Total Amount to Pay</span>
                      <span style={styles.amountValue}>₱{vat.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Step 2 — Upload proof */}
          <div style={styles.step}>
            <div style={styles.stepNum}>2</div>
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Upload Payment Proof</h3>
              <p style={styles.stepDesc}>
                Take a screenshot of your GCash payment confirmation and upload it here.
              </p>

              <div style={styles.uploadArea}>
                {previewUrl ? (
                  <div style={styles.previewContainer}>
                    <img src={previewUrl} alt="Payment proof" style={styles.previewImage} />
                    <button
                      onClick={() => { setProofFile(null); setPreviewUrl(null); }}
                      style={styles.removeBtn}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label style={styles.uploadLabel}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                    <p style={{ fontWeight: 600, color: '#003399', marginBottom: 4 }}>Click to upload screenshot</p>
                    <p style={{ color: '#888', fontSize: 13 }}>JPG, PNG, GIF – Max 5MB</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={!proofFile || uploading}
                style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 16 }}
              >
                {uploading ? 'Submitting...' : '📤 Submit Payment Proof'}
              </button>
            </div>
          </div>

          {/* Step 3 — Await approval */}
          <div style={styles.step}>
            <div style={styles.stepNum}>3</div>
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Wait for Admin Approval</h3>
              <p style={styles.stepDesc}>
                Once submitted, an admin will review your payment proof within 1–24 hours.
                You'll receive a confirmation email with your boarding pass QR code.
              </p>
              <div style={styles.checkList}>
                {[
                  '📧 Confirmation email will be sent',
                  '🔳 QR boarding pass will be generated',
                  '🖨️ Print ticket will be enabled',
                ].map((item, i) => (
                  <div key={i} style={styles.checkItem}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => navigate('/my-bookings')} style={styles.backBtn}>
          ← View My Bookings
        </button>
      </div>
    </div>
  );
};

const styles = {
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399', marginBottom: 8 },
  sub:   { color: '#666', fontSize: 16, marginBottom: 32 },
  bookingSummary: {
    background: 'linear-gradient(135deg, #001f66, #003399)',
    borderRadius: 16, padding: '24px 32px', marginBottom: 32, color: 'white', textAlign: 'center',
  },
  summaryHeader: { fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  refNumber: { fontSize: 28, fontWeight: 900, letterSpacing: 2, fontFamily: 'Montserrat, sans-serif', marginBottom: 16 },
  summaryDetails: { display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', fontSize: 14, opacity: 0.85 },
  amount: { color: '#ffcc44', fontWeight: 800, fontSize: 18 },
  steps: { display: 'flex', flexDirection: 'column', gap: 24 },
  step: {
    display: 'flex', gap: 20, background: 'white', borderRadius: 16,
    padding: 28, boxShadow: '0 4px 20px rgba(0,51,153,0.08)', border: '1px solid #dde4ff',
  },
  stepNum: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg, #003399, #0066ff)',
    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 18, flexShrink: 0, fontFamily: 'Montserrat, sans-serif',
  },
  stepContent: { flex: 1 },
  stepTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#003399', marginBottom: 8 },
  stepDesc:  { color: '#666', fontSize: 14, lineHeight: 1.6, marginBottom: 20 },
  qrContainer: { textAlign: 'center', marginBottom: 16 },
  qrImage: { width: 200, height: 200, border: '4px solid #003399', borderRadius: 12, objectFit: 'contain' },
  qrPlaceholder: {
    width: 200, height: 200, border: '2px dashed #dde4ff', borderRadius: 12,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto', background: '#f8faff',
  },
  amountValue: { color: '#ff6600', fontWeight: 900, fontSize: 24, fontFamily: 'Montserrat, sans-serif' },
  breakdownBox: {
    background: '#f8faff', border: '1.5px solid #dde4ff', borderRadius: 12,
    padding: '16px 20px', display: 'flex', flexDirection: 'column',
  },
  breakdownTitle: { fontSize: 13, fontWeight: 800, color: '#003399', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  breakdownRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #eef0ff' },
  breakdownLabel: { fontSize: 13, color: '#555' },
  breakdownVal:   { fontSize: 13, fontWeight: 700, color: '#1a1a2e' },
  breakdownMult:  { fontSize: 12, color: '#888', fontWeight: 500 },
  breakdownTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 },
  breakdownTotalLabel: { fontSize: 13, fontWeight: 700, color: '#555' },
  uploadArea: {
    border: '2px dashed #99aadd', borderRadius: 12, minHeight: 160,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  uploadLabel: {
    width: '100%', minHeight: 160, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 24,
  },
  previewContainer: { position: 'relative', width: '100%' },
  previewImage: { width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' },
  removeBtn: {
    position: 'absolute', top: 8, right: 8, background: 'rgba(204,34,34,0.9)',
    color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  checkList: { display: 'flex', flexDirection: 'column', gap: 10 },
  checkItem: { background: '#f0f4ff', borderRadius: 8, padding: '10px 16px', color: '#333', fontSize: 14 },
  backBtn: {
    background: 'none', border: 'none', color: '#003399',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '16px 0',
  },
  timerBanner: {
    display: 'flex', alignItems: 'center', gap: 16,
    border: '1.5px solid', borderLeft: '4px solid',
    borderRadius: 12, padding: '14px 20px', marginBottom: 24,
  },
  expiredBanner: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: '#fff0f0', border: '1.5px solid #ffaaaa', borderLeft: '4px solid #cc2222',
    borderRadius: 12, padding: '14px 20px', marginBottom: 24,
    color: '#cc2222',
  },
  expiredBtn: {
    background: '#cc2222', color: 'white', border: 'none',
    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0,
  },
};

export default PaymentPage;
