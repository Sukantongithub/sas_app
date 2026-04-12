#!/usr/bin/env python3
"""
ESP8266 Motion Classification - Deep Learning Models
Classify: Natural motion vs Intentional motion using accelerometer data

Models: 1D CNN, LSTM, CNN-LSTM, TCN
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, roc_auc_score
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Sequential
    print(f"✅ TensorFlow {tf.__version__} loaded successfully")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Run: pip install -r requirements.txt")
    exit(1)

# ============================================
# 1. SYNTHETIC DATA GENERATION
# ============================================

def generate_synthetic_dataset(n_natural=1000, n_intentional=1000, seq_length=10):
    """
    Generate synthetic motion data for training
    
    Natural motion: smooth, low variation, smaller accelerations
    Intentional motion: sudden changes, larger accelerations, spikes
    """
    X = []
    y = []
    
    # Natural motion (label 0) - smooth movements
    print("📊 Generating natural motion data...")
    for _ in range(n_natural):
        # Smooth acceleration with small variations
        seq = np.random.normal(loc=0.5, scale=0.8, size=(seq_length, 5))
        seq[:, :3] = np.clip(seq[:, :3], -3, 3)  # ax, ay, az
        seq[:, 3] = np.abs(np.sum(seq[:, :3], axis=1))  # motion intensity
        seq[:, 4] = np.random.randint(-50, -30, seq_length)  # rssi
        X.append(seq)
        y.append(0)
    
    # Intentional motion (label 1) - sudden changes
    print("📊 Generating intentional motion data...")
    for _ in range(n_intentional):
        # Random spikes and sudden changes
        seq = np.zeros((seq_length, 5))
        
        # Add intentional patterns
        for i in range(seq_length):
            if np.random.rand() > 0.6:  # 40% chance of spike
                seq[i, :3] = np.random.normal(loc=0, scale=3, size=3)
            else:
                seq[i, :3] = np.random.normal(loc=0, scale=0.5, size=3)
        
        seq[:, :3] = np.clip(seq[:, :3], -10, 10)
        seq[:, 3] = np.abs(np.sum(seq[:, :3], axis=1))  # motion intensity
        seq[:, 4] = np.random.randint(-50, -30, seq_length)  # rssi
        X.append(seq)
        y.append(1)
    
    return np.array(X), np.array(y)

def load_real_motion_data(motions_json):
    """
    Load real motion data from stored motions
    Expected format: [{time, id, ax, ay, az, m, r, ip}, ...]
    """
    import json
    try:
        with open(motions_json, 'r') as f:
            data = json.load(f)
        
        if not data:
            print("⚠️  No data in JSON file")
            return None
        
        X = np.array([[d.get('ax', 0), d.get('ay', 0), d.get('az', 0), 
                      d.get('m', 0), d.get('r', -50)] for d in data])
        return X
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

# ============================================
# 2. DATA PREPROCESSING
# ============================================

def preprocess_data(X, y, test_size=0.2):
    """Normalize and split data"""
    print("🔄 Preprocessing data...")
    
    # Reshape for normalization
    X_flat = X.reshape(-1, X.shape[-1])
    
    # Standardize
    scaler = StandardScaler()
    X_flat = scaler.fit_transform(X_flat)
    X = X_flat.reshape(X.shape[0], X.shape[1], -1)
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    
    print(f"  Train set: {X_train.shape}")
    print(f"  Test set: {X_test.shape}")
    print(f"  Labels distribution - Train: {np.unique(y_train, return_counts=True)}")
    
    return X_train, X_test, y_train, y_test, scaler

# ============================================
# 3. MODEL ARCHITECTURES
# ============================================

def build_cnn1d_model(input_shape):
    """1D CNN - Lightweight, fast inference"""
    model = Sequential([
        layers.Input(shape=input_shape),
        layers.Conv1D(32, kernel_size=3, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling1D(pool_size=2),
        
        layers.Conv1D(64, kernel_size=3, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling1D(pool_size=2),
        
        layers.Conv1D(128, kernel_size=3, activation='relu', padding='same'),
        layers.GlobalAveragePooling1D(),
        
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(1, activation='sigmoid')
    ])
    return model

def build_lstm_model(input_shape):
    """LSTM - Best for temporal sequences"""
    model = Sequential([
        layers.Input(shape=input_shape),
        layers.LSTM(64, return_sequences=True, activation='relu'),
        layers.Dropout(0.2),
        layers.LSTM(32, return_sequences=False, activation='relu'),
        layers.Dropout(0.2),
        
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(1, activation='sigmoid')
    ])
    return model

def build_cnn_lstm_model(input_shape):
    """CNN-LSTM Hybrid - Best overall performance"""
    model = Sequential([
        layers.Input(shape=input_shape),
        
        # CNN block for spatial features
        layers.Conv1D(32, kernel_size=3, activation='relu', padding='same'),
        layers.MaxPooling1D(pool_size=2),
        layers.Conv1D(64, kernel_size=3, activation='relu', padding='same'),
        layers.MaxPooling1D(pool_size=2),
        
        # LSTM block for temporal patterns
        layers.LSTM(64, return_sequences=True, activation='relu'),
        layers.Dropout(0.2),
        layers.LSTM(32, activation='relu'),
        layers.Dropout(0.2),
        
        # Dense layers
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(1, activation='sigmoid')
    ])
    return model

def build_tcn_model(input_shape):
    """Temporal Convolutional Network - Modern & efficient"""
    model = Sequential([
        layers.Input(shape=input_shape),
        
        layers.Conv1D(64, kernel_size=3, dilation_rate=1, padding='causal', activation='relu'),
        layers.Dropout(0.2),
        layers.Conv1D(64, kernel_size=3, dilation_rate=2, padding='causal', activation='relu'),
        layers.Dropout(0.2),
        layers.Conv1D(64, kernel_size=3, dilation_rate=4, padding='causal', activation='relu'),
        layers.Dropout(0.2),
        
        layers.GlobalAveragePooling1D(),
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(1, activation='sigmoid')
    ])
    return model

# ============================================
# 4. TRAINING FUNCTION
# ============================================

def train_model(model_name, X_train, X_test, y_train, y_test, epochs=50, batch_size=16):
    """Train and evaluate model"""
    print(f"\n{'='*60}")
    print(f"🚀 Training {model_name}")
    print(f"{'='*60}")
    
    # Build model
    if model_name == "1D CNN":
        model = build_cnn1d_model(X_train[0].shape)
    elif model_name == "LSTM":
        model = build_lstm_model(X_train[0].shape)
    elif model_name == "CNN-LSTM":
        model = build_cnn_lstm_model(X_train[0].shape)
    elif model_name == "TCN":
        model = build_tcn_model(X_train[0].shape)
    
    print(f"\n📋 Model Summary:")
    model.summary()
    
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.AUC(name='auc')]
    )
    
    # Callbacks
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=5, restore_best_weights=True
    )
    
    # Train
    print(f"\n⏳ Training for {epochs} epochs...")
    history = model.fit(
        X_train, y_train,
        validation_split=0.2,
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[early_stop],
        verbose=1
    )
    
    # Evaluate
    print(f"\n📊 Evaluating on test set...")
    y_pred_prob = model.predict(X_test, verbose=0)
    y_pred = (y_pred_prob > 0.5).astype(int).flatten()
    
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_pred_prob)
    
    print(f"\n✅ Results for {model_name}:")
    print(f"   Accuracy: {accuracy:.4f}")
    print(f"   AUC: {auc:.4f}")
    print("\n📋 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['Natural', 'Intentional']))
    
    # Plot results
    plot_training_history(history, model_name)
    plot_confusion_matrix(y_test, y_pred, model_name)
    
    return model, accuracy, auc

def plot_training_history(history, model_name):
    """Plot training history"""
    plt.figure(figsize=(14, 4))
    
    plt.subplot(1, 3, 1)
    plt.plot(history.history['loss'], label='Train Loss', linewidth=2)
    plt.plot(history.history['val_loss'], label='Val Loss', linewidth=2)
    plt.title(f'{model_name} - Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.subplot(1, 3, 2)
    plt.plot(history.history['accuracy'], label='Train Acc', linewidth=2)
    plt.plot(history.history['val_accuracy'], label='Val Acc', linewidth=2)
    plt.title(f'{model_name} - Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.subplot(1, 3, 3)
    plt.plot(history.history['auc'], label='Train AUC', linewidth=2)
    plt.plot(history.history['val_auc'], label='Val AUC', linewidth=2)
    plt.title(f'{model_name} - AUC')
    plt.xlabel('Epoch')
    plt.ylabel('AUC')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    path = f'm:\\tmp\\MAD\\results\\{model_name.replace("-", "_")}_history.png'
    os.makedirs('m:\\tmp\\MAD\\results', exist_ok=True)
    plt.savefig(path, dpi=150, bbox_inches='tight')
    print(f"   📈 Plot saved: {path}")
    plt.close()

def plot_confusion_matrix(y_test, y_pred, model_name):
    """Plot confusion matrix"""
    from sklearn.metrics import confusion_matrix
    
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(6, 5))
    
    plt.imshow(cm, cmap='Blues', interpolation='nearest')
    plt.title(f'{model_name} - Confusion Matrix')
    plt.colorbar()
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.xticks([0, 1], ['Natural', 'Intentional'])
    plt.yticks([0, 1], ['Natural', 'Intentional'])
    
    # Add text annotations
    for i in range(2):
        for j in range(2):
            plt.text(j, i, str(cm[i, j]), ha='center', va='center', color='white', fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    path = f'm:\\tmp\\MAD\\results\\{model_name.replace("-", "_")}_confusion_matrix.png'
    os.makedirs('m:\\tmp\\MAD\\results', exist_ok=True)
    plt.savefig(path, dpi=150, bbox_inches='tight')
    print(f"   📊 Confusion matrix saved: {path}")
    plt.close()

# ============================================
# 5. MAIN EXECUTION
# ============================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🎯 ESP8266 Motion Classification - Model Training")
    print("="*60)
    
    # Generate training data
    print("\n📊 Generating synthetic training data...")
    X, y = generate_synthetic_dataset(n_natural=1000, n_intentional=1000, seq_length=10)
    print(f"   Dataset shape: {X.shape}")
    print(f"   Label distribution: {np.unique(y, return_counts=True)}")
    
    # Preprocess
    X_train, X_test, y_train, y_test, scaler = preprocess_data(X, y)
    
    # Save scaler for inference
    import pickle
    os.makedirs('m:\\tmp\\MAD\\models', exist_ok=True)
    with open('m:\\tmp\\MAD\\models\\scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
    print("✅ Scaler saved for inference")
    
    # Train all models
    results = {}
    models_to_train = ["1D CNN", "LSTM", "CNN-LSTM", "TCN"]
    
    for model_name in models_to_train:
        model, acc, auc = train_model(model_name, X_train, X_test, y_train, y_test, epochs=30)
        results[model_name] = {'accuracy': acc, 'auc': auc}
        
        # Save model
        os.makedirs('m:\\tmp\\MAD\\models', exist_ok=True)
        model_path = f'm:\\tmp\\MAD\\models\\model_{model_name.replace(" ", "_").replace("-", "_")}.keras'
        model.save(model_path)
        print(f"✅ Model saved: {model_path}")
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 FINAL MODEL COMPARISON")
    print(f"{'='*60}")
    for name, metrics in sorted(results.items(), key=lambda x: x[1]['accuracy'], reverse=True):
        print(f"{name:15} | Accuracy: {metrics['accuracy']:.4f} | AUC: {metrics['auc']:.4f}")
    
    best_model = max(results.items(), key=lambda x: x[1]['accuracy'])
    print(f"\n🏆 Best Model: {best_model[0]} with {best_model[1]['accuracy']:.4f} accuracy")
    print("\n✅ Training complete! All models saved in m:\\tmp\\MAD\\models\\")
