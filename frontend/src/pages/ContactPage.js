import { useEffect } from 'react';

const ContactPage = () => {
  useEffect(() => {
    document.title = 'Contact Us – Cebu Airline';
  }, []);

  return (
    <div style={S.page}>
      <div className="container" style={{ maxWidth: 780 }}>

        {/* Hero */}
        <div style={S.hero}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
          <h1 style={S.heroTitle}>Contact & Support</h1>
          <p style={S.heroSub}>We're here to help you fly with confidence. Reach out anytime.</p>
        </div>

        {/* Contact Cards */}
        <div style={S.cardGrid}>
          <div style={S.contactCard}>
            <div style={S.iconCircle('#e8f5e9', '#007744')}>📞</div>
            <div style={S.contactLabel}>Customer Hotline</div>
            <div style={S.contactMain}>(032) 888-5678</div>
            <div style={S.contactSub}>Mon–Fri, 8:00 AM – 8:00 PM</div>
            <div style={S.contactSub}>Sat–Sun, 9:00 AM – 5:00 PM</div>
            <div style={S.demoBadge}>📋 Demo number</div>
          </div>

          <div style={S.contactCard}>
            <div style={S.iconCircle('#e8eeff', '#003399')}>✉️</div>
            <div style={S.contactLabel}>Email Support</div>
            <div style={S.contactMain}>support@cebuairlines.demo</div>
            <div style={S.contactSub}>We respond within 24–48 hours</div>
            <div style={S.contactSub}>For bookings, refunds & complaints</div>
            <div style={S.demoBadge}>📋 Demo email</div>
          </div>

          <div style={S.contactCard}>
            <div style={S.iconCircle('#fff8e1', '#cc7700')}>💬</div>
            <div style={S.contactLabel}>Live Chat</div>
            <div style={S.contactMain}>Chat with an Agent</div>
            <div style={S.contactSub}>Available during business hours</div>
            <div style={S.contactSub}>Average wait time: ~3 minutes</div>
            <div style={S.demoBadge}>📋 Demo feature</div>
          </div>
        </div>

        {/* Send a Message */}
        <div style={S.messageCard}>
          <div style={S.sectionTitle}>📝 Send Us a Message</div>
          <p style={S.sectionSub}>
            For general inquiries, flight issues, or feedback — fill out the form below and our team will get back to you.
          </p>

          <div style={S.formGrid}>
            <div style={S.formGroup}>
              <label style={S.label}>Full Name</label>
              <input style={S.input} placeholder="Your full name" readOnly defaultValue="" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Email Address</label>
              <input style={S.input} placeholder="your@email.com" readOnly defaultValue="" />
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Subject</label>
            <select style={S.input} disabled>
              <option>Booking Issue</option>
              <option>Refund Request</option>
              <option>Flight Information</option>
              <option>Baggage Concern</option>
              <option>General Inquiry</option>
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Message</label>
            <textarea style={{ ...S.input, resize: 'vertical', minHeight: 100 }} placeholder="Describe your concern in detail…" readOnly />
          </div>

          <div style={S.demoNotice}>
            🛈 This form is for demo purposes only. Submissions are not processed.
          </div>

          <button style={S.submitBtn} disabled>
            Send Message 📨
          </button>
        </div>

        {/* FAQ Section */}
        <div style={S.faqCard}>
          <div style={S.sectionTitle}>❓ Frequently Asked Questions</div>
          {[
            {
              q: 'How do I cancel my booking?',
              a: 'Go to My Bookings, find the booking you want to cancel, and click "Request Cancellation". Refunds are processed within 5–7 business days depending on your fare type.'
            },
            {
              q: 'Can I reschedule my flight?',
              a: 'Yes! You can reschedule up to 24 hours before departure. A reschedule fee may apply based on how soon your flight is. Go to My Bookings and click "Reschedule".'
            },
            {
              q: 'How does GCash payment work?',
              a: 'After booking, you\'ll be shown a GCash QR code and account number. Send the payment, upload a screenshot as proof, and wait for admin approval. Confirmation emails are sent automatically.'
            },
            {
              q: 'Where is my e-ticket or boarding pass?',
              a: 'Your e-ticket is emailed after payment is approved. You can also view and download it anytime from My Bookings. Boarding passes are available 24 hours before departure.'
            },
            {
              q: 'What is the baggage allowance?',
              a: 'Economy class includes 7 kg carry-on and 20 kg check-in. Business class includes 10 kg carry-on and 32 kg check-in. Excess baggage fees apply at ₱120/kg.'
            },
          ].map((item, i) => (
            <div key={i} style={S.faqItem}>
              <div style={S.faqQ}>Q: {item.q}</div>
              <div style={S.faqA}>A: {item.a}</div>
            </div>
          ))}
        </div>

        {/* Office Info */}
        <div style={S.officeCard}>
          <div style={S.sectionTitle}>🏢 Our Main Office</div>
          <div style={S.officeGrid}>
            <div>
              <div style={S.officeRow}><strong>Address:</strong> 2F Mactan–Cebu International Airport, Lapu-Lapu City, Cebu 6015</div>
              <div style={S.officeRow}><strong>Office Hours:</strong> Monday–Friday, 8:00 AM – 6:00 PM</div>
              <div style={S.officeRow}><strong>Airport Desk:</strong> Open daily, 4:00 AM – 10:00 PM</div>
              <div style={{ ...S.demoBadge, marginTop: 12 }}>📋 Demo address for display purposes</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const S = {
  page: { padding: '32px 0 60px', minHeight: '80vh', background: '#f4f7ff' },

  hero: {
    textAlign: 'center', background: 'linear-gradient(135deg, #001f66, #003399)',
    borderRadius: 20, padding: '44px 24px', marginBottom: 28, color: 'white',
  },
  heroTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 32, fontWeight: 900, margin: '0 0 10px', color: 'white' },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.8)', margin: 0 },

  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 },
  contactCard: {
    background: 'white', borderRadius: 16, padding: '24px 20px',
    textAlign: 'center', boxShadow: '0 4px 20px rgba(0,51,153,0.07)',
    border: '1px solid #dde4ff',
  },
  iconCircle: (bg, color) => ({
    width: 56, height: 56, borderRadius: '50%',
    background: bg, color, fontSize: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  }),
  contactLabel: { fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  contactMain: { fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 6, fontFamily: 'Montserrat, sans-serif' },
  contactSub: { fontSize: 12, color: '#888', marginBottom: 3 },
  demoBadge: {
    display: 'inline-block', marginTop: 10,
    background: '#fff8e1', color: '#856404',
    borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
  },

  messageCard: {
    background: 'white', borderRadius: 16, padding: '28px', marginBottom: 20,
    boxShadow: '0 4px 20px rgba(0,51,153,0.07)', border: '1px solid #dde4ff',
  },
  sectionTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 17, fontWeight: 800, color: '#003399', marginBottom: 8 },
  sectionSub: { color: '#666', fontSize: 14, marginBottom: 20 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '2px solid #dde4ff', borderRadius: 10,
    boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
    background: '#f8faff', color: '#888', outline: 'none',
  },
  demoNotice: {
    background: '#fff8e1', border: '1px solid #ffd54f',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#856404',
    marginBottom: 16,
  },
  submitBtn: {
    background: '#aabbdd', color: 'white', border: 'none',
    borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700,
    cursor: 'not-allowed', opacity: 0.7,
  },

  faqCard: {
    background: 'white', borderRadius: 16, padding: '28px', marginBottom: 20,
    boxShadow: '0 4px 20px rgba(0,51,153,0.07)', border: '1px solid #dde4ff',
  },
  faqItem: { borderBottom: '1px solid #eef0ff', padding: '14px 0' },
  faqQ: { fontWeight: 700, color: '#003399', fontSize: 14, marginBottom: 6 },
  faqA: { color: '#555', fontSize: 14, lineHeight: 1.6 },

  officeCard: {
    background: 'white', borderRadius: 16, padding: '28px',
    boxShadow: '0 4px 20px rgba(0,51,153,0.07)', border: '1px solid #dde4ff',
  },
  officeGrid: { marginTop: 12 },
  officeRow: { fontSize: 14, color: '#555', marginBottom: 8 },
};

export default ContactPage;
