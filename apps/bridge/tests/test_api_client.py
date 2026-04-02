"""Tests for bridge API client — sends status updates to main API."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiohttp import ClientSession

from src.api.client import BridgeApiClient
from src.mqtt.handlers import PrinterStatus, PrinterState


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def status():
    return PrinterStatus(
        state=PrinterState.PRINTING,
        progress=75,
        remaining_minutes=15,
        layer_current=50,
        layer_total=100,
        nozzle_temp=220.0,
        nozzle_target=220.0,
        bed_temp=60.0,
        bed_target=60.0,
        subtask_name="cube.3mf",
    )

@pytest.fixture
def client():
    return BridgeApiClient(api_url="http://localhost:3000", token="bridge-secret")


# ---------------------------------------------------------------------------
# report_status
# ---------------------------------------------------------------------------

class TestReportStatus:
    @pytest.mark.asyncio
    async def test_posts_to_correct_url(self, client, status):
        mock_response = AsyncMock()
        mock_response.status = 200

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_response),
            __aexit__=AsyncMock(return_value=False),
        ))

        with patch.object(client, "_session", mock_session):
            await client.report_status("device-uuid", status)

        call_args = mock_session.post.call_args
        assert "device-uuid" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_includes_auth_header(self, client, status):
        mock_response = AsyncMock()
        mock_response.status = 200

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_response),
            __aexit__=AsyncMock(return_value=False),
        ))

        with patch.object(client, "_session", mock_session):
            await client.report_status("device-uuid", status)

        call_kwargs = mock_session.post.call_args[1]
        assert "headers" in call_kwargs
        assert "bridge-secret" in call_kwargs["headers"].get("Authorization", "")

    @pytest.mark.asyncio
    async def test_payload_contains_state(self, client, status):
        captured_json = {}

        def mock_post(url, **kwargs):
            captured_json.update(kwargs.get("json", {}))
            mock_resp = AsyncMock()
            mock_resp.status = 200
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=mock_resp)
            cm.__aexit__ = AsyncMock(return_value=False)
            return cm

        mock_session = MagicMock()
        mock_session.post = mock_post

        with patch.object(client, "_session", mock_session):
            await client.report_status("device-uuid", status)

        assert captured_json.get("state") == "printing"
        assert captured_json.get("progress") == 75


# ---------------------------------------------------------------------------
# report_ai_frame
# ---------------------------------------------------------------------------

class TestReportAiFrame:
    @pytest.mark.asyncio
    async def test_posts_jpeg_bytes(self, client):
        jpeg_bytes = b"\xff\xd8\xff\xe0fake_jpeg_data"
        mock_response = AsyncMock()
        mock_response.status = 200

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_response),
            __aexit__=AsyncMock(return_value=False),
        ))

        with patch.object(client, "_session", mock_session):
            await client.report_ai_frame("device-uuid", jpeg_bytes)

        assert mock_session.post.called

    @pytest.mark.asyncio
    async def test_ai_frame_includes_device_id(self, client):
        captured_data = {}

        def mock_post(url, **kwargs):
            captured_data["url"] = url
            mock_resp = AsyncMock()
            mock_resp.status = 200
            cm = AsyncMock()
            cm.__aenter__ = AsyncMock(return_value=mock_resp)
            cm.__aexit__ = AsyncMock(return_value=False)
            return cm

        mock_session = MagicMock()
        mock_session.post = mock_post

        jpeg_bytes = b"\xff\xd8\xff\xe0fake"
        with patch.object(client, "_session", mock_session):
            await client.report_ai_frame("device-uuid-xyz", jpeg_bytes)

        assert "device-uuid-xyz" in captured_data.get("url", "")


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_raises_on_non_2xx(self, client, status):
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Internal server error")

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_response),
            __aexit__=AsyncMock(return_value=False),
        ))

        with patch.object(client, "_session", mock_session):
            with pytest.raises(Exception, match="500"):
                await client.report_status("device-uuid", status)

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, client):
        """Client can open and close session."""
        async with client:
            assert client._session is not None
        # After context exit, session is closed
