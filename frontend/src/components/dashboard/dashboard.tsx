"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Play, RefreshCw, SlidersHorizontal } from "lucide-react";
import { apiGet, apiPost, ApiError, toApiError } from "@/lib/api";
import { strategyNames, type DashboardRun, type RunSummary } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/format";
import { usePlanHydrated, usePlanStore } from "@/lib/plan-store";
import type { BaselineResponse, SimulateRequest } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { FairExposure, IncidentMix, LossDistribution, PortfolioTable } from "./charts";

function RunSettings({ onComplete }: { onComplete: (run: DashboardRun) => void }) {
  const { plan } = usePlanStore();
  const hydrated = usePlanHydrated();
  const [years, setYears] = useState(5_000);
  const [seed, setSeed] = useState("2026");
  const [mode, setMode] = useState<SimulateRequest["uncertainty_mode"]>("central");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (running || !hydrated) return;
    setError(null);
    setRunning(true);
    try {
      const request: SimulateRequest = { years, seed: Number(seed), uncertainty_mode: mode,
        investment_ids: plan.selected, budget_usd: plan.budget ?? undefined };
      onComplete(await apiPost<DashboardRun>("/api/dashboard/runs", request));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRunning(false);
    }
  }
  return (
    <form className="dash-panel" onSubmit={submit}>
      <h2>Run settings</h2>
      <p className="dash-caption">Current planner selection · {plan.selected.length} investments · {plan.budget ? formatCurrency(plan.budget) : "Model budget"}</p>
      <fieldset disabled={running} className="dash-controls mt-4">
        <label>One-year trials<select value={years} onChange={e => setYears(Number(e.target.value))}>
          {[1000, 5000, 20000, 50000].map(n => <option key={n} value={n}>{formatNumber(n)}</option>)}
        </select></label>
        <label>Random seed<input type="number" min={0} max={4294967295} step={1} required value={seed} onChange={e => setSeed(e.target.value)} /></label>
        <label>Uncertainty<select value={mode} onChange={e => setMode(e.target.value as SimulateRequest["uncertainty_mode"])}>
          <option value="central">Central probabilities</option><option value="epistemic_draw">Sampled probabilities</option>
        </select></label>
        <button className="dash-primary" type="submit" disabled={running || !hydrated}><Play size={15} />{running ? "Simulating…" : "Run simulation"}</button>
      </fieldset>
      {error && <div className="mt-4"><ErrorState error={error} title="Simulation failed" compact /></div>}
    </form>
  );
}

function BaselinePreview() {
  const baseline = useApi<BaselineResponse>("/api/risk/baseline");
  if (baseline.error) return <ErrorState error={baseline.error} onRetry={baseline.reload} compact />;
  const m = baseline.data?.metrics;
  if (!m) return <LoadingState />;
  return (
    <section className="dash-panel">
      <p className="dash-kicker">FAIR · Current protections</p><h2>Annual exposure</h2>
      <div className="dash-table-scroll">
        <table className="dash-table"><thead><tr><th>Events / year</th><th>Recovery days / year</th><th>Expected annual loss</th></tr></thead>
          <tbody><tr><td>{formatNumber(m.expected_events_per_year, 3)}</td><td>{formatNumber(m.expected_annual_recovery_days, 2)}</td><td>{formatCurrency(m.expected_annual_loss_usd)}</td></tr></tbody>
        </table>
      </div>
      <p className="dash-caption mt-3">Run a simulation to see the loss distribution and incident mix.</p>
    </section>
  );
}

