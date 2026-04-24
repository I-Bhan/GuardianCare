"""
models/face_model.py
DeepFace face-recognition wrapper.
Uses the known_faces/ directory that already exists in the project.
"""

import os
import numpy as np
from deepface import DeepFace

from guardiancare_api.config import KNOWN_FACES_DIR, DEEPFACE_THRESHOLD
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)


class FaceRecognitionModel:
    def __init__(self):
        self.db_path   = str(KNOWN_FACES_DIR)
        self.threshold = DEEPFACE_THRESHOLD
        self._ready    = os.path.isdir(self.db_path) and bool(os.listdir(self.db_path))
        if self._ready:
            log.info(f"Face DB ready: {self.db_path}")
        else:
            log.warning(f"known_faces/ is missing or empty — face ID disabled")

    def identify(self, frame: np.ndarray) -> str:
        """
        Match a face in the frame against known_faces/.
        Returns the recognised name or 'Unknown'.
        """
        if not self._ready:
            return "Unknown"

        try:
            results = DeepFace.find(
                img_path=frame,
                db_path=self.db_path,
                enforce_detection=False,
                silent=True,
                threshold=self.threshold,
            )
            if not results or results[0].empty:
                return "Unknown"

            best = results[0].iloc[0]

            # Reject if distance is too large
            dist_cols = [c for c in best.index if "distance" in c.lower()]
            if dist_cols and float(best[dist_cols[0]]) > self.threshold:
                return "Unknown"

            # Extract name from filename: "Abdulrahaman_3.jpg" → "Abdulrahaman"
            raw  = os.path.splitext(os.path.basename(best["identity"]))[0]
            name = raw.rsplit("_", 1)[0]
            return name

        except Exception as exc:
            log.warning(f"Face identification error: {exc}")
            return "Unknown"
