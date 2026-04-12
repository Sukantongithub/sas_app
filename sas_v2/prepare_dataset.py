#!/usr/bin/env python3
"""
Dataset Preparation Tool
Converts raw ESP8266 motion data into a labeled training dataset
"""

import json
import os
import numpy as np
from datetime import datetime
from pathlib import Path

DATASET_DIR = Path("datasets")
RAW_FILE = DATASET_DIR / "raw_motions.json"
LABELED_FILE = DATASET_DIR / "labeled_motions.json"
TRAINING_FILE = DATASET_DIR / "training_data.json"

def load_raw_dataset():
    """Load raw motion data from file"""
    if not RAW_FILE.exists():
        print(f"❌ Raw dataset not found at {RAW_FILE}")
        return []
    
    try:
        with open(RAW_FILE, 'r') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data)} raw motion samples")
        return data
    except Exception as e:
        print(f"❌ Error loading raw dataset: {e}")
        return []

def load_labeled_dataset():
    """Load already labeled data"""
    if not LABELED_FILE.exists():
        return {}
    
    try:
        with open(LABELED_FILE, 'r') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data)} labeled samples")
        return data
    except Exception as e:
        print(f"❌ Error loading labeled dataset: {e}")
        return {}

def extract_features_from_sequence(samples):
    """Extract 30 statistical features from a sequence of motion samples"""
    if len(samples) < 3:
        return None
    
    ax_vals = [s.get('ax', 0) for s in samples]
    ay_vals = [s.get('ay', 0) for s in samples]
    az_vals = [s.get('az', 0) for s in samples]
    m_vals = [s.get('m', 0) for s in samples]
    
    features = {
        # Acceleration X features (6)
        'ax_mean': np.mean(ax_vals),
        'ax_std': np.std(ax_vals),
        'ax_max': np.max(ax_vals),
        'ax_min': np.min(ax_vals),
        'ax_range': np.max(ax_vals) - np.min(ax_vals),
        'ax_median': np.median(ax_vals),
        
        # Acceleration Y features (6)
        'ay_mean': np.mean(ay_vals),
        'ay_std': np.std(ay_vals),
        'ay_max': np.max(ay_vals),
        'ay_min': np.min(ay_vals),
        'ay_range': np.max(ay_vals) - np.min(ay_vals),
        'ay_median': np.median(ay_vals),
        
        # Acceleration Z features (6)
        'az_mean': np.mean(az_vals),
        'az_std': np.std(az_vals),
        'az_max': np.max(az_vals),
        'az_min': np.min(az_vals),
        'az_range': np.max(az_vals) - np.min(az_vals),
        'az_median': np.median(az_vals),
        
        # Motion Intensity features (6)
        'm_mean': np.mean(m_vals),
        'm_std': np.std(m_vals),
        'm_max': np.max(m_vals),
        'm_min': np.min(m_vals),
        'm_range': np.max(m_vals) - np.min(m_vals),
        'm_median': np.median(m_vals),
        
        # Combined features (6)
        'magnitude_mean': np.mean([np.sqrt(ax**2 + ay**2 + az**2) for ax, ay, az in zip(ax_vals, ay_vals, az_vals)]),
        'total_variation': sum(abs(ax_vals[i] - ax_vals[i-1]) + abs(ay_vals[i] - ay_vals[i-1]) + abs(az_vals[i] - az_vals[i-1]) for i in range(1, len(ax_vals))),
        'energy': sum(ax**2 + ay**2 + az**2 for ax, ay, az in zip(ax_vals, ay_vals, az_vals)),
        'jerk_x': sum(abs(ax_vals[i] - ax_vals[i-1]) for i in range(1, len(ax_vals))),
        'jerk_y': sum(abs(ay_vals[i] - ay_vals[i-1]) for i in range(1, len(ay_vals))),
        'jerk_z': sum(abs(az_vals[i] - az_vals[i-1]) for i in range(1, len(az_vals))),
    }
    
    return features

