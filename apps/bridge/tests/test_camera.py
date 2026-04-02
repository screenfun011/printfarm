"""Tests for CameraStream — frame capture from RTSP."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.camera.stream import CameraStream


@pytest.fixture
def stream():
    on_frame = AsyncMock()
    return CameraStream(
        ip="192.168.1.10",
        device_id="device-uuid",
        on_frame=on_frame,
        interval=0.01,  # fast for tests
    )


class TestCameraStream:
    def test_rtsp_url_format(self, stream):
        url = CameraStream.RTSP_URL_TEMPLATE.format(ip=stream._ip)
        assert "192.168.1.10" in url
        assert url.startswith("rtsps://")

    def test_default_interval(self):
        cam = CameraStream(ip="1.2.3.4", device_id="x", on_frame=AsyncMock())
        assert cam._interval == CameraStream.FRAME_INTERVAL_SECONDS

    def test_capture_frame_no_opencv_returns_none(self):
        """When opencv is not installed, capture returns None gracefully."""
        with patch.dict("sys.modules", {"cv2": None}):
            result = CameraStream._capture_frame("rtsps://1.2.3.4/streaming/live/1")
        assert result is None

    def test_capture_frame_cap_not_opened_returns_none(self):
        mock_cv2 = MagicMock()
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = False
        mock_cv2.VideoCapture.return_value = mock_cap

        with patch.dict("sys.modules", {"cv2": mock_cv2}):
            result = CameraStream._capture_frame("rtsps://1.2.3.4/streaming/live/1")
        assert result is None

    def test_capture_frame_read_fails_returns_none(self):
        mock_cv2 = MagicMock()
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.read.return_value = (False, None)
        mock_cv2.VideoCapture.return_value = mock_cap

        with patch.dict("sys.modules", {"cv2": mock_cv2}):
            result = CameraStream._capture_frame("rtsps://1.2.3.4/streaming/live/1")
        assert result is None

    def test_capture_frame_success_returns_bytes(self):
        mock_cv2 = MagicMock()
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        fake_frame = MagicMock()
        mock_cap.read.return_value = (True, fake_frame)
        mock_cv2.VideoCapture.return_value = mock_cap
        mock_cv2.IMWRITE_JPEG_QUALITY = 1
        mock_cv2.imencode.return_value = (True, MagicMock(tobytes=lambda: b"\xff\xd8jpeg"))

        with patch.dict("sys.modules", {"cv2": mock_cv2}):
            result = CameraStream._capture_frame("rtsps://1.2.3.4/streaming/live/1")
        assert result == b"\xff\xd8jpeg"

    @pytest.mark.asyncio
    async def test_stop_before_start_no_error(self, stream):
        await stream.stop()  # should not raise

    @pytest.mark.asyncio
    async def test_start_and_stop(self, stream):
        with patch.object(CameraStream, "_capture_frame", return_value=None):
            await stream.start()
            assert stream._task is not None
            assert not stream._task.done()
            await stream.stop()
            assert stream._task.cancelled() or stream._task.done()

    @pytest.mark.asyncio
    async def test_loop_exception_does_not_crash(self, stream):
        """Errors in capture should be caught; stream keeps running."""
        call_count = 0

        async def bad_on_frame(device_id, frame):
            raise RuntimeError("oh no")

        stream._on_frame = bad_on_frame

        with patch.object(CameraStream, "_capture_frame", return_value=b"\xff\xd8fake"):
            await stream.start()
            await asyncio.sleep(0.05)  # let loop run a few times
            await stream.stop()
