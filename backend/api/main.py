"""FastAPI service for the v8 risk engine and saved simulation reports.

Run from the project root:
    backend/.venv/bin/uvicorn backend.api.main:app --reload --port 8000

The API validates inputs, calls the engine and aggregates its annual draws for
dashboard reports. All data are synthetic and illustrative.
"""
from __future__ import annotations

from typing import Any, Optional, Sequence

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .engine_bridge import (
    DATA_DIR,
    ENGINE_VERSION,
    MODEL_STATUS,
    RISK_ENGINE_DIR,
    comparison,
    investments,
    portfolio_model,
)
from .schemas import (
    BaselineResponse,
    DashboardRun,
    EvaluateResponse,
    ErrorDetail,
    HealthResponse,
    HospitalResponse,
    InvestmentsResponse,
    MarginalsResponse,
    OptimizeResponse,
    ParameterSensitivityResponse,
    PortfolioRequest,
    RunSummary,
    SeveritiesResponse,
    SimulateResponse,
    SimulationRequest,
    StressTestResponse,
)
from . import dashboard, planner
from .incident_data import hospital_extension, severity_details
from .sensitivity_data import parameter_report, stress_tests
from .serialization import read_csv_records, read_json, to_jsonable

app = FastAPI(
    title="Healthcare Ransomware Decision Support API",
    version="0.1.0",
    description=(
        "Academic decision-support API for a fictional hospital network. "
        "All inputs and outputs are synthetic and illustrative, not validated forecasts."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

HOSPITAL_SOURCES = {
    "hospital_profile": "hospital_profile.json",
    "ransomware_scenarios": "ransomware_scenarios.json",
    "assets": "assets.csv",
    "security_controls": "security_controls.csv",
    "control_stage_mapping": "control_stage_mapping.csv",
    "investment_asset_mapping": "investment_asset_mapping.csv",
    "attack_stage_parameters": "risk_parameters.csv",
    "severity_parameters": "severity_parameters.csv",
    "clinical_reputation_indicators": "clinical_reputation_indicators.csv",
}

ANALYTIC_METHOD = "portfolio_model.expected_metrics: analytic expected values using triangular means"
GUARDRAIL_RULE = (
    "Same rule as portfolio_model.optimize: portfolio value <= baseline value x configured fraction"
)


# ---------- helpers ----------

def _validated(ids: Sequence[str]) -> tuple[str, ...]:
    """Run the engine's own validation; turn its ValueError into an HTTP 400."""
    try:
        return investments.validate_portfolio(list(ids))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(error="invalid_portfolio", message=str(exc),
                               investment_ids=list(ids)).model_dump(),
        ) from exc


def _guardrail_check(metrics: dict, baseline: dict) -> dict:
    guard = investments.config()["optimization"]["clinical_safety"]
    div_frac = guard["max_annual_diverted_patients_fraction_of_baseline"]
    rec_frac = guard["max_annual_recovery_days_fraction_of_baseline"]
    div_limit = baseline["expected_annual_diverted_patients"] * div_frac
    rec_limit = baseline["expected_annual_recovery_days"] * rec_frac
    div_ok = metrics["expected_annual_diverted_patients"] <= div_limit
    rec_ok = metrics["expected_annual_recovery_days"] <= rec_limit
    return {
        "max_annual_diverted_patients_fraction_of_baseline": div_frac,
        "max_annual_recovery_days_fraction_of_baseline": rec_frac,
        "diverted_patients_limit": div_limit,
        "recovery_days_limit": rec_limit,
        "diverted_patients_satisfied": div_ok,
        "recovery_days_satisfied": rec_ok,
        "satisfied": div_ok and rec_ok,
        "rule": GUARDRAIL_RULE,
    }


def _optimization_info(result: dict) -> dict:
    keys = (
        "evaluated_feasible_portfolios", "clinical_eligible_portfolios", "clinical_guardrails",
        "baseline_expected_annual_loss_usd", "expected_annual_loss_usd",
        "expected_annual_avoided_loss_usd", "expected_annual_net_benefit_usd", "method",
    )
    return {k: result[k] for k in keys}


def _derive_dependencies() -> dict[str, dict[str, Any]]:
    """Discover prerequisite rules by asking the engine's validate_portfolio, not by hardcoding.

    An investment that fails validation on its own (for a reason other than budget) is
    paired with each other investment; partners that make it valid are its prerequisites.
    """
    ids = sorted(investments.investments())
    deps: dict[str, dict[str, Any]] = {}
    for inv in ids:
        try:
            investments.validate_portfolio([inv])
            continue
        except ValueError as exc:
            message = str(exc)
        requires = []
        for other in ids:
            if other == inv:
                continue
            try:
                investments.validate_portfolio([inv, other])
                requires.append(other)
            except ValueError:
                pass
        deps[inv] = {"investment_id": inv, "requires": requires, "engine_message": message}
    return deps


# ---------- endpoints ----------

@app.get("/api/health", response_model=HealthResponse)
def health() -> dict:
    return {
        "status": "ok",
        "service": "healthcare-ransomware-decision-support-api",
        "engine_version": ENGINE_VERSION,
        "synthetic_model": True,
        "model_status": MODEL_STATUS,
        "engine_path_found": RISK_ENGINE_DIR.is_dir(),
    }


@app.get("/api/hospital", response_model=HospitalResponse)
def hospital() -> dict:
    profile = read_json(DATA_DIR / HOSPITAL_SOURCES["hospital_profile"])
    return to_jsonable({
        "model_status": MODEL_STATUS,
        "data_status": profile.get("data_status", "synthetic_illustrative"),
        "sources": {k: f"backend/risk_engine/data/{v}" for k, v in HOSPITAL_SOURCES.items()},
        "hospital_profile": profile,
        "ransomware_scenarios": read_json(DATA_DIR / HOSPITAL_SOURCES["ransomware_scenarios"]),
        "assets": read_csv_records(DATA_DIR / HOSPITAL_SOURCES["assets"]),
        "security_controls": read_csv_records(DATA_DIR / HOSPITAL_SOURCES["security_controls"]),
        "mappings": {
            "control_stage_mapping": read_csv_records(DATA_DIR / HOSPITAL_SOURCES["control_stage_mapping"]),
            "investment_asset_mapping": read_csv_records(DATA_DIR / HOSPITAL_SOURCES["investment_asset_mapping"]),
        },
        **hospital_extension(),
    })


@app.get("/api/incidents/severities", response_model=SeveritiesResponse)
def incident_severities() -> dict:
    return to_jsonable({
        "result_type": "engine_per_incident_by_severity",
        "model_status": MODEL_STATUS,
        "method": (
            "bottom_up.breakdown(severity) for central cost estimates; risk_model.load_losses/load_recovery/"
            "load_clinical for triangular ranges; audit.audit() for expected loss per incident"
        ),
        **severity_details(),
    })


@app.get("/api/investments", response_model=InvestmentsResponse)
def investment_catalog() -> dict:
    catalog = investments.investments()
    cfg = investments.config()
    deps = _derive_dependencies()
    source = {r["investment_id"]: r for r in read_csv_records(DATA_DIR / "security_investments.csv")}
    items = []
    for inv_id in sorted(catalog):
        inv = catalog[inv_id]
        cost = investments.spending([inv_id])
        items.append({
            "id": inv.id,
            "name": inv.name,
            "capex_usd": inv.capex,
            "annual_opex_usd": inv.annual_opex,
            "first_year_cash_usd": cost["first_year_cash_usd"],
            "annualized_spend_usd": cost["annualized_spend_usd"],
            "requires": deps.get(inv_id, {}).get("requires", []),
            "source_record": source.get(inv_id, {}),
        })
    return to_jsonable({
        "model_status": MODEL_STATUS,
        "currency": cfg.get("currency", "USD"),
        "budget": {
            "budget_first_year_cash_usd": cfg["budget_first_year_cash_usd"],
            "budget_capex_usd": cfg.get("budget_capex_usd"),
            "budget_horizon_months": cfg.get("budget_horizon_months"),
            "cost_convention": cfg.get("cost_convention", {}),
        },
        "clinical_constraints": cfg["optimization"]["clinical_safety"],
        "constraints": cfg["optimization"].get("constraints", []),
        "dependencies": list(deps.values()),
        "investments": items,
        "control_effectiveness": read_csv_records(DATA_DIR / "control_effectiveness.csv"),
        "config": cfg,
    })


@app.get("/api/risk/baseline", response_model=BaselineResponse)
def risk_baseline() -> dict:
    return to_jsonable({
        "result_type": "analytic",
        "model_status": MODEL_STATUS,
        "method": ANALYTIC_METHOD,
        "investment_ids": [],
        "metrics": portfolio_model.expected_metrics(selected=()),
    })


def _budget(budget_usd: Optional[float]) -> float:
    try:
        return planner.resolve_budget(budget_usd)
    except planner.BudgetError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_budget", "message": str(exc),
                                                     "budget_usd": budget_usd}) from exc


