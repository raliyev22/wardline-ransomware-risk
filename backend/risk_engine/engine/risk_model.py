"""Load and validate synthetic scenario and loss assumptions."""
from __future__ import annotations
import csv
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def rows(filename: str) -> list[dict]:
    with (DATA / filename).open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


@dataclass(frozen=True)
class Triangular:
    low: float
    mode: float
    high: float

    def __post_init__(self):
        if not (self.low <= self.mode <= self.high):
            raise ValueError(f"Invalid triangular parameters: {self}")


@dataclass(frozen=True)
class Scenario:
    id: str
    attempts_per_year: float
    access: Triangular
    deployment: Triangular
    spread: Triangular
    severe_given_spread: Triangular


def load_scenarios() -> list[Scenario]:
    grouped = {}
    for row in rows("risk_parameters.csv"):
        grouped.setdefault(row["scenario_id"], {})[row["parameter_id"]] = row
    result = []
    for sid, params in grouped.items():
        def tri(name):
            r = params[name]
            t = Triangular(float(r["min_value"]), float(r["mode_or_mean"]), float(r["max_value"]))
            if not (0 <= t.low <= t.high <= 1):
                raise ValueError(f"Invalid probability {sid}:{name}")
            return t
        attempts = float(params["annual_relevant_attempts"]["mode_or_mean"])
        if attempts < 0:
            raise ValueError("Negative attempt rate")
        result.append(Scenario(sid, attempts,
            tri("p_initial_access_given_attempt"),
            tri("p_ransomware_deployment_given_access"),
            tri("p_major_spread_given_deployment"),
            tri("p_severe_given_major_spread")))
    return result


def load_legacy_losses():
    """v3 severity lump sums, preserved for side-by-side comparisons."""
    losses = {}
    for row in rows("loss_parameters.csv"):
        losses.setdefault(row["severity_id"], {})[row["component_id"]] = Triangular(
            float(row["min_usd"]), float(row["mode_usd"]), float(row["max_usd"]))
    return losses


def load_losses():
    from .bottom_up import loss_distributions
    return loss_distributions()


def load_recovery():
    return {r["severity_id"]: Triangular(float(r["recovery_days_min"]),
        float(r["recovery_days_mode"]), float(r["recovery_days_max"]))
        for r in rows("severity_parameters.csv")}


def load_clinical():
    result = {}
    for r in rows("clinical_reputation_indicators.csv"):
        result[r["severity_id"]] = {
            "diverted_patients": Triangular(float(r["diverted_patients_min"]), float(r["diverted_patients_mode"]), float(r["diverted_patients_max"])),
            "delayed_appointments": Triangular(float(r["delayed_appointments_min"]), float(r["delayed_appointments_mode"]), float(r["delayed_appointments_max"])),
            "trust_index_drop": Triangular(float(r["trust_index_drop_min"]), float(r["trust_index_drop_mode"]), float(r["trust_index_drop_max"]))
        }
    return result
