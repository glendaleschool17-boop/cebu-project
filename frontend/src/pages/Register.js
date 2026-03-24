import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const firebaseError = (code) => {
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists. Try logging in instead.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password is too weak. Please use at least 6 characters.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
  };
  return map[code] || 'Registration failed. Please try again.';
};

const Register = () => {
  useEffect(() => {
    document.title = 'Create Account – Cebu Airline';
  }, []);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw]           = useState({ password: false, confirmPassword: false });
  const [loading, setLoading]         = useState(false);
  const [registered, setRegistered]   = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [errors, setErrors]           = useState({});
  const [touched, setTouched]         = useState({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError]   = useState(false);

  const { register, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirect already-logged-in users away from register page
  useEffect(() => {
    if (user) {
      navigate(isAdmin ? '/admin' : '/', { replace: true });
    }
  }, [user, isAdmin, navigate]);

  // ── Validators ──────────────────────────────────────────────────
  const validators = {
    name: (v) => {
      if (!v.trim()) return 'Full name is required.';
      if (v.trim().length < 2) return 'Name must be at least 2 characters.';
      if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]+$/.test(v.trim())) return 'Name can only contain letters, spaces, hyphens, and apostrophes.';
      return '';
    },
    email: (v) => {
      if (!v.trim()) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address.';
      return '';
    },
    phone: (v) => {
      if (!v.trim()) return 'Phone number is required.';
      const digits = v.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) return 'Please enter a valid Philippine phone number (e.g. 09171234567).';
      if (!/^(\+?63|0)\d{10}$/.test(v.trim().replace(/\s/g, ''))) return 'Phone must start with 09 or +63 followed by 10 digits.';
      return '';
    },
    password: (v) => {
      if (!v) return 'Password is required.';
      if (v.length < 6) return 'Password must be at least 6 characters.';
      if (v.length < 8) return 'Tip: Use at least 8 characters for a stronger password.'; // soft warning (still valid)
      return '';
    },
    confirmPassword: (v, pw) => {
      if (!v) return 'Please confirm your password.';
      if (v !== pw) return 'Passwords do not match.';
      return '';
    },
  };

  // Is it a blocking error (not just a tip)?
  const isBlockingError = (field, msg) => {
    if (field === 'password' && msg.startsWith('Tip:')) return false;
    return !!msg;
  };

  const validateAll = () => {
    const e = {
      name:            validators.name(form.name),
      email:           validators.email(form.email),
      phone:           validators.phone(form.phone),
      password:        validators.password(form.password),
      confirmPassword: validators.confirmPassword(form.confirmPassword, form.password),
    };
    setErrors(e);
    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true });
    return !Object.entries(e).some(([k, v]) => isBlockingError(k, v));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (touched[name]) {
      const err = name === 'confirmPassword'
        ? validators.confirmPassword(value, updated.password)
        : validators[name]?.(value) ?? '';
      setErrors(prev => ({ ...prev, [name]: err }));
      // Also re-validate confirmPassword when password changes
      if (name === 'password' && touched.confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: validators.confirmPassword(updated.confirmPassword, value) }));
      }
    }
  };

  const handleBlur = (field) => {
    setTouched(t => ({ ...t, [field]: true }));
    const err = field === 'confirmPassword'
      ? validators.confirmPassword(form.confirmPassword, form.password)
      : validators[field]?.(form[field]) ?? '';
    setErrors(e => ({ ...e, [field]: err }));
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validateAll()) return;
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setLoading(true);
    try {
      await register(form.email, form.password, form.name.trim(), form.phone.trim());
      setRegisteredEmail(form.email);
      setRegistered(true);
    } catch (err) {
      const msg = firebaseError(err.code);
      if (err.code === 'auth/email-already-in-use') {
        setErrors(e => ({ ...e, email: msg }));
        setTouched(t => ({ ...t, email: true }));
      } else {
        setErrors(e => ({ ...e, form: msg }));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password strength ────────────────────────────────────────────
  const pwStrength = (pw) => {
    if (!pw) return null;
    const hasUpper = /[A-Z]/.test(pw);
    const hasNum   = /\d/.test(pw);
    const hasSpec  = /[^a-zA-Z0-9]/.test(pw);
    const score    = (pw.length >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
    if (pw.length < 6) return { label: '❌ Too short', color: '#cc2222', width: '15%' };
    if (score <= 1)    return { label: '⚠️ Weak',      color: '#ff6600', width: '33%' };
    if (score === 2)   return { label: '👍 Fair',      color: '#ffc107', width: '55%' };
    if (score === 3)   return { label: '✅ Good',      color: '#00aa55', width: '78%' };
    return               { label: '💪 Strong',         color: '#006633', width: '100%' };
  };

  const strength = pwStrength(form.password);

  // ── Input style helper ───────────────────────────────────────────
  const inputStyle = (field) => {
    const hasErr = touched[field] && errors[field] && isBlockingError(field, errors[field]);
    const isOk   = touched[field] && !errors[field] && form[field];
    return {
      ...styles.input,
      borderColor: hasErr ? '#cc2222' : isOk ? '#00aa55' : '#dde4ff',
      background:  hasErr ? '#fff5f5' : isOk ? '#f0fff6' : 'white',
    };
  };

  // ── Verification screen ──────────────────────────────────────────
  if (registered) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 460, textAlign: 'center' }}>
          <img src="/logo.jpg" alt="Cebu Airlines" style={{ ...styles.logoImg, marginBottom: 16 }} />
          <h1 style={styles.title}>CEBU AIRLINES</h1>
          <div style={{ fontSize: 56, margin: '20px 0 12px' }}>📧</div>
          <h2 style={styles.successTitle}>Check your inbox!</h2>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 12 }}>We sent a verification link to:</p>
          <div style={styles.emailPill}>{registeredEmail}</div>
          <p style={{ color: '#555', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Click the link in that email to verify your account.
            You <strong>must verify your email</strong> before you can log in.
          </p>
          <div style={styles.warningBox}>
            ⚠️ Don't see it? Check your <strong>Spam</strong> or <strong>Junk</strong> folder.
            The link expires in <strong>24 hours</strong>.
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/login')}
            style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 8 }}
          >
            ✅ I've verified — Go to Login
          </button>
          <p style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
            Wrong email?{' '}
            <button
              onClick={() => setRegistered(false)}
              style={{ color: '#003399', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              Register again
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.header}>
          <img src="/logo.jpg" alt="Cebu Airlines" style={styles.logoImg} />
          <h1 style={styles.title}>CEBU AIRLINES</h1>
          <p style={styles.sub}>Create your account</p>
        </div>

        {errors.form && (
          <div style={styles.formError}>⚠️ {errors.form}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Full Name */}
          <div style={styles.group}>
            <label style={styles.label}>Full Name <span style={styles.req}>*</span></label>
            <input
              name="name" type="text"
              value={form.name}
              onChange={handleChange}
              onBlur={() => handleBlur('name')}
              placeholder="Juan Dela Cruz"
              style={inputStyle('name')}
              autoComplete="name"
            />
            {touched.name && errors.name && isBlockingError('name', errors.name) && (
              <div style={styles.fieldError}>⚠ {errors.name}</div>
            )}
            {touched.name && !errors.name && form.name && (
              <div style={styles.fieldOk}>✓ Looks good!</div>
            )}
          </div>

          {/* Email */}
          <div style={styles.group}>
            <label style={styles.label}>Email Address <span style={styles.req}>*</span></label>
            <input
              name="email" type="email"
              value={form.email}
              onChange={handleChange}
              onBlur={() => handleBlur('email')}
              placeholder="your@email.com"
              style={inputStyle('email')}
              autoComplete="email"
            />
            {touched.email && errors.email && isBlockingError('email', errors.email) && (
              <div style={styles.fieldError}>⚠ {errors.email}</div>
            )}
            {touched.email && !errors.email && form.email && (
              <div style={styles.fieldOk}>✓ Valid email address</div>
            )}
          </div>

          {/* Phone */}
          <div style={styles.group}>
            <label style={styles.label}>Phone Number <span style={styles.req}>*</span></label>
            <input
              name="phone" type="tel"
              value={form.phone}
              onChange={handleChange}
              onBlur={() => handleBlur('phone')}
              placeholder="09171234567 or +639171234567"
              style={inputStyle('phone')}
              autoComplete="tel"
            />
            {touched.phone && errors.phone && isBlockingError('phone', errors.phone) && (
              <div style={styles.fieldError}>⚠ {errors.phone}</div>
            )}
            {touched.phone && !errors.phone && form.phone && (
              <div style={styles.fieldOk}>✓ Valid phone number</div>
            )}
          </div>

          {/* Password */}
          <div style={styles.group}>
            <label style={styles.label}>Password <span style={styles.req}>*</span></label>
            <div style={styles.pwWrap}>
              <input
                name="password"
                type={showPw.password ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                onBlur={() => handleBlur('password')}
                placeholder="Min. 6 characters"
                style={{ ...inputStyle('password'), paddingRight: 44 }}
                autoComplete="new-password"
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(p => ({ ...p, password: !p.password }))}>
                {showPw.password ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Strength bar */}
            {form.password && strength && (
              <div style={styles.strengthRow}>
                <div style={styles.strengthTrack}>
                  <div style={{ ...styles.strengthFill, width: strength.width, background: strength.color }} />
                </div>
                <span style={{ ...styles.strengthLabel, color: strength.color }}>{strength.label}</span>
              </div>
            )}
            {touched.password && errors.password && (
              <div style={isBlockingError('password', errors.password) ? styles.fieldError : styles.fieldTip}>
                {isBlockingError('password', errors.password) ? '⚠' : 'ℹ'} {errors.password}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={styles.group}>
            <label style={styles.label}>Confirm Password <span style={styles.req}>*</span></label>
            <div style={styles.pwWrap}>
              <input
                name="confirmPassword"
                type={showPw.confirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={handleChange}
                onBlur={() => handleBlur('confirmPassword')}
                placeholder="Repeat your password"
                style={{ ...inputStyle('confirmPassword'), paddingRight: 44 }}
                autoComplete="new-password"
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(p => ({ ...p, confirmPassword: !p.confirmPassword }))}>
                {showPw.confirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <div style={styles.fieldError}>⚠ {errors.confirmPassword}</div>
            )}
            {touched.confirmPassword && !errors.confirmPassword && form.confirmPassword && (
              <div style={styles.fieldOk}>✓ Passwords match</div>
            )}
          </div>

          {/* Terms & Privacy Policy */}
          <div style={{
            background: termsError ? '#fff5f5' : '#f8faff',
            border: `1.5px solid ${termsError ? '#ffaaaa' : '#dde4ff'}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => { setAgreedToTerms(e.target.checked); setTermsError(false); }}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: '#003399', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
                I have read and agree to the{' '}
                <span style={{ color: '#003399', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                  Terms of Service
                </span>
                {' '}and{' '}
                <span style={{ color: '#003399', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                  Privacy Policy
                </span>
                . I consent to Cebu Airlines collecting and processing my personal data in accordance with{' '}
                <strong>RA 10173 (Data Privacy Act of 2012)</strong>.
              </span>
            </label>
            {termsError && (
              <div style={{ fontSize: 12, color: '#cc2222', fontWeight: 600, marginTop: 8, marginLeft: 30 }}>
                ⚠ You must agree to the Terms of Service and Privacy Policy to create an account.
              </div>
            )}
          </div>

          <button
            type="submit"
            style={{ ...styles.submitBtn, opacity: loading ? 0.75 : 1 }}
            disabled={loading}
          >
            {loading ? '⏳ Creating account…' : 'Create Account ✈️'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.footerLink}>Sign in here</Link>
        </p>
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
    width: '100%', maxWidth: 460,
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
  fieldError: { marginTop: 6, fontSize: 12, fontWeight: 600, color: '#cc2222' },
  fieldOk:    { marginTop: 6, fontSize: 12, fontWeight: 600, color: '#00aa55' },
  fieldTip:   { marginTop: 6, fontSize: 12, fontWeight: 600, color: '#cc8800' },
  formError: {
    background: '#fff0f0', border: '1.5px solid #ffaaaa',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color: '#cc2222', fontWeight: 600, marginBottom: 20,
  },
  pwWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
  },
  strengthRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack: { flex: 1, height: 5, background: '#eee', borderRadius: 4, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s, background 0.3s' },
  strengthLabel: { fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', minWidth: 80 },
  submitBtn: {
    width: '100%', padding: 14, fontSize: 16, fontWeight: 700,
    background: 'linear-gradient(135deg, #003399, #0055cc)',
    color: 'white', border: 'none', borderRadius: 10,
    cursor: 'pointer', marginTop: 4,
  },
  footer: { textAlign: 'center', color: '#888', fontSize: 14, marginTop: 20 },
  footerLink: { color: '#003399', fontWeight: 600 },
  // Verification screen
  successTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 800, color: '#003399', marginBottom: 12 },
  emailPill: {
    display: 'inline-block',
    background: '#f0f4ff', border: '1.5px solid #99aadd',
    borderRadius: 20, padding: '8px 20px',
    fontSize: 15, fontWeight: 700, color: '#003399', marginBottom: 16,
  },
  warningBox: {
    background: '#fff8e1', border: '1.5px solid #ffc107',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color: '#856404', marginBottom: 24, lineHeight: 1.5,
    textAlign: 'left',
  },
};

export default Register;
