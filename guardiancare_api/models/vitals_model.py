"""
models/vitals_model.py
Loads the trained Gradient Boosting vitals classifier.
Run train_vitals.py first to generate the .pkl files.
"""

import numpy as np
import joblib
from typing import Optional

from guardiancare_api.config import (
    VITALS_MODEL_PATH,
    VITALS_SCALER_PATH,
    VITALS_LABELS_PATH,
)
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)

# Expected feature order (must match train_vitals.py FEATURES list)
FEATURE_NAMES = [
    "Heart Rate",
    "Body Temperature",
    "Oxygen Saturation",
    "Systolic Blood Pressure",
    "Diastolic Blood Pressure",
]


class VitalsClassificationModel:
    def __init__(self):
        self._ready  = False
        self._model  = None
        self._scaler = None
        self._classes: list[str] = []
        self._load()

    def _load(self):
        try:
            self._model   = joblib.load(VITALS_MODEL_PATH)
            self._scaler  = joblib.load(VITALS_SCALER_PATH)
            labels_info   = joblib.load(VITALS_LABELS_PATH)
            self._classes = labels_info["classes"]
            self._ready   = True
            log.info("Vitals model loaded successfully")
        except FileNotFoundError:
            log.warning(
                "Vitals model not found. Run 'python train_vitals.py' first."
            )
        except Exception as exc:
            log.error(f"Failed to load vitals model: {exc}")

    @property
    def is_ready(self) -> bool:
        return self._ready

    def predict(self, vitals: dict) -> dict:
        """
        Predict risk level from vitals dictionary.

        Args:
            vitals: {heart_rate, body_temperature, oxygen_saturation,
                     systolic_bp, diastolic_bp}

        Returns:
            {risk_level: str, confidence: float}
        """
        if not self._ready:
            raise RuntimeError("Vitals model is not loaded. Run train_vitals.py first.")

        features = np.array([[
            vitals["heart_rate"],
            vitals["body_temperature"],
            vitals["oxygen_saturation"],
            vitals["systolic_bp"],
            vitals["diastolic_bp"],
        ]])

        scaled      = self._scaler.transform(features)
        class_idx   = int(self._model.predict(scaled)[0])
        proba       = self._model.predict_proba(scaled)[0]
        confidence  = float(proba[class_idx])
        risk_level  = self._classes[class_idx]

        return {
            "risk_level": risk_level,
            "confidence": round(confidence, 4),
        }
