"use client";

import { Ban, Check, Layers, TriangleAlert } from "lucide-react";
import type { InvestmentItem, JsonRecord, MarginalItem } from "@/lib/types";
import { MISSING, asNumber, asText, formatCurrency, formatFraction, formatNumber, formatPercentValue, splitIds } from "@/lib/format";
import { cn } from "@/components/ui/card";
import { Chevron, DisclosurePanel, useDisclosure } from "@/components/ui/disclosure";
import { Detail, Kind, NamedIds } from "@/components/threats/threat-copy";
import { METRIC_PURPOSE, METRIC_TARGET, type Names, invName, joinNames, scenarioLabel } from "./planner-copy";

function signed(v: number | undefined) {
  if (v === undefined) return "—";
  if (Math.abs(v) < 0.5) return formatCurrency(0, { compact: true });
  return `${v > 0 ? "+" : "−"}${formatCurrency(Math.abs(v), { compact: true })}`;
}

export function investmentPurpose(effects: JsonRecord[]): string | null {
  const metrics = [...new Set(effects.map((e) => String(e.affected_metric ?? "")))].filter((m) => METRIC_PURPOSE[m]);
  return metrics.length ? metrics.map((m) => METRIC_PURPOSE[m]).join(" · ") : null;
}

export function InvestmentCard({
  inv,
  selected,
  selectedIds,
  requiredBy,
  marginal,
  effects,
  names,
  pending,
  onToggle,
}: {
  inv: InvestmentItem;
  selected: boolean;
  selectedIds: string[];
  /** Investments in the current plan that list this one as a prerequisite. */
  requiredBy: string[];
  marginal?: MarginalItem;
  effects: JsonRecord[];
  names: Names;
  pending: boolean;
  onToggle: () => void;
}) {
  const d = useDisclosure(false);
  const src = inv.source_record ?? {};
  const invalid = marginal && !marginal.valid;
  const overBudget = marginal?.valid && marginal.action === "add" && marginal.within_selected_budget === false;
  const blocked = Boolean(!selected && (invalid || overBudget));
  const blockedRemove = Boolean(selected && invalid);
  const disabled = pending || !marginal || blocked || blockedRemove;
  const purpose = investmentPurpose(effects) ?? "Listed as relevant to the modeled scenarios";
  const controls = splitIds(src.affected_control_ids);
  const base = asNumber(src.baseline_coverage_pct);
  const target = asNumber(src.target_coverage_pct);
  const months = asNumber(src.implementation_months);

  return (
    <li
      className={cn(
        "flex flex-col rounded-xl border bg-white transition-[border-color,box-shadow]",
        selected ? "border-navy-700 shadow-[0_0_0_1px_var(--color-navy-700)]" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!disabled) onToggle();
        }}
        aria-disabled={disabled}
        aria-describedby={`${d.panelId}-status`}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-start gap-3 rounded-t-xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:p-5",
          disabled && !pending && "cursor-not-allowed",
          pending && "cursor-progress",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            selected ? "border-navy-800 bg-navy-900 text-white" : blocked ? "border-slate-200 bg-slate-50 text-slate-300" : "border-slate-300 bg-white",
          )}
          aria-hidden
        >
          {selected ? <Check className="size-3.5" /> : blocked ? <Ban className="size-3" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className={cn("font-semibold", blocked ? "text-slate-500" : "text-navy-900")}>{inv.name}</span>
            <span className="tabular shrink-0 text-right">
              <span className="block text-base font-semibold text-slate-900">{formatCurrency(inv.first_year_cash_usd, { compact: true })}</span>
              <span className="block text-[10px] uppercase tracking-wide text-slate-400">first year</span>
            </span>
          </span>
          <span className="mt-0.5 block text-sm text-slate-600">{purpose}</span>
          <span className="sr-only">{selected ? ", selected" : ", not selected"}</span>
        </span>
      </button>

      <div id={`${d.panelId}-status`} className="space-y-2 px-4 pb-3 sm:px-5">
        <Status inv={inv} marginal={marginal} selected={selected} selectedIds={selectedIds} requiredBy={requiredBy} names={names} pending={pending} />
      </div>

      <div className="mt-auto border-t border-slate-100">
        <button
          type="button"
          id={d.buttonId}
          aria-expanded={d.open}
          aria-controls={d.panelId}
          onClick={d.toggle}
          className="flex w-full items-center justify-between gap-2 rounded-b-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 sm:px-5"
        >
          {d.open ? "Hide details" : "Details: costs, effects and what it protects"}
          <Chevron open={d.open} />
        </button>
        <DisclosurePanel open={d.open} id={d.panelId} labelledBy={d.buttonId}>
          <dl className="@container divide-y divide-slate-50 px-4 pb-4 sm:px-5">
            <Detail label="Cost">
              <span className="tabular">
                {formatCurrency(inv.capex_usd)} one-time · {formatCurrency(inv.annual_opex_usd)} per year
              </span>
              <span className="tabular block text-xs text-slate-500">
                First-year cost {formatCurrency(inv.first_year_cash_usd)} · annualized {formatCurrency(inv.annualized_spend_usd)} / yr
              </span>
            </Detail>
            <Detail label="Time to implement">{months !== null ? `${formatNumber(months)} months` : MISSING}</Detail>
            <Detail label="Strengthens">
              {controls.length ? controls.map((id) => asText(names.control.get(id)?.control_name) ?? id).join(", ") : MISSING}
              {base !== null && target !== null && (
                <span className="tabular block text-xs text-slate-500">
                  Coverage {formatPercentValue(base)} today → {formatPercentValue(target)} target
                </span>
              )}
            </Detail>
            <Detail label="Assumed effect">
              {effects.length ? (
                <ul className="space-y-1">
                  {effects.map((e, i) => (
                    <li key={i}>
                      <span className="tabular font-semibold text-navy-800">{formatFraction(e.target_relative_reduction)}</span> lower{" "}
                      {METRIC_TARGET[String(e.affected_metric)] ?? String(e.affected_metric)}
                      <span className="text-slate-500"> · {scenarioLabel(names, String(e.scenario_id))}</span>
                    </li>
                  ))}
                  <li className="text-xs text-slate-500">
                    <Kind>Engine assumption</Kind> at full implementation; not a cut in total risk or loss.
                  </li>
                </ul>
              ) : (
                <span className="text-slate-500">No stage effect defined in the engine inputs.</span>
              )}
            </Detail>
            <Detail label="Protects">
              <NamedIds ids={splitIds(src.protected_asset_ids)} names={names.asset} />
            </Detail>
            <Detail label="Relevant attacks">
              {splitIds(src.relevant_scenario_ids).map((s) => scenarioLabel(names, s)).join(", ") || MISSING}
            </Detail>
            <Detail label="Prerequisites">{inv.requires.length ? inv.requires.map((id) => invName(names, id)).join(", ") : "None"}</Detail>
            <Detail label="Reference">
              <span className="font-mono text-xs text-slate-400">
                {inv.id}
                {asText(src.domain) && ` · ${src.domain}`}
              </span>
            </Detail>
          </dl>
        </DisclosurePanel>
      </div>
    </li>
  );
}

