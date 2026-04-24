"""
services/detection_service.py
Thin wrapper around FallDetectionModel that returns a clean result dict.
"""

import numpy as np

from guardiancare_api.models.fall_model import FallDetectionModel
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)


class DetectionService:
    def __init__(self, model: FallDetectionModel):
        self._model = model

    def analyze(self, frame: np.ndarray) -> dict:
        """
        Run fall detection and return a structured result.

        Returns:
            {
                "fall_detected": bool,
                "confidence":    float,
                "annotated_frame": np.ndarray,
            }
        """
        try:
            result = self._model.detect(frame)
            log.info(
                f"Fall detection — detected={result['fall_detected']} "
                f"conf={result['confidence']}"
            )
            return result
        except Exception as exc:
            log.error(f"DetectionService error: {exc}")
            return {
                "fall_detected":  False,
                "confidence":     0.0,
                "annotated_frame": frame,
            }
