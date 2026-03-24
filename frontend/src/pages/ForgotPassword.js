import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your email address.');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        toast.error('No account found with that email address.');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address.');
      } else {
        toast.error(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>✈️</div>
          <h1 style={styles.title}>CEBU AIRLINES</h1>
          <p style={styles.sub}>Reset your password</p>
        </div>

        {sent ? (
          /* ── Success State ── */
          <div style={styles.successBox}>
            <div style={styles.successIcon}>📧</div>
            <h2 style={styles.successTitle}>Check your email</h2>
            <p style={styles.successText}>
              We sent a password reset link to:
            </p>
            <div style={styles.emailPill}>{email}</div>
            <p style={styles.successHint}>
              Click the link in that email to create a new password.
              The link expires in <strong>1 hour</strong>.
            </p>
            <div style={styles.successNote}>
              ⚠️ Don't see it? Check your <strong>Spam</strong> or <strong>Junk</strong> folder.
            </div>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              style={styles.resendBtn}
            >
              ↩ Try a different email
            </button>
            <Link to="/login" style={styles.backLink}>← Back to Sign In</Link>
          </div>
        ) : (
          /* ── Form State ── */
          <>
            <p style={styles.desc}>
              Enter the email address linked to your account and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 8 }}
                disabled={loading}
              >
                {loading ? '⏳ Sending...' : '📧 Send Reset Link'}
              </button>
            </form>

            <div style={styles.footer}>
              <Link to="/login" style={styles.backLink}>← Back to Sign In</Link>
              <span style={styles.dot}>·</span>
              <Link to="/register" style={styles.backLink}>Create account</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #001040 0%, #003399 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: 'white',
    borderRadius: 20,
    padding: 44,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
  },
  header: { textAlign: 'center', marginBottom: 28 },
  logo: { fontSize: 48, marginBottom: 12 },
  title: {
    fontFamily: 'Montserrat, sans-serif',
    fontWeight: 900, fontSize: 22, color: '#003399',
    letterSpacing: 2, marginBottom: 8,
  },
  sub: { color: '#888', fontSize: 15 },
  desc: { color: '#555', fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 28 },
  form: { marginBottom: 24 },
  footer: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 },
  backLink: { color: '#003399', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  dot: { color: '#ccc' },

  // Success state
  successBox: { textAlign: 'center' },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 22, fontWeight: 800, color: '#003399', marginBottom: 12,
  },
  successText: { color: '#555', fontSize: 14, marginBottom: 12 },
  emailPill: {
    display: 'inline-block',
    background: '#f0f4ff', border: '1.5px solid #99aadd',
    borderRadius: 20, padding: '8px 20px',
    fontSize: 15, fontWeight: 700, color: '#003399',
    marginBottom: 16,
  },
  successHint: { color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 16 },
  successNote: {
    background: '#fff8e1', border: '1.5px solid #ffc107',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color: '#856404',
    marginBottom: 24, lineHeight: 1.5,
  },
  resendBtn: {
    width: '100%', padding: '12px',
    background: 'white', color: '#003399',
    border: '2px solid #dde4ff', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    marginBottom: 16,
  },
};

export default ForgotPassword;
