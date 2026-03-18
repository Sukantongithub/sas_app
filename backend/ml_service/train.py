"""
train.py — Standalone training script for the Motion Pattern Detector
======================================================================
Usage:
    python train.py
    python train.py --samples 15000 --cv-folds 5 --no-tune
    python train.py --samples 10000 --output-dir ./models

Options:
    --samples     Number of synthetic training samples (default: 10000)
    --cv-folds    Number of stratified K-Fold CV splits  (default: 5)
    --no-tune     Skip GridSearchCV hyperparameter tuning (faster)
    --output-dir  Directory to save model artifacts (default: script directory)
    --seed        Random seed for reproducibility     (default: 42)
"""

import argparse
import os
import sys
import time

# Ensure this script can import motion_detector from the same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motion_detector import MotionPatternDetector


def main():
    parser = argparse.ArgumentParser(
        description="Train the RandomForest Motion Pattern Detector",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--samples", type=int, default=10000,
        help="Number of synthetic training samples (half genuine, half artificial)"
    )
    parser.add_argument(
        "--cv-folds", type=int, default=5,
        help="Number of stratified K-Fold cross-validation splits"
    )
    parser.add_argument(
        "--no-tune", action="store_true",
        help="Skip GridSearchCV — use default hyperparameters (much faster)"
    )
    parser.add_argument(
        "--output-dir", type=str, default=None,
        help="Directory to save model artifacts (model pkl, scaler, metadata, plot)"
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for reproducibility"
    )
    args = parser.parse_args()

    output_dir = args.output_dir or os.path.dirname(os.path.abspath(__file__))
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n{'='*65}")
    print("  Motion Pattern Detector — Training Script")
    print(f"{'='*65}")
    print(f"  Samples       : {args.samples:,}")
    print(f"  CV Folds      : {args.cv_folds}")
    print(f"  Hyperp. Tune  : {'No (--no-tune)' if args.no_tune else 'Yes (GridSearchCV)'}")
    print(f"  Output dir    : {output_dir}")
    print(f"  Random seed   : {args.seed}")

    start = time.time()
    detector = MotionPatternDetector(model_dir=output_dir)
    metadata = detector.train(
        n_samples=args.samples,
        cv_folds=args.cv_folds,
        tune_hyperparams=not args.no_tune,
        seed=args.seed,
    )
    elapsed = time.time() - start

    print(f"\n{'='*65}")
    print("  TRAINING SUMMARY")
    print(f"{'='*65}")
    print(f"  Total time        : {elapsed:.1f}s")
    print(f"  CV Accuracy       : {metadata['cv_accuracy_mean']:.4f} "
          f"± {metadata['cv_accuracy_std']:.4f}")
    print(f"  CV F1-Score       : {metadata['cv_f1_mean']:.4f}")
    print(f"  CV ROC-AUC        : {metadata['cv_auc_mean']:.4f}")
    print(f"  Test Accuracy     : {metadata['test_accuracy']:.4f}")
    print(f"  Test F1-Score     : {metadata['test_f1']:.4f}")
    print(f"  Sensitivity (TPR) : {metadata['sensitivity']:.4f}")
    print(f"  Specificity (TNR) : {metadata['specificity']:.4f}")
    print(f"{'='*65}\n")

    checks = [
        ("CV Accuracy ≥ 95%",   metadata["cv_accuracy_mean"] >= 0.95),
        ("Test Accuracy ≥ 95%", metadata["test_accuracy"]    >= 0.95),
        ("Sensitivity ≥ 92%",   metadata["sensitivity"]      >= 0.92),
        ("Specificity ≥ 92%",   metadata["specificity"]      >= 0.92),
    ]
    all_passed = True
    for label, passed in checks:
        status     = "✅ PASS" if passed else "⚠️  WARN"
        all_passed = all_passed and passed
        print(f"  {status}  {label}")

    print()
    if all_passed:
        print("  🎉 All quality checks passed!")
    else:
        print("  ⚠️  Some checks did not meet targets.")
        print("     Consider increasing --samples or re-running with --seed=<other>.")
    print()


if __name__ == "__main__":
    main()
