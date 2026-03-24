import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import VatBreakdown from '../components/VatBreakdown';

const TicketPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    document.title = 'My Ticket – Cebu Airline';
    fetchTicket();
  }, [bookingId]);

  // Returns a promise that resolves when the script is loaded (or immediately if already loaded)
  const ensureScript = (id, src, globalKey) => new Promise((resolve, reject) => {
    if (window[globalKey]) return resolve();
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.src = src;
      document.head.appendChild(el);
    }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Failed to load ' + src));
    // If already in DOM but finished loading (no onload fired yet), poll briefly
    if (el.readyState === 'complete') resolve();
  });

  const fetchTicket = async () => {
    try {
      const result = await api.get('/ticket/' + bookingId);
      setData(result);
    } catch (err) {
      toast.error(err.message || 'Ticket not available');
      navigate('/my-bookings');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      // Load libraries on-demand, wait for them to be ready
      await ensureScript('jspdf-script', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
      await ensureScript('h2c-script', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');

      const { jsPDF } = window.jspdf;
      const html2canvas = window.html2canvas;

      const { booking, flight } = data;
      const suffix = isRoundTrip ? `${flight.origin}-${flight.destination}-RT` : `${flight.origin}-${flight.destination}`;
      const filename = `CebuAirlines-${booking.bookingId}-${suffix}.pdf`;

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const A4_W = 210, A4_H = 297, M = 8;
      const usableW = A4_W - M * 2;

      const toCanvas = (el) => html2canvas(el, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0, scrollY: 0,
        windowWidth: document.documentElement.scrollWidth,
      });

      const addElToPage = async (el, isFirstPage) => {
        const canvas = await toCanvas(el);
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const ratio = canvas.height / canvas.width;
        const maxH = A4_H - M * 2;
        const printW = usableW;
        const printH = printW * ratio;
        const finalW = printH > maxH ? maxH / ratio : printW;
        const finalH = Math.min(printH, maxH);
        const xOff = M + (usableW - finalW) / 2;
        if (!isFirstPage) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', xOff, M, finalW, finalH);
      };

      const coupons = document.querySelectorAll('.passenger-coupon');

      if (coupons.length <= 1) {
        await addElToPage(document.getElementById('ticket-content'), true);
      } else {
        await addElToPage(document.getElementById('pdf-shared-header'), true);
        for (const coupon of coupons) {
          await addElToPage(coupon, false);
        }
      }

      pdf.save(filename);
      const n = coupons.length || 1;
      toast.success('Downloaded ' + n + ' ticket' + (n > 1 ? 's' : '') + ' as PDF!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('PDF failed: ' + (err.message || 'unknown error') + '. Try Ctrl+P to print instead.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return null;

  const { booking, flight, returnFlight, passengerQRs } = data;
  const isRoundTrip = booking.tripType === 'roundtrip' && !!returnFlight;
  // Outbound class
  const outboundIsBusinessClass = booking.seatClass === 'business';
  // Return class (may differ from outbound for round-trip bookings)
  const returnIsBusinessClass = (booking.returnSeatClass || booking.seatClass) === 'business';
  // Overall: use outbound class for the shared header; if legs differ, note it
  const isBusinessClass = outboundIsBusinessClass; // used for shared header / one-way
  const hasMixedClass = isRoundTrip && outboundIsBusinessClass !== returnIsBusinessClass;
  const classColor = isBusinessClass ? '#ffd700' : '#00cc66';
  const classLabel = hasMixedClass
    ? '✈️ ECONOMY + 👑 BUSINESS'
    : isBusinessClass ? '👑 BUSINESS CLASS' : '✈️ ECONOMY CLASS';
  const classColorText = isBusinessClass ? '#b8860b' : '#003399';
  const classBg = isBusinessClass ? '#fff8e1' : '#e8eeff';
  const classBorder = isBusinessClass ? '#ffd54f' : '#99aadd';

  const passengerCount = booking.passengerCount || 1;
  const passengers = booking.passengers && booking.passengers.length > 0
    ? booking.passengers
    : [{ name: booking.passengerName, email: booking.passengerEmail, phone: booking.passengerPhone || '', seat: booking.seatNumber }];

  const formatTime = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (dt) => new Date(dt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const getDuration = (dep, arr) => {
    const diff = (new Date(arr) - new Date(dep)) / 60000;
    return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm';
  };
  const boardingTime = (dep) => new Date(new Date(dep).getTime() - 45 * 60000)
    .toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const gateNum = (booking.bookingId?.charCodeAt(4) || 7) % 20 + 1;

  const getQR = (index) => {
    if (passengerQRs && passengerQRs[index]) return passengerQRs[index].qrDataUrl;
    return booking.qrCodeURL || null;
  };

  const FlightLeg = ({ f, label, accentColor }) => (
    <div>
      {isRoundTrip && (
        <div style={{ background: accentColor, color: 'white', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', padding: '6px 36px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          {label}
        </div>
      )}
      <div style={{ ...S.routeSection, background: isRoundTrip ? accentColor + '08' : '#f8faff' }}>
        <div style={S.routePoint}>
          <div style={S.airportCode}>{f.origin}</div>
          <div style={S.airportCity}>{f.originCity}</div>
          <div style={S.flightTime}>{formatTime(f.departureTime)}</div>
          <div style={S.timeLabel}>Departure</div>
          <div style={{ ...S.timeLabel, marginTop: 4 }}>{formatDateShort(f.departureTime)}</div>
        </div>
        <div style={S.routeCenter}>
          <div style={S.flightNumberBig}>{f.flightNumber}</div>
          <div style={S.planeIcon}>✈</div>
          <div style={S.duration}>{getDuration(f.departureTime, f.arrivalTime)}</div>
          <div style={S.directTag}>DIRECT</div>
        </div>
        <div style={S.routePoint}>
          <div style={S.airportCode}>{f.destination}</div>
          <div style={S.airportCity}>{f.destinationCity}</div>
          <div style={S.flightTime}>{formatTime(f.arrivalTime)}</div>
          <div style={S.timeLabel}>Arrival</div>
          <div style={{ ...S.timeLabel, marginTop: 4 }}>{formatDateShort(f.arrivalTime)}</div>
        </div>
      </div>
    </div>
  );

  // Per-passenger, per-leg coupon
  const PassengerCoupon = ({ passenger, index, legFlight, legLabel, legAccent, legSeat, isReturn }) => {
    const seat = legSeat || passenger.seat || booking.seatNumbers?.[index] || booking.seatNumber || '—';
    const qrUrl = getQR(index);
    const totalLegs = isRoundTrip ? 2 : 1;
    const perTicketPrice = Math.round((booking.price || 0) / (passengerCount * totalLegs));
    // ── Per-leg class: return leg may have a different class ──
    const legIsBusinessClass = isReturn ? returnIsBusinessClass : outboundIsBusinessClass;

    return (
      <div style={{ ...S.boardingCoupon, ...(isReturn ? { background: 'linear-gradient(135deg, #f0fff8 0%, #e8f5e9 100%)' } : {}) }} className="passenger-coupon">
        <div style={{ ...S.couponHeader, background: isReturn ? 'linear-gradient(135deg, #003322 0%, #005533 60%, #007744 100%)' : S.couponHeader.background }}>
          <div style={S.couponHeaderLeft}>
            <span style={S.couponAirline}>✈️ CEBU AIRLINES</span>
            <span style={S.couponBoardingLabel}>{isReturn ? 'RETURN PASS' : 'BOARDING PASS'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isRoundTrip && (
              <span style={{ background: isReturn ? 'rgba(0,200,100,0.2)' : 'rgba(100,160,255,0.15)', color: isReturn ? '#00ff99' : '#99ccff', border: `1.5px solid ${isReturn ? 'rgba(0,200,100,0.5)' : 'rgba(100,160,255,0.4)'}`, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                {isReturn ? '🔄 RETURN' : '✈️ OUTBOUND'}
              </span>
            )}
            {passengerCount > 1 && (
              <span style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1.5px solid rgba(255,215,0,0.4)', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                PAX {index + 1} / {passengerCount}
              </span>
            )}
            <span style={{ ...S.couponClassBadge, background: legIsBusinessClass ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.12)', border: '1.5px solid ' + (legIsBusinessClass ? '#ffd700' : 'rgba(255,255,255,0.35)'), color: legIsBusinessClass ? '#ffd700' : 'white' }}>
              {legIsBusinessClass ? '👑 BUSINESS' : '✈️ ECONOMY'}
            </span>
          </div>
        </div>

        <div style={S.perfLine}>
          <div style={S.perfCircleLeft} />
          <div style={S.perfDashes} />
          <div style={S.perfCircleRight} />
        </div>

        <div style={S.couponBody}>
          <div style={S.couponLeft}>
            <div style={S.couponRoute}>
              <div style={S.couponCity}>
                <div style={{ ...S.couponIata, color: isReturn ? '#007744' : '#003399' }}>{legFlight.origin}</div>
                <div style={S.couponCityName}>{legFlight.originCity}</div>
              </div>
              <div style={S.couponArrow}>
                <div style={S.couponFlight}>{legFlight.flightNumber}</div>
                <div style={{ ...S.couponArrowLine, color: isReturn ? '#007744' : '#003399' }}>{isReturn ? '──🔄──' : '──✈──'}</div>
                <div style={S.couponDuration}>{getDuration(legFlight.departureTime, legFlight.arrivalTime)}</div>
              </div>
              <div style={S.couponCity}>
                <div style={{ ...S.couponIata, color: isReturn ? '#007744' : '#003399' }}>{legFlight.destination}</div>
                <div style={S.couponCityName}>{legFlight.destinationCity}</div>
              </div>
            </div>

            <div style={S.couponGrid}>
              {[
                { label: 'PASSENGER', value: passenger.name, style: { fontSize: passenger.name.length > 16 ? 11 : 13 } },
                { label: 'DATE', value: formatDateShort(legFlight.departureTime) },
                { label: 'DEPARTS', value: formatTime(legFlight.departureTime), style: { fontSize: 20, color: isReturn ? '#007744' : '#003399' } },
                { label: 'ARRIVES', value: formatTime(legFlight.arrivalTime), style: { fontSize: 20, color: isReturn ? '#007744' : '#003399' } },
                { label: 'BOARDING', value: boardingTime(legFlight.departureTime), style: { color: '#cc5500' } },
                { label: 'GATE', value: 'G' + gateNum, style: { fontSize: 22, color: isReturn ? '#007744' : '#003399' } },
                { label: 'BOOKING REF', value: booking.bookingId, style: { fontSize: 12, letterSpacing: 1 } },
                { label: 'AIRCRAFT', value: legFlight.aircraft || 'A320' },
              ].map(({ label, value, style }) => (
                <div key={label} style={S.couponCell}>
                  <div style={S.couponCellLabel}>{label}</div>
                  <div style={{ ...S.couponCellValue, ...style }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={S.couponTotal}>
              <span style={S.couponTotalLabel}>{isRoundTrip ? (isReturn ? 'Return Leg' : 'Outbound Leg') : 'Ticket Total'}</span>
              <span style={{ ...S.couponTotalAmount, color: isReturn ? '#007744' : '#ff6600' }}>₱{perTicketPrice.toLocaleString()}</span>
              <span style={S.couponPayMethod}>via GCash ✓</span>
            </div>
          </div>

          <div style={S.couponDivider}><div style={S.couponDividerLine} /></div>

          <div style={S.couponRight}>
            <div style={S.couponSeatLabel}>SEAT</div>
            <div style={{ ...S.couponSeat, color: isReturn ? '#007744' : '#003399' }}>{seat}</div>
            <div style={S.couponSeatClass}>{legIsBusinessClass ? '👑 Business' : '✈️ Economy'}</div>
            <div style={S.couponQrWrap}>
              {qrUrl ? <img src={qrUrl} alt="QR" style={S.couponQr} /> : <div style={S.couponQrPlaceholder}>🔳</div>}
            </div>
            <div style={S.couponQrLabel}>Scan at gate</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print, nav, header { display: none !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .ticket-wrapper { padding: 0 !important; margin: 0 !important; background: white !important; }
          .ticket-page { box-shadow: none !important; border: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; }
          .passenger-coupon + .passenger-coupon { page-break-before: always; }
          .coupon-sep { display: none !important; }
        }
        @page { margin: 0; size: A4 portrait; }
      `}</style>

      {/* Action Bar */}
      <div className="no-print" style={S.actionBar}>
        <div style={S.actionContainer}>
          <button onClick={() => navigate('/my-bookings')} style={S.backBtn}>← Back to Bookings</button>
          <div style={S.actionRight}>
            <div style={S.successBadge}>
              ✅ Confirmed — 📧 Email Sent — 🖨️ Ready to Print
              {(passengerCount > 1 || isRoundTrip) && (
                <span style={{ marginLeft: 8, background: '#fff8e1', border: '1px solid #ffd54f', color: '#cc8800', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                  🎫 {isRoundTrip ? passengerCount * 2 : passengerCount} passes
                </span>
              )}
            </div>
            <button onClick={handleDownloadPDF} style={S.downloadBtn} disabled={downloading}>
              {downloading ? '⏳ Generating...' : '⬇️ Download PDF'}
            </button>
            <button onClick={handlePrint} style={S.printBtn}>
              🖨️ {isRoundTrip ? `Print All (${passengerCount * 2})` : passengerCount > 1 ? `Print All (${passengerCount})` : 'Print Ticket'}
            </button>
          </div>
        </div>
      </div>

      {/* Ticket */}
      <div className="ticket-wrapper" style={S.wrapper}>
        <div id="ticket-content" className="ticket-page" style={S.ticket}>

          {/* Shared header — also targeted by PDF renderer */}
          <div id="pdf-shared-header">
            <div style={S.ticketHeader}>
              <div style={S.headerLeft}>
                <div style={S.airlineLogo}>✈️</div>
                <div>
                  <div style={S.airlineName}>CEBU AIRLINES</div>
                  <div style={S.boardingPass}>BOARDING PASS</div>
                </div>
              </div>
              <div style={S.headerCenter}>
                <div style={{ background: isRoundTrip ? 'rgba(0,200,100,0.15)' : 'rgba(100,160,255,0.15)', border: '2px solid ' + (isRoundTrip ? '#00cc66' : '#66aaff'), color: isRoundTrip ? '#00cc66' : '#66aaff', padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {isRoundTrip ? '🔄 ROUND TRIP' : '➡️ ONE WAY'}
                </div>
              </div>
              <div style={S.headerRight}>
                <div style={{ ...S.statusStamp, borderColor: classColor, color: classColor }}>CONFIRMED</div>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, fontWeight: 800, color: classColor, letterSpacing: 1 }}>{classLabel}</div>
              </div>
            </div>
            <div style={S.headerDivider} />

            <FlightLeg f={flight} label="✈️ OUTBOUND FLIGHT" accentColor="#003399" />
            {isRoundTrip && (
              <>
                <div style={{ height: 1, background: '#dde4ff', margin: '0 28px' }} />
                <FlightLeg f={returnFlight} label="🔄 RETURN FLIGHT" accentColor="#007744" />
              </>
            )}

            <div style={S.detailsGrid}>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>{passengerCount > 1 ? 'LEAD PASSENGER' : 'PASSENGER NAME'}</div>
                <div style={S.detailValue}>{booking.passengerName}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>BOOKING REFERENCE</div>
                <div style={{ ...S.detailValue, fontSize: 17, letterSpacing: 1 }}>{booking.bookingId}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>TRIP TYPE</div>
                <div style={{ ...S.detailValue, color: isRoundTrip ? '#007744' : '#003399' }}>{isRoundTrip ? '🔄 Round Trip' : '➡️ One Way'}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>{passengerCount > 1 ? 'PASSENGERS' : 'SEAT'}</div>
                <div style={{ ...S.detailValue, fontSize: passengerCount > 1 ? 15 : 26, fontWeight: 900 }}>
                  {passengerCount > 1
                    ? <span style={{ background: classBg, color: classColorText, border: '1.5px solid ' + classBorder, padding: '3px 12px', borderRadius: 8, fontSize: 14 }}>👥 {passengerCount} Pax</span>
                    : (booking.seatNumbers?.[0] || booking.seatNumber)}
                </div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>AIRCRAFT</div>
                <div style={S.detailValue}>{flight.aircraft || 'Airbus A320'}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>BOARDING TIME</div>
                <div style={S.detailValue}>{boardingTime(flight.departureTime)}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>GATE</div>
                <div style={S.detailValue}>G{gateNum}</div>
              </div>
              <div style={S.detailItem}>
                <div style={S.detailLabel}>CLASS</div>
                <div style={{ ...S.detailValue, color: classColorText }}>{isBusinessClass ? '👑 Business' : '✈️ Economy'}</div>
              </div>
            </div>

            {/* Reschedule history note */}
            {booking.previousFlightNumber && (
              <div style={{ background: '#e8f0ff', borderTop: '1px solid #dde4ff', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔄</span>
                <span style={{ fontSize: 12, color: '#003399', fontWeight: 600 }}>
                  Rescheduled from <strong>{booking.previousFlightNumber}</strong>
                  {booking.previousDeparture && ` (orig. ${new Date(booking.previousDeparture).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })})`}
                  {booking.rescheduleFeeBreakdown && ` · Reschedule fee: ₱${(booking.rescheduleFeeBreakdown.totalPayment || 0).toLocaleString()}`}
                </span>
              </div>
            )}

            {passengerCount > 1 && (() => {
              const perPax = Math.round((booking.price || 0) / passengerCount);
              const isRT = booking.tripType === 'roundtrip' && !!returnFlight;
              const perPaxOut = isRT ? Math.round((booking.outboundPrice || 0) / passengerCount) : 0;
              const perPaxRet = isRT ? Math.round((booking.returnPrice || 0) / passengerCount) : 0;
              return (
                <div style={{ background: '#f8faff', borderTop: '1px solid #dde4ff', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {isRT ? (
                      <>
                        <span style={{ fontSize: 13, color: '#555' }}>
                          ✈️ Outbound: <strong>₱{perPaxOut.toLocaleString()}</strong> × {passengerCount} = ₱{(booking.outboundPrice||0).toLocaleString()}
                        </span>
                        <span style={{ fontSize: 13, color: '#555' }}>
                          🔄 Return: <strong>₱{perPaxRet.toLocaleString()}</strong> × {passengerCount} = ₱{(booking.returnPrice||0).toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#555' }}>
                        ✈️ Fare: <strong>₱{perPax.toLocaleString()}</strong> × {passengerCount} passengers
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' }}>
                    Total: ₱{(booking.price || 0).toLocaleString()}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const totalCoupons = isRoundTrip ? passengerCount * 2 : passengerCount;
              return totalCoupons > 1 && (
                <div style={{ background: 'linear-gradient(90deg,#003399,#0055cc)', padding: '8px 28px' }}>
                  <span style={{ color: 'white', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>
                    🎫 {isRoundTrip ? `INDIVIDUAL BOARDING PASSES — ${passengerCount} PASSENGER${passengerCount > 1 ? 'S' : ''} × 2 LEGS = ${totalCoupons} PASSES` : `INDIVIDUAL BOARDING PASSES — ${passengerCount} PASSENGERS`}
                  </span>
                </div>
              );
            })()}
          </div>{/* end #pdf-shared-header */}

          {/* Per-passenger, per-leg coupons */}
          {passengers.map((passenger, index) => {
            const outboundSeat = passenger.seat || booking.seatNumbers?.[index] || booking.seatNumber || '—';
            const returnSeat = passenger.returnSeat || booking.returnSeatNumbers?.[index] || null;
            return (
              <div key={index}>
                {index > 0 && <div className="coupon-sep" style={{ height: 1, background: '#dde4ff', margin: '0 28px' }} />}
                {/* Outbound coupon */}
                <PassengerCoupon
                  passenger={passenger}
                  index={index}
                  legFlight={flight}
                  legLabel="✈️ OUTBOUND"
                  legAccent="#003399"
                  legSeat={outboundSeat}
                  isReturn={false}
                />
                {/* Return coupon — round trip only */}
                {isRoundTrip && returnFlight && (
                  <>
                    <div className="coupon-sep" style={{ height: 1, background: '#b2dfc8', margin: '0 28px' }} />
                    <PassengerCoupon
                      passenger={passenger}
                      index={index}
                      legFlight={returnFlight}
                      legLabel="🔄 RETURN"
                      legAccent="#007744"
                      legSeat={returnSeat || outboundSeat}
                      isReturn={true}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* VAT Invoice Summary */}
          <div style={{ padding: '0 28px 8px' }}>
            <VatBreakdown subtotal={booking.price || 0} passengerCount={passengerCount} />
          </div>

          {/* Footer */}
          <div style={S.ticketFooter}>
            <p>Please arrive at the airport 2 hours before departure • Bring valid government-issued ID</p>
            <p>Check-in closes 45 minutes before departure • Subject to terms and conditions</p>
            <p style={{ fontWeight: 600, marginTop: 4 }}>© 2026 Cebu Airlines | support@cebuairlines.com | (02) 8888-7777</p>
          </div>
        </div>
      </div>
    </>
  );
};

const S = {
  actionBar: { background: 'white', borderBottom: '1px solid #dde4ff', padding: '16px 0', position: 'sticky', top: 68, zIndex: 50 },
  actionContainer: { maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  backBtn: { background: 'none', border: 'none', color: '#003399', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  actionRight: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  successBadge: { background: '#e6fff3', border: '1px solid #00aa55', color: '#007744', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' },
  printBtn: { background: 'linear-gradient(135deg, #003399, #0066ff)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  downloadBtn: { background: 'linear-gradient(135deg, #007744, #00aa55)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  wrapper: { padding: '32px 24px 60px', background: '#f0f4ff' },
  ticket: { maxWidth: 860, margin: '0 auto', background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,51,153,0.15)', border: '1px solid #dde4ff' },
  ticketHeader: { background: 'linear-gradient(135deg, #001040 0%, #003399 60%, #0055cc 100%)', padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 },
  airlineLogo: { fontSize: 48 },
  airlineName: { color: 'white', fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 24, letterSpacing: 3 },
  boardingPass: { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 3, marginTop: 4 },
  headerRight: {},
  statusStamp: { border: '3px solid', padding: '6px 20px', borderRadius: 6, fontWeight: 900, fontSize: 16, letterSpacing: 2, transform: 'rotate(-5deg)', fontFamily: 'Montserrat, sans-serif' },
  headerDivider: { height: 4, background: 'linear-gradient(90deg, #003399, #ff6600, #003399)' },
  routeSection: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '36px 48px' },
  routePoint: { textAlign: 'center' },
  airportCode: { fontSize: 52, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif', lineHeight: 1 },
  airportCity: { fontSize: 14, color: '#888', marginTop: 6 },
  flightTime: { fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginTop: 12, fontFamily: 'Montserrat, sans-serif' },
  timeLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  routeCenter: { textAlign: 'center', flex: 1, padding: '0 40px' },
  flightNumberBig: { fontSize: 16, fontWeight: 800, color: '#003399', marginBottom: 12 },
  planeIcon: { fontSize: 32, color: '#003399', margin: '8px 0' },
  duration: { fontSize: 14, color: '#666', fontWeight: 600 },
  directTag: { fontSize: 10, fontWeight: 700, color: '#007744', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid #eef0ff', borderBottom: '1px solid #eef0ff' },
  detailItem: { padding: '18px 24px', borderRight: '1px solid #eef0ff' },
  detailLabel: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailValue: { fontSize: 15, fontWeight: 700, color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' },
  boardingCoupon: { background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)', borderTop: '1px solid #dde4ff' },
  couponHeader: { background: 'linear-gradient(135deg, #001040 0%, #003399 60%, #0055cc 100%)', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  couponHeaderLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  couponAirline: { color: 'white', fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 15, letterSpacing: 2 },
  couponBoardingLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  couponClassBadge: { padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 },
  perfLine: { display: 'flex', alignItems: 'center' },
  perfCircleLeft: { width: 20, height: 20, borderRadius: '50%', background: 'white', flexShrink: 0, marginLeft: -10 },
  perfDashes: { flex: 1, borderTop: '2px dashed #c8d4ff', margin: '0 4px' },
  perfCircleRight: { width: 20, height: 20, borderRadius: '50%', background: 'white', flexShrink: 0, marginRight: -10 },
  couponBody: { display: 'flex', padding: '20px 28px 24px', alignItems: 'flex-start' },
  couponLeft: { flex: 1, paddingRight: 20 },
  couponRoute: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  couponCity: { textAlign: 'center' },
  couponIata: { fontSize: 28, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif', lineHeight: 1 },
  couponCityName: { fontSize: 10, color: '#888', marginTop: 3, fontWeight: 600 },
  couponArrow: { textAlign: 'center', flex: 1, padding: '0 12px' },
  couponFlight: { fontSize: 11, fontWeight: 800, color: '#555', marginBottom: 2 },
  couponArrowLine: { fontSize: 14, color: '#003399', letterSpacing: 1 },
  couponDuration: { fontSize: 10, color: '#888', marginTop: 2 },
  couponGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 },
  couponCell: { background: 'white', borderRadius: 8, padding: '8px 10px', border: '1px solid #dde4ff' },
  couponCellLabel: { fontSize: 9, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  couponCellValue: { fontSize: 14, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' },
  couponTotal: { display: 'flex', alignItems: 'center', gap: 10 },
  couponTotalLabel: { fontSize: 11, color: '#888' },
  couponTotalAmount: { fontSize: 22, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' },
  couponPayMethod: { fontSize: 11, color: '#007744', fontWeight: 600, marginLeft: 'auto' },
  couponDivider: { width: 1, alignSelf: 'stretch', display: 'flex', alignItems: 'center', margin: '0 20px' },
  couponDividerLine: { width: 1, height: '100%', background: 'repeating-linear-gradient(to bottom, #c8d4ff 0px, #c8d4ff 6px, transparent 6px, transparent 12px)' },
  couponRight: { width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  couponSeatLabel: { fontSize: 9, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
  couponSeat: { fontSize: 44, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif', lineHeight: 1, textAlign: 'center' },
  couponSeatClass: { fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 },
  couponQrWrap: { background: 'white', padding: 6, borderRadius: 10, border: '2px solid #003399', boxShadow: '0 2px 10px rgba(0,51,153,0.12)' },
  couponQr: { width: 100, height: 100, display: 'block' },
  couponQrPlaceholder: { width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 },
  couponQrLabel: { fontSize: 9, color: '#888', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  ticketFooter: { background: '#f0f4ff', padding: '16px 36px', borderTop: '1px solid #dde4ff', textAlign: 'center', fontSize: 11, color: '#888', lineHeight: 1.8 },
};

export default TicketPage;
