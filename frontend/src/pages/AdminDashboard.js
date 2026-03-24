import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const CITY_NAMES = {
  MNL: 'Manila', CEB: 'Cebu', DVO: 'Davao', ILO: 'Iloilo',
  BCD: 'Bacolod', ZAM: 'Zamboanga', GEN: 'General Santos',
  LGP: 'Legazpi', KLO: 'Kalibo', PPS: 'Puerto Princesa',
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isSuperAdmin, adminCity, userProfile } = useAuth();

  useEffect(() => {
    document.title = 'Admin Dashboard – Cebu Airline';
    api.get('/admin/stats').then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Total Bookings', value: stats.total, icon: '📋', color: '#003399', bg: '#e8eeff' },
    { label: 'Confirmed', value: stats.confirmed, icon: '✅', color: '#007744', bg: '#e6fff3' },
    { label: 'Pending Review', value: stats.pending, icon: '⏳', color: '#cc8800', bg: '#fff8e1' },
    { label: 'Cancel Requests', value: stats.cancellationRequested || 0, icon: '🔄', color: '#cc5500', bg: '#fff0e0' },
    { label: 'Reschedule Requests', value: stats.rescheduleRequested || 0, icon: '✈️', color: '#0044cc', bg: '#e8f0ff' },
    { label: 'Total Revenue (incl. VAT)', value: `₱${(stats.revenue || 0).toLocaleString()}`, icon: '💰', color: '#ff6600', bg: '#fff3e8' },
    { label: 'Active Flights', value: stats.activeFlights, icon: '🛫', color: '#0055cc', bg: '#e8f4ff' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: '#cc2222', bg: '#ffe8e8' },
  ] : [];

  const cityLabel = adminCity ? (CITY_NAMES[adminCity] || adminCity) : null;

  const baseActions = [
    { icon: '📋', title: 'Manage Bookings', desc: `Review, approve, and reject payment submissions${cityLabel ? ` for ${cityLabel}` : ''}`, path: '/admin/bookings', color: '#003399' },
    { icon: '✈️', title: 'Manage Flights', desc: 'Add, edit, and update flight schedules', path: '/admin/flights', color: '#0055cc' },
    { icon: '💳', title: 'GCash Setup', desc: 'Upload and manage the GCash QR code for passenger payments', path: '/admin/gcash', color: '#00aa55' },
    { icon: '📊', title: 'Booking Reports', desc: `Generate and print filtered booking reports${cityLabel ? ` for ${cityLabel}` : ''}`, path: '/admin/reports', color: '#ff6600' },
  ];

  const superAdminActions = isSuperAdmin ? [
    { icon: '👥', title: 'Manage Regional Admins', desc: 'Assign admin access and city scope to users', path: '/admin/manage-admins', color: '#7700cc' },
  ] : [];

  const actionCards = [...baseActions, ...superAdminActions];

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container">
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Admin Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <p style={styles.sub}>Welcome back, {userProfile?.name || 'Administrator'}</p>
              {isSuperAdmin ? (
                <span style={badge('#7700cc', '#f3e8ff')}>⭐ Super Admin</span>
              ) : (
                <span style={badge('#003399', '#e8eeff')}>📍 {cityLabel || adminCity} Regional Admin</span>
              )}
            </div>
            {!isSuperAdmin && cityLabel && (
              <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                Showing bookings where <strong>{cityLabel}</strong> is the origin or destination
              </p>
            )}
          </div>
          <div style={styles.quickActions}>
            {isSuperAdmin && (
              <button onClick={() => navigate('/admin/manage-admins')} style={styles.manageBtn}>
                👥 Manage Admins
              </button>
            )}
            <button onClick={() => navigate('/admin/flights')} className="btn-primary" style={{ padding: '10px 20px' }}>
              + Add Flight
            </button>
          </div>
        </div>

        {loading ? <div className="spinner" /> : (
          <>
            <div style={styles.statsGrid}>
              {statCards.map((s, i) => (
                <div key={i} style={{ ...styles.statCard, background: s.bg }}>
                  <div style={styles.statIcon}>{s.icon}</div>
                  <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
                  <div style={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={styles.actions}>
              <h2 style={styles.sectionTitle}>Quick Actions</h2>
              <div style={styles.actionCards}>
                {actionCards.map((action, i) => (
                  <div key={i} style={styles.actionCard} onClick={() => navigate(action.path)}>
                    <div style={{ ...styles.actionIcon, background: action.color + '15', color: action.color }}>
                      {action.icon}
                    </div>
                    <div style={styles.actionText}>
                      <div style={{ ...styles.actionTitle, color: action.color }}>{action.title}</div>
                      <div style={styles.actionDesc}>{action.desc}</div>
                    </div>
                    <div style={styles.actionArrow}>→</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const badge = (color, bg) => ({
  display: 'inline-block', background: bg, color: color,
  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.3,
});

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, flexWrap: 'wrap', gap: 16 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399', marginBottom: 4 },
  sub: { color: '#888', fontSize: 15, margin: 0 },
  quickActions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  manageBtn: {
    padding: '10px 18px', background: '#f3e8ff', color: '#7700cc',
    border: '2px solid #ddb8ff', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20, marginBottom: 40 },
  statCard: { borderRadius: 16, padding: '24px 20px', textAlign: 'center' },
  statIcon: { fontSize: 32, marginBottom: 12 },
  statValue: { fontSize: 32, fontWeight: 900, fontFamily: 'Montserrat, sans-serif', marginBottom: 6 },
  statLabel: { fontSize: 13, color: '#888', fontWeight: 600 },
  actions: {},
  sectionTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 800, color: '#003399', marginBottom: 20 },
  actionCards: { display: 'flex', flexDirection: 'column', gap: 14 },
  actionCard: {
    display: 'flex', alignItems: 'center', gap: 20, background: 'white',
    borderRadius: 12, padding: '20px 24px', cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,51,153,0.08)', border: '1px solid #dde4ff', transition: 'all 0.2s',
  },
  actionIcon: { width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  actionText: { flex: 1 },
  actionTitle: { fontWeight: 700, fontSize: 16, marginBottom: 4, fontFamily: 'Montserrat, sans-serif' },
  actionDesc: { color: '#888', fontSize: 13 },
  actionArrow: { color: '#99aadd', fontSize: 20, fontWeight: 300 },
};

export default AdminDashboard;
