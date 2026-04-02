"""HTTP client — sends bridge updates to the main PrintFarm API."""
from __future__ import annotations

import logging
from typing import Optional

import aiohttp

from src.mqtt.handlers import PrinterStatus

log = logging.getLogger(__name__)


class BridgeApiClient:
    """Async context manager that posts status/frame updates to the API."""

    def __init__(self, api_url: str, token: str) -> None:
        self._api_url = api_url.rstrip("/")
        self._token = token
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self) -> "BridgeApiClient":
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args) -> None:
        if self._session:
            await self._session.close()
            self._session = None

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"}

    async def report_status(self, device_id: str, status: PrinterStatus) -> None:
        """POST printer status to /bridge/printers/{device_id}/status."""
        url = f"{self._api_url}/bridge/printers/{device_id}/status"
        payload = {"state": status.state.value, "progress": status.progress, **status.to_dict()}

        async with self._session.post(url, json=payload, headers=self._headers()) as resp:
            if resp.status >= 300:
                body = await resp.text()
                raise Exception(f"{resp.status}: {body}")

    async def report_ai_frame(self, device_id: str, jpeg: bytes) -> None:
        """POST a JPEG camera frame to /bridge/printers/{device_id}/frame."""
        url = f"{self._api_url}/bridge/printers/{device_id}/frame"
        data = aiohttp.FormData()
        data.add_field("frame", jpeg, content_type="image/jpeg", filename="frame.jpg")

        async with self._session.post(url, data=data, headers=self._headers()) as resp:
            if resp.status >= 300:
                body = await resp.text()
                raise Exception(f"{resp.status}: {body}")
