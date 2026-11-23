"use client";

import { Ban, CircleCheck, CircleX, Sparkles, TriangleAlert } from "lucide-react";
import type { DecisionData } from "@/lib/decision";
import type { GuardrailCheck } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { STRATEGY_SERIES } from "@/components/analytics/grouped-bar-chart";

export type StrategyKey = "baseline" | "ciso" | "optimized";

export interface StrategyView {
  key: StrategyKey;
  label: string;
  color: string;
  available: boolean;
  ids: string[];
  cash: number;
  annualized: number;
  loss: number;
  avoided: number;
  net: number;
  events: number;
  recovery: number;
  diverted: number;
  reputation: number;
  guardrails: GuardrailCheck | null;
  withinBudget: boolean | null;
}

const COLOR = Object.fromEntries(STRATEGY_SERIES.map((s) => [s.key, s.color])) as Record<StrategyKey, string>;
const LABEL: Record<StrategyKey, string> = { baseline: "No new investment", ciso: "Your plan", optimized: "Model-recommended plan" };

const unavailable = (key: StrategyKey): StrategyView => ({
  key,
  label: LABEL[key],
  color: COLOR[key],
  available: false,
  ids: [],
  cash: 0,
  annualized: 0,
  loss: 0,
  avoided: 0,
  net: 0,
  events: 0,
  recovery: 0,
  diverted: 0,
  reputation: 0,
  guardrails: null,
  withinBudget: null,
});

/** Map backend evaluate responses to display rows (no arithmetic on model outputs). */
export function buildStrategies(d: DecisionData): StrategyView[] {
  const fromEval = (key: StrategyKey, e: NonNullable<DecisionData["ciso"]>): StrategyView => ({
    key,
    label: LABEL[key],
    color: COLOR[key],
    available: true,
    ids: e.investment_ids,
    cash: e.spending.first_year_cash_usd,
    annualized: e.spending.annualized_spend_usd,
    loss: e.metrics.expected_annual_loss_usd,
    avoided: e.expected_annual_avoided_loss_usd,
    net: e.expected_annual_net_benefit_usd,
    events: e.metrics.expected_events_per_year,
    recovery: e.metrics.expected_annual_recovery_days,
    diverted: e.metrics.expected_annual_diverted_patients,
    reputation: e.metrics.expected_annual_reputation_loss_usd,
    guardrails: e.clinical_guardrails,
    withinBudget: e.budget?.within_selected_budget ?? null,
  });
  return [
    fromEval("baseline", d.baseline),
    d.ciso ? fromEval("ciso", d.ciso) : unavailable("ciso"),
    d.optimizedEval ? fromEval("optimized", d.optimizedEval) : unavailable("optimized"),
  ];
}

const money = (v: number) => `${v < -0.5 ? "−" : ""}${formatCurrency(Math.abs(v))}`;

