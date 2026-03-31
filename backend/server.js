const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const connectDB = require('./config/database');
const swaggerSpec = require('./config/swagger');
const MotionPatternAnalyzer = require('./utils/motionPatternAnalyzer');
const wss = require('./mqttReceiver'); // WebSocket server for ESP32
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const attendanceV2Routes = require('./routes/attendanceV2');
const deviceRoutes = require('./routes/devices');
const authRoutes = require('./routes/auth');
const leaveRoutes = require('./routes/leaves');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const studentInteractionsRoutes = require('./routes/student-interactions');
const teacherRoutes = require('./routes/teachers');
const messageRoutes = require('./routes/messages');
const studentManagementRoutes = require('./routes/student-management');
const hardwareRoutes = require('./routes/hardware');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Basic rate limiting (tune in production)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance-v2', attendanceV2Routes);
app.use('/api/devices', deviceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/student-interactions', studentInteractionsRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/student-management', studentManagementRoutes);
app.use('/api/hardware', hardwareRoutes);
app.set('trust proxy', 1);
// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Attendance System API',
    version: '2.0.0',
    features: [
      'BLE + Gyroscope verification',
      'Parent notifications',
      'Leave management',
      'Daily attendance summary',
      'Late arrival tracking',
      'Multi-role access (Student, Teacher, Parent, Admin, Staff, HR)'
    ],
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      attendance: '/api/attendance',
      attendanceV2: '/api/attendance-v2',
      devices: '/api/devices',
      leaves: '/api/leaves',
      notifications: '/api/notifications',
      docs: '/api/docs'
    }
  });
});

// Motion data is now received via WebSocket (ws://localhost:8080)
// See mqttReceiver.js — the ESP32 connects directly over WebSocket.

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error in development only
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Handle different error types
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Duplicate entry' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    message: err.message || 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🌐 WebSocket server running on ws://localhost:8080 (ESP32 motion data)`);
});

module.exports = app;
