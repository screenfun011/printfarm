"""Parse Bambu Lab MQTT report payloads into typed Python dataclasses."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

log = logging.getLogger(__name__)


class PrinterState(str, Enum):
    IDLE = "idle"
    PRINTING = "printing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


_GCODE_STATE_MAP: dict[str, PrinterState] = {
    "IDLE": PrinterState.IDLE,
    "RUNNING": PrinterState.PRINTING,
    "PAUSE": PrinterState.PAUSED,
    "FINISH": PrinterState.COMPLETED,
    "FAILED": PrinterState.FAILED,
}


@dataclass
class PrinterStatus:
    state: PrinterState
    progress: int
    remaining_minutes: int
    layer_current: int
    layer_total: int
    nozzle_temp: float
    nozzle_target: float
    bed_temp: float
    bed_target: float
    subtask_name: str

    def to_dict(self) -> dict:
        return {
            "state": self.state.value,
            "progress": self.progress,
            "remainingMinutes": self.remaining_minutes,
            "layerCurrent": self.layer_current,
            "layerTotal": self.layer_total,
            "nozzleTemp": self.nozzle_temp,
            "nozzleTarget": self.nozzle_target,
            "bedTemp": self.bed_temp,
            "bedTarget": self.bed_target,
            "subtaskName": self.subtask_name,
        }


def parse_report(payload: bytes) -> Optional[PrinterStatus]:
    """Parse a raw MQTT report payload.

    Returns None on parse error or if payload has no 'print' key.
    """
    try:
        data = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        log.debug("Failed to parse MQTT payload: %s", e)
        return None

    if "print" not in data:
        return None

    p = data["print"]
    gcode_state = p.get("gcode_state", "IDLE")
    state = _GCODE_STATE_MAP.get(gcode_state, PrinterState.IDLE)

    return PrinterStatus(
        state=state,
        progress=int(p.get("mc_percent", 0)),
        remaining_minutes=int(p.get("mc_remaining_time", 0)),
        layer_current=int(p.get("layer_num", 0)),
        layer_total=int(p.get("total_layer_num", 0)),
        nozzle_temp=float(p.get("nozzle_temper", 0.0)),
        nozzle_target=float(p.get("nozzle_target_temper", 0.0)),
        bed_temp=float(p.get("bed_temper", 0.0)),
        bed_target=float(p.get("bed_target_temper", 0.0)),
        subtask_name=str(p.get("subtask_name", "")),
    )
