"""
vitals_simulator.py
Simulates smartwatches sending real vitals from the dataset.

Run AFTER starting the API:
    uvicorn guardiancare_api.main:app --reload
    python vitals_simulator.py
"""

import random
import time
import requests
import threading
from datetime import datetime
import pandas as pd

BASE_URL    = "http://127.0.0.1:8000"
DATASET     = "human_vital_signs_dataset_2024.csv"
INTERVAL    = 5  # seconds between readings

# ── Devices list ──────────────────────────────────────────────────────────────
DEVICES = [
    {"device_id": "watch_001", "patient_id": "p001", "name": "Abdulrahaman"},
    {"device_id": "watch_002", "patient_id": "p002", "name": "Aziz"},
]


# ── Load dataset once ─────────────────────────────────────────────────────────
def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATASET)
    print(f"✅ Dataset loaded: {len(df):,} rows")
    return df


# ── Pick random vitals from dataset ──────────────────────────────────────────
def get_vitals_from_dataset(df: pd.DataFrame, device: dict) -> dict:
    row = df.sample(1).iloc[0]
    return {
        "heart_rate":        int(row["Heart Rate"]),
        "body_temperature":  round(float(row["Body Temperature"]), 1),
        "oxygen_saturation": round(float(row["Oxygen Saturation"]), 1),
        "systolic_bp":       int(row["Systolic Blood Pressure"]),
        "diastolic_bp":      int(row["Diastolic Blood Pressure"]),
    }


# ── Simulator thread ──────────────────────────────────────────────────────────
def simulate_device(device: dict, df: pd.DataFrame):
    print(f"[{device['name']}] Started — device: {device['device_id']}")

    while True:
        vitals = get_vitals_from_dataset(df, device)
        ts     = datetime.now().strftime("%H:%M:%S")

        try:
            resp = requests.post(
                f"{BASE_URL}/analyze_vitals",
                json={**vitals, "device_id": device["device_id"]},
                timeout=10,
            )

            if resp.status_code == 200:
                data       = resp.json()
                risk       = data.get("risk_level", "?")
                confidence = data.get("confidence", 0)
                icon       = "🔴" if "High" in risk else "🟢"

                print(
                    f"[{ts}] {device['name']:15s} | "
                    f"HR:{vitals['heart_rate']:3d}  "
                    f"Temp:{vitals['body_temperature']}  "
                    f"SpO2:{vitals['oxygen_saturation']}  "
                    f"BP:{vitals['systolic_bp']}/{vitals['diastolic_bp']}  "
                    f"→ {icon} {risk} ({confidence:.0%})"
                )
            else:
                print(f"[{ts}] {device['name']} → API error {resp.status_code}")

        except requests.exceptions.ConnectionError:
            print(f"[{ts}] {device['name']} → API not running! Start uvicorn first.")
            time.sleep(10)
            continue

        except Exception as e:
            print(f"[{ts}] {device['name']} → Error: {e}")

        time.sleep(INTERVAL)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  GuardianCare — Vitals Simulator")
    print(f"  Devices: {len(DEVICES)} | Interval: {INTERVAL}s")
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    # Load dataset once
    df = load_dataset()

    # Start a thread per device with random stagger
    threads = []
    for device in DEVICES:
        t = threading.Thread(
            target=simulate_device,
            args=(device, df),
            daemon=True,
        )
        t.start()
        threads.append(t)
        time.sleep(random.uniform(0.5, 2.0))  # random stagger

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n⛔ Simulator stopped.")


if __name__ == "__main__":
    main()
