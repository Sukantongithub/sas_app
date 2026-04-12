#!/usr/bin/env python3
"""
ESP8266 Motion Classification - Scikit-Learn Models
Classify: Natural motion vs Intentional motion using accelerometer data
Real-time and batch training support
"""

import os
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
import pickle
import argparse
import warnings
warnings.filterwarnings('ignore')

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, roc_auc_score
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.svm import SVC
    from sklearn.neighbors import KNeighborsClassifier
    import joblib
    print("✅ All dependencies loaded successfully")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Run: pip install -r requirements.txt")
    exit(1)

# ============================================
# PATHS AND CONFIGURATION
# ============================================

DATA_DIR = Path("datasets")
TRAINING_FILE = DATA_DIR / "training_data.json"
RAW_FILE = DATA_DIR / "raw_motions.json"
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)

# Feature names
FEATURE_NAMES = [
    'ax_mean', 'ax_std', 'ax_max', 'ax_min', 'ax_range', 'ax_median',
    'ay_mean', 'ay_std', 'ay_max', 'ay_min', 'ay_range', 'ay_median',
    'az_mean', 'az_std', 'az_max', 'az_min', 'az_range', 'az_median',
    'm_mean', 'm_std', 'm_max', 'm_min', 'm_range', 'm_median',
    'magnitude_mean', 'total_variation', 'energy', 'jerk_x', 'jerk_y', 'jerk_z'
]

# ============================================
# 1. SYNTHETIC DATA GENERATION
# ============================================

def generate_synthetic_dataset(n_natural=1000, n_intentional=1000, seq_length=10):
    """
    Generate synthetic motion data for training
    
    Natural motion: smooth, low variation, smaller accelerations
    Intentional motion: sudden changes, larger accelerations, spikes
    """
    def extract_features(ax_seq, ay_seq, az_seq, m_seq):
        """Extract 30 statistical features from a sequence"""
        return {
            'ax_mean': np.mean(ax_seq), 'ax_std': np.std(ax_seq),
            'ax_max': np.max(ax_seq), 'ax_min': np.min(ax_seq),
            'ax_range': np.max(ax_seq) - np.min(ax_seq), 'ax_median': np.median(ax_seq),
            'ay_mean': np.mean(ay_seq), 'ay_std': np.std(ay_seq),
            'ay_max': np.max(ay_seq), 'ay_min': np.min(ay_seq),
            'ay_range': np.max(ay_seq) - np.min(ay_seq), 'ay_median': np.median(ay_seq),
            'az_mean': np.mean(az_seq), 'az_std': np.std(az_seq),
            'az_max': np.max(az_seq), 'az_min': np.min(az_seq),
            'az_range': np.max(az_seq) - np.min(az_seq), 'az_median': np.median(az_seq),
            'm_mean': np.mean(m_seq), 'm_std': np.std(m_seq),
            'm_max': np.max(m_seq), 'm_min': np.min(m_seq),
            'm_range': np.max(m_seq) - np.min(m_seq), 'm_median': np.median(m_seq),
            'magnitude_mean': np.mean([np.sqrt(ax**2 + ay**2 + az**2) for ax, ay, az in zip(ax_seq, ay_seq, az_seq)]),
            'total_variation': sum(abs(ax_seq[i] - ax_seq[i-1]) + abs(ay_seq[i] - ay_seq[i-1]) + abs(az_seq[i] - az_seq[i-1]) for i in range(1, len(ax_seq))),
            'energy': sum(ax**2 + ay**2 + az**2 for ax, ay, az in zip(ax_seq, ay_seq, az_seq)),
            'jerk_x': sum(abs(ax_seq[i] - ax_seq[i-1]) for i in range(1, len(ax_seq))),
            'jerk_y': sum(abs(ay_seq[i] - ay_seq[i-1]) for i in range(1, len(ay_seq))),
            'jerk_z': sum(abs(az_seq[i] - az_seq[i-1]) for i in range(1, len(az_seq))),
        }
    
    X = []
    y = []
    
    # Natural motion - smooth movements
    print("📊 Generating natural motion data...")
    for _ in range(n_natural):
        ax_seq = np.random.normal(loc=0.5, scale=0.8, size=seq_length)
        ay_seq = np.random.normal(loc=0.3, scale=0.7, size=seq_length)
        az_seq = np.random.normal(loc=0.4, scale=0.6, size=seq_length)
        m_seq = np.abs(ax_seq) + np.abs(ay_seq) + np.abs(az_seq)
        
        features = extract_features(ax_seq, ay_seq, az_seq, m_seq)
        X.append(list(features.values()))
        y.append(0)  # 0 = Natural
    
    # Intentional motion - sharp changes
    print("📊 Generating intentional motion data...")
    for _ in range(n_intentional):
        # Random spikes
        ax_seq = np.random.choice([-3, -2, 2, 3], size=seq_length) + np.random.normal(0, 0.3, seq_length)
        ay_seq = np.random.choice([-3, -2, 2, 3], size=seq_length) + np.random.normal(0, 0.3, seq_length)
        az_seq = np.random.choice([-3, -2, 2, 3], size=seq_length) + np.random.normal(0, 0.3, seq_length)
        m_seq = np.abs(ax_seq) + np.abs(ay_seq) + np.abs(az_seq)
        
        features = extract_features(ax_seq, ay_seq, az_seq, m_seq)
        X.append(list(features.values()))
        y.append(1)  # 1 = Intentional
    
    return np.array(X), np.array(y)

# ============================================
# 2. LOAD REAL DATA
# ============================================

