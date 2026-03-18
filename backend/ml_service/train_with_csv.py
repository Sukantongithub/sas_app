"""
train_with_csv.py — Train Motion Pattern Detector using real IMU CSV data
==========================================================================
This script reads the motion_training_dataset.csv (columns: AX, AY, AZ,
GX, GY, GZ, label) and trains the RandomForest motion classifier.

Strategy:
  1. Load real IMU CSV → convert 6-axis rows to magnitude sequences
  2. Group rows into sequences per label (window_size rows per sequence)
  3. Mix real sequences with synthetic ones (expand real data via augmentation)
  4. Train the MotionPatternDetector on the combined dataset
  5. Save updated model, scaler, and metadata

Usage:
    python train_with_csv.py
    python train_with_csv.py --csv motion_training_dataset.csv --synthetic 8000 --no-tune
"""

import argparse
import os
import sys
import time
import warnings

import numpy as np
import pandas as pd
from sklearn.model_selection import (
    StratifiedKFold, GridSearchCV, cross_val_score, train_test_split
)
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
import joblib
import json
from datetime import datetime

warnings.filterwarnings("ignore")

# ── ensure local imports work ────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from motion_detector import (
    MotionPatternDetector, extract_features,
    generate_training_data, FEATURE_NAMES, N_FEATURES, MODEL_VERSION
)

# ─────────────────────────────────────────────────────────────────────────────
# CSV Processing Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_csv(csv_path: str):
    """
    Load the IMU CSV and return (sequences_genuine, sequences_artificial).

    Each sequence is a list of scalar magnitude values derived from
    the 6-axis IMU data:
        magnitude = sqrt(AX^2 + AY^2 + AZ^2 + GX^2 + GY^2 + GZ^2)

    All rows belonging to the same class are treated as one long stream;
    we then window them into overlapping sequences.
    """
    df = pd.read_csv(csv_path)
    df.columns = [c.strip() for c in df.columns]

    # Normalise label column
    label_col = "label"
    df[label_col] = df[label_col].str.strip().str.lower()

    print(f"\n  CSV loaded: {len(df)} rows, columns={list(df.columns)}")
    print(f"  Label distribution:\n{df[label_col].value_counts().to_string()}\n")

    # Compute per-row magnitude (6-axis)
    accel_cols = ["AX", "AY", "AZ"]
    gyro_cols  = ["GX", "GY", "GZ"]
    all_imu    = accel_cols + gyro_cols

    df["magnitude"] = np.sqrt((df[all_imu] ** 2).sum(axis=1))

    genuine_rows    = df[df[label_col] == "natural"]["magnitude"].tolist()
    artificial_rows = df[df[label_col] == "artificial"]["magnitude"].tolist()

    return genuine_rows, artificial_rows


def build_sequences_from_rows(rows, window: int = 20, step: int = 5):
    """
    Slide a window over a flat list of magnitude values to create sequences.
    Returns a list of np.arrays each of length `window`.
    """
    seqs = []
    for start in range(0, len(rows) - window + 1, step):
        seqs.append(np.array(rows[start:start + window]))
    # If we got zero sequences (very short stream), pad the whole stream
    if not seqs and rows:
        arr = np.array(rows)
        while len(arr) < window:
            arr = np.append(arr, arr[-1])
        seqs.append(arr[:window])
    return seqs


