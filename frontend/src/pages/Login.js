import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Map Firebase error codes → friendly messages
const firebaseError = (code) => {
  const map = {
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-disabled':          'This account has been disabled. Contact support.',
    'auth/too-many-requests':      'Too many failed attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return map[code] || 'Login failed. Please check your credentials and try again.';
};

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending]   = useState(false);
  const [errors, setErrors]     = useState({});
  const [touched, setTouched]   = useState({});
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    document.title = 'Sign In – Cebu Airline';
    if (sessionStorage.getItem('sessionExpired')) {
      setSessionExpired(true);
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  const { login, resendVerificationEmail, user, isAdmin, userProfile } = useAuth();
  const navigate = useNavigate();

  // Redirect already-logged-in users away from the login page
  useEffect(() => {
    if (user) {
      const role = userProfile?.role;
      if (isAdmin) navigate('/admin', { replace: true });
      else if (role === 'gate_agent') navigate('/gate-agent', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [user, isAdmin, userProfile, navigate]);

  const validateEmail = (val) => {
    if (!val.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (val) => {
    if (!val) return 'Password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters.';
    return '';
  };

  const validate = () => {
    const e = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(e);
    setTouched({ email: true, password: true });
    return !e.email && !e.password;
  };

  const handleBlur = (field) => {
    setTouched(t => ({ ...t, [field]: true }));
    if (field === 'email')    setErrors(e => ({ ...e, email: validateEmail(email) }));
    if (field === 'password') setErrors(e => ({ ...e, password: validatePassword(password) }));
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    if (touched.email) setErrors(e => ({ ...e, email: validateEmail(val) }));
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (touched.password) setErrors(e => ({ ...e, password: validatePassword(val) }));
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setUnverified(false);
    try {
      const { role } = await login(email, password);
      toast.success('Welcome back! ✈️');
      if (role === 'admin') navigate('/admin', { replace: true });
      else if (role === 'gate_agent') navigate('/gate-agent', { replace: true });
      else navigate('/', { replace: true });
    } catch (err) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
      } else {
        const msg = firebaseError(err.code);
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) {
          setErrors({ email: ' ', password: msg });
        } else if (err.code === 'auth/invalid-email') {
          setErrors(e => ({ ...e, email: msg }));
        } else {
          setErrors(e => ({ ...e, form: msg }));
        }
        setTouched({ email: true, password: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success('Verification email resent! Check your inbox.');
    } catch {
      toast.error('Could not resend email. Please try logging in again first.');
    } finally {
      setResending(false);
    }
  };

  const inputStyle = (field) => ({
    ...styles.input,
    borderColor: touched[field] && errors[field]?.trim() ? '#cc2222' : '#dde4ff',
    background:  touched[field] && errors[field]?.trim() ? '#fff5f5' : 'white',
  });

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.header}>
          <img src="/logo.jpg" alt="Cebu Airlines" style={styles.logoImg} />
          <h1 style={styles.title}>CEBU AIRLINES</h1>
          <p style={styles.sub}>Sign in to your account</p>
        </div>

        {/* Session expired banner */}
        {sessionExpired && (
          <div style={styles.sessionBanner}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>🔒</div>
            <div>
              <div style={{ fontWeight: 800, color: '#7a0000', fontSize: 14, marginBottom: 3 }}>Session Expired</div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                Your session has expired. Please log in again to continue.
              </div>
            </div>
          </div>
        )}

        {unverified && (
          <div style={styles.verifyBanner}>
            <div style={styles.verifyIcon}>📧</div>
            <div style={{ flex: 1 }}>
              <div style={styles.verifyTitle}>Email Verification Required</div>
              <div style={styles.verifyText}>
                Your email address hasn't been verified yet. Please check your inbox (and spam folder) for the verification link.
              </div>
              <button onClick={handleResend} disabled={resending} style={styles.resendBtn}>
                {resending ? '⏳ Sending…' : '↺ Resend Verification Email'}
              </button>
              <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
                Already verified? <span style={{ color: '#003399', fontWeight: 600, cursor: 'pointer' }} onClick={() => window.location.reload()}>Refresh the page</span>
              </div>
            </div>
          </div>
        )}

        {errors.form && (
          <div style={styles.formError}>⚠️ {errors.form}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div style={styles.group}>
            <label style={styles.label}>Email Address <span style={styles.req}>*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="your@email.com"
              style={inputStyle('email')}
              autoComplete="email"
            />
            {touched.email && errors.email?.trim() && (
              <div style={styles.fieldError}>⚠ {errors.email}</div>
            )}
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Password <span style={styles.req}>*</span></label>
            <div style={styles.pwWrap}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                style={{ ...inputStyle('password'), paddingRight: 44 }}
                autoComplete="current-password"
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {touched.password && errors.password?.trim() && (
              <div style={styles.fieldError}>⚠ {errors.password}</div>
            )}
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
            </div>
          </div>

          <button
            type="submit"
            style={{ ...styles.submitBtn, opacity: loading ? 0.75 : 1 }}
            disabled={loading}
          >
            {loading ? '⏳ Signing in…' : 'Sign In ✈️'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={styles.footerLink}>Create one here</Link>
        </p>

        <div style={styles.demo}>
          <p style={styles.demoTitle}>Demo Accounts</p>
          <div style={styles.demoRow}>
            <div>👨‍💼 <strong>Admin:</strong> admin@cebuairlines.com / admin123</div>
            <div>✈️ <strong>User:</strong> user@cebuairlines.com / user1234</div>
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #001040 0%, #003399 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: 'white', borderRadius: 20, padding: 44,
    width: '100%', maxWidth: 440,
    boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
  },
  header: { textAlign: 'center', marginBottom: 32 },
  logoImg: { width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 },
  title: { fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 22, color: '#003399', letterSpacing: 2, marginBottom: 6 },
  sub: { color: '#888', fontSize: 15 },
  group: { marginBottom: 20 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 7 },
  req: { color: '#cc2222' },
  input: {
    width: '100%', padding: '11px 14px', fontSize: 14,
    border: '2px solid #dde4ff', borderRadius: 10,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, background 0.2s',
  },
  fieldError: {
    marginTop: 6, fontSize: 12, fontWeight: 600, color: '#cc2222',
  },
  formError: {
    background: '#fff0f0', border: '1.5px solid #ffaaaa',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color: '#cc2222', fontWeight: 600,
    marginBottom: 20,
  },
  pwWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
  },
  forgotLink: { fontSize: 13, color: '#003399', fontWeight: 600 },
  submitBtn: {
    width: '100%', padding: 14, fontSize: 16, fontWeight: 700,
    background: 'linear-gradient(135deg, #003399, #0055cc)',
    color: 'white', border: 'none', borderRadius: 10,
    cursor: 'pointer', marginTop: 4,
  },
  footer: { textAlign: 'center', color: '#888', fontSize: 14, margin: '20px 0' },
  footerLink: { color: '#003399', fontWeight: 600 },
  demo: { background: '#f0f4ff', borderRadius: 10, padding: 16 },
  demoTitle: { fontWeight: 700, color: '#003399', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  demoRow: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#555' },
  verifyBanner: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: '#fffbea', border: '2px solid #f59e0b',
    borderRadius: 12, padding: '18px 20px', marginBottom: 24,
    boxShadow: '0 2px 12px rgba(245,158,11,0.15)',
  },
  sessionBanner: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: '#fff0f0', border: '2px solid #ffaaaa',
    borderRadius: 12, padding: '16px 18px', marginBottom: 24,
  },
  verifyIcon: { fontSize: 36, flexShrink: 0, marginTop: 2 },
  verifyTitle: { fontWeight: 800, color: '#92400e', fontSize: 15, marginBottom: 6 },
  verifyText: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 12 },
  resendBtn: {
    background: 'linear-gradient(135deg, #003399, #0055cc)',
    color: 'white', border: 'none',
    borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', width: '100%', letterSpacing: 0.3,
  },
};

export default Login;