@app.post("/api/portfolio/evaluate", response_model=EvaluateResponse,
          responses={400: {"model": ErrorDetail}})
def evaluate_portfolio(request: PortfolioRequest) -> dict:
    selected = _validated(request.investment_ids)
    budget = _budget(request.budget_usd)
    baseline = portfolio_model.expected_metrics(selected=())
    metrics = portfolio_model.expected_metrics(selected=selected)
    cost = investments.spending(selected)
    avoided = baseline["expected_annual_loss_usd"] - metrics["expected_annual_loss_usd"]
    return to_jsonable({
        "result_type": "analytic",
        "model_status": MODEL_STATUS,
        "method": ANALYTIC_METHOD + "; net benefit = avoided loss - annualized spend (as in optimize)",
        "investment_ids": list(selected),
        "metrics": metrics,
        "baseline_metrics": baseline,
        "spending": cost,
        "expected_annual_avoided_loss_usd": avoided,
        "expected_annual_net_benefit_usd": avoided - cost["annualized_spend_usd"],
        "clinical_guardrails": _guardrail_check(metrics, baseline),
        "effects": planner.effect_breakdown(selected),
        "budget": planner.budget_info(budget, cost["first_year_cash_usd"]),
    })


@app.post("/api/portfolio/marginals", response_model=MarginalsResponse,
          responses={400: {"model": ErrorDetail}})
