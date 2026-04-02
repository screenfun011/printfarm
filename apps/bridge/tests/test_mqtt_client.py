"""Tests for PrinterMqttClient — unit tests with mocked paho."""
import asyncio
import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock, call

from src.printers.manager import PrinterConfig
from src.mqtt.handlers import PrinterStatus, PrinterState


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def config():
    return PrinterConfig(
        serial="BBA111222333",
        ip="192.168.1.50",
        access_code="abcd1234",
        device_id="device-uuid-001",
    )


# ---------------------------------------------------------------------------
# Build client
# ---------------------------------------------------------------------------

class TestBuildClient:
    def test_client_created(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        with patch("paho.mqtt.client.Client") as MockMqtt:
            MockMqtt.return_value = MagicMock()
            client = PrinterMqttClient(config=config, on_status=on_status)
        assert client is not None

    def test_tls_is_configured(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()
        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            PrinterMqttClient(config=config, on_status=on_status)
        mock_mqtt.tls_set_context.assert_called_once()

    def test_credentials_set(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()
        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            PrinterMqttClient(config=config, on_status=on_status)
        mock_mqtt.username_pw_set.assert_called_once_with("bblp", config.access_code)


# ---------------------------------------------------------------------------
# on_connect callback
# ---------------------------------------------------------------------------

class TestOnConnect:
    def test_subscribes_on_success(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()
        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)
        # rc=0 means success
        c._on_connect(mock_mqtt, None, None, 0)
        mock_mqtt.subscribe.assert_called_once_with(config.report_topic)

    def test_no_subscribe_on_failure(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()
        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)
        c._on_connect(mock_mqtt, None, None, rc=1)  # rc!=0 = failure
        mock_mqtt.subscribe.assert_not_called()


# ---------------------------------------------------------------------------
# on_message callback
# ---------------------------------------------------------------------------

class TestOnMessage:
    def test_valid_message_calls_on_status(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()

        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)

        payload = json.dumps({"print": {"gcode_state": "RUNNING", "mc_percent": 50}}).encode()
        msg = MagicMock()
        msg.payload = payload

        loop = asyncio.new_event_loop()
        c._loop = loop

        with patch("asyncio.run_coroutine_threadsafe") as mock_coro:
            c._on_message(mock_mqtt, None, msg)
            mock_coro.assert_called_once()

        loop.close()

    def test_invalid_message_does_not_call_on_status(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()

        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)

        msg = MagicMock()
        msg.payload = b"not json"
        c._loop = asyncio.new_event_loop()

        with patch("asyncio.run_coroutine_threadsafe") as mock_coro:
            c._on_message(mock_mqtt, None, msg)
            mock_coro.assert_not_called()

        c._loop.close()

    def test_no_loop_does_not_crash(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()

        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)

        payload = json.dumps({"print": {"gcode_state": "RUNNING"}}).encode()
        msg = MagicMock()
        msg.payload = payload
        c._loop = None  # no loop set

        # Should not raise
        c._on_message(mock_mqtt, None, msg)


# ---------------------------------------------------------------------------
# stop
# ---------------------------------------------------------------------------

class TestStop:
    @pytest.mark.asyncio
    async def test_stop_disconnects(self, config):
        from src.mqtt.client import PrinterMqttClient
        on_status = AsyncMock()
        mock_mqtt = MagicMock()

        with patch("paho.mqtt.client.Client", return_value=mock_mqtt):
            c = PrinterMqttClient(config=config, on_status=on_status)

        await c.stop()
        mock_mqtt.loop_stop.assert_called_once()
        mock_mqtt.disconnect.assert_called_once()
