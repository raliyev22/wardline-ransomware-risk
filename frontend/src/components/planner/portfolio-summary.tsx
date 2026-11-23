"use client";

import { CircleCheck, CircleX, Layers, MousePointerClick } from "lucide-react";
import type { EvaluateResponse } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber } from "@/lib/format";
import { Card, CardBody, cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { LoadingState } from "@/components/ui/states";
import { Kind } from "@/components/threats/threat-copy";
import { METRIC_TARGET, type Names, invName, joinNames, scenarioLabel } from "./planner-copy";

/** Live engine evaluation of the current plan: spend, savings, remaining risk, guardrails and overlaps. */
export function PlanResults({ evaluation, loading, names }: { evaluation?: EvaluateResponse; loading: boolean; names: Names }) {
  if (!evaluation) {
    return (
      <Card>
        <CardBody>
          <LoadingState label="Evaluating your plan" rows={5} />
        </CardBody>
      </Card>
    );
  }
  const m = evaluation.metrics;
  const b = evaluation.baseline_metrics;
  const g = evaluation.clinical_guardrails;
  const empty = evaluation.investment_ids.length === 0;
  const net = evaluation.expected_annual_net_benefit_usd;
  const maxLoss = Math.max(1, b.expected_annual_loss_usd, m.expected_annual_loss_usd);

  return (
    <Card className={cn(loading && "opacity-70 transition-opacity")}>
      <CardBody className="space-y-5">
        {empty && (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <MousePointerClick className="size-4 shrink-0 text-navy-600" aria-hidden />
            Select investments above to see how they change the hospital&apos;s expected ransomware losses.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="How much we spend" value={formatCurrency(evaluation.spending.first_year_cash_usd)} hint="First-year investment cost" />
          <Tile
            label="How much we could save"
            value={formatCurrency(evaluation.expected_annual_avoided_loss_usd)}
            hint="Estimated annual loss reduction"
            tone={evaluation.expected_annual_avoided_loss_usd > 0 ? "good" : undefined}
            emphasis
          />
          <Tile label="Risk that remains" value={formatCurrency(m.expected_annual_loss_usd)} hint="Expected annual ransomware loss after your plan" />
          <Tile
            label="Net benefit"
            value={`${net < 0 ? "−" : ""}${formatCurrency(Math.abs(net))}`}
            hint="Savings minus annualized investment cost, per year"
            tone={empty ? undefined : net >= 0 ? "good" : "bad"}
          />
        </div>

        <figure className="rounded-lg border border-slate-200 p-4">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium">Expected annual ransomware loss</span>
            <Kind>Modeled estimate · not guaranteed</Kind>
          </figcaption>
          <ul className="mt-3 space-y-2.5">
            {[
              { label: "Current protections", value: b.expected_annual_loss_usd, color: "var(--color-slate-400)" },
              { label: "After your investments", value: m.expected_annual_loss_usd, color: "var(--color-navy-800)" },
            ].map((r) => (
              <li key={r.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_6.5rem]">
                <span className="text-slate-600">{r.label}</span>
                <span className="h-4 rounded-r-[4px] bg-slate-50">
                  <span
                    className="block h-full rounded-r-[4px] transition-[width] duration-300"
                    style={{ width: `${Math.max((r.value / maxLoss) * 100, 0.5)}%`, background: r.color }}
                  />
                </span>
                <span className="tabular text-right font-semibold text-slate-900">{formatCurrency(r.value, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </figure>

        {!empty && (
          <div
            role={g.satisfied ? undefined : "alert"}
            className={cn("rounded-lg border px-4 py-3 text-sm", g.satisfied ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50")}
          >
            <p className={cn("flex items-center gap-2 font-medium", g.satisfied ? "text-emerald-800" : "text-amber-950")}>
              {g.satisfied ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
              {g.satisfied ? "Meets the hospital's patient-safety requirements" : "Does not yet meet the hospital's patient-safety requirements"}
            </p>
            <ul className="tabular mt-1.5 space-y-0.5 text-xs text-slate-700">
              <GuardLine
                ok={g.recovery_days_satisfied}
                text={`Recovery days per year: ${formatNumber(m.expected_annual_recovery_days, 1)} (must be at most ${formatNumber(g.recovery_days_limit, 1)}, ${formatFraction(g.max_annual_recovery_days_fraction_of_baseline)} of today)`}
              />
              <GuardLine
                ok={g.diverted_patients_satisfied}
                text={`Diverted patients per year: ${formatNumber(m.expected_annual_diverted_patients)} (must be at most ${formatNumber(g.diverted_patients_limit)}, ${formatFraction(g.max_annual_diverted_patients_fraction_of_baseline)} of today)`}
              />
            </ul>
            {!g.diverted_patients_satisfied && (
              <p className="mt-1.5 text-xs text-amber-900">
                To reduce diverted patients, add protections that stop attacks or limit their spread. In this model, faster recovery alone does not reduce
                diversions.
              </p>
            )}
            {!g.recovery_days_satisfied && (
              <p className="mt-1 text-xs text-amber-900">To reduce recovery days, add protections that prevent incidents or speed up recovery.</p>
            )}
          </div>
        )}

        {evaluation.effects.overlaps.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <Layers className="size-4 text-navy-600" aria-hidden /> Some of your investments overlap
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
              {evaluation.effects.overlaps.map((o) => (
                <li key={`${o.scenario_id}-${o.affected_metric}`}>
                  {joinNames(o.applied_investments.map((id) => invName(names, id)))} and {joinNames(o.superseded_investments.map((id) => invName(names, id)))} both
                  reduce {METRIC_TARGET[o.affected_metric] ?? o.affected_metric} ({scenarioLabel(names, o.scenario_id)}). The model counts only the stronger one,
                  so {joinNames(o.superseded_investments.map((id) => invName(names, id)))} adds nothing there.
                </li>
              ))}
            </ul>
          </div>
        )}

        <InlineDisclosure label="More results and definitions">
          <div className="space-y-3">
            <dl className="tabular grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Small label="Disruptive incidents / yr" value={formatNumber(m.expected_events_per_year, 2)} before={formatNumber(b.expected_events_per_year, 2)} />
              <Small label="Recovery days / yr" value={formatNumber(m.expected_annual_recovery_days, 1)} before={formatNumber(b.expected_annual_recovery_days, 1)} />
              <Small label="Diverted patients / yr" value={formatNumber(m.expected_annual_diverted_patients)} before={formatNumber(b.expected_annual_diverted_patients)} />
              <Small
                label="Reputation loss / yr"
                value={formatCurrency(m.expected_annual_reputation_loss_usd, { compact: true })}
                before={formatCurrency(b.expected_annual_reputation_loss_usd, { compact: true })}
              />
            </dl>
            <dl className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div>
                <dt className="font-medium text-slate-800">Estimated annual loss reduction (savings)</dt>
                <dd className="text-slate-600">How much lower expected yearly ransomware losses are, before counting what the investments cost.</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-800">Net benefit</dt>
                <dd className="text-slate-600">
                  Savings minus the annualized cost of the investments ({formatCurrency(evaluation.spending.annualized_spend_usd)} per year for your plan).
                  Positive means the modeled savings outweigh the cost.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-800">Expected annual loss</dt>
                <dd className="text-slate-600">The model&apos;s average yearly ransomware cost. Reputation loss is already included; patient figures are not converted to dollars.</dd>
              </div>
            </dl>
          </div>
        </InlineDisclosure>
      </CardBody>
    </Card>
  );
}

function Tile({ label, value, hint, tone, emphasis }: { label: string; value: string; hint: string; tone?: "good" | "bad"; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3.5", emphasis ? "border-navy-200 bg-navy-50/60" : "border-slate-200 bg-white")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("tabular mt-1.5 text-xl font-semibold", tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-900")}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Small({ label, value, before }: { label: string; value: string; before: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
      <dd className="text-[11px] text-slate-400">Today {before}</dd>
    </div>
  );
}

function GuardLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-1.5">
      {ok ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden /> : <CircleX className="mt-0.5 size-3.5 shrink-0 text-rose-600" aria-hidden />}
      {text}
    </li>
  );
}
