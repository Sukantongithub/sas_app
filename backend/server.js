const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const swaggerSpec = require('./config/swagger');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const deviceRoutes = require('./routes/devices');
const authRoutes = require('./routes/auth');
const leaveRoutes = require('./routes/leaves');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const studentInteractionsRoutes = require('./routes/student-interactions');
const teacherRoutes = require('./routes/teachers');
const messageRoutes = require('./routes/messages');
const studentManagementRoutes = require('./routes/student-management');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Motion Data Variables (Hardware Integration)
// ============================================
const motions = [];
let mlPredictions = [];
let mlServerConnected = false;
const DATASET_DIR = process.env.DATASET_DIR || path.join(__dirname, "datasets");
const DATASET_FILE = path.join(DATASET_DIR, "raw_motions.json");
const LABELED_DATASET_FILE = path.join(DATASET_DIR, "labeled_motions.json");

// Create dataset directory
if (!fs.existsSync(DATASET_DIR)) {
  fs.mkdirSync(DATASET_DIR, { recursive: true });
  console.log(`📁 Created dataset directory: ${DATASET_DIR}`);
}

// Load existing dataset
let rawDataset = [];
if (fs.existsSync(DATASET_FILE)) {
  try {
    rawDataset = JSON.parse(fs.readFileSync(DATASET_FILE, "utf8"));
    console.log(`✅ Loaded existing dataset with ${rawDataset.length} samples`);
  } catch (e) {
    console.log("📝 Starting fresh dataset");
    rawDataset = [];
  }
}

// Connect to MongoDB
connectDB();

// Global middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: false,
  optionsSuccessStatus: 200
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Disable rate limiting for development - enable in production
const limiter = process.env.NODE_ENV === 'production' 
  ? rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })
  : (req, res, next) => next();
app.use(limiter);

// ============================================
// Dataset Management Functions
// ============================================
function saveDataset() {
  try {
    fs.writeFileSync(DATASET_FILE, JSON.stringify(rawDataset, null, 2));
  } catch (e) {
    console.error("Error saving dataset:", e);
  }
}

function addToDataset(data) {
  const entry = {
    timestamp: new Date().toISOString(),
    id: data.id || "unknown",
    ax: parseFloat(data.ax) || 0,
    ay: parseFloat(data.ay) || 0,
    az: parseFloat(data.az) || 0,
    m: parseFloat(data.m) || 0,
    r: parseInt(data.r) || -50,
    ip: data.ip || "unknown",
  };

  rawDataset.push(entry);
  saveDataset();
  console.log(`💾 Dataset saved (${rawDataset.length} samples)`);
}

// ============================================
// ML Integration Functions
// ============================================
function checkMLServer() {
  const req = http.request(
    {
      hostname: "localhost",
      port: 5001,
      path: "/health",
      method: "GET",
    },
    (res) => {
      if (res.statusCode === 200) {
        mlServerConnected = true;
        console.log("✅ ML server connected");
      }
    },
  );

  req.on("error", () => {
    mlServerConnected = false;
  });

  req.end();
}

function sendToMLServer(data) {
  if (!mlServerConnected) return;

  const payload = JSON.stringify({
    ax: parseFloat(data.ax) || 0,
    ay: parseFloat(data.ay) || 0,
    az: parseFloat(data.az) || 0,
    m: parseFloat(data.m) || 0,
    r: parseInt(data.r) || -50,
  });

  const req = http.request(
    {
      hostname: "localhost",
      port: 5001,
      path: "/predict",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": payload.length,
      },
    },
    (res) => {
      let result = "";
      res.on("data", (chunk) => {
        result += chunk;
      });
      res.on("end", () => {
        try {
          const pred = JSON.parse(result);
          mlPredictions.unshift(pred);
          if (mlPredictions.length > 50) mlPredictions.pop();
        } catch (e) {}
      });
    },
  );

  req.on("error", () => {});
  req.write(payload);
  req.end();
}

