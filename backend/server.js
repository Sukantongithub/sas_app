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

if (!process.env.JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

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
const autoAttendanceService = require('./services/autoAttendanceService');

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

// Motion Detection Thresholds
const MOTION_THRESHOLDS = {
  MIN_MAGNITUDE: parseFloat(process.env.MOTION_MIN_MAGNITUDE || '1'),     // Very low for testing
  MAX_MAGNITUDE: parseFloat(process.env.MOTION_MAX_MAGNITUDE || '100000'), // High limit
  SPIKE_DETECTION: parseFloat(process.env.MOTION_SPIKE_DETECTION || '5000'),
  ARTIFICIAL_THRESHOLD: parseFloat(process.env.ARTIFICIAL_MOTION_THRESHOLD || '0.7')
};

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
function calculateMotionMagnitude(ax, ay, az) {
  const x = parseFloat(ax) || 0;
  const y = parseFloat(ay) || 0;
  const z = parseFloat(az) || 0;
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
}

function saveDataset() {
  try {
    fs.writeFileSync(DATASET_FILE, JSON.stringify(rawDataset, null, 2));
    console.log(`📁 Dataset saved (${rawDataset.length} samples)`);
  } catch (e) {
    console.error("Error saving dataset:", e);
  }
}

function addToDataset(data) {
  const ax = parseFloat(data.ax) || 0;
  const ay = parseFloat(data.ay) || 0;
  const az = parseFloat(data.az) || 0;
  
  // Calculate magnitude if not provided
  let magnitude = parseFloat(data.m) || parseFloat(data.magnitude) || 0;
  if (magnitude === 0 || !isFinite(magnitude)) {
    magnitude = calculateMotionMagnitude(ax, ay, az);
  }

  // Apply motion thresholds - filter out very small movements
  if (magnitude < MOTION_THRESHOLDS.MIN_MAGNITUDE) {
    console.log(`⚠️ Motion below threshold (${magnitude.toFixed(2)} < ${MOTION_THRESHOLDS.MIN_MAGNITUDE}), skipping`);
    return;
  }

  // Cap at maximum reasonable value to detect anomalies
  if (magnitude > MOTION_THRESHOLDS.MAX_MAGNITUDE) {
    console.log(`⚡ Motion spike detected: ${magnitude.toFixed(2)}`);
  }

  const entry = {
    timestamp: new Date().toISOString(),
    id: data.deviceId || data.id || "unknown",
    ax: ax.toFixed(2),
    ay: ay.toFixed(2),
    az: az.toFixed(2),
    m: magnitude.toFixed(2),           // magnitude display field
    motionMagnitude: magnitude,         // full precision
    sensorSource: "accelerometer",
    r: parseInt(data.r) || parseInt(data.rssi) || -50,
    ip: data.ip || "unknown",
  };

  rawDataset.push(entry);
  
  // Save dataset every 10 entries to reduce I/O
  if (rawDataset.length % 10 === 0) {
    saveDataset();
  }
  
  console.log(`💾 Motion recorded: M=${magnitude.toFixed(2)} (Ax=${ax.toFixed(2)}, Ay=${ay.toFixed(2)}, Az=${az.toFixed(2)})`);
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

  // Ensure magnitude is calculated
  const ax = parseFloat(data.ax) || 0;
  const ay = parseFloat(data.ay) || 0;
  const az = parseFloat(data.az) || 0;
  const magnitude = parseFloat(data.m) || calculateMotionMagnitude(ax, ay, az);

  const payload = JSON.stringify({
    ax: ax,
    ay: ay,
    az: az,
    m: magnitude,
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

const ABSENT_FINALIZATION_SWEEP_MS = parseInt(process.env.AUTO_ATTENDANCE_SWEEP_INTERVAL_MS || '60000', 10);
setInterval(async () => {
  try {
    const result = await autoAttendanceService.finalizeExpiredAttendanceSessions();
    if (result && (result.finalized || result.absentCreated)) {
      console.log('Absent sweep complete:', result);
    }
  } catch (error) {
    console.error('Absent sweep error:', error.message);
  }
}, ABSENT_FINALIZATION_SWEEP_MS);

// ============================================
// Motion Recording Endpoints
// ============================================
async function recordMotion(req, res) {
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

  // Ensure all motion values are present and numeric
  const ax = parseFloat(data.ax) || parseFloat(data.x) || 0;
  const ay = parseFloat(data.ay) || parseFloat(data.y) || 0;
  const az = parseFloat(data.az) || parseFloat(data.z) || 0;
  
  // Calculate motion magnitude
  const magnitude = calculateMotionMagnitude(ax, ay, az);

  // Create enriched entry with all calculated fields
  const entry = {
    time: new Date().toISOString(),
    ip: req.ip,
    ax: ax.toFixed(2),
    ay: ay.toFixed(2),
    az: az.toFixed(2),
    m: magnitude.toFixed(2),           // Calculated magnitude
    deviceId: data.deviceId || data.id,
    r: parseInt(data.r) || parseInt(data.rssi) || -50,
    timestamp: data.timestamp,
    ...data,
  };

  // Apply threshold before recording
  if (magnitude >= MOTION_THRESHOLDS.MIN_MAGNITUDE) {
    motions.unshift(entry);
    if (motions.length > 100) motions.pop();
    
    console.log(`📊 Motion: M=${magnitude.toFixed(2)} Ax=${ax.toFixed(2)} Ay=${ay.toFixed(2)} Az=${az.toFixed(2)} RSSI=${entry.r}`);
    
    // Add to persistent dataset
    addToDataset(entry);
  } else {
    console.log(`⚠️ Motion too small (${magnitude.toFixed(2)}), filtered by threshold`);
  }

  let autoAttendance = null;
  try {
    autoAttendance = await autoAttendanceService.processMotionReading(entry);

    if (autoAttendance?.analysis) {
      mlPredictions.unshift(autoAttendance.analysis);
      if (mlPredictions.length > 50) mlPredictions.pop();
    }
  } catch (error) {
    console.error('Auto attendance processing error:', error.message);
  }

  res.status(200).json({
    ok: true,
    magnitude: magnitude,
    axes: { ax, ay, az },
    thresholdApplied: magnitude < MOTION_THRESHOLDS.MIN_MAGNITUDE,
    autoAttendance: autoAttendance ? {
      bufferSize: autoAttendance.bufferSize,
      analysis: autoAttendance.analysis,
      attendance: autoAttendance.attendance
    } : null
  });
}

app.post("/motion", recordMotion);
app.post("/gyro", recordMotion);

app.get("/motion", (req, res) => {
  // Parse all possible axis names
  const ax = parseFloat(req.query.ax) || parseFloat(req.query.x) || 0;
  const ay = parseFloat(req.query.ay) || parseFloat(req.query.y) || 0;
  const az = parseFloat(req.query.az) || parseFloat(req.query.z) || 0;
  const magnitude = calculateMotionMagnitude(ax, ay, az);

  const entry = {
    time: new Date().toISOString(),
    ip: req.ip,
    ax: ax.toFixed(2),
    ay: ay.toFixed(2),
    az: az.toFixed(2),
    m: magnitude.toFixed(2),
    r: parseInt(req.query.r) || parseInt(req.query.rssi) || -50,
    ...req.query,
  };

  // Apply threshold
  if (magnitude >= MOTION_THRESHOLDS.MIN_MAGNITUDE) {
    motions.unshift(entry);
    if (motions.length > 100) motions.pop();
    
    console.log(`📊 Motion (GET): M=${magnitude.toFixed(2)} Ax=${ax.toFixed(2)} Ay=${ay.toFixed(2)} Az=${az.toFixed(2)}`);
    sendToMLServer(entry);
  }

  res.status(200).json({ 
    ok: true, 
    source: "query",
    magnitude: magnitude,
    thresholdApplied: magnitude < MOTION_THRESHOLDS.MIN_MAGNITUDE
  });
});

// ============================================
// Motion Data API Endpoints
// ============================================
app.get("/motions", (_req, res) => {
  // Return motions with calculated magnitude for all
  const enriched = motions.map(m => ({
    ...m,
    m: m.m || calculateMotionMagnitude(m.ax, m.ay, m.az).toFixed(2),
    az: m.az !== undefined ? m.az : '0'  // Ensure Z-axis is present
  }));
  res.json(enriched);
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
    motion_thresholds: MOTION_THRESHOLDS,
    recent_motions: motions.slice(0, 5).map(m => ({
      time: m.time,
      magnitude: m.m,
      axes: { ax: m.ax, ay: m.ay, az: m.az },
      ip: m.ip
    }))
  });
});

// ============================================
// Test Data Endpoints (for development/testing)
// ============================================

/**
 * POST /test/motion - Generate test motion data
 * Query params:
 *   count: number of test samples (default: 1)
 *   pattern: 'natural' or 'artificial' (default: 'natural')
 */
app.post("/test/motion", (req, res) => {
  const count = parseInt(req.query.count || "1", 10);
  const pattern = req.query.pattern || "natural";
  
  const generated = [];
  
  for (let i = 0; i < count; i++) {
    let ax, ay, az;
    
    if (pattern === "artificial") {
      // High frequency spikes (artificial pattern)
      ax = Math.random() * 10000 - 5000;
      ay = Math.random() * 10000 - 5000;
      az = Math.random() * 10000 - 5000;
    } else {
      // Smooth natural movement
      ax = Math.sin(Date.now() / 1000 + i) * 500 + (Math.random() * 100 - 50);
      ay = Math.cos(Date.now() / 1000 + i) * 500 + (Math.random() * 100 - 50);
      az = Math.sin(Date.now() / 500 + i) * 300 + (Math.random() * 50 - 25);
    }
    
    const magnitude = calculateMotionMagnitude(ax, ay, az);
    
    const testData = {
      time: new Date().toISOString(),
      ip: "127.0.0.1",
      ax: ax.toFixed(2),
      ay: ay.toFixed(2),
      az: az.toFixed(2),
      m: magnitude.toFixed(2),
      r: -55,
      deviceId: `test-device-${i}`,
      pattern: pattern
    };
    
    motions.unshift(testData);
    if (motions.length > 100) motions.pop();
    
    generated.push(testData);
    console.log(`🧪 Test ${pattern} motion #${i+1}: M=${magnitude.toFixed(2)}`);
  }
  
  if (motions.length > 0) motions.pop(); // Remove if too many
  
  res.json({
    ok: true,
    generated: count,
    pattern: pattern,
    total_motions: motions.length,
    samples: generated
  });
});

/**
 * GET /test/generate-many - Generate many test samples
 */
app.get("/test/generate-many", (req, res) => {
  const count = parseInt(req.query.count || "10", 10);
  
  for (let i = 0; i < count; i++) {
    const ax = Math.random() * 1000 - 500;
    const ay = Math.random() * 1000 - 500;
    const az = Math.random() * 500 - 250;
    const magnitude = calculateMotionMagnitude(ax, ay, az);
    
    const entry = {
      time: new Date(Date.now() - Math.random() * 60000).toISOString(),
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      ax: ax.toFixed(2),
      ay: ay.toFixed(2),
      az: az.toFixed(2),
      m: magnitude.toFixed(2),
      r: -50 - Math.floor(Math.random() * 30),
      deviceId: `device-${Math.floor(Math.random() * 10)}`
    };
    
    motions.unshift(entry);
  }
  
  if (motions.length > 100) {
    motions.splice(100);
  }
  
  res.json({
    ok: true,
    generated: count,
    total_motions: motions.length,
    sample: motions[0]
  });
});

/**
 * GET /test/clear - Clear all motion data
 */
app.get("/test/clear", (req, res) => {
  const count = motions.length;
  motions.length = 0;
  mlPredictions.length = 0;
  
  res.json({
    ok: true,
    cleared_motions: count,
    cleared_predictions: 0,
    message: `Cleared ${count} motion records`
  });
});

/**
 * POST /test/artificial-motion - Generate intentional artificial motion patterns
 * Query params:
 *   count: number of artificial samples (default: 1)
 */
app.post("/test/artificial-motion", (req, res) => {
  const count = parseInt(req.query.count || "1", 10);
  const generated = [];
  
  for (let i = 0; i < count; i++) {
    // Generate HIGH-FREQUENCY spikes (artificial pattern)
    // Artificial motion has:
    // 1. Very high standard deviation
    // 2. Rapid changes between high and low values
    // 3. Inconsistent patterns
    
    const isSpike = Math.random() > 0.5;
    const spike = isSpike ? Math.random() * 20000 : Math.random() * 500;
    
    const ax = spike * (Math.random() > 0.5 ? 1 : -1);
    const ay = spike * (Math.random() > 0.5 ? 1 : -1);
    const az = spike * 0.5 * (Math.random() > 0.5 ? 1 : -1);
    const magnitude = calculateMotionMagnitude(ax, ay, az);
    
    const testData = {
      time: new Date().toISOString(),
      ip: "127.0.0.1",
      ax: ax.toFixed(2),
      ay: ay.toFixed(2),
      az: az.toFixed(2),
      m: magnitude.toFixed(2),
      r: -55,
      deviceId: `artificial-device-${i}`,
      pattern: "artificial"
    };
    
    motions.unshift(testData);
    if (motions.length > 100) motions.pop();
    
    generated.push(testData);
    console.log(`⚡ Artificial motion #${i+1}: M=${magnitude.toFixed(2)} (spike=${isSpike})`);
  }
  
  res.json({
    ok: true,
    generated: count,
    pattern: "artificial",
    total_motions: motions.length,
    samples: generated,
    notes: "These samples should be detected as ARTIFICIAL with high confidence"
  });
});

/**
 * POST /test/natural-motion - Generate natural/genuine motion patterns
 * Query params:
 *   count: number of natural samples (default: 1)
 */
app.post("/test/natural-motion", (req, res) => {
  const count = parseInt(req.query.count || "1", 10);
  const generated = [];
  
  for (let i = 0; i < count; i++) {
    // Generate SMOOTH motion (natural pattern)
    // Natural motion has:
    // 1. Low standard deviation
    // 2. Gradual changes
    // 3. Consistent, predictable patterns
    
    const baseX = Math.sin(Date.now() / 3000 + i) * 200;
    const baseY = Math.cos(Date.now() / 2000 + i) * 200;
    const baseZ = Math.sin(Date.now() / 4000 + i) * 100;
    
    const noise = 20;
    const ax = baseX + (Math.random() * noise - noise / 2);
    const ay = baseY + (Math.random() * noise - noise / 2);
    const az = baseZ + (Math.random() * noise - noise / 2);
    const magnitude = calculateMotionMagnitude(ax, ay, az);
    
    const testData = {
      time: new Date().toISOString(),
      ip: "127.0.0.1",
      ax: ax.toFixed(2),
      ay: ay.toFixed(2),
      az: az.toFixed(2),
      m: magnitude.toFixed(2),
      r: -55,
      deviceId: `natural-device-${i}`,
      pattern: "natural"
    };
    
    motions.unshift(testData);
    if (motions.length > 100) motions.pop();
    
    generated.push(testData);
    console.log(`🌊 Natural motion #${i+1}: M=${magnitude.toFixed(2)}`);
  }
  
  res.json({
    ok: true,
    generated: count,
    pattern: "natural",
    total_motions: motions.length,
    samples: generated,
    notes: "These samples should be detected as GENUINE with high confidence"
  });
});

/**
 * POST /test/analyze-sequence - Analyze a motion sequence for artificial patterns
 * Request body:
 * {
 *   "sequence": [100, 200, 150, 5000, 4900, 100, 150, ...],
 *   "count": 20  (optional: generate random sequence of this length)
 * }
 */
app.post("/test/analyze-sequence", (req, res) => {
  try {
    const MotionPatternAnalyzer = require('./utils/motionPatternAnalyzer');
    
    let sequence = req.body.sequence || [];
    
    if (!sequence || sequence.length === 0) {
      const count = parseInt(req.body.count || "10", 10);
      // Generate artificial sequence
      for (let i = 0; i < count; i++) {
        const spike = Math.random() > 0.5;
        sequence.push(spike ? Math.random() * 15000 : Math.random() * 500);
      }
    }
    
    // Analyze the sequence
    const analysis = MotionPatternAnalyzer._thresholdAnalysis(sequence);
    
    res.json({
      ok: true,
      analyzed_samples: sequence.length,
      prediction: analysis,
      interpretation: {
        is_artificial: analysis.label === 'Artificial',
        confidence_percent: (analysis.confidence * 100).toFixed(1),
        recommended_action: analysis.label === 'Artificial' 
          ? 'Flag as suspicious motion - manual review recommended'
          : 'Motion appears genuine - can be used for attendance'
      }
    });
  } catch (error) {
    console.error('Sequence analysis error:', error);
    res.status(500).json({ error: error.message });
  }
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

            const classification = p.classification || p.label || (
              p.prediction === 1 || p.prediction === '1'
                ? 'Artificial'
                : p.prediction === 0 || p.prediction === '0'
                  ? 'Genuine'
                  : '--'
            );
            const probability = typeof p.probability === 'number'
              ? p.probability
              : (classification === 'Artificial' || classification === '1'
                ? (p.artificial_probability || 0)
                : (p.genuine_probability || p.confidence || 0));
            const bufferSize = p.bufferSize || p.buffer_size || (Array.isArray(p.motionSequence) ? p.motionSequence.length : 0);
            const analysisWindowSize = p.analysisWindowSize || p.analysis_window_size || bufferSize || 0;
            const timeValue = p.timestamp || p.time || new Date().toISOString();

            return '<tr>' +
              '<td>' + new Date(timeValue).toLocaleTimeString() + '</td>' +
              '<td>' + classification + '</td>' +
              '<td>' + ((p.confidence || 0) * 100).toFixed(1) + '%</td>' +
              '<td>' + (probability * 100).toFixed(1) + '%</td>' +
              '<td>' + bufferSize + '/' + analysisWindowSize + '</td>' +
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
      'BLE + accelerometer verification',
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
