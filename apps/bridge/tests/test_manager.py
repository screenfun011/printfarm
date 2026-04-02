"""Tests for PrinterManager — manages MQTT connections to all printers."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from src.printers.manager import PrinterManager, PrinterConfig


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def config_a():
    return PrinterConfig(
        serial="BBA123456789",
        ip="192.168.1.10",
        access_code="12345678",
        device_id="printer-uuid-a",
    )

@pytest.fixture
def config_b():
    return PrinterConfig(
        serial="BBB987654321",
        ip="192.168.1.11",
        access_code="87654321",
        device_id="printer-uuid-b",
    )


# ---------------------------------------------------------------------------
# PrinterConfig
# ---------------------------------------------------------------------------

class TestPrinterConfig:
    def test_mqtt_topic(self, config_a):
        assert config_a.report_topic == f"device/{config_a.serial}/report"

    def test_request_topic(self, config_a):
        assert config_a.request_topic == f"device/{config_a.serial}/request"


# ---------------------------------------------------------------------------
# PrinterManager
# ---------------------------------------------------------------------------

class TestPrinterManager:
    def test_starts_empty(self):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        assert manager.printer_count == 0

    def test_add_printer(self, config_a):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)
        assert manager.printer_count == 1

    def test_add_multiple_printers(self, config_a, config_b):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)
        manager.add_printer(config_b)
        assert manager.printer_count == 2

    def test_add_duplicate_serial_ignored(self, config_a):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)
        manager.add_printer(config_a)
        assert manager.printer_count == 1

    def test_remove_printer(self, config_a):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)
        manager.remove_printer(config_a.serial)
        assert manager.printer_count == 0

    def test_remove_nonexistent_printer_no_error(self):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.remove_printer("NONEXISTENT")  # should not raise

    def test_get_printer_configs(self, config_a, config_b):
        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)
        manager.add_printer(config_b)
        configs = manager.get_printer_configs()
        serials = {c.serial for c in configs}
        assert config_a.serial in serials
        assert config_b.serial in serials


# ---------------------------------------------------------------------------
# Status routing
# ---------------------------------------------------------------------------

class TestStatusRouting:
    @pytest.mark.asyncio
    async def test_on_status_calls_api(self, config_a):
        """When a status arrives for a printer, the API client is called."""
        from src.mqtt.handlers import PrinterStatus, PrinterState

        status = PrinterStatus(
            state=PrinterState.PRINTING,
            progress=50,
            remaining_minutes=30,
            layer_current=10,
            layer_total=100,
            nozzle_temp=220.0,
            nozzle_target=220.0,
            bed_temp=60.0,
            bed_target=60.0,
            subtask_name="test.3mf",
        )

        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)

        mock_api = AsyncMock()
        manager._api_client = mock_api

        await manager._on_status(config_a.device_id, status)

        mock_api.report_status.assert_called_once_with(config_a.device_id, status)

    @pytest.mark.asyncio
    async def test_on_status_api_error_does_not_crash(self, config_a):
        """API errors are swallowed — the manager keeps running."""
        from src.mqtt.handlers import PrinterStatus, PrinterState

        status = PrinterStatus(
            state=PrinterState.IDLE,
            progress=0,
            remaining_minutes=0,
            layer_current=0,
            layer_total=0,
            nozzle_temp=0.0,
            nozzle_target=0.0,
            bed_temp=0.0,
            bed_target=0.0,
            subtask_name="",
        )

        manager = PrinterManager(api_url="http://localhost:3000", api_token="tok")
        manager.add_printer(config_a)

        mock_api = AsyncMock()
        mock_api.report_status.side_effect = Exception("Network error")
        manager._api_client = mock_api

        # Should not raise
        await manager._on_status(config_a.device_id, status)