// Check ML server every 5 seconds
const http = require('http');
setInterval(checkMLServer, 5000);

// ============================================
// Motion Recording Endpoints
// ============================================
function recordMotion(req, res) {
  let data = req.body;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      const params = new URLSearchParams(data);
      const parsed = {};
      for (const [key, value] of params.entries()) parsed[key] = value;
      data = Object.keys(parsed).length ? parsed : { raw: req.body };
    }
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    data = {};
  }

  const entry = {
    time: new Date().toISOString(),
    ip: req.ip,
    ...data,
  };

  motions.unshift(entry);
  if (motions.length > 100) motions.pop();

  console.log("📊 Motion:", entry);

  addToDataset(entry);
  sendToMLServer(entry);

  res.status(200).json({ ok: true });
}

app.post("/motion", recordMotion);
app.post("/gyro", recordMotion);

app.get("/motion", (req, res) => {
  const entry = {
    time: new Date().toISOString(),
    ip: req.ip,
    ...req.query,
  };

  motions.unshift(entry);
  if (motions.length > 100) motions.pop();

  sendToMLServer(entry);
  res.status(200).json({ ok: true, source: "query" });
});

// ============================================
// Motion Data API Endpoints
// ============================================
app.get("/motions", (_req, res) => {
  res.json(motions);
});

app.get("/predictions", (_req, res) => {
  res.json(mlPredictions);
});

app.get("/stats", (_req, res) => {
  const pred = mlPredictions[0];
  res.json({
    total_motions: motions.length,
    total_predictions: mlPredictions.length,
    ml_connected: mlServerConnected,
    latest_prediction: pred || null,
  });
});

// ============================================
// Dataset Management API
// ============================================
app.get("/dataset/stats", (_req, res) => {
  res.json({
    total_samples: rawDataset.length,
    raw_file: DATASET_FILE,
    labeled_file: LABELED_DATASET_FILE,
    samples_since_last_save: rawDataset.length % 10,
    dataset_size_bytes: fs.existsSync(DATASET_FILE)
      ? fs.statSync(DATASET_FILE).size
      : 0,
  });
});

app.get("/dataset/export", (_req, res) => {
  res.type("application/json").send(JSON.stringify(rawDataset, null, 2));
});

