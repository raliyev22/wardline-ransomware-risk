"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, LoaderCircle, Play, Sigma } from "lucide-react";
import { ApiError, apiPost, toApiError } from "@/lib/api";
import type { SimulateRequest, SimulateResponse, StrategyResult } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { Badge, SyntheticBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, cn } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { GroupedBarChart, STRATEGY_SERIES } from "./grouped-bar-chart";

type Mode = SimulateRequest["uncertainty_mode"];

/** Annual Monte Carlo (POST /api/simulate → comparison.compare) for baseline, the shared plan, and the optimum. */
export function MonteCarloAnalysis({
  selected,
  budget,
  onResult,
  names,
}: {
  selected: string[];
  budget: number;
  /** Optional investment names, shown instead of raw IDs. */
  names?: Map<string, string>;
  /** Optional: receives each completed run with the plan inputs it used (Executive Comparison summary). */
  onResult?: (res: SimulateResponse, inputs: { selected: string[]; budget: number }) => void;
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
      onResult?.(res, { selected, budget });
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setRunning(false);
    }
  }, [selected, budget, years, seed, mode, onResult]);

  // Run once automatically with the default settings; later runs are user-initiated.
  useEffect(() => {
    if (autoRan.current) return;
    // Mark as run only when the timer fires, so Strict Mode's mount/cleanup/mount cycle doesn't cancel it.
    const t = setTimeout(() => {
      autoRan.current = true;
      run();
    }, 0);
    return () => clearTimeout(t);
  }, [run]);

  const s = result?.res.simulated.strategies ?? {};
  const a = result?.res.analytic;
  const val = (k: string, f: (x: StrategyResult) => number) => (s[k] ? f(s[k]) : null);
  const lossGroups = [
    { label: "Mean", hint: "Average year", f: (x: StrategyResult) => x.mean_annual_loss_usd },
    { label: "Median", hint: "Typical year (50th percentile)", f: (x: StrategyResult) => x.median_annual_loss_usd },
    { label: "P90", hint: "1-in-10 bad year", f: (x: StrategyResult) => x.p90_annual_loss_usd },
    { label: "P95", hint: "1-in-20 bad year", f: (x: StrategyResult) => x.p95_annual_loss_usd },
  ].map((g) => ({ label: g.label, hint: g.hint, values: Object.fromEntries(STRATEGY_SERIES.map((ser) => [ser.key, val(ser.key, g.f)])) }));

  const ops: { label: string; f: (x: StrategyResult) => number; fmt: (v: number) => string; note?: string }[] = [
    { label: "Years with a disruptive incident", f: (x) => x.probability_any_disruptive_event, fmt: (v) => formatFraction(v, 1) },
    { label: "Disruptive incidents / yr", f: (x) => x.expected_events_per_year, fmt: (v) => formatNumber(v, 2) },
    { label: "Recovery days / yr", f: (x) => x.mean_annual_recovery_days, fmt: (v) => formatNumber(v, 1), note: "Summed across incidents" },
    { label: "Diverted patients / yr", f: (x) => x.mean_annual_diverted_patients, fmt: (v) => formatNumber(v), note: "Exposure indicator, not harm" },
    { label: "Delayed appointments / yr", f: (x) => x.mean_annual_delayed_appointments, fmt: (v) => formatNumber(v), note: "Exposure indicator" },
    { label: "Reputation loss / yr", f: (x) => x.mean_annual_reputation_loss_usd, fmt: (v) => formatCurrency(v, { compact: true }), note: "Already inside annual loss" },
  ];

  return (
    <Card>
      <CardHeader
        title="Annual Monte Carlo analysis"
        icon={<Sigma className="size-4" aria-hidden />}
        description="Each one-year trial uses the same simulated attack activity to compare all strategies."
        actions={
          <>
            <Badge tone="accent">Simulated · Monte Carlo</Badge>
            <SyntheticBadge label="Synthetic" />
          </>
        }
      />
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700">One-year trials</span>
            <select
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
            >
              {[5_000, 20_000, 50_000].map((y) => (
                <option key={y} value={y}>
                  {formatNumber(y)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Seed</span>
            <select
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
            >
              {[2026, 7, 42, 123].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Uncertainty mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
            >
              <option value="central">Central (mean probabilities)</option>
              <option value="epistemic_draw">Epistemic draw (sampled probabilities)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {running ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? "Running…" : result ? "Run again" : "Run simulation"}
          </button>
        </div>

        {stale && !running && (
          <p role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> These results are out of date: your portfolio, budget or simulation settings have
            changed. Run again to update them.
          </p>
        )}
        {error && <ErrorState error={error} onRetry={run} title="Simulation failed" compact />}
        {!result && running && <Skeleton className="h-64 rounded-xl" />}

        {result && (
          <div className={cn("space-y-6", (stale || running) && "opacity-60 transition-opacity")} aria-busy={running}>
            {result.res.optimization_status === "no_eligible_portfolio" && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No optimized portfolio at this budget, so only baseline and your portfolio are simulated. {result.res.optimization_message}
              </p>
            )}
            <section aria-labelledby="mc-loss">
              <h3 id="mc-loss" className="text-sm font-semibold text-slate-800">
                Annual loss statistics
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatNumber(result.res.simulated.years)} one-year trials · seed {result.res.simulated.seed} ·{" "}
                {result.res.simulated.uncertainty_mode === "central" ? "central" : "epistemic draw"} mode
              </p>
              <div className="mt-4">
                <GroupedBarChart
                  groups={lossGroups}
                  series={STRATEGY_SERIES}
                  format={(v) => formatCurrency(v, { compact: true })}
                  caption="Simulated annual loss statistics by strategy"
                />
              </div>
            </section>

            <PercentileExplainer />

            {a && (
              <section aria-labelledby="mc-vs-analytic">
                <h3 id="mc-vs-analytic" className="text-sm font-semibold text-slate-800">
                  Analytic expected value vs Monte Carlo mean
                </h3>
                <div className="-mx-5 mt-3 overflow-x-auto sm:-mx-6">
                  <table className="tabular min-w-full text-sm">
                    <caption className="sr-only">Analytic versus simulated expected annual loss</caption>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" className="px-4 py-2.5 pl-5 text-left font-semibold sm:pl-6">Strategy</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                          <Badge tone="navy">Analytic</Badge> expected annual loss
                        </th>
                        <th scope="col" className="px-4 py-2.5 pr-5 text-right font-semibold sm:pr-6">
                          <Badge tone="accent">Simulated</Badge> mean annual loss
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {STRATEGY_SERIES.map((ser) => {
                        const analytic =
                          ser.key === "baseline" ? a.baseline_metrics : ser.key === "ciso" ? a.ciso_metrics : (a.optimized_metrics ?? null);
                        if (!s[ser.key] && !analytic) return null;
                        return (
                          <tr key={ser.key}>
                            <th scope="row" className="px-4 py-2.5 pl-5 text-left font-normal text-slate-700 sm:pl-6">
                              <span className="inline-flex items-center gap-2">
                                <span className="size-2.5 rounded-sm" style={{ background: ser.color }} aria-hidden />
                                {ser.label}
                                <span className="text-xs text-slate-400">{(result.res.portfolios[ser.key] ?? []).map((id) => names?.get(id) ?? id).join(", ") || "none"}</span>
                              </span>
                            </th>
                            <td className="px-4 py-2.5 text-right text-slate-900">{analytic ? formatCurrency(analytic.expected_annual_loss_usd) : "—"}</td>
                            <td className="px-4 py-2.5 pr-5 text-right text-slate-900 sm:pr-6">{s[ser.key] ? formatCurrency(s[ser.key].mean_annual_loss_usd) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  The analytic value is a formula using average probabilities and costs, and it is what the optimizer ranks portfolios on. The simulated
                  mean comes from random draws, so it differs slightly by sampling. Only the simulation gives medians, P90/P95 and the chance of an
                  incident. {result.res.simulated.note}
                </p>
              </section>
            )}

            <section aria-labelledby="mc-ops">
              <h3 id="mc-ops" className="text-sm font-semibold text-slate-800">
                Operational and reputational consequences (simulated annual means)
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ops.map((o) => {
                  const vals = STRATEGY_SERIES.map((ser) => ({ ser, v: val(ser.key, o.f) }));
                  const max = Math.max(1e-9, ...vals.map((x) => x.v ?? 0));
                  return (
                    <li key={o.label} className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-800">{o.label}</p>
                      {o.note && <p className="text-xs text-slate-500">{o.note}</p>}
                      <ul className="mt-3 space-y-[2px]">
                        {vals.map(({ ser, v }) =>
                          v === null ? null : (
                            <li key={ser.key} className="flex items-center gap-2" title={`${ser.label}: ${o.fmt(v)}`}>
                              <span className="sr-only">{ser.label}</span>
                              <div className="h-3 flex-1">
                                <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max((v / max) * 100, 0.5)}%`, background: ser.color }} />
                              </div>
                              <span className="tabular w-14 shrink-0 text-right text-xs text-slate-700">{o.fmt(v)}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
                {STRATEGY_SERIES.filter((ser) => s[ser.key]).map((ser) => (
                  <li key={ser.key} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: ser.color }} aria-hidden />
                    {ser.label}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function PercentileExplainer() {
  return (
    <div className="grid gap-3 rounded-xl border border-navy-100 bg-navy-50/50 p-4 text-sm text-navy-950 md:grid-cols-3">
      <div>
        <p className="font-semibold">Median vs mean</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-900/80">
          A few costly one-year trials can pull the mean well above the median.
        </p>
      </div>
      <div>
        <p className="font-semibold">P90 = a 1-in-10 bad year</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-900/80">
          This is the 90th percentile of <strong>total annual ransomware loss</strong> across the one-year trials.
        </p>
      </div>
      <div>
        <p className="font-semibold">P95 = a 1-in-20 bad year</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-900/80">
          These are percentiles of <strong>annual</strong> totals, which can include several incidents. They are not the cost of a single incident or a
          worst case, and not a confidence interval.
        </p>
      </div>
    </div>
  );
}
