const nodemailer = require('nodemailer');
const { calcVAT } = require('../utils/vatCalculator');

const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const fmt = (dt, opts) => new Date(dt).toLocaleDateString('en-PH', opts);
const fmtTime = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (dt) => fmt(dt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtDateShort = (dt) => fmt(dt, { month: 'short', day: 'numeric', year: 'numeric' });
const getDuration = (dep, arr) => {
  const m = (new Date(arr) - new Date(dep)) / 60000;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

// ─── Build individual ticket HTML for one passenger ───────────────
const buildSingleTicketHtml = ({ passenger, passengerIndex, passengerCount, booking, flight, returnFlight, qrCid, legOverride }) => {
  // legOverride: 'outbound' | 'return' | null (null = combined as before for one-way)
  const isRoundTrip = booking.tripType === 'roundtrip' && !!returnFlight;
  const renderLeg   = legOverride || (isRoundTrip ? 'outbound' : null);
  const legFlight   = renderLeg === 'return' ? returnFlight : flight;

  const isOutboundLeg = renderLeg !== 'return';
  // Per-leg class
  const legSeatClass = isOutboundLeg
    ? (booking.seatClass || 'economy')
    : (booking.returnSeatClass || booking.seatClass || 'economy');
  const isBusiness  = legSeatClass === 'business';

  const classColor  = isBusiness ? '#b8860b' : '#003399';
  const classBg     = isBusiness ? '#fff8e1' : '#e8eeff';
  const classBorder = isBusiness ? '#ffd54f' : '#99aadd';
  const classLabel  = isBusiness ? '👑 Business Class' : '✈️ Economy Class';
  const tripLabel   = isRoundTrip ? '🔄 Round Trip' : '➡️ One Way';
  const tripColor   = isRoundTrip ? '#007744' : '#003399';
  const tripBg      = isRoundTrip ? '#e8f5e9' : '#e8eeff';
  const tripBorder  = isRoundTrip ? '#00aa55' : '#99aadd';
  // Outbound seat from passenger record, fallback to booking-level arrays
  const outboundSeat = passenger.seat || (booking.seatNumbers && booking.seatNumbers[passengerIndex]) || booking.seatNumber || '—';
  // Return seat from passenger record, fallback to booking-level returnSeatNumbers
  const returnSeat = passenger.returnSeat || (booking.returnSeatNumbers && booking.returnSeatNumbers[passengerIndex]) || null;
  // Active seat for this leg
  const seat = renderLeg === 'return' ? (returnSeat || outboundSeat) : outboundSeat;

  const flightLeg = (f, label, accent) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <tr><td style="background:${accent};padding:8px 20px;">
        <span style="color:white;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">${label}</span>
      </td></tr>
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="text-align:center;width:30%;">
            <div style="font-size:34px;font-weight:900;color:#003399;font-family:Arial,sans-serif;">${f.origin}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">${f.originCity}</div>
            <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-top:6px;">${fmtTime(f.departureTime)}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">Departure</div>
          </td>
          <td style="text-align:center;width:40%;padding:0 12px;">
            <div style="font-size:13px;font-weight:700;color:#0055cc;">${f.flightNumber}</div>
            <div style="height:2px;background:linear-gradient(90deg,#003399,#0077ff);margin:8px 0;border-radius:2px;"></div>
            <div style="font-size:18px;">✈</div>
            <div style="font-size:11px;color:#888;margin-top:4px;">${getDuration(f.departureTime, f.arrivalTime)} · Direct</div>
            <div style="font-size:11px;color:#666;margin-top:2px;">${fmtDateShort(f.departureTime)}</div>
          </td>
          <td style="text-align:center;width:30%;">
            <div style="font-size:34px;font-weight:900;color:#003399;font-family:Arial,sans-serif;">${f.destination}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">${f.destinationCity}</div>
            <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-top:6px;">${fmtTime(f.arrivalTime)}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">Arrival</div>
          </td>
        </tr></table>
      </td></tr>
    </table>`;

  const groupNote = passengerCount > 1 ? `
    <div style="background:#fff8e1;border:1.5px solid #ffd54f;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:12px;color:#cc8800;font-weight:600;">
      👥 Group Booking — Passenger ${passengerIndex + 1} of ${passengerCount}
    </div>` : '';

  const perTicketPrice = Math.round((booking.price || 0) / passengerCount);
  const perPaxOutbound = Math.round((booking.outboundPrice || 0) / passengerCount);
  const perPaxReturn   = Math.round((booking.returnPrice   || 0) / passengerCount);

  // VAT calculations
  const vatRate      = 0.12;
  const subtotal     = booking.price || 0;
  const vatAmount    = booking.vatAmount  || Math.round(subtotal * vatRate);
  const grandTotal   = booking.grandTotal || (subtotal + vatAmount);
  const vatPerPax    = Math.round(vatAmount / passengerCount);
  const grandPerPax  = Math.round(grandTotal / passengerCount);

  const multiPaxNote = passengerCount > 1
    ? `<tr><td colspan="2" style="padding-top:6px;font-size:11px;color:#888;text-align:right;font-style:italic;">
        Booking total: ₱${grandTotal.toLocaleString()} ÷ ${passengerCount} passengers = ₱${grandPerPax.toLocaleString()} per ticket
      </td></tr>`
    : '';

  const vatRowHtml = `
    <tr><td style="padding:4px 0;font-size:12px;color:#888;">Subtotal (ex. VAT)</td><td style="text-align:right;font-size:12px;color:#888;">₱${(passengerCount > 1 ? perTicketPrice : subtotal).toLocaleString()}</td></tr>
    <tr><td style="padding:4px 0;font-size:12px;color:#888;">VAT (12%)</td><td style="text-align:right;font-size:12px;color:#888;">+₱${(passengerCount > 1 ? vatPerPax : vatAmount).toLocaleString()}</td></tr>`;

  const priceHtml = isRoundTrip ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:10px;padding:16px;margin-bottom:24px;">
      <tr><td colspan="2" style="font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1px;padding-bottom:10px;border-bottom:1px solid #dde4ff;">💰 Fare Breakdown</td></tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#555;">✈️ Outbound (${flight.origin} → ${flight.destination})</td>
        <td style="text-align:right;font-size:13px;color:#333;font-weight:600;">
          ₱${perPaxOutbound.toLocaleString()}${passengerCount > 1 ? ` × ${passengerCount} = <strong>₱${(booking.outboundPrice||0).toLocaleString()}</strong>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#555;">🔄 Return (${returnFlight.origin} → ${returnFlight.destination})</td>
        <td style="text-align:right;font-size:13px;color:#333;font-weight:600;">
          ₱${perPaxReturn.toLocaleString()}${passengerCount > 1 ? ` × ${passengerCount} = <strong>₱${(booking.returnPrice||0).toLocaleString()}</strong>` : ''}
        </td>
      </tr>
      ${isBusiness ? `<tr><td style="padding:6px 0;font-size:13px;color:#b8860b;">👑 Business Surcharge</td><td style="text-align:right;font-size:13px;color:#b8860b;font-weight:600;">Included (+50%)</td></tr>` : ''}
      <tr style="border-top:1px dashed #dde4ff;">
        <td style="padding:8px 0 4px;font-size:12px;color:#888;">Subtotal (ex. VAT)</td>
        <td style="text-align:right;font-size:12px;color:#888;padding-top:8px;">₱${(passengerCount > 1 ? perTicketPrice : subtotal).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#888;">VAT (12%)</td>
        <td style="text-align:right;font-size:12px;color:#888;">+₱${(passengerCount > 1 ? vatPerPax : vatAmount).toLocaleString()}</td>
      </tr>
      <tr style="border-top:2px solid #dde4ff;">
        <td style="padding-top:10px;font-size:14px;font-weight:800;color:#1a1a2e;">
          ${passengerCount > 1 ? `This Ticket (Pax ${passengerIndex+1} of ${passengerCount})` : 'Total (incl. VAT)'}
        </td>
        <td style="text-align:right;padding-top:10px;font-size:18px;font-weight:900;color:#ff6600;">₱${(passengerCount > 1 ? grandPerPax : grandTotal).toLocaleString()}</td>
      </tr>
      ${multiPaxNote}
    </table>` : `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:10px;padding:16px;margin-bottom:24px;">
      <tr><td colspan="2" style="font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1px;padding-bottom:10px;border-bottom:1px solid #dde4ff;">💰 Fare Breakdown</td></tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#555;">✈️ Base Fare${passengerCount > 1 ? ' per passenger' : ''}</td>
        <td style="text-align:right;font-size:13px;color:#333;font-weight:600;">₱${perTicketPrice.toLocaleString()}</td>
      </tr>
      ${passengerCount > 1 ? `<tr>
        <td style="padding:6px 0;font-size:13px;color:#555;">👥 Passengers</td>
        <td style="text-align:right;font-size:13px;color:#555;">× ${passengerCount}</td>
      </tr>` : ''}
      ${isBusiness ? `<tr><td style="padding:6px 0;font-size:13px;color:#b8860b;">👑 Business Surcharge</td><td style="text-align:right;font-size:13px;color:#b8860b;font-weight:600;">+50% Included</td></tr>` : ''}
      ${vatRowHtml}
      <tr style="border-top:2px solid #dde4ff;">
        <td style="padding-top:10px;font-size:14px;font-weight:800;color:#1a1a2e;">
          ${passengerCount > 1 ? `Total (incl. VAT) — ${passengerCount} pax` : 'Total (incl. VAT)'}
        </td>
        <td style="text-align:right;padding-top:10px;font-size:18px;font-weight:900;color:#ff6600;">
          ₱${grandTotal.toLocaleString()}
        </td>
      </tr>
    </table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,51,153,0.15);max-width:600px;">

  <tr><td style="background:linear-gradient(135deg,#001040 0%,#003399 60%,#0055cc 100%);padding:36px 32px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">✈️</div>
    <div style="color:white;font-size:26px;font-weight:900;letter-spacing:3px;font-family:Arial,sans-serif;">CEBU AIRLINES</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:3px;margin-top:4px;">BOOKING CONFIRMATION</div>
    <div style="margin-top:16px;"><span style="background:#00cc66;color:white;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:800;">✓ PAYMENT CONFIRMED</span></div>
    <div style="margin-top:14px;">
      <span style="background:${tripBg};color:${tripColor};border:1.5px solid ${tripBorder};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:800;margin-right:8px;">${tripLabel}</span>
      <span style="background:${classBg};color:${classColor};border:1.5px solid ${classBorder};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:800;">${classLabel}</span>
      ${passengerCount > 1 ? `<span style="background:#fff8e1;color:#cc8800;border:1.5px solid #ffd54f;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:800;margin-left:8px;">Pax ${passengerIndex + 1} of ${passengerCount}</span>` : ''}
    </div>
  </td></tr>

  <tr><td style="background:#f8faff;border-bottom:1px solid #dde4ff;padding:20px 32px;text-align:center;">
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Booking Reference</div>
    <div style="font-size:28px;font-weight:900;color:#0055cc;letter-spacing:4px;font-family:Arial,sans-serif;">${booking.bookingId}</div>
  </td></tr>

  <tr><td style="padding:32px;">
    ${groupNote}
    <p style="color:#555;font-size:15px;margin:0 0 28px;line-height:1.6;">
      Dear <strong style="color:#1a1a2e;">${passenger.name}</strong>,<br>
      Your ${isRoundTrip ? 'round trip' : 'one-way'} ticket has been confirmed and payment received.
      Please present this email or scan your QR code at the airport check-in counter.
    </p>

    <div style="font-size:11px;font-weight:800;color:#003399;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e8eeff;padding-bottom:8px;margin-bottom:16px;">✈️ ${renderLeg === 'return' ? 'Return Flight Details' : isRoundTrip ? 'Outbound Flight Details' : 'Flight Details'}</div>
    ${renderLeg === 'return'
        ? flightLeg(returnFlight, '🔄 Return Flight', '#007744')
        : flightLeg(flight, isRoundTrip ? '✈️ Outbound Flight' : '✈️ Flight Details', '#003399')}

    <div style="font-size:11px;font-weight:800;color:#003399;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e8eeff;padding-bottom:8px;margin:28px 0 16px;">👤 Passenger Details</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="50%" style="padding:0 8px 12px 0;">
          <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Passenger Name</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${passenger.name}</div>
            ${passenger.phone ? `<div style="font-size:12px;color:#888;margin-top:3px;">${passenger.phone}</div>` : ''}
          </div>
        </td>
        <td width="50%" style="padding:0 0 12px 8px;">
          <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Email Address</div>
            <div style="font-size:14px;font-weight:600;color:#1a1a2e;">${passenger.email || '—'}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:0 8px 0 0;">
          <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${isRoundTrip ? 'Outbound Seat' : 'Seat Number'}</div>
            <div style="font-size:28px;font-weight:900;color:#003399;">${outboundSeat}</div>
          </div>
        </td>
        <td width="50%" style="padding:0 0 0 8px;">
          ${isRoundTrip && returnSeat ? `
          <div style="background:#e8f5e9;border:1.5px solid #00aa55;border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Return Seat</div>
            <div style="font-size:28px;font-weight:900;color:#007744;">${returnSeat}</div>
          </div>` : `
          <div style="background:${classBg};border:1.5px solid ${classBorder};border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Seat Class</div>
            <div style="font-size:15px;font-weight:800;color:${classColor};">${classLabel}</div>
          </div>`}
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="50%" style="padding:0 8px 0 0;">
          <div style="background:${tripBg};border:1.5px solid ${tripBorder};border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Trip Type</div>
            <div style="font-size:15px;font-weight:800;color:${tripColor};">${tripLabel}</div>
          </div>
        </td>
        <td width="50%" style="padding:0 0 0 8px;">
          <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Aircraft</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${flight.aircraft || 'Airbus A320'}</div>
          </div>
        </td>
      </tr>
    </table>

    <div style="font-size:11px;font-weight:800;color:#003399;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e8eeff;padding-bottom:8px;margin-bottom:16px;">💳 Payment Summary</div>
    ${priceHtml}

    <div style="font-size:11px;font-weight:800;color:#003399;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e8eeff;padding-bottom:8px;margin-bottom:0;">🎫 Your QR Ticket</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #dde4ff;border-radius:14px;overflow:hidden;margin-bottom:28px;">
      <tr><td style="background:${renderLeg === 'return' ? 'linear-gradient(135deg,#003322 0%,#005533 60%,#007744 100%)' : 'linear-gradient(135deg,#001040 0%,#003399 60%,#0055cc 100%)'};padding:12px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="color:white;font-size:14px;font-weight:900;letter-spacing:2px;">✈️ CEBU AIRLINES</span><span style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;margin-left:12px;">${renderLeg === 'return' ? 'RETURN PASS' : 'BOARDING PASS'}</span></td>
          <td style="text-align:right;"><span style="background:${isBusiness ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.12)'};color:${isBusiness ? '#ffd700' : 'white'};border:1.5px solid ${isBusiness ? '#ffd700' : 'rgba(255,255,255,0.3)'};padding:4px 14px;border-radius:20px;font-size:11px;font-weight:800;">${isBusiness ? '👑 BUSINESS' : '✈️ ECONOMY'}</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:linear-gradient(135deg,#f0f4ff 0%,#e8eeff 100%);padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;padding-right:16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
              <td style="text-align:center;width:33%;"><div style="font-size:30px;font-weight:900;color:${renderLeg === 'return' ? '#007744' : '#003399'};font-family:Arial,sans-serif;line-height:1;">${legFlight.origin}</div><div style="font-size:10px;color:#888;margin-top:3px;">${legFlight.originCity}</div></td>
              <td style="text-align:center;padding:0 10px;"><div style="font-size:11px;font-weight:800;color:#555;">${legFlight.flightNumber}</div><div style="font-size:13px;color:${renderLeg === 'return' ? '#007744' : '#003399'};letter-spacing:1px;">${renderLeg === 'return' ? '──🔄──' : '──✈──'}</div><div style="font-size:10px;color:#888;">${getDuration(legFlight.departureTime, legFlight.arrivalTime)}</div></td>
              <td style="text-align:center;width:33%;"><div style="font-size:30px;font-weight:900;color:${renderLeg === 'return' ? '#007744' : '#003399'};font-family:Arial,sans-serif;line-height:1;">${legFlight.destination}</div><div style="font-size:10px;color:#888;margin-top:3px;">${legFlight.destinationCity}</div></td>
            </tr></table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:5px;">
              <tr>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Passenger</div><div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-top:2px;">${passenger.name}</div></td>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Date</div><div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-top:2px;">${fmtDateShort(legFlight.departureTime)}</div></td>
              </tr>
              <tr>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Departs</div><div style="font-size:18px;font-weight:900;color:${renderLeg === 'return' ? '#007744' : '#003399'};font-family:Arial;margin-top:2px;">${fmtTime(legFlight.departureTime)}</div></td>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Arrives</div><div style="font-size:18px;font-weight:900;color:${renderLeg === 'return' ? '#007744' : '#003399'};font-family:Arial;margin-top:2px;">${fmtTime(legFlight.arrivalTime)}</div></td>
              </tr>
              <tr>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Booking Ref</div><div style="font-size:12px;font-weight:900;color:#0055cc;letter-spacing:1px;margin-top:2px;">${booking.bookingId}</div></td>
                <td style="background:white;border-radius:7px;padding:8px 10px;border:1px solid #dde4ff;"><div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;">Payment</div><div style="font-size:12px;font-weight:800;color:#007744;margin-top:2px;">GCash ✓</div></td>
              </tr>
            </table>
          </td>
          <td style="width:1px;padding:0 14px;"><div style="width:1px;background:repeating-linear-gradient(to bottom,#c8d4ff 0,#c8d4ff 6px,transparent 6px,transparent 12px);height:200px;"></div></td>
          <td style="width:120px;text-align:center;vertical-align:top;">
            <div style="font-size:9px;color:#aaa;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">SEAT</div>
            <div style="font-size:46px;font-weight:900;color:${renderLeg === 'return' ? '#007744' : '#003399'};font-family:Arial,sans-serif;line-height:1;margin-bottom:2px;">${seat}</div>
            <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:10px;">${isBusiness ? '👑 Business' : '✈️ Economy'}</div>
            <div style="background:white;padding:6px;border-radius:10px;border:2px solid ${renderLeg === 'return' ? '#007744' : '#003399'};display:inline-block;box-shadow:0 2px 10px rgba(0,51,153,0.12);">
              <img src="cid:${qrCid}" alt="QR" style="width:95px;height:95px;display:block;" />
            </div>
            <div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase;margin-top:6px;">Scan at gate</div>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-left:4px solid #ffc107;border-radius:0 8px 8px 0;margin-bottom:8px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:800;color:#cc8800;margin-bottom:10px;">📋 Important Reminders</div>
        <div style="font-size:13px;color:#666;line-height:1.8;">
          • Arrive at the airport <strong>at least 2 hours before departure</strong><br>
          • Bring a valid <strong>government-issued ID</strong><br>
          • Check-in closes <strong>45 minutes before departure</strong><br>
          ${isRoundTrip ? '• This ticket covers <strong>both outbound and return flights</strong><br>' : ''}
          ${isBusiness ? '• Enjoy <strong>Business Class</strong> priority boarding and premium seating<br>' : ''}
          • Your e-ticket is also accessible in your <strong>My Bookings</strong> page
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#001f66;padding:24px 32px;text-align:center;">
    <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;margin-bottom:6px;">✈️ Cebu Airlines</div>
    <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;">
      © 2026 Cebu Airlines. All rights reserved.<br>
      Need help? <a href="mailto:support@cebuairlines.com" style="color:#88aaff;">support@cebuairlines.com</a> · (02) 8888-7777
    </div>
  </td></tr>

</table></td></tr></table></body></html>`;
};

// ─── Send booking confirmation with per-passenger tickets ─────────
const sendBookingConfirmation = async (booking, flight, passengerQRs, returnFlight = null) => {
  const transporter = createTransporter();
  const isRoundTrip    = booking.tripType === 'roundtrip' && !!returnFlight;
  const passengerCount = booking.passengerCount || 1;

  // Normalise passengers array
  const passengers = booking.passengers && booking.passengers.length > 0
    ? booking.passengers
    : [{ name: booking.passengerName, email: booking.passengerEmail, phone: booking.passengerPhone || '', seat: booking.seatNumber }];

  // Normalise QR array — passengerQRs is either the old single string or new array
  const qrArray = Array.isArray(passengerQRs)
    ? passengerQRs
    : passengers.map((_, i) => ({ passengerIndex: i, qrDataUrl: passengerQRs }));

  const subjectRoute = isRoundTrip
    ? `${flight.origin} ⇌ ${flight.destination}`
    : `${flight.origin} → ${flight.destination}`;
  const isBusiness = booking.seatClass === 'business';
  const isReturnBusiness = (booking.returnSeatClass || booking.seatClass) === 'business';
  const hasMixedClass = isRoundTrip && isBusiness !== isReturnBusiness;
  const subjectClass = hasMixedClass
    ? '✈️ Economy + 👑 Business'
    : isBusiness ? '👑 Business' : '✈️ Economy';

  // Build one email attachment + html per passenger
  // For round-trip: two ticket blocks per passenger (outbound + return)
  const ticketAttachments = qrArray.map((qr, i) => {
    const cid = `qr_pax_${i}@cebuairlines`;
    const rawBase64 = qr.qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
    return {
      cid,
      rawBase64,
      filename: `ticket-${i + 1}-qr.png`,
    };
  });

  const LEG_SEP = `
    <!-- LEG SEPARATOR -->
    <div style="page-break-before:always;border-top:3px dashed #b2dfc8;margin:32px 0;text-align:center;">
      <span style="background:white;padding:0 12px;font-size:11px;color:#007744;font-weight:700;letter-spacing:1px;">✂ RETURN FLIGHT TICKET</span>
    </div>`;

  const PAX_SEP = `
    <!-- TICKET SEPARATOR -->
    <div style="page-break-before:always;border-top:3px dashed #ccd5ff;margin:32px 0;text-align:center;">
      <span style="background:white;padding:0 12px;font-size:11px;color:#aaa;font-weight:700;letter-spacing:1px;">✂ NEXT PASSENGER TICKET</span>
    </div>`;

  // ── Email 1: Lead passenger gets ALL tickets ───────────────────
  const allTicketsHtml = passengers.map((p, i) => {
    const qr  = qrArray[i] || qrArray[0];
    const cid = `qr_pax_${i}@cebuairlines`;
    const outHtml = buildSingleTicketHtml({ passenger: p, passengerIndex: i, passengerCount, booking, flight, returnFlight, qrCid: cid, legOverride: isRoundTrip ? 'outbound' : null });
    if (!isRoundTrip) return outHtml;
    const retHtml = buildSingleTicketHtml({ passenger: p, passengerIndex: i, passengerCount, booking, flight, returnFlight, qrCid: cid, legOverride: 'return' });
    return outHtml + LEG_SEP + retHtml;
  }).join(PAX_SEP);

  await transporter.sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `✅ Booking Confirmed [${booking.bookingId}] — ${subjectRoute} · ${subjectClass}${passengerCount > 1 ? ` · ${passengerCount} Tickets` : ''} · ${isRoundTrip ? 'Round Trip' : 'One Way'}`,
    html: allTicketsHtml,
    attachments: ticketAttachments.map(t => ({
      filename: t.filename,
      content: t.rawBase64,
      encoding: 'base64',
      cid: t.cid,
    })),
  });
  console.log(`✅ All tickets (${passengerCount}) → ${booking.passengerEmail} | ${booking.bookingId}`);

  // ── Email 2+: Individual tickets to each other passenger (if they have a different email) ──
  for (let i = 1; i < passengers.length; i++) {
    const pax = passengers[i];
    if (!pax.email || pax.email === booking.passengerEmail) continue;

    const qr  = qrArray[i] || qrArray[0];
    const cid = `qr_pax_${i}@cebuairlines`;
    const outHtml = buildSingleTicketHtml({ passenger: pax, passengerIndex: i, passengerCount, booking, flight, returnFlight, qrCid: cid, legOverride: isRoundTrip ? 'outbound' : null });
    const html = isRoundTrip
      ? outHtml + LEG_SEP + buildSingleTicketHtml({ passenger: pax, passengerIndex: i, passengerCount, booking, flight, returnFlight, qrCid: cid, legOverride: 'return' })
      : outHtml;

    await transporter.sendMail({
      from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
      to: pax.email,
      subject: `✅ Your Ticket [${booking.bookingId}] — ${subjectRoute} · ${subjectClass} · ${isRoundTrip ? 'Round Trip' : 'One Way'}`,
      html,
      attachments: [{
        filename: `ticket-${i + 1}-qr.png`,
        content: (qr.qrDataUrl || '').replace(/^data:image\/\w+;base64,/, ''),
        encoding: 'base64',
        cid,
      }],
    });
    console.log(`✅ Individual ticket (Pax ${i + 1}) → ${pax.email} | ${booking.bookingId}`);
  }
};

const emailWrapper = (headerBg, headerIcon, headerBadge, badgeColor, bodyContent) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,51,153,0.15);max-width:600px;">

      <!-- HEADER -->
      <tr>
        <td style="background:${headerBg};padding:36px 32px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">${headerIcon}</div>
          <div style="color:white;font-size:24px;font-weight:900;letter-spacing:3px;font-family:Arial,sans-serif;">CEBU AIRLINES</div>
          <div style="margin-top:16px;">
            <span style="background:${badgeColor};color:white;padding:8px 22px;border-radius:20px;font-size:13px;font-weight:800;letter-spacing:0.5px;">${headerBadge}</span>
          </div>
        </td>
      </tr>

      <!-- BODY -->
      <tr><td style="padding:32px;">${bodyContent}</td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#001f66;padding:24px 32px;text-align:center;">
          <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;margin-bottom:6px;">✈️ Cebu Airlines</div>
          <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;">
            © 2026 Cebu Airlines. All rights reserved.<br>
            Need help? <a href="mailto:support@cebuairlines.com" style="color:#88aaff;">support@cebuairlines.com</a> · (02) 8888-7777<br>
            <span style="font-size:11px;color:rgba(255,255,255,0.35);">This is an automated message. Please do not reply directly to this email.</span>
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

const bookingDetailsTable = (booking, flight) => `
<div style="font-size:11px;font-weight:800;color:#003399;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #e8eeff;padding-bottom:8px;margin:24px 0 16px;">
  📋 Booking Details
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
  <tr>
    <td width="50%" style="padding:0 6px 10px 0;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Booking Reference</div>
        <div style="font-size:18px;font-weight:900;color:#0055cc;letter-spacing:2px;">${booking.bookingId}</div>
      </div>
    </td>
    <td width="50%" style="padding:0 0 10px 6px;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Passenger Name</div>
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${booking.passengerName}</div>
      </div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 6px 10px 0;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Route</div>
        <div style="font-size:17px;font-weight:900;color:#003399;">${flight ? `${flight.origin} → ${flight.destination}` : 'N/A'}</div>
      </div>
    </td>
    <td width="50%" style="padding:0 0 10px 6px;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Flight Number</div>
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${flight ? flight.flightNumber : 'N/A'}</div>
      </div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 6px 0 0;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Departure</div>
        <div style="font-size:14px;font-weight:700;color:#1a1a2e;">${flight ? fmtDate(flight.departureTime) : 'N/A'}</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">${flight ? fmtTime(flight.departureTime) : ''}</div>
      </div>
    </td>
    <td width="50%" style="padding:0 0 0 6px;">
      <div style="background:#f8f9ff;border-radius:10px;padding:14px;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Amount Paid (incl. VAT)</div>
        <div style="font-size:18px;font-weight:900;color:#ff6600;">₱${(booking.grandTotal || booking.price || 0).toLocaleString()}</div>
      </div>
    </td>
  </tr>
</table>`;

// ─── Payment Rejected Email ───────────────────────────────────────

const sendPaymentRejected = async (booking, flight, reason) => {
  const transporter = createTransporter();

  const body = `
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Dear <strong style="color:#1a1a2e;">${booking.passengerName}</strong>,
    </p>
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      We regret to inform you that your payment proof for booking <strong style="color:#cc0000;">${booking.bookingId}</strong> has been <strong style="color:#cc0000;">rejected</strong> by our team.
    </p>

    <!-- Rejection Reason Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff0f0;border-left:4px solid #cc0000;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#cc0000;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">❌ Reason for Rejection</div>
        <div style="font-size:14px;color:#333;line-height:1.6;">${reason || 'Payment proof could not be verified. Please ensure the screenshot clearly shows the transaction details.'}</div>
      </td></tr>
    </table>

    ${bookingDetailsTable(booking, flight)}

    <!-- What to do next -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-left:4px solid #ffc107;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:800;color:#cc8800;margin-bottom:10px;">📌 What to do next</div>
        <div style="font-size:13px;color:#666;line-height:1.9;">
          1. Log in to your account at <strong>Cebu Airlines</strong><br>
          2. Go to <strong>My Bookings</strong> and locate this booking<br>
          3. Click <strong>"Pay Now"</strong> to resubmit a valid payment proof<br>
          4. Make sure your screenshot clearly shows the <strong>transaction reference number, amount, and recipient</strong><br>
          5. Your seat is held for <strong>20 minutes</strong> — please act quickly
        </div>
      </td></tr>
    </table>

    <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
      If you believe this rejection was made in error or need assistance, please contact our support team at
      <a href="mailto:support@cebuairlines.com" style="color:#0055cc;">support@cebuairlines.com</a>.
    </p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#5c0000 0%,#aa0000 60%,#cc2200 100%)',
    '❌',
    '✗ PAYMENT REJECTED',
    '#880000',
    body
  );

  await transporter.sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `❌ Payment Rejected [${booking.bookingId}] — Action Required | Cebu Airlines`,
    html,
  });

  console.log(`❌ Rejection email sent → ${booking.passengerEmail} | ${booking.bookingId}`);
};

