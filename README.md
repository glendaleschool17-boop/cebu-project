# ✈️ Cebu Airlines – Flight Booking System

A complete, production-ready airline booking system with GCash payment integration, email confirmations, and printable boarding passes.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Context API, React Router v6 |
| Backend | Node.js, Express.js |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Email | Nodemailer (SMTP) |
| QR Code | `qrcode` npm package (server-side) |
| Payment | GCash (Manual QR Upload) |
| Ticket Print | Browser Print API (`window.print()`) |
| Hosting | Firebase Hosting (Frontend) + Node.js Server (Backend) |

---

## 📁 Project Structure

```
cebu-airlines/
├── frontend/                  # React App
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   │   ├── Navbar.js
│   │   │   ├── ProtectedRoute.js
│   │   │   ├── SeatSelector.js
│   │   │   └── StatusBadge.js
│   │   ├── context/
│   │   │   └── AuthContext.js # Firebase Auth + Context API
│   │   ├── pages/
│   │   │   ├── Home.js
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── FlightSearch.js
│   │   │   ├── BookingPage.js  # Seat selection
│   │   │   ├── PaymentPage.js  # GCash upload
│   │   │   ├── MyBookings.js
│   │   │   ├── TicketPage.js   # Printable boarding pass
│   │   │   ├── AdminDashboard.js
│   │   │   ├── AdminBookings.js
│   │   │   ├── AdminFlights.js
│   │   │   └── AdminReports.js
│   │   ├── utils/
│   │   │   └── api.js          # Fetch wrapper with auth
│   │   └── styles/
│   │       └── global.css
│   ├── .env.example
│   └── package.json
│
├── backend/                   # Express API Server
│   ├── config/
│   │   └── firebase.js        # Firebase Admin SDK
│   ├── middleware/
│   │   └── auth.js            # Token verification
│   ├── routes/
│   │   ├── flights.js         # /api/flights
│   │   ├── bookings.js        # /api/bookings
│   │   ├── payments.js        # /api/payments
│   │   ├── admin.js           # /api/admin
│   │   ├── tickets.js         # /api/ticket
│   │   └── reports.js         # /api/reports
│   ├── services/
│   │   ├── emailService.js    # Nodemailer HTML email
│   │   └── qrService.js       # QR code generation
│   ├── uploads/               # Uploaded files (auto-created)
│   ├── seed.js                # Database seed script
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── firebase.json
├── firestore.rules
└── README.md
```

---

