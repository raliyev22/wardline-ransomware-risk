"""Import the v8 risk engine without modifying it, and expose its data directory.

The engine's modules use absolute imports such as ``from engine.risk_model import ...``
and expect ``backend/risk_engine`` to be on ``sys.path``. Resolving the path from this
file (not the current working directory) lets the API start from the project root or
anywhere else.
"""
from __future__ import annotations

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
BACKEND_DIR = API_DIR.parent
RISK_ENGINE_DIR = BACKEND_DIR / "risk_engine"

if not (RISK_ENGINE_DIR / "engine" / "__init__.py").is_file():
    raise RuntimeError(f"Risk engine package not found at {RISK_ENGINE_DIR}")

if str(RISK_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(RISK_ENGINE_DIR))

from engine import bottom_up, comparison, investments, portfolio_model, risk_model  # noqa: E402
import audit as engine_audit  # noqa: E402  (backend/risk_engine/audit.py, read-only explanation report)
import sensitivity as engine_sensitivity  # noqa: E402  (backend/risk_engine/sensitivity.py; STRESSES only)

# Use the engine's own data directory so API and engine always read the same files.
DATA_DIR: Path = risk_model.DATA

ENGINE_VERSION = "v8"
MODEL_STATUS = "synthetic_illustrative_not_empirically_validated"

__all__ = [
    "API_DIR",
    "BACKEND_DIR",
    "RISK_ENGINE_DIR",
    "DATA_DIR",
    "ENGINE_VERSION",
    "MODEL_STATUS",
    "bottom_up",
    "comparison",
    "engine_audit",
    "engine_sensitivity",
    "investments",
    "portfolio_model",
    "risk_model",
]
