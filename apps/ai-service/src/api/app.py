"""FastAPI application factory."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from src.detection.detector import PrintFailureDetector, DetectionResult

log = logging.getLogger(__name__)


def create_app(detector: Optional[PrintFailureDetector] = None) -> FastAPI:
    """Create and configure the FastAPI app.

    detector can be injected for testing; otherwise a default is created.
    """
    app = FastAPI(title="PrintFarm AI Service", version="0.1.0")

    # Inject detector into app state
    _detector = detector or PrintFailureDetector()
    app.state.detector = _detector

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "modelLoaded": app.state.detector.is_loaded,
        }

    @app.post("/detect")
    async def detect(frame: UploadFile = File(...)):
        jpeg_bytes = await frame.read()
        try:
            result: DetectionResult = app.state.detector.detect(jpeg_bytes)
        except Exception as e:
            log.error("Detection error: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

        return JSONResponse(content=result.to_dict())

    return app
