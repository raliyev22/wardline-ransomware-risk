"""Annual ransomware risk simulation, baseline only (no investment effects yet)."""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .risk_model import Triangular, load_scenarios, load_losses, load_recovery, load_clinical


def sample_tri(rng, spec: Triangular, size: int):
    return rng.triangular(spec.low, spec.mode, spec.high, size=size)


@dataclass
class Results:
    years: int
    seed: int
    mean_annual_loss_usd: float
    median_annual_loss_usd: float
    p90_annual_loss_usd: float
    p95_annual_loss_usd: float
    probability_any_disruptive_event: float
    expected_disruptive_events_per_year: float
    mean_annual_recovery_days: float
    mean_annual_diverted_patients: float
    mean_annual_delayed_appointments: float
    mean_annual_reputation_loss_usd: float
    severity_counts: dict
    scenario_deployments_per_year: dict
    note: str


def simulate(years: int = 20000, seed: int = 2026) -> Results:
    if years < 1:
        raise ValueError("years must be positive")
    rng = np.random.default_rng(seed)
    scenarios = load_scenarios()
    losses = load_losses()
    recovery = load_recovery()
    clinical = load_clinical()

    annual_loss = np.zeros(years)
    annual_events = np.zeros(years, dtype=int)
    annual_days = np.zeros(years)
    annual_diverted = np.zeros(years)
    annual_delayed = np.zeros(years)
    annual_reputation = np.zeros(years)
    severity_counts = {"contained": 0, "major": 0, "severe": 0}
    deployments = {}

    for scenario in scenarios:
        # Epistemic uncertainty: sample one set of scenario probabilities for the
        # full simulation run. Within each year, attempts/outcomes are stochastic.
        # For sensitivity analyses, rerun with different uncertainty draws/seeds.
        p_access = float(sample_tri(rng, scenario.access, 1)[0])
        p_deploy = float(sample_tri(rng, scenario.deployment, 1)[0])
        p_spread = float(sample_tri(rng, scenario.spread, 1)[0])
        p_severe = float(sample_tri(rng, scenario.severe_given_spread, 1)[0])

        # Poisson thinning gives number of deployments directly without
        # allocating potentially large individual attempt arrays.
        count = rng.poisson(scenario.attempts_per_year * p_access * p_deploy, size=years)
        deployments[scenario.id] = float(count.mean())
        total = int(count.sum())
        if total == 0:
            continue
        year_index = np.repeat(np.arange(years), count)
        spread = rng.random(total) < p_spread
        severe = spread & (rng.random(total) < p_severe)
        # Explicit resolution of the inconsistent Package 2/3 severity assumptions:
        # deployment without major spread -> contained;
        # spread without severe escalation -> major; severe escalation -> severe.
        # Package 3 categorical severity weights are NOT applied a second time.
        severity = np.where(severe, "severe", np.where(spread, "major", "contained"))
        annual_events += count
        for level in severity_counts:
            idx = year_index[severity == level]
            n = len(idx)
            severity_counts[level] += n
            if not n:
                continue
            cost = np.zeros(n)
            reputation = np.zeros(n)
            for component, distribution in losses[level].items():
                values = sample_tri(rng, distribution, n)
                if component == "notification":
                    # Data exposure is NOT guaranteed by encryption.
                    # Explicit illustrative gate; to be parameterized later.
                    p_exposure = {"contained": 0.08, "major": 0.30, "severe": 0.55}[level]
                    values *= rng.random(n) < p_exposure
                if component == "legal":
                    # Legal cost includes non-breach counsel; not a mandatory fine.
                    pass
                if component == "reputation":
                    reputation += values
                cost += values
            np.add.at(annual_loss, idx, cost)
            np.add.at(annual_reputation, idx, reputation)
            np.add.at(annual_days, idx, sample_tri(rng, recovery[level], n))
            np.add.at(annual_diverted, idx, sample_tri(rng, clinical[level]["diverted_patients"], n))
            np.add.at(annual_delayed, idx, sample_tri(rng, clinical[level]["delayed_appointments"], n))

    return Results(
        years, seed, float(annual_loss.mean()), float(np.median(annual_loss)),
        float(np.quantile(annual_loss, .90)), float(np.quantile(annual_loss, .95)),
        float(np.mean(annual_events > 0)), float(annual_events.mean()),
        float(annual_days.mean()), float(annual_diverted.mean()),
        float(annual_delayed.mean()), float(annual_reputation.mean()),
        severity_counts, deployments,
        "Synthetic baseline; severity is determined by attack-stage branches, not Package 3 severity weights. No investment effects yet."
    )
