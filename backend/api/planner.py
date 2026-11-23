"""Investment Planner support built only from existing engine functions.

- optimize_for_budget: portfolio_model.optimize() at the engine budget; for a lower user budget,
  the same enumeration (investments.feasible_portfolios), scoring (portfolio_model.expected_metrics,
  investments.spending) and selection rule as optimize(), restricted to first-year cash <= budget.
- effect_breakdown: explains investments.effects() (strongest-only overlap) using control_effectiveness.csv.
- marginals: "if added / if removed" deltas computed by calling expected_metrics/spending on each variant.

No engine file is modified and no risk formula is re-implemented.
"""
from __future__ import annotations

from typing import Any, Optional, Sequence

from .engine_bridge import investments, portfolio_model

EPS_USD = 0.01


class NoEligiblePortfolio(Exception):
    def __init__(self, detail: dict[str, Any]):
        super().__init__(detail["message"])
        self.detail = detail


class BudgetError(ValueError):
    pass


def engine_budget() -> float:
    return float(investments.config()["budget_first_year_cash_usd"])


def resolve_budget(budget_usd: Optional[float]) -> float:
    cap = engine_budget()
    if budget_usd is None:
        return cap
    if budget_usd > cap + EPS_USD:
        raise BudgetError(
            f"Selected budget ${budget_usd:,.0f} exceeds the engine's first-year cash budget of ${cap:,.0f}; "
            "the v8 engine cannot evaluate larger budgets."
        )
    return float(budget_usd)


def budget_info(budget_usd: float, first_year_cash: Optional[float] = None) -> dict[str, Any]:
    info: dict[str, Any] = {
        "selected_budget_usd": budget_usd,
        "engine_budget_usd": engine_budget(),
        "is_engine_budget": abs(budget_usd - engine_budget()) <= EPS_USD,
    }
    if first_year_cash is not None:
        info["first_year_cash_usd"] = first_year_cash
        info["remaining_usd"] = budget_usd - first_year_cash
        info["within_selected_budget"] = first_year_cash <= budget_usd + EPS_USD
    return info


def _guard_ok(metrics: dict, baseline: dict, guard: dict) -> bool:
    # Identical comparison to portfolio_model.optimize().
    return (
        metrics["expected_annual_diverted_patients"]
        <= baseline["expected_annual_diverted_patients"] * guard["max_annual_diverted_patients_fraction_of_baseline"]
        and metrics["expected_annual_recovery_days"]
        <= baseline["expected_annual_recovery_days"] * guard["max_annual_recovery_days_fraction_of_baseline"]
    )


def optimize_for_budget(budget_usd: Optional[float], risk_scale: float = 1.0, loss_scale: float = 1.0,
                        efficacy_scale: float = 1.0) -> dict[str, Any]:
    """Return a dict shaped like portfolio_model.optimize() plus budget information.

    Raises NoEligiblePortfolio when nothing satisfies budget, dependency and clinical guardrails.
    """
    budget = resolve_budget(budget_usd)
    if abs(budget - engine_budget()) <= EPS_USD:
        try:
            result = portfolio_model.optimize(risk_scale, loss_scale, efficacy_scale)
        except ValueError as exc:  # engine: 'No portfolio satisfies budget and clinical guardrails'
            raise NoEligiblePortfolio({
                "error": "no_eligible_portfolio", "message": str(exc), "budget_usd": budget,
            }) from exc
        return {**result, "budget": budget_info(budget), "status": "optimal"}
    return optimize_by_enumeration(budget, risk_scale, loss_scale, efficacy_scale)


