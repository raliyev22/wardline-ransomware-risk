/**
 * Response types for the FastAPI backend (backend/api/schemas.py).
 * Source-data records keep their original CSV/JSON field names; every field is optional
 * on the client so missing data degrades gracefully instead of crashing a page.
 */

export type JsonRecord = Record<string, unknown>;

export interface HealthResponse {
  status: "ok";
  service: string;
  engine_version: string;
  synthetic_model: boolean;
  model_status: string;
  engine_path_found: boolean;
}

export interface HospitalProfile extends JsonRecord {
  organization_id?: string;
  name?: string;
  type?: string;
  data_status?: string;
  baseline_year?: number;
  facilities?: Record<string, unknown>;
  operations?: Record<string, unknown>;
  financials_usd?: Record<string, unknown>;
  modeling_notes?: string[];
}

export interface RansomwareScenario extends JsonRecord {
  scenario_id?: string;
  name?: string;
  entry_point?: string;
  description?: string;
  entry_asset_ids?: string[];
  potentially_affected_asset_ids?: string[];
  primary_control_ids?: string[];
  sequence?: string[];
  annual_attempt_distribution?: string;
  annual_attempt_mean?: number;
}

export interface AssetRecord extends JsonRecord {
  asset_id?: string;
  asset_name?: string;
  asset_category?: string;
  quantity?: number;
  criticality?: string;
  depends_on_asset_ids?: string | null;
  target_rto_hours?: number;
  illustrative_severe_event_recovery_hours?: number;
  primary_service?: string;
  ransomware_exposure_note?: string;
  data_status?: string;
}

export interface SecurityControlRecord extends JsonRecord {
  control_id?: string;
  control_name?: string;
  control_domain?: string;
  coverage_denominator?: string;
  baseline_coverage?: number;
  unit?: string;
  relevant_asset_ids?: string | null;
  relevant_scenario_ids?: string | null;
  modeled_effect_stage?: string;
  baseline_gap?: string;
  data_status?: string;
}

export interface HospitalResponse {
  model_status: string;
  data_status: string;
  sources: Record<string, string>;
  hospital_profile: HospitalProfile;
  ransomware_scenarios: { scenarios?: RansomwareScenario[] } & JsonRecord;
  assets: AssetRecord[];
  security_controls: SecurityControlRecord[];
  mappings: Record<string, JsonRecord[]>;
  /* Step 5 additive fields; optional so older API responses still type-check. */
  attack_stage_parameters?: JsonRecord[];
  attack_stage_model?: AttackStageModel[];
  attack_stage_model_note?: string;
  severity_parameters?: JsonRecord[];
  severity_parameters_note?: string;
  clinical_reputation_indicators?: JsonRecord[];
}

export interface InvestmentItem {
  id: string;
  name: string;
  capex_usd: number;
  annual_opex_usd: number;
  first_year_cash_usd: number;
  annualized_spend_usd: number;
  requires: string[];
  source_record: JsonRecord;
}

export interface InvestmentsResponse {
  model_status: string;
  currency: string;
  budget: {
    budget_first_year_cash_usd?: number;
    budget_capex_usd?: number | null;
    budget_horizon_months?: number | null;
    cost_convention?: {
      budget_constraint?: string;
      annualized_cost?: string;
      assumed_useful_life_years?: number;
      note?: string;
    } & JsonRecord;
  };
  clinical_constraints: {
    max_annual_diverted_patients_fraction_of_baseline?: number;
    max_annual_recovery_days_fraction_of_baseline?: number;
    rationale?: string;
  } & JsonRecord;
  constraints: string[];
  dependencies: { investment_id: string; requires: string[]; engine_message: string }[];
  investments: InvestmentItem[];
  control_effectiveness: JsonRecord[];
  config: JsonRecord;
}

export interface AnalyticMetrics {
  expected_annual_loss_usd: number;
  expected_annual_reputation_loss_usd: number;
  expected_events_per_year: number;
  expected_annual_recovery_days: number;
  expected_annual_diverted_patients: number;
}

export interface BaselineResponse {
  result_type: "analytic";
  model_status: string;
  method: string;
  investment_ids: string[];
  metrics: AnalyticMetrics;
}

/* ---------- Step 5: attack-stage model, severities, Monte Carlo ---------- */

export interface TriangularValue {
  low: number;
  mode: number;
  high: number;
  triangular_mean: number;
}

export type SeverityKey = "contained" | "major" | "severe";

