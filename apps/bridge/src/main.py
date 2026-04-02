"""PrintFarm Bridge — main entry point.

Connects to all configured Bambu Lab printers via LAN MQTT,
forwards status updates to the PrintFarm API, and optionally
captures camera frames for AI failure detection.
"""
from __future__ import annotations

import asyncio
import logging
import signal
import sys

from src.config import load_config
from src.api.client import BridgeApiClient
from src.mqtt.client import PrinterMqttClient
from src.camera.stream import CameraStream
from src.printers.manager import PrinterConfig, PrinterManager

log = logging.getLogger(__name__)


async def run() -> None:
    config = load_config()

    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    log.info("PrintFarm Bridge starting (api=%s)", config.api_url)

    if not config.printers:
        log.warning("No printers configured — set PRINTERS env var")

    async with BridgeApiClient(api_url=config.api_url, token=config.api_token) as api:
        manager = PrinterManager(api_url=config.api_url, api_token=config.api_token)
        manager._api_client = api

        mqtt_clients: list[PrinterMqttClient] = []
        camera_streams: list[CameraStream] = []

        for p in config.printers:
            pc = PrinterConfig(
                serial=p["serial"],
                ip=p["ip"],
                access_code=p["access_code"],
                device_id=p["device_id"],
            )
            manager.add_printer(pc)

            mqtt_client = PrinterMqttClient(config=pc, on_status=manager._on_status)
            mqtt_clients.append(mqtt_client)

            if config.camera_enabled:
                cam = CameraStream(
                    ip=pc.ip,
                    device_id=pc.device_id,
                    on_frame=manager._on_frame,
                    interval=config.camera_interval_seconds,
                )
                camera_streams.append(cam)

        # Start all connections
        for client in mqtt_clients:
            await client.start()

        for cam in camera_streams:
            await cam.start()

        log.info(
            "Bridge running — %d printer(s) connected",
            manager.printer_count,
        )

        # Wait until interrupted
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop_event.set)

        await stop_event.wait()
        log.info("Shutting down…")

        for cam in camera_streams:
            await cam.stop()

        for client in mqtt_clients:
            await client.stop()


def main() -> None:
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
