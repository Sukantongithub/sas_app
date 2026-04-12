#!/usr/bin/env python3
"""
Real-time Motion Classification Inference API
Load trained scikit-learn models and classify incoming ESP8266 data
"""

import numpy as np
import pickle
import json
from pathlib import Path
from flask import Flask, request, jsonify
import joblib
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)

# ============================================
# CONFIGURATION
# ============================================

MODELS_DIR = Path("models")
SCALER_PATH = MODELS_DIR / "scaler.pkl"
MODEL_PATHS = {
    'random_forest': MODELS_DIR / "random_forest.pkl",
    'gradient_boosting': MODELS_DIR / "gradient_boosting.pkl",
    'svm': MODELS_DIR / "svm_model.pkl",
    'knn': MODELS_DIR / "knn.pkl"
}

FEATURE_NAMES = [
    'ax_mean', 'ax_std', 'ax_max', 'ax_min', 'ax_range', 'ax_median',
    'ay_mean', 'ay_std', 'ay_max', 'ay_min', 'ay_range', 'ay_median',
    'az_mean', 'az_std', 'az_max', 'az_min', 'az_range', 'az_median',
    'm_mean', 'm_std', 'm_max', 'm_min', 'm_range', 'm_median',
    'magnitude_mean', 'total_variation', 'energy', 'jerk_x', 'jerk_y', 'jerk_z'
]

# ============================================
# CLASSIFIER
# ============================================

class MotionClassifier:
    """Real-time motion classifier using scikit-learn models"""
    
    def __init__(self, model_name='random_forest', window_size=10):
        """Initialize classifier"""
        self.window_size = window_size
        self.buffer = []
        self.predictions_history = []
        self.model_name = model_name
        
        # Load scaler
        try:
            with open(SCALER_PATH, 'rb') as f:
                self.scaler = pickle.load(f)
            print(f"✅ Loaded scaler from {SCALER_PATH}")
        except Exception as e:
            print(f"❌ Error loading scaler: {e}")
            self.scaler = None
        
        # Load model
        model_path = MODEL_PATHS.get(model_name)
        if not model_path or not model_path.exists():
            print(f"❌ Model not found: {model_path}")
            print(f"💡 Available models: {list(MODEL_PATHS.keys())}")
            self.model = None
        else:
            try:
                self.model = joblib.load(model_path)
                print(f"✅ Loaded model: {model_name} from {model_path}")
            except Exception as e:
                print(f"❌ Error loading model: {e}")
                self.model = None
    
    def add_reading(self, ax, ay, az, m, r):
        """Add sensor reading to buffer"""
        self.buffer.append({'ax': ax, 'ay': ay, 'az': az, 'm': m, 'r': r})
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)
    
    def extract_features(self):
        """Extract features from buffer"""
        if len(self.buffer) < self.window_size:
            return None
        
        ax_vals = [s['ax'] for s in self.buffer]
        ay_vals = [s['ay'] for s in self.buffer]
        az_vals = [s['az'] for s in self.buffer]
        m_vals = [s['m'] for s in self.buffer]
        
        features = {
            'ax_mean': np.mean(ax_vals), 'ax_std': np.std(ax_vals),
            'ax_max': np.max(ax_vals), 'ax_min': np.min(ax_vals),
            'ax_range': np.max(ax_vals) - np.min(ax_vals), 'ax_median': np.median(ax_vals),
            'ay_mean': np.mean(ay_vals), 'ay_std': np.std(ay_vals),
            'ay_max': np.max(ay_vals), 'ay_min': np.min(ay_vals),
            'ay_range': np.max(ay_vals) - np.min(ay_vals), 'ay_median': np.median(ay_vals),
            'az_mean': np.mean(az_vals), 'az_std': np.std(az_vals),
            'az_max': np.max(az_vals), 'az_min': np.min(az_vals),
            'az_range': np.max(az_vals) - np.min(az_vals), 'az_median': np.median(az_vals),
            'm_mean': np.mean(m_vals), 'm_std': np.std(m_vals),
            'm_max': np.max(m_vals), 'm_min': np.min(m_vals),
            'm_range': np.max(m_vals) - np.min(m_vals), 'm_median': np.median(m_vals),
            'magnitude_mean': np.mean([np.sqrt(ax**2 + ay**2 + az**2) for ax, ay, az in zip(ax_vals, ay_vals, az_vals)]),
            'total_variation': sum(abs(ax_vals[i] - ax_vals[i-1]) + abs(ay_vals[i] - ay_vals[i-1]) + abs(az_vals[i] - az_vals[i-1]) for i in range(1, len(ax_vals))),
            'energy': sum(ax**2 + ay**2 + az**2 for ax, ay, az in zip(ax_vals, ay_vals, az_vals)),
            'jerk_x': sum(abs(ax_vals[i] - ax_vals[i-1]) for i in range(1, len(ax_vals))),
            'jerk_y': sum(abs(ay_vals[i] - ay_vals[i-1]) for i in range(1, len(ay_vals))),
            'jerk_z': sum(abs(az_vals[i] - az_vals[i-1]) for i in range(1, len(az_vals))),
        }
        
        return np.array([features.get(fname, 0) for fname in FEATURE_NAMES])
    
    def predict(self):
        """Predict motion classification"""
        if len(self.buffer) < self.window_size:
            return {
                'status': 'waiting',
                'buffer_size': len(self.buffer),
                'needed': self.window_size - len(self.buffer)
            }
        
        if self.model is None or self.scaler is None:
            return {'status': 'error', 'message': 'Model not loaded'}
        
        try:
            # Extract features
            features = self.extract_features()
            if features is None:
                return {'status': 'error', 'message': 'Could not extract features'}
            
            # Scale features
            features_scaled = self.scaler.transform([features])
            
            # Predict
            prediction = self.model.predict(features_scaled)[0]
            probability = self.model.predict_proba(features_scaled)[0]
            
            classification = 'Intentional' if prediction == 1 else 'Natural'
            confidence = max(probability)
            
            result = {
                'status': 'ready',
                'classification': classification,
                'confidence': float(confidence),
                'probability': float(probability[prediction]),
                'buffer_size': len(self.buffer),
                'model': self.model_name
            }
            
            self.predictions_history.append(result)
            return result
        
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

