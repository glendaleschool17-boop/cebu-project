import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const SLIDES = [
  { img: '/images/dest1.jpg',  label: 'Magellan\'s Cross',     place: 'Cebu City' },
  { img: '/images/dest2.jpg',  label: 'Fort Santiago',          place: 'Manila' },
  { img: '/images/dest3.jpg',  label: 'Boracay Island',         place: 'Aklan' },
  { img: '/images/dest4.jpg',  label: 'Aliwagwag Falls',        place: 'Davao Oriental' },
  { img: '/images/dest5.jpg',  label: 'Gigantes Islands',       place: 'Iloilo' },
  { img: '/images/dest6.jpg',  label: 'The Ruins',              place: 'Bacolod' },
  { img: '/images/dest7.jpg',  label: 'Zamboanga Fort',         place: 'Zamboanga' },
  { img: '/images/dest8.jpg',  label: 'Calaguas Island',        place: 'Camarines Norte' },
  { img: '/images/dest9.jpg',  label: 'Cagsawa Ruins',          place: 'Albay' },
  { img: '/images/dest10.jpg', label: 'Boracay Crystal Cove',   place: 'Aklan' },
  { img: '/images/dest11.jpg', label: 'Puerto Princesa River',  place: 'Palawan' },
];

const FAQS = [
  { q: 'How do I book a flight?', a: 'Select your origin and destination on the home page, choose your travel date, and click "Search Flights". Pick your preferred flight, complete passenger details, and pay via GCash.' },
  { q: 'Can I reschedule my booking?', a: 'Yes! Go to "My Bookings", select the booking you want to change, and click "Reschedule". A rescheduling fee of ₱500 applies per passenger.' },
  { q: 'What payment methods are accepted?', a: 'We currently accept GCash as our primary payment method. Make sure your GCash account has sufficient balance before booking.' },
  { q: 'How do I get my boarding pass?', a: 'After payment is confirmed, your e-ticket and QR boarding pass will be emailed to you. You can also view it anytime under "My Bookings".' },
  { q: 'Is there a baggage allowance?', a: 'Economy class includes 7kg carry-on baggage. Checked baggage (20kg) can be added during booking. Additional baggage can be purchased at the airport.' },
  { q: 'What if my flight is cancelled?', a: 'In case of cancellation, you will be notified via email and offered a full refund or free rebooking to the next available flight.' },
  { q: 'Can I book for other passengers?', a: 'Yes, during the booking process you can enter the passenger details for anyone you are booking on behalf of.' },
  { q: 'How early should I arrive at the airport?', a: 'We recommend arriving at least 2 hours before domestic flights. Check-in counters close 45 minutes before departure.' },
];

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState({ origin: '', destination: '', date: '', returnDate: '' });
  const [tripType, setTripType] = useState('oneway');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fade, setFade] = useState(true);
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // Auto-advance slideshow every 5s
  useEffect(() => {
    document.title = 'Home – Cebu Airline Booking';
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentSlide(prev => (prev + 1) % SLIDES.length);
        setFade(true);
      }, 500);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (i) => {
    setFade(false);
    setTimeout(() => { setCurrentSlide(i); setFade(true); }, 300);
  };

  const cities = [
    { code: 'MNL', name: 'Manila' }, { code: 'CEB', name: 'Cebu' },
    { code: 'DVO', name: 'Davao' }, { code: 'ILO', name: 'Iloilo' },
    { code: 'BCD', name: 'Bacolod' }, { code: 'ZAM', name: 'Zamboanga' },
    { code: 'GEN', name: 'General Santos' }, { code: 'LGP', name: 'Legazpi' },
    { code: 'KLO', name: 'Kalibo' }, { code: 'PPS', name: 'Puerto Princesa' },
  ];

  const handleSwap = () => {
    setSearch(s => ({ ...s, origin: s.destination, destination: s.origin }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.origin && search.destination && search.origin === search.destination) {
      toast.error('Origin and destination cannot be the same. Please select different cities.');
      return;
    }
    if (tripType === 'roundtrip' && !search.returnDate) {
      toast.error('Please select a return date.');
      return;
    }
    const params = new URLSearchParams({ ...search, tripType });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero with Slideshow */}
      <div style={styles.hero}>
        {/* Background image layer */}
        <div style={{
          ...styles.slideBg,
          backgroundImage: `url(${SLIDES[currentSlide].img})`,
          opacity: fade ? 1 : 0,
        }} />
        {/* Dark gradient overlay */}
        <div style={styles.heroOverlay} />

        {/* Main content: two columns */}
        <div style={styles.heroContent}>
          {/* LEFT: headline + tag */}
          <div style={styles.heroLeft}>
            <div style={styles.heroTag}>Welcome to the Philippines' Premier Airline</div>
            <h1 style={styles.heroTitle}>
              Where Do You Want<br />To <span style={styles.heroHighlight}>Fly Today?</span>
            </h1>
            <p style={styles.heroSub}>Book flights across the Philippines with ease. Fast, affordable, and reliable.</p>

            {/* Slide label sits under the subtitle */}
            <div style={{ ...styles.slideLabel, opacity: fade ? 1 : 0 }}>
              <div style={styles.slideName}>📍 {SLIDES[currentSlide].label}</div>
              <div style={styles.slidePlace}>{SLIDES[currentSlide].place}</div>
            </div>

            {/* Dot indicators */}
            <div style={styles.dots}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  style={{
                    ...styles.dot,
                    background: i === currentSlide ? 'white' : 'rgba(255,255,255,0.35)',
                    width: i === currentSlide ? 24 : 8,
                  }}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: search card */}
          <div style={styles.heroRight}>
            <form onSubmit={handleSearch} style={styles.searchCard}>
              <div style={styles.searchCardTitle}>✈️ Book a Flight</div>

              {/* Trip type toggle */}
              <div style={styles.tripToggle}>
                <button type="button"
                  style={{ ...styles.tripBtn, ...(tripType === 'oneway' ? styles.tripBtnActive : {}) }}
                  onClick={() => setTripType('oneway')}>
                  ➡️ One Way
                </button>
                <button type="button"
                  style={{ ...styles.tripBtn, ...(tripType === 'roundtrip' ? styles.tripBtnActive : {}) }}
                  onClick={() => setTripType('roundtrip')}>
                  🔄 Round Trip
                </button>
              </div>

              <div style={styles.searchField}>
                <label style={styles.searchLabel}>🛫 From</label>
                <select style={styles.searchSelect} value={search.origin}
                  onChange={e => setSearch({ ...search, origin: e.target.value })} required>
                  <option value="">Select Origin</option>
                  {cities.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
              </div>

              <div style={{ textAlign: 'center', margin: '2px 0', position: 'relative', zIndex: 1 }}>
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap origin and destination"
                  style={{
                    background: search.origin || search.destination ? '#003399' : '#dde4ff',
                    color: search.origin || search.destination ? 'white' : '#99aadd',
                    border: '2px solid white',
                    borderRadius: '50%',
                    width: 30, height: 30,
                    fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,51,153,0.18)',
                    transition: 'background 0.2s, transform 0.15s',
                    lineHeight: 1,
                    padding: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'rotate(180deg)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'rotate(0deg)'}
                >
                  ⇄
                </button>
              </div>

              <div style={styles.searchField}>
                <label style={styles.searchLabel}>🛬 To</label>
                <select style={styles.searchSelect} value={search.destination}
                  onChange={e => setSearch({ ...search, destination: e.target.value })} required>
                  <option value="">Select Destination</option>
                  {cities.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
              </div>

              <div style={styles.searchField}>
                <label style={styles.searchLabel}>📅 {tripType === 'roundtrip' ? 'Departure' : 'Date'}</label>
                <input type="date" style={styles.searchSelect} value={search.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setSearch({ ...search, date: e.target.value })} required />
              </div>

              {tripType === 'roundtrip' && (
                <div style={styles.searchField}>
                  <label style={styles.searchLabel}>🔄 Return Date</label>
                  <input type="date" style={styles.searchSelect} value={search.returnDate}
                    min={search.date || new Date().toISOString().split('T')[0]}
                    onChange={e => setSearch({ ...search, returnDate: e.target.value })} required />
                </div>
              )}

              <button type="submit" style={styles.searchBtn}>Search Flights ✈️</button>
            </form>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={styles.features}>
        <div className="container">
          <h2 style={styles.sectionTitle}>Why Fly with Cebu Airlines?</h2>
          <div style={styles.featuresGrid}>
            {[
              { icon: '🛡️', title: 'Safe & Reliable', desc: 'Top safety standards with a modern fleet and expert crew.' },
              { icon: '💰', title: 'Best Prices', desc: 'Competitive fares with GCash payment for your convenience.' },
              { icon: '🌏', title: '30+ Destinations', desc: 'Flying to every major city and island destination in the Philippines.' },
              { icon: '📱', title: 'Easy Booking', desc: 'Book in minutes, get instant e-ticket with QR boarding pass.' },
            ].map((f, i) => (
              <div key={i} style={styles.featureCard}>
                <div style={styles.featureIcon}>{f.icon}</div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Routes */}
      <div style={styles.routes}>
        <div className="container">
          <h2 style={styles.sectionTitle}>Popular Routes</h2>
          <div style={styles.routesGrid}>
            {[
              { from: 'MNL', to: 'CEB', price: '₱1,899', time: '1h 15m' },
              { from: 'MNL', to: 'DVO', price: '₱2,299', time: '1h 55m' },
              { from: 'CEB', to: 'ILO', price: '₱1,499', time: '45m' },
              { from: 'MNL', to: 'PPS', price: '₱2,599', time: '1h 20m' },
              { from: 'MNL', to: 'KLO', price: '₱1,799', time: '55m' },
              { from: 'CEB', to: 'DVO', price: '₱1,699', time: '1h 05m' },
            ].map((r, i) => (
              <div key={i} style={styles.routeCard} onClick={() => navigate(`/search?origin=${r.from}&destination=${r.to}`)}>
                <div style={styles.routeRow}>
                  <span style={styles.routeCode}>{r.from}</span>
                  <span style={styles.routeArrow}>✈ ──────</span>
                  <span style={styles.routeCode}>{r.to}</span>
                </div>
                <div style={styles.routeBottom}>
                  <span style={styles.routeTime}>⏱ {r.time}</span>
                  <span style={styles.routePrice}>From {r.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div style={styles.cta}>
          <h2 style={styles.ctaTitle}>Ready to Take Off?</h2>
          <p style={styles.ctaSub}>Create your free account and start booking flights today.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={styles.ctaBtn}>Create Account</button>
            <button onClick={() => navigate('/login')} style={styles.ctaBtnOutline}>Login</button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <div className="container">
          <div style={styles.footerContent}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <img src="/logo.jpg" alt="Cebu Airlines" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
                <div style={styles.footerBrand}>CEBU AIRLINES</div>
              </div>
              <p style={styles.footerText}>Connecting the Philippines, one flight at a time.</p>
            </div>
            <div style={styles.footerLinks}>
              <span style={styles.footerLink}>About Us</span>
              <span style={styles.footerLink}>Contact</span>
              <span style={styles.footerLink}>Privacy Policy</span>
              <span style={styles.footerLink}>Terms of Service</span>
            </div>
          </div>
          <div style={styles.footerBottom}>
            <p>© 2026 Cebu Airlines. All rights reserved. | 📧 support@cebuairlines.com | 📞 (02) 8888-7777</p>
          </div>
        </div>
      </footer>
      {/* FAQ Floating Button + Panel */}
      <div style={styles.faqWidget}>
        {faqOpen && (
          <div style={styles.faqPanel}>
            <div style={styles.faqPanelHeader}>
              <img src="/logo.jpg" alt="Cebu Airlines" style={styles.faqLogo} />
              <div>
                <div style={styles.faqPanelTitle}>FAQ</div>
                <div style={styles.faqPanelSub}>Frequently Asked Questions</div>
              </div>
              <button onClick={() => setFaqOpen(false)} style={styles.faqClose}>✕</button>
            </div>
            <div style={styles.faqList}>
              {FAQS.map((item, i) => (
                <div key={i} style={styles.faqItem}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={styles.faqQuestion}
                  >
                    <span>{item.q}</span>
                    <span style={{ ...styles.faqChevron, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </button>
                  {openFaq === i && (
                    <div style={styles.faqAnswer}>{item.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setFaqOpen(o => !o)} style={styles.faqBtn} title="Frequently Asked Questions">
          <img src="/logo.jpg" alt="Cebu Airlines" style={styles.faqBtnLogo} />
          <span style={styles.faqBtnLabel}>FAQ</span>
        </button>
      </div>
    </div>
  );
};

const styles = {
  hero: {
    minHeight: '85vh',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  slideBg: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transition: 'opacity 0.6s ease-in-out',
    zIndex: 0,
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(0,10,50,0.82) 0%, rgba(0,20,80,0.65) 50%, rgba(0,10,50,0.3) 100%)',
    zIndex: 1,
  },
  slideLabel: {
    position: 'absolute',
    bottom: 100,
    left: 32,
    zIndex: 3,
    transition: 'opacity 0.5s ease',
  },
  slideName: {
    color: 'white',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textShadow: '0 1px 6px rgba(0,0,0,0.6)',
  },
  slidePlace: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 3,
  },
  dots: {
    position: 'absolute',
    bottom: 64,
    left: 32,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    zIndex: 3,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.3s ease',
  },
  heroContent: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '60px 32px',
    position: 'relative',
    zIndex: 2,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 48,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
  },
  heroRight: {
    flexShrink: 0,
    width: 320,
  },
  heroTag: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heroTitle: {
    color: 'white',
    fontSize: 'clamp(32px, 4vw, 58px)',
    fontFamily: 'Montserrat, sans-serif',
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: 18,
    textShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  heroHighlight: {
    background: 'linear-gradient(90deg, #66aaff, #ffffff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    lineHeight: 1.6,
    marginBottom: 32,
    maxWidth: 460,
    textShadow: '0 1px 6px rgba(0,0,0,0.3)',
  },
  slideLabel: {
    marginBottom: 14,
    transition: 'opacity 0.5s ease',
  },
  slideName: {
    color: 'white',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.5,
    textShadow: '0 1px 6px rgba(0,0,0,0.5)',
  },
  slidePlace: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 3,
  },
  dots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.3s ease',
  },
  searchCard: {
    background: 'white',
    borderRadius: 18,
    padding: '24px 22px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#003399',
    fontFamily: 'Montserrat, sans-serif',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tripToggle: {
    display: 'flex', gap: 6, background: '#f0f4ff',
    borderRadius: 10, padding: 4, marginBottom: 4,
  },
  tripBtn: {
    flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: '#888', background: 'none', transition: 'all 0.2s',
  },
  tripBtnActive: {
    background: 'white', color: '#003399',
    boxShadow: '0 2px 8px rgba(0,51,153,0.12)',
  },
  searchField: { display: 'flex', flexDirection: 'column', gap: 5 },
  searchLabel: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  searchSelect: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '2px solid #dde4ff',
    fontSize: 14,
    color: '#333',
    background: '#f8faff',
    outline: 'none',
    width: '100%',
  },
  searchBtn: {
    background: 'linear-gradient(135deg, #003399, #0066ff)',
    color: 'white',
    border: 'none',
    padding: '13px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    width: '100%',
    letterSpacing: 0.5,
  },
  features: { padding: '80px 0', background: 'white' },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 800,
    color: '#003399',
    marginBottom: 48,
    fontFamily: 'Montserrat, sans-serif',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 28,
  },
  featureCard: {
    textAlign: 'center',
    padding: 28,
    borderRadius: 16,
    background: '#f0f4ff',
    transition: 'transform 0.2s',
  },
  featureIcon: { fontSize: 40, marginBottom: 16 },
  featureTitle: { fontWeight: 700, fontSize: 18, color: '#003399', marginBottom: 10 },
  featureDesc: { color: '#666', fontSize: 14, lineHeight: 1.6 },
  routes: { padding: '80px 0', background: '#f0f4ff' },
  routesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  },
  routeCard: {
    background: 'white',
    borderRadius: 12,
    padding: '20px 24px',
    cursor: 'pointer',
    border: '2px solid #e0e8ff',
    transition: 'all 0.2s',
  },
  routeRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  routeCode: { fontSize: 24, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif' },
  routeArrow: { color: '#99aadd', fontSize: 14, flex: 1 },
  routeBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  routeTime: { color: '#888', fontSize: 13 },
  routePrice: { color: '#ff6600', fontWeight: 700, fontSize: 16 },
  cta: {
    background: 'linear-gradient(135deg, #003399, #0055ff)',
    padding: '80px 24px',
    textAlign: 'center',
  },
  ctaTitle: { color: 'white', fontSize: 36, fontWeight: 900, marginBottom: 16, fontFamily: 'Montserrat, sans-serif' },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 18, marginBottom: 32 },
  ctaBtn: {
    background: 'white',
    color: '#003399',
    border: 'none',
    padding: '14px 36px',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  ctaBtnOutline: {
    background: 'transparent',
    color: 'white',
    border: '2px solid rgba(255,255,255,0.6)',
    padding: '14px 36px',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  footer: { background: '#001040', padding: '48px 0 24px' },
  footerContent: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 32 },
  footerBrand: { color: 'white', fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: 2, marginBottom: 12 },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  footerLinks: { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' },
  footerLink: { color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer' },
  footerBottom: { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  // FAQ Widget
  faqWidget: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 12,
  },
  faqPanel: {
    width: 360,
    maxHeight: 520,
    background: 'white',
    borderRadius: 20,
    boxShadow: '0 16px 60px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1.5px solid #dde4ff',
  },
  faqPanelHeader: {
    background: 'linear-gradient(135deg, #003399, #0055ff)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  faqLogo: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.5)',
    flexShrink: 0,
  },
  faqPanelTitle: {
    color: 'white',
    fontWeight: 800,
    fontSize: 15,
    fontFamily: 'Montserrat, sans-serif',
    letterSpacing: 1,
  },
  faqPanelSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 1,
  },
  faqClose: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.18)',
    border: 'none',
    color: 'white',
    borderRadius: '50%',
    width: 28,
    height: 28,
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  faqList: {
    overflowY: 'auto',
    flex: 1,
    padding: '8px 0',
  },
  faqItem: {
    borderBottom: '1px solid #f0f4ff',
  },
  faqQuestion: {
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '13px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 13.5,
    fontWeight: 600,
    color: '#003399',
    lineHeight: 1.4,
  },
  faqChevron: {
    fontSize: 16,
    color: '#0055ff',
    flexShrink: 0,
    transition: 'transform 0.25s ease',
    display: 'inline-block',
  },
  faqAnswer: {
    padding: '0 16px 14px',
    fontSize: 13,
    color: '#555',
    lineHeight: 1.6,
    background: '#f8faff',
  },
  faqBtn: {
    background: 'linear-gradient(135deg, #003399, #0055ff)',
    border: 'none',
    borderRadius: 50,
    padding: '10px 20px 10px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 6px 24px rgba(0,51,153,0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  faqBtnLogo: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.6)',
  },
  faqBtnLabel: {
    color: 'white',
    fontWeight: 800,
    fontSize: 14,
    fontFamily: 'Montserrat, sans-serif',
    letterSpacing: 1,
  },
};

export default Home;
