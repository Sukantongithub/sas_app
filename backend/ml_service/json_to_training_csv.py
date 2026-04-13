"""
json_to_training_csv.py
=======================
Convert two labeled backend JSON files (natural + artificial) into a
single accelerometer-only training CSV with columns: AX, AY, AZ, LABEL.

Usage:
  python json_to_training_csv.py \
    --natural-json ../datasets/natural_motions.json \
    --artificial-json ../datasets/artificial_motions.json \
    --out-csv motion_training_dataset.csv
"""

import argparse
import csv
import json
import math


def safe_float(value, fallback=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def normalize_row(row):
    if not isinstance(row, dict):
        return None

    ax = safe_float(row.get("ax", row.get("AX", 0.0)), 0.0)
    ay = safe_float(row.get("ay", row.get("AY", 0.0)), 0.0)
    az = safe_float(row.get("az", row.get("AZ", 0.0)), 0.0)

    # If AX/AY/AZ are missing but magnitude exists, place it on X-axis.
    if ax == 0.0 and ay == 0.0 and az == 0.0:
        m = safe_float(row.get("m", row.get("M", float("nan"))), float("nan"))
        if math.isfinite(m) and m > 0:
            ax, ay, az = m, 0.0, 0.0
        else:
            return None

    return ax, ay, az


def load_rows(path, label):
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        raise ValueError(f"JSON must contain an array: {path}")

    rows = []
    skipped = 0
    for item in payload:
        normalized = normalize_row(item)
        if normalized is None:
            skipped += 1
            continue
        ax, ay, az = normalized
        rows.append((ax, ay, az, label))

    return rows, skipped


def main():
    parser = argparse.ArgumentParser(description="Convert labeled JSON to training CSV")
    parser.add_argument("--natural-json", required=True, help="Path to natural motion JSON")
    parser.add_argument("--artificial-json", required=True, help="Path to artificial motion JSON")
    parser.add_argument("--out-csv", default="motion_training_dataset.csv", help="Output CSV path")
    args = parser.parse_args()

    natural_rows, natural_skipped = load_rows(args.natural_json, "natural")
    artificial_rows, artificial_skipped = load_rows(args.artificial_json, "artificial")

    combined = natural_rows + artificial_rows

    if not combined:
        raise ValueError("No valid rows found in the provided JSON files.")

    with open(args.out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["AX", "AY", "AZ", "LABEL"])
        writer.writerows(combined)

    print(f"Saved CSV: {args.out_csv}")
    print(
        "Counts -> "
        f"natural={len(natural_rows)} (skipped={natural_skipped}), "
        f"artificial={len(artificial_rows)} (skipped={artificial_skipped}), "
        f"total={len(combined)}"
    )


if __name__ == "__main__":
    main()
