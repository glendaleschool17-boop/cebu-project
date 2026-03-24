import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/global.css';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute, GateAgentRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import FlightSearch from './pages/FlightSearch';
import BookingPage from './pages/BookingPage';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import MyBookings from './pages/MyBookings';
import MyAccount from './pages/MyAccount';
import TicketPage from './pages/TicketPage';
import BoardingPassPage from './pages/BoardingPassPage';
import ReschedulePaymentPage from './pages/ReschedulePaymentPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminBookings from './pages/AdminBookings';
import AdminFlights from './pages/AdminFlights';
import AdminReports from './pages/AdminReports';
import AdminGCash from './pages/AdminGCash';
import ManageAdmins from './pages/ManageAdmins';
import GateAgentPage from './pages/GateAgentPage';
import NotFound from './pages/NotFound';
import ReviewBookingPage from './pages/ReviewBookingPage';
import ContactPage from './pages/ContactPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/search" element={<FlightSearch />} />
          <Route path="/contact" element={<ContactPage />} />
          {/* Public boarding pass — opened when QR code is scanned */}
          <Route path="/boarding/:bookingId/:token" element={<BoardingPassPage />} />

          {/* Protected (Passenger) */}
          <Route path="/book/:flightId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/review-booking" element={<ProtectedRoute><ReviewBookingPage /></ProtectedRoute>} />
          <Route path="/payment/:bookingId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="/payment-success/:bookingId" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/my-account" element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
          <Route path="/ticket/:bookingId" element={<ProtectedRoute><TicketPage /></ProtectedRoute>} />
          <Route path="/reschedule-payment/:bookingId" element={<ProtectedRoute><ReschedulePaymentPage /></ProtectedRoute>} />

          {/* Gate Agent */}
          <Route path="/gate-agent" element={<GateAgentRoute><GateAgentPage /></GateAgentRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/flights" element={<AdminRoute><AdminFlights /></AdminRoute>} />
          <Route path="/admin/gcash" element={<AdminRoute><AdminGCash /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
          <Route path="/admin/manage-admins" element={<AdminRoute><ManageAdmins /></AdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={4000}
          toastStyle={{ fontFamily: 'Inter, sans-serif', borderRadius: 10 }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
