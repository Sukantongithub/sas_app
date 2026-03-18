import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib
import os
import warnings

warnings.filterwarnings('ignore')

class MotionPatternDetector:
    """
    Random Forest based Motion Pattern Detector
    Distinguishes between genuine and intentional (artificial) motion patterns
    """
    
    def __init__(self, model_path='motion_model.pkl'):
        self.model_path = model_path
        self.scaler = StandardScaler()
        self.model = None
        self.feature_names = [
            'motion_value', 'motion_variance', 'rate_of_change',
            'peak_ratio', 'frequency_stability', 'entropy',
            'motion_std', 'motion_range', 'spike_count', 'regularity_score'
        ]
        
    def extract_features(self, motion_sequence):
        """
        Extract features from motion sensor data sequence
        motion_sequence: list of motion values [10000, 15000, 12000, ...]
        """
        if len(motion_sequence) < 5:
            motion_sequence = list(motion_sequence) + [motion_sequence[-1]] * (5 - len(motion_sequence))
        
        motion_array = np.array(motion_sequence, dtype=float)
        
        # Feature 1: Average motion value
        motion_value = np.mean(motion_array)
        
        # Feature 2: Variance (stability)
        motion_variance = np.var(motion_array)
        
        # Feature 3: Rate of change (differences between consecutive values)
        diffs = np.diff(motion_array)
        rate_of_change = np.mean(np.abs(diffs))
        
        # Feature 4: Peak ratio (max/min ratio - artificial patterns have extreme jumps)
        motion_min = np.min(motion_array) + 1e-6
        peak_ratio = np.max(motion_array) / motion_min
        
        # Feature 5: Frequency stability (standard deviation of differences)
        frequency_stability = np.std(diffs)
        
        # Feature 6: Entropy (randomness measure)
        # Low entropy = regular/artificial, High entropy = natural
        bins = np.histogram_bin_edges(motion_array, bins=5)
        hist, _ = np.histogram(motion_array, bins=bins)
        hist = hist[hist > 0] / len(motion_array)
        entropy = -np.sum(hist * np.log2(hist + 1e-10))
        
        # Feature 7: Standard deviation
        motion_std = np.std(motion_array)
        
        # Feature 8: Range
        motion_range = np.max(motion_array) - np.min(motion_array)
        
        # Feature 9: Spike count (sudden large changes)
        threshold = np.mean(np.abs(diffs)) + 2 * np.std(np.abs(diffs))
        spike_count = np.sum(np.abs(diffs) > threshold)
        
        # Feature 10: Regularity score (how regular/periodic the pattern is)
        if len(diffs) > 0:
            regularity_score = 1 / (1 + np.std(diffs) / (np.mean(np.abs(diffs)) + 1e-6))
        else:
            regularity_score = 0
        
        return np.array([
            motion_value, motion_variance, rate_of_change,
            peak_ratio, frequency_stability, entropy,
            motion_std, motion_range, spike_count, regularity_score
        ])
    
    def generate_training_data(self, n_samples=5000):
        """
        Generate synthetic training data with enhanced diversity
        Label 0: Genuine motion patterns
        Label 1: Artificial/Intentional patterns
        """
        X = []
        y = []
        
        # Generate Genuine motion patterns (Label 0) - More diverse scenarios
        for _ in range(n_samples // 2):
            pattern_type = np.random.randint(0, 6)
            
            if pattern_type == 0:
                # Walking pattern: gradual, natural variations
                base = np.random.uniform(15000, 25000)
                noise = np.random.normal(0, 2000, 20)
                smooth = np.convolve(noise, np.ones(3)/3, mode='same')
                sequence = base + smooth
                
            elif pattern_type == 1:
                # Sitting/stationary: low motion with micro-movements
                base = np.random.uniform(8000, 12000)
                noise = np.random.normal(0, 500, 20)
                sequence = base + noise
                
            elif pattern_type == 2:
                # Active movement: higher values with natural variation
                base = np.random.uniform(22000, 28000)
                noise = np.random.normal(0, 3000, 20)
                smooth = np.convolve(noise, np.ones(5)/5, mode='same')
                sequence = base + smooth
                
            elif pattern_type == 3:
                # Gradual increase (standing up, walking faster)
                start = np.random.uniform(10000, 15000)
                end = np.random.uniform(20000, 28000)
                sequence = np.linspace(start, end, 20)
                noise = np.random.normal(0, 1500, 20)
                sequence = sequence + noise
                
            elif pattern_type == 4:
                # Gradual decrease (slowing down, sitting)
                start = np.random.uniform(20000, 28000)
                end = np.random.uniform(8000, 15000)
                sequence = np.linspace(start, end, 20)
                noise = np.random.normal(0, 1500, 20)
                sequence = sequence + noise
                
            else:
                # Mixed activity with natural transitions
                segments = []
                for seg in range(4):
                    seg_base = np.random.uniform(12000, 26000)
                    seg_noise = np.random.normal(0, 1800, 5)
                    segments.extend((seg_base + seg_noise).tolist())
                sequence = np.array(segments)
            
            sequence = np.clip(sequence, 5000, 32000)
            features = self.extract_features(sequence)
            X.append(features)
            y.append(0)  # Genuine
        
        # Generate Artificial motion patterns (Label 1) - More attack scenarios
        for _ in range(n_samples // 2):
            attack_type = np.random.randint(0, 8)
            
            if attack_type == 0:
                # Repetitive periodic spikes (shaking device rhythmically)
                sequence = []
                period = np.random.randint(2, 5)
                for i in range(20):
                    if i % period == 0:
                        sequence.append(np.random.uniform(24000, 30000))  # Spike
                    else:
                        sequence.append(np.random.uniform(6000, 12000))   # Low
            
            elif attack_type == 1:
                # Rapid alternations (unnatural rhythm - flipping device)
                sequence = []
                for i in range(20):
                    if i % 2 == 0:
                        sequence.append(np.random.uniform(23000, 28000))
                    else:
                        sequence.append(np.random.uniform(4000, 10000))
            
            elif attack_type == 2:
                # Constant high values (taped to moving object)
                base = np.random.uniform(26000, 30000)
                noise = np.random.normal(0, 300, 20)  # Very low variance
                sequence = base + noise
            
            elif attack_type == 3:
                # Constant low values (stationary device while faking presence)
                base = np.random.uniform(3000, 6000)
                noise = np.random.normal(0, 200, 20)  # Very low variance
                sequence = base + noise
            
            elif attack_type == 4:
                # Sawtooth pattern (mechanical movement)
                sequence = []
                for i in range(20):
                    if i % 5 < 3:
                        val = np.random.uniform(8000, 12000)
                    else:
                        val = np.random.uniform(25000, 30000)
                    sequence.append(val)
            
            elif attack_type == 5:
                # Square wave (on/off pattern - device in pocket/out)
                sequence = []
                state = 0
                for i in range(20):
                    if i % 6 == 0:
                        state = 1 - state
                    if state:
                        sequence.append(np.random.uniform(26000, 30000))
                    else:
                        sequence.append(np.random.uniform(3000, 7000))
            
            elif attack_type == 6:
                # Extreme spikes (violent shaking at intervals)
                base = np.random.uniform(12000, 16000)
                sequence = np.random.normal(base, 1000, 20)
                spike_positions = np.random.choice(20, 5, replace=False)
                for pos in spike_positions:
                    sequence[pos] = np.random.uniform(28000, 32000)
            
            else:
                # Triangle wave (predictable up-down pattern)
                sequence = []
                direction = 1
                val = np.random.uniform(10000, 15000)
                for i in range(20):
                    sequence.append(val)
                    val += direction * np.random.uniform(2000, 4000)
                    if val > 28000 or val < 8000:
                        direction *= -1
                    val = np.clip(val, 5000, 32000)
            
            sequence = np.clip(sequence, 3000, 35000)
            features = self.extract_features(sequence)
            X.append(features)
            y.append(1)  # Artificial
        
        return np.array(X), np.array(y)
    
    def train(self, n_samples=5000):
        """Train the Random Forest model with enhanced parameters"""
        print("Generating enhanced training data...")
        X, y = self.generate_training_data(n_samples)
        
        print(f"Training samples: {len(X)} ({np.sum(y == 0)} Genuine, {np.sum(y == 1)} Artificial)")
        
        print("Scaling features...")
        X_scaled = self.scaler.fit_transform(X)
        
        print("Training Random Forest model with optimized hyperparameters...")
        # Split data with stratification
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.25, random_state=42, stratify=y
        )
        
        # Train Random Forest with enhanced parameters for better accuracy
        self.model = RandomForestClassifier(
            n_estimators=200,           # Increased from 100
            max_depth=20,               # Increased from 15
            min_samples_split=3,        # More sensitive
            min_samples_leaf=1,         # More sensitive
            max_features='sqrt',        # Better generalization
            bootstrap=True,
            oob_score=True,             # Out-of-bag score for validation
            random_state=42,
            n_jobs=-1,
            class_weight='balanced',
            criterion='gini',           # Information gain criterion
            max_samples=0.8             # Bootstrap sample size
        )
        
        self.model.fit(X_train, y_train)
        
        # Evaluate on test set
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\n{'='*60}")
        print(f"MODEL TRAINING COMPLETE!")
        print(f"{'='*60}")
        print(f"Overall Accuracy: {accuracy:.2%}")
        print(f"Out-of-Bag Score: {self.model.oob_score_:.2%}")
        
        print(f"\n{'='*60}")
        print(f"CLASSIFICATION REPORT")
        print(f"{'='*60}")
        print(classification_report(y_test, y_pred, target_names=['Genuine', 'Artificial']))
        
        print(f"{'='*60}")
        print(f"CONFUSION MATRIX")
        print(f"{'='*60}")
        cm = confusion_matrix(y_test, y_pred)
        print(f"                  Predicted")
        print(f"                Genuine  Artificial")
        print(f"Actual Genuine     {cm[0][0]:4d}     {cm[0][1]:4d}")
        print(f"       Artificial  {cm[1][0]:4d}     {cm[1][1]:4d}")
        
        # Calculate additional metrics
        tn, fp, fn, tp = cm.ravel()
        specificity = tn / (tn + fp)
        sensitivity = tp / (tp + fn)
        
        print(f"\n{'='*60}")
        print(f"DETAILED METRICS")
        print(f"{'='*60}")
        print(f"True Positives (Artificial correctly detected):  {tp}")
        print(f"True Negatives (Genuine correctly identified):   {tn}")
        print(f"False Positives (Genuine marked as Artificial):  {fp}")
        print(f"False Negatives (Artificial marked as Genuine):  {fn}")
        print(f"Sensitivity (True Positive Rate):                {sensitivity:.2%}")
        print(f"Specificity (True Negative Rate):                {specificity:.2%}")
        
        print(f"\n{'='*60}")
        print(f"FEATURE IMPORTANCE (Top 10)")
        print(f"{'='*60}")
        importances = list(zip(self.feature_names, self.model.feature_importances_))
        importances.sort(key=lambda x: x[1], reverse=True)
        for i, (name, importance) in enumerate(importances, 1):
            print(f"{i:2d}. {name:25s} {importance:.4f} {'█' * int(importance * 100)}")
        
        self.save()
    
    def predict(self, motion_sequence, return_confidence=True):
        """
        Predict if motion pattern is genuine or artificial
        Returns: (prediction, confidence, features)
        prediction: 0 = Genuine, 1 = Artificial
        """
        if self.model is None:
            self.load()
        
        features = self.extract_features(motion_sequence)
        features_scaled = self.scaler.transform([features])
        
        prediction = self.model.predict(features_scaled)[0]
        probabilities = self.model.predict_proba(features_scaled)[0]
        confidence = probabilities[prediction]
        
        if return_confidence:
            return {
                'prediction': int(prediction),
                'label': 'Artificial' if prediction == 1 else 'Genuine',
                'confidence': float(confidence),
                'genuine_probability': float(probabilities[0]),
                'artificial_probability': float(probabilities[1]),
                'features': {
                    name: float(val) for name, val in zip(self.feature_names, features)
                }
            }
        return prediction
    
    def save(self):
        """Save the model"""
        joblib.dump(self.model, os.path.join(os.path.dirname(__file__), self.model_path))
        joblib.dump(self.scaler, os.path.join(os.path.dirname(__file__), 'scaler.pkl'))
        print(f"Model saved to {self.model_path}")
    
    def load(self):
        """Load the model"""
        model_file = os.path.join(os.path.dirname(__file__), self.model_path)
        scaler_file = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
        
        if os.path.exists(model_file) and os.path.exists(scaler_file):
            self.model = joblib.load(model_file)
            self.scaler = joblib.load(scaler_file)
            print(f"Model loaded from {self.model_path}")
        else:
            print("Model not found. Please train first.")
            self.train()


if __name__ == "__main__":
    detector = MotionPatternDetector()
    
    print("="*60)
    print("MOTION PATTERN DETECTION - ENHANCED TRAINING")
    print("="*60)
    print()
    
    # Train with more samples for better accuracy
    detector.train(n_samples=5000)
    
    # Test predictions
    print("\n" + "="*60)
    print("TESTING PREDICTIONS ON SAMPLE PATTERNS")
    print("="*60)
    
    # Test 1: Genuine walking pattern
    print("\n[TEST 1] Genuine Walking Pattern:")
    genuine_walk = np.random.normal(20000, 2000, 20)
    genuine_walk = np.clip(genuine_walk, 10000, 30000)
    result = detector.predict(genuine_walk)
    print(f"  Pattern: {genuine_walk[:5].astype(int).tolist()}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    print(f"  Genuine Prob: {result['genuine_probability']:.2%}")
    print(f"  Artificial Prob: {result['artificial_probability']:.2%}")
    
    # Test 2: Genuine gradual increase
    print("\n[TEST 2] Genuine Gradual Increase (Standing/Walking):")
    genuine_increase = np.linspace(12000, 24000, 20)
    genuine_increase += np.random.normal(0, 1500, 20)
    result = detector.predict(genuine_increase)
    print(f"  Pattern: {genuine_increase[:5].astype(int).tolist()}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    
    # Test 3: Artificial rapid alternation
    print("\n[TEST 3] Artificial Rapid Alternation (Device Flipping):")
    artificial_alternation = []
    for i in range(20):
        if i % 2 == 0:
            artificial_alternation.append(np.random.uniform(25000, 28000))
        else:
            artificial_alternation.append(np.random.uniform(5000, 10000))
    result = detector.predict(artificial_alternation)
    print(f"  Pattern: {[int(x) for x in artificial_alternation[:5]]}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    
    # Test 4: Artificial periodic spikes
    print("\n[TEST 4] Artificial Periodic Spikes (Rhythmic Shaking):")
    artificial_spikes = []
    for i in range(20):
        if i % 3 == 0:
            artificial_spikes.append(np.random.uniform(26000, 30000))
        else:
            artificial_spikes.append(np.random.uniform(8000, 12000))
    result = detector.predict(artificial_spikes)
    print(f"  Pattern: {[int(x) for x in artificial_spikes[:5]]}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    
    # Test 5: Artificial constant high (taped to moving object)
    print("\n[TEST 5] Artificial Constant High (Taped to Moving Object):")
    artificial_constant = np.random.normal(28000, 300, 20)
    result = detector.predict(artificial_constant)
    print(f"  Pattern: {artificial_constant[:5].astype(int).tolist()}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    
    # Test 6: Genuine sitting/low activity
    print("\n[TEST 6] Genuine Sitting/Low Activity:")
    genuine_sitting = np.random.normal(10000, 500, 20)
    genuine_sitting = np.clip(genuine_sitting, 8000, 12000)
    result = detector.predict(genuine_sitting)
    print(f"  Pattern: {genuine_sitting[:5].astype(int).tolist()}...")
    print(f"  Prediction: {result['label']}")
    print(f"  Confidence: {result['confidence']:.2%}")
    
    print("\n" + "="*60)
    print("TRAINING AND TESTING COMPLETE!")
    print("="*60)
