"""Read-only sensitivity views (Risk Analytics).

- stress_tests: the engine's deterministic stress cases (sensitivity.STRESSES) applied to the user's
  portfolio and to the budget-restricted optimum, via portfolio_model.expected_metrics/optimize.
  Multipliers are hypothetical what-if assumptions, not confidence intervals.
- parameter_report: the engine-generated parameter_sensitivity_report.json, served as-is.
  parameter_sensitivity.run() is NOT executed in the server because it temporarily patches engine
  functions in memory, which would be unsafe under concurrent requests. A test verifies the stored
  report equals a fresh run().
"""
from __future__ import annotations

from typing import Any, Sequence

from . import planner
from .engine_bridge import RISK_ENGINE_DIR, engine_sensitivity, investments, portfolio_model
from .serialization import read_json

PARAMETER_REPORT = RISK_ENGINE_DIR / "parameter_sensitivity_report.json"

STRESS_NOTE = (
    "Deterministic what-if multipliers from the engine's sensitivity.py (attack attempt frequency, all incident "
    "financial losses, assumed control effectiveness). They are hypothetical assumptions, not confidence or "
    "credible intervals, and carry no probability."
)


def _guard_ok(metrics: dict, baseline: dict, guard: dict) -> bool:
    return (
        metrics["expected_annual_diverted_patients"]
        <= baseline["expected_annual_diverted_patients"] * guard["max_annual_diverted_patients_fraction_of_baseline"]
        and metrics["expected_annual_recovery_days"]
        <= baseline["expected_annual_recovery_days"] * guard["max_annual_recovery_days_fraction_of_baseline"]
    )


def stress_tests(selected: Sequence[str], budget_usd: float) -> dict[str, Any]:
    selected = tuple(selected)
    guard = portfolio_model.config_clinical_guardrails()
    costs = investments.spending(selected)
    central_opt: list[str] | None = None
    cases = []
    for key, (risk, loss, efficacy) in engine_sensitivity.STRESSES.items():
        base = portfolio_model.expected_metrics((), risk, loss, efficacy)
        mine = portfolio_model.expected_metrics(selected, risk, loss, efficacy)
        avoided = base["expected_annual_loss_usd"] - mine["expected_annual_loss_usd"]
        try:
            opt = planner.optimize_for_budget(budget_usd, risk, loss, efficacy)
            optimized = {
                "status": "optimal",
                "selected_investments": opt["selected_investments"],
                "expected_annual_loss_usd": opt["expected_annual_loss_usd"],
                "expected_annual_net_benefit_usd": opt["expected_annual_net_benefit_usd"],
                "first_year_cash_usd": opt["first_year_cash_usd"],
            }
        except planner.NoEligiblePortfolio as exc:
            optimized = {"status": "no_eligible_portfolio", "message": exc.detail["message"]}
        if key == "central":
            central_opt = optimized.get("selected_investments")
        cases.append({
            "key": key,
            "multipliers": {"attack_attempt_frequency": risk, "incident_financial_losses": loss, "control_effectiveness": efficacy},
            "baseline_metrics": base,
            "portfolio_metrics": mine,
            "portfolio_avoided_loss_usd": avoided,
            "portfolio_net_benefit_usd": avoided - costs["annualized_spend_usd"],
            "portfolio_guardrails_satisfied": _guard_ok(mine, base, guard),
            "optimized": optimized,
        })
    for c in cases:
        sel = c["optimized"].get("selected_investments")
        c["optimized"]["differs_from_central_optimum"] = None if sel is None or central_opt is None else sorted(sel) != sorted(central_opt)
    return {
        "investment_ids": list(selected),
        "portfolio_spending": costs,
        "budget": planner.budget_info(budget_usd, costs["first_year_cash_usd"]),
        "note": STRESS_NOTE,
        "cases": cases,
    }


def parameter_report() -> dict[str, Any]:
    return read_json(PARAMETER_REPORT)
