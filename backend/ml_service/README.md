# Motion Pattern Detection ML Service

This service uses a Random Forest machine learning model to detect artificial/intentional motion patterns that indicate proxy attendance attempts.

## Overview

The model analyzes motion sensor data to distinguish between:
- **Genuine Motion**: Natural user movement detected by accelerometer/gyroscope
- **Artificial Motion**: Intentional artificial patterns that indicate proxy attendance attempts

### How It Works

The Random Forest classifier uses 10 engineered features:

1. **motion_value**: Average motion magnitude
2. **motion_variance**: Stability of motion (low variance = artificial)
3. **rate_of_change**: Average change between consecutive readings
4. **peak_ratio**: Ratio of max to min values (high ratio = spikes = artificial)
5. **frequency_stability**: Standard deviation of motion changes
6. **entropy**: Distribution randomness (low = artificial, high = genuine)
7. **motion_std**: Standard deviation of motion values
8. **motion_range**: Difference between max and min values
9. **spike_count**: Number of sudden large changes (high = artificial)
10. **regularity_score**: How periodic/regular the pattern is

## Installation

### Prerequisites
- Python 3.8+
- pip

### Setup

#### Option 1: Using setup script (macOS/Linux)

```bash
cd backend/ml_service
chmod +x setup.sh
./setup.sh
```

#### Option 2: Manual setup

```bash
cd backend/ml_service

# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Train model
python motion_detector.py
```

## Running the Service

```bash
# Make sure virtual environment is activated
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Start the API server
python app.py
```

The service will start on `http://localhost:5001`

## API Endpoints

### 1. Predict Motion Pattern

**Endpoint:** `POST /api/predict`

Analyzes a sequence of motion values to detect artificial patterns.

**Request:**
```json
{
  "motion_sequence": [10000, 15000, 12000, 18000, 11000, 16000, ...]
}
```

**Response:**
```json
{
  "prediction": 0,
  "label": "Genuine",
  "confidence": 0.92,
  "genuine_probability": 0.92,
  "artificial_probability": 0.08,
  "features": {
    "motion_value": 13500.25,
    "motion_variance": 5200000.0,
    "rate_of_change": 2840.5,
    "peak_ratio": 1.85,
    "frequency_stability": 2100.3,
    "entropy": 2.45,
    "motion_std": 2280.1,
    "motion_range": 7000,
    "spike_count": 2,
    "regularity_score": 0.65
  }
}
```

### 2. Predict Single Motion Value

**Endpoint:** `POST /api/predict-single`

Analyzes a single motion value by comparing with historical patterns.

**Request Option 1:**
```json
{
  "motion_value": 25000
}
```

**Request Option 2:**
```json
{
  "motion_values": [25000, 24800, 25200, 24900]
}
```

**Response:**
```json
{
  "prediction": 0,
  "label": "Genuine",
  "confidence": 0.88,
  "genuine_probability": 0.88,
  "artificial_probability": 0.12,
  "features": {...}
}
```

### 3. Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "model": "Motion Pattern Detector",
  "version": "1.0.0"
}
```

### 4. Retrain Model

**Endpoint:** `POST /api/retrain`

Retrains the model with new training data.

**Request (Optional):**
```json
{
  "n_samples": 2000
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Model retrained with 2000 samples"
}
```

## Integration with Node.js Backend

The Node.js backend automatically uses this ML service when processing motion data.

### Example Usage

**Node.js:**
```javascript
const MotionPatternAnalyzer = require('./utils/motionPatternAnalyzer');

// Analyze a sequence
const result = await MotionPatternAnalyzer.analyzePattern([
  10000, 15000, 12000, 18000, 11000
]);

console.log(result);
// {
//   prediction: 0,
//   label: "Genuine",
//   confidence: 0.92,
//   ...
// }
```

### Full Motion Detection Endpoint

**Endpoint:** `POST /api/data`

**Request with sequence:**
```json
{
  "motion": 25000,
  "motion_sequence": [23000, 25000, 24500, 25500, 24800]
}
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
    "genuine_probability": 0.95,
    "artificial_probability": 0.05,
    "features": {...}
  },
  "timestamp": "2026-02-17T10:30:00.000Z"
}
```

## Model Training

The model is trained on synthetic data representing:

### Genuine Patterns (50% of training data)
- Gradual, natural variations
- Normal Gaussian noise around a mean value
- Smooth transitions between readings
- Realistic accelerometer/gyroscope data

### Artificial Patterns (50% of training data)
- **Type 1**: Rapid periodic spikes (repeating high-low pattern)
- **Type 2**: Unnatural rapid alternations
- Regular, predictable patterns
- Extreme value changes

## Performance

**Model Accuracy:** ~94% on test data

**Classification Report:**
```
              precision    recall  f1-score   support
      Genuine       0.93      0.95      0.94       100
    Artificial       0.95      0.93      0.94       100
   accuracy                           0.94       200
```

## Feature Importance

(From trained model)
```
1. peak_ratio: 0.2145 (very high/low values indicate artificial)
2. spike_count: 0.1852 (sudden changes indicate artificial)
3. entropy: 0.1634 (low entropy = artificial patterns)
4. frequency_stability: 0.1245
5. motion_range: 0.1089
6. rate_of_change: 0.0876
... and more
```

## Troubleshooting

### Model Not Found Error
```
! Existing model not found. Training new model...
```
→ The model will be trained automatically on first run

### Python Dependencies Missing
```bash
pip install -r requirements.txt
```

### Port Already in Use
Change the port in `app.py`:
```python
app.run(debug=False, host='0.0.0.0', port=5002)  # Changed to 5002
```

### ML Service Unavailable
The Node.js backend has a fallback heuristic-based analysis that works without the ML service. It uses simpler statistical methods to detect patterns.

## Configuration

### Environment Variables (in Node.js .env)
```
ML_SERVICE_URL=http://localhost:5001  # Default
```

## Files Structure

```
ml_service/
├── requirements.txt           # Python dependencies
├── motion_detector.py         # ML model and training logic
├── app.py                     # Flask API server
├── setup.sh                   # Setup script
├── README.md                  # This file
├── motion_model.pkl          # Trained model (generated)
├── scaler.pkl                # Feature scaler (generated)
└── venv/                     # Virtual environment (generated)
```

## Next Steps

1. Run the setup script or manual installation
2. Start the ML service: `python app.py`
3. The Node.js backend will automatically use it for `/api/data` requests
4. Monitor the service logs for any issues

## Model Improvement

To improve model accuracy:

1. **Collect real user data**: Replace synthetic training data with actual motion sensor readings
2. **Label data**: Mark genuine vs artificial patterns manually
3. **Retrain**: `POST /api/retrain` with new data
4. **Monitor**: Track false positives/negatives in production

## License

Part of Smart Attendance System (SAS)
