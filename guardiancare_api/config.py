"""
config.py
Central configuration — reads .env and resolves all file paths.
Every other module imports from here instead of calling load_dotenv() again.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Fall_Detection/ (two levels up from this file)
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

# Telegram
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
CHAT_ID   = os.getenv("CHAT_ID", "")

# File system paths
KNOWN_FACES_DIR    = BASE_DIR / os.getenv("KNOWN_FACES_DIR", "known_faces")
MODEL_PATH         = BASE_DIR / os.getenv("MODEL_PATH",      "fall_det_1.pt")
DB_PATH            = BASE_DIR / os.getenv("DB_PATH",         "guardiancare.db")
ALERTS_DIR         = BASE_DIR / "alerts"
VITALS_MODEL_PATH  = BASE_DIR / "models" / "vitals_model.pkl"
VITALS_SCALER_PATH = BASE_DIR / "models" / "vitals_scaler.pkl"
VITALS_LABELS_PATH = BASE_DIR / "models" / "vitals_labels.pkl"

# Fall detection thresholds (mirror video.py defaults)
FALL_CONF_THRESHOLD = float(os.getenv("FALL_CONF", "0.75"))
FALL_CLASS_NAME     = "Fall-Detected"
DEEPFACE_THRESHOLD  = float(os.getenv("DEEPFACE_THRESHOLD", "0.25"))

# Auth
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://aaefunchgdshcbtadoyc.supabase.co")
JWKS_URL     = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
