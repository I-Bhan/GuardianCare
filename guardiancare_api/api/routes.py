import sys
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import Db
from guardiancare_api.utils.video_utils import decode_base64_frame, bytes_to_frame
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()

_detection_svc   = None
_recognition_svc = None
_vitals_svc      = None
_decision_svc    = None
_alert_svc       = None
_models_loaded   = False


def inject_services(detection, recognition, vitals, decision, alert):
    global _detection_svc, _recognition_svc, _vitals_svc
    global _decision_svc, _alert_svc, _models_loaded
    _detection_svc   = detection
    _recognition_svc = recognition
    _vitals_svc      = vitals
    _decision_svc    = decision
    _alert_svc       = alert
    _models_loaded   = True


def _require_services():
    if not _models_loaded:
        raise HTTPException(503, "Models are still loading. Try again in a moment.")


# ── Pydantic models ────────────────────────────────────────────────────────────

class VitalsInput(BaseModel):
    heart_rate:        float = Field(..., gt=0)
    body_temperature:  float = Field(..., gt=0)
    oxygen_saturation: float = Field(..., gt=0)
    systolic_bp:       float = Field(..., gt=0)
    diastolic_bp:      float = Field(..., gt=0)
    device_id:         Optional[str] = None


class ProcessFrameRequest(BaseModel):
    frame_b64: str


class ProcessEventRequest(BaseModel):
    frame_b64:         str
    heart_rate:        float
    body_temperature:  float
    oxygen_saturation: float
    systolic_bp:       float
    diastolic_bp:      float


class AddPatientRequest(BaseModel):
    name: str = Field(..., min_length=1)
    room: Optional[str] = None


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "status":        "ok",
        "models_loaded": _models_loaded,
        "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ── Fall detection ─────────────────────────────────────────────────────────────

@router.post("/process_frame")
async def process_frame(req: ProcessFrameRequest):
    _require_services()
    try:
        frame = decode_base64_frame(req.frame_b64)
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


@router.post("/process_frame/upload")
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


# ── Vitals ─────────────────────────────────────────────────────────────────────

@router.post("/analyze_vitals")
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

    if req.device_id:
        patient      = Db.get_patient_by_device(req.device_id)
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
        # Treat High Risk vitals as an incident
        if result["risk_level"] == "High Risk":
            Db.log_incident(
                person_name=patient_name,
                patient_id=patient_id,
                alert_sent=False,
            )
            log.warning(f"High Risk vitals → incident logged for {patient_name}")

    return {
        "risk_level":  result["risk_level"],
        "explanation": result["explanation"],
        "confidence":  result["confidence"],
    }


# ── Full pipeline ──────────────────────────────────────────────────────────────

@router.post("/process_event")
async def process_event(req: ProcessEventRequest):
    _require_services()

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

    fall_result   = _detection_svc.analyze(frame)
    person_name   = _recognition_svc.identify(frame) if fall_result["fall_detected"] else "Unknown"
    vitals_result = _vitals_svc.analyze(vitals_dict)
    decision      = _decision_svc.decide(fall_result, person_name, vitals_result)

    img_path = None
    if decision["send_alert"]:
        img_path = _alert_svc.send(decision, frame)
        if fall_result["fall_detected"]:
            Db.log_incident(
                person_name=person_name,
                patient_id=Db.get_patient_id_by_name(person_name),
                image_path=img_path,
                alert_sent=img_path is not None,
            )

    output = {k: v for k, v in decision.items() if k != "send_alert"}
    output["alert_sent"] = img_path is not None
    output["snapshot"]   = img_path
    return output


# ── Data endpoints ─────────────────────────────────────────────────────────────

@router.get("/incidents")
async def get_incidents():
    try:
        rows = Db.get_all_incidents()
        return [
            {
                "id":         r["id"],
                "name":       r["person_name"],
                "timestamp":  r["timestamp"],
                "confidence": 0,
                "snapshot":   r.get("image_path"),
            }
            for r in rows
        ]
    except Exception as exc:
        log.error(f"/incidents error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/incidents/{patient_id}")
async def get_incidents_by_patient(patient_id: str):
    try:
        rows = Db.get_incidents_by_patient(patient_id)
        return [
            {
                "id":         r["id"],
                "name":       r["person_name"],
                "timestamp":  r["timestamp"],
                "confidence": 0,
                "snapshot":   r.get("image_path"),
            }
            for r in rows
        ]
    except Exception as exc:
        log.error(f"/incidents/{{patient_id}} error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/stats")
async def get_stats():
    try:
        rows = Db.get_fall_counts()
        return [
            {
                "name":  r["person_name"],
                "count": r["total_falls"],
            }
            for r in rows
        ]
    except Exception as exc:
        log.error(f"/stats error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/vitals")
async def get_vitals():
    try:
        return Db.get_all_vitals()
    except Exception as exc:
        log.error(f"/vitals error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/vitals/{patient_id}")
async def get_vitals_by_patient(patient_id: str):
    try:
        return Db.get_vitals_by_patient(patient_id)
    except Exception as exc:
        log.error(f"/vitals/{{patient_id}} error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/patients")
async def get_patients():
    return Db.get_all_patients()


@router.post("/patients", status_code=201)
async def add_patient(req: AddPatientRequest):
    import uuid
    patient_id = str(uuid.uuid4())[:8]
    device_id  = f"watch_{patient_id}"
    Db.add_patient(patient_id, req.name, req.room or "")
    Db.add_device(device_id, patient_id)
    return {"id": patient_id, "name": req.name, "room": req.room or "", "device_id": device_id}


@router.get("/devices")
async def get_devices():
    try:
        return Db.get_all_devices()
    except Exception as exc:
        log.error(f"/devices error: {exc}")
        raise HTTPException(500, "Database error")
