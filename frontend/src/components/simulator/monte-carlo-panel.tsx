"use client";

import { useState, type FormEvent } from "react";
import { Building2, LoaderCircle, Play, Sigma } from "lucide-react";
import { ApiError, apiPost, toApiError } from "@/lib/api";
import type { SimulateRequest, SimulateResponse } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { ErrorState } from "@/components/ui/states";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { Kind } from "@/components/threats/threat-copy";

const HORIZON_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50];
const TRIAL_OPTIONS = [5_000, 20_000, 50_000];
const DEFAULT_SEED = 2026;

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

/** Whole-hospital Monte Carlo outcomes with today's protections. */
export function MonteCarloPanel({ scenarioCount }: { scenarioCount?: number }) {
  const [horizon, setHorizon] = useState(1);
  const [trials, setTrials] = useState(20_000);
  const [seed, setSeed] = useState(String(DEFAULT_SEED));
  const [mode, setMode] = useState<SimulateRequest["uncertainty_mode"]>("central");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<SimulateResponse | null>(null);

  const seedNumber = Number(seed);
  const seedValid = seed.trim() !== "" && Number.isInteger(seedNumber) && seedNumber >= 0 && seedNumber <= 4_294_967_295;

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!seedValid || running) return;
    setRunning(true);
    setError(null);
    try {
      const body: SimulateRequest = { investment_ids: [], years: trials, seed: seedNumber, uncertainty_mode: mode };
      setResult(await apiPost<SimulateResponse>("/api/simulate", body));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRunning(false);
    }
  };

  const base = result?.simulated.strategies.baseline;
  const loss = result?.simulated.baseline_horizons[horizon];
  const horizonLabel = `${horizon}-year`;

  return (
    <Card>
      <CardHeader
        title="Simulate ransomware losses"
        icon={<Sigma className="size-4" aria-hidden />}
        description="Estimate total ransomware losses over a planning horizon using today’s protections."
        actions={<Kind>Simulated · Monte Carlo</Kind>}
      />
      <CardBody className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3 text-sm text-navy-900">
          <Building2 className="mt-0.5 size-4 shrink-0 text-navy-600" aria-hidden />
          <p className="leading-relaxed">
            <strong className="font-semibold">Whole hospital, every attack scenario{scenarioCount ? ` (all ${scenarioCount})` : ""}, no new investment.</strong>{" "}
            Each one-year trial includes all modeled types and severities. The assumptions stay the same throughout the planning horizon.
          </p>
        </div>

        <form onSubmit={run} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm sm:w-48">
              <span className="font-medium text-slate-700">Planning horizon</span>
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className={FIELD}>
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} {option === 1 ? "year" : "years"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:w-48">
              <span className="font-medium text-slate-700">One-year trials</span>
              <select value={trials} onChange={(e) => setTrials(Number(e.target.value))} disabled={running} className={FIELD}>
                {TRIAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatNumber(option)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={running || !seedValid}
              className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {running ? "Simulating…" : result ? "Run again" : "Run simulation"}
            </button>
          </div>
          <p className="text-sm text-slate-600">
            {formatNumber(trials)} one-year trials provide {formatNumber(Math.floor(trials / horizon))} complete {horizonLabel} outcomes.
          </p>
          <InlineDisclosure label="Advanced settings">
            <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
              <label className="text-sm">
                <span className="font-medium text-slate-700">Random seed</span>
                <input
                  inputMode="numeric"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  aria-invalid={!seedValid}
                  className={`${FIELD} tabular aria-[invalid=true]:border-rose-400`}
                />
                <span className="mt-1 block text-xs text-slate-500">Use the same seed and trial settings to reproduce a run.</span>
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">Uncertainty mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as SimulateRequest["uncertainty_mode"])} className={FIELD}>
                  <option value="central">Central (mean probabilities)</option>
                  <option value="epistemic_draw">Epistemic draw (sampled probabilities)</option>
                </select>
                <span className="mt-1 block text-xs text-slate-500">Epistemic draw also varies the probabilities themselves.</span>
              </label>
            </div>
          </InlineDisclosure>
          {!seedValid && <p className="text-xs text-rose-700">Random seed must be a whole number of 0 or more (see Advanced settings).</p>}
        </form>

        {error && <ErrorState error={error} onRetry={() => run()} title="Simulation failed" compact />}

        {running && !result && (
          <p role="status" className="text-sm text-slate-500">
            Running {formatNumber(trials)} one-year trials…
          </p>
        )}

        {base && result && loss && (
          <div className={running ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"} aria-busy={running} aria-live="polite">
            <p className="text-sm font-medium text-navy-900">
              {horizonLabel} total loss · {formatNumber(loss.periods)} complete outcomes from {formatNumber(result.simulated.years)} one-year trials
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat emphasis label="Average loss" value={formatCurrency(loss.mean_loss_usd, { compact: true })} hint={`Average total over ${horizon} ${horizon === 1 ? "year" : "years"}`} />
              <Stat label="Median loss" value={formatCurrency(loss.median_loss_usd, { compact: true })} hint="50th percentile of total loss" />
              <Stat label="High loss (P90)" value={formatCurrency(loss.p90_loss_usd, { compact: true })} hint="90th percentile of total loss" />
              <Stat label="Very high loss (P95)" value={formatCurrency(loss.p95_loss_usd, { compact: true })} hint="95th percentile of total loss" />
            </div>

            <LossLadder
              horizonLabel={horizonLabel}
              points={[
                { label: "Median", value: loss.median_loss_usd },
                { label: "Average", value: loss.mean_loss_usd },
                { label: "High (P90)", value: loss.p90_loss_usd },
                { label: "Very high (P95)", value: loss.p95_loss_usd },
              ]}
            />
            <p className="text-sm text-slate-600">
              In <span className="tabular font-semibold text-slate-800">{formatFraction(base.probability_any_disruptive_event, 0)}</span> of one-year trials,
              at least one disruptive incident happened.
            </p>

            <InlineDisclosure label="Annual operating impacts">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Stat label="Disruptive incidents / year" value={formatNumber(base.expected_events_per_year, 2)} hint="Average count" />
                <Stat label="Recovery days / year" value={formatNumber(base.mean_annual_recovery_days, 1)} hint="Average, summed over incidents" />
                <Stat label="Patients diverted / year" value={formatNumber(base.mean_annual_diverted_patients)} hint="Average exposure indicator" />
                <Stat label="Appointments delayed / year" value={formatNumber(base.mean_annual_delayed_appointments)} hint="Average exposure indicator" />
                <Stat label="Reputation loss / year" value={formatCurrency(base.mean_annual_reputation_loss_usd, { compact: true })} hint="Already included in the annual loss" />
                <Stat label="Trials with an incident" value={formatFraction(base.probability_any_disruptive_event, 1)} hint="Share of one-year trials" />
              </div>
            </InlineDisclosure>

            <InlineDisclosure label="How does this simulation work?">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
                <p>
                  A one-year trial samples attack attempts, incident severity, recovery time and loss under the model’s assumptions.
                </p>
                <p>
                  For a longer horizon, the engine groups one-year trials into complete, non-overlapping periods and adds the losses within each period.
                  It calculates the average and percentiles across those totals. Incomplete groups are excluded.
                </p>
                <p className="text-xs text-slate-500">
                  {formatNumber(result.simulated.years)} one-year trials · seed {result.simulated.seed} ·{" "}
                  {result.simulated.uncertainty_mode === "central" ? "central" : "epistemic draw"} mode · {result.simulated.method}.
                </p>
                <p className="text-xs text-slate-500">{result.simulated.note}</p>
              </div>
            </InlineDisclosure>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The four API statistics placed on one dollar axis (0 → largest value), so the gap between a
 * median and a high-loss outcome is visible.
 */
function LossLadder({ horizonLabel, points }: { horizonLabel: string; points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-4">
      <figcaption className="text-xs font-medium text-slate-500">{horizonLabel} total loss</figcaption>
      <ul className="mt-3 space-y-2">
        {points.map((p, i) => (
          <li key={p.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)_5rem]">
            <span className="text-slate-600">{p.label}</span>
            <span className="h-3 rounded-r-[4px] bg-slate-100">
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${Math.max((p.value / max) * 100, 0.5)}%`, background: i === 1 ? "var(--color-navy-800)" : "var(--color-navy-300)" }}
              />
            </span>
            <span className="tabular text-right font-semibold text-slate-900">{formatCurrency(p.value, { compact: true })}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