## ⚙️ Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Email/Password sign-in
4. Enable **Firestore Database** (start in test mode, then apply the rules)
5. Go to Project Settings → Service Accounts → Generate new private key
6. Download the JSON file (you'll need the values for backend .env)

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in all Firebase Admin SDK credentials from your JSON file
# Fill in SMTP credentials (Gmail recommended with App Password)

npm install

# Optional: Seed the database with sample data
node seed.js

npm run dev   # Development
npm start     # Production
```

**Gmail SMTP Setup:**
1. Enable 2FA on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Generate an app password for "Mail"
4. Use that as `SMTP_PASS` in your .env

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in Firebase Web SDK config from Firebase Console → Project Settings → Web App

npm install
npm start     # Development (runs on :3000)
npm run build # Production build
```

**Get Firebase Web Config:**
1. Firebase Console → Project Settings → Your Apps
2. Add a web app if not already added
3. Copy the config object values to `.env`

### 4. Apply Firestore Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 5. Deploy Frontend to Firebase Hosting

```bash
# In project root
firebase deploy --only hosting
```

---

## 🔑 Sample Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@cebuairlines.com | admin123 |
| **Passenger** | user@cebuairlines.com | user1234 |

> Create these by running: `node backend/seed.js`

---

## 🛣️ API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/flights` | Public | Search flights |
| GET | `/api/flights/:id` | Public | Flight details |
| POST | `/api/flights` | Admin | Create flight |
| PUT | `/api/flights/:id` | Admin | Update flight |
| POST | `/api/bookings` | User | Create booking |
| GET | `/api/bookings/my` | User | User's bookings |
| GET | `/api/bookings/:id` | User/Admin | Booking details |
| PUT | `/api/bookings/:id/cancel` | User | Cancel booking |
| POST | `/api/payments/upload-proof` | User | Upload GCash proof |
| POST | `/api/payments/upload-gcash-qr` | Admin | Upload GCash QR |
| GET | `/api/payments/gcash-qr` | Public | Get GCash QR URL |
| GET | `/api/admin/bookings` | Admin | All bookings |
| POST | `/api/admin/approve/:id` | Admin | Approve + send email |
| POST | `/api/admin/reject/:id` | Admin | Reject booking |
| GET | `/api/admin/stats` | Admin | Dashboard stats |
| GET | `/api/ticket/:id` | User/Admin | Ticket data |
| GET | `/api/reports/bookings` | Admin | Filtered report |

---

## 💳 GCash Payment Flow

```
1. User searches flights → Books flight (seat selection)
2. Status: pending_payment
3. User goes to Payment page → Scans admin's GCash QR
4. Pays exact amount via GCash app
5. Takes screenshot → Uploads to system
6. Status: payment_submitted
7. Admin logs in → Reviews proof screenshot
8. Admin clicks "Approve" → System:
   ✓ Generates QR boarding pass (qrcode package)
   ✓ Sends Nodemailer HTML email with embedded QR
   ✓ Status: confirmed | paymentStatus: paid
9. User can now print boarding ticket
```

---

## 🖨️ Print Features

**User Boarding Pass** (`/ticket/:bookingId`):
- Full airline-styled ticket layout
- Passenger details, route, seat, QR code
- `window.print()` with print-optimized CSS
- Only accessible when `status === 'confirmed' && paymentStatus === 'paid'`

**Admin Options:**
- Print individual ticket from booking table
- Generate + print filtered booking report

---

## 🔐 Security

- All API routes require Firebase ID tokens (except public endpoints)
- Admin routes have double verification (token + Firestore role check)
- Users can only access their own bookings
- QR generation and email sending are backend-only operations
- Firestore rules enforce data access control at the database level

---

## 🎨 UI Features

- Blue gradient airline theme (`#003399` primary)
- Montserrat + Inter typography
- Interactive seat map with booked/available/selected states
- Toast notifications (react-toastify)
- Responsive layout
- Loading states throughout
- Print-only CSS (`@media print`)

---

## 🔥 Firestore Data Structure

### `users/{uid}`
```json
{
  "name": "Juan Dela Cruz",
  "email": "user@email.com",
  "phone": "+63 912 345 6789",
  "role": "passenger | admin",
  "createdAt": "ISO string"
}
```

### `flights/{flightId}`
```json
{
  "flightNumber": "CEB-101",
  "origin": "MNL",
  "originCity": "Manila",
  "destination": "CEB",
  "destinationCity": "Cebu",
  "departureTime": "ISO string",
  "arrivalTime": "ISO string",
  "price": 1899,
  "totalSeats": 180,
  "availableSeats": 175,
  "bookedSeats": ["12A", "5B"],
  "aircraft": "Airbus A320",
  "status": "active | cancelled",
  "createdAt": "ISO string"
}
```

### `bookings/{docId}`
```json
{
  "bookingId": "CEB-XXXXXX",
  "userId": "firebase-uid",
  "flightId": "flight-doc-id",
  "seatNumber": "12A",
  "passengerName": "Juan Dela Cruz",
  "passengerEmail": "user@email.com",
  "passengerPhone": "+63 912 345 6789",
  "price": 1899,
  "status": "pending_payment | payment_submitted | confirmed | rejected | cancelled",
  "paymentStatus": "unpaid | pending_review | paid | rejected",
  "paymentProofURL": "/uploads/payment-proofs/proof-xxx.jpg",
  "emailSent": true,
  "qrCodeURL": "data:image/png;base64,...",
  "bookingDate": "ISO string",
  "confirmedAt": "ISO string"
}
```

---

## 📧 Email Confirmation

Sent via **Nodemailer** after admin approves payment:
- Rich HTML template with airline branding
- Embedded QR code as base64 image
- Full flight and passenger details
- Important reminders section

Subject: `✈️ Cebu Airlines – Flight Booking Confirmation [CEB-XXXXXX]`

---

## 🔳 QR Code Content Format

```
CEBU AIRLINES
BOOKING ID: CEB-ABC123
FLIGHT: CEB-101
NAME: Juan Dela Cruz
SEAT: 12A
DATE: 2026-04-15
FROM: MNL → TO: CEB
```

Generated using the `qrcode` npm package server-side, stored as base64 data URL in Firestore.
