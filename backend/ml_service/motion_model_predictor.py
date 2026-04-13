#!/usr/bin/env python3
"""
Motion Model Prediction Service
Make predictions on new motion sensor data using trained models
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from datetime import datetime
import json

class MotionModelPredictor:
    def __init__(self, models_dir='models'):
        """Initialize predictor with trained models."""
        self.models_dir = Path(models_dir)
        self.models = {}
        self.scaler = None
        self.label_encoder = None
        self.feature_cols = None
        self.load_models()
        
    def load_models(self):
        """Load trained models and preprocessors."""
        print("[*] Loading trained models...")
        
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
            
            print("✓ Models loaded successfully")
            return True
            
        except FileNotFoundError as e:
            print(f"✗ Error loading models: {e}")
            return False
    
    def prepare_features(self, ax, ay, az, rssi, timestamp=None):
        """Prepare features from raw sensor data."""
        if timestamp is None:
            timestamp = datetime.now()
        elif isinstance(timestamp, str):
            timestamp = pd.to_datetime(timestamp)
        
        # Calculate derived features
        motion_magnitude = np.sqrt(ax**2 + ay**2 + az**2)
        total_acceleration = motion_magnitude
        
        # Extract time components
        hour = timestamp.hour
        minute = timestamp.minute
        second = timestamp.second
        
        # Create feature vector
        features = {
            'ax': ax,
            'ay': ay,
            'az': az,
            'motion_magnitude': motion_magnitude,
            'total_acceleration': total_acceleration,
            'ax_abs': abs(ax),
            'ay_abs': abs(ay),
            'az_abs': abs(az),
            'rssi': rssi,
            'hour': hour,
            'minute': minute,
            'second': second
        }
        
        return features
    
    def predict_single(self, ax, ay, az, rssi, timestamp=None, model_name='random_forest'):
        """Make prediction for a single data point."""
        # Prepare features
        features = self.prepare_features(ax, ay, az, rssi, timestamp)
        
        # Create feature vector in correct order
        X = np.array([[features[col] for col in self.feature_cols]])
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Get model
        if model_name not in self.models:
            print(f"✗ Model '{model_name}' not found. Available: {list(self.models.keys())}")
            return None
        
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
            'timestamp': str(timestamp),
            'probabilities': {
                self.label_encoder.classes_[i]: float(prob * 100)
                for i, prob in enumerate(probabilities)
            },
            'input_features': {
                'ax': ax,
                'ay': ay,
                'az': az,
                'rssi': rssi
            }
        }
        
        return result
    
    def predict_batch(self, data_list, model_name='random_forest'):
        """Make predictions for multiple data points."""
        results = []
        
        for data in data_list:
            ax = data.get('ax')
            ay = data.get('ay')
            az = data.get('az')
            rssi = data.get('rssi')
            timestamp = data.get('timestamp')
            
            if any(v is None for v in [ax, ay, az, rssi]):
                print(f"⚠ Skipping incomplete data: {data}")
                continue
            
            result = self.predict_single(ax, ay, az, rssi, timestamp, model_name)
            if result:
                results.append(result)
        
        return results
    
    def predict_from_csv(self, csv_path, model_name='random_forest'):
        """Make predictions from CSV file."""
        df = pd.read_csv(csv_path)
        
        results = []
        for idx, row in df.iterrows():
            result = self.predict_single(
                ax=row['ax'],
                ay=row['ay'],
                az=row['az'],
                rssi=row['rssi'],
                timestamp=row.get('timestamp'),
                model_name=model_name
            )
            if result:
                results.append(result)
        
        return results
    
    def ensemble_predict(self, ax, ay, az, rssi, timestamp=None):
        """Make ensemble prediction using all models."""
        predictions = {}
        confidence_scores = {}
        
        for model_name in self.models.keys():
            result = self.predict_single(ax, ay, az, rssi, timestamp, model_name)
            if result:
                predictions[model_name] = result['prediction']
                confidence_scores[model_name] = result['confidence']
        
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
            'timestamp': str(timestamp),
            'input_features': {
                'ax': ax,
                'ay': ay,
                'az': az,
                'rssi': rssi
            }
        }
        
        return ensemble_result

def main():
    """Example usage."""
    print("=" * 70)
    print("MOTION MODEL PREDICTION SERVICE")
    print("=" * 70)
    
    # Initialize predictor
    predictor = MotionModelPredictor()
    
    # Example 1: Single prediction (natural-like motion)
    print("\n[Example 1] Single Prediction - Natural-like Motion")
    result = predictor.predict_single(
        ax=10.5, ay=0.8, az=1.9, rssi=-55,
        timestamp=datetime.now(),
        model_name='random_forest'
    )
    print(f"  Prediction: {result['prediction']}")
    print(f"  Confidence: {result['confidence']:.2f}%")
    print(f"  Probabilities: {result['probabilities']}")
    
    # Example 2: Single prediction (artificial-like motion)
    print("\n[Example 2] Single Prediction - Artificial-like Motion")
    result = predictor.predict_single(
        ax=5.2, ay=12.5, az=8.9, rssi=-70,
        timestamp=datetime.now(),
        model_name='random_forest'
    )
    print(f"  Prediction: {result['prediction']}")
    print(f"  Confidence: {result['confidence']:.2f}%")
    print(f"  Probabilities: {result['probabilities']}")
    
    # Example 3: Ensemble prediction
    print("\n[Example 3] Ensemble Prediction")
    result = predictor.ensemble_predict(
        ax=8.5, ay=6.2, az=3.1, rssi=-68,
        timestamp=datetime.now()
    )
    print(f"  Ensemble Prediction: {result['ensemble_prediction']}")
    print(f"  Ensemble Confidence: {result['ensemble_confidence']:.2f}%")
    print(f"  Model Agreement: {result['agreement']}")
    print(f"  Individual Predictions: {result['individual_predictions']}")
    
    # Example 4: Batch prediction
    print("\n[Example 4] Batch Prediction")
    batch_data = [
        {'ax': 10.2, 'ay': 0.5, 'az': 1.8, 'rssi': -54},
        {'ax': 6.5, 'ay': 15.2, 'az': 9.5, 'rssi': -72},
        {'ax': 9.8, 'ay': 1.2, 'az': 2.1, 'rssi': -56},
    ]
    
    batch_results = predictor.predict_batch(batch_data, model_name='random_forest')
    for idx, result in enumerate(batch_results, 1):
        print(f"  Sample {idx}: {result['prediction']} ({result['confidence']:.2f}%)")
    
    print("\n" + "=" * 70)
    print("PREDICTION SERVICE READY")
    print("=" * 70)

if __name__ == '__main__':
    main()
