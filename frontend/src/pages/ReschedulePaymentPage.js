import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { toast } from 'react-toastify';

const fmt = (dt, opts) => new Date(dt).toLocaleDateString('en-PH', opts);
const fmtShort = (dt) => fmt(dt, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const LegFeeTable = ({ fee, label, accentColor = '#003399' }) => {
  if (!fee) return null;
  return (
    <div style={S.legFeeBlock}>
      {label && <div style={{ ...S.legFeeLabel, color: accentColor }}>{label}</div>}
      <div style={S.feeTable}>
        <div style={S.feeRow}><span style={S.feeLabel}>Original price / pax (incl. VAT)</span><span style={S.feeVal}>₱{(fee.pricePerPax||0).toLocaleString()}</span></div>
        <div style={S.feeRow}><span style={S.feeLabel}>New price / pax (incl. VAT)</span><span style={S.feeVal}>₱{(fee.newPricePerPax||0).toLocaleString()}</span></div>
        <div style={S.feeRow}><span style={S.feeLabel}>Passengers</span><span style={S.feeVal}>× {fee.passengerCount||1}</span></div>
        {fee.classChanged && (
          <div style={{...S.feeRow, borderTop:'1px dashed #ffaa66', paddingTop:8, marginTop:4}}>
            <span style={{...S.feeLabel, color:'#cc5500', fontWeight:700}}>🎖️ Class upgrade ({fee.oldClass} → {fee.newClass})</span>
            <span style={{...S.feeVal, color:'#cc5500'}}>+₱{(fee.totalUpgrade||0).toLocaleString()}</span>
          </div>
        )}
        {(fee.totalFareDiff||0) > 0 && (
          <div style={{...S.feeRow, borderTop:'1px dashed #dde4ff', paddingTop:8, marginTop:4}}>
            <span style={{...S.feeLabel, color:'#003399'}}>Fare difference (₱{(fee.fareDiffPerPax||0).toLocaleString()}{(fee.passengerCount||1)>1?` × ${fee.passengerCount}`:''})</span>
            <span style={{...S.feeVal, color:'#003399'}}>₱{(fee.totalFareDiff||0).toLocaleString()}</span>
          </div>
        )}
        <div style={{...S.feeRow, borderTop:'1px dashed #ffaa66', paddingTop:8, marginTop:4}}>
          <span style={{...S.feeLabel, color:'#cc5500'}}>Reschedule fee ({fee.feePercent||0}%{(fee.passengerCount||1)>1?` × ${fee.passengerCount} pax`:''})</span>
          <span style={{...S.feeVal, color:'#cc5500'}}>₱{(fee.totalRescheduleFee||0).toLocaleString()}</span>
        </div>
        <div style={{...S.feeRow, borderTop:`2px solid ${accentColor}`, paddingTop:8, marginTop:2}}>
          <span style={{...S.feeLabel, fontWeight:800, fontSize:14, color:'#1a1a2e'}}>Subtotal (incl. VAT)</span>
          <span style={{...S.feeVal, fontSize:18, fontWeight:900, color:'#ff6600'}}>₱{(fee.totalPayment||0).toLocaleString()}</span>
        </div>
      </div>
      {fee.ruleLabel && <div style={S.feePolicy}>📋 {fee.ruleLabel}</div>}
    </div>
  );
};

const ReschedulePaymentPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking]       = useState(null);
  const [gcashQR, setGcashQR]       = useState(null);
  const [proofFile, setProofFile]   = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    document.title = 'Reschedule Payment – Cebu Airline';
    fetchData();
  }, [bookingId]);

  const fetchData = async () => {
    try {
      const [bookingData, qrData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get('/payments/gcash-qr'),
      ]);
      if (bookingData.status !== 'reschedule_payment_pending') {
        toast.info('No pending reschedule payment for this booking.');
        navigate('/my-bookings');
        return;
      }
      setBooking(bookingData);
      setGcashQR(qrData.qrURL);
    } catch {
      toast.error('Failed to load payment info');
      navigate('/my-bookings');
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
    if (!proofFile) return toast.error('Please select a payment screenshot');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('paymentProof', proofFile);
      formData.append('bookingId', bookingId);
      await api.uploadFile('/payments/upload-reschedule-proof', formData);
      toast.success('Payment proof submitted! Awaiting admin review.');
      navigate(`/payment-success/${bookingId}`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="container"><div className="spinner" /></div>;
  if (!booking) return null;

  const fee = booking.rescheduleFeeBreakdown || {};
  const pending = booking.pendingReschedule || {};
  const totalPayment = fee.totalPayment || 0;
  const isBothLeg = fee.leg === 'both';
  const isReturnLeg = fee.leg === 'return';

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container" style={{ maxWidth: 820 }}>

        <h1 style={S.title}>💳 Reschedule Fee Payment</h1>
        <p style={S.sub}>
          Your reschedule is on hold. Complete payment below to confirm your new flight{isBothLeg ? 's' : ''}.
        </p>

        {/* Banner */}
        <div style={S.banner}>
          <div style={S.bannerLabel}>Booking Reference</div>
          <div style={S.bannerRef}>{bookingId}</div>

          {isBothLeg ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
              <div style={S.bannerLegRow}>
                <div style={S.bannerFlight}>
                  <div style={S.bannerFlightLabel}>✈️ Outbound (old)</div>
                  <div style={S.bannerFlightNum}>{booking.previousFlightNumber || '—'}</div>
                  {booking.previousDeparture && <div style={S.bannerFlightDate}>{fmtShort(booking.previousDeparture)}</div>}
                </div>
                <div style={S.bannerArrow}>→</div>
                <div style={S.bannerFlight}>
                  <div style={S.bannerFlightLabel}>✈️ Outbound (new)</div>
                  <div style={{...S.bannerFlightNum, color:'#00cc66'}}>{booking.flight?.flightNumber || '—'}</div>
                  {booking.flight?.departureTime && <div style={S.bannerFlightDate}>{fmtShort(booking.flight.departureTime)}</div>}
                </div>
              </div>
              <div style={S.bannerLegRow}>
                <div style={S.bannerFlight}>
                  <div style={S.bannerFlightLabel}>🔄 Return (old)</div>
                  <div style={S.bannerFlightNum}>{booking.previousReturnFlightNumber || '—'}</div>
                  {booking.previousReturnDeparture && <div style={S.bannerFlightDate}>{fmtShort(booking.previousReturnDeparture)}</div>}
                </div>
                <div style={S.bannerArrow}>→</div>
                <div style={S.bannerFlight}>
                  <div style={S.bannerFlightLabel}>🔄 Return (new)</div>
                  <div style={{...S.bannerFlightNum, color:'#00cc66'}}>Pending confirmation</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={S.bannerFlights}>
              <div style={S.bannerFlight}>
                <div style={S.bannerFlightLabel}>{isReturnLeg ? '🔄 Return (old)' : '✈️ Original'}</div>
                <div style={S.bannerFlightNum}>{isReturnLeg ? (booking.previousReturnFlightNumber||'—') : (booking.previousFlightNumber||'—')}</div>
                {!isReturnLeg && booking.previousDeparture && <div style={S.bannerFlightDate}>{fmtShort(booking.previousDeparture)}</div>}
              </div>
              <div style={S.bannerArrow}>→</div>
              <div style={S.bannerFlight}>
                <div style={S.bannerFlightLabel}>New Flight</div>
                <div style={{...S.bannerFlightNum, color:'#00cc66'}}>{isReturnLeg ? (booking.returnFlight?.flightNumber||'—') : (booking.flight?.flightNumber||'—')}</div>
                {!isReturnLeg && booking.flight?.departureTime && <div style={S.bannerFlightDate}>{fmtShort(booking.flight.departureTime)}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Fee Card */}
        <div style={S.feeCard}>
          <div style={S.feeTitle}>🔄 Reschedule Fee Breakdown</div>
          {isBothLeg ? (
            <>
              <LegFeeTable fee={fee.outbound} label="✈️ Outbound leg" accentColor="#003399" />
              <div style={S.legDivider} />
              <LegFeeTable fee={fee.return} label="🔄 Return leg" accentColor="#007744" />
              <div style={S.combinedTotal}>
                <span style={{ fontWeight:800, fontSize:15, color:'#1a1a2e' }}>Combined Total (incl. VAT)</span>
                <span style={{ fontWeight:900, fontSize:26, color:'#ff6600', fontFamily:'Montserrat, sans-serif' }}>₱{totalPayment.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <>
              <LegFeeTable fee={fee} />
              <div style={{ ...S.combinedTotal, marginTop:0 }}>
                <span style={{ fontWeight:800, fontSize:14, color:'#1a1a2e' }}>Total Payment Required (incl. VAT)</span>
                <span style={{ fontWeight:900, fontSize:24, color:'#ff6600', fontFamily:'Montserrat, sans-serif' }}>₱{totalPayment.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Steps */}
        <div style={S.steps}>
          <div style={S.step}>
            <div style={S.stepNum}>1</div>
            <div style={S.stepContent}>
              <h3 style={S.stepTitle}>Scan GCash QR Code</h3>
              <p style={S.stepDesc}>Open GCash and send exactly <strong style={{ color:'#ff6600' }}>₱{totalPayment.toLocaleString()}</strong>.</p>
              <div style={S.qrWrap}>
                {gcashQR
                  ? <img src={gcashQR} alt="GCash QR" style={S.qrImage} />
                  : <div style={S.qrPlaceholder}><div style={{ fontSize:48, marginBottom:12 }}>📲</div><p style={{ color:'#888', fontSize:14 }}>GCash QR not yet uploaded.</p></div>
                }
              </div>
              <div style={S.amountBox}>
                <span style={S.amountLabel}>Amount to Pay</span>
                <span style={S.amountValue}>₱{totalPayment.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>2</div>
            <div style={S.stepContent}>
              <h3 style={S.stepTitle}>Upload Payment Screenshot</h3>
              <p style={S.stepDesc}>Screenshot your GCash confirmation and upload it below.</p>
              <div style={S.uploadArea}>
                {previewUrl ? (
                  <div style={S.previewContainer}>
                    <img src={previewUrl} alt="Payment proof" style={S.previewImage} />
                    <button onClick={() => { setProofFile(null); setPreviewUrl(null); }} style={S.removeBtn}>Remove</button>
                  </div>
                ) : (
                  <label style={S.uploadLabel}>
                    <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
                    <p style={{ fontWeight:600, color:'#003399', marginBottom:4 }}>Click to upload screenshot</p>
                    <p style={{ color:'#888', fontSize:13 }}>JPG, PNG – Max 5MB</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display:'none' }} />
                  </label>
                )}
              </div>
              <button className="btn-primary" onClick={handleUpload} disabled={!proofFile||uploading}
                style={{ width:'100%', padding:14, fontSize:16, marginTop:16 }}>
                {uploading ? '⏳ Submitting...' : '📤 Submit Reschedule Payment'}
              </button>
            </div>
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>3</div>
            <div style={S.stepContent}>
              <h3 style={S.stepTitle}>Await Admin Confirmation</h3>
              <p style={S.stepDesc}>Once verified, your reschedule will be confirmed and you'll receive an updated booking email.</p>
              <div style={S.checkList}>
                {['📧 Updated confirmation email will be sent','🔳 New QR boarding pass will be generated','🖨️ Print ticket will reflect the new flight'].map((item, i) => (
                  <div key={i} style={S.checkItem}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => navigate('/my-bookings')} style={S.backBtn}>← View My Bookings</button>
      </div>
    </div>
  );
};

const S = {
  title: { fontFamily:'Montserrat, sans-serif', fontSize:28, fontWeight:800, color:'#003399', marginBottom:8 },
  sub:   { color:'#666', fontSize:15, marginBottom:28 },
  banner: { background:'linear-gradient(135deg,#001f66,#003399)', borderRadius:16, padding:'24px 32px', marginBottom:24, color:'white', textAlign:'center' },
  bannerLabel:      { fontSize:11, opacity:0.7, textTransform:'uppercase', letterSpacing:1, marginBottom:6 },
  bannerRef:        { fontSize:26, fontWeight:900, letterSpacing:2, fontFamily:'Montserrat, sans-serif', marginBottom:16 },
  bannerFlights:    { display:'flex', justifyContent:'center', alignItems:'center', gap:24 },
  bannerLegRow:     { display:'flex', justifyContent:'center', alignItems:'center', gap:24, background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'12px 20px' },
  bannerFlight:     { display:'flex', flexDirection:'column', alignItems:'center', gap:2 },
  bannerFlightLabel:{ fontSize:10, opacity:0.6, textTransform:'uppercase', letterSpacing:1 },
  bannerFlightNum:  { fontSize:18, fontWeight:900, fontFamily:'Montserrat, sans-serif' },
  bannerFlightDate: { fontSize:12, opacity:0.75 },
  bannerArrow:      { fontSize:22, opacity:0.5 },
  feeCard:    { background:'#fff8f0', border:'1.5px solid #ffaa66', borderRadius:16, padding:'22px 26px', marginBottom:28 },
  feeTitle:   { fontSize:13, fontWeight:800, color:'#cc5500', textTransform:'uppercase', letterSpacing:0.8, marginBottom:16 },
  legFeeBlock:{ marginBottom:4 },
  legFeeLabel:{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 },
  legDivider: { height:1, background:'#ffe0cc', margin:'16px 0' },
  combinedTotal: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff3e0', borderRadius:10, padding:'14px 18px', border:'2px solid #ffaa66', marginTop:16 },
  feeTable:  { display:'flex', flexDirection:'column' },
  feeRow:    { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #ffe0cc' },
  feeLabel:  { fontSize:13, color:'#555' },
  feeVal:    { fontSize:13, fontWeight:700, color:'#1a1a2e' },
  feePolicy: { fontSize:11, color:'#888', fontStyle:'italic', marginTop:8 },
  steps:     { display:'flex', flexDirection:'column', gap:20 },
  step:      { display:'flex', gap:20, background:'white', borderRadius:16, padding:28, boxShadow:'0 4px 20px rgba(0,51,153,0.08)', border:'1px solid #dde4ff' },
  stepNum:   { width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#003399,#0066ff)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:18, flexShrink:0, fontFamily:'Montserrat, sans-serif' },
  stepContent:{ flex:1 },
  stepTitle: { fontFamily:'Montserrat, sans-serif', fontSize:18, fontWeight:800, color:'#003399', marginBottom:8 },
  stepDesc:  { color:'#666', fontSize:14, lineHeight:1.6, marginBottom:20 },
  qrWrap:    { textAlign:'center', marginBottom:16 },
  qrImage:   { width:200, height:200, border:'4px solid #003399', borderRadius:12, objectFit:'contain' },
  qrPlaceholder: { width:200, height:200, border:'2px dashed #dde4ff', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', margin:'0 auto', background:'#f8faff' },
  amountBox:  { background:'#f0f4ff', borderRadius:10, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  amountLabel:{ color:'#666', fontSize:14, fontWeight:600 },
  amountValue:{ color:'#ff6600', fontWeight:900, fontSize:26, fontFamily:'Montserrat, sans-serif' },
  uploadArea: { border:'2px dashed #99aadd', borderRadius:12, minHeight:160, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  uploadLabel:{ width:'100%', minHeight:160, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:24 },
  previewContainer:{ position:'relative', width:'100%' },
  previewImage:    { width:'100%', maxHeight:280, objectFit:'contain', display:'block' },
  removeBtn: { position:'absolute', top:8, right:8, background:'rgba(204,34,34,0.9)', color:'white', border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600 },
  checkList: { display:'flex', flexDirection:'column', gap:10 },
  checkItem: { background:'#f0f4ff', borderRadius:8, padding:'10px 16px', color:'#333', fontSize:14 },
  backBtn:   { background:'none', border:'none', color:'#003399', fontSize:15, fontWeight:600, cursor:'pointer', padding:'16px 0' },
};

export default ReschedulePaymentPage;
