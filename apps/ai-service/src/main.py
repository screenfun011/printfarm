"""AI Service entry point."""
from __future__ import annotations

import logging
import os

import uvicorn
from dotenv import load_dotenv

load_dotenv()

from src.api.app import create_app
from src.detection.detector import PrintFailureDetector

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

MODEL_PATH = os.environ.get("MODEL_PATH", "models/printfarm.pt")
PORT = int(os.environ.get("PORT", "8000"))

detector = PrintFailureDetector(model_path=MODEL_PATH if os.path.exists(MODEL_PATH) else None)
if not detector.is_loaded:
    log.warning("No model loaded — running in passthrough mode (all detections → no failure)")

app = create_app(detector=detector)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
