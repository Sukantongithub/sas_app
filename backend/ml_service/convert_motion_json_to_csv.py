#!/usr/bin/env python3
"""
Convert motion sensor JSON data to CSV format suitable for model training.
Handles both natural and artificial motion data.
"""

import json
import pandas as pd
import os
from datetime import datetime
from pathlib import Path

def load_json_data(filepath):
    """Load JSON data from file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def process_motion_data(data, data_type='natural'):
    """
    Process motion sensor data and prepare for training.
    
    Args:
        data: List of motion sensor readings
        data_type: 'natural' or 'artificial' for labeling
    
    Returns:
        DataFrame with processed motion data
    """
    records = []
    
    for entry in data:
        record = {
            'timestamp': entry.get('timestamp'),
            'device_id': entry.get('id'),
            'ax': entry.get('ax'),
            'ay': entry.get('ay'),
            'az': entry.get('az'),
            'motion_magnitude': entry.get('motionMagnitude', entry.get('m')),
            'rssi': entry.get('r'),
            'ip': entry.get('ip'),
            'data_type': data_type,
            'sensorSource': entry.get('sensorSource', 'accelerometer')
        }
        records.append(record)
    
    return pd.DataFrame(records)

def add_derived_features(df):
    """Add derived features for better model training."""
    # Convert timestamp to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Calculate total acceleration magnitude (already in data but verify)
    df['total_acceleration'] = (df['ax']**2 + df['ay']**2 + df['az']**2)**0.5
    
    # Calculate acceleration in each axis (magnitude)
    df['ax_abs'] = df['ax'].abs()
    df['ay_abs'] = df['ay'].abs()
    df['az_abs'] = df['az'].abs()
    
    # Extract time features
    df['hour'] = df['timestamp'].dt.hour
    df['minute'] = df['timestamp'].dt.minute
    df['second'] = df['timestamp'].dt.second
    
    # Sort by timestamp
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    return df

def main():
    # Define paths
    backend_path = Path(__file__).parent.parent
    datasets_path = backend_path / 'datasets'
    
    natural_json_path = datasets_path / 'raw_motions_natural.json'
    artificial_json_path = datasets_path / 'raw_motions_artificial.json'
    
    print("=" * 70)
    print("MOTION SENSOR DATA CONVERSION - JSON to CSV")
    print("=" * 70)
    
    # Load data
    print("\n[1/5] Loading natural motion data...")
    try:
        natural_data = load_json_data(natural_json_path)
        print(f"     Loaded {len(natural_data)} natural motion records")
    except Exception as e:
        print(f"     Error loading natural data: {e}")
        natural_data = []
    
    print("\n[2/5] Loading artificial motion data...")
    try:
        artificial_data = load_json_data(artificial_json_path)
        print(f"     Loaded {len(artificial_data)} artificial motion records")
    except Exception as e:
        print(f"     Error loading artificial data: {e}")
        artificial_data = []
    
    # Process data
    print("\n[3/5] Processing natural motion data...")
    df_natural = process_motion_data(natural_data, data_type='natural')
    df_natural = add_derived_features(df_natural)
    print(f"     Created DataFrame with {len(df_natural)} records")
    
    print("\n[4/5] Processing artificial motion data...")
    df_artificial = process_motion_data(artificial_data, data_type='artificial')
    df_artificial = add_derived_features(df_artificial)
    print(f"     Created DataFrame with {len(df_artificial)} records")
    
    # Save individual datasets
    print("\n[5/5] Saving CSV files...")
    
    # Create output directory if it doesn't exist
    output_dir = datasets_path / 'training_data'
    output_dir.mkdir(exist_ok=True)
    
    # Save natural data
    natural_csv_path = output_dir / 'motion_natural_training.csv'
    df_natural.to_csv(natural_csv_path, index=False)
    print(f"     ✓ Natural data saved: {natural_csv_path}")
    
    # Save artificial data
    artificial_csv_path = output_dir / 'motion_artificial_training.csv'
    df_artificial.to_csv(artificial_csv_path, index=False)
    print(f"     ✓ Artificial data saved: {artificial_csv_path}")
    
    # Save combined training set
    df_combined = pd.concat([df_natural, df_artificial], ignore_index=True)
    df_combined = df_combined.sort_values('timestamp').reset_index(drop=True)
    
    combined_csv_path = output_dir / 'motion_combined_training.csv'
    df_combined.to_csv(combined_csv_path, index=False)
    print(f"     ✓ Combined data saved: {combined_csv_path}")
    
    # Print summary statistics
    print("\n" + "=" * 70)
    print("DATA SUMMARY")
    print("=" * 70)
    
    print(f"\nNatural Data Statistics:")
    print(f"  - Total records: {len(df_natural)}")
    print(f"  - Time range: {df_natural['timestamp'].min()} to {df_natural['timestamp'].max()}")
    print(f"  - Motion magnitude range: {df_natural['motion_magnitude'].min():.2f} to {df_natural['motion_magnitude'].max():.2f}")
    print(f"  - RSSI range: {df_natural['rssi'].min()} to {df_natural['rssi'].max()}")
    
    print(f"\nArtificial Data Statistics:")
    print(f"  - Total records: {len(df_artificial)}")
    print(f"  - Time range: {df_artificial['timestamp'].min()} to {df_artificial['timestamp'].max()}")
    print(f"  - Motion magnitude range: {df_artificial['motion_magnitude'].min():.2f} to {df_artificial['motion_magnitude'].max():.2f}")
    print(f"  - RSSI range: {df_artificial['rssi'].min()} to {df_artificial['rssi'].max()}")
    
    print(f"\nCombined Data Statistics:")
    print(f"  - Total records: {len(df_combined)}")
    print(f"  - Natural: {len(df_natural)} ({len(df_natural)/len(df_combined)*100:.1f}%)")
    print(f"  - Artificial: {len(df_artificial)} ({len(df_artificial)/len(df_combined)*100:.1f}%)")
    
    print(f"\nFeature Columns ({len(df_combined.columns)}):")
    for col in df_combined.columns:
        print(f"  - {col}")
    
    print("\n" + "=" * 70)
    print("CONVERSION COMPLETE!")
    print("=" * 70)

if __name__ == '__main__':
    main()
