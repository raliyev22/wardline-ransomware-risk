export interface RunSummary {
  id: number;
  completed_at: string;
  years: number;
  seed: number;
  uncertainty_mode: string;
}

export interface HorizonResults {
  periods: number;
  mean_loss_usd: number;
  p95_loss_usd: number;
  loss_counts: number[];
  incident_counts: number[];
}

export interface DashboardStrategy {
  investments: string[];
  events_per_year: number;
  mean_loss_per_event_usd: number | null;
  expected_annual_loss_usd: number;
  horizons: Record<number, HorizonResults>;
}

export interface DashboardRun extends RunSummary {
  budget_usd: number;
  ciso_first_year_cash_usd: number | null;
  ciso_over_budget_usd: number | null;
  loss_thresholds_usd: number[];
  strategies: Record<string, DashboardStrategy>;
}

export const strategyNames: Record<string, string> = {
  baseline: "Current protections",
  ciso: "Your plan",
  optimized: "Model-recommended plan",
};