def optimize_by_enumeration(budget: float, risk_scale: float = 1.0, loss_scale: float = 1.0,
                            efficacy_scale: float = 1.0) -> dict[str, Any]:
    """optimize()'s enumeration, scoring, guardrails and tie-break, restricted to first-year cash <= budget.

    Tested to reproduce portfolio_model.optimize() exactly at the engine budget.
    """
    stress = (risk_scale, loss_scale, efficacy_scale)
    baseline = portfolio_model.expected_metrics((), *stress)
    base_loss = baseline["expected_annual_loss_usd"]
    guard = portfolio_model.config_clinical_guardrails()
    scored, within_budget, min_eligible_cash = [], 0, None
    for selected in investments.feasible_portfolios():
        costs = investments.spending(selected)
        metrics = portfolio_model.expected_metrics(selected, *stress)
        eligible_any_budget = _guard_ok(metrics, baseline, guard)
        if eligible_any_budget:
            cash = costs["first_year_cash_usd"]
            min_eligible_cash = cash if min_eligible_cash is None else min(min_eligible_cash, cash)
        if costs["first_year_cash_usd"] > budget + EPS_USD:
            continue
        within_budget += 1
        benefit = base_loss - metrics["expected_annual_loss_usd"]
        scored.append((benefit - costs["annualized_spend_usd"], selected, metrics, costs, benefit, eligible_any_budget))
    eligible = [row for row in scored if row[5]]
    if not eligible:
        msg = (
            f"No investment portfolio within ${budget:,.0f} satisfies the dependency rules and the clinical guardrails "
            f"(diverted patients <= {guard['max_annual_diverted_patients_fraction_of_baseline']:.0%} and recovery days <= "
            f"{guard['max_annual_recovery_days_fraction_of_baseline']:.0%} of baseline)."
        )
        if min_eligible_cash is not None:
            msg += f" The lowest first-year cash of any eligible portfolio is ${min_eligible_cash:,.0f}."
        raise NoEligiblePortfolio({
            "error": "no_eligible_portfolio",
            "message": msg,
            "budget_usd": budget,
            "portfolios_within_budget": within_budget,
            "min_first_year_cash_for_eligible_portfolio_usd": min_eligible_cash,
            "clinical_guardrails": guard,
        })
    # Same tie-break as portfolio_model.optimize(): highest net, then lower first-year cash, then IDs.
    best = max(eligible, key=lambda row: (row[0], -row[3]["first_year_cash_usd"], row[1]))
    return {
        "evaluated_feasible_portfolios": within_budget,
        "clinical_eligible_portfolios": len(eligible),
        "clinical_guardrails": guard,
        "selected_investments": list(best[1]),
        "expected_annual_loss_usd": best[2]["expected_annual_loss_usd"],
        "expected_annual_avoided_loss_usd": best[4],
        "expected_annual_net_benefit_usd": best[0],
        **best[3],
        "baseline_expected_annual_loss_usd": base_loss,
        "method": (
            "exhaustive enumeration of engine-feasible binary portfolios with first-year cash <= selected budget, "
            "scored with portfolio_model.expected_metrics and investments.spending; same guardrails and tie-break as "
            "portfolio_model.optimize"
        ),
        "budget": budget_info(budget),
        "status": "optimal",
    }


# ---------- overlap explanation ----------

def _effect_rows() -> list[dict]:
    return list(investments.rows("control_effectiveness.csv"))


def effect_breakdown(selected: Sequence[str]) -> dict[str, Any]:
    """Applied effects from investments.effects(), annotated with which selected investments contribute.

    Each entry lists every contributing investment's assumed reduction and which one the engine applies
    (strongest only). Superseded contributions add nothing; this is how double counting is avoided.
    """
    selected = tuple(selected)
    stage, recovery, iomt = investments.effects(selected)
    groups: dict[tuple[str, str], list[dict]] = {}
    for r in _effect_rows():
        if r["investment_id"] not in selected:
            continue
        groups.setdefault((r["scenario_id"], r["affected_metric"]), []).append(
            {"investment_id": r["investment_id"], "assumed_relative_reduction": min(1.0, float(r["target_relative_reduction"]))}
        )
    applied_value = {("recovery_days",): recovery, ("iomt_disruption",): iomt}
    entries = []
    for (scenario, metric), contribs in sorted(groups.items()):
        value = applied_value.get((metric,), stage.get((scenario, metric), 0.0))
        applied = [c["investment_id"] for c in contribs if abs(c["assumed_relative_reduction"] - value) < 1e-12]
        superseded = [c["investment_id"] for c in contribs if c["investment_id"] not in applied]
        entries.append({
            "scenario_id": scenario,
            "affected_metric": metric,
            "applied_relative_reduction": value,
            "contributions": contribs,
            "applied_investments": applied,
            "superseded_investments": superseded,
            "overlap": len(contribs) > 1,
        })
    return {
        "rule": investments.config().get("effect_rule", {}).get("overlap", "strongest reduction only"),
        "entries": entries,
        "overlaps": [e for e in entries if e["overlap"]],
        "recovery_days_reduction": recovery,
        "iomt_disruption_reduction": iomt,
    }


