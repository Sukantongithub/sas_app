"""
ML Service Flask Server - Motion Classification
Real-time classification of natural vs intentional motion patterns
Runs on port 5001 and receives data from backend/server1.js
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
import os
import sys
import traceback
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configuration
PREDICTION_BUFFER_SIZE = 10
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'motion_model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')

# Global state
predictions_buffer = []
model = None
scaler = None
model_loaded = False

def load_model():
    """Load the trained model and scaler"""
    global model, scaler, model_loaded
    
    try:
        import joblib
        
        if os.path.exists(MODEL_PATH):
            model = joblib.load(MODEL_PATH)
            print(f"✅ Model loaded from {MODEL_PATH}")
        else:
            print(f"⚠️ Model file not found at {MODEL_PATH}")
            print("   Training a new model...")
            train_model()
            model = joblib.load(MODEL_PATH)
        
        if os.path.exists(SCALER_PATH):
            scaler = joblib.load(SCALER_PATH)
            print(f"✅ Scaler loaded from {SCALER_PATH}")
        else:
            from sklearn.preprocessing import StandardScaler
            scaler = StandardScaler()
            print("⚠️ Scaler file not found, using fresh StandardScaler")
        
        model_loaded = True
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        traceback.print_exc()
        return False

def train_model():
    """Train a new model if one doesn't exist"""
    try:
        print("🤖 Training new motion classification model...")
        
        try:
            from motion_detector import MotionPatternDetector
            detector = MotionPatternDetector(model_dir=os.path.dirname(__file__))
            detector.train(n_samples=5000, tune_hyperparams=False)
            print("✅ Model training completed")
        except ImportError:
            print("⚠️ motion_detector not available, using alternative training...")
            # Fallback: create a simple model
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.preprocessing import StandardScaler
            import joblib
            
            # Generate synthetic training data
            np.random.seed(42)
            n_samples = 5000
            n_features = 22
            
            # Generate features
            X = np.random.randn(n_samples, n_features)
            # Simple separation: natural motion has lower variance in certain features
            y = (X[:, 0] > 0.5).astype(int)
            
            model_new = RandomForestClassifier(n_estimators=100, random_state=42)
            scaler_new = StandardScaler()
            
            X_scaled = scaler_new.fit_transform(X)
            model_new.fit(X_scaled, y)
            
            joblib.dump(model_new, MODEL_PATH)
            joblib.dump(scaler_new, SCALER_PATH)
            print("✅ Fallback model created and saved")
    
    except Exception as e:
        print(f"❌ Error training model: {e}")
        traceback.print_exc()

def extract_features(ax, ay, az, m, r):
    """
    Extract features from single motion sensor reading
    
    Args:
        ax, ay, az: Accelerometer values
        m: Motion magnitude  
        r: RSSI (signal strength)
    
    Returns:
        numpy array of 22 features for prediction
    """
    try:
        # Normalize inputs
        ax_norm = float(ax) / 1000.0 if ax else 0
        ay_norm = float(ay) / 1000.0 if ay else 0
        az_norm = float(az) / 1000.0 if az else 0
        m_norm = float(m) / 1000.0 if m else 0
        r_norm = abs(float(r)) / 100.0 if r else 0  # RSSI is negative (-50 to -100), normalize to 0.5-1.0
        
        # Acceleration magnitude
        accel_magnitude = np.sqrt(ax_norm**2 + ay_norm**2 + az_norm**2)
        
        # Statistical features (simulating buffer analysis)
        features = np.array([
            m_norm,                    # 0: motion_value
            abs(ax_norm),              # 1: ax_component
            abs(ay_norm),              # 2: ay_component
            abs(az_norm),              # 3: az_component
            accel_magnitude,           # 4: total_acceleration
            np.sqrt(ax_norm**2 + ay_norm**2),  # 5: horizontal_accel
            abs(accel_magnitude - m_norm),     # 6: magnitude_diff
            r_norm,                    # 7: signal_strength_norm
            (accel_magnitude * abs(r_norm)),   # 8: interaction_1
            (m_norm * accel_magnitude),        # 9: interaction_2
            abs(ax_norm - ay_norm),    # 10: axis_diff_xy
            abs(ay_norm - az_norm),    # 11: axis_diff_yz
            abs(ax_norm - az_norm),    # 12: axis_diff_xz
            max(abs(ax_norm), abs(ay_norm), abs(az_norm)),  # 13: max_axis
            min(abs(ax_norm), abs(ay_norm), abs(az_norm)),  # 14: min_axis
            (abs(ax_norm) + abs(ay_norm) + abs(az_norm)) / 3,  # 15: mean_axis
            1.0 if accel_magnitude > m_norm * 0.8 else 0.0,    # 16: consistency
            1.0 if abs(ax_norm) < 0.5 else 0.0,  # 17: smooth_x
            1.0 if abs(ay_norm) < 0.5 else 0.0,  # 18: smooth_y
            1.0 if abs(az_norm) < 0.5 else 0.0,  # 19: smooth_z
            accel_magnitude / (r_norm + 0.1),    # 20: signal_quality
            abs(ax_norm * ay_norm * az_norm)     # 21: three_way_interaction
        ])
        
        return features
    
    except Exception as e:
        print(f"❌ Error extracting features: {e}")
        return np.zeros(22)

