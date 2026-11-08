"""
config.py
Central configuration — reads .env and resolves all file paths.
Every other module imports from here instead of calling load_dotenv() again.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Project root, independent of the current working directory.
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

# Telegram
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
CHAT_ID   = os.getenv("CHAT_ID", "")

# File system paths
KNOWN_FACES_DIR    = BASE_DIR / os.getenv("KNOWN_FACES_DIR", "known_faces")


def local_asset(variable: str, directory: str, filename: str) -> Path:
    """Honor explicit paths and recognize older installations with root-level assets."""
    configured = os.getenv(variable)
    if configured:
        return BASE_DIR / configured
    preferred = BASE_DIR / directory / filename
    legacy = BASE_DIR / filename
    return legacy if not preferred.exists() and legacy.is_file() else preferred


MODEL_PATH = local_asset("MODEL_PATH", "models", "fall_det_1.pt")
DB_PATH = local_asset("DB_PATH", "data", "guardiancare.db")
ALERTS_DIR         = BASE_DIR / "alerts"
VITALS_MODEL_PATH  = BASE_DIR / "models" / "vitals_model.pkl"
VITALS_SCALER_PATH = BASE_DIR / "models" / "vitals_scaler.pkl"
VITALS_LABELS_PATH = BASE_DIR / "models" / "vitals_labels.pkl"

# The original installation stored the training CSV in the project root.
_dataset_name = "human_vital_signs_dataset_2024.csv"
VITALS_DATASET = BASE_DIR / "data" / _dataset_name
if not VITALS_DATASET.exists() and (BASE_DIR / _dataset_name).is_file():
    VITALS_DATASET = BASE_DIR / _dataset_name

# Fall detection thresholds (used by the API and standalone video tool)
FALL_CONF_THRESHOLD = float(os.getenv("FALL_CONF", "0.75"))
FALL_CLASS_NAME     = "Fall-Detected"
DEEPFACE_THRESHOLD  = float(os.getenv("DEEPFACE_THRESHOLD", "0.25"))

# Auth
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://aaefunchgdshcbtadoyc.supabase.co")
JWKS_URL     = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
SIMULATOR_API_KEY = os.getenv("SIMULATOR_API_KEY", "")
