"""
utils/logger.py
Centralised logging configuration.
Call get_logger(__name__) in every module.
"""

import logging
import sys
from pathlib import Path

LOG_DIR  = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "guardiancare.log"

_configured = False


def _setup():
    global _configured
    if _configured:
        return

    LOG_DIR.mkdir(exist_ok=True)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # File handler — rotates are not needed for a dev/demo setup
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    _setup()
    return logging.getLogger(name)
