"""Print failure detector — wraps YOLOv8 model."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

log = logging.getLogger(__name__)

# Import decode_frame at module level so tests can patch it
try:
    from src.utils.image import decode_frame
except ImportError:
    from utils.image import decode_frame  # type: ignore

# Minimum confidence to report a failure
CONFIDENCE_THRESHOLD = 0.60

# YOLOv8 class index → failure type
CLASS_MAP = {0: "spaghetti", 1: "knocked_over", 2: "layer_shift"}


class FailureType(str, Enum):
    SPAGHETTI = "spaghetti"
    KNOCKED_OVER = "knocked_over"
    LAYER_SHIFT = "layer_shift"


@dataclass
class BoundingBox:
    """Normalised bounding box (0–1 relative to image dimensions)."""
    x: float
    y: float
    w: float
    h: float

    @classmethod
    def from_xyxy(cls, x1: float, y1: float, x2: float, y2: float, width: int, height: int) -> "BoundingBox":
        return cls(
            x=x1 / width,
            y=y1 / height,
            w=(x2 - x1) / width,
            h=(y2 - y1) / height,
        )

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


@dataclass
class DetectionResult:
    failure: bool
    failure_type: Optional[FailureType] = None
    confidence: Optional[float] = None
    bounding_box: Optional[BoundingBox] = None

    def to_dict(self) -> dict:
        return {
            "failure": self.failure,
            "failureType": self.failure_type.value if self.failure_type else None,
            "confidence": self.confidence,
            "boundingBox": self.bounding_box.to_dict() if self.bounding_box else None,
        }


class PrintFailureDetector:
    """Wraps a YOLOv8 model for detecting 3D print failures."""

    def __init__(self, model_path: Optional[str] = None) -> None:
        self.model = None
        self._img_size: Optional[tuple[int, int]] = None

        if model_path:
            self._load(model_path)

    def _load(self, model_path: str) -> None:
        try:
            from ultralytics import YOLO
            self.model = YOLO(model_path)
            log.info("YOLOv8 model loaded from %s", model_path)
        except Exception as e:
            log.error("Failed to load model from %s: %s", model_path, e)
            self.model = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def _class_to_failure(self, class_id: int) -> FailureType:
        name = CLASS_MAP.get(class_id, "spaghetti")
        return FailureType(name)

    def detect(self, jpeg_bytes: bytes) -> DetectionResult:
        """Run detection on a JPEG frame. Returns DetectionResult."""
        if self.model is None:
            return DetectionResult(failure=False)

        try:
            frame, width, height = decode_frame(jpeg_bytes)
        except Exception as e:
            log.debug("Frame decode failed: %s", e)
            return DetectionResult(failure=False)

        try:
            results = self.model(frame, verbose=False)
        except Exception as e:
            log.error("Model inference failed: %s", e)
            raise

        if not results:
            return DetectionResult(failure=False)

        result = results[0]
        boxes = result.boxes

        if len(boxes) == 0:
            return DetectionResult(failure=False)

        # Pick highest-confidence box
        best_box = None
        best_conf = 0.0
        best_cls = 0

        for box in boxes:
            conf = box.conf.item()
            if conf > best_conf:
                best_conf = conf
                best_cls = int(box.cls.item())
                best_box = box

        if best_conf < CONFIDENCE_THRESHOLD:
            return DetectionResult(failure=False)

        xyxy = best_box.xyxy[0].tolist()
        bb = BoundingBox.from_xyxy(xyxy[0], xyxy[1], xyxy[2], xyxy[3], width, height)

        return DetectionResult(
            failure=True,
            failure_type=self._class_to_failure(best_cls),
            confidence=best_conf,
            bounding_box=bb,
        )
