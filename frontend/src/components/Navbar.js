import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, userProfile, logout, isAdmin, isSuperAdmin, adminCity } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isGateAgent = userProfile?.role === 'gate_agent';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    toast.info('Logged out successfully');
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // Derive display name: use profile name, or extract from email
  const displayName = userProfile?.name && userProfile.name !== 'User'
    ? userProfile.name
    : user?.email?.split('@')[0] || 'Account';

  const displayInitial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="no-print" style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.brand}>
          <img src="/logo.jpg" alt="Cebu Airlines" style={styles.logoImg} />
        </Link>

        <div style={styles.links}>
          {!isAdmin && !isGateAgent && (
            <Link to="/" style={{ ...styles.link, ...(isActive('/') ? styles.activeLink : {}) }}>Home</Link>
          )}
          {user && !isAdmin && !isGateAgent && (
            <>
              <Link to="/search" style={{ ...styles.link, ...(isActive('/search') ? styles.activeLink : {}) }}>Search Flights</Link>
              <Link to="/my-bookings" style={{ ...styles.link, ...(isActive('/my-bookings') ? styles.activeLink : {}) }}>My Bookings</Link>
              <Link to="/contact" style={{ ...styles.link, ...(isActive('/contact') ? styles.activeLink : {}) }}>Contact</Link>
            </>
          )}
          {isGateAgent && (
            <Link to="/gate-agent" style={{ ...styles.link, ...(isActive('/gate-agent') ? styles.activeLink : {}), color: isActive('/gate-agent') ? 'white' : 'rgba(255,220,100,0.95)' }}>
              🛂 Gate Scanner
            </Link>
          )}
          {isAdmin && (
            <>
              <Link to="/admin" style={{ ...styles.link, ...(isActive('/admin') ? styles.activeLink : {}) }}>Dashboard</Link>
              <Link to="/admin/bookings" style={{ ...styles.link, ...(isActive('/admin/bookings') ? styles.activeLink : {}) }}>Bookings</Link>
              <Link to="/admin/flights" style={{ ...styles.link, ...(isActive('/admin/flights') ? styles.activeLink : {}) }}>Flights</Link>
              <Link to="/admin/reports" style={{ ...styles.link, ...(isActive('/admin/reports') ? styles.activeLink : {}) }}>Reports</Link>
              {isSuperAdmin && (
                <Link to="/admin/manage-admins" style={{ ...styles.link, ...(isActive('/admin/manage-admins') ? styles.activeLink : {}), color: isActive('/admin/manage-admins') ? 'white' : 'rgba(220,180,255,0.9)' }}>Admins</Link>
              )}
              {adminCity && (
                <span style={styles.cityPill}>📍 {adminCity}</span>
              )}
            </>
          )}
        </div>

        <div style={styles.authArea}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificationBell />
              <div style={styles.dropdownWrapper} ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{ ...styles.triggerBtn, background: dropdownOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)' }}
              >
                <div style={styles.avatar}>{displayInitial}</div>
                <div style={styles.triggerInfo}>
                  <span style={styles.triggerName}>{displayName.split(' ')[0]}</span>
                  {isAdmin && <span style={styles.adminBadge}>ADMIN</span>}
                </div>
                <span style={{ ...styles.chevron, transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>

              {dropdownOpen && (
                <div style={styles.dropdown}>
                  {/* Header */}
                  <div style={styles.dropdownHeader}>
                    <div style={styles.dropdownAvatar}>{displayInitial}</div>
                    <div>
                      <div style={styles.dropdownName}>{displayName}</div>
                      <div style={styles.dropdownEmail}>{userProfile?.email || user.email}</div>
                      {isAdmin
                        ? isSuperAdmin
                          ? <span style={styles.roleBadge('#7700cc')}>⭐ SUPER ADMIN</span>
                          : <span style={styles.roleBadge('#003399')}>📍 {adminCity} ADMIN</span>
                        : isGateAgent
                        ? <span style={styles.roleBadge('#cc6600')}>🛂 GATE AGENT</span>
                        : <span style={styles.roleBadge('#003399')}>PASSENGER</span>
                      }
                    </div>
                  </div>

                  <div style={styles.divider} />

                  {/* Passenger items */}
                  {!isAdmin && !isGateAgent && (
                    <>
                      <DropItem icon="👤" label="My Account" onClick={() => { navigate('/my-account'); setDropdownOpen(false); }} />
                      <DropItem icon="🎫" label="My Bookings" onClick={() => { navigate('/my-bookings'); setDropdownOpen(false); }} />
                      <DropItem icon="✈️" label="Search Flights" onClick={() => { navigate('/search'); setDropdownOpen(false); }} />
                    </>
                  )}

                  {/* Gate Agent items */}
                  {isGateAgent && (
                    <DropItem icon="🛂" label="Gate Scanner" onClick={() => { navigate('/gate-agent'); setDropdownOpen(false); }} />
                  )}

                  {/* Admin items */}
                  {isAdmin && (
                    <>
                      <DropItem icon="📊" label="Dashboard" onClick={() => { navigate('/admin'); setDropdownOpen(false); }} />
                      <DropItem icon="📋" label="Manage Bookings" onClick={() => { navigate('/admin/bookings'); setDropdownOpen(false); }} />
                      <DropItem icon="✈️" label="Manage Flights" onClick={() => { navigate('/admin/flights'); setDropdownOpen(false); }} />
                      <DropItem icon="📊" label="Reports" onClick={() => { navigate('/admin/reports'); setDropdownOpen(false); }} />
                      {isSuperAdmin && (
                        <DropItem icon="👥" label="Manage Admins" onClick={() => { navigate('/admin/manage-admins'); setDropdownOpen(false); }} />
                      )}
                    </>
                  )}

                  <div style={styles.divider} />

                  {/* Logout */}
                  <button
                    style={styles.logoutItem}
                    onClick={handleLogout}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff0f0'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={styles.itemIcon}>🚪</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div style={styles.authBtns}>
              <Link to="/login" style={styles.loginBtn}>Login</Link>
              <Link to="/register" style={styles.registerBtn}>Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// Reusable dropdown item
const DropItem = ({ icon, label, onClick }) => (
  <button
    style={styles.dropItem}
    onClick={onClick}
    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
    onMouseLeave={e => e.currentTarget.style.background = 'none'}
  >
    <span style={styles.itemIcon}>{icon}</span>
    {label}
  </button>
);

const styles = {
  nav: {
    background: 'linear-gradient(135deg, #001f66 0%, #003399 60%, #0044cc 100%)',
    boxShadow: '0 4px 20px rgba(0,31,102,0.4)',
    position: 'sticky', top: 0, zIndex: 200,
  },
  container: {
    maxWidth: 1200, margin: '0 auto', padding: '0 24px',
    display: 'flex', alignItems: 'center', height: 68, gap: 32,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 },
  logoImg: { height: 48, width: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' },
  links: { display: 'flex', alignItems: 'center', gap: 4, flex: 1 },
  link: { color: 'rgba(255,255,255,0.8)', textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500 },
  activeLink: { color: 'white', background: 'rgba(255,255,255,0.15)' },
  authArea: { flexShrink: 0, position: 'relative' },
  authBtns: { display: 'flex', gap: 12, alignItems: 'center' },
  loginBtn: { color: 'white', textDecoration: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.5)' },
  registerBtn: { color: '#003399', textDecoration: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'white' },
  dropdownWrapper: { position: 'relative' },
  triggerBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 10,
    padding: '7px 12px 7px 8px', cursor: 'pointer', transition: 'all 0.2s',
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0055ff, #00aaff)',
    border: '2px solid rgba(255,255,255,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0,
  },
  triggerInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  triggerName: { color: 'white', fontSize: 14, fontWeight: 600 },
  cityPill: {
    background: 'rgba(255,255,255,0.18)',
    color: 'white',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 20,
    letterSpacing: 0.5,
    border: '1px solid rgba(255,255,255,0.3)',
  },
  adminBadge: { background: '#ff6600', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8, letterSpacing: 1 },
  chevron: { color: 'rgba(255,255,255,0.7)', fontSize: 14, transition: 'transform 0.2s' },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
    background: 'white', borderRadius: 14,
    boxShadow: '0 12px 48px rgba(0,31,102,0.22)',
    border: '1px solid #dde4ff', minWidth: 256, overflow: 'hidden', zIndex: 999,
  },
  dropdownHeader: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
    background: 'linear-gradient(135deg, #f0f4ff, #e8eeff)',
  },
  dropdownAvatar: {
    width: 46, height: 46, borderRadius: '50%',
    background: 'linear-gradient(135deg, #003399, #0066ff)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 800, fontSize: 18, flexShrink: 0,
  },
  dropdownName: { fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 },
  dropdownEmail: { fontSize: 12, color: '#888', marginBottom: 4 },
  roleBadge: (color) => ({
    display: 'inline-block', background: color, color: 'white',
    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8, letterSpacing: 1,
  }),
  divider: { height: 1, background: '#eef0ff', margin: '4px 0' },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, color: '#333', textAlign: 'left',
    fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
  },
  logoutItem: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: '#cc2222', textAlign: 'left',
    fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
  },
  itemIcon: { fontSize: 16, width: 22, textAlign: 'center' },
};

export default Navbar;
