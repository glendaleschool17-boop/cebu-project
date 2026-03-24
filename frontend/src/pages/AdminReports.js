import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const CITY_NAMES = {
  MNL: 'Manila', CEB: 'Cebu', DVO: 'Davao', ILO: 'Iloilo',
  BCD: 'Bacolod', ZAM: 'Zamboanga', GEN: 'General Santos',
  LGP: 'Legazpi', KLO: 'Kalibo', PPS: 'Puerto Princesa',
};

const AdminReports = () => {
  const { adminCity, isSuperAdmin } = useAuth();
  const cityLabel = adminCity ? (CITY_NAMES[adminCity] || adminCity) : null;

  useEffect(() => {
    document.title = 'Admin Reports – Cebu Airline';
  }, []);

  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      const data = await api.get(`/reports/bookings?${params.toString()}`);
      setReport(data);
    } catch { toast.error('Failed to generate report'); }
    finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const handleDownloadCSV = () => {
    const headers = [
      'Booking ID', 'Passenger Name', 'Passenger Count', 'Flight Number',
      'Route', 'Seat', 'Trip Type', 'Seat Class',
      'Amount (incl. VAT)', 'VAT', 'Status', 'Booking Date',
    ];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = report.report.map(row => [
      row.bookingId, row.passengerName, row.passengerCount, row.flightNumber,
      row.route, row.seatNumber, row.tripType, row.seatClass,
      row.grandTotal, row.vatAmount, row.status,
      row.bookingDate ? new Date(row.bookingDate).toLocaleDateString('en-PH') : '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cebu-report-${cityLabel || 'all'}-${filters.startDate || 'all'}-${filters.endDate || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dt) => new Date(dt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div style={{ padding: '32px 0 60px' }}>
        <div className="container">
          <div style={styles.header} className="no-print">
            <h1 style={styles.title}>Booking Reports</h1>
            {cityLabel && (
              <div style={scopeBanner}>
                📍 Scoped to <strong>{cityLabel}</strong> — only bookings where {cityLabel} is the origin or destination
              </div>
            )}
            {isSuperAdmin && (
              <div style={{ ...scopeBanner, background: '#f3e8ff', color: '#7700cc', borderColor: '#ddb8ff' }}>
                ⭐ Super Admin — report includes all bookings across all cities
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="card no-print" style={{ marginBottom: 28 }}>
            <h2 style={styles.filterTitle}>Report Filters</h2>
            <div style={styles.filterRow}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>Start Date</label>
                <input type="date" className="input-field" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>End Date</label>
                <input type="date" className="input-field" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>Status</label>
                <select className="input-field" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending_payment">Pending Payment</option>
                  <option value="payment_submitted">Payment Submitted</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button className="btn-primary" onClick={fetchReport} style={{ alignSelf: 'flex-end', padding: '12px 24px' }}>
                Generate Report
              </button>
            </div>
          </div>

          {loading && <div className="spinner" />}

          {report && (
            <div>
              {/* Report Header */}
              <div style={styles.reportHeader}>
                <img src="/logo.jpg" alt="Cebu Airlines" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', marginBottom: 10 }} />
                <div style={styles.reportLogo}>CEBU AIRLINES</div>
                <div style={styles.reportTitle}>BOOKING REPORT{cityLabel ? ` — ${cityLabel.toUpperCase()}` : ' — ALL CITIES'}</div>
                <div style={styles.reportMeta}>
                  Generated: {new Date().toLocaleString('en-PH')}
                  {filters.startDate && ` | From: ${filters.startDate}`}
                  {filters.endDate && ` | To: ${filters.endDate}`}
                  {filters.status && ` | Status: ${filters.status}`}
                  {cityLabel && ` | City: ${cityLabel}`}
                </div>
                <div style={styles.reportStats}>
                  <div style={styles.reportStat}>
                    <div style={styles.statNum}>{report.count}</div>
                    <div style={styles.statLbl}>Total Bookings</div>
                  </div>
                  <div style={styles.reportStat}>
                    <div style={{ ...styles.statNum, color: '#ff6600' }}>₱{report.totalRevenue?.toLocaleString()}</div>
                    <div style={styles.statLbl}>Revenue (incl. VAT)</div>
                  </div>
                  {report.totalSubtotal > 0 && (
                    <div style={styles.reportStat}>
                      <div style={{ ...styles.statNum, fontSize: 20, color: '#ffcc44' }}>₱{report.totalSubtotal?.toLocaleString()}</div>
                      <div style={styles.statLbl}>Subtotal (ex. VAT)</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.reportActions} className="no-print">
                <button className="btn-primary" onClick={handlePrint}>🖨️ Print Report</button>
                <button className="btn-primary" onClick={handleDownloadCSV} style={{ marginLeft: 10, background: '#007744' }}>⬇️ Download CSV</button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Booking ID</th>
                      <th>Passenger Name</th>
                      <th>Flight</th>
                      <th>Route</th>
                      <th>Seat</th>
                      <th>Amount (incl. VAT)</th>
                      <th>Status</th>
                      <th>Booking Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.report.map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: '#888', fontSize: 13 }}>{i + 1}</td>
                        <td><span style={styles.refNum}>{row.bookingId}</span></td>
                        <td style={{ fontWeight: 600 }}>{row.passengerName}</td>
                        <td style={{ fontWeight: 700, color: '#003399' }}>{row.flightNumber}</td>
                        <td style={{ fontSize: 13 }}>{row.route}</td>
                        <td><strong>{row.seatNumber}</strong></td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#ff6600' }}>₱{(row.grandTotal || row.price)?.toLocaleString()}</div>
                          {row.vatAmount > 0 && (
                            <div style={{ fontSize: 11, color: '#888' }}>+₱{row.vatAmount?.toLocaleString()} VAT</div>
                          )}
                        </td>
                        <td><StatusBadge status={row.status} /></td>
                        <td style={{ fontSize: 12, color: '#888' }}>{formatDate(row.bookingDate)}</td>
                      </tr>
                    ))}
                    {report.report.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>No data found for {cityLabel || 'selected filters'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.reportFooter}>
                <strong>Total Confirmed Revenue (incl. VAT): ₱{report.totalRevenue?.toLocaleString()}</strong>
                {report.totalSubtotal > 0 && (
                  <span style={{ color: '#888', marginLeft: 12 }}>· Subtotal ex. VAT: ₱{report.totalSubtotal?.toLocaleString()}</span>
                )}
                {' · '}Total Records: {report.count}
                {cityLabel && <span style={{ marginLeft: 12, color: '#003399' }}>· City Scope: {cityLabel}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const scopeBanner = {
  marginTop: 10,
  marginBottom: 4,
  padding: '7px 14px',
  background: '#e8eeff',
  color: '#003399',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #c0ccff',
  display: 'inline-block',
};

const styles = {
  header: { marginBottom: 28 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399' },
  filterTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 700, color: '#003399', marginBottom: 20 },
  filterRow: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  reportHeader: {
    background: 'linear-gradient(135deg, #001040, #003399)',
    color: 'white', borderRadius: 12, padding: '24px 32px',
    marginBottom: 20, textAlign: 'center',
  },
  reportLogo: { fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 20, letterSpacing: 2, marginBottom: 4 },
  reportTitle: { fontSize: 13, letterSpacing: 3, opacity: 0.75, marginBottom: 4 },
  reportMeta: { fontSize: 12, opacity: 0.6, marginBottom: 20 },
  reportStats: { display: 'flex', justifyContent: 'center', gap: 60 },
  reportStat: { textAlign: 'center' },
  statNum: { fontSize: 28, fontWeight: 900, fontFamily: 'Montserrat, sans-serif', color: '#ffcc44' },
  statLbl: { fontSize: 12, opacity: 0.7 },
  reportActions: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  refNum: { fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#003399', fontSize: 12, letterSpacing: 0.5 },
  reportFooter: {
    background: '#f0f4ff', border: '1px solid #dde4ff',
    borderRadius: 8, padding: '14px 20px', marginTop: 16,
    fontSize: 14, color: '#333', textAlign: 'right',
  },
};

export default AdminReports;
