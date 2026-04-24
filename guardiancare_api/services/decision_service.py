"""
services/decision_service.py
Combines fall-detection, face-recognition, and vitals results into
a single prioritised decision with a human-readable explanation.

Priority rules:
    Fall + High Risk vitals  →  HIGH    (immediate alert)
    Fall only                →  MEDIUM  (alert)
    High Risk vitals only    →  ALERT   (alert)
    Normal                   →  NONE    (no alert)
"""

from datetime import datetime

from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)

HIGH_RISK_LABEL = "High Risk"


class DecisionService:

    def decide(
        self,
        fall_result: dict,
        person_name: str,
        vitals_result: dict,
    ) -> dict:
        """
        Build the final output JSON.

        Args:
            fall_result:   Output from DetectionService.analyze()
            person_name:   Output from RecognitionService.identify()
            vitals_result: Output from VitalsService.analyze()

        Returns:
            Full decision dict matching the API contract.
        """
        fall_detected = fall_result.get("fall_detected", False)
        fall_conf     = fall_result.get("confidence", 0.0)
        risk_level    = vitals_result.get("risk_level", "Unknown")
        vitals_conf   = vitals_result.get("confidence", 0.0)
        is_high_risk  = risk_level == HIGH_RISK_LABEL

        # ── Decision rules ────────────────────────────────────────────────────
        if fall_detected and is_high_risk:
            priority    = "HIGH"
            explanation = "Fall detected + High Risk vitals"
            send_alert  = True
        elif fall_detected:
            priority    = "MEDIUM"
            explanation = "Fall detected"
            send_alert  = True
        elif is_high_risk:
            priority    = "ALERT"
            explanation = "High Risk vitals — no fall"
            send_alert  = True
        else:
            priority    = "NONE"
            explanation = "Normal — no fall, low risk vitals"
            send_alert  = False

        # Combined confidence: average of available signals
        confidences = [c for c in [fall_conf, vitals_conf] if c > 0]
        confidence  = round(sum(confidences) / len(confidences), 4) if confidences else 0.0

        decision = {
            "fall_detected":  fall_detected,
            "person_name":    person_name,
            "risk_level":     risk_level,
            "priority_level": priority,
            "explanation":    explanation,
            "confidence":     confidence,
            "timestamp":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "send_alert":     send_alert,
        }

        log.info(
            f"Decision — priority={priority} person={person_name} "
            f"fall={fall_detected} risk={risk_level}"
        )
        return decision
