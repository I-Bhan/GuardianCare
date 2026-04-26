from ultralytics import YOLO
import cv2
import os
import time
from dotenv import load_dotenv
from deepface import DeepFace
from alert import send_telegram_alert
from Db import log_incident
from guardiancare_api.config import FALL_CLASS_NAME

load_dotenv()

os.environ["KMP_DUPLICATE_LIB_OK"] = "True"

# ─── Constants ────────────────────────────────────────────────────────────────
MODEL_PATH       = "fall_det_1.pt"
VIDEO_SOURCE     = "videos/fall.mp4"
CONF             = 0.75
CONFIRM_SECONDS  = 8
COOLDOWN_SECONDS = 20
KNOWN_FACES_DIR  = "known_faces"

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHAT_ID   = os.getenv("CHAT_ID")

# ─── State ────────────────────────────────────────────────────────────────────
fall_start_time = None
last_alert_time = 0.0
person_name     = "Unknown"


# ─── Helpers ──────────────────────────────────────────────────────────────────
PATIENT_MAP = {
    "Abdulrahaman": "p001",
    "Aziz":         "p002",
}
def has_fall_detection(result, model_names: dict, target_name: str) -> bool:
    if result.boxes is None or len(result.boxes) == 0:
        return False
    for cls in result.boxes.cls.tolist():
        if model_names.get(int(cls), "") == target_name:
            return True
    return False


def identify_person(frame) -> str:
    """Match face in frame against known_faces/. Returns name or 'Unknown'."""
    if not os.path.isdir(KNOWN_FACES_DIR) or not os.listdir(KNOWN_FACES_DIR):
        return "Unknown"
    try:
        results = DeepFace.find(
            img_path=frame,
            db_path=KNOWN_FACES_DIR,
            enforce_detection=False,
            silent=True,
            threshold=0.25,        # ← صارم38
        )
        if results and not results[0].empty:
            best = results[0].iloc[0]

            # تحقق من الـ distance
            distance_col = [c for c in best.index if "distance" in c.lower()]
            if distance_col and float(best[distance_col[0]]) > 0.25:
                return "Unknown"

            best_match = best["identity"]
            raw  = os.path.splitext(os.path.basename(best_match))[0]
            name = raw.rsplit("_", 1)[0]
            return name

    except Exception as e:
        print(f"[FaceID] Error: {e}")
    return "Unknown"


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    global fall_start_time, last_alert_time, person_name

    model = YOLO(MODEL_PATH)
    print("Model classes:", model.names)

    cap = cv2.VideoCapture(0 if VIDEO_SOURCE == 0 else VIDEO_SOURCE)
    if not cap.isOpened():
        raise RuntimeError("Could not open video source")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("End of stream — exiting.")
                break

            now     = time.time()
            results = model.track(frame, persist=True, conf=CONF, verbose=False)
            r       = results[0]

            fall_present = has_fall_detection(r, model.names, FALL_CLASS_NAME)
            in_cooldown  = (now - last_alert_time) < COOLDOWN_SECONDS

            # ── Status logic ──────────────────────────────────────────────────
            if fall_present and not in_cooldown:
                if fall_start_time is None:
                    fall_start_time = now
                    status = "FALL DETECTED"
                else:
                    elapsed = now - fall_start_time
                    left    = max(0.0, CONFIRM_SECONDS - elapsed)
                    status  = f"CONFIRMING... {left:.1f}s"

                    if elapsed >= CONFIRM_SECONDS:

                        # 1) تعرف على الشخص
                        person_name = identify_person(frame)
                        print(f"[FaceID] Identified: {person_name}")

                        # 2) أرسل تنبيه تيليجرام
                        img_path = None
                        try:
                            img_path = send_telegram_alert(
                                frame, BOT_TOKEN, CHAT_ID,
                                text=f"🚨 FALL CONFIRMED!\nالشخص: {person_name}",
                                save_dir="alerts",
                            )
                            print("Alert sent:", img_path)
                        except Exception as e:
                            print(f"[WARNING] Alert failed: {e}")

                        # 3) سجّل في DB
                        log_incident(
                            person_name=person_name,
                            patient_id=PATIENT_MAP.get(person_name),
                            image_path=img_path,
                            alert_sent=img_path is not None,
                        )
                        print(f"[DB] Logged: {person_name}")

                        print("\a", flush=True)
                        last_alert_time = now
                        fall_start_time = None
                        status = f"ALERT SENT — {person_name}"

            else:
                fall_start_time = None
                if not fall_present:
                    person_name = "Unknown"
                if in_cooldown and fall_present:
                    remaining = COOLDOWN_SECONDS - (now - last_alert_time)
                    status = f"COOLDOWN {remaining:.0f}s"
                else:
                    status = "NORMAL"

            # ── Draw ─────────────────────────────────────────────────────────
            annotated = r.plot()

            if fall_present:
                overlay = annotated.copy()
                cv2.rectangle(overlay, (0, 0), (annotated.shape[1], 80), (0, 0, 255), -1)
                annotated = cv2.addWeighted(overlay, 0.25, annotated, 0.75, 0)

            label = f"{status}  |  {person_name}" if person_name != "Unknown" else status
            cv2.putText(annotated, label, (20, 55),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

            cv2.imshow("GuardianCare - Fall Detection", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Resources released.")


if __name__ == "__main__":
    print("GuardianCare started — press q to exit")
    main()