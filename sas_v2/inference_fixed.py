#!/usr/bin/env python3
"""
Real-time Motion Classification Inference
Load trained model and classify incoming accelerometer data as Natural or Intentional
"""

import numpy as np
import pickle
import tensorflow as tf
from pathlib import Path
import json

class MotionClassifier:
    """Real-time motion classifier"""
    
    def __init__(self, model_path, scaler_path, window_size=10):
        """
        Initialize classifier with trained model and scaler
        
        Args:
            model_path: Path to trained .keras model
            scaler_path: Path to saved StandardScaler pickle
            window_size: Number of samples to buffer before prediction
        """
        print(f"📂 Loading model from {model_path}")
        self.model = tf.keras.models.load_model(model_path)
        
        print(f"📂 Loading scaler from {scaler_path}")
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        
        self.window_size = window_size
        self.buffer = []
        self.predictions_history = []
        
        print(f"✅ Classifier initialized (window size: {window_size})")
    
    def add_reading(self, ax, ay, az, m, r):
        """
        Add single sensor reading to buffer
        
        Args:
            ax, ay, az: Acceleration values (m/s²)
            m: Motion intensity
            r: RSSI (WiFi signal strength)
        """
        self.buffer.append([ax, ay, az, m, r])
        
        # Maintain buffer size
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)
    
    def predict(self):
        """
        Predict motion classification
        
        Returns:
            dict: {
                'status': 'ready'/'waiting',
                'classification': 'Natural'/'Intentional',
                'probability': float (0-1),
                'confidence': float (0-1),
                'buffer_size': int
            }
            or None if not enough data
        """
        if len(self.buffer) < self.window_size:
            return {
                'status': 'waiting',
                'buffer_size': len(self.buffer),
                'needed': self.window_size - len(self.buffer)
            }
        
        # Prepare data
        X = np.array([self.buffer])
        
        # Normalize using saved scaler
        X_flat = X.reshape(-1, 5)
        X_scaled = self.scaler.transform(X_flat)
        X_scaled = X_scaled.reshape(1, self.window_size, 5)
        
        # Predict
        prob = self.model.predict(X_scaled, verbose=0)[0][0]
        
        result = {
            'status': 'ready',
            'probability': float(prob),
            'classification': 'Intentional' if prob > 0.5 else 'Natural',
            'confidence': float(max(prob, 1 - prob)),
            'buffer_size': len(self.buffer)
        }
        
        self.predictions_history.append(result)
        return result
    
    def get_statistics(self):
        """Get prediction statistics"""
        if not self.predictions_history:
            return None
        
        probs = [p['probability'] for p in self.predictions_history]
        classifications = [p['classification'] for p in self.predictions_history]
        
        return {
            'total_predictions': len(self.predictions_history),
            'avg_probability': float(np.mean(probs)),
            'natural_count': classifications.count('Natural'),
            'intentional_count': classifications.count('Intentional'),
            'recent_5': classifications[-5:] if len(classifications) >= 5 else classifications
        }

# ============================================
# Flask REST API for real-time predictions
# ============================================

def create_flask_app(model_path, scaler_path):
    """Create Flask app for REST API"""
    from flask import Flask, request, jsonify
    
    app = Flask(__name__)
    classifier = MotionClassifier(model_path, scaler_path)
    
    @app.route('/predict', methods=['POST'])
    def predict():
        """
        POST /predict
        Expected JSON: {ax, ay, az, m, r}
        """
        try:
            data = request.get_json()
            
            ax = float(data.get('ax', 0))
            ay = float(data.get('ay', 0))
            az = float(data.get('az', 0))
            m = float(data.get('m', 0))
            r = int(data.get('r', -50))
            
            classifier.add_reading(ax, ay, az, m, r)
            result = classifier.predict()
            
            return jsonify(result), 200
        
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
    @app.route('/stats', methods=['GET'])
    def stats():
        """GET /stats - Get prediction statistics"""
        return jsonify(classifier.get_statistics()), 200
    
    @app.route('/health', methods=['GET'])
    def health():
        """GET /health - Health check"""
        return jsonify({'status': 'ok'}), 200
    
    return app

# ============================================
# Main
# ============================================

if __name__ == "__main__":
    import sys
    
    # Paths
    model_path = "m:\\tmp\\MAD\\models\\model_CNN_LSTM.keras"
    scaler_path = "m:\\tmp\\MAD\\models\\scaler.pkl"
    
    # Check if model exists
    if not Path(model_path).exists():
        print(f"❌ Model not found: {model_path}")
        print("   Run train_model_fixed.py first")
        sys.exit(1)
    
    # Start Flask API
    print("\n" + "="*60)
    print("🚀 Starting Motion Classification API")
    print("="*60)
    
    app = create_flask_app(model_path, scaler_path)
    print("\n📡 Starting server on http://0.0.0.0:5001")
    print("   POST /predict - Classify motion")
    print("   GET /stats - Get statistics")
    print("   GET /health - Health check\n")
    
    app.run(host='0.0.0.0', port=5001, debug=False)
