"""Bridge configuration — loaded from environment / .env file."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class BridgeConfig:
    api_url: str
    api_token: str
    log_level: str
    printers: list[dict]  # list of {serial, ip, access_code, device_id}
    camera_enabled: bool
    camera_interval_seconds: float


def load_config() -> BridgeConfig:
    api_url = os.environ.get("API_URL", "http://localhost:3000")
    api_token = os.environ.get("BRIDGE_TOKEN", "")
    log_level = os.environ.get("LOG_LEVEL", "INFO")
    camera_enabled = os.environ.get("CAMERA_ENABLED", "true").lower() == "true"
    camera_interval = float(os.environ.get("CAMERA_INTERVAL_SECONDS", "10"))

    printers_raw = os.environ.get("PRINTERS", "[]")
    try:
        printers = json.loads(printers_raw)
    except json.JSONDecodeError:
        printers = []

    if not api_token:
        raise ValueError("BRIDGE_TOKEN env var is required")

    return BridgeConfig(
        api_url=api_url,
        api_token=api_token,
        log_level=log_level,
        printers=printers,
        camera_enabled=camera_enabled,
        camera_interval_seconds=camera_interval,
    )
