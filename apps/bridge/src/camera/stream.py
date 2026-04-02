"""Camera frame extraction from Bambu Lab printer RTSP stream."""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

log = logging.getLogger(__name__)


class CameraStream:
    """Extracts JPEG frames from a Bambu Lab printer camera.

    Bambu printers stream via RTSPS (TLS RTSP):
      rtsps://<ip>/streaming/live/1

    Requires OpenCV with FFMPEG backend (opencv-python-headless).
    Falls back gracefully if unavailable.
    """

    RTSP_URL_TEMPLATE = "rtsps://{ip}/streaming/live/1"
    FRAME_INTERVAL_SECONDS = 10.0

    def __init__(
        self,
        ip: str,
        device_id: str,
        on_frame,  # Callable[[str, bytes], Awaitable[None]]
        interval: float = FRAME_INTERVAL_SECONDS,
    ) -> None:
        self._ip = ip
        self._device_id = device_id
        self._on_frame = on_frame
        self._interval = interval
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        url = self.RTSP_URL_TEMPLATE.format(ip=self._ip)
        while self._running:
            try:
                frame = await asyncio.get_running_loop().run_in_executor(
                    None, self._capture_frame, url
                )
                if frame is not None:
                    await self._on_frame(self._device_id, frame)
            except Exception as e:
                log.debug("Camera capture error for %s: %s", self._device_id, e)
            await asyncio.sleep(self._interval)

    @staticmethod
    def _capture_frame(url: str) -> Optional[bytes]:
        """Capture one JPEG frame from the RTSP stream."""
        try:
            import cv2
        except ImportError:
            log.debug("opencv-python-headless not installed — camera disabled")
            return None

        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            log.debug("Cannot open RTSP stream: %s", url)
            return None
        try:
            ret, frame = cap.read()
            if not ret or frame is None:
                return None
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            return buf.tobytes()
        finally:
            cap.release()
