"""MQTT client for a single Bambu Lab printer (LAN, port 8883 TLS)."""
from __future__ import annotations

import asyncio
import logging
import ssl
import uuid
from typing import Callable, Awaitable, Optional

import paho.mqtt.client as mqtt

from src.mqtt.handlers import parse_report, PrinterStatus
from src.printers.manager import PrinterConfig

log = logging.getLogger(__name__)

StatusCallback = Callable[[str, PrinterStatus], Awaitable[None]]


class PrinterMqttClient:
    """Manages a single MQTT connection to one Bambu Lab printer.

    Bambu Lab printers run their own MQTT broker on port 8883 (TLS).
    Credentials: username='bblp', password=<access_code>.
    They use a self-signed certificate — TLS verification is disabled.
    """

    MQTT_PORT = 8883
    KEEPALIVE = 60

    def __init__(self, config: PrinterConfig, on_status: StatusCallback) -> None:
        self._config = config
        self._on_status = on_status
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client = self._build_client()

    def _build_client(self) -> mqtt.Client:
        client_id = f"printfarm_{self._config.serial}_{uuid.uuid4().hex[:8]}"
        client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
        client.username_pw_set("bblp", self._config.access_code)

        # Bambu printers use self-signed TLS certs
        tls_ctx = ssl.create_default_context()
        tls_ctx.check_hostname = False
        tls_ctx.verify_mode = ssl.CERT_NONE
        client.tls_set_context(tls_ctx)

        client.on_connect = self._on_connect
        client.on_message = self._on_message
        client.on_disconnect = self._on_disconnect
        return client

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            log.info("Connected to printer %s @ %s", self._config.serial, self._config.ip)
            client.subscribe(self._config.report_topic)
        else:
            log.warning("Printer %s connect failed, rc=%d", self._config.serial, rc)

    def _on_message(self, client, userdata, msg):
        status = parse_report(msg.payload)
        if status is None:
            return
        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(
                self._on_status(self._config.device_id, status),
                self._loop,
            )

    def _on_disconnect(self, client, userdata, rc):
        log.info("Printer %s disconnected (rc=%d)", self._config.serial, rc)

    async def start(self) -> None:
        """Connect and start the network loop in a background thread."""
        self._loop = asyncio.get_running_loop()
        await self._loop.run_in_executor(
            None,
            lambda: self._client.connect(
                self._config.ip,
                self.MQTT_PORT,
                self.KEEPALIVE,
            ),
        )
        self._client.loop_start()

    async def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()
