"""Tests for MQTT message handlers — parse Bambu Lab payloads."""
import json
import pytest
from src.mqtt.handlers import parse_report, PrinterStatus, PrinterState


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _payload(**kwargs) -> bytes:
    """Build a minimal valid Bambu report payload."""
    data = {
        "print": {
            "gcode_state": "IDLE",
            "mc_percent": 0,
            "mc_remaining_time": 0,
            "layer_num": 0,
            "total_layer_num": 0,
            "nozzle_temper": 0.0,
            "nozzle_target_temper": 0.0,
            "bed_temper": 0.0,
            "bed_target_temper": 0.0,
            "fail_reason": "0",
            "print_error": 0,
            "subtask_name": "",
        }
    }
    if "print" in kwargs:
        data["print"].update(kwargs["print"])
    return json.dumps(data).encode()


# ---------------------------------------------------------------------------
# State mapping
# ---------------------------------------------------------------------------

class TestStateMapping:
    def test_idle(self):
        s = parse_report(_payload())
        assert s.state == PrinterState.IDLE

    def test_running(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "RUNNING"}}))
        assert s.state == PrinterState.PRINTING

    def test_paused(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "PAUSE"}}))
        assert s.state == PrinterState.PAUSED

    def test_finished(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "FINISH"}}))
        assert s.state == PrinterState.COMPLETED

    def test_failed(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "FAILED"}}))
        assert s.state == PrinterState.FAILED

    def test_unknown_state_defaults_to_idle(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "UNKNOWN_FUTURE"}}))
        assert s.state == PrinterState.IDLE


# ---------------------------------------------------------------------------
# Numeric fields
# ---------------------------------------------------------------------------

class TestNumericFields:
    def test_progress(self):
        s = parse_report(_payload(**{"print": {"gcode_state": "RUNNING", "mc_percent": 42}}))
        assert s.progress == 42

    def test_remaining_minutes(self):
        s = parse_report(_payload(**{"print": {"mc_remaining_time": 90}}))
        assert s.remaining_minutes == 90

    def test_layer_info(self):
        s = parse_report(_payload(**{"print": {"layer_num": 15, "total_layer_num": 200}}))
        assert s.layer_current == 15
        assert s.layer_total == 200

    def test_temperatures(self):
        s = parse_report(_payload(**{"print": {
            "nozzle_temper": 220.5,
            "nozzle_target_temper": 220.0,
            "bed_temper": 60.2,
            "bed_target_temper": 60.0,
        }}))
        assert abs(s.nozzle_temp - 220.5) < 0.01
        assert abs(s.nozzle_target - 220.0) < 0.01
        assert abs(s.bed_temp - 60.2) < 0.01
        assert abs(s.bed_target - 60.0) < 0.01

    def test_subtask_name(self):
        s = parse_report(_payload(**{"print": {"subtask_name": "my_model.3mf"}}))
        assert s.subtask_name == "my_model.3mf"


# ---------------------------------------------------------------------------
# Robustness
# ---------------------------------------------------------------------------

class TestRobustness:
    def test_missing_print_key_returns_none(self):
        result = parse_report(json.dumps({"system": {}}).encode())
        assert result is None

    def test_invalid_json_returns_none(self):
        result = parse_report(b"not json {{{")
        assert result is None

    def test_partial_payload_uses_defaults(self):
        """Only gcode_state present — all other fields should default."""
        minimal = json.dumps({"print": {"gcode_state": "RUNNING"}}).encode()
        s = parse_report(minimal)
        assert s is not None
        assert s.state == PrinterState.PRINTING
        assert s.progress == 0
        assert s.nozzle_temp == 0.0

    def test_returns_printer_status_instance(self):
        s = parse_report(_payload())
        assert isinstance(s, PrinterStatus)