// ─── Cancellation Approved Email ─────────────────────────────────

const sendCancellationApproved = async (booking, flight) => {
  const transporter = createTransporter();
  const fee = booking.cancellationFeeBreakdown;

  const refundSection = fee ? feeBreakdownHtml(fee, 'cancellation') : `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-left:4px solid #00aa55;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#006633;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💸 Refund Information</div>
        <div style="font-size:14px;color:#333;line-height:1.6;">
          Your payment of <strong style="color:#006633;">₱${(booking.grandTotal || booking.price || 0).toLocaleString()}</strong> (incl. VAT) has been marked for refund.
        </div>
      </td></tr>
    </table>`;

  const body = `
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Dear <strong style="color:#1a1a2e;">${booking.passengerName}</strong>,
    </p>
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Your cancellation request for booking <strong style="color:#cc5500;">${booking.bookingId}</strong> has been <strong style="color:#006633;">approved</strong>.
      Your booking has been successfully cancelled and your seat has been released.
    </p>

    ${refundSection}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-left:4px solid #00aa55;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#006633;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⏳ Refund Timeline</div>
        <div style="font-size:14px;color:#333;line-height:1.6;">
          Please allow <strong>5–7 business days</strong> for the refund to reflect in your original payment method.
          Contact us if you have not received it after 7 business days.
        </div>
      </td></tr>
    </table>

    ${bookingDetailsTable(booking, flight)}

    <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
      For refund inquiries, contact us at <a href="mailto:support@cebuairlines.com" style="color:#0055cc;">support@cebuairlines.com</a>.
    </p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#003322 0%,#006633 60%,#009944 100%)',
    '✅',
    '✓ CANCELLATION APPROVED',
    '#005522',
    body
  );

  await transporter.sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `✅ Booking Cancelled [${booking.bookingId}] — Refund: ₱${fee ? (fee.totalRefund||0).toLocaleString() : (booking.price||0).toLocaleString()} | Cebu Airlines`,
    html,
  });

  console.log(`✅ Cancellation approved email sent → ${booking.passengerEmail} | ${booking.bookingId}`);
};

// ─── Cancellation Rejected Email ─────────────────────────────────

const sendCancellationRejected = async (booking, flight, reason) => {
  const transporter = createTransporter();

  const body = `
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Dear <strong style="color:#1a1a2e;">${booking.passengerName}</strong>,
    </p>
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      We have reviewed your cancellation request for booking <strong style="color:#cc5500;">${booking.bookingId}</strong>.
      Unfortunately, your request has been <strong style="color:#cc0000;">declined</strong> and your booking remains <strong style="color:#006633;">active and confirmed</strong>.
    </p>

    <!-- Rejection Reason Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff0f0;border-left:4px solid #cc0000;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#cc0000;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">❌ Reason for Declining</div>
        <div style="font-size:14px;color:#333;line-height:1.6;">${reason || 'Your cancellation request does not meet our cancellation policy requirements.'}</div>
      </td></tr>
    </table>

    ${bookingDetailsTable(booking, flight)}

    <!-- Booking still active notice -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0ff;border-left:4px solid #003399;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:800;color:#003399;margin-bottom:10px;">✈️ Your Booking is Still Active</div>
        <div style="font-size:13px;color:#555;line-height:1.9;">
          • Your seat is still reserved and your booking is <strong>confirmed</strong><br>
          • Please arrive at the airport <strong>at least 2 hours before departure</strong><br>
          • Bring a valid <strong>government-issued ID</strong><br>
          • You can view your booking details in <strong>My Bookings</strong>
        </div>
      </td></tr>
    </table>

    <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
      If you have questions about this decision, please contact us at
      <a href="mailto:support@cebuairlines.com" style="color:#0055cc;">support@cebuairlines.com</a>.
    </p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#001040 0%,#003399 60%,#0055cc 100%)',
    '📋',
    '✗ CANCELLATION REQUEST DECLINED',
    '#002288',
    body
  );

  await transporter.sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `📋 Cancellation Request Declined [${booking.bookingId}] — Booking Still Active | Cebu Airlines`,
    html,
  });

  console.log(`📋 Cancellation rejected email sent → ${booking.passengerEmail} | ${booking.bookingId}`);
};

