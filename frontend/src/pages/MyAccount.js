import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';

const MyAccount = () => {
  useEffect(() => {
    document.title = 'My Account – Cebu Airline';
  }, []);

  const { user, userProfile, setUserProfile, changePassword } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: userProfile?.name || '',
    phone: userProfile?.phone || '',
  });

  // Change password state
  const [changingPw, setChangingPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  const displayName = userProfile?.name && userProfile.name !== 'User'
    ? userProfile.name
    : user?.email?.split('@')[0] || 'Account';

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      // Update local state
      window.location.reload(); // simple refresh to reload context
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const handleChangePassword = async () => {
    if (!pwForm.current) return toast.error('Please enter your current password.');
    if (pwForm.newPw.length < 6) return toast.error('New password must be at least 6 characters.');
    if (pwForm.newPw !== pwForm.confirm) return toast.error('New passwords do not match.');
    if (pwForm.current === pwForm.newPw) return toast.error('New password must be different from your current password.');
    setSavingPw(true);
    try {
      await changePassword(pwForm.current, pwForm.newPw);
      toast.success('Password changed successfully! 🔒');
      setChangingPw(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please wait a moment and try again.');
      } else {
        toast.error(err.message || 'Failed to change password.');
      }
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div style={styles.page}>
      <div className="container" style={{ maxWidth: 720 }}>

        {/* Page Header */}
        <div style={styles.header}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>
          <h1 style={styles.title}>My Account</h1>
        </div>

        {/* Profile Card */}
        <div style={styles.profileCard}>
          <div style={styles.avatarSection}>
            <div style={styles.bigAvatar}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={styles.profileName}>{displayName}</div>
              <div style={styles.profileEmail}>{userProfile?.email || user?.email}</div>
              <span style={styles.rolePill}>
                {userProfile?.role === 'admin' ? '👨‍💼 Administrator' : '✈️ Passenger'}
              </span>
            </div>
          </div>

          <div style={styles.memberSince}>
            Member since {memberSince}
          </div>
        </div>

        {/* Info Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Personal Information</h2>
            {!editing && (
              <button onClick={() => setEditing(true)} style={styles.editBtn}>
                ✏️ Edit
              </button>
            )}
          </div>

          {!editing ? (
            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Full Name</div>
                <div style={styles.infoValue}>{displayName}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Email Address</div>
                <div style={styles.infoValue}>{userProfile?.email || user?.email}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Phone Number</div>
                <div style={styles.infoValue}>{userProfile?.phone || '—'}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Account Role</div>
                <div style={styles.infoValue}>{userProfile?.role === 'admin' ? 'Administrator' : 'Passenger'}</div>
              </div>
            </div>
          ) : (
            <div style={styles.editForm}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+63 912 345 6789"
                />
              </div>
              <div style={styles.editActions}>
                <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 28px' }}>
                  {saving ? 'Saving...' : '✓ Save Changes'}
                </button>
                <button
                  onClick={() => { setEditing(false); setForm({ name: userProfile?.name || '', phone: userProfile?.phone || '' }); }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Change Password Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>🔒 Change Password</h2>
            {!changingPw && (
              <button onClick={() => setChangingPw(true)} style={styles.editBtn}>
                Change
              </button>
            )}
          </div>

          {!changingPw ? (
            <div style={styles.pwHint}>
              <span style={styles.pwDots}>••••••••</span>
              <span style={styles.pwSub}>Update your account password anytime</span>
            </div>
          ) : (
            <div>
              {/* Current Password */}
              <div className="form-group">
                <label>Current Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    type={showPw.current ? 'text' : 'password'}
                    className="input-field"
                    value={pwForm.current}
                    onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                    placeholder="Enter current password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>
                    {showPw.current ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="form-group">
                <label>New Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    type={showPw.newPw ? 'text' : 'password'}
                    className="input-field"
                    value={pwForm.newPw}
                    onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    placeholder="Min. 6 characters"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw({ ...showPw, newPw: !showPw.newPw })}>
                    {showPw.newPw ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Password strength indicator */}
                {pwForm.newPw.length > 0 && (
                  <div style={styles.strengthBar}>
                    <div style={{
                      ...styles.strengthFill,
                      width: pwForm.newPw.length >= 10 ? '100%' : pwForm.newPw.length >= 8 ? '66%' : pwForm.newPw.length >= 6 ? '33%' : '10%',
                      background: pwForm.newPw.length >= 10 ? '#00aa55' : pwForm.newPw.length >= 8 ? '#ffc107' : '#cc2222',
                    }} />
                    <span style={styles.strengthLabel}>
                      {pwForm.newPw.length >= 10 ? '💪 Strong' : pwForm.newPw.length >= 8 ? '👍 Good' : pwForm.newPw.length >= 6 ? '⚠️ Weak' : '❌ Too short'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label>Confirm New Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    type={showPw.confirm ? 'text' : 'password'}
                    className="input-field"
                    value={pwForm.confirm}
                    onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                    placeholder="Repeat new password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>
                    {showPw.confirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Match indicator */}
                {pwForm.confirm.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: pwForm.newPw === pwForm.confirm ? '#00aa55' : '#cc2222', fontWeight: 600 }}>
                    {pwForm.newPw === pwForm.confirm ? '✅ Passwords match' : '❌ Passwords do not match'}
                  </div>
                )}
              </div>

              <div style={styles.editActions}>
                <button
                  className="btn-primary"
                  onClick={handleChangePassword}
                  disabled={savingPw}
                  style={{ padding: '10px 28px' }}
                >
                  {savingPw ? '⏳ Saving...' : '🔒 Update Password'}
                </button>
                <button
                  onClick={() => { setChangingPw(false); setPwForm({ current: '', newPw: '', confirm: '' }); }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="card">
          <h2 style={styles.cardTitle}>Quick Links</h2>
          <div style={styles.quickLinks}>
            <button style={styles.quickLink} onClick={() => navigate('/my-bookings')}>
              <span style={styles.qlIcon}>🎫</span>
              <div>
                <div style={styles.qlTitle}>My Bookings</div>
                <div style={styles.qlSub}>View all your flight bookings</div>
              </div>
              <span style={styles.qlArrow}>→</span>
            </button>
            <button style={styles.quickLink} onClick={() => navigate('/search')}>
              <span style={styles.qlIcon}>✈️</span>
              <div>
                <div style={styles.qlTitle}>Search Flights</div>
                <div style={styles.qlSub}>Find and book a new flight</div>
              </div>
              <span style={styles.qlArrow}>→</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  page: { padding: '32px 0 60px', minHeight: '80vh' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  backBtn: { background: 'none', border: 'none', color: '#003399', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399' },
  profileCard: {
    background: 'linear-gradient(135deg, #001f66, #003399)',
    borderRadius: 20,
    padding: '28px 32px',
    marginBottom: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  avatarSection: { display: 'flex', alignItems: 'center', gap: 20 },
  bigAvatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0055ff, #00aaff)',
    border: '3px solid rgba(255,255,255,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 900, fontSize: 30,
    flexShrink: 0,
  },
  profileName: { color: 'white', fontSize: 22, fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: 4 },
  profileEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 10 },
  rolePill: {
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 14px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.25)',
  },
  memberSince: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#003399' },
  editBtn: {
    background: '#e8eeff', color: '#003399', border: 'none',
    padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  infoGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
  },
  infoItem: {
    background: '#f8faff', borderRadius: 10, padding: '14px 18px',
  },
  infoLabel: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  infoValue: { fontSize: 15, fontWeight: 600, color: '#1a1a2e' },
  editForm: {},
  editActions: { display: 'flex', gap: 12, marginTop: 8 },
  cancelBtn: {
    background: 'none', border: '2px solid #dde4ff', color: '#666',
    padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  quickLinks: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
  quickLink: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: '#f8faff', border: '1px solid #dde4ff', borderRadius: 12,
    padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.2s',
    width: '100%',
  },
  qlIcon: { fontSize: 28, flexShrink: 0 },
  qlTitle: { fontWeight: 700, fontSize: 15, color: '#003399', marginBottom: 2 },
  qlSub: { fontSize: 13, color: '#888' },
  qlArrow: { marginLeft: 'auto', color: '#99aadd', fontSize: 20 },
  // Change password
  pwHint: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: '#f8faff', borderRadius: 10 },
  pwDots: { fontSize: 20, color: '#888', letterSpacing: 3 },
  pwSub: { fontSize: 13, color: '#888' },
  pwInputWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
  },
  strengthBar: { marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 },
  strengthFill: { height: 4, borderRadius: 4, transition: 'all 0.3s', flex: 1 },
  strengthLabel: { fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
};

export default MyAccount;
