"use client";

import { BookOpen, ShieldQuestion, TrendingUp } from "lucide-react";
import type { InvestmentsResponse, MarginalItem } from "@/lib/types";
import { MISSING, asNumber, asText, formatCurrency, formatFraction, formatPercentValue, splitIds } from "@/lib/format";
import { DisclosureSection } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/states";
import { Kind, NamedIds, sentence } from "@/components/threats/threat-copy";
import { METRIC_TARGET, METRIC_WHY, type Names, invName, scenarioLabel, withNames } from "./planner-copy";

function signed(v: number | undefined) {
  if (v === undefined) return MISSING;
  if (Math.abs(v) < 0.5) return formatCurrency(0, { compact: true });
  return `${v > 0 ? "+" : "−"}${formatCurrency(Math.abs(v), { compact: true })}`;
}

/* ---------- Which investment adds the most value? ---------- */

export function MarginalSection({ items, names, pending }: { items: MarginalItem[]; names: Names; pending: boolean }) {
  const sorted = [...items].sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    return (b.expected_annual_net_benefit_change_usd ?? -Infinity) - (a.expected_annual_net_benefit_change_usd ?? -Infinity);
  });
  return (
    <DisclosureSection
      title="Which investment adds the most value?"
      icon={<TrendingUp className="size-4" aria-hidden />}
      summary="The additional value of adding or removing each investment, given your current plan."
    >
      {!items.length ? (
        <EmptyState message={pending ? "Calculating…" : "No estimates available."} />
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="tabular min-w-full text-sm">
              <caption className="sr-only">Additional value of each investment</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5 pl-5 text-left font-semibold sm:pl-6">Investment</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Change</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Expected loss / yr</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Net benefit / yr</th>
                  <th scope="col" className="px-4 py-2.5 pr-5 text-right font-semibold sm:pr-6">First-year cost</th>
                </tr>
              </thead>
              <tbody className={pending ? "divide-y divide-slate-100 opacity-60" : "divide-y divide-slate-100"}>
                {sorted.map((m) => (
                  <tr key={m.investment_id}>
                    <th scope="row" className="px-4 py-2.5 pl-5 text-left font-medium text-slate-800 sm:pl-6">
                      {invName(names, m.investment_id)}
                    </th>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{m.action === "add" ? "If added" : "If removed"}</td>
                    {m.valid ? (
                      <>
                        <td className={`px-4 py-2.5 text-right ${(m.expected_annual_loss_change_usd ?? 0) < 0 ? "text-emerald-700" : "text-slate-800"}`}>
                          {signed(m.expected_annual_loss_change_usd)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${(m.expected_annual_net_benefit_change_usd ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {signed(m.expected_annual_net_benefit_change_usd)}
                        </td>
                        <td className="px-4 py-2.5 pr-5 text-right text-slate-800 sm:pr-6">
                          {signed(m.first_year_cash_change_usd)}
                          {m.action === "add" && m.within_selected_budget === false && <span className="block text-xs text-rose-700">Over budget</span>}
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="px-4 py-2.5 pr-5 text-right text-xs text-amber-800 sm:pr-6">
                        Not allowed: {withNames(m.reason ?? "violates a model rule", names)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Engine estimates for changing one investment at a time, sorted by net benefit. Because overlapping protections are not stacked, values change as
            your plan changes. <Kind>Modeled (analytic)</Kind>
          </p>
        </>
      )}
    </DisclosureSection>
  );
}

/* ---------- Why do these investments reduce ransomware risk? ---------- */

export function WhySection({ invest, selected, names }: { invest: InvestmentsResponse; selected: string[]; names: Names }) {
  const list = selected.length ? invest.investments.filter((i) => selected.includes(i.id)) : invest.investments;
  return (
    <DisclosureSection
      title="Why do these investments reduce ransomware risk?"
      icon={<ShieldQuestion className="size-4" aria-hidden />}
      summary={selected.length ? "How each investment in your plan changes the hospital's modeled exposure." : "How each investment changes the hospital's modeled exposure."}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Percentages below are the model&apos;s <strong className="font-semibold text-slate-800">assumed</strong> effect on one step of an attack. A 35% lower
          chance of spread does not mean 35% less total risk or loss; the overall effect is what the results above show.
        </p>
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {list.map((inv) => {
            const effects = (invest.control_effectiveness ?? []).filter((r) => r.investment_id === inv.id);
            const metrics = [...new Set(effects.map((e) => String(e.affected_metric)))];
            const src = inv.source_record ?? {};
            const controls = splitIds(src.affected_control_ids);
            const gaps = controls.map((id) => asText(names.control.get(id)?.baseline_gap)).filter((x): x is string => Boolean(x));
            return (
              <li key={inv.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-navy-900">{inv.name}</p>
                <ul className="mt-1.5 space-y-1 text-slate-700">
                  {metrics.map((m) => (
                    <li key={m}>{METRIC_WHY[m] ?? "Changes a modeled attack stage."}</li>
                  ))}
                </ul>
                {gaps.length > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Gap it addresses:</span> {gaps.map((x) => sentence(x)).join("; ")}.
                  </p>
                )}
                {asNumber(src.baseline_coverage_pct) !== null && asNumber(src.target_coverage_pct) !== null && (
                  <p className="tabular mt-1 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Coverage:</span> {formatPercentValue(src.baseline_coverage_pct)} today →{" "}
                    {formatPercentValue(src.target_coverage_pct)}
                  </p>
                )}
                {effects.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {effects.map((e, i) => (
                      <li key={i}>
                        <span className="tabular font-semibold text-navy-800">{formatFraction(e.target_relative_reduction)}</span> lower{" "}
                        {METRIC_TARGET[String(e.affected_metric)] ?? String(e.affected_metric)} · {scenarioLabel(names, String(e.scenario_id))}
                        {asText(e.modeling_note) && <span className="block text-slate-500">{withNames(sentence(e.modeling_note) ?? "", names)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-xs">
                  <span className="font-medium text-slate-700">Protects:</span>
                  <div className="mt-1">
                    <NamedIds ids={splitIds(src.protected_asset_ids)} names={names.asset} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </DisclosureSection>
  );
}

/* ---------- How does the model evaluate investments? ---------- */

const LIMITATIONS = [
  "Investments are all-or-nothing at their target coverage; partial rollouts are not modeled.",
  "Effects apply in full immediately. Implementation time is shown but does not delay benefits.",
  "Overlapping investments are not stacked: only the strongest reduction counts, so some combinations add little or nothing.",
  "The budget covers first-year cost only. Annualized cost assumes the stated useful life with no discounting.",
  "The recommendation maximizes expected net benefit. Bad-year (P90/P95) losses appear only in the simulation.",
  "Faster recovery (backups, drills) shortens downtime but does not reduce modeled patient diversions.",
  "All costs, effect sizes and patient-safety limits are synthetic and need calibration before real use.",
];

export function MethodSection({ invest }: { invest: InvestmentsResponse }) {
  const effectRule = invest.config?.effect_rule as Record<string, unknown> | undefined;
  return (
    <DisclosureSection
      title="How does the model evaluate investments?"
      icon={<BookOpen className="size-4" aria-hidden />}
      summary="The calculation behind the results, and what it leaves out."
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-600">
        <p>
          For every plan, the backend risk engine lowers the affected attack-stage chances (or recovery days) by each investment&apos;s assumed effect,
          recalculates the hospital&apos;s expected annual loss across all attack scenarios, and compares it with today. Nothing is calculated in your browser.
        </p>
        {effectRule && typeof effectRule.single_investment === "string" && (
          <p className="text-xs text-slate-500">Engine effect rule: {effectRule.single_investment}</p>
        )}
        <div>
          <h3 className="font-semibold text-slate-800">Limitations</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </DisclosureSection>
  );
}
