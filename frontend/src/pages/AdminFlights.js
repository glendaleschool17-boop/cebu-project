import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const CITY_NAMES = {
  MNL: 'Manila', CEB: 'Cebu', DVO: 'Davao', ILO: 'Iloilo',
  BCD: 'Bacolod', ZAM: 'Zamboanga', GEN: 'General Santos',
  LGP: 'Legazpi', KLO: 'Kalibo', PPS: 'Puerto Princesa',
};

const CITIES = [
  { code: 'MNL', name: 'Manila' }, { code: 'CEB', name: 'Cebu' },
  { code: 'DVO', name: 'Davao' }, { code: 'ILO', name: 'Iloilo' },
  { code: 'BCD', name: 'Bacolod' }, { code: 'ZAM', name: 'Zamboanga' },
  { code: 'GEN', name: 'General Santos' }, { code: 'LGP', name: 'Legazpi' },
  { code: 'KLO', name: 'Kalibo' }, { code: 'PPS', name: 'Puerto Princesa' },
];

const CANCEL_REASONS = [
  'Severe weather conditions',
  'Technical / mechanical issue',
  'Air traffic control restriction',
  'Crew unavailability',
  'Low passenger demand',
  'Safety inspection required',
  'Airport closure',
];

const emptyForm = {
  flightNumber: '', origin: '', originCity: '', destination: '', destinationCity: '',
  departureTime: '', arrivalTime: '', price: '', totalSeats: 180, aircraft: 'Airbus A320',
};

const StatusBadge = ({ status }) => {
  const map = {
    active:    { bg: '#e6fff3', color: '#007744', label: 'ACTIVE' },
    cancelled: { bg: '#fff0f0', color: '#cc2222', label: 'CANCELLED' },
    delayed:   { bg: '#fff8e1', color: '#cc7700', label: 'DELAYED' },
  };
  const s = map[status] || { bg: '#f0f0f0', color: '#888', label: (status || '—').toUpperCase() };
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, letterSpacing: '0.5px',
      border: `1px solid ${s.color}33`,
    }}>{s.label}</span>
  );
};