def portfolio_marginals(request: PortfolioRequest) -> dict:
    selected = _validated(request.investment_ids)
    budget = _budget(request.budget_usd)
    return to_jsonable({
        "result_type": "analytic",
        "model_status": MODEL_STATUS,
        "method": "Each add/remove variant evaluated with investments.validate_portfolio, "
                  "portfolio_model.expected_metrics and investments.spending; overlaps from investments.effects",
        **planner.marginals(selected, budget),
    })


def _optimum_or_409(budget_usd: Optional[float]) -> dict:
    _budget(budget_usd)
    try:
        return planner.optimize_for_budget(budget_usd)
    except planner.NoEligiblePortfolio as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc


@app.get("/api/portfolio/optimize", response_model=OptimizeResponse,
         responses={400: {"model": ErrorDetail}, 409: {"description": "No eligible portfolio within budget"}})
def optimize_portfolio(budget_usd: Optional[float] = Query(None, gt=0)) -> dict:
    result = _optimum_or_409(budget_usd)
    selected = tuple(result["selected_investments"])
    return to_jsonable({
        "result_type": "analytic",
        "model_status": MODEL_STATUS,
        "selected_investments": list(selected),
        "metrics": portfolio_model.expected_metrics(selected=selected),
        "baseline_metrics": portfolio_model.expected_metrics(selected=()),
        "spending": investments.spending(selected),
        "optimization": _optimization_info(result),
        "status": result["status"],
        "budget": result["budget"],
    })


