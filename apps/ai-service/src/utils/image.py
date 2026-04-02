"""Image decoding utilities."""
from __future__ import annotations

import logging
from typing import Optional, Tuple

log = logging.getLogger(__name__)


def decode_frame(jpeg_bytes: bytes):
    """Decode JPEG bytes into a numpy array using OpenCV.

    Returns (frame, width, height) or raises ValueError on failure.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        raise ValueError("opencv-python-headless is required for frame decoding")

    buf = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Failed to decode image — invalid JPEG bytes")

    h, w = frame.shape[:2]
    return frame, w, h
