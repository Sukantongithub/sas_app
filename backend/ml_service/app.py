from flask import Flask, request, jsonify
from flask_cors import CORS
from motion_detector import MotionPatternDetector
import numpy as np

app = Flask(__name__)
CORS(app)

# Initialize the detector
detector = MotionPatternDetector()

# Try to load existing model, or train a new one
try:
    detector.load()
    print("✓ Model loaded successfully")
except:
    print("! Existing model not found. Training new enhanced model...")
    detector.train(n_samples=5000)

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict motion pattern authenticity
    Expected JSON: {"motion_sequence": [10000, 15000, 12000, ...]}
    """
    try:
        data = request.get_json()
        
        if not data or 'motion_sequence' not in data:
            return jsonify({'error': 'motion_sequence is required'}), 400
        
        motion_sequence = data['motion_sequence']
        
        if not isinstance(motion_sequence, list) or len(motion_sequence) == 0:
            return jsonify({'error': 'motion_sequence must be a non-empty list'}), 400
        
        # Ensure all values are numeric
        motion_sequence = [float(x) for x in motion_sequence]
        
        # Get prediction
        result = detector.predict(motion_sequence)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict-single', methods=['POST'])
def predict_single():
    """
    Predict with a single motion value or short sequence
    Expected JSON: {"motion_value": 25000} or {"motion_values": [25000, 24800, 25200]}
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Handle single value
        if 'motion_value' in data:
            motion_value = float(data['motion_value'])
            # Create a sequence by repeating the value (assumes recent consistency)
            motion_sequence = [motion_value] * 10
        elif 'motion_values' in data:
            motion_sequence = [float(x) for x in data['motion_values']]
        else:
            return jsonify({'error': 'motion_value or motion_values is required'}), 400
        
        result = detector.predict(motion_sequence)
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': 'Motion Pattern Detector',
        'version': '1.0.0'
    }), 200

@app.route('/api/retrain', methods=['POST'])
def retrain():
    """Retrain the model with new parameters"""
    try:
        data = request.get_json() or {}
        n_samples = data.get('n_samples', 5000)
        
        print(f"Retraining model with {n_samples} samples...")
        detector.train(n_samples=n_samples)
        
        return jsonify({
            'status': 'success',
            'message': f'Model retrained with {n_samples} samples'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Motion Pattern Detection API on port 5001...")
    app.run(debug=False, host='0.0.0.0', port=5001)
