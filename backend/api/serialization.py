"""JSON-safe conversion of engine outputs and loaders for display-only source data."""
from __future__ import annotations

import csv
import dataclasses
import json
import math
from pathlib import Path
from typing import Any

import numpy as np


def to_jsonable(value: Any) -> Any:
    """Recursively convert engine results (numpy scalars, tuples, dataclasses) to JSON types.

    Non-finite floats become ``None`` because JSON has no NaN/Infinity.
    """
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return to_jsonable(dataclasses.asdict(value))
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, np.ndarray):
        return to_jsonable(value.tolist())
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, (float, np.floating)):
        f = float(value)
        return f if math.isfinite(f) else None
    return value


def _coerce_cell(text: str) -> Any:
    """Type a CSV cell without changing its meaning: '' -> None, numbers, true/false.

    Other text (IDs, names, semicolon-separated ID lists) is returned exactly as in the source.
    """
    if text == "":
        return None
    lowered = text.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    try:
        return int(text)
    except ValueError:
        pass
    try:
        number = float(text)
    except ValueError:
        return text
    return number if math.isfinite(number) else text


def read_csv_records(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return [{k: _coerce_cell(v) for k, v in row.items()} for row in csv.DictReader(handle)]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