def _simulate_and_save(request: SimulationRequest) -> tuple[dict, dict]:
    ciso = _validated(request.investment_ids)
    budget = _budget(request.budget_usd)
    try:
        optimum: Optional[dict] = planner.optimize_for_budget(request.budget_usd)
        status, message = "optimal", None
    except planner.NoEligiblePortfolio as exc:
        optimum, status, message = None, "no_eligible_portfolio", exc.detail["message"]
    portfolios: dict[str, tuple] = {"baseline": (), "ciso": ciso}
    if optimum is not None:
        portfolios["optimized"] = tuple(optimum["selected_investments"])
    horizons = {}

    def collect(label, losses, counts):
        horizons[label] = dashboard.summarize_periods(losses, counts)

    mc = comparison.compare(request.years, request.seed, portfolios,
                            uncertainty_mode=request.uncertainty_mode, on_annual_results=collect)
    result = to_jsonable({
        "model_status": MODEL_STATUS,
        "portfolios": {k: list(v) for k, v in portfolios.items()},
        "simulated": {
            "result_type": "simulated_monte_carlo",
            "method": "comparison.compare: paired Monte Carlo with shared random draws across strategies",
            "years": mc["years"],
            "seed": mc["seed"],
            "uncertainty_mode": mc["uncertainty_mode"],
            "note": mc["note"],
            "strategies": mc["strategies"],
            "baseline_horizons": horizons["baseline"],
        },
        "analytic": {
            "result_type": "analytic",
            "method": ANALYTIC_METHOD + "; optimized portfolio from portfolio_model.optimize (budget-restricted when a lower budget is selected)",
            "baseline_metrics": portfolio_model.expected_metrics(selected=()),
            "ciso_metrics": portfolio_model.expected_metrics(selected=ciso),
            "optimized_metrics": portfolio_model.expected_metrics(selected=portfolios["optimized"]) if optimum else None,
            "optimization": _optimization_info(optimum) if optimum else None,
        },
        "optimization_status": status,
        "optimization_message": message,
        "budget": planner.budget_info(budget, investments.spending(ciso)["first_year_cash_usd"]),
    })
    return result, dashboard.save_run(result, horizons)


@app.post("/api/simulate", response_model=SimulateResponse,
          responses={400: {"model": ErrorDetail}})
def simulate(request: SimulationRequest) -> dict:
    result, _ = _simulate_and_save(request)
    return result


@app.get("/api/dashboard/runs", response_model=list[RunSummary])
def dashboard_runs():
    return dashboard.list_runs()


@app.get("/api/dashboard/runs/{run_id}", response_model=DashboardRun)
def dashboard_run(run_id: int):
    run = dashboard.read_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found.")
    return run


@app.post("/api/dashboard/runs", response_model=DashboardRun, status_code=201)
def create_dashboard_run(request: SimulationRequest):
    _, run = _simulate_and_save(request)
    return run


@app.post("/api/sensitivity/stress", response_model=StressTestResponse,
          responses={400: {"model": ErrorDetail}})
def sensitivity_stress(request: PortfolioRequest) -> dict:
    selected = _validated(request.investment_ids)
    budget = _budget(request.budget_usd)
    return to_jsonable({
        "result_type": "analytic_stress_test",
        "model_status": MODEL_STATUS,
        "method": "sensitivity.STRESSES applied with portfolio_model.expected_metrics(selected, risk, loss, efficacy) "
                  "and portfolio_model.optimize (budget-restricted when a lower budget is selected)",
        **stress_tests(selected, budget),
    })


@app.get("/api/sensitivity/parameters", response_model=ParameterSensitivityResponse)
def sensitivity_parameters() -> dict:
    return to_jsonable({
        "result_type": "engine_parameter_sensitivity_report",
        "model_status": MODEL_STATUS,
        "source": "backend/risk_engine/parameter_sensitivity_report.json (generated by parameter_sensitivity.run)",
        "note": "One-at-a-time 0.5x/1.5x stresses of individual synthetic parameters, evaluated against the engine's "
                "central optimized portfolio at the full engine budget. Hypothetical, not confidence intervals.",
        "report": parameter_report(),
    })
