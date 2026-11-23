"""Summaries of the actual paired Monte Carlo draws and local run history."""
from contextlib import closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3

import numpy as np

from .engine_bridge import investments
from .planner import budget_info

LOSS_THRESHOLDS = [500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000]
LOSS_HORIZONS = (1, 2, 3, 5, 10, 15, 20, 25, 30, 50)
DEFAULT_DATABASE = Path(__file__).resolve().parents[1] / ".local" / "dashboard.sqlite3"


def summarize_periods(annual_loss, annual_count):
    horizons = {}
    for years in LOSS_HORIZONS:
        periods = len(annual_loss) // years
        if not periods:
            continue
        # Independent, non-overlapping blocks. A partial last block has no comparable total.
        stop = periods * years
        losses = annual_loss[:stop].reshape(periods, years).sum(axis=1)
        incidents = annual_count[:stop].reshape(periods, years).sum(axis=1)
        positive = losses[losses > 0]
        bins = np.bincount(np.searchsorted(LOSS_THRESHOLDS, positive, side="right"),
                           minlength=len(LOSS_THRESHOLDS) + 1)
        median, p90, p95 = np.quantile(losses, [0.50, 0.90, 0.95])
        horizons[years] = {
            "periods": periods,
            "mean_loss_usd": float(losses.mean()),
            "median_loss_usd": float(median),
            "p90_loss_usd": float(p90),
            "p95_loss_usd": float(p95),
            "loss_counts": [int(np.count_nonzero(losses == 0)), *bins.tolist()],
            "incident_counts": np.bincount(np.minimum(incidents, 3), minlength=4).tolist(),
        }
    return horizons


def _connect():
    path = Path(os.environ.get("WARDLINE_RUN_DATABASE") or DEFAULT_DATABASE)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, completed_at TEXT NOT NULL, years INTEGER NOT NULL,
        seed INTEGER NOT NULL, uncertainty_mode TEXT NOT NULL, report TEXT NOT NULL
    )""")
    return conn


def save_run(result, horizons):
    simulated = result["simulated"]
    summary = {"completed_at": datetime.now(timezone.utc).isoformat(), "years": simulated["years"],
               "seed": simulated["seed"], "uncertainty_mode": simulated["uncertainty_mode"]}
    strategies = {}
    for key, ids in result["portfolios"].items():
        metrics = result["analytic"][f"{key}_metrics"]
        frequency = metrics["expected_events_per_year"]
        loss = metrics["expected_annual_loss_usd"]
        strategies[key] = {
            "investments": ids, "events_per_year": frequency,
            "mean_loss_per_event_usd": loss / frequency if frequency else None,
            "expected_annual_loss_usd": loss, "horizons": horizons[key],
        }
    report = {"budget_usd": result["budget"]["selected_budget_usd"],
              "loss_thresholds_usd": LOSS_THRESHOLDS, "strategies": strategies}
    report.update(_saved_plan_budget(result["budget"]))
    with closing(_connect()) as conn, conn:
        cursor = conn.execute("""INSERT INTO runs (completed_at, years, seed, uncertainty_mode, report)
            VALUES (:completed_at, :years, :seed, :uncertainty_mode, :report)""",
            {**summary, "report": json.dumps(report, allow_nan=False, separators=(",", ":"))})
        run_id = cursor.lastrowid
    return {"id": run_id, **summary, **report}


def list_runs():
    with closing(_connect()) as conn:
        return [dict(row) for row in conn.execute(
            "SELECT id, completed_at, years, seed, uncertainty_mode FROM runs ORDER BY id DESC")]


def read_run(run_id):
    with closing(_connect()) as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    record = dict(row)
    report = json.loads(record.pop("report"))
    if "ciso_first_year_cash_usd" not in report:
        # Older runs saved the selected investment IDs but omitted their cost.
        try:
            cost = investments.spending(report["strategies"]["ciso"]["investments"])["first_year_cash_usd"]
        except KeyError:
            pass  # A historical investment may no longer be in the catalog.
        else:
            report.update(_saved_plan_budget(budget_info(report["budget_usd"], cost)))
    return {**record, **report}


def _saved_plan_budget(budget):
    return {
        "ciso_first_year_cash_usd": budget["first_year_cash_usd"],
        "ciso_over_budget_usd": 0 if budget["within_selected_budget"] else -budget["remaining_usd"],
    }
