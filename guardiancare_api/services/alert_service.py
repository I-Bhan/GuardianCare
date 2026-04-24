"""
services/alert_service.py
Telegram alert dispatcher — reuses alert.py's send_telegram_alert()
and enriches the message with the full decision context.
"""

import sys
import time
import os
import numpy as np
from pathlib import Path

# Ensure the root project directory is on sys.path so we can import alert.py
_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from alert import send_telegram_alert  # existing alert.py — untouched

from guardiancare_api.config import BOT_TOKEN, CHAT_ID, ALERTS_DIR
from guardiancare_api.utils.logger import get_logger

log = get_logger(__name__)

PRIORITY_EMOJI = {
    "HIGH":   "🚨🚨",
    "MEDIUM": "🚨",
    "ALERT":  "⚠️",
    "NONE":   "ℹ️",
}


class AlertService:
    def __init__(self):
        self._bot_token = BOT_TOKEN
        self._chat_id   = CHAT_ID

    def send(self, decision: dict, frame: np.ndarray) -> str | None:
        """
        Send a Telegram alert if credentials are available.
        Returns the saved image path or None.
        """
        if not self._bot_token or not self._chat_id:
            log.warning("Telegram credentials missing — alert not sent")
            return None

        emoji = PRIORITY_EMOJI.get(decision.get("priority_level", "NONE"), "📢")

        message = (
            f"{emoji} GuardianCare Alert\n"
            f"─────────────────────\n"
            f"Person     : {decision.get('person_name', 'Unknown')}\n"
            f"Priority   : {decision.get('priority_level')}\n"
            f"Risk Level : {decision.get('risk_level')}\n"
            f"Explanation: {decision.get('explanation')}\n"
            f"Confidence : {decision.get('confidence', 0):.0%}\n"
            f"Time       : {decision.get('timestamp')}"
        )

        try:
            img_path = send_telegram_alert(
                frame,
                self._bot_token,
                self._chat_id,
                text=message,
                save_dir=str(ALERTS_DIR),
            )
            log.info(f"Alert sent — snapshot: {img_path}")
            return img_path
        except Exception as exc:
            log.error(f"AlertService error: {exc}")
            return None
