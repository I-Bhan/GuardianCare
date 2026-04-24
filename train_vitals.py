"""
train_vitals.py
Trains a Gradient Boosting vitals risk classifier.

Run:
    python train_vitals.py

Outputs:
    models/vitals_model.pkl
    models/vitals_scaler.pkl
    models/vitals_labels.pkl
"""

import pandas as pd
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, accuracy_score
import joblib

BASE_DIR   = Path(__file__).resolve().parent
DATA_PATH  = BASE_DIR / "human_vital_signs_dataset_2024.csv"
MODELS_DIR = BASE_DIR / "models"

FEATURES = [
    "Heart Rate",
    "Body Temperature",
    "Oxygen Saturation",
    "Systolic Blood Pressure",
    "Diastolic Blood Pressure",
]
TARGET = "Risk Category"


def main():
    print("=" * 55)
    print("  GuardianCare — Vitals Risk Model Training")
    print("=" * 55)

    # ── 1. Load ────────────────────────────────────────────────
    print(f"\n[1/5] Loading dataset: {DATA_PATH.name}")
    df = pd.read_csv(DATA_PATH)
    print(f"      Rows: {len(df):,}  |  Columns: {len(df.columns)}")
    print(f"      Target distribution:\n{df[TARGET].value_counts().to_string()}")

    # ── 2. Prepare ─────────────────────────────────────────────
    print("\n[2/5] Preparing features and labels...")
    X = df[FEATURES].values
    le = LabelEncoder()
    y = le.fit_transform(df[TARGET])
    classes = list(le.classes_)
    print(f"      Features : {FEATURES}")
    print(f"      Classes  : {dict(zip(classes, le.transform(classes)))}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"      Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    # ── 3. Scale ───────────────────────────────────────────────
    print("\n[3/5] Scaling features (StandardScaler)...")
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # ── 4. Train ───────────────────────────────────────────────
    print("\n[4/5] Training Gradient Boosting Classifier...")
    model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.10,
        max_depth=4,
        subsample=0.85,
        random_state=42,
    )
    model.fit(X_train_s, y_train)

    y_pred = model.predict(X_test_s)
    acc    = accuracy_score(y_test, y_pred)
    print(f"\n      Test Accuracy: {acc:.4f}  ({acc * 100:.2f}%)")
    print("\n      Classification Report:")
    print(classification_report(y_test, y_pred, target_names=classes))

    # ── 5. Save ────────────────────────────────────────────────
    print(f"\n[5/5] Saving artifacts → {MODELS_DIR}/")
    MODELS_DIR.mkdir(exist_ok=True)

    joblib.dump(model,  MODELS_DIR / "vitals_model.pkl")
    joblib.dump(scaler, MODELS_DIR / "vitals_scaler.pkl")
    joblib.dump({"classes": classes, "features": FEATURES},
                MODELS_DIR / "vitals_labels.pkl")

    print("      vitals_model.pkl   ✓")
    print("      vitals_scaler.pkl  ✓")
    print("      vitals_labels.pkl  ✓")
    print("\n  Training complete! Run the API with:")
    print("  uvicorn guardiancare_api.main:app --reload\n")


if __name__ == "__main__":
    main()
