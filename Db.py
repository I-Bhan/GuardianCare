import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = str(Path(__file__).resolve().parent / "guardiancare.db")

# ── Default patients and devices ──────────────────────────────────────────────
DEFAULT_PATIENTS = [
    ("p001", "Abdulrahaman", "Room 101"),
    ("p002", "Aziz",         "Room 102"),
]

DEFAULT_DEVICES = [
    ("watch_001", "p001", "smartwatch"),
    ("watch_002", "p002", "smartwatch"),
]


# ── Init ──────────────────────────────────────────────────────────────────────
def init_db():
    """Create all tables and seed default data."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Incidents
    c.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            person_name TEXT    NOT NULL DEFAULT 'Unknown',
            patient_id  TEXT,
            timestamp   TEXT    NOT NULL,
            image_path  TEXT,
            alert_sent  INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Patients
    c.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id    TEXT PRIMARY KEY,
            name  TEXT NOT NULL,
            room  TEXT
        )
    """)

    # Devices
    c.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            device_id   TEXT PRIMARY KEY,
            patient_id  TEXT NOT NULL,
            device_type TEXT DEFAULT 'smartwatch'
        )
    """)

    # Users
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            email      TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'family',
            patient_id TEXT
        )
    """)

    # Seed default patients
    for pid, name, room in DEFAULT_PATIENTS:
        c.execute("""
            INSERT OR IGNORE INTO patients (id, name, room)
            VALUES (?, ?, ?)
        """, (pid, name, room))

    # Seed default devices
    for did, pid, dtype in DEFAULT_DEVICES:
        c.execute("""
            INSERT OR IGNORE INTO devices (device_id, patient_id, device_type)
            VALUES (?, ?, ?)
        """, (did, pid, dtype))

    conn.commit()
    conn.close()


# ── Incidents ─────────────────────────────────────────────────────────────────
def log_incident(person_name: str, patient_id: str = None,
                 image_path: str = None, alert_sent: bool = False):
    """Insert a new fall incident."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO incidents (person_name, patient_id, timestamp, image_path, alert_sent)
        VALUES (?, ?, ?, ?, ?)
    """, (
        person_name,
        patient_id,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        image_path,
        int(alert_sent),
    ))
    conn.commit()
    conn.close()


def get_all_incidents() -> list[dict]:
    """Return all incidents — doctors only."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM incidents ORDER BY timestamp DESC")
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


def get_incidents_by_patient(patient_id: str) -> list[dict]:
    """Return incidents for a specific patient — family access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT * FROM incidents WHERE patient_id = ? ORDER BY timestamp DESC",
        (patient_id,)
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


def get_incidents_by_person(name: str) -> list[dict]:
    """Return incidents by person name."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT * FROM incidents WHERE person_name = ? ORDER BY timestamp DESC",
        (name,)
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


def get_fall_counts(role: str = "doctor", patient_id: str = None) -> list[dict]:
    """Return fall counts — doctor sees all, family sees their patient only."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    if role == "doctor":
        c.execute("""
            SELECT person_name, patient_id,
                   COUNT(*) AS total_falls, MAX(timestamp) AS last_fall
            FROM incidents
            GROUP BY person_name
            ORDER BY total_falls DESC
        """)
    else:
        c.execute("""
            SELECT person_name, patient_id,
                   COUNT(*) AS total_falls, MAX(timestamp) AS last_fall
            FROM incidents
            WHERE patient_id = ?
            GROUP BY person_name
            ORDER BY total_falls DESC
        """, (patient_id,))

    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


# ── Devices ───────────────────────────────────────────────────────────────────
def get_patient_by_device(device_id: str) -> dict | None:
    """Return patient info from device_id."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT p.id, p.name, p.room
        FROM devices d
        JOIN patients p ON d.patient_id = p.id
        WHERE d.device_id = ?
    """, (device_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_devices() -> list[dict]:
    """Return all devices with patient info."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT d.device_id, d.device_type, p.id AS patient_id, p.name, p.room
        FROM devices d
        JOIN patients p ON d.patient_id = p.id
    """)
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


# ── Patients ──────────────────────────────────────────────────────────────────
def get_patient_by_id(patient_id: str) -> dict | None:
    """Return patient info by ID."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


# ── Init on import ────────────────────────────────────────────────────────────
init_db()


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=== Devices ===")
    for d in get_all_devices():
        print(d)

    print("\n=== Patient by device ===")
    print(get_patient_by_device("watch_001"))
    print(get_patient_by_device("watch_002"))

    print("\n=== Fall counts (Doctor) ===")
    for row in get_fall_counts(role="doctor"):
        print(row)

    print("\n=== Fall counts (Family p001) ===")
    for row in get_fall_counts(role="family", patient_id="p001"):
        print(row)