export interface AttackStage extends TriangularValue {
  stage: "initial_access" | "deployment" | "major_spread" | "severe_given_major_spread" | string;
  parameter_id: string;
  conditional_on: string;
}

export interface AttackStageModel {
  scenario_id: string;
  relevant_attempts_per_year: number;
  stages: AttackStage[];
  expected_deployments_per_year?: number | null;
  severity_branch_weights_given_deployment?: Partial<Record<SeverityKey, number>> | null;
  mean_loss_per_deployment_usd?: number | null;
  expected_annual_loss_contribution_usd?: number | null;
  source?: string;
}

export interface ExpectedLossComponent {
  min_usd: number;
  most_likely_usd: number;
  max_usd: number;
  triangular_mean_usd: number;
  applicability_probability: number;
  expected_usd: number;
}

export interface SeverityDetail {
  severity: SeverityKey;
  bottom_up_breakdown: {
    severity: string;
    days: number;
    daily_encounters: number;
    affected_encounters: number;
    cancelled_encounters: number;
    unrecovered_encounters: number;
    components_usd: Record<string, number>;
  } & JsonRecord;
  cost_drivers: JsonRecord;
  loss_distribution_usd: Record<string, TriangularValue>;
  expected_loss_per_incident?: {
    components: Record<string, ExpectedLossComponent>;
    expected_loss_per_incident_usd: number;
  } | null;
  recovery_days: TriangularValue;
  clinical_indicators: Record<string, TriangularValue>;
  source_severity_parameters?: JsonRecord | null;
  source_clinical_reputation_indicators?: JsonRecord | null;
}

export interface SeveritiesResponse {
  result_type: "engine_per_incident_by_severity";
  model_status: string;
  method: string;
  severities: SeverityDetail[];
  loss_variability: JsonRecord;
  cost_driver_metadata: JsonRecord;
  unit_rates?: Record<string, number>;
  severity_parameters_note: string;
  notes: string[];
}

export interface StrategyResult {
  investments: string[];
  capex_usd: number;
  annual_opex_usd: number;
  annualized_spend_usd: number;
  first_year_cash_usd: number;
  mean_annual_loss_usd: number;
  median_annual_loss_usd: number;
  p90_annual_loss_usd: number;
  p95_annual_loss_usd: number;
  probability_any_disruptive_event: number;
  expected_events_per_year: number;
  mean_annual_recovery_days: number;
  mean_annual_diverted_patients: number;
  mean_annual_delayed_appointments: number;
  mean_annual_reputation_loss_usd: number;
  avoided_annual_loss_usd?: number | null;
  annualized_net_benefit_usd?: number | null;
}

export interface SimulateRequest {
  investment_ids: string[];
  budget_usd?: number;
  years: number;
  seed: number;
  uncertainty_mode: "central" | "epistemic_draw";
}

export interface SimulateResponse {
  model_status: string;
  portfolios: Record<string, string[]>;
  simulated: {
    result_type: "simulated_monte_carlo";
    method: string;
    years: number;
    seed: number;
    uncertainty_mode: string;
    note: string;
    strategies: Record<string, StrategyResult>;
    baseline_horizons: Record<number, {
      periods: number;
      mean_loss_usd: number;
      median_loss_usd: number;
      p90_loss_usd: number;
      p95_loss_usd: number;
    }>;
  };
  analytic: {
    result_type: "analytic";
    method: string;
    baseline_metrics: AnalyticMetrics;
    ciso_metrics: AnalyticMetrics;
    optimized_metrics?: AnalyticMetrics | null;
    optimization?: JsonRecord | null;
  };
  optimization_status?: string;
  optimization_message?: string | null;
  budget?: BudgetInfo;
}

/* ---------- Investment Planner ---------- */

export interface BudgetInfo {
  selected_budget_usd: number;
  engine_budget_usd: number;
  is_engine_budget: boolean;
  first_year_cash_usd?: number;
  remaining_usd?: number;
  within_selected_budget?: boolean;
}

export interface SpendingInfo {
  capex_usd: number;
  annual_opex_usd: number;
  annualized_spend_usd: number;
  first_year_cash_usd: number;
}

export interface GuardrailCheck {
  max_annual_diverted_patients_fraction_of_baseline: number;
  max_annual_recovery_days_fraction_of_baseline: number;
  diverted_patients_limit: number;
  recovery_days_limit: number;
  diverted_patients_satisfied: boolean;
  recovery_days_satisfied: boolean;
  satisfied: boolean;
  rule: string;
}

