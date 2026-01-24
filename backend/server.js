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
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/auth');

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
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Attendance Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      attendance: '/api/attendance',
      docs: '/api/docs'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
