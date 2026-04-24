"""
services/vitals_service.py
Validates and analyses vital signs using VitalsClassificationModel.
"""

from guardiancare_api.models.vitals_model import VitalsClassificationModel
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)

# Physiological plausibility bounds used for input validation
VITALS_BOUNDS = {
    "heart_rate":        (20,  250),
    "body_temperature":  (30,  45),
    "oxygen_saturation": (50,  100),
    "systolic_bp":       (50,  300),
    "diastolic_bp":      (30,  200),
}


class VitalsService:
    def __init__(self, model: VitalsClassificationModel):
        self._model = model

    def analyze(self, vitals: dict) -> dict:
        """
        Validate inputs and predict risk level.

        Args:
            vitals: dict with keys matching VITALS_BOUNDS

        Returns:
            {
                "risk_level":  "Low Risk" | "High Risk",
                "confidence":  float,
                "explanation": str,
                "valid":       bool,
                "errors":      list[str],
            }
        """
        errors = self._validate(vitals)
        if errors:
            return {
                "risk_level":  "Unknown",
                "confidence":  0.0,
                "explanation": "Invalid vitals input",
                "valid":       False,
                "errors":      errors,
            }

        if not self._model.is_ready:
            return {
                "risk_level":  "Unknown",
                "confidence":  0.0,
                "explanation": "Vitals model not loaded. Run train_vitals.py first.",
                "valid":       False,
                "errors":      ["Model not ready"],
            }

        try:
            result = self._model.predict(vitals)
            explanation = self._build_explanation(vitals, result["risk_level"])
            log.info(
                f"Vitals analysis — risk={result['risk_level']} "
                f"conf={result['confidence']}"
            )
            return {
                "risk_level":  result["risk_level"],
                "confidence":  result["confidence"],
                "explanation": explanation,
                "valid":       True,
                "errors":      [],
            }
        except Exception as exc:
            log.error(f"VitalsService error: {exc}")
            return {
                "risk_level":  "Unknown",
                "confidence":  0.0,
                "explanation": str(exc),
                "valid":       False,
                "errors":      [str(exc)],
            }

    def _validate(self, vitals: dict) -> list[str]:
        errors = []
        for key, (lo, hi) in VITALS_BOUNDS.items():
            val = vitals.get(key)
            if val is None:
                errors.append(f"Missing field: {key}")
            elif not (lo <= float(val) <= hi):
                errors.append(f"{key}={val} is outside plausible range [{lo}, {hi}]")
        return errors

    def _build_explanation(self, vitals: dict, risk: str) -> str:
        flags = []
        hr   = vitals.get("heart_rate", 0)
        spo2 = vitals.get("oxygen_saturation", 100)
        sbp  = vitals.get("systolic_bp", 120)

        if hr < 60 or hr > 100:
            flags.append(f"HR={hr:.0f} bpm (abnormal)")
        if spo2 < 95:
            flags.append(f"SpO2={spo2:.1f}% (low)")
        if sbp > 140:
            flags.append(f"SBP={sbp:.0f} mmHg (high)")

        if flags:
            return f"{risk}: {', '.join(flags)}"
        return f"{risk}: Vitals within acceptable range"
