"""Manages MQTT connections to all Bambu Lab printers."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from src.mqtt.handlers import PrinterStatus

log = logging.getLogger(__name__)


@dataclass
class PrinterConfig:
    serial: str       # Bambu serial, e.g. "00M09A123456789"
    ip: str           # LAN IP
    access_code: str  # 8-digit access code from printer screen
    device_id: str    # UUID in PrintFarm DB

    @property
    def report_topic(self) -> str:
        return f"device/{self.serial}/report"

    @property
    def request_topic(self) -> str:
        return f"device/{self.serial}/request"


class PrinterManager:
    """Tracks configured printers and routes MQTT status to the API."""

    def __init__(self, api_url: str, api_token: str) -> None:
        self._api_url = api_url
        self._api_token = api_token
        self._printers: dict[str, PrinterConfig] = {}
        self._api_client = None  # set by caller or start()

    # ------------------------------------------------------------------
    # Config management
    # ------------------------------------------------------------------

    def add_printer(self, config: PrinterConfig) -> None:
        if config.serial not in self._printers:
            self._printers[config.serial] = config

    def remove_printer(self, serial: str) -> None:
        self._printers.pop(serial, None)

    def get_printer_configs(self) -> list[PrinterConfig]:
        return list(self._printers.values())

    @property
    def printer_count(self) -> int:
        return len(self._printers)

    # ------------------------------------------------------------------
    # Status routing
    # ------------------------------------------------------------------

    async def _on_status(self, device_id: str, status: PrinterStatus) -> None:
        """Called when a printer reports status. Forwards to API."""
        if self._api_client is None:
            return
        try:
            await self._api_client.report_status(device_id, status)
        except Exception as e:
            log.warning("Failed to report status for %s: %s", device_id, e)

    async def _on_frame(self, device_id: str, jpeg: bytes) -> None:
        """Called when a camera frame is captured. Sends to AI service."""
        if self._api_client is None:
            return
        try:
            await self._api_client.report_ai_frame(device_id, jpeg)
        except Exception as e:
            log.warning("Failed to send AI frame for %s: %s", device_id, e)
