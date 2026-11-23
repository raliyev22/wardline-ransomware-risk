"use client";

import { useState } from "react";
import { Info, LoaderCircle, Play, Sigma } from "lucide-react";
import { ApiError, apiPost, toApiError } from "@/lib/api";
import type { SimulateRequest, SimulateResponse, StrategyResult } from "@/lib/types";
import { MISSING, formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { cn } from "@/components/ui/card";
import { DisclosureSection } from "@/components/ui/disclosure";
import { Kind } from "@/components/threats/threat-copy";
import { ErrorState } from "@/components/ui/states";

const LABELS: Record<string, string> = { baseline: "Current protections", ciso: "Your plan", optimized: "Recommended plan" };

/** Paired Monte Carlo check (POST /api/simulate → comparison.compare) for the current plan. */
export function PlannerMonteCarlo({ selected, budget }: { selected: string[]; budget: number }) {
  const [years, setYears] = useState(20_000);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<{ res: SimulateResponse; key: string } | null>(null);
  const key = `${[...selected].sort().join(",")}|${budget}`;
  const stale = result && result.key !== key;

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const body: SimulateRequest = { investment_ids: selected, budget_usd: budget, years, seed: 2026, uncertainty_mode: "central" };
      const res = await apiPost<SimulateResponse>("/api/simulate", body);
      setResult({ res, key });
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setRunning(false);
    }
  };

  const strategies = result?.res.simulated.strategies ?? {};
  const order = ["baseline", "ciso", "optimized"];
  const rows: { label: string; get: (s: StrategyResult) => string }[] = [
    { label: "Average year", get: (s) => formatCurrency(s.mean_annual_loss_usd, { compact: true }) },
    { label: "Typical year (median)", get: (s) => formatCurrency(s.median_annual_loss_usd, { compact: true }) },
    { label: "Bad year (P90, 1 in 10)", get: (s) => formatCurrency(s.p90_annual_loss_usd, { compact: true }) },
    { label: "Very bad year (P95, 1 in 20)", get: (s) => formatCurrency(s.p95_annual_loss_usd, { compact: true }) },
    { label: "Years with an incident", get: (s) => formatFraction(s.probability_any_disruptive_event, 1) },
    { label: "Recovery days / yr", get: (s) => formatNumber(s.mean_annual_recovery_days, 1) },
    { label: "Patients diverted / yr", get: (s) => formatNumber(s.mean_annual_diverted_patients) },
    { label: "Net benefit / yr", get: (s) => (s.annualized_net_benefit_usd == null ? MISSING : formatCurrency(s.annualized_net_benefit_usd, { compact: true })) },
  ];

  return (
    <DisclosureSection
      title="How would our investment choices perform in a bad ransomware year?"
      icon={<Sigma className="size-4" aria-hidden />}
      summary="Compare our current protections, your selected investments, and the model-recommended plan across thousands of one-year trials."
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Averages hide bad years. Each one-year trial uses the same simulated attack activity for all three options.{" "}
          <Kind>Simulated · Monte Carlo</Kind>
        </p>
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
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {running ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? "Simulating…" : result ? "Run again" : "Run the simulation"}
          </button>
          <span className="text-xs text-slate-500">Seed 2026 · central mode</span>
        </div>

        {error && <ErrorState error={error} onRetry={run} title="Simulation failed" compact />}

        {stale && (
          <p className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Your selection or budget changed since this run. Run again to update.
          </p>
        )}

        {result && (
          <div className={cn(stale && "opacity-60")}>
            {result.res.optimization_status === "no_eligible_portfolio" && (
              <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">No recommended plan at this budget: {result.res.optimization_message}</p>
            )}
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="tabular min-w-full text-sm">
                <caption className="sr-only">Monte Carlo comparison</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-2.5 pl-5 text-left font-semibold sm:pl-6">Simulated result</th>
                    {order.filter((k) => strategies[k]).map((k) => (
                      <th key={k} scope="col" className="px-4 py-2.5 text-right font-semibold last:pr-5 sm:last:pr-6">
                        {LABELS[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 pl-5 text-left font-normal text-slate-600 sm:pl-6">
                        {r.label}
                      </th>
                      {order.filter((k) => strategies[k]).map((k) => (
                        <td key={k} className={cn("px-4 py-2.5 text-right last:pr-5 sm:last:pr-6", k === "ciso" ? "font-semibold text-navy-900" : "text-slate-800")}>
                          {r.get(strategies[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {formatNumber(result.res.simulated.years)} one-year trials. {result.res.simulated.note} Simulated means differ slightly from the analytic values
              above because of sampling.
            </p>
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
