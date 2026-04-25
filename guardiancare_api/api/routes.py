"""
api/routes.py
FastAPI router — all endpoints defined here.

Endpoints:
    POST /process_frame        → fall detection + face recognition
    POST /analyze_vitals       → vitals risk classification
    POST /process_event        → full pipeline + alert if needed
    GET  /incidents            → all incidents from DB
    GET  /incidents/{name}     → incidents for a specific person
    GET  /stats                → fall counts per person
    GET  /health               → system status
"""

import sys
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional

# Ensure root is on path so Db.py is importable
_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import Db  # existing Db.py — untouched

from guardiancare_api.utils.video_utils import decode_base64_frame, bytes_to_frame
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()

# ── Service instances injected from main.py ────────────────────────────────
# They are set in main.py after models are loaded at startup.
_detection_svc   = None
_recognition_svc = None
_vitals_svc      = None
_decision_svc    = None
_alert_svc       = None
_models_loaded   = False


def inject_services(detection, recognition, vitals, decision, alert):
    """Called from main.py after all models are loaded."""
    global _detection_svc, _recognition_svc, _vitals_svc
    global _decision_svc, _alert_svc, _models_loaded

    _detection_svc   = detection
    _recognition_svc = recognition
    _vitals_svc      = vitals
    _decision_svc    = decision
    _alert_svc       = alert
    _models_loaded   = True


# ── Pydantic schemas ───────────────────────────────────────────────────────

class VitalsInput(BaseModel):
    heart_rate:        float = Field(..., gt=0,  description="Beats per minute")
    body_temperature:  float = Field(..., gt=0,  description="Celsius")
    oxygen_saturation: float = Field(..., gt=0,  description="SpO2 percentage")
    systolic_bp:       float = Field(..., gt=0,  description="Systolic blood pressure mmHg")
    diastolic_bp:      float = Field(..., gt=0,  description="Diastolic blood pressure mmHg")
    device_id:         Optional[str] = Field(None, description="Smartwatch device ID")


class ProcessFrameRequest(BaseModel):
    frame_b64: str = Field(..., description="Base64-encoded JPEG or PNG image")


class ProcessEventRequest(BaseModel):
    frame_b64:         str
    heart_rate:        float
    body_temperature:  float
    oxygen_saturation: float
    systolic_bp:       float
    diastolic_bp:      float


# ── Helper ─────────────────────────────────────────────────────────────────

def _require_services():
    if not _models_loaded:
        raise HTTPException(503, "Models are still loading. Try again in a moment.")


