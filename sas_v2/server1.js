// server.js - ESP8266 Motion Data Receiver with ML Integration
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.text({ type: "text/*" }));

const motions = [];
let mlPredictions = [];
let mlServerConnected = false;

// ============================================
// Dataset Management
// ============================================

const DATASET_DIR = "m:\\tmp\\MAD\\datasets";
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

  // Save every sample to guarantee persistence
  saveDataset();
  console.log(`💾 Dataset saved (${rawDataset.length} samples)`);
}

// ============================================
// ML Integration
// ============================================

function checkMLServer() {
  const http = require("http");
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

  const https = require("http");
  const payload = JSON.stringify({
    ax: parseFloat(data.ax) || 0,
    ay: parseFloat(data.ay) || 0,
    az: parseFloat(data.az) || 0,
    m: parseFloat(data.m) || 0,
    r: parseInt(data.r) || -50,
  });

  const req = https.request(
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
setInterval(checkMLServer, 5000);

// ============================================
// Motion Recording
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

  // Save to persistent dataset
  addToDataset(entry);

  // Send to ML server
  sendToMLServer(entry);

  res.status(200).json({ ok: true });
}

app.post("/motion", recordMotion);
app.post("/", recordMotion);
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
// REST API Endpoints
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
// Dashboard HTML
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
      .badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
      .badge-natural { background: #cfe9ff; color: #0066cc; }
      .badge-intentional { background: #ffe0e0; color: #cc0000; }
      .progress { height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
      .progress-bar { height: 100%; background: linear-gradient(90deg, #0066cc, #00cc66); transition: width 0.3s; }
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

      // Update time every second independently
      function updateTime() {
        document.getElementById('serverTime').textContent = new Date().toLocaleTimeString();
      }

      // Update dashboard data
      async function updateDashboard() {
        try {
          console.log('📊 Updating dashboard...');
          
          const motionsResponse = await fetch('/motions?' + Date.now());
          const motions = await motionsResponse.json();
          console.log('✅ Motions:', motions.length);
          
          const predictionsResponse = await fetch('/predictions?' + Date.now());
          const predictions = await predictionsResponse.json();
          console.log('✅ Predictions:', predictions.length);
          
          const statsResponse = await fetch('/stats?' + Date.now());
          const stats = await statsResponse.json();
          console.log('✅ Stats:', stats);

          // Update counts
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

          // Update motion table
          const motionTable = document.getElementById('motionTable');
          if (motions.length === 0) {
            motionTable.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">No motion data yet</td></tr>';
          } else {
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
          }

          // Update prediction table
          const predTable = document.getElementById('predictionTable');
          if (predictions.length === 0) {
            predTable.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No predictions yet</td></tr>';
          } else {
            predTable.innerHTML = predictions.slice(0, 20).map(p => {
              if (p.status === 'waiting') return '';
              const badge = p.classification === 'Natural' ? 'badge-natural' : 'badge-intentional';
              return '<tr>' +
                '<td>' + new Date().toLocaleTimeString() + '</td>' +
                '<td><span class="badge ' + badge + '">' + (p.classification || 'Unknown') + '</span></td>' +
                '<td>' + ((p.confidence || 0) * 100).toFixed(1) + '%</td>' +
                '<td><div class="progress"><div class="progress-bar" style="width:' + ((p.probability || 0) * 100) + '%"></div></div></td>' +
                '<td>' + (p.buffer_size || 0) + '/10</td>' +
              '</tr>';
            }).join('');
          }

        } catch (err) {
          console.error('❌ Dashboard error:', err);
          document.getElementById('motionCount').textContent = '?';
          document.getElementById('predCount').textContent = '?';
        }
      }

      // Start updates
      console.log('🚀 Dashboard loaded');
      updateTime(); // Update immediately
      setInterval(updateTime, 1000); // Update time every 1 second
      updateDashboard(); // Update dashboard immediately
      setInterval(updateDashboard, 2000); // Update dashboard every 2 seconds
    </script>
  </body>
</html>`);
});

// ============================================
// Start Server
// ============================================

app.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Motion Server listening on http://0.0.0.0:5000");
  console.log("📡 ML Server expected at localhost:5001");
  checkMLServer();
});
