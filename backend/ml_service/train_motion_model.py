#!/usr/bin/env python3
"""
Motion Sensor Data Model Training and Analysis Pipeline
Includes EDA, preprocessing, model training, evaluation, and visualization
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from datetime import datetime
import joblib
import warnings

warnings.filterwarnings('ignore')

# ML Libraries
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    precision_score, recall_score, f1_score, roc_auc_score, roc_curve
)

class MotionDataAnalyzer:
    def __init__(self, data_dir='datasets/training_data'):
        """Initialize analyzer with data directory path."""
        self.data_dir = Path(data_dir)
        self.df = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.scaler = None
        self.label_encoder = None
        self.models = {}
        self.results = {}
        
    def load_data(self):
        """Load combined training data."""
        print("\n[1/8] LOADING DATA")
        print("=" * 70)
        
        combined_csv = self.data_dir / 'motion_combined_training.csv'
        
        if not combined_csv.exists():
            raise FileNotFoundError(f"Combined data not found: {combined_csv}")
        
        self.df = pd.read_csv(combined_csv)
        self.df['timestamp'] = pd.to_datetime(self.df['timestamp'])
        
        print(f"✓ Loaded {len(self.df)} records")
        print(f"✓ Columns: {len(self.df.columns)}")
        print(f"✓ Data types:\n{self.df.dtypes}")
        
        return self.df
    
    def exploratory_analysis(self):
        """Perform exploratory data analysis."""
        print("\n[2/8] EXPLORATORY DATA ANALYSIS")
        print("=" * 70)
        
        # Basic statistics
        print("\nBasic Statistics:")
        print(f"  Shape: {self.df.shape}")
        print(f"  Missing values: {self.df.isnull().sum().sum()}")
        
        # Data type distribution
        print(f"\nData Type Distribution:")
        print(self.df['data_type'].value_counts())
        
        # Motion magnitude statistics
        print(f"\nMotion Magnitude Statistics:")
        print(self.df['motion_magnitude'].describe())
        
        # RSSI (signal strength) statistics
        print(f"\nRSSI Statistics:")
        print(self.df['rssi'].describe())
        
        # Acceleration axis statistics
        print(f"\nAcceleration Axes Statistics:")
        for axis in ['ax', 'ay', 'az']:
            print(f"  {axis}: min={self.df[axis].min():.2f}, max={self.df[axis].max():.2f}, mean={self.df[axis].mean():.2f}")
        
        return self.df
    
    def preprocess_data(self, test_size=0.2, random_state=42):
        """Preprocess data for model training."""
        print("\n[3/8] DATA PREPROCESSING")
        print("=" * 70)
        
        # Select features for training
        feature_cols = [
            'ax', 'ay', 'az',
            'motion_magnitude', 'total_acceleration',
            'ax_abs', 'ay_abs', 'az_abs',
            'rssi', 'hour', 'minute', 'second'
        ]
        
        # Encode target variable
        self.label_encoder = LabelEncoder()
        y = self.label_encoder.fit_transform(self.df['data_type'])
        
        X = self.df[feature_cols].values
        
        print(f"✓ Selected {len(feature_cols)} features")
        print(f"  Features: {', '.join(feature_cols)}")
        
        # Split data
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        print(f"\n✓ Train/Test Split:")
        print(f"  Training set: {len(self.X_train)} samples ({len(self.X_train)/(len(self.X_train)+len(self.X_test))*100:.1f}%)")
        print(f"  Test set: {len(self.X_test)} samples ({len(self.X_test)/(len(self.X_train)+len(self.X_test))*100:.1f}%)")
        
        # Scale features
        self.scaler = StandardScaler()
        self.X_train_scaled = self.scaler.fit_transform(self.X_train)
        self.X_test_scaled = self.scaler.transform(self.X_test)
        
        print(f"\n✓ Feature scaling (StandardScaler) applied")
        print(f"  Feature means (scaled): {self.X_train_scaled.mean(axis=0).round(4)[:3]}...")
        print(f"  Feature stds (scaled): {self.X_train_scaled.std(axis=0).round(4)[:3]}...")
        
        return self.X_train_scaled, self.X_test_scaled, self.y_train, self.y_test
    
    def train_models(self):
        """Train multiple classification models."""
        print("\n[4/8] MODEL TRAINING")
        print("=" * 70)
        
        models_config = {
            'Random Forest': {
                'model': RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
                'params': {}
            },
            'Gradient Boosting': {
                'model': GradientBoostingClassifier(n_estimators=100, random_state=42),
                'params': {}
            },
            'SVM': {
                'model': SVC(kernel='rbf', probability=True, random_state=42),
                'params': {}
            }
        }
        
        for model_name, config in models_config.items():
            print(f"\n  Training {model_name}...")
            model = config['model']
            model.fit(self.X_train_scaled, self.y_train)
            self.models[model_name] = model
            print(f"    ✓ {model_name} trained successfully")
        
        return self.models
    
    def evaluate_models(self):
        """Evaluate all trained models."""
        print("\n[5/8] MODEL EVALUATION")
        print("=" * 70)
        
        for model_name, model in self.models.items():
            print(f"\n{model_name}:")
            print("-" * 50)
            
            # Predictions
            y_pred = model.predict(self.X_test_scaled)
            
            # Metrics
            accuracy = accuracy_score(self.y_test, y_pred)
            precision = precision_score(self.y_test, y_pred, average='weighted')
            recall = recall_score(self.y_test, y_pred, average='weighted')
            f1 = f1_score(self.y_test, y_pred, average='weighted')
            
            self.results[model_name] = {
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1': f1,
                'predictions': y_pred,
                'confusion_matrix': confusion_matrix(self.y_test, y_pred)
            }
            
            print(f"  Accuracy:  {accuracy:.4f}")
            print(f"  Precision: {precision:.4f}")
            print(f"  Recall:    {recall:.4f}")
            print(f"  F1-Score:  {f1:.4f}")
            
            print(f"\n  Classification Report:")
            print(classification_report(self.y_test, y_pred, 
                                      target_names=self.label_encoder.classes_))
            
            # Cross-validation
            cv_scores = cross_val_score(model, self.X_train_scaled, self.y_train, cv=5)
            print(f"\n  Cross-Validation Scores: {cv_scores}")
            print(f"  Mean CV Score: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
        
        return self.results
    
    def save_models(self, output_dir='models'):
        """Save trained models to disk."""
        print("\n[6/8] SAVING MODELS")
        print("=" * 70)
        
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        for model_name, model in self.models.items():
            file_path = output_path / f'motion_model_{model_name.lower().replace(" ", "_")}.pkl'
            joblib.dump(model, file_path)
            print(f"✓ Saved: {file_path}")
        
        # Save scaler
        scaler_path = output_path / 'motion_scaler.pkl'
        joblib.dump(self.scaler, scaler_path)
        print(f"✓ Saved: {scaler_path}")
        
        # Save label encoder
        encoder_path = output_path / 'motion_label_encoder.pkl'
        joblib.dump(self.label_encoder, encoder_path)
        print(f"✓ Saved: {encoder_path}")
        
        return output_path
    
    def generate_report(self, output_file='training_report.txt'):
        """Generate comprehensive training report."""
        print("\n[7/8] GENERATING REPORT")
        print("=" * 70)
        
        report_lines = [
            "=" * 70,
            "MOTION SENSOR MODEL TRAINING REPORT",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 70,
            "",
            "DATA SUMMARY",
            "-" * 70,
            f"Total Records: {len(self.df)}",
            f"Natural Data: {len(self.df[self.df['data_type'] == 'natural'])}",
            f"Artificial Data: {len(self.df[self.df['data_type'] == 'artificial'])}",
            "",
            "MODEL PERFORMANCE",
            "-" * 70,
        ]
        
        for model_name, metrics in self.results.items():
            report_lines.extend([
                f"\n{model_name}:",
                f"  Accuracy:  {metrics['accuracy']:.4f}",
                f"  Precision: {metrics['precision']:.4f}",
                f"  Recall:    {metrics['recall']:.4f}",
                f"  F1-Score:  {metrics['f1']:.4f}",
            ])
        
        report_lines.extend([
            "",
            "RECOMMENDATION",
            "-" * 70,
        ])
        
        # Find best model
        best_model = max(self.results.items(), key=lambda x: x[1]['f1'])
        report_lines.append(f"Best Model: {best_model[0]} (F1-Score: {best_model[1]['f1']:.4f})")
        
        report_content = "\n".join(report_lines)
        
        with open(output_file, 'w') as f:
            f.write(report_content)
        
        print(f"✓ Report saved to: {output_file}")
        print("\n" + report_content)
        
        return report_content
    
    def run_pipeline(self):
        """Run complete analysis and training pipeline."""
        print("\n" + "=" * 70)
        print("MOTION SENSOR DATA ANALYSIS AND MODEL TRAINING PIPELINE")
        print("=" * 70)
        
        try:
            # Step 1: Load data
            self.load_data()
            
            # Step 2: Exploratory analysis
            self.exploratory_analysis()
            
            # Step 3: Preprocess
            self.preprocess_data()
            
            # Step 4: Train models
            self.train_models()
            
            # Step 5: Evaluate
            self.evaluate_models()
            
            # Step 6: Save models
            self.save_models()
            
            # Step 7: Generate report
            self.generate_report()
            
            print("\n[8/8] PIPELINE COMPLETE")
            print("=" * 70)
            print("✓ All steps completed successfully!")
            print("=" * 70)
            
        except Exception as e:
            print(f"\n✗ Error in pipeline: {str(e)}")
            raise

def main():
    """Main entry point."""
    analyzer = MotionDataAnalyzer(data_dir='datasets/training_data')
    analyzer.run_pipeline()

if __name__ == '__main__':
    main()
