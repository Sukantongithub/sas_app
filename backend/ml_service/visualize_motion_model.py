#!/usr/bin/env python3
"""
Motion Model Visualization and Feature Importance Analysis
Creates visualizations for model performance and feature analysis
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import joblib
import warnings

warnings.filterwarnings('ignore')

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import confusion_matrix, roc_curve, auc
from sklearn.model_selection import train_test_split

class MotionModelVisualizer:
    def __init__(self, data_dir='datasets/training_data', models_dir='models'):
        """Initialize visualizer."""
        self.data_dir = Path(data_dir)
        self.models_dir = Path(models_dir)
        self.df = None
        self.scaler = None
        self.models = {}
        self.label_encoder = None
        
    def load_resources(self):
        """Load data and trained models."""
        print("\n[1/4] LOADING RESOURCES")
        print("=" * 70)
        
        # Load data
        combined_csv = self.data_dir / 'motion_combined_training.csv'
        self.df = pd.read_csv(combined_csv)
        self.df['timestamp'] = pd.to_datetime(self.df['timestamp'])
        print(f"✓ Loaded data: {len(self.df)} records")
        
        # Load models
        self.models['Random Forest'] = joblib.load(
            self.models_dir / 'motion_model_random_forest.pkl'
        )
        self.models['Gradient Boosting'] = joblib.load(
            self.models_dir / 'motion_model_gradient_boosting.pkl'
        )
        self.models['SVM'] = joblib.load(
            self.models_dir / 'motion_model_svm.pkl'
        )
        print(f"✓ Loaded {len(self.models)} models")
        
        # Load scaler and encoder
        self.scaler = joblib.load(self.models_dir / 'motion_scaler.pkl')
        self.label_encoder = joblib.load(self.models_dir / 'motion_label_encoder.pkl')
        print(f"✓ Loaded scaler and label encoder")
        
    def prepare_data(self):
        """Prepare data for visualization."""
        feature_cols = [
            'ax', 'ay', 'az',
            'motion_magnitude', 'total_acceleration',
            'ax_abs', 'ay_abs', 'az_abs',
            'rssi', 'hour', 'minute', 'second'
        ]
        
        X = self.df[feature_cols].values
        y = self.label_encoder.transform(self.df['data_type'])
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_test_scaled, y_test, feature_cols
    
    def plot_feature_importance(self, X_test_scaled, y_test, feature_cols):
        """Plot feature importance for tree-based models."""
        print("\n[2/4] CREATING FEATURE IMPORTANCE PLOT")
        print("=" * 70)
        
        fig, axes = plt.subplots(1, 2, figsize=(16, 6))
        fig.suptitle('Feature Importance Analysis', fontsize=16, fontweight='bold')
        
        models_to_plot = {
            'Random Forest': self.models['Random Forest'],
            'Gradient Boosting': self.models['Gradient Boosting']
        }
        
        for idx, (model_name, model) in enumerate(models_to_plot.items()):
            importances = model.feature_importances_
            indices = np.argsort(importances)[::-1]
            
            axes[idx].bar(range(len(importances)), importances[indices], align='center')
            axes[idx].set_xticks(range(len(importances)))
            axes[idx].set_xticklabels([feature_cols[i] for i in indices], rotation=45, ha='right')
            axes[idx].set_title(f'{model_name} - Feature Importance', fontweight='bold')
            axes[idx].set_ylabel('Importance Score')
            axes[idx].grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        output_path = Path('visualizations/feature_importance.png')
        output_path.parent.mkdir(exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"✓ Saved: {output_path}")
        plt.close()
    
    def plot_confusion_matrices(self, X_test_scaled, y_test):
        """Plot confusion matrices for all models."""
        print("\n[3/4] CREATING CONFUSION MATRICES")
        print("=" * 70)
        
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        fig.suptitle('Model Confusion Matrices', fontsize=16, fontweight='bold')
        
        for idx, (model_name, model) in enumerate(self.models.items()):
            y_pred = model.predict(X_test_scaled)
            cm = confusion_matrix(y_test, y_pred)
            
            # Plot heatmap
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[idx],
                       xticklabels=self.label_encoder.classes_,
                       yticklabels=self.label_encoder.classes_,
                       cbar=False)
            axes[idx].set_title(f'{model_name}', fontweight='bold')
            axes[idx].set_ylabel('True Label')
            axes[idx].set_xlabel('Predicted Label')
        
        plt.tight_layout()
        output_path = Path('visualizations/confusion_matrices.png')
        output_path.parent.mkdir(exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"✓ Saved: {output_path}")
        plt.close()
    
    def plot_motion_distribution(self):
        """Plot motion sensor data distribution."""
        print("\n[4/4] CREATING DATA DISTRIBUTION PLOTS")
        print("=" * 70)
        
        fig, axes = plt.subplots(2, 3, figsize=(18, 10))
        fig.suptitle('Motion Sensor Data Distribution (Natural vs Artificial)', 
                     fontsize=16, fontweight='bold')
        
        # Motion magnitude
        axes[0, 0].hist(self.df[self.df['data_type'] == 'natural']['motion_magnitude'], 
                       bins=30, alpha=0.6, label='Natural', color='blue')
        axes[0, 0].hist(self.df[self.df['data_type'] == 'artificial']['motion_magnitude'], 
                       bins=30, alpha=0.6, label='Artificial', color='red')
        axes[0, 0].set_title('Motion Magnitude Distribution')
        axes[0, 0].set_xlabel('Magnitude (m/s²)')
        axes[0, 0].legend()
        axes[0, 0].grid(alpha=0.3)
        
        # Acceleration axes
        for axis_idx, axis_name in enumerate(['ax', 'ay', 'az']):
            row = axis_idx // 3
            col = (axis_idx + 1) % 3
            
            axes[row, col].hist(self.df[self.df['data_type'] == 'natural'][axis_name], 
                               bins=30, alpha=0.6, label='Natural', color='blue')
            axes[row, col].hist(self.df[self.df['data_type'] == 'artificial'][axis_name], 
                               bins=30, alpha=0.6, label='Artificial', color='red')
            axes[row, col].set_title(f'{axis_name} Acceleration Distribution')
            axes[row, col].set_xlabel(f'{axis_name} (m/s²)')
            axes[row, col].legend()
            axes[row, col].grid(alpha=0.3)
        
        # RSSI distribution
        axes[1, 2].hist(self.df[self.df['data_type'] == 'natural']['rssi'], 
                       bins=30, alpha=0.6, label='Natural', color='blue')
        axes[1, 2].hist(self.df[self.df['data_type'] == 'artificial']['rssi'], 
                       bins=30, alpha=0.6, label='Artificial', color='red')
        axes[1, 2].set_title('RSSI (Signal Strength) Distribution')
        axes[1, 2].set_xlabel('RSSI (dBm)')
        axes[1, 2].legend()
        axes[1, 2].grid(alpha=0.3)
        
        plt.tight_layout()
        output_path = Path('visualizations/data_distribution.png')
        output_path.parent.mkdir(exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"✓ Saved: {output_path}")
        plt.close()
    
    def generate_visualizations(self):
        """Generate all visualizations."""
        print("\n" + "=" * 70)
        print("MOTION MODEL VISUALIZATION AND ANALYSIS")
        print("=" * 70)
        
        self.load_resources()
        X_test_scaled, y_test, feature_cols = self.prepare_data()
        
        self.plot_feature_importance(X_test_scaled, y_test, feature_cols)
        self.plot_confusion_matrices(X_test_scaled, y_test)
        self.plot_motion_distribution()
        
        print("\n" + "=" * 70)
        print("✓ ALL VISUALIZATIONS COMPLETED!")
        print("=" * 70)

def main():
    """Main entry point."""
    visualizer = MotionModelVisualizer()
    visualizer.generate_visualizations()

if __name__ == '__main__':
    main()
