"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Info, LoaderCircle, Play } from "lucide-react";
import { ApiError, apiPost, toApiError } from "@/lib/api";
import type { SimulateRequest, SimulateResponse, StrategyResult } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { Card, CardBody, cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Stat } from "@/components/ui/stat";
import { Kind } from "@/components/threats/threat-copy";
import { AFTER, BEFORE } from "./residual-sections";

type Mode = SimulateRequest["uncertainty_mode"];
const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

/**
 * Residual annual loss distribution for the shared plan (POST /api/simulate → comparison.compare).
 * Shows the plan ("ciso") with today's protections ("baseline") as the reference; the optimized result is not shown here.
 */
export function ResidualMonteCarlo({
  selected,
  budget,
  disabled,
  waiting,
}: {
  selected: string[];
  budget: number;
  /** The plan is invalid: no simulation possible. */
  disabled?: boolean;
  /** The plan is still being validated: hold the automatic first run. */
  waiting?: boolean;
}) {
  const [years, setYears] = useState(20_000);
  const [seed, setSeed] = useState(2026);
  const [mode, setMode] = useState<Mode>("central");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<{ res: SimulateResponse; key: string } | null>(null);
  const autoRan = useRef(false);

  const key = JSON.stringify([[...selected].sort(), budget, years, seed, mode]);
  const stale = result !== null && result.key !== key;

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const body: SimulateRequest = { investment_ids: selected, budget_usd: budget, years, seed, uncertainty_mode: mode };
      const res = await apiPost<SimulateResponse>("/api/simulate", body);
      setResult({ res, key: JSON.stringify([[...selected].sort(), budget, years, seed, mode]) });
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setRunning(false);
    }
  }, [selected, budget, years, seed, mode]);

  // Run once automatically with the default settings (as before); later runs are user-initiated.
  useEffect(() => {
    if (autoRan.current || disabled || waiting) return;
    const t = setTimeout(() => {
      autoRan.current = true;
      run();
    }, 0);
    return () => clearTimeout(t);
  }, [run, disabled, waiting]);

  const s = result?.res.simulated.strategies ?? {};
  const mine = s.ciso;
  const today = s.baseline;
  const empty = selected.length === 0;

  const stats: { label: string; hint: string; f: (x: StrategyResult) => number }[] = [
    { label: "Average year", hint: "The average loss across one-year trials", f: (x) => x.mean_annual_loss_usd },
    { label: "Typical year (median)", hint: "50th percentile of annual loss", f: (x) => x.median_annual_loss_usd },
    { label: "Bad year (P90)", hint: "90th percentile of annual loss", f: (x) => x.p90_annual_loss_usd },
    { label: "Very bad year (P95)", hint: "95th percentile of annual loss", f: (x) => x.p95_annual_loss_usd },
  ];

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3 text-sm text-navy-900">
          <Building2 className="mt-0.5 size-4 shrink-0 text-navy-600" aria-hidden />
          <p>
            <strong className="font-semibold">Whole hospital, all three attack scenarios combined,</strong> with {empty ? "today's protections" : "your plan in place"}.
            Each one-year trial can contain several incidents or none.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running || disabled || waiting}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50"
          >
            {running ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? "Simulating…" : result ? "Run again" : "Run simulation"}
          </button>
          {result && (
            <span className="text-xs text-slate-500">
              {formatNumber(result.res.simulated.years)} one-year trials · seed {result.res.simulated.seed}
            </span>
          )}
        </div>

        {disabled && <p className="text-sm text-slate-500">Fix the plan in the Investment Planner to simulate it.</p>}
        {stale && !running && (
          <p role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Your plan or settings changed since this run. Run again to update.
          </p>
        )}
        {error && !disabled && <ErrorState error={error} onRetry={run} title="Simulation failed" compact />}
        {!result && running && <Skeleton className="h-48 rounded-xl" />}

        {mine && today && !disabled && (
          <div className={cn("space-y-4", (stale || running) && "opacity-60 transition-opacity")} aria-busy={running}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((st, i) => (
                <Stat key={st.label} emphasis={i === 3} label={st.label} value={formatCurrency(st.f(mine), { compact: true })} hint={st.hint} />
              ))}
            </div>

            {!empty && (
              <figure className="rounded-lg border border-slate-200 p-4">
                <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-500">Annual loss: before investment vs after your plan</span>
                  <span className="flex gap-3 text-slate-600" aria-hidden>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm" style={{ background: BEFORE }} /> Before investment
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm" style={{ background: AFTER }} /> After your plan
                    </span>
                  </span>
                </figcaption>
                <BarPairs
                  rows={stats.map((st) => ({ label: st.label.replace(/ \(.*\)/, ""), before: st.f(today), after: st.f(mine) }))}
                />
              </figure>
            )}

            <p className="text-sm text-slate-600">
              Even with {empty ? "today's protections" : "your plan"}, at least one disruptive incident happened in{" "}
              <span className="tabular font-semibold text-slate-800">{formatFraction(mine.probability_any_disruptive_event, 0)}</span> of one-year trials, and
              the 95th percentile of annual loss was <span className="tabular font-semibold text-slate-800">{formatCurrency(mine.p95_annual_loss_usd, { compact: true })}</span>.
            </p>

            <InlineDisclosure label="More results">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Disruptive incidents / yr" value={formatNumber(mine.expected_events_per_year, 2)} hint={`Before investment ${formatNumber(today.expected_events_per_year, 2)}`} />
                <Stat label="Recovery days / yr" value={formatNumber(mine.mean_annual_recovery_days, 1)} hint={`Before investment ${formatNumber(today.mean_annual_recovery_days, 1)}`} />
                <Stat label="Patients diverted / yr" value={formatNumber(mine.mean_annual_diverted_patients)} hint={`Before investment ${formatNumber(today.mean_annual_diverted_patients)}`} />
                <Stat label="Appointments delayed / yr" value={formatNumber(mine.mean_annual_delayed_appointments)} hint={`Before investment ${formatNumber(today.mean_annual_delayed_appointments)}`} />
              </div>
            </InlineDisclosure>
          </div>
        )}

        <InlineDisclosure label="Simulation settings and method">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="font-medium text-slate-700">One-year trials</span>
                <select value={years} onChange={(e) => setYears(Number(e.target.value))} className={FIELD}>
                  {[5_000, 20_000, 50_000].map((y) => (
                    <option key={y} value={y}>
                      {formatNumber(y)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">Random seed</span>
                <select value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={FIELD}>
                  {[2026, 7, 42, 123].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">Uncertainty mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={FIELD}>
                  <option value="central">Central (mean probabilities)</option>
                  <option value="epistemic_draw">Epistemic draw (sampled probabilities)</option>
                </select>
              </label>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Each one-year trial samples attack attempts across every scenario. The model samples severity, recovery time and costs for each incident.
              The loss percentiles summarize the annual totals across trials.{" "}
              <Kind>Simulated · Monte Carlo</Kind>
            </p>
            {result && <p className="text-xs text-slate-500">{result.res.simulated.note}</p>}
          </div>
        </InlineDisclosure>
      </CardBody>
    </Card>
  );
}

function BarPairs({ rows }: { rows: { label: string; before: number; after: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
          <span className="text-slate-600">{r.label}</span>
          <span className="space-y-[2px]">
            {[
              { v: r.before, color: BEFORE, name: "Before investment" },
              { v: r.after, color: AFTER, name: "After your plan" },
            ].map((b) => (
              <span key={b.name} className="flex items-center gap-2" title={`${b.name}: ${formatCurrency(b.v)}`}>
                <span className="sr-only">{b.name}</span>
                <span className="h-3 flex-1">
                  <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max((b.v / max) * 100, 0.5)}%`, background: b.color }} />
                </span>
                <span className="tabular w-14 shrink-0 text-right text-slate-700">{formatCurrency(b.v, { compact: true })}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