/** Three strategy columns with the five headline measures and the clinical-safety status. */
export function StrategyColumns({
  strategies,
  names,
  matches,
  cisoInvalid,
  noEligibleMessage,
  minEligibleBudget,
  onSetBudget,
}: {
  strategies: StrategyView[];
  names: Map<string, string>;
  matches: boolean;
  cisoInvalid?: string;
  noEligibleMessage?: string;
  minEligibleBudget?: number | null;
  onSetBudget: (v: number) => void;
}) {
  const maxLoss = Math.max(1, ...strategies.filter((s) => s.available).map((s) => s.loss));
  return (
    <ul className="grid gap-4 lg:grid-cols-3 lg:gap-y-0">
      {strategies.map((s) => {
        const over = s.key === "ciso" && s.withinBudget === false;
        const emptyPlan = s.key === "ciso" && s.available && s.ids.length === 0;
        return (
          <li
            key={s.key}
            className={cn(
              "flex flex-col rounded-xl border bg-white lg:row-span-3 lg:grid lg:[grid-template-rows:subgrid]",
              s.key === "ciso" ? "border-navy-700 shadow-[0_0_0_1px_var(--color-navy-700)]" : "border-slate-200",
            )}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-navy-900">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </h3>
                {s.key === "optimized" && s.available && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    <Sparkles className="size-3" aria-hidden /> Model&apos;s recommendation
                  </span>
                )}
                {s.key === "ciso" && matches && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    <CircleCheck className="size-3" aria-hidden /> Matches the model
                  </span>
                )}
              </div>
              <PlanNames s={s} names={names} emptyPlan={emptyPlan} />
            </div>

            {!s.available ? (
              <div className="flex flex-1 gap-2 px-5 py-5 text-sm text-amber-900">
                <Ban className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <div>
                  {s.key === "ciso" ? (
                    <>
                      <p className="font-medium">Your plan can&apos;t be evaluated as selected.</p>
                      {cisoInvalid && <p className="mt-1">{cisoInvalid}</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-medium">No plan meets the hospital&apos;s required safeguards within this budget.</p>
                      {noEligibleMessage && <p className="mt-1 text-amber-800">{noEligibleMessage}</p>}
                      {typeof minEligibleBudget === "number" && (
                        <button
                          type="button"
                          onClick={() => onSetBudget(minEligibleBudget)}
                          className="mt-3 inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-accent-500"
                        >
                          Raise budget to {formatCurrency(minEligibleBudget)}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <dl className="tabular @container divide-y divide-slate-100 px-5 text-sm">
                <Row label="First-year investment cost" value={formatCurrency(s.cash)} note={over ? "Over the selected budget: not feasible as selected" : undefined} bad={over} />
                <div className="py-2.5">
                  <div className="flex flex-col gap-0.5 @xs:flex-row @xs:items-baseline @xs:justify-between @xs:gap-3">
                    <dt className="text-slate-600">Expected annual ransomware loss</dt>
                    <dd className="text-base font-semibold text-slate-900">{formatCurrency(s.loss)}</dd>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.max((s.loss / maxLoss) * 100, 1)}%`, background: s.color }} />
                  </div>
                </div>
                <Row
                  label="Annual net benefit"
                  value={s.key === "baseline" ? "—" : money(s.net)}
                  note={s.key === "baseline" ? "Reference point" : "Not guaranteed cash savings"}
                  strong
                  good={s.key !== "baseline" && s.net > 0.5}
                  bad={s.key !== "baseline" && s.net < -0.5}
                />
                <Row label="Disruptive incidents per year" value={formatNumber(s.events, 2)} />
                <Row label="Patients diverted per year" value={formatNumber(s.diverted)} />
                <div className="flex flex-col gap-0.5 py-2.5 @xs:flex-row @xs:items-center @xs:justify-between @xs:gap-3">
                  <dt className="text-slate-600">Clinical safety requirements</dt>
                  <dd>
                    {s.guardrails ? (
                      <span className={cn("inline-flex items-center gap-1 text-sm font-medium", s.guardrails.satisfied ? "text-emerald-700" : "text-rose-700")}>
                        {s.guardrails.satisfied ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                        {s.guardrails.satisfied ? "Met" : "Not met"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            )}
            <div>
              {over && (
                <p className="mx-5 mb-4 flex gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Raise the budget or remove an investment before adopting this plan.
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PlanNames({ s, names, emptyPlan }: { s: StrategyView; names: Map<string, string>; emptyPlan: boolean }) {
  if (s.key === "baseline") return <p className="mt-1 text-xs text-slate-500">Today&apos;s protections, nothing new</p>;
  if (!s.available) return <p className="mt-1 text-xs text-slate-500">Not available</p>;
  if (emptyPlan) return <p className="mt-1 text-xs text-slate-500">No investments selected: same as no new investment</p>;
  const labels = s.ids.map((id) => names.get(id) ?? id);
  const shown = labels.slice(0, 2);
  return (
    <div className="mt-1 text-xs text-slate-500">
      <p>
        {shown.join(" · ")}
        {labels.length > 2 && ` + ${labels.length - 2} more`}
      </p>
      {labels.length > 2 && (
        <div className="-ml-1 mt-0.5 text-xs">
          <InlineDisclosure label={`All ${labels.length} investments`}>
            <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
              {labels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </InlineDisclosure>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, note, strong, good, bad }: { label: string; value: string; note?: string; strong?: boolean; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 @xs:flex-row @xs:items-baseline @xs:justify-between @xs:gap-3">
      <dt className="text-slate-600">
        {label}
        {note && <span className={cn("block text-xs", bad ? "text-rose-700" : "text-slate-400")}>{note}</span>}
      </dt>
      <dd className={cn(strong ? "text-base font-semibold" : "font-medium", good ? "text-emerald-700" : bad ? "text-rose-700" : "text-slate-900")}>{value}</dd>
    </div>
  );
}
