"""Read-only views of existing engine inputs and per-severity outputs (Step 5).

Every number is read from engine data files or returned by unmodified engine functions:
risk_model.load_scenarios/load_recovery/load_clinical/load_losses, bottom_up.breakdown/drivers,
portfolio_model.tri_mean and audit.audit(). Nothing here changes or re-implements a calculation.
"""
from __future__ import annotations

from typing import Any

from .engine_bridge import DATA_DIR, bottom_up, engine_audit, portfolio_model, risk_model
from .serialization import read_csv_records

SEVERITIES = ("contained", "major", "severe")

# Engine stage order and conditional denominators (engine/risk_model.Scenario, portfolio_model.expected_metrics).
STAGE_DEFINITIONS = (
    ("initial_access", "access", "p_initial_access_given_attempt", "relevant attempt"),
    ("deployment", "deployment", "p_ransomware_deployment_given_access", "initial access"),
    ("major_spread", "spread", "p_major_spread_given_deployment", "ransomware deployment"),
    ("severe_given_major_spread", "severe_given_spread", "p_severe_given_major_spread", "major spread"),
)

STAGE_MODEL_NOTE = (
    "Each probability is conditional on the previous stage. The analytic engine uses the triangular mean "
    "(low + mode + high) / 3; Monte Carlo 'central' mode uses the same means, 'epistemic_draw' samples them. "
    "Severity given deployment follows the stage branches: contained = no major spread; "
    "major = major spread without severe escalation; severe = major spread with severe escalation."
)

SEVERITY_PROBABILITY_NOTE = (
    "conditional_probability_given_disruptive_event in severity_parameters.csv is descriptive only; "
    "the engine derives severity from the stage branches (see attack_stage_model.severity_branch_weights_given_deployment)."
)


def _tri(t: Any) -> dict[str, float]:
    return {"low": t.low, "mode": t.mode, "high": t.high, "triangular_mean": portfolio_model.tri_mean(t)}


def attack_stage_model() -> list[dict[str, Any]]:
    """Per-scenario stage probabilities from the engine loader, with audit-derived severity branches."""
    audit_by_id = {s["scenario_id"]: s for s in engine_audit.audit()["scenarios"]}
    result = []
    for scenario in risk_model.load_scenarios():
        audit_row = audit_by_id.get(scenario.id, {})
        stages = []
        for key, attr, parameter_id, conditional_on in STAGE_DEFINITIONS:
            stages.append({
                "stage": key,
                "parameter_id": parameter_id,
                "conditional_on": conditional_on,
                **_tri(getattr(scenario, attr)),
            })
        result.append({
            "scenario_id": scenario.id,
            "relevant_attempts_per_year": scenario.attempts_per_year,
            "stages": stages,
            "expected_deployments_per_year": audit_row.get("expected_deployments_per_year"),
            "severity_branch_weights_given_deployment": audit_row.get("severity_weights_given_deployment"),
            # FAIR-style magnitude and annualized contribution for this scenario (audit.audit, analytic).
            "mean_loss_per_deployment_usd": audit_row.get("mean_loss_per_deployment_usd"),
            "expected_annual_loss_contribution_usd": audit_row.get("expected_annual_loss_contribution_usd"),
            "source": "engine.risk_model.load_scenarios + audit.audit (analytic triangular means)",
        })
    return result


def hospital_extension() -> dict[str, Any]:
    """New, additive /api/hospital fields."""
    return {
        "attack_stage_parameters": read_csv_records(DATA_DIR / "risk_parameters.csv"),
        "attack_stage_model": attack_stage_model(),
        "attack_stage_model_note": STAGE_MODEL_NOTE,
        "severity_parameters": read_csv_records(DATA_DIR / "severity_parameters.csv"),
        "severity_parameters_note": SEVERITY_PROBABILITY_NOTE,
        "clinical_reputation_indicators": read_csv_records(DATA_DIR / "clinical_reputation_indicators.csv"),
    }


def severity_details() -> dict[str, Any]:
    """Per-severity incident view: bottom-up breakdown, loss ranges, expected loss, recovery, clinical indicators."""
    drivers = bottom_up.drivers()
    losses = risk_model.load_losses()
    recovery = risk_model.load_recovery()
    clinical = risk_model.load_clinical()
    audit_losses = engine_audit.audit()["loss_components_by_severity"]
    severity_rows = {r["severity_id"]: r for r in read_csv_records(DATA_DIR / "severity_parameters.csv")}
    clinical_rows = {r["severity_id"]: r for r in read_csv_records(DATA_DIR / "clinical_reputation_indicators.csv")}

    items = []
    for severity in SEVERITIES:
        items.append({
            "severity": severity,
            "bottom_up_breakdown": bottom_up.breakdown(severity),
            "cost_drivers": drivers["severity"].get(severity, {}),
            "loss_distribution_usd": {k: _tri(t) for k, t in losses[severity].items()},
            "expected_loss_per_incident": audit_losses.get(severity),
            "recovery_days": _tri(recovery[severity]),
            "clinical_indicators": {k: _tri(t) for k, t in clinical[severity].items()},
            "source_severity_parameters": severity_rows.get(severity),
            "source_clinical_reputation_indicators": clinical_rows.get(severity),
        })
    return {
        "severities": items,
        "loss_variability": drivers.get("loss_variability", {}),
        "cost_driver_metadata": drivers.get("metadata", {}),
        "unit_rates": drivers.get("unit_rates", {}),
        "severity_parameters_note": SEVERITY_PROBABILITY_NOTE,
        "notes": [
            "Loss amounts depend on incident severity only; they are not calibrated separately for each attack scenario.",
            "bottom_up_breakdown.components_usd are central formula estimates and serve as the mode of each triangular loss distribution.",
            "expected_loss_per_incident applies the triangular mean and the notification data-exposure probability (audit.audit).",
            "Clinical indicators (diverted patients, delayed appointments, trust index) are non-financial and are not monetized.",
            "Monte Carlo couples interruption, continuity and overtime costs to the sampled recovery duration; these per-incident figures use central durations.",
        ],
    }
