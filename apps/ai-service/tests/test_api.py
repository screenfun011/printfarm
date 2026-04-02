"""Tests for FastAPI routes."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.detection.detector import DetectionResult, FailureType, BoundingBox


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_detector():
    det = MagicMock()
    det.is_loaded = True
    det.detect.return_value = DetectionResult(failure=False)
    return det

@pytest.fixture
def client(mock_detector):
    app = create_app(detector=mock_detector)
    return TestClient(app)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_returns_model_loaded_status(self, client, mock_detector):
        resp = client.get("/health")
        data = resp.json()
        assert "modelLoaded" in data
        assert data["modelLoaded"] is True

    def test_model_not_loaded(self, mock_detector):
        mock_detector.is_loaded = False
        app = create_app(detector=mock_detector)
        c = TestClient(app)
        resp = c.get("/health")
        assert resp.json()["modelLoaded"] is False


# ---------------------------------------------------------------------------
# /detect
# ---------------------------------------------------------------------------

class TestDetect:
    def _jpeg(self) -> bytes:
        """Minimal valid JPEG header."""
        return b"\xff\xd8\xff\xe0" + b"\x00" * 100

    def test_detect_no_failure(self, client, mock_detector):
        mock_detector.detect.return_value = DetectionResult(failure=False)
        resp = client.post(
            "/detect",
            files={"frame": ("frame.jpg", self._jpeg(), "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["failure"] is False
        assert data["failureType"] is None

    def test_detect_spaghetti(self, client, mock_detector):
        bb = BoundingBox(x=0.1, y=0.2, w=0.5, h=0.4)
        mock_detector.detect.return_value = DetectionResult(
            failure=True,
            failure_type=FailureType.SPAGHETTI,
            confidence=0.93,
            bounding_box=bb,
        )
        resp = client.post(
            "/detect",
            files={"frame": ("frame.jpg", self._jpeg(), "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["failure"] is True
        assert data["failureType"] == "spaghetti"
        assert data["confidence"] == pytest.approx(0.93, abs=1e-3)
        assert data["boundingBox"]["x"] == pytest.approx(0.1)

    def test_detect_knocked_over(self, client, mock_detector):
        mock_detector.detect.return_value = DetectionResult(
            failure=True,
            failure_type=FailureType.KNOCKED_OVER,
            confidence=0.87,
            bounding_box=BoundingBox(x=0.0, y=0.0, w=1.0, h=1.0),
        )
        resp = client.post(
            "/detect",
            files={"frame": ("frame.jpg", self._jpeg(), "image/jpeg")},
        )
        assert resp.json()["failureType"] == "knocked_over"

    def test_detect_layer_shift(self, client, mock_detector):
        mock_detector.detect.return_value = DetectionResult(
            failure=True,
            failure_type=FailureType.LAYER_SHIFT,
            confidence=0.79,
            bounding_box=BoundingBox(x=0.2, y=0.3, w=0.4, h=0.5),
        )
        resp = client.post(
            "/detect",
            files={"frame": ("frame.jpg", self._jpeg(), "image/jpeg")},
        )
        assert resp.json()["failureType"] == "layer_shift"

    def test_missing_frame_returns_422(self, client):
        resp = client.post("/detect")
        assert resp.status_code == 422

    def test_detect_calls_detector_with_bytes(self, client, mock_detector):
        frame_bytes = self._jpeg()
        client.post(
            "/detect",
            files={"frame": ("frame.jpg", frame_bytes, "image/jpeg")},
        )
        mock_detector.detect.assert_called_once_with(frame_bytes)

    def test_detector_exception_returns_500(self, client, mock_detector):
        mock_detector.detect.side_effect = RuntimeError("Model crashed")
        resp = client.post(
            "/detect",
            files={"frame": ("frame.jpg", self._jpeg(), "image/jpeg")},
        )
        assert resp.status_code == 500
