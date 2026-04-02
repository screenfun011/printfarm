"""Tests for main.py entrypoint — mocked startup/shutdown."""
import asyncio
import os
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestRun:
    @pytest.mark.asyncio
    async def test_run_no_printers(self):
        """run() completes cleanly with no printers configured."""
        from src.config import BridgeConfig

        cfg = BridgeConfig(
            api_url="http://localhost:3000",
            api_token="tok",
            log_level="WARNING",
            printers=[],
            camera_enabled=False,
            camera_interval_seconds=10.0,
        )

        stop_event = asyncio.Event()

        async def fake_run():
            """Simulate run() but trigger stop immediately."""
            stop_event.set()
            await stop_event.wait()

        with patch("src.main.load_config", return_value=cfg), \
             patch("src.main.BridgeApiClient") as MockApiClient:

            mock_api = AsyncMock()
            mock_api.__aenter__ = AsyncMock(return_value=mock_api)
            mock_api.__aexit__ = AsyncMock(return_value=False)
            MockApiClient.return_value = mock_api

            # Simulate stop signal immediately
            with patch("asyncio.Event") as MockEvent:
                event_instance = MagicMock()
                event_instance.wait = AsyncMock()
                event_instance.set = MagicMock()
                MockEvent.return_value = event_instance

                from src.main import run
                await run()

    @pytest.mark.asyncio
    async def test_run_with_printers(self):
        """run() starts MQTT client for each configured printer."""
        from src.config import BridgeConfig

        printers_cfg = [
            {"serial": "ABC123", "ip": "1.2.3.4", "access_code": "12345678", "device_id": "uuid-1"},
        ]
        cfg = BridgeConfig(
            api_url="http://localhost:3000",
            api_token="tok",
            log_level="WARNING",
            printers=printers_cfg,
            camera_enabled=False,
            camera_interval_seconds=10.0,
        )

        with patch("src.main.load_config", return_value=cfg), \
             patch("src.main.BridgeApiClient") as MockApiClient, \
             patch("src.main.PrinterMqttClient") as MockMqttClient:

            mock_api = AsyncMock()
            mock_api.__aenter__ = AsyncMock(return_value=mock_api)
            mock_api.__aexit__ = AsyncMock(return_value=False)
            MockApiClient.return_value = mock_api

            mock_mqtt = AsyncMock()
            MockMqttClient.return_value = mock_mqtt

            with patch("asyncio.Event") as MockEvent:
                event_instance = MagicMock()
                event_instance.wait = AsyncMock()
                event_instance.set = MagicMock()
                MockEvent.return_value = event_instance

                from src.main import run
                await run()

            mock_mqtt.start.assert_called_once()
            mock_mqtt.stop.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_with_camera(self):
        """run() starts CameraStream when camera_enabled=True."""
        from src.config import BridgeConfig

        printers_cfg = [
            {"serial": "ABC123", "ip": "1.2.3.4", "access_code": "12345678", "device_id": "uuid-1"},
        ]
        cfg = BridgeConfig(
            api_url="http://localhost:3000",
            api_token="tok",
            log_level="WARNING",
            printers=printers_cfg,
            camera_enabled=True,
            camera_interval_seconds=5.0,
        )

        with patch("src.main.load_config", return_value=cfg), \
             patch("src.main.BridgeApiClient") as MockApiClient, \
             patch("src.main.PrinterMqttClient") as MockMqttClient, \
             patch("src.main.CameraStream") as MockCamera:

            mock_api = AsyncMock()
            mock_api.__aenter__ = AsyncMock(return_value=mock_api)
            mock_api.__aexit__ = AsyncMock(return_value=False)
            MockApiClient.return_value = mock_api

            mock_mqtt = AsyncMock()
            MockMqttClient.return_value = mock_mqtt

            mock_cam = AsyncMock()
            MockCamera.return_value = mock_cam

            with patch("asyncio.Event") as MockEvent:
                event_instance = MagicMock()
                event_instance.wait = AsyncMock()
                event_instance.set = MagicMock()
                MockEvent.return_value = event_instance

                from src.main import run
                await run()

            mock_cam.start.assert_called_once()
            mock_cam.stop.assert_called_once()


class TestMain:
    def test_main_runs(self):
        """main() calls asyncio.run(run())."""
        with patch("src.main.asyncio.run") as mock_run:
            from src.main import main
            main()
            mock_run.assert_called_once()

    def test_main_handles_keyboard_interrupt(self):
        """main() catches KeyboardInterrupt."""
        with patch("src.main.asyncio.run", side_effect=KeyboardInterrupt):
            from src.main import main
            main()  # should not raise
