"""
guardiancare_api/main.py
FastAPI application entry point.

All AI models are loaded once at startup — never per-request.

Run:
    uvicorn guardiancare_api.main:app --reload
"""

import sys
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure the project root (Fall_Detection/) is on sys.path so that
# Db.py and alert.py are importable as top-level modules.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from guardiancare_api.config import ALLOWED_ORIGINS
from guardiancare_api.utils.logger import get_logger
from guardiancare_api.models.fall_model import FallDetectionModel
from guardiancare_api.models.face_model import FaceRecognitionModel
from guardiancare_api.models.vitals_model import VitalsClassificationModel
from guardiancare_api.services.detection_service import DetectionService
from guardiancare_api.services.recognition_service import RecognitionService
from guardiancare_api.services.vitals_service import VitalsService
from guardiancare_api.services.decision_service import DecisionService
from guardiancare_api.services.alert_service import AlertService
from guardiancare_api.api.routes import router, inject_services

log = get_logger(__name__)


# ── Lifespan: load models at startup, release at shutdown ─────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 55)
    log.info("  GuardianCare API — starting up")
    log.info("=" * 55)

    t0 = time.time()

    # Load models (order matters — YOLO first, it's the heaviest)
    fall_model   = FallDetectionModel()
    face_model   = FaceRecognitionModel()
    vitals_model = VitalsClassificationModel()

    # Build services
    detection_svc   = DetectionService(fall_model)
    recognition_svc = RecognitionService(face_model)
    vitals_svc      = VitalsService(vitals_model)
    decision_svc    = DecisionService()
    alert_svc       = AlertService()

    # Wire services into the router
    inject_services(
        detection_svc,
        recognition_svc,
        vitals_svc,
        decision_svc,
        alert_svc,
    )

    elapsed = time.time() - t0
    log.info(f"All models loaded in {elapsed:.1f}s — API is ready")
    log.info("Docs: http://127.0.0.1:8000/docs")

    yield  # ← application runs here

    log.info("GuardianCare API — shutting down")


# ── FastAPI app ────────────────────────────────────────────────────────────

app = FastAPI(
    title="GuardianCare API",
    description=(
        "Production-ready fall detection and health monitoring backend. "
        "Combines YOLO fall detection, DeepFace recognition, and a trained "
        "vitals risk classifier into a single decision pipeline."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Request logging middleware ─────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed  = (time.time() - start) * 1000
    log.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({elapsed:.1f}ms)"
    )
    return response


# ── Global exception handler ───────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# ── Include routes ─────────────────────────────────────────────────────────

app.include_router(router)


# ── Dev entry point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("guardiancare_api.main:app", host="0.0.0.0", port=8000, reload=True)
