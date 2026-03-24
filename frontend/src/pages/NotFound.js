import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const NotFound = () => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % 200), 40);
    return () => clearInterval(t);
  }, []);

  // Plane flies left → right then resets
  const progress = tick / 200;
  const planeX = progress * 110 - 5; // -5% to 105%
  const planeY = Math.sin(progress * Math.PI * 3) * 18;

  return (
    <div style={S.page}>
      <style>{`
        @keyframes floatCloud {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-120vw); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes runwayScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,204,68,0.4); }
          50%       { box-shadow: 0 0 0 14px rgba(255,204,68,0); }
        }
        .nf-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,204,68,0.45) !important; }
        .nf-btn-secondary:hover { background: rgba(255,255,255,0.18) !important; }
        .nf-btn-ghost:hover { color: white !important; }
      `}</style>

      {/* Sky gradient */}
      <div style={S.sky} />

      {/* Clouds */}
      <div style={{ ...S.cloud, width: 160, top: '10%', animationDuration: '28s', animationDelay: '0s' }} />
      <div style={{ ...S.cloud, width: 110, top: '20%', animationDuration: '22s', animationDelay: '-8s', opacity: 0.35 }} />
      <div style={{ ...S.cloud, width: 80,  top: '38%', animationDuration: '34s', animationDelay: '-14s', opacity: 0.2 }} />
      <div style={{ ...S.cloud, width: 130, top: '55%', animationDuration: '26s', animationDelay: '-5s', opacity: 0.25 }} />

      {/* Animated plane */}
      <div style={{
        position: 'absolute',
        left: `${planeX}%`,
        top: `calc(22% + ${planeY}px)`,
        fontSize: 34,
        filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.35))',
        zIndex: 10,
        pointerEvents: 'none',
        transition: 'top 0.04s linear',
      }}>✈️</div>

      {/* Main content card */}
      <div style={S.card}>
        {/* 404 display */}
        <div style={S.errorCode}>
          <span style={S.digit}>4</span>
          <div style={S.zeroWrap}>
            <div style={S.zeroCircle}>
              <span style={{ fontSize: 38 }}>🗺️</span>
            </div>
          </div>
          <span style={S.digit}>4</span>
        </div>

        <h1 style={S.title}>Route Not Found</h1>
        <p style={S.subtitle}>
          This page flew off the radar.<br />
          The URL you entered doesn't exist on our network.
        </p>

        <div style={S.divider} />

        <div style={S.actions}>
          <button
            className="nf-btn-primary"
            onClick={() => navigate('/')}
            style={S.btnPrimary}
          >
            🏠 Return to Home
          </button>
          <button
            className="nf-btn-secondary"
            onClick={() => navigate('/search')}
            style={S.btnSecondary}
          >
            ✈️ Search Flights
          </button>
          <button
            className="nf-btn-ghost"
            onClick={() => navigate(-1)}
            style={S.btnGhost}
          >
            ← Go Back
          </button>
        </div>

        <div style={S.errorTag}>ERROR 404 · PAGE NOT FOUND</div>
      </div>

      {/* Runway at bottom */}
      <div style={S.runway}>
        <div style={S.runwayStripe} />
        <div style={S.runwayTrack}>
          <div style={S.runwayDashWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={S.runwayDash} />
            ))}
          </div>
        </div>
        <div style={S.runwayStripe} />
      </div>
    </div>
  );
};

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 90,
    background: '#0a1628',
  },
  sky: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, #0a0e2a 0%, #0d2060 30%, #0a3a8a 60%, #1a5aaa 80%, #2a6abf 100%)',
  },
  cloud: {
    position: 'absolute',
    height: 44,
    right: '-20%',
    borderRadius: 44,
    background: 'rgba(255,255,255,0.14)',
    backdropFilter: 'blur(3px)',
    animation: 'floatCloud linear infinite',
    animationFillMode: 'both',
  },
  card: {
    position: 'relative',
    zIndex: 20,
    textAlign: 'center',
    padding: '52px 52px 44px',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 28,
    border: '1.5px solid rgba(255,255,255,0.13)',
    boxShadow: '0 32px 100px rgba(0,0,10,0.5)',
    maxWidth: 500,
    width: '90%',
    marginTop: 30,
    animation: 'fadeUp 0.6s ease both',
  },
  errorCode: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 28,
  },
  digit: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 'clamp(72px, 14vw, 110px)',
    fontWeight: 900,
    color: 'white',
    lineHeight: 1,
    textShadow: '0 4px 32px rgba(0,0,0,0.4)',
    letterSpacing: -2,
  },
  zeroWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zeroCircle: {
    width: 'clamp(64px, 11vw, 96px)',
    height: 'clamp(64px, 11vw, 96px)',
    borderRadius: '50%',
    background: 'rgba(255,204,68,0.12)',
    border: '3px solid rgba(255,204,68,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulseGlow 2.5s ease-in-out infinite',
  },
  title: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 'clamp(18px, 3.5vw, 24px)',
    fontWeight: 800,
    color: 'white',
    margin: '0 0 12px',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 1.7,
    margin: '0 0 28px',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.12)',
    margin: '0 0 28px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #ffcc44, #ff9900)',
    color: '#1a0a00',
    border: 'none',
    padding: '14px 36px',
    borderRadius: 50,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
    boxShadow: '0 4px 20px rgba(255,153,0,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    fontFamily: 'Montserrat, sans-serif',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    border: '1.5px solid rgba(255,255,255,0.25)',
    padding: '13px 36px',
    borderRadius: 50,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
    transition: 'background 0.15s',
    fontFamily: 'Montserrat, sans-serif',
  },
  btnGhost: {
    background: 'none',
    color: 'rgba(255,255,255,0.45)',
    border: 'none',
    padding: '8px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.15s',
    fontFamily: 'Montserrat, sans-serif',
  },
  errorTag: {
    marginTop: 28,
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 700,
    fontFamily: 'Montserrat, sans-serif',
  },
  // Runway
  runway: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    background: '#0d1117',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  runwayStripe: {
    height: 5,
    background: '#f59e0b',
    flexShrink: 0,
  },
  runwayTrack: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  },
  runwayDashWrap: {
    display: 'flex',
    gap: 28,
    animation: 'runwayScroll 3s linear infinite',
    width: '200%',
  },
  runwayDash: {
    width: 44,
    height: 5,
    background: 'rgba(255,255,255,0.65)',
    borderRadius: 2,
    flexShrink: 0,
  },
};

export default NotFound;
