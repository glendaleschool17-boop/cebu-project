import { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Must match the backend constant
const ADMIN_SENTINEL = 'ADMINS';

const NotificationBell = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);

  const unread = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Real-time listener — reads from the correct subcollection path
  useEffect(() => {
    if (!user) return;

    // Admins listen to /users/ADMINS/notifications
    // Passengers listen to /users/{uid}/notifications
    const bucketUid = isAdmin ? ADMIN_SENTINEL : user.uid;

    const q = query(
      collection(db, 'users', bucketUid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setNotifications(items);
      },
      (err) => {
        console.warn('Notification listener error:', err.message);
      }
    );

    return () => unsub();
  }, [user, isAdmin]);

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.read);
    if (!unreadItems.length) return;
    const bucketUid = isAdmin ? ADMIN_SENTINEL : user.uid;
    await Promise.all(
      unreadItems.map(n =>
        updateDoc(
          doc(db, 'users', bucketUid, 'notifications', n.id),
          { read: true }
        ).catch(() => {})
      )
    );
  };

  const handleNotifClick = async (notif) => {
    const bucketUid = isAdmin ? ADMIN_SENTINEL : user.uid;
    // Mark as read on click
    updateDoc(
      doc(db, 'users', bucketUid, 'notifications', notif.id),
      { read: true }
    ).catch(() => {});
    setOpen(false);
    navigate(notif.link || (isAdmin ? '/admin/bookings' : '/my-bookings'));
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  if (!user) return null;

  return (
    <div style={S.wrapper} ref={bellRef}>
      {/* Bell button */}
      <button
        style={{ ...S.bellBtn, background: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)' }}
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={S.badge}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={S.panel}>
          {/* Header */}
          <div style={S.panelHeader}>
            <div>
              <div style={S.panelTitle}>Notifications</div>
              <div style={S.panelSub}>{notifications.length} total · {unread} unread</div>
            </div>
            {unread > 0 && (
              <button style={S.markAllBtn} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={S.list}>
            {notifications.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>No notifications</div>
                <div style={{ fontSize: 13, color: '#999' }}>You're all caught up!</div>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  style={{
                    ...S.notifItem,
                    background: notif.read ? 'white' : '#f0f4ff',
                    borderLeft: `4px solid ${notif.read ? '#eee' : (notif.color || '#003399')}`,
                  }}
                  onClick={() => handleNotifClick(notif)}
                  onMouseEnter={e => e.currentTarget.style.background = '#e8eeff'}
                  onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'white' : '#f0f4ff'}
                >
                  <div style={{
                    ...S.notifIcon,
                    background: (notif.color || '#003399') + '22',
                    color: notif.color || '#003399',
                  }}>
                    {notif.icon || '✈️'}
                  </div>
                  <div style={S.notifBody}>
                    <div style={S.notifTitle}>{notif.title}</div>
                    <div style={S.notifMsg}>{notif.message}</div>
                    <div style={S.notifTime}>{formatTime(notif.createdAt)}</div>
                  </div>
                  {!notif.read && <div style={S.unreadDot} />}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={S.panelFooter}>
              <button
                style={S.viewAllBtn}
                onClick={() => {
                  setOpen(false);
                  navigate(isAdmin ? '/admin/bookings' : '/my-bookings');
                }}
              >
                View all bookings →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const S = {
  wrapper: { position: 'relative' },
  bellBtn: {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 42, height: 42, borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', transition: 'all 0.2s',
  },
  badge: {
    position: 'absolute', top: -6, right: -6,
    background: '#ef4444', color: 'white',
    fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
    borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid #003399', padding: '0 4px',
  },
  panel: {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
    background: 'white', borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,31,102,0.22)',
    border: '1px solid #dde4ff',
    width: 340, zIndex: 999, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '16px 18px',
    background: 'linear-gradient(135deg, #f0f4ff, #e8eeff)',
    borderBottom: '1px solid #dde4ff',
  },
  panelTitle: { fontSize: 15, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' },
  panelSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  markAllBtn: {
    background: 'none', border: 'none', color: '#003399',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
  },
  list: { maxHeight: 360, overflowY: 'auto' },
  empty: { padding: '40px 20px', textAlign: 'center' },
  notifItem: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    width: '100%', padding: '14px 16px',
    border: 'none', borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer', textAlign: 'left', position: 'relative',
    transition: 'background 0.15s',
  },
  notifIcon: {
    width: 38, height: 38, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  notifBody:  { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 3 },
  notifMsg:   { fontSize: 12, color: '#666', lineHeight: 1.4, marginBottom: 4 },
  notifTime:  { fontSize: 11, color: '#aaa' },
  unreadDot:  {
    width: 8, height: 8, borderRadius: '50%',
    background: '#003399', flexShrink: 0, marginTop: 4,
  },
  panelFooter: {
    padding: '12px 18px', borderTop: '1px solid #eef0ff', textAlign: 'center',
  },
  viewAllBtn: {
    background: 'none', border: 'none', color: '#003399',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

export default NotificationBell;