// ─── Booking Expired (Timeout) Email ─────────────────────────────

const sendBookingExpired = async (booking, flight) => {
  const transporter = createTransporter();

  const body = `
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Dear <strong style="color:#1a1a2e;">${booking.passengerName}</strong>,
    </p>
    <p style="color:#555;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Your booking <strong style="color:#cc8800;">${booking.bookingId}</strong> has been
      <strong style="color:#cc8800;">automatically cancelled</strong> because payment was not
      submitted within the required time window.
    </p>

    <!-- Timeout Notice Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-left:4px solid #ffa000;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#cc8800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⏰ Booking Expired</div>
        <div style="font-size:14px;color:#333;line-height:1.6;">
          Your seat reservation expired after <strong>20 minutes</strong> without payment.
          The seat has been <strong>released</strong> and is now available to other passengers.
        </div>
      </td></tr>
    </table>

    ${bookingDetailsTable(booking, flight)}

    <!-- Book Again CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0ff;border-left:4px solid #003399;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:800;color:#003399;margin-bottom:10px;">✈️ Still want to fly?</div>
        <div style="font-size:13px;color:#555;line-height:1.9;">
          1. Log in to your account at <strong>Cebu Airlines</strong><br>
          2. Go to <strong>Search Flights</strong> to find available seats<br>
          3. Complete payment promptly after booking — your seat is held for <strong>20 minutes only</strong><br>
          4. We accept payment via <strong>GCash</strong>
        </div>
      </td></tr>
    </table>

    <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
      If you believe this was an error or need assistance, contact us at
      <a href="mailto:support@cebuairlines.com" style="color:#0055cc;">support@cebuairlines.com</a>.
    </p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#332200 0%,#996600 60%,#cc8800 100%)',
    '⏰',
    '⌛ BOOKING EXPIRED',
    '#aa6600',
    body
  );

  await transporter.sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `⏰ Booking Expired [${booking.bookingId}] — Seat Released | Cebu Airlines`,
    html,
  });

  console.log(`⏰ Expiry email sent → ${booking.passengerEmail} | ${booking.bookingId}`);
};

// ─── Fee breakdown HTML helper ────────────────────────────────────
const feeBreakdownHtml = (fee, type = 'cancellation') => {
  if (!fee) return '';
  const isCancellation = type === 'cancellation';
  const vatAmount  = fee.vatAmount  || 0;
  const subtotal   = fee.subtotal   || (fee.totalPrice ? Math.round((fee.totalPrice||0) / 1.12) : 0);
  const grandTotal = fee.totalPrice || fee.grandTotal || 0;
  return `
<div style="background:#fff8f0;border:1.5px solid #ffaa66;border-radius:12px;padding:16px 20px;margin:16px 0;">
  <div style="font-size:11px;font-weight:800;color:#cc5500;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
    ${isCancellation ? '💰 Cancellation Fee Breakdown' : '🔄 Reschedule Fee Breakdown'}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${isCancellation ? `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#555;">Subtotal (ex. VAT)</td>
      <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">₱${subtotal.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#555;">VAT (12%)</td>
      <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">+₱${vatAmount.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:13px;font-weight:700;color:#1a1a2e;">Total Paid (incl. VAT)</td>
      <td style="text-align:right;font-size:13px;font-weight:800;color:#1a1a2e;">₱${grandTotal.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#cc5500;">Cancellation Fee (${fee.feePercent}%)</td>
      <td style="text-align:right;font-size:13px;font-weight:700;color:#cc5500;">−₱${(fee.totalFee||0).toLocaleString()}</td>
    </tr>
    <tr style="border-top:2px solid #ffaa66;">
      <td style="padding-top:10px;font-size:14px;font-weight:800;color:#1a1a2e;">Refund Amount (incl. VAT)</td>
      <td style="text-align:right;padding-top:10px;font-size:18px;font-weight:900;color:#00aa55;">₱${(fee.totalRefund||0).toLocaleString()}</td>
    </tr>` : `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#555;">Price per Passenger</td>
      <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">₱${(fee.pricePerPax||0).toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#555;">Number of Passengers</td>
      <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">${fee.passengerCount}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#cc5500;">Reschedule Fee (${fee.feePercent}% per pax)</td>
      <td style="text-align:right;font-size:13px;font-weight:700;color:#cc5500;">₱${(fee.totalRescheduleFee||0).toLocaleString()}</td>
    </tr>
    ${(fee.totalFareDiff||0) > 0 ? `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#cc5500;">Fare Difference</td>
      <td style="text-align:right;font-size:13px;font-weight:700;color:#cc5500;">₱${(fee.totalFareDiff||0).toLocaleString()}</td>
    </tr>` : ''}
    <tr style="border-top:2px solid #ffaa66;">
      <td style="padding-top:10px;font-size:14px;font-weight:800;color:#1a1a2e;">Total Payment Required</td>
      <td style="text-align:right;padding-top:10px;font-size:18px;font-weight:900;color:#cc5500;">₱${(fee.totalPayment||0).toLocaleString()}</td>
    </tr>`}
  </table>
  <div style="margin-top:10px;font-size:11px;color:#888;font-style:italic;">Policy: ${fee.ruleLabel||''}</div>
</div>`;
};

// ─── Cancellation Requested Email (new — to passenger) ────────────
const sendCancellationRequested = async (booking, flight, fee) => {
  const body = `
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Hi <strong>${booking.passengerName}</strong>, your cancellation request for booking
      <strong style="color:#003399;">${booking.bookingId}</strong> has been received and is pending admin review.
    </p>
    ${bookingDetailsTable(booking, flight)}
    ${feeBreakdownHtml(fee, 'cancellation')}
    <p style="font-size:13px;color:#666;">You'll receive another email once an admin approves or rejects your request.</p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#5c3300 0%,#cc5500 60%,#ff7700 100%)',
    '🔄', '📋 CANCELLATION REQUESTED', '#cc5500', body
  );
  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `🔄 Cancellation Request Received [${booking.bookingId}] | Cebu Airlines`,
    html,
  });
};