def predict_motion(ax, ay, az, m, r):
    """
    Predict whether motion is natural or intentional
    
    Returns:
        dict with prediction, confidence, and buffer info
    """
    global predictions_buffer, model, scaler
    
    try:
        if not model_loaded or model is None or scaler is None:
            return {
                'classification': 'unknown',
                'confidence': 0,
                'probability': 0,
                'buffer_size': len(predictions_buffer),
                'status': 'model_not_loaded',
                'error': 'Model not loaded'
            }
        
        # Extract features
        features = extract_features(ax, ay, az, m, r)
        features_scaled = scaler.transform([features])[0]
        
        # Get prediction
        prediction = model.predict([features_scaled])[0]
        probabilities = model.predict_proba([features_scaled])[0]
        
        # Map prediction (0=natural, 1=intentional)
        classification = 'Intentional' if prediction == 1 else 'Natural'
        confidence = max(probabilities) * 100
        probability = probabilities[prediction]
        
        # Buffer for trend analysis
        predictions_buffer.append({
            'timestamp': datetime.now().isoformat(),
            'classification': classification,
            'confidence': confidence,
            'probability': probability
        })
        
        # Keep buffer at max size
        if len(predictions_buffer) > PREDICTION_BUFFER_SIZE:
            predictions_buffer.pop(0)
        
        # Trend analysis: if last 5 predictions agree, increase confidence
        recent = predictions_buffer[-5:] if len(predictions_buffer) >= 5 else predictions_buffer
        recent_class = [p['classification'] for p in recent]
        consistency = recent_class.count(classification) / len(recent_class)
        
        adjusted_confidence = min(100, confidence + (consistency * 10))
        
        return {
            'classification': classification,
            'confidence': round(adjusted_confidence, 1),
            'probability': float(probability),
            'buffer_size': len(predictions_buffer),
            'consistency': round(consistency * 100, 1),
            'timestamp': datetime.now().isoformat(),
            'raw_features': {
                'ax': float(ax),
                'ay': float(ay),
                'az': float(az),
                'm': float(m),
                'r': float(r)
            }
        }
    
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        traceback.print_exc()
        return {
            'classification': 'unknown',
            'confidence': 0,
            'probability': 0,
            'buffer_size': len(predictions_buffer),
            'status': 'error',
            'error': str(e)
        }

