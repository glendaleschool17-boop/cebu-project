require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const flightRoutes = require('./routes/flights');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const ticketRoutes = require('./routes/tickets');
const reportRoutes = require('./routes/reports');
const boardingPassRoutes = require('./routes/boardingPass');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/boarding-pass', boardingPassRoutes); // public — no auth

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Cebu Airlines API is running' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✈️  Cebu Airlines API running on port ${PORT}`);
});

module.exports = app;
