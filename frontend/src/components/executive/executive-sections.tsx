"use client";

import { Activity, BookOpen, DollarSign, Sigma } from "lucide-react";
import type { OptimizeResponse } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { DisclosureSection } from "@/components/ui/disclosure";
import { MonteCarloAnalysis } from "@/components/analytics/monte-carlo-analysis";
import type { StrategyView } from "./strategy-columns";

/** Compact metric table: one row per measure, one column per available strategy. */
function MetricTable({ strategies, rows, caption }: { strategies: StrategyView[]; rows: { label: string; note?: string; get: (s: StrategyView) => string }[]; caption: string }) {
  const cols = strategies.filter((s) => s.available);
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="tabular min-w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5 pl-5 text-left font-semibold sm:pl-6">
              <span className="sr-only">Measure</span>
            </th>
            {cols.map((s) => (
              <th key={s.key} scope="col" className="px-4 py-2.5 text-right font-semibold last:pr-5 sm:last:pr-6">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-4 py-2.5 pl-5 text-left font-normal text-slate-700 sm:pl-6">
                {r.label}
                {r.note && <span className="block text-xs text-slate-400">{r.note}</span>}
              </th>
              {cols.map((s) => (
                <td key={s.key} className="px-4 py-2.5 text-right text-slate-900 last:pr-5 sm:last:pr-6">
                  {r.get(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancialDetails({ strategies }: { strategies: StrategyView[] }) {
  return (
    <DisclosureSection
      title="What are the detailed financial tradeoffs?"
      icon={<DollarSign className="size-4" aria-hidden />}
      summary="Annualized cost, avoided losses and reputation losses for each strategy."
    >
      <div className="space-y-3">
        <MetricTable
          caption="Detailed financial comparison"
          strategies={strategies}
          rows={[
            { label: "First-year investment cost", note: "Cash needed in year one (capex + first-year opex)", get: (s) => formatCurrency(s.cash) },
            { label: "Annualized investment cost", note: "Capex spread over its useful life + yearly opex", get: (s) => formatCurrency(s.annualized) },
            { label: "Avoided annual ransomware loss", note: "Compared with no new investment", get: (s) => formatCurrency(s.avoided) },
            { label: "Annual net benefit", note: "Avoided loss − annualized cost", get: (s) => (s.key === "baseline" ? "—" : `${s.net < -0.5 ? "−" : ""}${formatCurrency(Math.abs(s.net))}`) },
            { label: "Reputation loss per year", note: "Already included in expected annual loss", get: (s) => formatCurrency(s.reputation) },
          ]}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          The budget limits <strong className="font-medium text-slate-700">first-year cost</strong>. Net benefit uses the{" "}
          <strong className="font-medium text-slate-700">annualized cost</strong> instead, so the two are never added together.
        </p>
      </div>
    </DisclosureSection>
  );
}

export function OperationsDetails({ strategies }: { strategies: StrategyView[] }) {
  const g = strategies.find((s) => s.guardrails)?.guardrails ?? null;
  return (
    <DisclosureSection
      title="How would hospital operations be affected?"
      icon={<Activity className="size-4" aria-hidden />}
      summary="Recovery days, patient diversions and the clinical safety limits each plan must meet."
    >
      <div className="space-y-3">
        <MetricTable
          caption="Operational comparison"
          strategies={strategies}
          rows={[
            {
              label: "Recovery days per year",
              note: g ? `Limit ${formatNumber(g.recovery_days_limit, 1)} (${formatFraction(g.max_annual_recovery_days_fraction_of_baseline)} of today)` : undefined,
              get: (s) => formatNumber(s.recovery, 1),
            },
            {
              label: "Patients diverted per year",
              note: g ? `Limit ${formatNumber(g.diverted_patients_limit)} (${formatFraction(g.max_annual_diverted_patients_fraction_of_baseline)} of today)` : undefined,
              get: (s) => formatNumber(s.diverted),
            },
            { label: "Clinical safety requirements", get: (s) => (s.guardrails ? (s.guardrails.satisfied ? "Met" : "Not met") : "—") },
          ]}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          The clinical safety requirements are illustrative board limits: a plan must bring both recovery days and diverted patients below the limits shown.
          Diverted patients measure exposure to disruption, not patient harm.
        </p>
      </div>
    </DisclosureSection>
  );
}

export function BadYearSection({ selected, budget, names }: { selected: string[]; budget: number; names: Map<string, string> }) {
  return (
    <DisclosureSection
      title="How do these strategies perform in a bad ransomware year?"
      icon={<Sigma className="size-4" aria-hidden />}
      summary="Typical, bad (P90) and very bad (P95) annual losses for all three strategies, estimated from one-year trials."
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Most years cost little, but a few are very expensive. <strong className="font-medium text-slate-800">P90</strong> is the yearly loss exceeded in only
          1 year in 10; <strong className="font-medium text-slate-800">P95</strong>, in only 1 year in 20. A plan can look best on average and still leave more
          exposure in those bad years.
        </p>
        <MonteCarloAnalysis selected={selected} budget={budget} names={names} />
      </div>
    </DisclosureSection>
  );
}

export function HowRecommended({ optimum, budget }: { optimum?: OptimizeResponse; budget: number }) {
  const o = optimum?.optimization;
  return (
    <DisclosureSection
      title="How does the model recommend investments?"
      icon={<BookOpen className="size-4" aria-hidden />}
      summary="What “model-recommended” means, and what it does not mean."
    >
      <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-600">
        <li>
          The model considers each investment&apos;s cost, its expected effect on ransomware losses, prerequisites between investments, and the clinical safety
          requirements.
        </li>
        <li>
          It recommends the combination with the highest modeled annual net benefit that fits the {formatCurrency(budget)} first-year budget
          {o && (
            <>
              {" "}
              ({formatNumber(o.evaluated_feasible_portfolios)} combinations fit; {formatNumber(o.clinical_eligible_portfolios)} also meet the safety requirements)
            </>
          )}
          .
        </li>
        <li>It does not look for the lowest bad-year (P95) loss or the cheapest plan, and it cannot guarantee the best real-world outcome.</li>
        <li>All costs, effects and limits are illustrative assumptions; the recommendation can change if they change (see Risk Analytics).</li>
      </ul>
    </DisclosureSection>
  );
}
