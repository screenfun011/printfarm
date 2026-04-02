"""Tests for bridge configuration loader."""
import json
import os
import pytest
from unittest.mock import patch

from src.config import load_config, BridgeConfig


class TestLoadConfig:
    def _env(self, **kwargs):
        base = {
            "API_URL": "http://localhost:3000",
            "BRIDGE_TOKEN": "test-secret",
            "LOG_LEVEL": "DEBUG",
            "CAMERA_ENABLED": "true",
            "CAMERA_INTERVAL_SECONDS": "15",
            "PRINTERS": "[]",
        }
        base.update(kwargs)
        return base

    def test_loads_all_fields(self):
        printers = [{"serial": "ABC", "ip": "1.2.3.4", "access_code": "12345678", "device_id": "uuid"}]
        with patch.dict(os.environ, self._env(PRINTERS=json.dumps(printers)), clear=True):
            cfg = load_config()
        assert cfg.api_url == "http://localhost:3000"
        assert cfg.api_token == "test-secret"
        assert cfg.log_level == "DEBUG"
        assert cfg.camera_enabled is True
        assert cfg.camera_interval_seconds == 15.0
        assert len(cfg.printers) == 1

    def test_defaults(self):
        with patch.dict(os.environ, {"BRIDGE_TOKEN": "tok"}, clear=True):
            cfg = load_config()
        assert cfg.api_url == "http://localhost:3000"
        assert cfg.log_level == "INFO"
        assert cfg.camera_enabled is True
        assert cfg.camera_interval_seconds == 10.0
        assert cfg.printers == []

    def test_missing_token_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="BRIDGE_TOKEN"):
                load_config()

    def test_camera_disabled(self):
        with patch.dict(os.environ, self._env(CAMERA_ENABLED="false"), clear=True):
            cfg = load_config()
        assert cfg.camera_enabled is False

    def test_invalid_printers_json_defaults_to_empty(self):
        with patch.dict(os.environ, self._env(PRINTERS="not-valid-json"), clear=True):
            cfg = load_config()
        assert cfg.printers == []

    def test_returns_bridge_config_instance(self):
        with patch.dict(os.environ, self._env(), clear=True):
            cfg = load_config()
        assert isinstance(cfg, BridgeConfig)