# ---------- marginal changes ----------

def _net(metrics: dict, costs: dict, base_loss: float) -> float:
    return base_loss - metrics["expected_annual_loss_usd"] - costs["annualized_spend_usd"]


def marginals(selected: Sequence[str], budget: float) -> dict[str, Any]:
    """For each catalog investment, the engine result of adding it to (or removing it from) the selection."""
    current = tuple(selected)
    baseline = portfolio_model.expected_metrics(())
    base_loss = baseline["expected_annual_loss_usd"]
    guard = portfolio_model.config_clinical_guardrails()
    cur_metrics = portfolio_model.expected_metrics(current)
    cur_costs = investments.spending(current)
    cur_net = _net(cur_metrics, cur_costs, base_loss)
    cur_effects = {(e["scenario_id"], e["affected_metric"]): e for e in effect_breakdown(current)["entries"]}

    items = []
    for inv_id in sorted(investments.investments()):
        action = "remove" if inv_id in current else "add"
        candidate = tuple(i for i in current if i != inv_id) if action == "remove" else current + (inv_id,)
        item: dict[str, Any] = {"investment_id": inv_id, "action": action}
        try:
            candidate = investments.validate_portfolio(list(candidate))
        except ValueError as exc:
            items.append({**item, "valid": False, "reason": str(exc)})
            continue
        metrics = portfolio_model.expected_metrics(candidate)
        costs = investments.spending(candidate)
        loss_change = metrics["expected_annual_loss_usd"] - cur_metrics["expected_annual_loss_usd"]
        overlaps = []
        if action == "add":
            for e in effect_breakdown(candidate)["entries"]:
                ids = [c["investment_id"] for c in e["contributions"]]
                if inv_id in ids and e["overlap"]:
                    overlaps.append({
                        "scenario_id": e["scenario_id"],
                        "affected_metric": e["affected_metric"],
                        "applied_investments": e["applied_investments"],
                        "superseded_investments": e["superseded_investments"],
                        "previously_applied": cur_effects.get((e["scenario_id"], e["affected_metric"]), {}).get("applied_investments", []),
                    })
        items.append({
            **item,
            "valid": True,
            "resulting_investments": list(candidate),
            "expected_annual_loss_change_usd": loss_change,
            "expected_annual_net_benefit_change_usd": _net(metrics, costs, base_loss) - cur_net,
            "first_year_cash_change_usd": costs["first_year_cash_usd"] - cur_costs["first_year_cash_usd"],
            "resulting_first_year_cash_usd": costs["first_year_cash_usd"],
            "within_selected_budget": costs["first_year_cash_usd"] <= budget + EPS_USD,
            "resulting_guardrails_satisfied": _guard_ok(metrics, baseline, guard),
            "no_additional_effect": action == "add" and abs(loss_change) < EPS_USD,
            "overlaps": overlaps,
        })
    return {
        "investment_ids": list(current),
        "current_expected_annual_loss_usd": cur_metrics["expected_annual_loss_usd"],
        "current_first_year_cash_usd": cur_costs["first_year_cash_usd"],
        "budget": budget_info(budget, cur_costs["first_year_cash_usd"]),
        "items": items,
    }