/** Always-visible status: blocked reasons, overlaps and the engine's "if added / removed" estimate. */
function Status({
  inv,
  marginal,
  selected,
  selectedIds,
  requiredBy,
  names,
  pending,
}: {
  inv: InvestmentItem;
  marginal?: MarginalItem;
  selected: boolean;
  selectedIds: string[];
  requiredBy: string[];
  names: Names;
  pending: boolean;
}) {
  if (!marginal) return <p className="text-xs text-slate-400">{pending ? "Checking with the risk model…" : "No estimate available."}</p>;

  if (!marginal.valid) {
    const missing = inv.requires.filter((id) => !selectedIds.includes(id));
    return (
      <p className="flex gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
        <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {selected
          ? `${joinNames(requiredBy.map((id) => invName(names, id))) || "Another investment in your plan"} depends on this one. Remove ${requiredBy.length === 1 ? "it" : "them"} first to drop this investment.`
          : missing.length
            ? `Needs ${joinNames(missing.map((id) => invName(names, id)))} first. Add it to unlock this investment.`
            : /budget/i.test(marginal.reason ?? "")
              ? "Does not fit in your remaining budget. Raise the budget or remove another investment."
              : "This combination is not allowed by the model's rules."}
      </p>
    );
  }

  const loss = marginal.expected_annual_loss_change_usd;
  const net = marginal.expected_annual_net_benefit_change_usd;
  const overlapWith = [...new Set((marginal.overlaps ?? []).flatMap((o) => (marginal.action === "add" ? o.previously_applied : o.applied_investments)))].filter(
    (id) => id !== inv.id,
  );

  return (
    <div className={cn("space-y-1.5 text-xs", pending && "opacity-60")}>
      <p className="tabular flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600">
        <span className="text-slate-500">{marginal.action === "add" ? "If added:" : "If removed:"}</span>
        <span>
          expected loss <strong className={cn("font-semibold", loss !== undefined && loss < 0 ? "text-emerald-700" : loss ? "text-rose-700" : "text-slate-700")}>{signed(loss)}</strong>/yr
        </span>
        <span>
          net benefit <strong className={cn("font-semibold", net !== undefined && net >= 0 ? "text-emerald-700" : "text-rose-700")}>{signed(net)}</strong>/yr
        </span>
      </p>
      {marginal.action === "add" && marginal.within_selected_budget === false && (
        <p className="flex gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-rose-800">
          <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Does not fit in your remaining budget.
        </p>
      )}
      {marginal.no_additional_effect && (
        <p className="flex gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-900">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Adds no extra protection here: {joinNames(overlapWith.map((id) => invName(names, id))) || "an investment in your plan"} already covers the same
          protection as strongly or more.
        </p>
      )}
      {!marginal.no_additional_effect && overlapWith.length > 0 && (
        <p className="flex gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-700">
          <Layers className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Overlaps with {joinNames(overlapWith.map((id) => invName(names, id)))}. The model counts only the stronger of overlapping protections, not both.
        </p>
      )}
      {selected && marginal.action === "remove" && loss !== undefined && Math.abs(loss) < 0.5 && (
        <p className="text-slate-500">Currently adds no modeled loss reduction: an overlapping protection in your plan is as strong or stronger.</p>
      )}
    </div>
  );
}
