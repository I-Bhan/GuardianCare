"""
api/routes.py
FastAPI router — all endpoints defined here.

Endpoints:
    POST /auth/login             → get JWT token
    GET  /auth/me                → current user info

    POST /process_frame          → fall detection + face recognition
    POST /process_frame/upload   → multipart variant
    POST /analyze_vitals         → vitals risk classification
    POST /process_event          → full pipeline + alert if needed

    GET  /incidents              → all incidents (doctor only)
    GET  /incidents/{patient_id} → incidents for a specific patient (doctor or own)
    GET  /vitals                 → all vitals (doctor only)
    GET  /vitals/{patient_id}    → vitals for a specific patient (doctor or own)
    GET  /stats                  → fall counts (doctor sees all, family sees own)
    GET  /health                 → system status (public)
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Optional, Literal

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import Db
from guardiancare_api.utils.video_utils import decode_base64_frame, bytes_to_frame
from guardiancare_api.utils.logger import get_logger
from guardiancare_api.auth import (
    verify_password, create_access_token,
    get_current_user, require_doctor,
)

log = get_logger(__name__)
router = APIRouter()

# ── Service instances injected from main.py ────────────────────────────────
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


# ── Pydantic schemas ───────────────────────────────────────────────────────

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


class CreateUserRequest(BaseModel):
    email:      str
    password:   str = Field(..., min_length=6)
    role:       Literal["doctor", "family"]
    patient_id: Optional[str] = None


class RegisterRequest(BaseModel):
    token:    str
    email:    str
    password: str = Field(..., min_length=6)


# ── Helper ─────────────────────────────────────────────────────────────────

def _require_services():
    if not _models_loaded:
        raise HTTPException(503, "Models are still loading. Try again in a moment.")


# ══════════════════════════════════════════════════════════════════════════════
#  Auth
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/auth/login", summary="Login and get JWT token")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = Db.get_user_by_email(form.username)
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/users", summary="Create a new user — doctor only", status_code=201)
async def create_user(req: CreateUserRequest,
                      doctor: dict = Depends(require_doctor)):
    # family يجب أن يكون عنده patient_id
    if req.role == "family" and not req.patient_id:
        raise HTTPException(422, "patient_id required for family role")

    # تحقق أن المريض موجود
    if req.patient_id and not Db.get_patient_by_id(req.patient_id):
        raise HTTPException(404, f"Patient '{req.patient_id}' not found")

    if Db.email_exists(req.email):
        raise HTTPException(409, "Email already registered")

    from guardiancare_api.auth import pwd_context
    new_id = str(uuid.uuid4())[:8]
    Db.create_user(
        user_id=new_id,
        email=req.email,
        password_hash=pwd_context.hash(req.password),
        role=req.role,
        patient_id=req.patient_id,
    )
    return {"id": new_id, "email": req.email, "role": req.role,
            "patient_id": req.patient_id}


@router.post("/invite", summary="Generate invite link — doctor only", status_code=201)
async def create_invite(patient_id: str,
                        doctor: dict = Depends(require_doctor)):
    if not Db.get_patient_by_id(patient_id):
        raise HTTPException(404, f"Patient '{patient_id}' not found")

    token      = str(uuid.uuid4())
    expires_at = (datetime.now() + timedelta(hours=48)).strftime("%Y-%m-%d %H:%M:%S")
    Db.create_invite(token, patient_id, expires_at)

    return {
        "token":      token,
        "patient_id": patient_id,
        "expires_at": expires_at,
        "register_url": f"/register?token={token}",
    }


@router.post("/register", summary="Register using an invite token", status_code=201)
async def register(req: RegisterRequest):
    invite = Db.get_invite(req.token)

    if not invite:
        raise HTTPException(400, "Invalid invite token")
    if invite["used"]:
        raise HTTPException(400, "Invite already used")
    if datetime.now() > datetime.strptime(invite["expires_at"], "%Y-%m-%d %H:%M:%S"):
        raise HTTPException(400, "Invite expired")
    if Db.email_exists(req.email):
        raise HTTPException(409, "Email already registered")

    from guardiancare_api.auth import pwd_context
    new_id = str(uuid.uuid4())[:8]
    Db.create_user(
        user_id=new_id,
        email=req.email,
        password_hash=pwd_context.hash(req.password),
        role="family",
        patient_id=invite["patient_id"],
    )
    Db.mark_invite_used(req.token)

    return {"id": new_id, "email": req.email,
            "role": "family", "patient_id": invite["patient_id"]}


@router.get("/auth/me", summary="Current user info")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id":         user["id"],
        "email":      user["email"],
        "role":       user["role"],
        "patient_id": user.get("patient_id"),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  Health (public)
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

@router.post("/process_frame", summary="Fall detection + face recognition")
async def process_frame(req: ProcessFrameRequest,
                        user: dict = Depends(get_current_user)):
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


@router.post("/process_frame/upload", summary="Fall detection via multipart upload")
async def process_frame_upload(file: UploadFile = File(...),
                               user: dict = Depends(get_current_user)):
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
async def analyze_vitals(req: VitalsInput,
                         user: dict = Depends(get_current_user)):
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

    return {
        "risk_level":  result["risk_level"],
        "explanation": result["explanation"],
        "confidence":  result["confidence"],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  POST /process_event
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/process_event", summary="Full pipeline: fall + face + vitals + alert")
async def process_event(req: ProcessEventRequest,
                        user: dict = Depends(get_current_user)):
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


# ══════════════════════════════════════════════════════════════════════════════
#  GET /vitals  (role-based)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vitals", summary="All vitals readings — doctor only")
async def get_vitals(user: dict = Depends(require_doctor)):
    try:
        return Db.get_all_vitals()
    except Exception as exc:
        log.error(f"/vitals error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/vitals/{patient_id}", summary="Vitals for a specific patient")
async def get_vitals_by_patient(patient_id: str,
                                user: dict = Depends(get_current_user)):
    if user["role"] != "doctor" and user.get("patient_id") != patient_id:
        raise HTTPException(403, "Access denied")
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
#  GET /incidents  (role-based)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/incidents", summary="All incidents — doctor only")
async def get_incidents(user: dict = Depends(require_doctor)):
    try:
        return Db.get_all_incidents()
    except Exception as exc:
        log.error(f"/incidents error: {exc}")
        raise HTTPException(500, "Database error")


@router.get("/incidents/{patient_id}", summary="Incidents for a specific patient")
async def get_incidents_by_patient(patient_id: str,
                                   user: dict = Depends(get_current_user)):
    if user["role"] != "doctor" and user.get("patient_id") != patient_id:
        raise HTTPException(403, "Access denied")
    try:
        rows = Db.get_incidents_by_patient(patient_id)
        if not rows:
            raise HTTPException(404, f"No incidents found for patient '{patient_id}'")
        return rows
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"/incidents/{{patient_id}} error: {exc}")
        raise HTTPException(500, "Database error")


# ══════════════════════════════════════════════════════════════════════════════
#  GET /stats  (role-based)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", summary="Fall counts — doctor sees all, family sees own")
async def get_stats(user: dict = Depends(get_current_user)):
    try:
        return Db.get_fall_counts(role=user["role"],
                                  patient_id=user.get("patient_id"))
    except Exception as exc:
        log.error(f"/stats error: {exc}")
        raise HTTPException(500, "Database error")
