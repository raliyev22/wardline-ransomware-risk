"""Pydantic request/response models.

Field names mirror the engine's own dictionary keys so values pass through unchanged.
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

MAX_SIMULATION_YEARS = 50_000
DEFAULT_SIMULATION_YEARS = 20_000
DEFAULT_SEED = 2026

InvestmentId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------- requests ----------

class PortfolioRequest(_Strict):
    investment_ids: list[InvestmentId] = Field(
        default_factory=list,
        max_length=32,
        description="Selected investment IDs, e.g. ['I01', 'I04', 'I06']. Empty list = no new investment.",
    )
    budget_usd: Optional[float] = Field(
        None, gt=0,
        description="Optional CISO first-year cash budget (<= the engine budget). Omitted = engine budget.",
    )


class SimulationRequest(PortfolioRequest):
    years: int = Field(DEFAULT_SIMULATION_YEARS, ge=1, le=MAX_SIMULATION_YEARS,
                       description="Number of simulated years.")
    seed: int = Field(DEFAULT_SEED, ge=0, le=2**32 - 1, description="Random seed (reproducible).")
    uncertainty_mode: Literal["central", "epistemic_draw"] = "central"


# ---------- shared response pieces ----------

class AnalyticMetrics(BaseModel):
    """Output of portfolio_model.expected_metrics()."""
    expected_annual_loss_usd: float
    expected_annual_reputation_loss_usd: float
    expected_events_per_year: float
    expected_annual_recovery_days: float
    expected_annual_diverted_patients: float


class Spending(BaseModel):
    """Output of investments.spending()."""
    capex_usd: int
    annual_opex_usd: int
    annualized_spend_usd: float
    first_year_cash_usd: int


class GuardrailCheck(BaseModel):
    max_annual_diverted_patients_fraction_of_baseline: float
    max_annual_recovery_days_fraction_of_baseline: float
    diverted_patients_limit: float
    recovery_days_limit: float
    diverted_patients_satisfied: bool
    recovery_days_satisfied: bool
    satisfied: bool
    rule: str


class ErrorDetail(BaseModel):
    error: str
    message: str
    investment_ids: list[str]


# ---------- endpoint responses ----------

class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    engine_version: str
    synthetic_model: bool
    model_status: str
    engine_path_found: bool


class HospitalResponse(BaseModel):
    model_status: str
    data_status: str
    sources: dict[str, str]
    hospital_profile: dict[str, Any]
    ransomware_scenarios: dict[str, Any]
    assets: list[dict[str, Any]]
    security_controls: list[dict[str, Any]]
    mappings: dict[str, list[dict[str, Any]]]
    # Step 5 additive fields (existing fields above are unchanged).
    attack_stage_parameters: list[dict[str, Any]] = []
    attack_stage_model: list[dict[str, Any]] = []
    attack_stage_model_note: str = ""
    severity_parameters: list[dict[str, Any]] = []
    severity_parameters_note: str = ""
    clinical_reputation_indicators: list[dict[str, Any]] = []


class TriangularValue(BaseModel):
    low: float
    mode: float
    high: float
    triangular_mean: float


class SeverityDetail(BaseModel):
    severity: Literal["contained", "major", "severe"]
    bottom_up_breakdown: dict[str, Any]
    cost_drivers: dict[str, Any]
    loss_distribution_usd: dict[str, TriangularValue]
    expected_loss_per_incident: Optional[dict[str, Any]]
    recovery_days: TriangularValue
    clinical_indicators: dict[str, TriangularValue]
    source_severity_parameters: Optional[dict[str, Any]]
    source_clinical_reputation_indicators: Optional[dict[str, Any]]


class SeveritiesResponse(BaseModel):
    result_type: Literal["engine_per_incident_by_severity"]
    model_status: str
    method: str
    severities: list[SeverityDetail]
    loss_variability: dict[str, Any]
    cost_driver_metadata: dict[str, Any]
    unit_rates: dict[str, float]
    severity_parameters_note: str
    notes: list[str]


class InvestmentItem(BaseModel):
    id: str
    name: str
    capex_usd: int
    annual_opex_usd: int
    first_year_cash_usd: int
    annualized_spend_usd: float
    requires: list[str]
    source_record: dict[str, Any]


class Dependency(BaseModel):
    investment_id: str
    requires: list[str]
    engine_message: str


class InvestmentsResponse(BaseModel):
    model_status: str
    currency: str
    budget: dict[str, Any]
    clinical_constraints: dict[str, Any]
    constraints: list[str]
    dependencies: list[Dependency]
    investments: list[InvestmentItem]
    control_effectiveness: list[dict[str, Any]]
    config: dict[str, Any]


class BaselineResponse(BaseModel):
    result_type: Literal["analytic"]
    model_status: str
    method: str
    investment_ids: list[str]
    metrics: AnalyticMetrics


class EvaluateResponse(BaseModel):
    result_type: Literal["analytic"]
    model_status: str
    method: str
    investment_ids: list[str]
    metrics: AnalyticMetrics
    baseline_metrics: AnalyticMetrics
    spending: Spending
    expected_annual_avoided_loss_usd: float
    expected_annual_net_benefit_usd: float
    clinical_guardrails: GuardrailCheck
    # Additive Investment Planner fields.
    effects: dict[str, Any] = {}
    budget: dict[str, Any] = {}


class MarginalsResponse(BaseModel):
    result_type: Literal["analytic"]
    model_status: str
    method: str
    investment_ids: list[str]
    current_expected_annual_loss_usd: float
    current_first_year_cash_usd: float
    budget: dict[str, Any]
    items: list[dict[str, Any]]


class OptimizationInfo(BaseModel):
    """Fields returned by portfolio_model.optimize() other than spending."""
    evaluated_feasible_portfolios: int
    clinical_eligible_portfolios: int
    clinical_guardrails: dict[str, Any]
    baseline_expected_annual_loss_usd: float
    expected_annual_loss_usd: float
    expected_annual_avoided_loss_usd: float
    expected_annual_net_benefit_usd: float
    method: str


class OptimizeResponse(BaseModel):
    result_type: Literal["analytic"]
    model_status: str
    selected_investments: list[str]
    metrics: AnalyticMetrics
    baseline_metrics: AnalyticMetrics
    spending: Spending
    optimization: OptimizationInfo
    status: str = "optimal"
    budget: dict[str, Any] = {}


class StrategyResult(BaseModel):
    """One strategy from comparison.compare()['strategies']."""
    investments: list[str]
    capex_usd: int
    annual_opex_usd: int
    annualized_spend_usd: float
    first_year_cash_usd: int
    mean_annual_loss_usd: float
    median_annual_loss_usd: float
    p90_annual_loss_usd: float
    p95_annual_loss_usd: float
    probability_any_disruptive_event: float
    expected_events_per_year: float
    mean_annual_recovery_days: float
    mean_annual_diverted_patients: float
    mean_annual_delayed_appointments: float
    mean_annual_reputation_loss_usd: float
    avoided_annual_loss_usd: Optional[float] = None
    annualized_net_benefit_usd: Optional[float] = None


class PeriodLossSummary(BaseModel):
    periods: int
    mean_loss_usd: float
    median_loss_usd: float
    p90_loss_usd: float
    p95_loss_usd: float


class SimulatedBlock(BaseModel):
    result_type: Literal["simulated_monte_carlo"]
    method: str
    years: int
    seed: int
    uncertainty_mode: str
    note: str
    strategies: dict[str, StrategyResult]
    baseline_horizons: dict[int, PeriodLossSummary]


class AnalyticBlock(BaseModel):
    result_type: Literal["analytic"]
    method: str
    baseline_metrics: AnalyticMetrics
    ciso_metrics: AnalyticMetrics
    optimized_metrics: Optional[AnalyticMetrics] = None
    optimization: Optional[OptimizationInfo] = None


class SimulateResponse(BaseModel):
    model_status: str
    portfolios: dict[str, list[str]]
    simulated: SimulatedBlock
    analytic: AnalyticBlock
    # Additive: "optimal", or "no_eligible_portfolio" when no portfolio fits a reduced budget.
    optimization_status: str = "optimal"
    optimization_message: Optional[str] = None
    budget: dict[str, Any] = {}


class HorizonResults(BaseModel):
    periods: int
    mean_loss_usd: float
    p95_loss_usd: float
    loss_counts: list[int]
    incident_counts: list[int]


class DashboardStrategy(BaseModel):
    investments: list[str]
    events_per_year: float
    mean_loss_per_event_usd: Optional[float]
    expected_annual_loss_usd: float
    horizons: dict[int, HorizonResults]


class RunSummary(BaseModel):
    id: int
    completed_at: str
    years: int
    seed: int
    uncertainty_mode: str


class DashboardRun(RunSummary):
    budget_usd: float
    ciso_first_year_cash_usd: Optional[float] = None
    ciso_over_budget_usd: Optional[float] = None
    loss_thresholds_usd: list[int]
    strategies: dict[str, DashboardStrategy]


class StressTestResponse(BaseModel):
    result_type: Literal["analytic_stress_test"]
    model_status: str
    method: str
    investment_ids: list[str]
    portfolio_spending: Spending
    budget: dict[str, Any]
    note: str
    cases: list[dict[str, Any]]


class ParameterSensitivityResponse(BaseModel):
    result_type: Literal["engine_parameter_sensitivity_report"]
    model_status: str
    source: str
    note: str
    report: dict[str, Any]