// ─── Reschedule Requested Email ───────────────────────────────────
const sendRescheduleRequested = async (booking, oldFlight, newFlight, fee) => {
  const body = `
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Hi <strong>${booking.passengerName}</strong>, your reschedule request for booking
      <strong style="color:#003399;">${booking.bookingId}</strong> has been received and is pending admin review.
    </p>
    <div style="background:#f0f4ff;border-radius:12px;padding:14px 18px;margin:16px 0;display:flex;gap:16px;">
      <div style="flex:1;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Original Flight</div>
        <div style="font-size:15px;font-weight:800;color:#cc2222;">${oldFlight?.flightNumber || '—'}</div>
        <div style="font-size:13px;color:#555;">${oldFlight ? new Date(oldFlight.departureTime).toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : ''}</div>
      </div>
      <div style="font-size:22px;color:#99aadd;padding-top:14px;">→</div>
      <div style="flex:1;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">New Flight</div>
        <div style="font-size:15px;font-weight:800;color:#00aa55;">${newFlight?.flightNumber || '—'}</div>
        <div style="font-size:13px;color:#555;">${newFlight ? new Date(newFlight.departureTime).toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : ''}</div>
      </div>
    </div>
    ${feeBreakdownHtml(fee, 'reschedule')}
    <p style="font-size:13px;color:#666;">You'll receive another email once an admin approves or rejects your reschedule request.</p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#003399 0%,#0055cc 60%,#0077ff 100%)',
    '🔄', '✈️ RESCHEDULE REQUESTED', '#0055cc', body
  );
  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `🔄 Reschedule Request Received [${booking.bookingId}] | Cebu Airlines`,
    html,
  });
};

// ─── Reschedule Approved Email ────────────────────────────────────
const sendRescheduleApproved = async (booking, flight, passengerQRs, returnFlight = null) => {
  const fee = booking.rescheduleFeeBreakdown;
  const leg = fee?.leg || 'outbound';
  const pax = booking.passengerCount || 1;

  const fmtDT = (dt) => new Date(dt).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Build reschedule change summary banner ─────────────────────────────────
  const changeSummary = () => {
    const rows = [];
    if (leg !== 'return' && booking.previousFlightNumber) {
      rows.push(`
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#555;">✈️ Outbound</td>
          <td style="text-align:right;font-size:13px;color:#cc2222;font-weight:600;text-decoration:line-through;">${booking.previousFlightNumber}</td>
          <td style="text-align:center;padding:0 8px;font-size:14px;color:#888;">→</td>
          <td style="text-align:left;font-size:13px;color:#00aa55;font-weight:800;">${flight?.flightNumber || '—'}</td>
        </tr>`);
    }
    if ((leg === 'return' || leg === 'both') && booking.previousReturnFlightNumber) {
      rows.push(`
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#555;">🔄 Return</td>
          <td style="text-align:right;font-size:13px;color:#cc2222;font-weight:600;text-decoration:line-through;">${booking.previousReturnFlightNumber}</td>
          <td style="text-align:center;padding:0 8px;font-size:14px;color:#888;">→</td>
          <td style="text-align:left;font-size:13px;color:#00aa55;font-weight:800;">${returnFlight?.flightNumber || '—'}</td>
        </tr>`);
    }
    if (!rows.length) return '';
    return `
      <div style="background:#f0fff4;border:2px solid #00aa55;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;color:#00aa55;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🔄 Flight Change Summary</div>
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
      </div>`;
  };

  // ── Fee section ─────────────────────────────────────────────────────────────
  const feeSection = fee && fee.totalPayment > 0
    ? feeBreakdownHtml(fee, 'reschedule')
    : `<div style="background:#e8f5e9;border:1.5px solid #00aa55;border-radius:10px;padding:12px 18px;margin:14px 0;font-size:13px;color:#006633;font-weight:600;">
        ✅ No additional fee was charged for this reschedule.
      </div>`;

  // ── Build one full ticket per passenger (same as sendBookingConfirmation) ──
  const isRoundTrip = booking.tripType === 'roundtrip' && !!returnFlight;
  const passengers  = booking.passengers?.length > 0
    ? booking.passengers
    : [{ name: booking.passengerName, email: booking.passengerEmail, phone: booking.passengerPhone || '', seat: booking.seatNumber }];

  const qrArray = Array.isArray(passengerQRs)
    ? passengerQRs
    : passengers.map((_, i) => ({ passengerIndex: i, qrDataUrl: passengerQRs }));

  const ticketAttachments = qrArray.map((qr, i) => ({
    cid:        `qr_pax_${i}@cebuairlines`,
    rawBase64:  (qr.qrDataUrl || '').replace(/^data:image\/\w+;base64,/, ''),
    filename:   `ticket-${i + 1}-qr.png`,
  }));

  // Intro banner that sits above the ticket(s)
  const introBanner = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px 20px 0 0;overflow:hidden;box-shadow:0 8px 40px rgba(0,51,153,0.15);max-width:600px;">
  <tr><td style="background:linear-gradient(135deg,#003300 0%,#006633 60%,#00aa55 100%);padding:32px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">✅</div>
    <div style="color:white;font-size:24px;font-weight:900;letter-spacing:3px;font-family:Arial,sans-serif;">CEBU AIRLINES</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:3px;margin-top:4px;">RESCHEDULE CONFIRMED</div>
    <div style="margin-top:16px;"><span style="background:#00ff88;color:#003300;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:800;">✓ NEW FLIGHT CONFIRMED</span></div>
  </td></tr>
  <tr><td style="background:#f8faff;border-bottom:1px solid #dde4ff;padding:20px 32px;text-align:center;">
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Booking Reference</div>
    <div style="font-size:28px;font-weight:900;color:#0055cc;letter-spacing:4px;font-family:Arial,sans-serif;">${booking.bookingId}</div>
  </td></tr>
  <tr><td style="padding:28px 32px 20px;">
    <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px;">
      Dear <strong style="color:#1a1a2e;">${passengers[0].name}</strong>,<br>
      Your reschedule request has been <strong style="color:#00aa55;">approved</strong>. 
      Your updated ticket${pax > 1 ? 's are' : ' is'} attached below — please use ${pax > 1 ? 'them' : 'it'} at check-in.
    </p>
    ${changeSummary()}
    ${feeSection}
  </td></tr>
</table></td></tr></table>`;

  // Per-passenger ticket HTML — separate outbound + return blocks for round trips
  const separator = `
<table width="100%" cellpadding="0" cellspacing="0" style="padding:0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;max-width:600px;margin-top:0;">
  <tr><td style="border-top:3px dashed #ccd5ff;padding:16px 32px;text-align:center;">
    <span style="font-size:11px;color:#aaa;font-weight:700;letter-spacing:1px;">✂ NEXT PASSENGER TICKET</span>
  </td></tr>
</table></td></tr></table>`;

  const legSepResched = `
<table width="100%" cellpadding="0" cellspacing="0" style="padding:0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;max-width:600px;">
  <tr><td style="border-top:3px dashed #b2dfc8;padding:16px 32px;text-align:center;">
    <span style="font-size:11px;color:#007744;font-weight:700;letter-spacing:1px;">✂ RETURN FLIGHT TICKET</span>
  </td></tr>
</table></td></tr></table>`;

  const ticketPages = passengers.map((p, i) => {
    const qr  = qrArray[i] || qrArray[0];
    const cid = `qr_pax_${i}@cebuairlines`;
    const outHtml = buildSingleTicketHtml({ passenger: p, passengerIndex: i, passengerCount: pax, booking, flight, returnFlight, qrCid: cid, legOverride: isRoundTrip ? 'outbound' : null });
    if (!isRoundTrip) return outHtml;
    const retHtml = buildSingleTicketHtml({ passenger: p, passengerIndex: i, passengerCount: pax, booking, flight, returnFlight, qrCid: cid, legOverride: 'return' });
    return outHtml + legSepResched + retHtml;
  }).join(separator);

  // Closing footer
  const footerHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="padding:0 0 24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:0 0 20px 20px;overflow:hidden;max-width:600px;box-shadow:0 8px 40px rgba(0,51,153,0.15);">
  <tr><td style="background:#001f66;padding:24px 32px;text-align:center;">
    <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:600;margin-bottom:6px;">✈️ Cebu Airlines</div>
    <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;">
      © 2026 Cebu Airlines. All rights reserved.<br>
      Need help? <a href="mailto:support@cebuairlines.demo" style="color:#88aaff;">support@cebuairlines.demo</a> · (032) 888-5678
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;

  const fullHtml = introBanner + ticketPages + footerHtml;

  const subjectRoute = isRoundTrip
    ? `${flight.origin} ⇌ ${flight.destination}`
    : `${flight.origin} → ${flight.destination}`;

  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `✅ Reschedule Confirmed [${booking.bookingId}] — ${subjectRoute} | Cebu Airlines`,
    html: fullHtml,
    attachments: ticketAttachments.map(t => ({
      filename: t.filename,
      content:  t.rawBase64,
      encoding: 'base64',
      cid:      t.cid,
    })),
  });

  console.log(`✅ Reschedule confirmed ticket email → ${booking.passengerEmail} | ${booking.bookingId}`);

  // Also send individual tickets to other passengers if they have separate emails
  for (let i = 1; i < passengers.length; i++) {
    const paxI = passengers[i];
    if (!paxI.email || paxI.email === booking.passengerEmail) continue;
    const qr  = qrArray[i] || qrArray[0];
    const cid = `qr_pax_${i}@cebuairlines`;
    const outHtml = buildSingleTicketHtml({ passenger: paxI, passengerIndex: i, passengerCount: pax, booking, flight, returnFlight, qrCid: cid, legOverride: isRoundTrip ? 'outbound' : null });
    const paxTickets = isRoundTrip
      ? outHtml + legSepResched + buildSingleTicketHtml({ passenger: paxI, passengerIndex: i, passengerCount: pax, booking, flight, returnFlight, qrCid: cid, legOverride: 'return' })
      : outHtml;
    const html = introBanner + paxTickets + footerHtml;
    await (createTransporter()).sendMail({
      from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
      to:   paxI.email,
      subject: `✅ Your Updated Ticket [${booking.bookingId}] — ${subjectRoute} | Cebu Airlines`,
      html,
      attachments: [{ filename: `ticket-${i+1}-qr.png`, content: qr.qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), encoding: 'base64', cid }],
    });
  }
};

