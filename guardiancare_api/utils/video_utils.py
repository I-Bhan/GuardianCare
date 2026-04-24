"""
utils/video_utils.py
Frame encoding/decoding helpers for the API layer.
"""

import base64
import io
import cv2
import numpy as np
from typing import Optional


def decode_base64_frame(b64_string: str) -> np.ndarray:
    """Decode a base64 image string into an OpenCV BGR frame."""
    # Strip optional data-URL prefix (data:image/jpeg;base64,...)
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    raw = base64.b64decode(b64_string)
    buf = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Could not decode image — check base64 payload.")
    return frame


def encode_frame_base64(frame: np.ndarray, quality: int = 85) -> str:
    """Encode an OpenCV BGR frame to a base64 JPEG string."""
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("cv2.imencode failed")
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def bytes_to_frame(raw_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes (from file upload) to an OpenCV frame."""
    buf   = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode uploaded image bytes.")
    return frame


def resize_frame(frame: np.ndarray, max_dim: int = 640) -> np.ndarray:
    """Resize frame so the longest side is ≤ max_dim, keeping aspect ratio."""
    h, w = frame.shape[:2]
    if max(h, w) <= max_dim:
        return frame
    scale = max_dim / max(h, w)
    return cv2.resize(frame, (int(w * scale), int(h * scale)))