const CancelModal = ({ flight, onConfirm, onClose, cancelling }) => {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState(false);

  const pickReason = (r) => { setReason(r); setCustom(false); };

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: 520 }}>
        <div style={{ ...styles.modalHeader, background: 'linear-gradient(135deg,#330000,#990000)', borderRadius: '20px 20px 0 0' }}>
          <div>
            <h2 style={{ ...styles.modalTitle, color: '#fff', fontSize: 16 }}>
              ✈️ Cancel Flight — {flight.flightNumber}
            </h2>
            <div style={{ color: '#ffaaaa', fontSize: 12, marginTop: 4 }}>
              {flight.origin} → {flight.destination} · {new Date(flight.departureTime).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={onClose} style={{ ...styles.closeBtn, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          <div style={{ background: '#fff0f0', border: '1.5px solid #ffcccc', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#cc2222' }}>
            ⚠️ <strong>This action is irreversible.</strong> All affected passengers will be notified by email and given options to refund or rebook.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Select a cancellation reason <span style={{ color: '#cc2222' }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {CANCEL_REASONS.map(r => (
                <button key={r} onClick={() => pickReason(r)} style={{
                  padding: '9px 14px', borderRadius: 8, textAlign: 'left', fontSize: 13, cursor: 'pointer',
                  fontWeight: reason === r && !custom ? 700 : 400,
                  background: reason === r && !custom ? '#fff0f0' : '#fafafa',
                  border: `1.5px solid ${reason === r && !custom ? '#cc2222' : '#e0e0e0'}`,
                  color: reason === r && !custom ? '#cc2222' : '#333',
                  transition: 'all 0.15s',
                }}>
                  {reason === r && !custom ? '✓ ' : ''}{r}
                </button>
              ))}
              <button onClick={() => { setCustom(true); setReason(''); }} style={{
                padding: '9px 14px', borderRadius: 8, textAlign: 'left', fontSize: 13, cursor: 'pointer',
                fontWeight: custom ? 700 : 400,
                background: custom ? '#fff0f0' : '#fafafa',
                border: `1.5px solid ${custom ? '#cc2222' : '#e0e0e0'}`,
                color: custom ? '#cc2222' : '#555',
              }}>
                {custom ? '✓ ' : ''}✏️ Other (type custom reason)
              </button>
            </div>
          </div>

          {custom && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={styles.label}>Custom reason</label>
              <textarea
                className="input-field"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe the reason for cancellation…"
                style={{ resize: 'vertical', marginTop: 6, width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button
              onClick={() => onConfirm(reason)}
              disabled={!reason.trim() || cancelling}
              style={{
                flex: 1, padding: '13px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                background: !reason.trim() || cancelling ? '#e0e0e0' : '#cc2222',
                color: !reason.trim() || cancelling ? '#aaa' : '#fff',
                border: 'none', cursor: !reason.trim() || cancelling ? 'not-allowed' : 'pointer',
              }}
            >
              {cancelling ? '⏳ Cancelling…' : '🚫 Confirm Cancellation'}
            </button>
            <button onClick={onClose} disabled={cancelling} style={{
              flex: 1, padding: '13px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', cursor: 'pointer',
            }}>
              Keep Flight
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminFlights = () => {
  const [flights, setFlights]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [editFlight, setEditFlight]     = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [editSaving, setEditSaving]     = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterDest, setFilterDest]     = useState('');
  const { adminCity, isSuperAdmin }     = useAuth();
  const cityLabel = adminCity ? (CITY_NAMES[adminCity] || adminCity) : null;

  useEffect(() => {
    document.title = 'Admin Flights – Cebu Airline';
    fetchFlights();
  }, []);

  const fetchFlights = async () => {
    try {
      const data = await api.get('/flights/admin/all');
      setFlights(data.flights || []);
    } catch {
      toast.error('Failed to load flights');
    } finally { setLoading(false); }
  };

  const handleCityChange = (field, code) => {
    const city = CITIES.find(c => c.code === code);
    if (field === 'origin') setForm({ ...form, origin: code, originCity: city?.name || '' });
    else setForm({ ...form, destination: code, destinationCity: city?.name || '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/flights', form);
      toast.success('Flight created successfully');
      setShowForm(false);
      setForm(emptyForm);
      fetchFlights();
    } catch (err) { toast.error(err.message || 'Failed to create flight'); }
    finally { setSaving(false); }
  };

  const openCancelModal = (flight) => setCancelTarget(flight);

  const handleConfirmCancel = async (reason) => {
    if (!reason.trim()) return toast.error('Please provide a cancellation reason.');
    setCancelling(true);
    try {
      const result = await api.post(`/flights/${cancelTarget.id}/cancel`, { cancellationReason: reason });
      const notified = result.passengersNotified ?? 0;
      toast.success(`Flight cancelled. ${notified} passenger${notified !== 1 ? 's' : ''} notified by email.`);
      setCancelTarget(null);
      fetchFlights();
    } catch (err) { toast.error(err.message || 'Failed to cancel flight'); }
    finally { setCancelling(false); }
  };

  const openEditModal = (flight) => {
    const toLocalInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditForm({
      flightNumber: flight.flightNumber || '',
      aircraft: flight.aircraft || 'Airbus A320',
      origin: flight.origin || '',
      originCity: flight.originCity || '',
      destination: flight.destination || '',
      destinationCity: flight.destinationCity || '',
      departureTime: toLocalInput(flight.departureTime),
      arrivalTime: toLocalInput(flight.arrivalTime),
      price: flight.price || '',
      totalSeats: flight.totalSeats || 180,
    });
    setEditFlight(flight);
  };

  const handleEditCityChange = (field, code) => {
    const city = CITIES.find(c => c.code === code);
    if (field === 'origin') setEditForm(f => ({ ...f, origin: code, originCity: city?.name || '' }));
    else setEditForm(f => ({ ...f, destination: code, destinationCity: city?.name || '' }));
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await api.put(`/flights/${editFlight.id}`, {
        ...editForm,
        price: parseFloat(editForm.price),
        totalSeats: parseInt(editForm.totalSeats),
      });
      toast.success('✅ Flight updated successfully!');
      setEditFlight(null);
      fetchFlights();
    } catch (err) { toast.error(err.message || 'Failed to update flight'); }
    finally { setEditSaving(false); }
  };

  const formatTime = (dt) => new Date(dt).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // ── Multi-filter: status chip + search text + origin/dest dropdowns ─────────
  const displayedFlights = flights.filter(f => {
    // Status chip
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;

    // Origin dropdown
    if (filterOrigin && f.origin !== filterOrigin) return false;

    // Destination dropdown
    if (filterDest && f.destination !== filterDest) return false;

    // Free-text search — matches flight number, origin/dest codes & city names, aircraft, date string
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const depDate = f.departureTime
        ? new Date(f.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
        : '';
      const haystack = [
        f.flightNumber, f.origin, f.destination,
        f.originCity, f.destinationCity, f.aircraft,
        depDate,
        String(f.price || ''),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const cancelledCount = flights.filter(f => f.status === 'cancelled').length;
  const activeCount    = flights.filter(f => f.status === 'active').length;

  const hasActiveFilters = searchQuery.trim() || filterOrigin || filterDest || filterStatus !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterOrigin('');
    setFilterDest('');
    setFilterStatus('all');
  };

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container">

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Flight Management</h1>
            {cityLabel && (
              <div style={flightScopeBanner}>
                📍 <strong>{cityLabel}</strong> Regional Admin — all flights visible. Bookings scoped to your city.
              </div>
            )}
            {isSuperAdmin && (
              <div style={{ ...flightScopeBanner, background: '#f3e8ff', color: '#7700cc', borderColor: '#ddb8ff' }}>
                ⭐ Super Admin — managing all flights system-wide
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ Add New Flight'}
          </button>
        </div>

        {/* ── Search & Filter bar ── */}
        <div style={styles.filterBar}>
          {/* Free-text search */}
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              className="input-field"
              style={styles.searchInput}
              placeholder="Search flight number, route, city, aircraft…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={styles.clearX} title="Clear search">✕</button>
            )}
          </div>

          {/* Origin dropdown */}
          <select
            className="input-field"
            style={styles.filterSelect}
            value={filterOrigin}
            onChange={e => setFilterOrigin(e.target.value)}
          >
            <option value="">All Origins</option>
            {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
          </select>

          {/* Destination dropdown */}
          <select
            className="input-field"
            style={styles.filterSelect}
            value={filterDest}
            onChange={e => setFilterDest(e.target.value)}
          >
            <option value="">All Destinations</option>
            {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
          </select>

          {/* Clear all */}
          {hasActiveFilters && (
            <button onClick={clearAllFilters} style={styles.clearAllBtn}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'all',       label: `All (${flights.length})`,         color: '#003399', bg: '#e8eeff' },
            { key: 'active',    label: `✅ Active (${activeCount})`,        color: '#007744', bg: '#e6fff3' },
            { key: 'cancelled', label: `🚫 Cancelled (${cancelledCount})`,  color: '#cc2222', bg: '#fff0f0' },
          ].map(chip => (
            <button key={chip.key} onClick={() => setFilterStatus(chip.key)} style={{
              padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: filterStatus === chip.key ? chip.color : chip.bg,
              color: filterStatus === chip.key ? '#fff' : chip.color,
              border: `1.5px solid ${chip.color}66`,
              transition: 'all 0.15s',
            }}>
              {chip.label}
            </button>
          ))}
          {/* Live result count */}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#888', fontWeight: 500 }}>
            {displayedFlights.length === flights.length
              ? `${flights.length} flight${flights.length !== 1 ? 's' : ''}`
              : `${displayedFlights.length} of ${flights.length} flights`}
          </span>
        </div>

        {/* Add Flight Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 28 }}>
            <h2 style={styles.formTitle}>Add New Flight</h2>
            <form onSubmit={handleSave}>
              <div style={styles.formGrid}>
                <div className="form-group">
                  <label>Flight Number</label>
                  <input className="input-field" value={form.flightNumber} onChange={e => setForm({ ...form, flightNumber: e.target.value })} placeholder="CEB-101" required />
                </div>
                <div className="form-group">
                  <label>Aircraft</label>
                  <select className="input-field" value={form.aircraft} onChange={e => setForm({ ...form, aircraft: e.target.value })}>
                    <option>Airbus A320</option><option>Airbus A321</option>
                    <option>Boeing 737-800</option><option>ATR 72-600</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Origin</label>
                  <select className="input-field" value={form.origin} onChange={e => handleCityChange('origin', e.target.value)} required>
                    <option value="">Select Origin</option>
                    {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Destination</label>
                  <select className="input-field" value={form.destination} onChange={e => handleCityChange('destination', e.target.value)} required>
                    <option value="">Select Destination</option>
                    {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Departure Time</label>
                  <input type="datetime-local" className="input-field" value={form.departureTime} onChange={e => setForm({ ...form, departureTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Arrival Time</label>
                  <input type="datetime-local" className="input-field" value={form.arrivalTime} onChange={e => setForm({ ...form, arrivalTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Price (₱)</label>
                  <input type="number" className="input-field" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="2500" required />
                </div>
                <div className="form-group">
                  <label>Total Seats</label>
                  <input type="number" className="input-field" value={form.totalSeats} onChange={e => setForm({ ...form, totalSeats: parseInt(e.target.value) })} />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '12px 32px' }} disabled={saving}>
                {saving ? 'Saving...' : 'Create Flight'}
              </button>
            </form>
          </div>
        )}

        {/* Flights Table */}
        {loading ? <div className="spinner" /> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Flight</th><th>Route</th><th>Departure</th>
                  <th>Arrival</th><th>Price</th><th>Seats</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedFlights.map(f => {
                  const isCancelled = f.status === 'cancelled';
                  return (
                    <tr key={f.id} style={isCancelled ? styles.cancelledRow : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...styles.flightNum, color: isCancelled ? '#cc2222' : '#003399' }}>
                            {f.flightNumber}
                          </span>
                          {isCancelled && <span style={styles.cancelledTag}>CANCELLED</span>}
                        </div>
                        <div style={styles.aircraft}>{f.aircraft}</div>
                      </td>
                      <td>
                        <div style={{ ...styles.route, color: isCancelled ? '#888' : '#1a1a2e' }}>
                          {f.origin} → {f.destination}
                        </div>
                        <div style={styles.routeCity}>{f.originCity} → {f.destinationCity}</div>
                      </td>
                      <td style={{ fontSize: 13, color: isCancelled ? '#bbb' : '#333' }}>
                        <span style={isCancelled ? { textDecoration: 'line-through' } : {}}>
                          {formatTime(f.departureTime)}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: isCancelled ? '#bbb' : '#333' }}>
                        <span style={isCancelled ? { textDecoration: 'line-through' } : {}}>
                          {formatTime(f.arrivalTime)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: isCancelled ? '#ccc' : '#ff6600' }}>
                        ₱{f.price?.toLocaleString()}
                      </td>
                      <td>
                        {isCancelled
                          ? <span style={{ color: '#ccc', fontSize: 13 }}>—</span>
                          : <span style={{ color: f.availableSeats < 10 ? '#cc2222' : '#007744', fontWeight: 600 }}>
                              {f.availableSeats}/{f.totalSeats}
                            </span>
                        }
                      </td>
                      <td>
                        <StatusBadge status={f.status} />
                        {isCancelled && f.cancellationReason && (
                          <div style={styles.reasonPill} title={f.cancellationReason}>
                            📋 {f.cancellationReason.length > 32
                              ? f.cancellationReason.slice(0, 32) + '…'
                              : f.cancellationReason}
                          </div>
                        )}
                        {isCancelled && f.cancelledAt && (
                          <div style={{ fontSize: 10, color: '#ccc', marginTop: 3 }}>
                            {new Date(f.cancelledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td>
                        {f.status === 'active' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEditModal(f)} style={styles.editBtn}>✏️ Edit</button>
                            <button onClick={() => openCancelModal(f)} style={styles.cancelBtn}>🚫 Cancel</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#ccc', fontStyle: 'italic' }}>No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {displayedFlights.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                      {hasActiveFilters ? (
                        <div>
                          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>No flights match your search</div>
                          <button onClick={clearAllFilters} style={{ fontSize: 13, color: '#003399', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Clear all filters
                          </button>
                        </div>
                      ) : filterStatus === 'cancelled' ? '✅ No cancelled flights' : 'No flights found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancel Reason Modal */}
        {cancelTarget && (
          <CancelModal
            flight={cancelTarget}
            onConfirm={handleConfirmCancel}
            onClose={() => !cancelling && setCancelTarget(null)}
            cancelling={cancelling}
          />
        )}

        {/* Edit Flight Modal */}
        {editFlight && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>✏️ Edit Flight — {editFlight.flightNumber}</h2>
                <button onClick={() => setEditFlight(null)} style={styles.closeBtn}>✕</button>
              </div>
              <div style={{ padding: 28 }}>
                <form onSubmit={handleEditSave}>
                  <div style={styles.formGrid}>
                    <div className="form-group">
                      <label>Flight Number</label>
                      <input className="input-field" value={editForm.flightNumber}
                        onChange={e => setEditForm(f => ({ ...f, flightNumber: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Aircraft</label>
                      <select className="input-field" value={editForm.aircraft}
                        onChange={e => setEditForm(f => ({ ...f, aircraft: e.target.value }))}>
                        <option>Airbus A320</option><option>Airbus A321</option>
                        <option>Boeing 737-800</option><option>ATR 72-600</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Origin</label>
                      <select className="input-field" value={editForm.origin}
                        onChange={e => handleEditCityChange('origin', e.target.value)} required>
                        <option value="">Select Origin</option>
                        {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Destination</label>
                      <select className="input-field" value={editForm.destination}
                        onChange={e => handleEditCityChange('destination', e.target.value)} required>
                        <option value="">Select Destination</option>
                        {CITIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Departure Time</label>
                      <input type="datetime-local" className="input-field" value={editForm.departureTime}
                        onChange={e => setEditForm(f => ({ ...f, departureTime: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Arrival Time</label>
                      <input type="datetime-local" className="input-field" value={editForm.arrivalTime}
                        onChange={e => setEditForm(f => ({ ...f, arrivalTime: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Price (₱)</label>
                      <input type="number" className="input-field" value={editForm.price}
                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Total Seats</label>
                      <input type="number" className="input-field" value={editForm.totalSeats}
                        onChange={e => setEditForm(f => ({ ...f, totalSeats: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, padding: '13px' }} disabled={editSaving}>
                      {editSaving ? 'Saving…' : '💾 Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditFlight(null)}
                      style={{ flex: 1, padding: '13px', fontWeight: 700, background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', borderRadius: 8, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const flightScopeBanner = {
  marginTop: 8, padding: '6px 13px', background: '#e8eeff', color: '#003399',
  borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #c0ccff', display: 'inline-block',
};

const styles = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399' },
  label:     { fontSize: 13, fontWeight: 600, color: '#333' },
  formTitle: { fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#003399', marginBottom: 24, fontSize: 18 },
  formGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 20 },
  flightNum: { fontWeight: 800, fontFamily: 'Montserrat, sans-serif', fontSize: 15 },
  aircraft:  { color: '#888', fontSize: 12, marginTop: 2 },
  route:     { fontWeight: 700, fontSize: 14 },
  routeCity: { color: '#888', fontSize: 12 },
  cancelledRow: { background: '#fff8f8', opacity: 0.9 },
  cancelledTag: {
    fontSize: 9, fontWeight: 800, background: '#cc2222', color: '#fff',
    padding: '2px 6px', borderRadius: 4, letterSpacing: '0.5px',
  },
  reasonPill: {
    marginTop: 5, fontSize: 10, color: '#cc2222', background: '#fff0f0',
    border: '1px solid #ffcccc', borderRadius: 6, padding: '2px 7px',
    display: 'inline-block', maxWidth: 180,
  },
  cancelBtn: {
    background: '#fff0f0', color: '#cc2222', border: '1px solid #ffcccc',
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  editBtn: {
    background: '#e8eeff', color: '#003399', border: '1px solid #99aadd',
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  // ── Search & filter bar ──────────────────────────────────────────────────
  filterBar: {
    display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center',
  },
  searchWrap: {
    position: 'relative', flex: '1 1 260px', display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute', left: 12, fontSize: 15, pointerEvents: 'none', zIndex: 1,
  },
  searchInput: {
    width: '100%', paddingLeft: 36, paddingRight: 32,
    height: 40, fontSize: 13, borderRadius: 8,
  },
  clearX: {
    position: 'absolute', right: 10, background: 'none', border: 'none',
    fontSize: 13, color: '#aaa', cursor: 'pointer', padding: '2px 4px',
    lineHeight: 1, borderRadius: 4,
  },
  filterSelect: {
    flex: '0 0 auto', height: 40, fontSize: 13, minWidth: 150, borderRadius: 8,
  },
  clearAllBtn: {
    padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13,
    background: '#f0f4ff', color: '#003399', border: '1.5px solid #dde4ff',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  // ── Modals ───────────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
  },
  modal: {
    background: 'white', borderRadius: 20, width: '100%', maxWidth: 680,
    maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 80px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '22px 28px', borderBottom: '1px solid #eef0ff',
  },
  modalTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#003399' },
  closeBtn: {
    background: '#f0f0f0', border: 'none', width: 32, height: 32,
    borderRadius: '50%', cursor: 'pointer', fontSize: 16, color: '#666',
  },
};

export default AdminFlights;
