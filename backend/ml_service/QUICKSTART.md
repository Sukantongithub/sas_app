# ML Service Quick Start Guide

## For Windows Users 🪟

### Step 1: Setup (One-time)
```bash
cd backend/ml_service
setup.bat
```
This will:
- Create a Python virtual environment
- Install all dependencies
- Train the initial Random Forest model

### Step 2: Start the Service

**Option A: Command Prompt**
```bash
cd backend/ml_service
venv\Scripts\activate.bat
python app.py
```

**Option B: PowerShell**
```powershell
cd backend/ml_service
.\venv\Scripts\Activate.ps1
python app.py
```

You should see:
```
🚀 Starting Motion Pattern Detection API on port 5001...
 * Running on http://0.0.0.0:5001
```

### Step 3: Test the Service

Open a new terminal and test:

```bash
curl -X POST http://localhost:5001/api/predict-single ^
  -H "Content-Type: application/json" ^
  -d "{\"motion_value\": 25000}"
```

---

## For macOS/Linux Users 🐧

### Step 1: Setup (One-time)
```bash
cd backend/ml_service
chmod +x setup.sh
./setup.sh
```

### Step 2: Start the Service
```bash
cd backend/ml_service
source venv/bin/activate
python app.py
```

### Step 3: Test the Service
```bash
curl -X POST http://localhost:5001/api/predict-single \
  -H "Content-Type: application/json" \
  -d '{"motion_value": 25000}'
```

---

## Integration with Node.js Backend

The Node.js backend automatically connects to the ML service at `http://localhost:5001`.

### Using the Motion Detection Endpoint

```bash
curl -X POST http://localhost:5000/api/data \
  -H "Content-Type: application/json" \
  -d "{\"motion\": 25000, \"motion_sequence\": [23000, 25000, 24500, 25500, 24800]}"
```

**Response:**
```json
{
  "basicStatus": "PRESENT ✅",
  "finalStatus": "PRESENT ✅",
  "motionValue": 25000,
  "isArtificialPattern": false,
  "mlAnalysis": {
    "prediction": 0,
    "label": "Genuine",
    "confidence": 0.95,
    ...
  },
  "timestamp": "2026-02-17T10:30:00.000Z"
}
```

---

## Troubleshooting

### Error: "Python not found"
- Install Python 3.8+ from https://www.python.org
- Ensure Python is added to PATH

### Error: "Port 5001 already in use"
- Find the process using port 5001 and stop it
- Or change the port in `app.py`

### Error: "ModuleNotFoundError"
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`

### Service works but backend doesn't connect
- Ensure both services are running:
  - Node.js on port 5000
  - Python ML service on port 5001
- Check `ML_SERVICE_URL` in `.env`

---

## File Structure

```
backend/
├── ml_service/
│   ├── setup.bat              (Windows setup)
│   ├── setup.sh               (macOS/Linux setup)
│   ├── requirements.txt        (Python dependencies)
│   ├── motion_detector.py     (ML model training)
│   ├── app.py                 (Flask API server)
│   ├── README.md              (Full documentation)
│   ├── QUICKSTART.md          (This file)
│   ├── motion_model.pkl       (Trained model - auto-generated)
│   └── scaler.pkl             (Feature scaler - auto-generated)
├── utils/
│   └── motionPatternAnalyzer.js (Node.js integration)
└── server.js                  (Updated with ML integration)
```

---

## What Happens During Motion Detection

1. **User triggers motion detected via mobile device**
2. **Mobile sends motion values to `/api/data` endpoint**
3. **Node.js backend calls ML service**
4. **Random Forest model analyzes the pattern:**
   - Genuine motion → "PRESENT ✅"
   - Artificial pattern detected → "PROXY (Artificial Pattern Detected) ⚠️"
5. **Response sent back with confidence score**
6. **Attendance marked accordingly**

---

## Model Indicators

The model looks for these artificial patterns:

### ⚠️ Red Flags (Artificial Patterns):
- Large sudden jumps in motion values
- Repetitive on/off patterns (high-low cycle)
- Too regular/predictable patterns (unnatural)
- Extreme variation (motion swinging wildly)

### ✅ Genuine Signs:
- Gradual, smooth transitions
- Natural random variation
- Realistic patterns
- Moderate changes

---

## Next: Real User Data

The current model is trained on synthetic data. For production:

1. Collect real motion sensor data
2. Label genuine vs artificial attempts
3. Retrain the model: `POST /api/retrain`
4. Gradually improve accuracy

---

**Questions?** See full documentation in `README.md`
