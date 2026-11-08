# GuardianCare

GuardianCare combines video fall detection with vital sign monitoring. The dashboard shows each patient's latest readings, trends, and incident history. SQLite stores patient records, readings, and incidents locally. Supabase handles sign-in, profiles, and caregiver assignments.

## Run locally on Windows

For a fresh checkout, complete [first-time setup](#first-time-setup) first. These commands assume you cloned the repository into `$env:USERPROFILE\Projects\GuardianCare`. Adjust the path if you use another location.

Open two PowerShell windows. In the first, start the API with the project's Python interpreter.

```powershell
cd "$env:USERPROFILE\Projects\GuardianCare"
.\.venv\Scripts\python.exe -m uvicorn guardiancare_api.main:app --host 127.0.0.1 --port 8001
```

Wait for `Application startup complete`. During Python development, add `--reload` to restart the API when source files change.

In the second window, start the frontend.

```powershell
cd "$env:USERPROFILE\Projects\GuardianCare\frontend"
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

| Page | Local link |
| --- | --- |
| Website and sign-in | [GuardianCare](http://127.0.0.1:5173/) |
| Patient monitoring | [Dashboard](http://127.0.0.1:5173/dashboard) |
| API status | [Health check](http://127.0.0.1:8001/health) |
| Endpoints and request formats | [API documentation](http://127.0.0.1:8001/docs) |

Keep both windows open while using the site. Press `Ctrl+C` in the corresponding window to stop a service. GuardianCare uses port `8001`, leaving `8000` available for another application.

## First-time setup

The local development environment uses Python 3.11 and Node.js 24. Run these commands from the repository root. The JavaScript dependencies and lockfile are in `frontend/`.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

| File | Variable | Purpose |
| --- | --- | --- |
| `.env` | `SUPABASE_URL` | Supabase project URL the API uses to verify sessions. |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The same project URL and its public anon key for the browser. |
| `frontend/.env` | `VITE_API_BASE_URL` | Local API address, normally `http://127.0.0.1:8001`. |
| `.env` | `SIMULATOR_API_KEY` | Private key you choose for the simulator and integration checks. |
| `.env` | `BOT_TOKEN`, `CHAT_ID` | Optional Telegram bot token and destination chat for alerts. |

For a new Supabase project, run the [initial SQL migration](frontend/supabase/migrations/001_initial.sql) once in the SQL Editor to create the tables and access policies. The API verifies sessions using the project's ES256 signing keys. Keep private keys in the backend environment file. Vite exposes `VITE_*` variables to the browser.

### Models and local data

| Path | Purpose |
| --- | --- |
| `models/fall_det_1.pt` | YOLO fall detection weights included in the repository. Set `MODEL_PATH` in `.env` to use a different model. |
| `models/vitals_model.pkl`, `models/vitals_scaler.pkl`, `models/vitals_labels.pkl` | The trained vital signs classifier, scaler, and labels. All three ship with the project. |
| `data/human_vital_signs_dataset_2024.csv` | Supply this CSV to train the classifier or run the smartwatch simulator. The dashboard uses the included models. |
| `known_faces/` | Optional reference photos for face recognition. Use filenames such as `Name_1.jpg`. |
| `data/guardiancare.db` | SQLite database created on first run. When moving an installation, copy its existing database to retain its history. |

Each installation keeps its database, reference photos, and alert snapshots locally.

## Project layout

| Path | Responsibility |
| --- | --- |
| `guardiancare_api/main.py`, `guardiancare_api/api/routes.py` | FastAPI startup, model loading, and HTTP endpoints. |
| `guardiancare_api/config.py`, `guardiancare_api/database.py` | Configuration, file paths, and SQLite access. |
| `guardiancare_api/models/`, `guardiancare_api/services/` | Model inference, alert decisions, and Telegram delivery. |
| `scripts/` | Video detection, classifier training, and smartwatch simulation. |
| `tests/test_api.py` | Integration checks against a running API. |
| [frontend/](frontend/README.md) | React website, monitoring dashboard, and administration panel. |
| `alerts/`, `logs/` | Alert snapshots and server logs. |

## Development commands

Run these commands from the repository root. The simulator writes readings to the target API's database and can generate incidents. Training writes the three classifier files to `models/`.

| Task | PowerShell command |
| --- | --- |
| Simulate smartwatch readings with the API running | `.\.venv\Scripts\python.exe -m scripts.vitals_simulator` |
| Train the classifier from the CSV | `.\.venv\Scripts\python.exe -m scripts.train_vitals` |
| Detect falls in `videos/fall.mp4` | `.\.venv\Scripts\python.exe -m scripts.video` (press `q` to quit) |
| Check the running API after setting the simulator key | `.\.venv\Scripts\python.exe -m tests.test_api` |
| Lint and build the frontend | `npm.cmd --prefix frontend run lint` followed by `npm.cmd --prefix frontend run build` |

## Troubleshooting

- **The site opens but data fails to load.** Open the [health check](http://127.0.0.1:8001/health). If it responds, confirm that `VITE_API_BASE_URL` uses the same port. Restart Vite after changing `frontend/.env`.
- **The API returns 401.** Sign in and check that both environment files point to the same Supabase project. For the simulator or integration checks, restart the API after changing `SIMULATOR_API_KEY`.
- **PowerShell cannot find a file or Python package.** Run `Get-Location`. The repository root contains `guardiancare_api/`, `frontend/`, and `requirements.txt`. Use the project's `.venv` interpreter shown in the startup command.
