#!/usr/bin/env python3
"""
Analyze natural/artificial motion datasets and train a classifier.

Inputs:
- datasets/natural.json
- datasets/artificial.json

Outputs:
- models/two_class_motion_model.pkl
- models/two_class_motion_scaler.pkl
- models/two_class_motion_metrics.json
- models/two_class_motion_report.txt
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


DATA_DIR = Path("datasets")
NATURAL_PATH = DATA_DIR / "natural.json"
ARTIFICIAL_PATH = DATA_DIR / "artificial.json"
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)

FEATURES = ["ax", "ay", "az", "m", "r"]
LABEL_MAP = {0: "Natural", 1: "Artificial"}


def load_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_dataframe() -> pd.DataFrame:
    natural = load_json(NATURAL_PATH)
    artificial = load_json(ARTIFICIAL_PATH)

    for row in natural:
        row["label"] = 0
    for row in artificial:
        row["label"] = 1

    df = pd.DataFrame(natural + artificial)

    # Ensure numeric features
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=FEATURES + ["label"]).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped} rows with invalid numeric values.")

    return df


def dataset_analysis(df: pd.DataFrame) -> dict:
    counts = df["label"].value_counts().to_dict()
    natural_count = int(counts.get(0, 0))
    artificial_count = int(counts.get(1, 0))
    imbalance_ratio = (
        round(max(natural_count, artificial_count) / max(1, min(natural_count, artificial_count)), 3)
        if natural_count and artificial_count
        else None
    )

    by_class = {}
    for label in [0, 1]:
        d = df[df["label"] == label]
        by_class[LABEL_MAP[label]] = {
            "count": int(len(d)),
            "feature_means": {f: float(d[f].mean()) for f in FEATURES},
            "feature_stds": {f: float(d[f].std(ddof=0)) for f in FEATURES},
            "feature_mins": {f: float(d[f].min()) for f in FEATURES},
            "feature_maxs": {f: float(d[f].max()) for f in FEATURES},
        }

    return {
        "total_samples": int(len(df)),
        "natural_samples": natural_count,
        "artificial_samples": artificial_count,
        "imbalance_ratio_majority_to_minority": imbalance_ratio,
        "features": FEATURES,
        "per_class_stats": by_class,
    }


def build_models() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        class_weight="balanced",
                        max_iter=2000,
                        random_state=42,
                    ),
                ),
            ]
        ),
        "svm_rbf": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "model",
                    SVC(
                        kernel="rbf",
                        probability=True,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=300,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        ),
        "gradient_boosting": Pipeline(
            [
                ("scaler", StandardScaler()),
                ("model", GradientBoostingClassifier(random_state=42)),
            ]
        ),
    }


def evaluate_and_train(df: pd.DataFrame) -> tuple[dict, str, Pipeline, pd.DataFrame, pd.Series, pd.Series]:
    X = df[FEATURES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    models = build_models()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results = {}
    best_name = None
    best_score = -1.0
    best_model = None

    for name, pipe in models.items():
        cv_f1 = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="f1_macro")
        cv_acc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="accuracy")

        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)

        if hasattr(pipe, "predict_proba"):
            proba = pipe.predict_proba(X_test)[:, 1]
        else:
            # fallback for models without probability
            proba = pred.astype(float)

        metrics = {
            "cv_f1_macro_mean": float(np.mean(cv_f1)),
            "cv_f1_macro_std": float(np.std(cv_f1)),
            "cv_accuracy_mean": float(np.mean(cv_acc)),
            "test_accuracy": float(accuracy_score(y_test, pred)),
            "test_f1_macro": float(f1_score(y_test, pred, average="macro")),
            "test_precision_macro": float(precision_score(y_test, pred, average="macro", zero_division=0)),
            "test_recall_macro": float(recall_score(y_test, pred, average="macro", zero_division=0)),
            "test_roc_auc": float(roc_auc_score(y_test, proba)),
            "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
            "classification_report": classification_report(
                y_test,
                pred,
                target_names=["Natural", "Artificial"],
                output_dict=True,
                zero_division=0,
            ),
        }

        results[name] = metrics

        if metrics["test_f1_macro"] > best_score:
            best_score = metrics["test_f1_macro"]
            best_name = name
            best_model = pipe

    assert best_name is not None and best_model is not None
    return results, best_name, best_model, X_test, y_test, y


def save_outputs(analysis: dict, results: dict, best_name: str, best_model: Pipeline) -> None:
    model_path = MODELS_DIR / "two_class_motion_model.pkl"
    metrics_path = MODELS_DIR / "two_class_motion_metrics.json"
    report_path = MODELS_DIR / "two_class_motion_report.txt"

    joblib.dump(best_model, model_path)

    payload = {
        "dataset_analysis": analysis,
        "model_results": results,
        "best_model": best_name,
    }

    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    lines = []
    lines.append("Two-Class Motion Dataset Analysis + Training")
    lines.append("=" * 52)
    lines.append("")
    lines.append(f"Total samples: {analysis['total_samples']}")
    lines.append(f"Natural: {analysis['natural_samples']}")
    lines.append(f"Artificial: {analysis['artificial_samples']}")
    lines.append(f"Imbalance ratio (maj:min): {analysis['imbalance_ratio_majority_to_minority']}")
    lines.append("")

    for name, m in results.items():
        lines.append(f"Model: {name}")
        lines.append(f"  CV F1-macro: {m['cv_f1_macro_mean']:.4f} ± {m['cv_f1_macro_std']:.4f}")
        lines.append(f"  Test accuracy: {m['test_accuracy']:.4f}")
        lines.append(f"  Test F1-macro: {m['test_f1_macro']:.4f}")
        lines.append(f"  Test ROC-AUC: {m['test_roc_auc']:.4f}")
        lines.append(f"  Confusion matrix: {m['confusion_matrix']}")
        lines.append("")

    lines.append(f"Best model: {best_name}")
    lines.append(f"Saved model: {model_path}")
    lines.append(f"Saved metrics: {metrics_path}")

    with report_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main() -> None:
    if not NATURAL_PATH.exists() or not ARTIFICIAL_PATH.exists():
        raise FileNotFoundError(
            f"Missing dataset files. Expected: {NATURAL_PATH} and {ARTIFICIAL_PATH}"
        )

    df = build_dataframe()
    analysis = dataset_analysis(df)

    print("Dataset loaded.")
    print(f"Total: {analysis['total_samples']} | Natural: {analysis['natural_samples']} | Artificial: {analysis['artificial_samples']}")

    results, best_name, best_model, _, _, _ = evaluate_and_train(df)
    save_outputs(analysis, results, best_name, best_model)

    print("\nTraining complete.")
    print(f"Best model: {best_name}")
    print("Artifacts:")
    print(f"- {MODELS_DIR / 'two_class_motion_model.pkl'}")
    print(f"- {MODELS_DIR / 'two_class_motion_metrics.json'}")
    print(f"- {MODELS_DIR / 'two_class_motion_report.txt'}")


if __name__ == "__main__":
    main()