def interactive_labeling():
    """Interactive mode to label motion samples"""
    raw_data = load_raw_dataset()
    labeled_data = load_labeled_dataset()
    
    if not raw_data:
        print("❌ No raw data to label")
        return
    
    print(f"\n📝 Interactive Labeling Mode")
    print(f"Currently labeled: {len(labeled_data)}")
    print(f"Total samples: {len(raw_data)}")
    print(f"Remaining: {len(raw_data) - len(labeled_data)}\n")
    
    sequence_size = 10
    sequences = []
    
    # Group samples into sequences
    for i in range(0, len(raw_data) - sequence_size, sequence_size):
        seq = raw_data[i:i + sequence_size]
        seq_id = f"seq_{i//sequence_size:06d}"
        if seq_id not in labeled_data:
            sequences.append((seq_id, seq))
    
    if not sequences:
        print("✅ All samples have been labeled!")
        return
    
    print(f"Found {len(sequences)} unlabeled sequences")
    
    for seq_id, sequence in sequences[:10]:  # Show first 10
        print(f"\n{'='*50}")
        print(f"Sequence: {seq_id}")
        print(f"Sample count: {len(sequence)}")
        
        # Show motion stats
        m_values = [s.get('m', 0) for s in sequence]
        print(f"Motion intensity: min={min(m_values):.2f}, max={max(m_values):.2f}, avg={np.mean(m_values):.2f}")
        
        # Show first and last sample
        print(f"First sample: {sequence[0]}")
        print(f"Last sample: {sequence[-1]}")
        
        # Ask for label
        while True:
            label = input(f"\nLabel this sequence (N=Natural, I=Intentional, S=Skip): ").strip().upper()
            if label in ['N', 'I', 'S']:
                break
        
        if label != 'S':
            labeled_data[seq_id] = {
                'label': 'Natural' if label == 'N' else 'Intentional',
                'timestamp': datetime.now().isoformat(),
                'sequence': sequence
            }
            
            # Save immediately
            with open(LABELED_FILE, 'w') as f:
                json.dump(labeled_data, f, indent=2)
            print(f"✅ Saved: {seq_id} → {labeled_data[seq_id]['label']}")
    
    print(f"\n📊 Summary: {len(labeled_data)} labeled sequences saved")

def prepare_training_data():
    """Prepare final training dataset from labeled data"""
    labeled_data = load_labeled_dataset()
    
    if not labeled_data:
        print("❌ No labeled data found. Run interactive labeling first!")
        return
    
    training_data = []
    skipped = 0
    
    for seq_id, item in labeled_data.items():
        sequence = item.get('sequence', [])
        label = item.get('label', 'Unknown')
        
        features = extract_features_from_sequence(sequence)
        if features is None:
            skipped += 1
            continue
        
        training_data.append({
            'id': seq_id,
            'label': label,
            'features': features,
            'raw_samples': len(sequence),
            'timestamp': item.get('timestamp')
        })
    
    # Save training data
    with open(TRAINING_FILE, 'w') as f:
        json.dump(training_data, f, indent=2)
    
    print(f"\n✅ Training data prepared!")
    print(f"📊 Total sequences: {len(training_data)}")
    print(f"⏭️  Skipped (too short): {skipped}")
    
    # Show distribution
    natural = sum(1 for item in training_data if item['label'] == 'Natural')
    intentional = sum(1 for item in training_data if item['label'] == 'Intentional')
    print(f"📈 Distribution: Natural={natural}, Intentional={intentional}")
    
    return training_data

def show_stats():
    """Show dataset statistics"""
    raw = load_raw_dataset()
    labeled = load_labeled_dataset()
    
    if TRAINING_FILE.exists():
        with open(TRAINING_FILE) as f:
            training = json.load(f)
    else:
        training = []
    
    print(f"\n📊 Dataset Statistics:")
    print(f"  Raw samples: {len(raw)}")
    print(f"  Labeled sequences: {len(labeled)}")
    print(f"  Training data (prepared): {len(training)}")
    
    if training:
        nat = sum(1 for t in training if t['label'] == 'Natural')
        int_ = sum(1 for t in training if t['label'] == 'Intentional')
        print(f"  Label distribution: Natural={nat}, Intentional={int_}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: prepare_dataset.py [command]")
        print("Commands:")
        print("  stats      - Show dataset statistics")
        print("  label      - Interactive labeling mode")
        print("  prepare    - Prepare training data from labeled samples")
        print("  all        - Label and prepare training data")
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    
    if cmd == "stats":
        show_stats()
    elif cmd == "label":
        interactive_labeling()
        show_stats()
    elif cmd == "prepare":
        prepare_training_data()
    elif cmd == "all":
        interactive_labeling()
        prepare_training_data()
        show_stats()
    else:
        print(f"❌ Unknown command: {cmd}")
        sys.exit(1)
