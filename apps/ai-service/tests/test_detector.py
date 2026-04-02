"""Tests for the print failure detector — mocked YOLO model."""
import pytest
from unittest.mock import MagicMock, patch
import numpy as np

from src.detection.detector import (
    PrintFailureDetector,
    DetectionResult,
    FailureType,
    BoundingBox,
    CONFIDENCE_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_yolo_result(class_id: int, confidence: float, box_xyxy):
    """Build a mock YOLO result object (ultralytics format)."""
    result = MagicMock()
    box = MagicMock()
    box.cls = MagicMock()
    box.cls.item.return_value = float(class_id)
    box.conf = MagicMock()
    box.conf.item.return_value = confidence
    box.xyxy = MagicMock()
    box.xyxy.__getitem__ = MagicMock(return_value=MagicMock(tolist=MagicMock(return_value=list(box_xyxy))))
    result.boxes = [box]
    return result

def _make_frame() -> bytes:
    """Create a minimal valid JPEG-like bytes for testing."""
    # 10x10 black RGB image encoded as JPEG
    try:
        import cv2
        img = np.zeros((10, 10, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', img)
        return buf.tobytes()
    except ImportError:
        return b"\xff\xd8\xff\xe0" + b"\x00" * 100  # fake JPEG header


# ---------------------------------------------------------------------------
# FailureType
# ---------------------------------------------------------------------------

class TestFailureType:
    def test_all_types_defined(self):
        assert FailureType.SPAGHETTI is not None
        assert FailureType.KNOCKED_OVER is not None
        assert FailureType.LAYER_SHIFT is not None

    def test_values_are_strings(self):
        assert isinstance(FailureType.SPAGHETTI.value, str)
        assert isinstance(FailureType.KNOCKED_OVER.value, str)
        assert isinstance(FailureType.LAYER_SHIFT.value, str)


# ---------------------------------------------------------------------------
# BoundingBox
# ---------------------------------------------------------------------------

class TestBoundingBox:
    def test_from_xyxy(self):
        bb = BoundingBox.from_xyxy(10.0, 20.0, 100.0, 150.0, width=640, height=480)
        assert bb.x == pytest.approx(10.0 / 640)
        assert bb.y == pytest.approx(20.0 / 480)
        assert bb.w == pytest.approx(90.0 / 640)
        assert bb.h == pytest.approx(130.0 / 480)

    def test_to_dict(self):
        bb = BoundingBox(x=0.1, y=0.2, w=0.3, h=0.4)
        d = bb.to_dict()
        assert d == {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}


# ---------------------------------------------------------------------------
# DetectionResult
# ---------------------------------------------------------------------------

class TestDetectionResult:
    def test_no_failure(self):
        r = DetectionResult(failure=False)
        assert r.failure is False
        assert r.failure_type is None
        assert r.confidence is None
        assert r.bounding_box is None

    def test_with_failure(self):
        bb = BoundingBox(x=0.1, y=0.2, w=0.3, h=0.4)
        r = DetectionResult(
            failure=True,
            failure_type=FailureType.SPAGHETTI,
            confidence=0.92,
            bounding_box=bb,
        )
        assert r.failure is True
        assert r.failure_type == FailureType.SPAGHETTI
        assert r.confidence == pytest.approx(0.92)

    def test_to_dict_no_failure(self):
        r = DetectionResult(failure=False)
        d = r.to_dict()
        assert d["failure"] is False
        assert d["failureType"] is None
        assert d["confidence"] is None

    def test_to_dict_with_failure(self):
        bb = BoundingBox(x=0.1, y=0.2, w=0.3, h=0.4)
        r = DetectionResult(
            failure=True,
            failure_type=FailureType.KNOCKED_OVER,
            confidence=0.88,
            bounding_box=bb,
        )
        d = r.to_dict()
        assert d["failure"] is True
        assert d["failureType"] == "knocked_over"
        assert d["confidence"] == pytest.approx(0.88)
        assert d["boundingBox"] == {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}


# ---------------------------------------------------------------------------
# PrintFailureDetector — without real model
# ---------------------------------------------------------------------------

class TestPrintFailureDetector:
    def test_init_without_model(self):
        """Detector can be created with model_path=None (no model loaded)."""
        det = PrintFailureDetector(model_path=None)
        assert det is not None
        assert det.model is None

    def test_detect_without_model_returns_no_failure(self):
        """When no model loaded, detect() returns failure=False."""
        det = PrintFailureDetector(model_path=None)
        frame = _make_frame()
        result = det.detect(frame)
        assert result.failure is False

    def test_detect_invalid_frame_returns_no_failure(self):
        """Invalid frame bytes don't crash — return failure=False."""
        det = PrintFailureDetector(model_path=None)
        result = det.detect(b"not an image")
        assert result.failure is False

    def test_is_loaded_false_without_model(self):
        det = PrintFailureDetector(model_path=None)
        assert det.is_loaded is False

    def test_class_id_to_failure_type_mapping(self):
        det = PrintFailureDetector(model_path=None)
        assert det._class_to_failure(0) == FailureType.SPAGHETTI
        assert det._class_to_failure(1) == FailureType.KNOCKED_OVER
        assert det._class_to_failure(2) == FailureType.LAYER_SHIFT

    def test_unknown_class_id_returns_spaghetti(self):
        det = PrintFailureDetector(model_path=None)
        assert det._class_to_failure(99) == FailureType.SPAGHETTI

    def test_detect_with_mocked_model_spaghetti(self):
        """With a mocked model that returns a high-confidence detection."""
        det = PrintFailureDetector(model_path=None)
        mock_model = MagicMock()

        # Mock result: class=0 (spaghetti), confidence=0.95, box=[0,0,100,100]
        mock_boxes = MagicMock()
        mock_boxes.__len__ = MagicMock(return_value=1)

        mock_box = MagicMock()
        mock_box.cls.item.return_value = 0.0   # spaghetti
        mock_box.conf.item.return_value = 0.95
        xyxy_row = MagicMock()
        xyxy_row.tolist.return_value = [10.0, 20.0, 300.0, 400.0]
        mock_box.xyxy.__getitem__ = MagicMock(return_value=xyxy_row)
        mock_boxes.__iter__ = MagicMock(return_value=iter([mock_box]))

        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]

        det.model = mock_model
        det._img_size = (640, 480)

        frame = _make_frame()
        with patch("src.detection.detector.decode_frame", return_value=(
            MagicMock(), 640, 480
        )):
            result = det.detect(frame)

        assert result.failure is True
        assert result.failure_type == FailureType.SPAGHETTI
        assert result.confidence == pytest.approx(0.95)

    def test_detect_below_threshold_returns_no_failure(self):
        """Low confidence detection is ignored."""
        det = PrintFailureDetector(model_path=None)
        mock_model = MagicMock()

        mock_box = MagicMock()
        mock_box.cls.item.return_value = 0.0
        mock_box.conf.item.return_value = CONFIDENCE_THRESHOLD - 0.01  # below threshold

        mock_boxes = MagicMock()
        mock_boxes.__len__ = MagicMock(return_value=1)
        mock_boxes.__iter__ = MagicMock(return_value=iter([mock_box]))

        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]

        det.model = mock_model
        det._img_size = (640, 480)

        frame = _make_frame()
        with patch("src.detection.detector.decode_frame", return_value=(
            MagicMock(), 640, 480
        )):
            result = det.detect(frame)

        assert result.failure is False

    def test_detect_empty_boxes_no_failure(self):
        """No boxes → no failure."""
        det = PrintFailureDetector(model_path=None)
        mock_model = MagicMock()

        mock_boxes = MagicMock()
        mock_boxes.__len__ = MagicMock(return_value=0)
        mock_boxes.__iter__ = MagicMock(return_value=iter([]))

        mock_result = MagicMock()
        mock_result.boxes = mock_boxes
        mock_model.return_value = [mock_result]

        det.model = mock_model
        det._img_size = (640, 480)

        frame = _make_frame()
        with patch("src.detection.detector.decode_frame", return_value=(
            MagicMock(), 640, 480
        )):
            result = det.detect(frame)

        assert result.failure is False
