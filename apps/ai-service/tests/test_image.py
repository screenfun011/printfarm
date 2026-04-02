"""Tests for image decoding utilities."""
import pytest
from unittest.mock import MagicMock, patch


class TestDecodeFrame:
    def test_raises_on_invalid_bytes(self):
        """Invalid bytes that can't be decoded raise ValueError."""
        from src.utils.image import decode_frame
        with pytest.raises(ValueError, match="Failed to decode"):
            # Valid numpy array but cv2.imdecode returns None for garbage
            mock_cv2 = MagicMock()
            mock_cv2.IMREAD_COLOR = 1
            mock_cv2.imdecode.return_value = None
            import numpy as np
            with patch.dict("sys.modules", {"cv2": mock_cv2}):
                decode_frame(b"garbage bytes")

    def test_raises_without_opencv(self):
        """If cv2 is not installed, raises ValueError."""
        # Simulate import error by temporarily removing cv2
        import sys
        original = sys.modules.get("cv2")
        sys.modules["cv2"] = None  # type: ignore
        try:
            from importlib import reload
            import src.utils.image as img_module
            with pytest.raises((ValueError, ImportError)):
                img_module.decode_frame(b"\xff\xd8\xff")
        finally:
            if original is None:
                sys.modules.pop("cv2", None)
            else:
                sys.modules["cv2"] = original

    def test_decode_success(self):
        """Successful decode returns (frame, width, height)."""
        import numpy as np
        mock_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        mock_cv2 = MagicMock()
        mock_cv2.IMREAD_COLOR = 1
        mock_cv2.imdecode.return_value = mock_frame

        with patch.dict("sys.modules", {"cv2": mock_cv2}):
            from importlib import reload
            import src.utils.image as img_module
            reload(img_module)
            frame, w, h = img_module.decode_frame(b"\xff\xd8\xff")
            assert w == 640
            assert h == 480
