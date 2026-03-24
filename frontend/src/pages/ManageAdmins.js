import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const CITIES = [
  { code: 'MNL', name: 'Manila' }, { code: 'CEB', name: 'Cebu' },
  { code: 'DVO', name: 'Davao' }, { code: 'ILO', name: 'Iloilo' },
  { code: 'BCD', name: 'Bacolod' }, { code: 'ZAM', name: 'Zamboanga' },
  { code: 'GEN', name: 'General Santos' }, { code: 'LGP', name: 'Legazpi' },
  { code: 'KLO', name: 'Kalibo' }, { code: 'PPS', name: 'Puerto Princesa' },
];
const CITY_MAP = Object.fromEntries(CITIES.map(c => [c.code, c.name]));

// ── Edit Modal ────────────────────────────────────────────────────────────────
const EditModal = ({ admin, onSave, onClose }) => {
  const [city, setCity] = useState(admin.adminCity || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(admin.uid, city || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        {/* Header */}
        <div style={modal.header}>
          <div>
            <div style={modal.title}>✏️ Edit Admin Role</div>
            <div style={modal.sub}>{admin.name || admin.email}</div>
          </div>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </div>

        {/* Current role */}
        <div style={modal.currentRole}>
          <span style={{ fontSize: 13, color: '#888' }}>Current role: </span>
          {admin.adminCity
            ? <span style={pill('#003399', '#e8eeff')}>📍 {CITY_MAP[admin.adminCity] || admin.adminCity} Admin</span>
            : <span style={pill('#7700cc', '#f3e8ff')}>⭐ Super Admin</span>
          }
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={modal.field}>
            <label style={modal.label}>New City Scope</label>
            <select value={city} onChange={e => setCity(e.target.value)} style={modal.select}>
              <option value="">⭐ Super Admin (no restriction — sees all)</option>
              {CITIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
              ))}
            </select>
            <span style={modal.hint}>
              {city
                ? `This admin will only see bookings where ${CITY_MAP[city]} is origin or destination.`
                : 'Super Admin has full access to all bookings and can manage other admins.'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={modal.cancelBtn}>Cancel</button>
            <button type="submit" style={modal.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Confirm Revoke Modal ──────────────────────────────────────────────────────
const RevokeModal = ({ admin, onConfirm, onClose }) => (
  <div style={modal.overlay}>
    <div style={{ ...modal.box, maxWidth: 400 }}>
      <div style={modal.header}>
        <div style={modal.title}>🚫 Revoke Admin Access</div>
        <button onClick={onClose} style={modal.closeBtn}>✕</button>
      </div>
      <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '16px 0 24px' }}>
        Are you sure you want to revoke admin access for <strong>{admin.name || admin.email}</strong>?
        They will be downgraded to a regular passenger and lose all admin privileges immediately after their next login.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={modal.cancelBtn}>Cancel</button>
        <button onClick={onConfirm} style={{ ...modal.saveBtn, background: '#cc2222' }}>
          🚫 Yes, Revoke Access
        </button>
      </div>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formUid, setFormUid] = useState('');
  const [formCity, setFormCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);   // admin being edited
  const [revokeAdmin, setRevokeAdmin] = useState(null); // admin being revoked
  const [formRole, setFormRole] = useState('admin');   // 'admin' | 'gate_agent'
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    document.title = 'Manage Admins – Cebu Airline';
    if (!isSuperAdmin) { navigate('/admin'); return; }
    fetchAdmins();
  }, [isSuperAdmin]);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/admin-users');
      setAdmins(data.admins || []);
    } catch {
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  // Assign new admin or gate_agent
  const handleAssign = async (e) => {
    e.preventDefault();
    if (!formUid.trim()) { toast.error('User UID is required'); return; }
    setSaving(true);
    try {
      await api.post('/admin/admin-users', { uid: formUid.trim(), adminCity: formCity || null, role: formRole });
      const label = formRole === 'gate_agent'
        ? 'Gate Agent'
        : (formCity ? `${CITY_MAP[formCity] || formCity} Regional Admin` : 'Super Admin');
      toast.success(`✅ Role assigned: ${label}`);
      setFormUid(''); setFormCity(''); setFormRole('admin'); setShowForm(false);
      fetchAdmins();
    } catch (err) {
      toast.error(err.message || 'Failed to assign role');
    } finally {
      setSaving(false);
    }
  };

  // Edit existing admin's city
  const handleEdit = async (uid, newCity) => {
    try {
      await api.post('/admin/admin-users', { uid, adminCity: newCity });
      const label = newCity ? `${CITY_MAP[newCity] || newCity} Regional Admin` : 'Super Admin';
      toast.success(`✅ Role updated to: ${label}`);
      setEditAdmin(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
      throw err;
    }
  };

  // Revoke admin
  const handleRevoke = async () => {
    if (!revokeAdmin) return;
    try {
      await api.delete(`/admin/admin-users/${revokeAdmin.uid}`);
      toast.success('Admin access revoked');
      setRevokeAdmin(null);
      fetchAdmins();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div style={{ padding: '32px 0 60px' }}>
      {/* Edit Modal */}
      {editAdmin && (
        <EditModal
          admin={editAdmin}
          onSave={handleEdit}
          onClose={() => setEditAdmin(null)}
        />
      )}

      {/* Revoke Confirm Modal */}
      {revokeAdmin && (
        <RevokeModal
          admin={revokeAdmin}
          onConfirm={handleRevoke}
          onClose={() => setRevokeAdmin(null)}
        />
      )}

      <div className="container">
        {/* Header */}
        <div style={styles.header}>
          <div>
            <button onClick={() => navigate('/admin')} style={styles.backBtn}>← Back to Dashboard</button>
            <h1 style={styles.title}>Manage Regional Admins</h1>
            <p style={styles.sub}>Assign admin access and city scope to users. Regional admins only see bookings for their assigned city.</p>
          </div>
          <button onClick={() => setShowForm(f => !f)} style={styles.addBtn}>
            {showForm ? '✕ Cancel' : '+ Assign Admin'}
          </button>
        </div>

        {/* Role explanation cards */}
        <div style={styles.rolesGrid}>
          <div style={roleCard('#7700cc', '#f3e8ff')}>
            <div style={styles.roleIcon}>⭐</div>
            <div style={styles.roleTitle}>Super Admin</div>
            <div style={styles.roleDesc}>Sees <strong>all bookings</strong> across every city. Can manage regional admins. No city restriction.</div>
          </div>
          <div style={roleCard('#003399', '#e8eeff')}>
            <div style={styles.roleIcon}>📍</div>
            <div style={styles.roleTitle}>Regional Admin</div>
            <div style={styles.roleDesc}>Sees <strong>only bookings</strong> where their assigned city is the origin or destination.</div>
          </div>
        </div>

        {/* Assign form */}
        {showForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Assign Role</h3>
            <p style={styles.formNote}>
              Enter the Firebase UID of the user you want to assign. Find it in Firebase Console → Authentication,
              or in Firestore under the <code>users</code> collection.
            </p>
            <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>User UID *</label>
                <input
                  value={formUid}
                  onChange={e => setFormUid(e.target.value)}
                  placeholder="e.g. CFHuSUNNFxgsZtIVV4cuzoKXM0J3"
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Role</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} style={styles.input}>
                  <option value="admin">🛡️ Admin</option>
                  <option value="gate_agent">🛂 Gate Agent</option>
                </select>
                <span style={styles.hint}>
                  {formRole === 'gate_agent'
                    ? 'Gate Agents can scan QR codes and validate tickets at the gate. No booking management access.'
                    : 'Admins have access to bookings, flights, and reports management.'}
                </span>
              </div>
              {formRole === 'admin' && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>City Scope</label>
                  <select value={formCity} onChange={e => setFormCity(e.target.value)} style={styles.input}>
                    <option value="">⭐ Super Admin (no restriction — sees all)</option>
                    {CITIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                    ))}
                  </select>
                  <span style={styles.hint}>Leave blank to make this user a Super Admin.</span>
                </div>
              )}
              <button type="submit" style={styles.saveBtn} disabled={saving}>
                {saving ? 'Saving...' : `✓ Assign ${formRole === 'gate_agent' ? 'Gate Agent' : 'Admin'} Role`}
              </button>
            </form>
          </div>
        )}

        {/* Admin list */}
        {loading ? <div className="spinner" /> : (
          <div>
            <h2 style={styles.sectionTitle}>Current Admins ({admins.length})</h2>
            {admins.length === 0 ? (
              <div style={styles.empty}>No admin users found.</div>
            ) : (
              <div style={styles.table}>
                {/* Table head */}
                <div style={styles.thead}>
                  <div style={{ flex: 2 }}>Name / Email</div>
                  <div style={{ flex: 1.5 }}>UID</div>
                  <div style={{ flex: 1 }}>Role</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>Actions</div>
                </div>

                {admins.map(a => {
                  const isGateAgent = a.role === 'gate_agent';
                  const isSuper = !isGateAgent && !a.adminCity;
                  const cityName = a.adminCity ? (CITY_MAP[a.adminCity] || a.adminCity) : null;
                  return (
                    <div key={a.uid} style={styles.row}>
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={styles.adminName}>{a.name || '—'}</div>
                        <div style={styles.adminEmail}>{a.email}</div>
                      </div>
                      <div style={{ flex: 1.5, minWidth: 0 }}>
                        <code style={styles.uid} title={a.uid}>{a.uid.slice(0, 14)}…</code>
                      </div>
                      <div style={{ flex: 1 }}>
                        {isGateAgent
                          ? <span style={pill('#cc6600', '#fff3e0')}>🛂 Gate Agent</span>
                          : isSuper
                          ? <span style={pill('#7700cc', '#f3e8ff')}>⭐ Super Admin</span>
                          : <span style={pill('#003399', '#e8eeff')}>📍 {cityName}</span>
                        }
                      </div>
                      <div style={{ flex: 1, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {!isGateAgent && (
                          <button
                            onClick={() => setEditAdmin(a)}
                            style={styles.editBtn}
                            title="Edit role"
                          >
                            ✏️ Edit
                          </button>
                        )}
                        <button
                          onClick={() => setRevokeAdmin(a)}
                          style={styles.revokeBtn}
                          title="Revoke access"
                        >
                          🚫 Revoke
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Help note */}
        <div style={styles.helpBox}>
          <strong>⚠️ Important:</strong> After assigning or changing a role, the affected user must <strong>sign out and sign back in</strong> for the new permissions to take effect.
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const pill = (color, bg) => ({
  display: 'inline-block', background: bg, color,
  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
});

const roleCard = (color, bg) => ({
  background: bg, borderRadius: 14, padding: '20px 22px', borderLeft: `4px solid ${color}`,
});

const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  box: {
    background: 'white', borderRadius: 18, padding: '28px 28px',
    maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  title: { fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: '#1a1a2e' },
  sub: { fontSize: 13, color: '#888', marginTop: 3 },
  closeBtn: {
    background: '#f0f4ff', border: 'none', borderRadius: '50%', width: 30, height: 30,
    cursor: 'pointer', fontSize: 14, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  currentRole: { marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  select: { padding: '11px 14px', borderRadius: 8, border: '2px solid #dde4ff', fontSize: 14, color: '#333', background: '#f8faff', outline: 'none' },
  hint: { fontSize: 12, color: '#888', marginTop: 3 },
  cancelBtn: { flex: 1, padding: '12px', background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  saveBtn: { flex: 2, padding: '12px', background: 'linear-gradient(135deg, #003399, #0055ff)', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  backBtn: { background: 'none', border: 'none', color: '#003399', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 8 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 26, fontWeight: 800, color: '#003399', marginBottom: 6 },
  sub: { color: '#666', fontSize: 14, maxWidth: 560 },
  addBtn: { padding: '11px 22px', background: 'linear-gradient(135deg, #003399, #0055ff)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
  rolesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 },
  roleIcon: { fontSize: 24, marginBottom: 8 },
  roleTitle: { fontWeight: 800, fontSize: 15, color: '#1a1a2e', marginBottom: 6, fontFamily: 'Montserrat, sans-serif' },
  roleDesc: { fontSize: 13, color: '#555', lineHeight: 1.5 },
  formCard: { background: 'white', borderRadius: 16, padding: '28px', boxShadow: '0 4px 24px rgba(0,51,153,0.1)', border: '1.5px solid #dde4ff', marginBottom: 32 },
  formTitle: { fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: '#003399', marginBottom: 8 },
  formNote: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.5 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { padding: '11px 14px', borderRadius: 8, border: '2px solid #dde4ff', fontSize: 14, color: '#333', background: '#f8faff', outline: 'none' },
  hint: { fontSize: 12, color: '#888', marginTop: 2 },
  saveBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #003399, #0055ff)', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', minWidth: 180 },
  sectionTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#003399', marginBottom: 16 },
  table: { background: 'white', borderRadius: 14, border: '1.5px solid #dde4ff', overflow: 'hidden', marginBottom: 24 },
  thead: { display: 'flex', padding: '12px 20px', background: '#f0f4ff', fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, gap: 12 },
  row: { display: 'flex', padding: '16px 20px', borderTop: '1px solid #f0f4ff', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  adminName: { fontWeight: 700, fontSize: 14, color: '#1a1a2e' },
  adminEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  uid: { fontSize: 11, background: '#f5f5f5', padding: '3px 7px', borderRadius: 5, color: '#555' },
  editBtn: { padding: '7px 14px', background: '#e8f0ff', color: '#003399', border: '1.5px solid #c0ccff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  revokeBtn: { padding: '7px 14px', background: '#fff0f0', color: '#cc2222', border: '1.5px solid #ffcccc', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '40px', color: '#888', fontSize: 15 },
  helpBox: { background: '#fffbe6', border: '1.5px solid #ffe58f', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#7a5c00', lineHeight: 1.6 },
};

export default ManageAdmins;