def load_real_training_data():
    """Load training data prepared from real ESP8266 samples"""
    if not TRAINING_FILE.exists():
        print(f"❌ Training file not found: {TRAINING_FILE}")
        return None, None
    
    try:
        with open(TRAINING_FILE, 'r') as f:
            data = json.load(f)
        
        X = []
        y = []
        
        for item in data:
            features = item.get('features', {})
            label = item.get('label', 'Unknown')
            
            # Extract feature values in order
            feature_values = [features.get(fname, 0) for fname in FEATURE_NAMES]
            X.append(feature_values)
            y.append(0 if label == 'Natural' else 1)
        
        print(f"✅ Loaded {len(X)} real training samples from {TRAINING_FILE}")
        
        # Show distribution
        natural = sum(1 for label in y if label == 0)
        intentional = sum(1 for label in y if label == 1)
        print(f"📈 Distribution: Natural={natural}, Intentional={intentional}")
        
        return np.array(X), np.array(y)
    
    except Exception as e:
        print(f"❌ Error loading training data: {e}")
        return None, None

# ============================================
# 3. BUILD AND TRAIN MODELS
# ============================================

def build_and_train_models(X_train, X_test, y_train, y_test):
    """Build and train multiple scikit-learn models"""
    
    models = {
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
        'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
        'SVM': SVC(kernel='rbf', probability=True, random_state=42),
        'KNN': KNeighborsClassifier(n_neighbors=5)
    }
    
    results = {}
    
    for name, model in models.items():
        print(f"\n{'='*50}")
        print(f"🤖 Training {name}...")
        
        # Train
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        results[name] = {
            'model': model,
            'accuracy': accuracy,
            'y_pred': y_pred,
            'y_test': y_test
        }
        
        print(f"✅ {name} Accuracy: {accuracy:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Natural', 'Intentional']))
        
        # Save model
        model_path = MODELS_DIR / f"{name.lower().replace(' ', '_')}.pkl"
        joblib.dump(model, model_path)
        print(f"💾 Model saved: {model_path}")
    
    return results

# ============================================
# 4. VISUALIZATION
# ============================================

def plot_confusion_matrices(results):
    """Plot confusion matrices for all models"""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    axes = axes.flatten()
    
    for idx, (name, result) in enumerate(results.items()):
        cm = confusion_matrix(result['y_test'], result['y_pred'])
        
        ax = axes[idx]
        im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax)
        
        ax.set(xticks=np.arange(cm.shape[1]), yticks=np.arange(cm.shape[0]),
               xticklabels=['Natural', 'Intentional'],
               yticklabels=['Natural', 'Intentional'])
        
        ax.set_ylabel('True label')
        ax.set_xlabel('Predicted label')
        ax.set_title(f'{name}\nAccuracy: {result["accuracy"]:.4f}')
        
        # Add text annotations
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                       color="white" if cm[i, j] > cm.max() / 2 else "black")
    
    plt.tight_layout()
    plt.savefig(MODELS_DIR / 'confusion_matrices.png', dpi=150, bbox_inches='tight')
    print(f"\n📊 Confusion matrices saved: {MODELS_DIR / 'confusion_matrices.png'}")
    plt.show()

# ============================================
# 5. FEATURE SCALING
# ============================================

def save_scaler(scaler, path):
    """Save fitted scaler for inference"""
    with open(path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"💾 Scaler saved: {path}")

# ============================================
# MAIN TRAINING PIPELINE
# ============================================

def main():
    parser = argparse.ArgumentParser(description='Train motion classification models')
    parser.add_argument('--real-data', action='store_true', help='Use real collected data instead of synthetic')
    parser.add_argument('--synthetic-only', action='store_true', help='Force synthetic data even if real data exists')
    args = parser.parse_args()
    
    print("🚀 Motion Classification Model Training")
    print("="*50)
    
    # Load or generate data
    if args.synthetic_only:
        print("\n📊 Using SYNTHETIC data...")
        X, y = generate_synthetic_dataset(n_natural=1000, n_intentional=1000)
    elif args.real_data or (TRAINING_FILE.exists() and not args.synthetic_only):
        print("\n📊 Attempting to load REAL data...")
        X, y = load_real_training_data()
        
        if X is None:
            print("⚠️ Real data not available, falling back to synthetic...")
            X, y = generate_synthetic_dataset(n_natural=1000, n_intentional=1000)
    else:
        print("\n📊 Using SYNTHETIC data...")
        X, y = generate_synthetic_dataset(n_natural=1000, n_intentional=1000)
    
    print(f"\n📈 Total samples: {len(X)}")
    print(f"📈 Features per sample: {len(FEATURE_NAMES)}")
    
    # Prepare data
    print("\n🔧 Preparing data...")
    
    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Save scaler
    scaler_path = MODELS_DIR / 'scaler.pkl'
    save_scaler(scaler, scaler_path)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"✅ Training set: {len(X_train)} samples")
    print(f"✅ Test set: {len(X_test)} samples")
    
    # Train models
    print("\n🤖 Building and training models...")
    results = build_and_train_models(X_train, X_test, y_train, y_test)
    
    # Visualize
    print("\n📊 Generating visualizations...")
    plot_confusion_matrices(results)
    
    # Summary
    print("\n" + "="*50)
    print("✅ TRAINING COMPLETE!")
    print(f"📁 Models saved to: {MODELS_DIR}")
    print(f"📊 Model accuracies:")
    for name, result in results.items():
        print(f"  - {name}: {result['accuracy']:.4f}")
    print("\n🎯 Next step: Deploy models with inference.py")

if __name__ == "__main__":
    main()