// ─── Reschedule Rejected Email ────────────────────────────────────
const sendRescheduleRejected = async (booking, flight, reason) => {
  const body = `
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Hi <strong>${booking.passengerName}</strong>, unfortunately your reschedule request for booking
      <strong style="color:#003399;">${booking.bookingId}</strong> has been <strong style="color:#cc2222;">rejected</strong>.
      Your original booking remains active.
    </p>
    ${bookingDetailsTable(booking, flight)}
    ${reason ? `<div style="background:#fff3cd;border:1.5px solid #ffc107;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:13px;color:#856404;"><strong>Reason:</strong> ${reason}</div>` : ''}
    <p style="font-size:13px;color:#666;">If you have questions, please contact our support team.</p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#330000 0%,#990000 60%,#cc2222 100%)',
    '❌', '✈️ RESCHEDULE REJECTED', '#cc2222', body
  );
  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `❌ Reschedule Request Rejected [${booking.bookingId}] | Cebu Airlines`,
    html,
  });
};

// ─── Flight Cancelled Notice Email ────────────────────────────────────────────
const sendFlightCancelledNotice = async (booking, flight, cancellationReason) => {
  const fmt = (dt) => new Date(dt).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const reasonBlock = cancellationReason ? `
    <div style="background:#fff0f0;border:1.5px solid #ffaaaa;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px;color:#cc2222;">
      <strong>Reason for Cancellation:</strong><br/>
      <span style="color:#333;font-size:14px;">${cancellationReason}</span>
    </div>` : '';

  const body = `
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Dear <strong>${booking.passengerName}</strong>,
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      We regret to inform you that your flight has been <strong style="color:#cc2222;">cancelled</strong>.
    </p>
    <div style="background:#fff0f0;border:2px solid #ffaaaa;border-radius:12px;padding:18px 20px;margin:16px 0;">
      <div style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Affected Flight</div>
      <div style="font-size:22px;font-weight:900;color:#cc2222;font-family:Montserrat,sans-serif;margin-bottom:6px;">
        ${flight.flightNumber} — ${flight.origin} → ${flight.destination}
      </div>
      <div style="font-size:13px;color:#666;">Originally scheduled: ${fmt(flight.departureTime)}</div>
    </div>
    ${reasonBlock}
    <div style="background:#fff8e1;border:1.5px solid #ffd54f;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px;color:#856404;">
      <strong>Your booking reference:</strong> ${booking.bookingId}
    </div>
    <p style="font-size:14px;color:#333;line-height:1.7;"><strong>What to do next:</strong></p>
    <div style="background:#e8f5e9;border:1.5px solid #00aa55;border-radius:12px;padding:18px 20px;margin:16px 0;">
      <p style="font-size:14px;color:#333;margin:0 0 10px;font-weight:700;">You have two options:</p>
      <ul style="font-size:14px;color:#555;line-height:2.2;padding-left:20px;margin:0;">
        <li>🔄 <strong>Rebook</strong> — Log in to <em>My Bookings</em> and select a new available flight at no extra charge.</li>
        <li>💸 <strong>Request a Refund</strong> — Log in to <em>My Bookings</em> and request a full refund. Refunds are processed within 5–7 business days.</li>
      </ul>
    </div>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      For further assistance, contact us at <a href="mailto:support@cebuairlines.demo" style="color:#0055cc;">support@cebuairlines.demo</a> or call <strong>(032) 888-5678</strong>.
    </p>
    <p style="font-size:13px;color:#888;margin-top:16px;">We sincerely apologize for the inconvenience caused.</p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#330000 0%,#990000 60%,#cc2222 100%)',
    '⚠️', '✈️ FLIGHT CANCELLATION NOTICE', '#cc2222', body
  );
  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `⚠️ Important: Flight ${flight.flightNumber} Cancelled [${booking.bookingId}] | Cebu Airlines`,
    html,
  });
};