def augment_real_sequences(seqs, n_target: int, rng: np.random.Generator):
    """
    Expand a small list of real sequences by adding small Gaussian noise
    until we reach n_target. Returns the list including originals.
    """
    augmented = list(seqs)
    while len(augmented) < n_target:
        base  = seqs[rng.integers(0, len(seqs))]
        noise = rng.normal(0, float(base.std() * 0.05 + 1e-6), len(base))
        augmented.append(np.clip(base + noise, base.min() * 0.5, base.max() * 1.5))
    return augmented


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Train Motion Detector with real IMU CSV + synthetic data",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--csv", type=str,
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "motion_training_dataset.csv"),
        help="Path to the IMU training CSV"
    )
    parser.add_argument(
        "--synthetic", type=int, default=8000,
        help="Number of extra synthetic samples to add (balanced)"
    )
    parser.add_argument(
        "--cv-folds", type=int, default=5,
        help="Stratified K-Fold splits"
    )
    parser.add_argument(
        "--no-tune", action="store_true",
        help="Skip GridSearchCV (much faster)"
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed"
    )
    parser.add_argument(
        "--output-dir", type=str, default=None,
        help="Where to save model artifacts (default: script directory)"
    )
    parser.add_argument(
        "--window", type=int, default=20,
        help="Sliding-window size (rows) per sequence from CSV"
    )
    args = parser.parse_args()

    output_dir = args.output_dir or os.path.dirname(os.path.abspath(__file__))
    os.makedirs(output_dir, exist_ok=True)
    rng = np.random.default_rng(args.seed)

    print("\n" + "=" * 65)
    print("  MOTION DETECTOR — CSV-ENHANCED TRAINING")
    print("=" * 65)
    print(f"  CSV file        : {args.csv}")
    print(f"  Synthetic extra : {args.synthetic}")
    print(f"  CV folds        : {args.cv_folds}")
    print(f"  Hyper-tune      : {'No' if args.no_tune else 'Yes (GridSearchCV)'}")
    print(f"  Output dir      : {output_dir}")
    print(f"  Window size     : {args.window}")

    # ── Step 1: Load CSV ──────────────────────────────────────────────────────
    print("\n[1/6] Loading real IMU CSV …")
    genuine_rows, artificial_rows = load_csv(args.csv)

    gen_seqs  = build_sequences_from_rows(genuine_rows,    window=args.window)
    art_seqs  = build_sequences_from_rows(artificial_rows, window=args.window)
    print(f"      Real sequences — Genuine: {len(gen_seqs)}, Artificial: {len(art_seqs)}")

    # ── Step 2: Augment real sequences ────────────────────────────────────────
    print("\n[2/6] Augmenting real sequences …")
    # We want at least 500 real sequences of each class before mixing synth
    gen_real_target  = max(500, len(gen_seqs)  * 5)
    art_real_target  = max(500, len(art_seqs) * 5)

    gen_seqs_aug  = augment_real_sequences(gen_seqs,  gen_real_target,  rng)
    art_seqs_aug  = augment_real_sequences(art_seqs, art_real_target, rng)
    print(f"      After augmentation — Genuine: {len(gen_seqs_aug)}, Artificial: {len(art_seqs_aug)}")

    # ── Step 3: Synthetic data ────────────────────────────────────────────────
    print(f"\n[3/6] Generating {args.synthetic} synthetic sequences …")
    X_synth, y_synth = generate_training_data(n_samples=args.synthetic, seed=args.seed)

    # ── Step 4: Build combined feature matrix ─────────────────────────────────
    print("\n[4/6] Extracting features from real+synthetic sequences …")
    X_real, y_real = [], []
    for seq in gen_seqs_aug:
        X_real.append(extract_features(seq))
        y_real.append(0)  # 0 = Genuine
    for seq in art_seqs_aug:
        X_real.append(extract_features(seq))
        y_real.append(1)  # 1 = Artificial

    X_real = np.array(X_real, dtype=float)
    y_real = np.array(y_real, dtype=int)

    # Combine
    X = np.vstack([X_real, X_synth])
    y = np.concatenate([y_real, y_synth])
    print(f"      Total dataset: {len(X)} samples "
          f"({np.sum(y==0)} Genuine, {np.sum(y==1)} Artificial)")
    print(f"        Real: {len(X_real)} | Synthetic: {len(X_synth)}")

    # ── Step 5: Train via MotionPatternDetector plumbing ─────────────────────
    print("\n[5/6] Training RandomForest …")
    from sklearn.preprocessing import StandardScaler
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    if not args.no_tune:
        print("      Running GridSearchCV …")
        param_grid = {
            "n_estimators":     [200, 300],
            "max_depth":        [15, 25, None],
            "min_samples_split":[2, 4],
            "min_samples_leaf": [1, 2],
            "max_features":     ["sqrt", "log2"],
        }
        inner_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=args.seed)
        gs = GridSearchCV(
            RandomForestClassifier(class_weight="balanced", random_state=args.seed, n_jobs=-1),
            param_grid, cv=inner_cv, scoring="f1_weighted", n_jobs=-1, verbose=0
        )
        gs.fit(X_scaled, y)
        best_params = gs.best_params_
        print(f"      Best params : {best_params}")
        print(f"      Best CV F1  : {gs.best_score_:.4f}")
    else:
        best_params = {
            "n_estimators": 300, "max_depth": 25,
            "min_samples_split": 2, "min_samples_leaf": 1,
            "max_features": "sqrt",
        }
        print(f"      Using default params: {best_params}")

    # K-Fold CV
    print(f"\n      Stratified {args.cv_folds}-Fold cross-validation …")
    rf_cv = RandomForestClassifier(
        **best_params, bootstrap=True,
        class_weight="balanced", random_state=args.seed, n_jobs=-1
    )
    outer_cv = StratifiedKFold(n_splits=args.cv_folds, shuffle=True, random_state=args.seed)
    cv_acc = cross_val_score(rf_cv, X_scaled, y, cv=outer_cv, scoring="accuracy", n_jobs=-1)
    cv_f1  = cross_val_score(rf_cv, X_scaled, y, cv=outer_cv, scoring="f1_weighted", n_jobs=-1)
    cv_auc = cross_val_score(rf_cv, X_scaled, y, cv=outer_cv, scoring="roc_auc", n_jobs=-1)
    print(f"      CV Accuracy : {cv_acc.mean():.4f} ± {cv_acc.std():.4f}")
    print(f"      CV F1-Score : {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")
    print(f"      CV ROC-AUC  : {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")

    # Final model on 80/20 split + calibration
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.20, random_state=args.seed, stratify=y
    )
    calib_cv  = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    final_rf  = RandomForestClassifier(
        **best_params, bootstrap=True,
        class_weight="balanced", random_state=args.seed, n_jobs=-1
    )
    pipeline  = CalibratedClassifierCV(final_rf, method="isotonic", cv=calib_cv)
    pipeline.fit(X_train, y_train)

    # Evaluate
    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc     = accuracy_score(y_test, y_pred)
    f1      = f1_score(y_test, y_pred, average="weighted")
    auc     = roc_auc_score(y_test, y_proba)
    cm      = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    sep = "=" * 65
    print(f"\n{sep}\n  HOLD-OUT TEST RESULTS\n{sep}")
    print(f"  Accuracy          : {acc:.4f}  ({acc:.2%})")
    print(f"  ROC-AUC           : {auc:.4f}")
    print(f"  Sensitivity (TPR) : {sens:.4f}  ({sens:.2%})")
    print(f"  Specificity (TNR) : {spec:.4f}  ({spec:.2%})")
    print(f"\n{sep}\n  CLASSIFICATION REPORT\n{sep}")
    print(classification_report(y_test, y_pred, target_names=["Genuine", "Artificial"]))
    print(f"{sep}\n  CONFUSION MATRIX\n{sep}")
    print(f"                      Predicted")
    print(f"                  Genuine   Artificial")
    print(f"  Actual Genuine    {tn:5d}      {fp:5d}")
    print(f"  Actual Artificial {fn:5d}      {tp:5d}")
    print(f"\n  TP={tp}  TN={tn}  FP={fp}  FN={fn}")

    # ── Feature importance plot ───────────────────────────────────────────────
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        base_rf_trained = pipeline.calibrated_classifiers_[0].estimator
        importances = base_rf_trained.feature_importances_
        indices     = np.argsort(importances)[::-1]

        fig, ax = plt.subplots(figsize=(12, 7))
        colors  = ["#e74c3c" if importances[i] > np.mean(importances)
                   else "#3498db" for i in indices]
        ax.bar(range(N_FEATURES), importances[indices],
               color=colors, edgecolor="white", linewidth=0.5)
        ax.set_xticks(range(N_FEATURES))
        ax.set_xticklabels([FEATURE_NAMES[i] for i in indices],
                           rotation=45, ha="right", fontsize=8)
        ax.set_title("RandomForest Feature Importances (CSV-enhanced model)\n"
                     "(red = above average, blue = below average)",
                     fontsize=13, fontweight="bold")
        ax.set_ylabel("Importance (Gini)", fontsize=10)
        ax.set_xlabel("Feature", fontsize=10)
        ax.grid(axis="y", alpha=0.3, linestyle="--")
        plt.tight_layout()
        plot_path = os.path.join(output_dir, "feature_importance.png")
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"\n📊 Feature importance plot → {plot_path}")
    except ImportError:
        print("\n⚠️  matplotlib not installed — skipping importance plot.")

    # ── Step 6: Save artifacts ────────────────────────────────────────────────
    print("\n[6/6] Saving model artifacts …")
    model_path  = os.path.join(output_dir, "motion_model.pkl")
    scaler_path = os.path.join(output_dir, "scaler.pkl")
    meta_path   = os.path.join(output_dir, "model_metadata.json")

    joblib.dump(pipeline, model_path)
    joblib.dump(scaler,   scaler_path)

    metadata = {
        "version":           MODEL_VERSION,
        "trained_at":        datetime.now().isoformat(),
        "n_samples":         int(len(X)),
        "n_real_samples":    int(len(X_real)),
        "n_synthetic":       int(len(X_synth)),
        "n_features":        N_FEATURES,
        "feature_names":     FEATURE_NAMES,
        "best_params":       best_params,
        "cv_folds":          args.cv_folds,
        "csv_path":          args.csv,
        "window_size":       args.window,
        "cv_accuracy_mean":  round(float(cv_acc.mean()), 6),
        "cv_accuracy_std":   round(float(cv_acc.std()), 6),
        "cv_f1_mean":        round(float(cv_f1.mean()), 6),
        "cv_auc_mean":       round(float(cv_auc.mean()), 6),
        "test_accuracy":     round(float(acc), 6),
        "test_f1":           round(float(f1), 6),
        "test_auc":          round(float(auc), 6),
        "sensitivity":       round(float(sens), 6),
        "specificity":       round(float(spec), 6),
        "confusion_matrix":  cm.tolist(),
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n💾 Model  → {model_path}")
    print(f"💾 Scaler → {scaler_path}")
    print(f"💾 Meta   → {meta_path}")

    # ── Quality checks ────────────────────────────────────────────────────────
    checks = [
        ("CV Accuracy ≥ 95%",   metadata["cv_accuracy_mean"] >= 0.95),
        ("Test Accuracy ≥ 95%", metadata["test_accuracy"]    >= 0.95),
        ("Sensitivity ≥ 92%",   metadata["sensitivity"]      >= 0.92),
        ("Specificity ≥ 92%",   metadata["specificity"]      >= 0.92),
    ]
    print(f"\n{sep}\n  QUALITY CHECKS\n{sep}")
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
        print("     Try increasing --synthetic or adjusting --window.")
    print(f"\n✅ Training complete!\n")
    return metadata


if __name__ == "__main__":
    start = time.time()
    meta  = main()
    print(f"  Total time: {time.time() - start:.1f}s\n")