# ============================================
# GLOBAL CLASSIFIER INSTANCE
# ============================================

classifier = None

def get_classifier():
    """Get or create classifier"""
    global classifier
    if classifier is None:
        classifier = MotionClassifier('random_forest', window_size=10)
    return classifier

# ============================================
# REST API ENDPOINTS
# ============================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    clf = get_classifier()
    return jsonify({
        'status': 'ok',
        'model_loaded': clf.model is not None,
        'scaler_loaded': clf.scaler is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict motion classification"""
    try:
        data = request.get_json()
        
        ax = float(data.get('ax', 0))
        ay = float(data.get('ay', 0))
        az = float(data.get('az', 0))
        m = float(data.get('m', 0))
        r = int(data.get('r', -50))
        
        clf = get_classifier()
        clf.add_reading(ax, ay, az, m, r)
        result = clf.predict()
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/stats', methods=['GET'])
def stats():
    """Get prediction statistics"""
    clf = get_classifier()
    
    if not clf.predictions_history:
        return jsonify({
            'total_predictions': 0,
            'natural_count': 0,
            'intentional_count': 0,
            'avg_confidence': 0
        })
    
    predictions = clf.predictions_history
    natural_count = sum(1 for p in predictions if p.get('classification') == 'Natural')
    intentional_count = sum(1 for p in predictions if p.get('classification') == 'Intentional')
    avg_confidence = np.mean([p.get('confidence', 0) for p in predictions if 'confidence' in p])
    
    return jsonify({
        'total_predictions': len(predictions),
        'natural_count': natural_count,
        'intentional_count': intentional_count,
        'avg_confidence': float(avg_confidence),
        'model_used': clf.model_name
    })

@app.route('/reset', methods=['POST'])
def reset():
    """Reset classifier state"""
    clf = get_classifier()
    clf.buffer = []
    clf.predictions_history = []
    return jsonify({'status': 'ok', 'message': 'Classifier reset'})

@app.route('/models', methods=['GET'])
def list_models():
    """List available models"""
    available = {}
    for name, path in MODEL_PATHS.items():
        available[name] = {'exists': path.exists(), 'path': str(path)}
    return jsonify(available)

# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    print("🚀 Motion Classification Inference API")
    print("="*50)
    
    # Initialize classifier
    clf = get_classifier()
    
    if clf.model is None:
        print("⚠️ WARNING: No model loaded!")
        print("💡 Train models first with: python train_model.py")
    
    print("\n📡 Starting Flask API on http://localhost:5001")
    print("🔗 Endpoints:")
    print("  GET  /health       - Health check")
    print("  POST /predict      - Predict motion class")
    print("  GET  /stats        - Prediction statistics")
    print("  POST /reset        - Reset classifier")
    print("  GET  /models       - List available models")
    
    app.run(host='localhost', port=5001, debug=False, threaded=True)
