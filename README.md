# GuardianCare — Fall Detection & Health Monitoring API

A production-ready AI backend that combines **YOLO fall detection**, **DeepFace face recognition**, and a **trained vitals risk classifier** into a single real-time decision pipeline.

---

## Features

- Real-time fall detection using a custom-trained YOLO model
- Face recognition to identify who fell (from a known-faces database)
- Vital signs risk classification (heart rate, SpO2, blood pressure, temperature)
- Telegram alerts with snapshots when a fall or high-risk vitals are detected
- SQLite incident logging with a REST API for querying history
- Two modes: standalone video loop (`video.py`) or FastAPI server

---

## Project Structure

```
Fall_Detection/
├── guardiancare_api/        # FastAPI application
│   ├── main.py              # Entry point
│   ├── config.py            # Central configuration
│   ├── api/routes.py        # All API endpoints
│   ├── models/              # AI model wrappers
│   ├── services/            # Business logic
│   └── utils/               # Logging, frame encoding
├── video.py                 # Standalone real-time mode
├── train_vitals.py          # Train the vitals classifier
├── vitals_simulator.py      # Simulate smartwatch data
├── test_api.py              # API test suite
├── Db.py                    # SQLite database layer
├── alert.py                 # Telegram alert sender
└── requirements.txt
```

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your Telegram BOT_TOKEN and CHAT_ID
```

### 3. Add known faces

Place photos in `known_faces/` following the naming convention:
```
known_faces/
├── PersonName_1.jpg
├── PersonName_2.jpg
└── PersonName_3.jpg
```

### 4. Train the vitals model

Download the dataset and place it as `human_vital_signs_dataset_2024.csv`, then:

```bash
python train_vitals.py
```

### 5. Add the YOLO model

Place your trained `fall_det_1.pt` in the project root.

---

## Running

### Option A — API server (for mobile apps / dashboards)

```bash
uvicorn guardiancare_api.main:app --reload
```

API docs available at: `http://127.0.0.1:8000/docs`

### Option B — Standalone video loop

```bash
python video.py
```

Press `q` to exit.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status |
| POST | `/process_frame` | Fall detection + face recognition |
| POST | `/analyze_vitals` | Vitals risk classification |
| POST | `/process_event` | Full pipeline (frame + vitals + alert) |
| GET | `/incidents` | All recorded fall incidents |
| GET | `/incidents/{name}` | Incidents for a specific person |
| GET | `/stats` | Fall counts per person |

---

## Testing

```bash
# Start the server first, then:
python test_api.py
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token | — |
| `CHAT_ID` | Telegram chat ID | — |
| `FALL_CONF` | YOLO confidence threshold | `0.75` |
| `DEEPFACE_THRESHOLD` | Face match distance threshold | `0.25` |
| `KNOWN_FACES_DIR` | Known faces directory | `known_faces` |
| `MODEL_PATH` | YOLO weights path | `fall_det_1.pt` |
| `DB_PATH` | SQLite database path | `guardiancare.db` |

---

## Requirements

- Python 3.10+
- See `requirements.txt` for all dependencies
