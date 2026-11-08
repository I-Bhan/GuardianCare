import time
import cv2
import requests
import os


def send_telegram_alert(frame, bot_token: str, chat_id: str,
                        text: str = " FALL CONFIRMED!",
                        save_dir: str = "alerts") -> str:

    # ── FIX 1: التحقق من المتغيرات قبل الإرسال ───────────────────────────────
    if not bot_token:
        raise ValueError("BOT_TOKEN is missing — check your .env file")
    if not chat_id:
        raise ValueError("CHAT_ID is missing — check your .env file")

    # ── حفظ الصورة ────────────────────────────────────────────────────────────
    os.makedirs(save_dir, exist_ok=True)
    ts = time.strftime("%d-%m-%Y_%I-%M-%S_%p")
    img_path = os.path.join(save_dir, f"alert_{ts}.jpg")

    # FIX 2: التحقق إن الصورة اتحفظت فعلاً
    success = cv2.imwrite(img_path, frame)
    if not success:
        raise RuntimeError(f"Failed to save image to: {img_path}")

    base_url = f"https://api.telegram.org/bot{bot_token}"

    # ── إرسال النص ────────────────────────────────────────────────────────────
    try:
        resp = requests.post(
            f"{base_url}/sendMessage",
            data={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        # FIX 3: التحقق من رد تيليجرام
        result = resp.json()
        if not result.get("ok"):
            print(f"[Telegram] sendMessage failed: {result.get('description')}")
        else:
            print("[Telegram] Message sent ✅")

    except requests.exceptions.RequestException as e:
        print(f"[Telegram] sendMessage error: {e}")

    # ── إرسال الصورة ──────────────────────────────────────────────────────────
    try:
        with open(img_path, "rb") as photo:
            resp = requests.post(
                f"{base_url}/sendPhoto",
                data={"chat_id": chat_id, "caption": "📸 Emergency frame"},
                files={"photo": photo},
                timeout=20,
            )
        result = resp.json()
        if not result.get("ok"):
            print(f"[Telegram] sendPhoto failed: {result.get('description')}")
        else:
            print("[Telegram] Photo sent ✅")

    except requests.exceptions.RequestException as e:
        print(f"[Telegram] sendPhoto error: {e}")

    return img_path