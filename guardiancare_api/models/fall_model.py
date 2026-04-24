"""
models/fall_model.py
YOLO fall-detection wrapper.
Loads fall_det_1.pt once and exposes a detect() method.
"""

import os
import numpy as np
from ultralytics import YOLO

from guardiancare_api.config import MODEL_PATH, FALL_CONF_THRESHOLD, FALL_CLASS_NAME
from guardiancare_api.utils.logger import get_logger

# Suppress duplicate-lib warnings from Intel OpenMP
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "True")

log = get_logger(__name__)


class FallDetectionModel:
    def __init__(self):
        log.info(f"Loading YOLO model from: {MODEL_PATH}")
        self.model      = YOLO(str(MODEL_PATH))
        self.conf       = FALL_CONF_THRESHOLD
        self.class_name = FALL_CLASS_NAME
        log.info(f"YOLO model loaded | classes: {self.model.names}")

    def detect(self, frame: np.ndarray) -> dict:
        """
        Run fall detection on a single frame.

        Returns:
            {
                "fall_detected": bool,
                "confidence": float,   # highest fall-class score or 0
                "annotated_frame": np.ndarray,
            }
        """
        results = self.model.predict(
            frame, conf=self.conf, verbose=False
        )
        r = results[0]

        fall_detected = False
        confidence    = 0.0

        if r.boxes is not None and len(r.boxes):
            for i, cls_id in enumerate(r.boxes.cls.tolist()):
                if self.model.names.get(int(cls_id), "") == self.class_name:
                    fall_detected = True
                    score = float(r.boxes.conf[i])
                    confidence = max(confidence, score)

        annotated = r.plot()

        return {
            "fall_detected":  fall_detected,
            "confidence":     round(confidence, 4),
            "annotated_frame": annotated,
        }
