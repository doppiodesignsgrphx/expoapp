"""
NC EMS Expo desktop app.

Opens the Expo web app in its own window and adds direct badge printing to a
Brother QL-820NWB. Every screen is the web app itself, so features added there
appear here without changing this program.

Run from source:   python3 app.py
Other app address: EXPOAPP_URL=https://example.org python3 app.py
"""
import ipaddress
import json
import os
import threading
from pathlib import Path

import webview

from printing import ROLL_NAMES, ROLLS, PrintError, image_from_data_url, print_image, test_image

VERSION = "0.1.0"
APP_URL = os.environ.get("EXPOAPP_URL", "https://savvy-coral-mongoose-81.hostingersite.com")
SETTINGS_FILE = Path.home() / ".expoapp" / "settings.json"
DEFAULTS = {"printer_ip": "", "roll": "2205"}

_print_lock = threading.Lock()


def load_settings():
    try:
        saved = json.loads(SETTINGS_FILE.read_text())
    except (OSError, ValueError):
        saved = {}
    settings = {**DEFAULTS, **{k: v for k, v in saved.items() if k in DEFAULTS}}
    if settings["roll"] not in ROLLS:
        settings["roll"] = DEFAULTS["roll"]
    return settings


def save_settings(settings):
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(settings, indent=2))


def _run_print(image):
    settings = load_settings()
    if not _print_lock.acquire(timeout=20):
        return {"ok": False, "message": "The printer is still busy with the previous badge. Try again in a moment."}
    try:
        confirmed = print_image(image, settings["printer_ip"], settings["roll"])
        return {"ok": True, "message": "Printed." if confirmed else "Sent to the printer."}
    except PrintError as exc:
        return {"ok": False, "message": str(exc)}
    except Exception as exc:  # Never let an unexpected error reach the window as a crash.
        return {"ok": False, "message": f"Printing failed: {exc}"}
    finally:
        _print_lock.release()


class Api:
    """Functions the web app can call as window.pywebview.api.<name>(...)."""

    def get_settings(self):
        return {**load_settings(), "version": VERSION, "rolls": ROLL_NAMES}

    def save_settings(self, printer_ip, roll):
        printer_ip = str(printer_ip or "").strip()
        if printer_ip:
            try:
                ipaddress.ip_address(printer_ip)
            except ValueError:
                return {"ok": False, "message": "That does not look like a printer address. It should be four numbers, like 192.168.4.36."}
        if roll not in ROLLS:
            return {"ok": False, "message": "Choose a roll type."}
        save_settings({"printer_ip": printer_ip, "roll": roll})
        return {"ok": True, "message": "Printer settings saved."}

    def print_badge(self, data_url):
        try:
            image = image_from_data_url(str(data_url))
        except PrintError as exc:
            return {"ok": False, "message": str(exc)}
        return _run_print(image)

    def test_print(self):
        return _run_print(test_image(load_settings()["roll"]))


def main():
    webview.create_window("NC EMS Expo", APP_URL, js_api=Api(), width=1100, height=820, min_size=(420, 640))
    webview.start()


if __name__ == "__main__":
    main()
