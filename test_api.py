"""
test_api.py
Automated tests for the GuardianCare API.

Run AFTER starting the server:
    uvicorn guardiancare_api.main:app --reload
    python test_api.py
"""

import base64
import json
import sys
import time
import cv2
import numpy as np
import requests

BASE_URL = "http://127.0.0.1:8000"

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"


def _status(label: str, passed: bool | None, detail: str = ""):
    icon  = {"True": "✓", "False": "✗", "None": "—"}[str(passed)]
    color = {"True": "\033[92m", "False": "\033[91m", "None": "\033[93m"}[str(passed)]
    reset = "\033[0m"
    result = PASS if passed else (SKIP if passed is None else FAIL)
    line   = f"  {color}{icon} [{result}]{reset}  {label}"
    if detail:
        line += f"\n         → {detail}"
    print(line)
    return passed is not False


def _make_blank_frame_b64(w: int = 320, h: int = 240) -> str:
    """Generate a small black JPEG frame encoded as base64."""
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", frame)
    return base64.b64encode(buf.tobytes()).decode()


# ══════════════════════════════════════════════════════════════════════════════
#  Test suites
# ══════════════════════════════════════════════════════════════════════════════

def test_health():
    print("\n── GET /health ──────────────────────────────────────────")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        ok = r.status_code == 200
        data = r.json()
        _status("HTTP 200",            ok,   f"status={r.status_code}")
        _status("status == 'ok'",      data.get("status") == "ok",    str(data))
        _status("models_loaded field", "models_loaded" in data,        str(data))
        print(f"         Response: {json.dumps(data, indent=2)}")
        return ok
    except Exception as exc:
        _status("Server reachable", False, str(exc))
        return False


def test_analyze_vitals():
    print("\n── POST /analyze_vitals ─────────────────────────────────")
    cases = [
        {
            "name": "Typical healthy",
            "payload": {
                "heart_rate": 72, "body_temperature": 36.6,
                "oxygen_saturation": 98, "systolic_bp": 118, "diastolic_bp": 76,
            },
        },
        {
            "name": "High-risk vitals",
            "payload": {
                "heart_rate": 130, "body_temperature": 39.2,
                "oxygen_saturation": 88, "systolic_bp": 175, "diastolic_bp": 105,
            },
        },
        {
            "name": "Invalid vitals (missing field)",
            "payload": {
                "heart_rate": 72, "body_temperature": 36.6,
                # oxygen_saturation missing
                "systolic_bp": 118, "diastolic_bp": 76,
            },
            "expect_error": True,
        },
    ]

    all_ok = True
    for case in cases:
        try:
            r = requests.post(
                f"{BASE_URL}/analyze_vitals",
                json=case["payload"],
                timeout=10,
            )
            if case.get("expect_error"):
                ok = r.status_code in (422, 400)
                _status(f"[{case['name']}] returns error", ok, f"status={r.status_code}")
            else:
                ok   = r.status_code == 200
                data = r.json()
                _status(f"[{case['name']}] HTTP 200", ok, str(data))
                if ok:
                    _status(
                        f"[{case['name']}] has risk_level",
                        "risk_level" in data,
                        data.get("risk_level", "—"),
                    )
                    _status(
                        f"[{case['name']}] has confidence",
                        "confidence" in data,
                        str(data.get("confidence")),
                    )
            all_ok &= ok
        except Exception as exc:
            _status(f"[{case['name']}] request failed", False, str(exc))
            all_ok = False
    return all_ok


def test_process_frame():
    print("\n── POST /process_frame ──────────────────────────────────")
    payload = {"frame_b64": _make_blank_frame_b64()}
    try:
        r = requests.post(f"{BASE_URL}/process_frame", json=payload, timeout=30)
        ok   = r.status_code == 200
        data = r.json() if ok else {}
        _status("HTTP 200",             ok,   f"status={r.status_code}")
        _status("fall_detected field",  "fall_detected" in data, str(data))
        _status("person_name field",    "person_name"   in data, str(data.get("person_name")))
        print(f"         Response: {json.dumps(data, indent=2)}")
        return ok
    except Exception as exc:
        _status("Request succeeded", False, str(exc))
        return False


def test_process_event():
    print("\n── POST /process_event ──────────────────────────────────")
    payload = {
        "frame_b64":         _make_blank_frame_b64(),
        "heart_rate":        72,
        "body_temperature":  36.6,
        "oxygen_saturation": 98,
        "systolic_bp":       118,
        "diastolic_bp":      76,
    }
    try:
        r = requests.post(f"{BASE_URL}/process_event", json=payload, timeout=30)
        ok   = r.status_code == 200
        data = r.json() if ok else {}
        _status("HTTP 200",              ok,   f"status={r.status_code}")
        _status("priority_level field",  "priority_level" in data, str(data.get("priority_level")))
        _status("explanation field",     "explanation"    in data, str(data.get("explanation")))
        _status("confidence field",      "confidence"     in data, str(data.get("confidence")))
        _status("timestamp field",       "timestamp"      in data, str(data.get("timestamp")))
        print(f"         Response: {json.dumps(data, indent=2)}")
        return ok
    except Exception as exc:
        _status("Request succeeded", False, str(exc))
        return False


def test_incidents():
    print("\n── GET /incidents ───────────────────────────────────────")
    try:
        r    = requests.get(f"{BASE_URL}/incidents", timeout=5)
        ok   = r.status_code == 200
        data = r.json()
        _status("HTTP 200",          ok,             f"status={r.status_code}")
        _status("Returns a list",    isinstance(data, list), f"{len(data)} records")
        if data:
            first = data[0]
            _status("Has 'person_name'", "person_name" in first, str(first))
        return ok
    except Exception as exc:
        _status("Request succeeded", False, str(exc))
        return False


def test_stats():
    print("\n── GET /stats ───────────────────────────────────────────")
    try:
        r    = requests.get(f"{BASE_URL}/stats", timeout=5)
        ok   = r.status_code == 200
        data = r.json()
        _status("HTTP 200",       ok,            f"status={r.status_code}")
        _status("Returns a list", isinstance(data, list), str(data))
        return ok
    except Exception as exc:
        _status("Request succeeded", False, str(exc))
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  Runner
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 55)
    print("  GuardianCare API — Test Suite")
    print(f"  Target: {BASE_URL}")
    print("=" * 55)

    # Check server is running
    if not test_health():
        print(
            "\n  Server not reachable. Start it first:\n"
            "  uvicorn guardiancare_api.main:app --reload\n"
        )
        sys.exit(1)

    results = [
        test_analyze_vitals(),
        test_process_frame(),
        test_process_event(),
        test_incidents(),
        test_stats(),
    ]

    passed = sum(1 for r in results if r)
    total  = len(results)

    print("\n" + "=" * 55)
    print(f"  Results: {passed}/{total} test suites passed")
    print("=" * 55 + "\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
