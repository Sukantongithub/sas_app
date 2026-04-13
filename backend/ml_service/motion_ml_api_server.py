#!/usr/bin/env python3
"""
Motion ML REST API Server
Provides REST endpoints for real-time motion prediction
Integration with Node.js backend via HTTP
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
from pathlib import Path
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class MotionMLService:
    def __init__(self, models_dir='models'):
        """Initialize ML service with trained models."""
        self.models_dir = Path(models_dir)
        self.models = {}
        self.scaler = None
        self.label_encoder = None
        self.feature_cols = None
        self.load_models()
        
    def load_models(self):
        """Load all trained models and preprocessors."""
        try:
            self.models['random_forest'] = joblib.load(
                self.models_dir / 'motion_model_random_forest.pkl'
            )
            self.models['gradient_boosting'] = joblib.load(
                self.models_dir / 'motion_model_gradient_boosting.pkl'
            )
            self.models['svm'] = joblib.load(
                self.models_dir / 'motion_model_svm.pkl'
            )
            
            self.scaler = joblib.load(self.models_dir / 'motion_scaler.pkl')
            self.label_encoder = joblib.load(self.models_dir / 'motion_label_encoder.pkl')
            
            self.feature_cols = [
                'ax', 'ay', 'az',
                'motion_magnitude', 'total_acceleration',
                'ax_abs', 'ay_abs', 'az_abs',
                'rssi', 'hour', 'minute', 'second'
            ]
            
            logger.info("✓ All models loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"✗ Error loading models: {e}")
            return False
    
    def prepare_features(self, ax, ay, az, rssi, timestamp=None):
        """Prepare features from raw sensor data."""
        try:
            if timestamp is None:
                timestamp = datetime.now()
            elif isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            
            # Calculate derived features
            motion_magnitude = np.sqrt(ax**2 + ay**2 + az**2)
            total_acceleration = motion_magnitude
            
            # Extract time components
            hour = timestamp.hour
            minute = timestamp.minute
            second = timestamp.second
            
            # Create feature vector
            features = {
                'ax': float(ax),
                'ay': float(ay),
                'az': float(az),
                'motion_magnitude': float(motion_magnitude),
                'total_acceleration': float(total_acceleration),
                'ax_abs': float(abs(ax)),
                'ay_abs': float(abs(ay)),
                'az_abs': float(abs(az)),
                'rssi': int(rssi),
                'hour': int(hour),
                'minute': int(minute),
                'second': int(second)
            }
            
            return features, None
            
        except Exception as e:
            return None, f"Error preparing features: {str(e)}"
    
    def predict_single(self, ax, ay, az, rssi, timestamp=None, model_name='random_forest'):
        """Make prediction for a single data point."""
        try:
            # Prepare features
            features, error = self.prepare_features(ax, ay, az, rssi, timestamp)
            if error:
                return None, error
            
            # Create feature vector in correct order
            X = np.array([[features[col] for col in self.feature_cols]])
            
            # Scale features
            X_scaled = self.scaler.transform(X)
            
            # Get model
            if model_name not in self.models:
                return None, f"Model '{model_name}' not found"
            
            model = self.models[model_name]
            
            # Make prediction
            prediction = model.predict(X_scaled)[0]
            probabilities = model.predict_proba(X_scaled)[0]
            
            # Decode prediction
            prediction_label = self.label_encoder.inverse_transform([prediction])[0]
            
            result = {
                'prediction': prediction_label,
                'confidence': float(probabilities[prediction] * 100),
                'model': model_name,
                'timestamp': timestamp.isoformat() if timestamp else datetime.now().isoformat(),
                'probabilities': {
                    self.label_encoder.classes_[i]: float(prob * 100)
                    for i, prob in enumerate(probabilities)
                },
                'input_features': {
                    'ax': float(ax),
                    'ay': float(ay),
                    'az': float(az),
                    'rssi': int(rssi)
                }
            }
            
            return result, None
            
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            return None, f"Prediction error: {str(e)}"
    
    def ensemble_predict(self, ax, ay, az, rssi, timestamp=None):
        """Make ensemble prediction using all models."""
        try:
            predictions = {}
            confidence_scores = {}
            
            for model_name in self.models.keys():
                result, error = self.predict_single(ax, ay, az, rssi, timestamp, model_name)
                if result:
                    predictions[model_name] = result['prediction']
                    confidence_scores[model_name] = result['confidence']
            
            if not predictions:
                return None, "No models available for prediction"
            
            # Determine majority vote
            from collections import Counter
            votes = Counter(predictions.values())
            ensemble_prediction = votes.most_common(1)[0][0]
            
            # Calculate average confidence
            avg_confidence = np.mean(list(confidence_scores.values()))
            
            ensemble_result = {
                'ensemble_prediction': ensemble_prediction,
                'ensemble_confidence': float(avg_confidence),
                'individual_predictions': predictions,
                'individual_confidence': confidence_scores,
                'agreement': len(set(predictions.values())) == 1,
                'timestamp': timestamp.isoformat() if timestamp else datetime.now().isoformat(),
                'input_features': {
                    'ax': float(ax),
                    'ay': float(ay),
                    'az': float(az),
                    'rssi': int(rssi)
                }
            }
            
            return ensemble_result, None
            
        except Exception as e:
            logger.error(f"Ensemble prediction error: {str(e)}")
            return None, f"Ensemble error: {str(e)}"

# Initialize service
ml_service = MotionMLService()

# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'models_loaded': len(ml_service.models),
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/motion/predict', methods=['POST'])
def predict_single():
    """
    Single prediction on motion data.
    
    Request Body:
    {
        "ax": 10.5,
        "ay": 0.8,
        "az": 1.9,
        "rssi": -55,
        "timestamp": "2026-04-13T12:00:00Z",
        "model": "random_forest"  (optional, default: random_forest)
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields
        required_fields = ['ax', 'ay', 'az', 'rssi']
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            return jsonify({'error': f'Missing required fields: {missing}'}), 400
        
        ax = float(data['ax'])
        ay = float(data['ay'])
        az = float(data['az'])
        rssi = int(data['rssi'])
        timestamp = data.get('timestamp')
        model_name = data.get('model', 'random_forest')
        
        # Validate value ranges
        if rssi > 0 or rssi < -100:
            return jsonify({'error': 'RSSI must be between -100 and 0 dBm'}), 400
        
        # Make prediction
        result, error = ml_service.predict_single(ax, ay, az, rssi, timestamp, model_name)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except ValueError as e:
        return jsonify({'error': f'Invalid data type: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error in /predict endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/motion/predict/batch', methods=['POST'])
def predict_batch():
    """
    Batch predictions on multiple motion samples.
    
    Request Body:
    {
        "samples": [
            {"ax": 10.5, "ay": 0.8, "az": 1.9, "rssi": -55},
            {"ax": 5.2, "ay": 12.5, "az": 8.9, "rssi": -70}
        ],
        "model": "random_forest"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'samples' not in data:
            return jsonify({'error': 'No samples provided'}), 400
        
        samples = data['samples']
        if not isinstance(samples, list):
            return jsonify({'error': 'Samples must be a list'}), 400
        
        if len(samples) == 0:
            return jsonify({'error': 'Samples list is empty'}), 400
        
        if len(samples) > 100:
            return jsonify({'error': 'Maximum 100 samples per request'}), 400
        
        model_name = data.get('model', 'random_forest')
        results = []
        errors = []
        
        for idx, sample in enumerate(samples):
            required_fields = ['ax', 'ay', 'az', 'rssi']
            missing = [f for f in required_fields if f not in sample]
            
            if missing:
                errors.append(f"Sample {idx}: Missing fields {missing}")
                continue
            
            try:
                ax = float(sample['ax'])
                ay = float(sample['ay'])
                az = float(sample['az'])
                rssi = int(sample['rssi'])
                timestamp = sample.get('timestamp')
                
                result, error = ml_service.predict_single(ax, ay, az, rssi, timestamp, model_name)
                
                if error:
                    errors.append(f"Sample {idx}: {error}")
                else:
                    results.append(result)
                    
            except Exception as e:
                errors.append(f"Sample {idx}: {str(e)}")
        
        return jsonify({
            'success': len(errors) == 0,
            'predictions': results,
            'total_processed': len(samples),
            'successful': len(results),
            'failed': len(errors),
            'errors': errors if errors else None
        }), 200 if len(results) > 0 else 400
        
    except Exception as e:
        logger.error(f"Error in /predict/batch endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/motion/predict/ensemble', methods=['POST'])
def predict_ensemble():
    """
    Ensemble prediction using all 3 models.
    
    Request Body:
    {
        "ax": 10.5,
        "ay": 0.8,
        "az": 1.9,
        "rssi": -55,
        "timestamp": "2026-04-13T12:00:00Z"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        required_fields = ['ax', 'ay', 'az', 'rssi']
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            return jsonify({'error': f'Missing required fields: {missing}'}), 400
        
        ax = float(data['ax'])
        ay = float(data['ay'])
        az = float(data['az'])
        rssi = int(data['rssi'])
        timestamp = data.get('timestamp')
        
        # Make ensemble prediction
        result, error = ml_service.ensemble_predict(ax, ay, az, rssi, timestamp)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except ValueError as e:
        return jsonify({'error': f'Invalid data type: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error in /predict/ensemble endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/motion/status', methods=['GET'])
def status():
    """Get service status and model information."""
    return jsonify({
        'status': 'operational',
        'models': {
            'available': list(ml_service.models.keys()),
            'count': len(ml_service.models),
            'default': 'random_forest'
        },
        'features': ml_service.feature_cols,
        'scaler': 'StandardScaler' if ml_service.scaler else None,
        'encoder': 'LabelEncoder' if ml_service.label_encoder else None,
        'timestamp': datetime.now().isoformat()
    }), 200

# ============================================================================
# COMPATIBILITY ENDPOINTS (Legacy API Support)
# ============================================================================

@app.route('/api/predict', methods=['POST'])
def predict_sequence():
    """
    Legacy compatibility endpoint for motion sequence prediction.
    Accepts motion magnitude sequence and applies simple heuristics.
    
    Request Body:
    {
        "motion_sequence": [25000, 24800, 25200, ...]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'motion_sequence' not in data:
            return jsonify({'error': 'motion_sequence is required'}), 400
        
        motion_sequence = data['motion_sequence']
        
        if not isinstance(motion_sequence, list) or len(motion_sequence) == 0:
            return jsonify({'error': 'motion_sequence must be a non-empty list'}), 400
        
        # Convert motion magnitudes to float
        motion_sequence = [float(x) for x in motion_sequence]
        
        # Simple heuristic analysis
        mean_magnitude = np.mean(motion_sequence)
        variance = np.var(motion_sequence)
        std = np.sqrt(variance)
        
        # Count sudden changes (spikes)
        diffs = [abs(motion_sequence[i] - motion_sequence[i-1]) 
                for i in range(1, len(motion_sequence))]
        
        if len(diffs) > 0:
            avg_diff = np.mean(diffs)
            diff_std = np.std(diffs)
            spike_threshold = avg_diff + 2 * diff_std
            spike_count = sum(1 for d in diffs if d > spike_threshold)
        else:
            spike_count = 0
        
        # Artificial patterns have high variance and frequent spikes
        is_artificial = (std > 5000 or spike_count > len(motion_sequence) / 4)
        confidence = min(0.95, max(0.5, (spike_count / max(len(motion_sequence), 1)) * 1.5))
        
        return jsonify({
            'prediction': 1 if is_artificial else 0,
            'label': 'Artificial' if is_artificial else 'Genuine',
            'confidence': float(confidence),
            'genuine_probability': float(1 - confidence if is_artificial else confidence),
            'artificial_probability': float(confidence if is_artificial else 1 - confidence),
            'features': {
                'motion_value': float(mean_magnitude),
                'motion_variance': float(variance),
                'motion_std': float(std),
                'spike_count': int(spike_count)
            }
        }), 200
        
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid data type: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error in /api/predict endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/predict-single', methods=['POST'])
def predict_single_legacy():
    """
    Legacy compatibility endpoint for single motion prediction.
    
    Request Body:
    {
        "motion_value": 25000
    }
    or
    {
        "motion_values": [25000, 24800, 25200]
    }
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
        
        # Use same logic as /api/predict
        mean_magnitude = np.mean(motion_sequence)
        variance = np.var(motion_sequence)
        std = np.sqrt(variance)
        
        diffs = [abs(motion_sequence[i] - motion_sequence[i-1]) 
                for i in range(1, len(motion_sequence))]
        
        if len(diffs) > 0:
            avg_diff = np.mean(diffs)
            diff_std = np.std(diffs)
            spike_threshold = avg_diff + 2 * diff_std
            spike_count = sum(1 for d in diffs if d > spike_threshold)
        else:
            spike_count = 0
        
        is_artificial = (std > 5000 or spike_count > len(motion_sequence) / 4)
        confidence = min(0.95, max(0.5, (spike_count / max(len(motion_sequence), 1)) * 1.5))
        
        return jsonify({
            'prediction': 1 if is_artificial else 0,
            'label': 'Artificial' if is_artificial else 'Genuine',
            'confidence': float(confidence),
            'genuine_probability': float(1 - confidence if is_artificial else confidence),
            'artificial_probability': float(confidence if is_artificial else 1 - confidence),
            'features': {
                'motion_value': float(mean_magnitude),
                'motion_variance': float(variance),
                'motion_std': float(std),
                'spike_count': int(spike_count)
            }
        }), 200
        
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid data type: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error in /api/predict-single endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    logger.info("🚀 Starting Motion ML REST API Server...")
    logger.info(f"📦 Models loaded: {len(ml_service.models)}")
    logger.info("🔗 Available endpoints:")
    logger.info("   POST /api/motion/predict - Single prediction (raw sensor data)")
    logger.info("   POST /api/motion/predict/batch - Batch predictions")
    logger.info("   POST /api/motion/predict/ensemble - Ensemble prediction")
    logger.info("   GET  /api/motion/status - Service status")
    logger.info("   POST /api/predict - Legacy: Motion sequence prediction")
    logger.info("   POST /api/predict-single - Legacy: Single motion prediction")
    logger.info("   GET  /health - Health check")
    logger.info("\n⚡ Starting server on http://localhost:5001\n")
    
    app.run(host='0.0.0.0', port=5001, debug=False)