// ─── Refund Sent Email ────────────────────────────────────────────────────────
const sendRefundSent = async (booking) => {
  const fee = booking.cancellationFeeBreakdown;
  const refundAmount = booking.refundAmount || fee?.totalRefund || booking.grandTotal || booking.price || 0;
  const processedAt = booking.refundProcessedAt
    ? new Date(booking.refundProcessedAt).toLocaleString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : new Date().toLocaleString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const body = `
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Dear <strong>${booking.passengerName}</strong>,
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      We're pleased to inform you that your refund for booking
      <strong style="color:#003399;">${booking.bookingId}</strong> has been
      <strong style="color:#00aa55;">successfully processed</strong> and sent to your original payment method.
    </p>

    <div style="background:#e8f5e9;border:2px solid #00aa55;border-radius:14px;padding:22px 24px;margin:20px 0;text-align:center;">
      <div style="font-size:11px;font-weight:800;color:#006633;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">💸 Refund Amount</div>
      <div style="font-size:40px;font-weight:900;color:#00aa55;font-family:Montserrat,Arial,sans-serif;letter-spacing:1px;">
        ₱${refundAmount.toLocaleString()}
      </div>
      <div style="font-size:12px;color:#006633;margin-top:6px;">Inclusive of VAT</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:12px;padding:16px;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Booking Reference</td>
        <td style="text-align:right;font-size:13px;font-weight:800;color:#003399;letter-spacing:1px;">${booking.bookingId}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Passenger Name</td>
        <td style="text-align:right;font-size:13px;font-weight:700;color:#1a1a2e;">${booking.passengerName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Refund Amount (incl. VAT)</td>
        <td style="text-align:right;font-size:14px;font-weight:900;color:#00aa55;">₱${refundAmount.toLocaleString()}</td>
      </tr>
      ${fee?.totalFee > 0 ? `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Cancellation Fee Deducted</td>
        <td style="text-align:right;font-size:13px;font-weight:700;color:#cc5500;">−₱${(fee.totalFee||0).toLocaleString()}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Processed On</td>
        <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">${processedAt}</td>
      </tr>
      ${booking.refundProcessedBy ? `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Processed By</td>
        <td style="text-align:right;font-size:13px;font-weight:600;color:#1a1a2e;">${booking.refundProcessedBy}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;">Payment Method</td>
        <td style="text-align:right;font-size:13px;font-weight:700;color:#1a1a2e;">GCash</td>
      </tr>
    </table>

    <div style="background:#fff8e1;border-left:4px solid #ffc107;border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;color:#cc8800;margin-bottom:8px;">ℹ️ Please Note</div>
      <div style="font-size:13px;color:#666;line-height:1.8;">
        • Refunds are sent to your <strong>GCash account</strong> used for the original payment<br>
        • Please allow <strong>1–3 business days</strong> for the amount to reflect in your wallet<br>
        • If you do not receive the refund within 5 business days, please contact our support team
      </div>
    </div>

    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
      For any concerns, contact us at
      <a href="mailto:support@cebuairlines.demo" style="color:#0055cc;">support@cebuairlines.demo</a>
      or call <strong>(032) 888-5678</strong>.
    </p>`;

  const html = emailWrapper(
    'linear-gradient(135deg,#003300 0%,#006633 60%,#00aa55 100%)',
    '💸', '✅ REFUND PROCESSED', '#00aa55', body
  );
  await (createTransporter()).sendMail({
    from: `"✈️ Cebu Airlines" <${process.env.SMTP_USER}>`,
    to: booking.passengerEmail,
    subject: `💸 Refund Sent — ₱${refundAmount.toLocaleString()} [${booking.bookingId}] | Cebu Airlines`,
    html,
  });
};

module.exports = {
  sendBookingConfirmation, sendPaymentRejected,
  sendCancellationApproved, sendCancellationRejected,
  sendCancellationRequested,
  sendRescheduleRequested, sendRescheduleApproved, sendRescheduleRejected,
  sendBookingExpired, sendFlightCancelledNotice, sendRefundSent,
};