app.post("/dataset/clear", (_req, res) => {
  const prevLen = rawDataset.length;
  rawDataset = [];
  try {
    fs.writeFileSync(DATASET_FILE, JSON.stringify([], null, 2));
    res.json({
      ok: true,
      cleared_samples: prevLen,
      message: `Cleared ${prevLen} samples`,
    });
    console.log(`🗑️ Dataset cleared (was ${prevLen} samples)`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/dataset/samples", (req, res) => {
  const limit = parseInt(req.query.limit || "20", 10);
  res.json(rawDataset.slice(-limit).reverse());
});

// ============================================
// Motion Analysis Dashboard
// ============================================
app.get("/", (_req, res) => {
  res.type("html").send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ESP8266 Motion Analysis</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
      .container { max-width: 1200px; margin: 0 auto; }
      h1 { color: #333; margin-bottom: 20px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
      .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .stat-label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
      .stat-value { color: #333; font-size: 28px; font-weight: bold; }
      .ml-status { padding: 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
      .ml-connected { background: #d4edda; color: #155724; }
      .ml-disconnected { background: #f8d7da; color: #721c24; }
      .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #ddd; }
      .tab-btn { padding: 10px 20px; background: none; border: none; cursor: pointer; font-size: 14px; color: #666; border-bottom: 3px solid transparent; }
      .tab-btn.active { color: #0066cc; border-bottom-color: #0066cc; }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
      table { width: 100%; background: white; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      th { background: #f8f9fa; padding: 15px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; }
      td { padding: 12px 15px; border-bottom: 1px solid #eee; }
      tr:hover { background: #f9f9f9; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🎯 ESP8266 Motion Analysis Dashboard</h1>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Server Time</div>
          <div class="stat-value" id="serverTime">--:--:--</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Motion Records</div>
          <div class="stat-value" id="motionCount">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ML Predictions</div>
          <div class="stat-value" id="predCount">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ML Server</div>
          <div id="mlStatus" class="ml-status ml-disconnected">Offline</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('motions')">📊 Motion Data</button>
        <button class="tab-btn" onclick="switchTab('predictions')">🤖 ML Predictions</button>
      </div>

      <div id="motions" class="tab-content active">
        <table>
          <thead>
            <tr>
              <th>Time</th><th>Device</th><th>Motion</th><th>Ax</th><th>Ay</th><th>Az</th><th>RSSI</th><th>IP</th>
            </tr>
          </thead>
          <tbody id="motionTable"></tbody>
        </table>
      </div>

      <div id="predictions" class="tab-content">
        <table>
          <thead>
            <tr>
              <th>Time</th><th>Classification</th><th>Confidence</th><th>Probability</th><th>Buffer</th>
            </tr>
          </thead>
          <tbody id="predictionTable"></tbody>
        </table>
      </div>
    </div>

    <script>
      function switchTab(tab) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(tab).classList.add('active');
        event.target.classList.add('active');
      }

      async function updateDashboard() {
        try {
          const [motions, predictions, stats] = await Promise.all([
            fetch('/motions?' + Date.now()).then(r => r.json()),
            fetch('/predictions?' + Date.now()).then(r => r.json()),
            fetch('/stats?' + Date.now()).then(r => r.json())
          ]);

          document.getElementById('serverTime').textContent = new Date().toLocaleTimeString();
          document.getElementById('motionCount').textContent = motions.length;
          document.getElementById('predCount').textContent = predictions.length;
          
          const mlStatus = document.getElementById('mlStatus');
          if (stats.ml_connected) {
            mlStatus.textContent = '🟢 Online';
            mlStatus.className = 'ml-status ml-connected';
          } else {
            mlStatus.textContent = '🔴 Offline';
            mlStatus.className = 'ml-status ml-disconnected';
          }

          const motionTable = document.getElementById('motionTable');
          motionTable.innerHTML = motions.slice(0, 20).map(m => '<tr>' +
            '<td>' + (m.time || '').substring(11, 19) + '</td>' +
            '<td>' + (m.id || '--') + '</td>' +
            '<td>' + (parseFloat(m.m) || 0).toFixed(2) + '</td>' +
            '<td>' + (parseFloat(m.ax) || 0).toFixed(2) + '</td>' +
            '<td>' + (parseFloat(m.ay) || 0).toFixed(2) + '</td>' +
            '<td>' + (parseFloat(m.az) || 0).toFixed(2) + '</td>' +
            '<td>' + (m.r || '--') + '</td>' +
            '<td>' + (m.ip || '--') + '</td>' +
          '</tr>').join('');

          const predTable = document.getElementById('predictionTable');
          predTable.innerHTML = predictions.slice(0, 20).map(p => {
            if (p.status === 'waiting') return '';
            return '<tr>' +
              '<td>' + new Date().toLocaleTimeString() + '</td>' +
              '<td>' + (p.classification || '--') + '</td>' +
              '<td>' + ((p.confidence || 0) * 100).toFixed(1) + '%</td>' +
              '<td>' + ((p.probability || 0) * 100).toFixed(1) + '%</td>' +
              '<td>' + (p.buffer_size || 0) + '/' + 10 + '</td>' +
            '</tr>';
          }).join('');

        } catch (err) {
          console.error('Error:', err);
        }
      }

      updateDashboard();
      setInterval(updateDashboard, 2000);
    </script>
  </body>
</html>`);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);  // Consolidated attendance endpoints
app.use('/api/devices', deviceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/student-interactions', studentInteractionsRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/student-management', studentManagementRoutes);
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
      leaves: '/api/leaves',
      notifications: '/api/notifications',
      docs: '/api/docs'
    }
  });
});

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
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`Motion Dashboard: http://localhost:${PORT}/`);
});

module.exports = app;