# ══════════════════════════════════════════════════════════════════════════════
#  GET /health
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/health", summary="System health check")
async def health():
    return {
        "status":        "ok",
        "models_loaded": _models_loaded,
        "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  POST /process_frame
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/process_frame", summary="Fall detection + face recognition on a single frame")
async def process_frame(req: ProcessFrameRequest):
    _require_services()
    try:
        frame = decode_base64_frame(req.frame_b64)
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    fall_result  = _detection_svc.analyze(frame)
    person_name  = _recognition_svc.identify(frame) if fall_result["fall_detected"] else "Unknown"

    return {
        "fall_detected": fall_result["fall_detected"],
        "confidence":    fall_result["confidence"],
        "person_name":   person_name,
        "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# Multipart variant — accepts uploaded image file
@router.post("/process_frame/upload", summary="Fall detection via multipart file upload")
async def process_frame_upload(file: UploadFile = File(...)):
    _require_services()
    try:
        raw   = await file.read()
        frame = bytes_to_frame(raw)
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    fall_result = _detection_svc.analyze(frame)
    person_name = _recognition_svc.identify(frame) if fall_result["fall_detected"] else "Unknown"

    return {
        "fall_detected": fall_result["fall_detected"],
        "confidence":    fall_result["confidence"],
        "person_name":   person_name,
        "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  POST /analyze_vitals
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze_vitals", summary="Vitals risk classification")
async def analyze_vitals(req: VitalsInput):
    _require_services()

    vitals_dict = {
        "heart_rate":        req.heart_rate,
        "body_temperature":  req.body_temperature,
        "oxygen_saturation": req.oxygen_saturation,
        "systolic_bp":       req.systolic_bp,
        "diastolic_bp":      req.diastolic_bp,
    }

    result = _vitals_svc.analyze(vitals_dict)

    if not result["valid"]:
        raise HTTPException(422, detail=result["errors"])

    # Persist reading if a device_id was provided
    if req.device_id:
        patient = Db.get_patient_by_device(req.device_id)
        patient_id   = patient["id"]   if patient else None
        patient_name = patient["name"] if patient else "Unknown"
        Db.log_vitals_reading(
            device_id=req.device_id,
            patient_id=patient_id,
            patient_name=patient_name,
            vitals=vitals_dict,
            risk_level=result["risk_level"],
            confidence=result["confidence"],
        )

    return {
        "risk_level":  result["risk_level"],
        "explanation": result["explanation"],
        "confidence":  result["confidence"],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  POST /process_event  — full pipeline
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/process_event", summary="Full pipeline: fall + face + vitals + decision + alert")
async def process_event(req: ProcessEventRequest):
    _require_services()

    # Decode frame
    try:
        frame = decode_base64_frame(req.frame_b64)
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    vitals_dict = {
        "heart_rate":        req.heart_rate,
        "body_temperature":  req.body_temperature,
        "oxygen_saturation": req.oxygen_saturation,
        "systolic_bp":       req.systolic_bp,
        "diastolic_bp":      req.diastolic_bp,
    }

    # Run all services
    fall_result    = _detection_svc.analyze(frame)
    person_name    = _recognition_svc.identify(frame)
    vitals_result  = _vitals_svc.analyze(vitals_dict)
    decision       = _decision_svc.decide(fall_result, person_name, vitals_result)

    # Persist to DB and send alert if needed
    img_path = None
    if decision["send_alert"]:
        img_path = _alert_svc.send(decision, frame)

        # Log fall incident to DB
        if fall_result["fall_detected"]:
            Db.log_incident(
                person_name=person_name,
                image_path=img_path,
                alert_sent=img_path is not None,
            )

    # Return clean decision (strip internal flag)
    output = {k: v for k, v in decision.items() if k != "send_alert"}
    output["alert_sent"]  = img_path is not None
    output["snapshot"]    = img_path
    return output


# ══════════════════════════════════════════════════════════════════════════════
#  GET /vitals
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vitals", summary="All recorded vitals readings")
async def get_vitals():
    try:
        return Db.get_all_vitals()
    except Exception as exc:
        log.error(f"/vitals error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/vitals/{patient_id}", summary="Vitals readings for a specific patient")
async def get_vitals_by_patient(patient_id: str):
    try:
        rows = Db.get_vitals_by_patient(patient_id)
        if not rows:
            raise HTTPException(404, f"No vitals found for patient '{patient_id}'")
        return rows
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"/vitals/{{patient_id}} error: {exc}")
        raise HTTPException(500, "Database error")


# ══════════════════════════════════════════════════════════════════════════════
#  GET /incidents
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/incidents", summary="All recorded fall incidents")
async def get_incidents():
    try:
        return Db.get_all_incidents()
    except Exception as exc:
        log.error(f"/incidents error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/incidents/{person_name}", summary="Incidents for a specific person")
async def get_incidents_by_person(person_name: str):
    try:
        rows = Db.get_incidents_by_person(person_name)
        if not rows:
            raise HTTPException(404, f"No incidents found for '{person_name}'")
        return rows
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"/incidents/{{name}} error: {exc}")
        raise HTTPException(500, "Database error")


# ══════════════════════════════════════════════════════════════════════════════
#  GET /stats
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", summary="Fall counts per person")
async def get_stats():
    try:
        return Db.get_fall_counts()
    except Exception as exc:
        log.error(f"/stats error: {exc}")
        raise HTTPException(500, "Database error")