function RunCharts({ id }: { id: number }) {
  const { data: run, error, reload } = useApi<DashboardRun>(`/api/dashboard/runs/${id}`);
  const [strategy, setStrategy] = useState("baseline");
  const [horizon, setHorizon] = useState(1);
  if (error) return <ErrorState error={error} onRetry={reload} compact />;
  if (!run) return <LoadingState label="Loading simulation results" />;
  const item = run.strategies[strategy];
  const sample = item.horizons[horizon];
  const unused = run.years % horizon;
  return (
    <>
      <div className="dash-filter">
        <div className="dash-controls">
          <label>Portfolio<select value={strategy} onChange={e => setStrategy(e.target.value)}>
            {Object.keys(run.strategies).map(key => <option key={key} value={key}>{strategyNames[key]}</option>)}
          </select></label>
          <fieldset className="dash-horizons"><legend>Loss horizon</legend>
            <div>{Object.keys(item.horizons).map(key => <button key={key} type="button" aria-pressed={horizon === Number(key)}
              onClick={() => setHorizon(Number(key))}>{key} {key === "1" ? "year" : "years"}</button>)}</div>
          </fieldset>
        </div>
        <div className="dash-caption space-y-1">
          <p>{formatNumber(run.years)} one-year trials · Seed {run.seed} · {run.uncertainty_mode === "central" ? "Central probabilities" : "Sampled probabilities"}<br />
            {formatCurrency(run.budget_usd)} budget · {item.investments.length ? item.investments.join(", ") : "No new investments"}</p>
          {run.ciso_first_year_cash_usd != null && (
            <p className="flex flex-wrap items-center gap-2">
              <span>Your plan’s first-year cost {formatCurrency(run.ciso_first_year_cash_usd)}</span>
              {run.ciso_over_budget_usd !== null && run.ciso_over_budget_usd > 0 && (
                <Badge tone="danger">Over budget by {formatCurrency(run.ciso_over_budget_usd)}</Badge>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="dash-chart-grid" key={`${strategy}-${horizon}`}>
        <LossDistribution data={sample} thresholds={run.loss_thresholds_usd} />
        <IncidentMix data={sample} />
      </div>
      {horizon > 1 && <p className="dash-caption">Each {horizon}-year outcome sums {horizon} one-year trials. {formatNumber(sample.periods)} complete, non-overlapping outcomes{unused ? ` · ${formatNumber(unused)} unused ${unused === 1 ? "trial" : "trials"} excluded` : ""}.</p>}
      <FairExposure run={run} strategy={strategy} onSelect={setStrategy} />
      <PortfolioTable run={run} horizon={horizon} strategy={strategy} onSelect={setStrategy} />
    </>
  );
}

export function Dashboard() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    const refresh = () => setVersion(v => v + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    let active = true;
    apiGet<RunSummary[]>("/api/dashboard/runs", { force: true }).then(list => {
      if (active) { setRuns(list); setError(null); }
    }, err => { if (active) setError(toApiError(err)); });
    return () => { active = false; };
  }, [version]);
  const selected = runs?.find(r => r.id === id) ?? runs?.[0];
  function completed(run: DashboardRun) {
    setId(run.id);
    setRuns(prev => [run, ...(prev ?? []).filter(r => r.id !== run.id)]);
    setSettings(false);
    setVersion(v => v + 1);
  }
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Workspace" title="Dashboard" actions={runs?.length ?
        <button type="button" className="dash-primary" aria-expanded={settings} onClick={() => setSettings(!settings)}><SlidersHorizontal size={16} />Run settings</button> : undefined} />
      {error && <ErrorState error={error} onRetry={() => setVersion(v => v + 1)} title="Run history unavailable" compact />}
      {!runs && !error && <LoadingState label="Loading completed runs" />}
      {runs && (!runs.length || settings) && <RunSettings onComplete={completed} />}
      {runs && !runs.length && <BaselinePreview />}
      {selected && <>
        <div className="dash-run-picker">
          <label>Completed run<select value={selected.id} onChange={e => setId(Number(e.target.value))}>
            {runs?.map(r => <option key={r.id} value={r.id}>Run {r.id} · {new Date(r.completed_at).toLocaleString()} · {formatNumber(r.years)} one-year trials</option>)}
          </select></label>
          <button type="button" aria-label="Refresh completed runs" title="Refresh completed runs" onClick={() => setVersion(v => v + 1)}><RefreshCw size={16} /></button>
        </div>
        <RunCharts key={selected.id} id={selected.id} />
      </>}
    </div>
  );
}