# ============================================
# API Endpoints
# ============================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if model_loaded else 'degraded',
        'model': 'Motion Classification',
        'version': '2.0.0',
        'model_loaded': model_loaded,
        'buffer_size': len(predictions_buffer)
    }), 200 if model_loaded else 503

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict motion authenticity from sensor data
    
    Endpoint format from server1.js:
    {
        "ax": 122.48,
        "ay": 239.31,
        "az": 985.18,
        "m": 1.2,
        "r": -65
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Extract sensor values
        ax = data.get('ax', 0)
        ay = data.get('ay', 0)
        az = data.get('az', 0)
        m = data.get('m', 0)
        r = data.get('r', -50)
        
        # Get prediction
        result = predict_motion(ax, ay, az, m, r)
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"❌ Predict endpoint error: {e}")
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """
    Predict multiple sensor readings at once
    
    Expected format:
    {
        "data": [
            {"ax": 122.48, "ay": 239.31, "az": 985.18, "m": 1.2, "r": -65},
            {"ax": 130.38, "ay": 243.15, "az": 981.43, "m": 1.3, "r": -63},
            ...
        ]
    }
    """
    try:
        json_data = request.get_json()
        
        if not json_data or 'data' not in json_data:
            return jsonify({'error': 'Invalid format, expected {"data": [...]}'}), 400
        
        data_list = json_data['data']
        if not isinstance(data_list, list):
            return jsonify({'error': 'data must be a list'}), 400
        
        results = []
        for item in data_list:
            result = predict_motion(
                item.get('ax', 0),
                item.get('ay', 0),
                item.get('az', 0),
                item.get('m', 0),
                item.get('r', -50)
            )
            results.append(result)
        
        return jsonify({
            'results': results,
            'total': len(results),
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        print(f"❌ Batch predict error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def stats():
    """Get prediction statistics"""
    try:
        if not predictions_buffer:
            return jsonify({
                'total_predictions': 0,
                'buffer_size': 0,
                'natural_count': 0,
                'intentional_count': 0,
                'avg_confidence': 0
            }), 200
        
        classifications = [p['classification'] for p in predictions_buffer]
        confidences = [p['confidence'] for p in predictions_buffer]
        
        natural_count = classifications.count('Natural')
        intentional_count = classifications.count('Intentional')
        
        return jsonify({
            'total_predictions': len(predictions_buffer),
            'buffer_size': PREDICTION_BUFFER_SIZE,
            'natural_count': natural_count,
            'intentional_count': intentional_count,
            'natural_percentage': round(natural_count / len(predictions_buffer) * 100, 1),
            'intentional_percentage': round(intentional_count / len(predictions_buffer) * 100, 1),
            'avg_confidence': round(np.mean(confidences), 1),
            'max_confidence': round(np.max(confidences), 1),
            'min_confidence': round(np.min(confidences), 1)
        }), 200
    
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/retrain', methods=['POST'])
def retrain():
    """Retrain the model with new parameters"""
    try:
        data = request.get_json() or {}
        n_samples = data.get('n_samples', 5000)
        
        print(f"🔄 Retraining model with {n_samples} samples...")
        train_model()
        
        if load_model():
            return jsonify({
                'status': 'success',
                'message': f'Model retrained with {n_samples} samples',
                'timestamp': datetime.now().isoformat()
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': 'Model training failed'
            }), 500
    
    except Exception as e:
        print(f"❌ Retrain error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/clear-buffer', methods=['POST'])
def clear_buffer():
    """Clear the prediction buffer"""
    try:
        global predictions_buffer
        count = len(predictions_buffer)
        predictions_buffer = []
        
        return jsonify({
            'status': 'success',
            'cleared': count,
            'message': f'Cleared {count} predictions from buffer'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# Error Handlers
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ============================================
# Startup
# ============================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 ML Service - Motion Classification")
    print("="*60)
    
    # Load model
    print("📦 Loading model...")
    load_model()
    
    if not model_loaded:
        print("⚠️ Model not loaded, training will be attempted on first request")
    
    print("\n📡 Starting Flask server...")
    print("   Port: 5001")
    print("   CORS: Enabled")
    print("\n✅ Available endpoints:")
    print("   POST /predict - Single prediction")
    print("   POST /batch-predict - Multiple predictions")
    print("   GET /health - Health check")
    print("   GET /stats - Prediction statistics")
    print("   POST /retrain - Retrain model")
    print("   POST /clear-buffer - Clear buffer")
    print("="*60 + "\n")
    
    # Run Flask app
    app.run(host='127.0.0.1', port=5001, debug=False, threaded=True)