export interface EffectEntry {
  scenario_id: string;
  affected_metric: string;
  applied_relative_reduction: number;
  contributions: { investment_id: string; assumed_relative_reduction: number }[];
  applied_investments: string[];
  superseded_investments: string[];
  overlap: boolean;
}

export interface EvaluateResponse {
  result_type: "analytic";
  model_status: string;
  method: string;
  investment_ids: string[];
  metrics: AnalyticMetrics;
  baseline_metrics: AnalyticMetrics;
  spending: SpendingInfo;
  expected_annual_avoided_loss_usd: number;
  expected_annual_net_benefit_usd: number;
  clinical_guardrails: GuardrailCheck;
  effects: { rule: string; entries: EffectEntry[]; overlaps: EffectEntry[] };
  budget: BudgetInfo;
}

export interface MarginalOverlap {
  scenario_id: string;
  affected_metric: string;
  applied_investments: string[];
  superseded_investments: string[];
  previously_applied: string[];
}

export interface MarginalItem {
  investment_id: string;
  action: "add" | "remove";
  valid: boolean;
  reason?: string;
  resulting_investments?: string[];
  expected_annual_loss_change_usd?: number;
  expected_annual_net_benefit_change_usd?: number;
  first_year_cash_change_usd?: number;
  resulting_first_year_cash_usd?: number;
  within_selected_budget?: boolean;
  resulting_guardrails_satisfied?: boolean;
  no_additional_effect?: boolean;
  overlaps?: MarginalOverlap[];
}

export interface MarginalsResponse {
  result_type: "analytic";
  investment_ids: string[];
  current_expected_annual_loss_usd: number;
  current_first_year_cash_usd: number;
  budget: BudgetInfo;
  items: MarginalItem[];
}

export interface OptimizeResponse {
  result_type: "analytic";
  model_status: string;
  selected_investments: string[];
  metrics: AnalyticMetrics;
  baseline_metrics: AnalyticMetrics;
  spending: SpendingInfo;
  optimization: {
    evaluated_feasible_portfolios: number;
    clinical_eligible_portfolios: number;
    clinical_guardrails: JsonRecord;
    baseline_expected_annual_loss_usd: number;
    expected_annual_loss_usd: number;
    expected_annual_avoided_loss_usd: number;
    expected_annual_net_benefit_usd: number;
    method: string;
  };
  status: string;
  budget: BudgetInfo;
}

export interface NoEligiblePortfolioDetail {
  error: "no_eligible_portfolio";
  message: string;
  budget_usd: number;
  portfolios_within_budget?: number;
  min_first_year_cash_for_eligible_portfolio_usd?: number | null;
}

/* ---------- Risk Analytics ---------- */

export interface StressCase {
  key: string;
  multipliers: { attack_attempt_frequency: number; incident_financial_losses: number; control_effectiveness: number };
  baseline_metrics: AnalyticMetrics;
  portfolio_metrics: AnalyticMetrics;
  portfolio_avoided_loss_usd: number;
  portfolio_net_benefit_usd: number;
  portfolio_guardrails_satisfied: boolean;
  optimized: {
    status: "optimal" | "no_eligible_portfolio";
    selected_investments?: string[];
    expected_annual_loss_usd?: number;
    expected_annual_net_benefit_usd?: number;
    first_year_cash_usd?: number;
    message?: string;
    differs_from_central_optimum: boolean | null;
  };
}

export interface StressTestResponse {
  result_type: "analytic_stress_test";
  investment_ids: string[];
  portfolio_spending: SpendingInfo;
  budget: BudgetInfo;
  note: string;
  cases: StressCase[];
}

export interface ParameterStressPoint {
  factor: number;
  optimal_portfolio: string[];
  optimal_net_benefit_usd: number;
  central_portfolio_net_benefit_usd: number;
  central_portfolio_eligible: boolean;
  central_portfolio_regret_usd: number | null;
  central_portfolio_first_year_cash_usd: number;
}

export interface ParameterSensitivityResponse {
  result_type: "engine_parameter_sensitivity_report";
  source: string;
  note: string;
  report: {
    central_portfolio: string[];
    results: {
      parameter_key: string;
      baseline_value: string;
      evidence_status: string;
      stress: ParameterStressPoint[];
      max_regret_usd: number | null;
      central_ineligible_at_any_endpoint: boolean;
    }[];
    priority_order: string[];
    limitations: string[];
  } & JsonRecord;
}
