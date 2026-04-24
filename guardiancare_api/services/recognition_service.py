"""
services/recognition_service.py
Thin wrapper around FaceRecognitionModel.
"""

import numpy as np

from guardiancare_api.models.face_model import FaceRecognitionModel
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)


class RecognitionService:
    def __init__(self, model: FaceRecognitionModel):
        self._model = model

    def identify(self, frame: np.ndarray) -> str:
        """
        Identify person in frame. Returns name string or 'Unknown'.
        """
        try:
            name = self._model.identify(frame)
            log.info(f"Face recognition — identified: {name}")
            return name
        except Exception as exc:
            log.error(f"RecognitionService error: {exc}")
            return "Unknown"
