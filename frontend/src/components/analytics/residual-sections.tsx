"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, CircleAlert, Pencil, Wallet } from "lucide-react";
import type { ApiError } from "@/lib/api";
import type { AttackStageModel, EvaluateResponse } from "@/lib/types";
import { formatCurrency, formatFraction, formatNumber, humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, cn } from "@/components/ui/card";
import { DisclosureCard, DisclosureSection } from "@/components/ui/disclosure";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Kind } from "@/components/threats/threat-copy";
import { type Names, invName, joinNames } from "@/components/planner/planner-copy";

export const BEFORE = "var(--chart-current)";
export const AFTER = "var(--chart-funded)";

/* ---------- Which plan is being analyzed ---------- */

export function PlanContext({
  selected,
  budget,
  engineBudget,
  names,
  evaluation,
  invalidMessage,
}: {
  selected: string[];
  budget: number;
  engineBudget: number;
  names: Names;
  evaluation?: EvaluateResponse;
  invalidMessage?: string;
}) {
  const over = evaluation?.budget?.within_selected_budget === false;
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            <Wallet className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              Analyzing your investment plan
              {invalidMessage ? (
                <Badge tone="danger">Not a valid plan</Badge>
              ) : over ? (
                <Badge tone="danger">Over budget</Badge>
              ) : selected.length && evaluation ? (
                <Badge tone="success">Within budget</Badge>
              ) : null}
            </p>
            {selected.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {selected.map((id) => (
                  <li key={id} className="rounded-md bg-navy-50 px-2 py-1 text-xs font-medium text-navy-800">
                    {invName(names, id)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-sm text-slate-600">No new investments selected, so this page shows the hospital&apos;s current baseline risk.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Budget {formatCurrency(budget)}
              {budget === engineBudget && " (model maximum)"} · chosen in the Investment Planner
            </p>
          </div>
        </div>
        <Link
          href="/investments"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500"
        >
          <Pencil className="size-3.5" aria-hidden /> Change plan
        </Link>
      </CardBody>
    </Card>
  );
}

/* ---------- How much ransomware risk remains? ---------- */

export function RemainingRisk({
  evaluation,
  loading,
  error,
  invalidMessage,
  onRetry,
}: {
  evaluation?: EvaluateResponse;
  loading: boolean;
  error?: ApiError;
  invalidMessage?: string;
  onRetry: () => void;
}) {
  if (invalidMessage) {
    return (
      <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-5 py-4 text-sm text-rose-900">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
        <div>
          <p className="font-semibold">This plan can&apos;t be analyzed as selected.</p>
          <p className="mt-1">{invalidMessage}</p>
          <Link href="/investments" className="mt-2 inline-block font-medium text-rose-800 underline underline-offset-2">
            Fix it in the Investment Planner
          </Link>
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Residual risk unavailable" compact />;
  if (!evaluation) return <LoadingState label="Calculating residual risk" rows={4} />;

  const m = evaluation.metrics;
  const b = evaluation.baseline_metrics;
  const empty = evaluation.investment_ids.length === 0;
  const over = evaluation.budget?.within_selected_budget === false;
  const g = evaluation.clinical_guardrails;

  return (
    <div className={cn("space-y-3", loading && "opacity-70 transition-opacity")}>
      {over && (
        <p role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          This plan costs more than the selected budget, so it is not a feasible plan yet. The figures show its modeled risk if it were funded.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          emphasis
          label="Remaining annual ransomware risk"
          value={formatCurrency(m.expected_annual_loss_usd)}
          hint={empty ? "Expected annual loss with today's protections" : "Expected annual loss after your plan"}
        />
        <Tile
          label="Estimated annual loss reduction"
          value={formatCurrency(evaluation.expected_annual_avoided_loss_usd)}
          hint={`Compared with today's ${formatCurrency(b.expected_annual_loss_usd, { compact: true })}`}
          good={evaluation.expected_annual_avoided_loss_usd > 0}
        />
        <Tile
          label="Disruptive incidents per year"
          value={formatNumber(m.expected_events_per_year, 2)}
          hint={`Expected number, not dollars · today ${formatNumber(b.expected_events_per_year, 2)}`}
        />
        <Tile
          label="Patients diverted per year"
          value={formatNumber(m.expected_annual_diverted_patients)}
          hint={`Expected · today ${formatNumber(b.expected_annual_diverted_patients)}`}
        />
      </div>
      {!empty && !g.satisfied && (
        <p className="text-xs text-amber-800">This plan does not yet meet the hospital&apos;s patient-safety limits on diverted patients and recovery days.</p>
      )}
    </div>
  );
}

function Tile({ label, value, hint, emphasis, good }: { label: string; value: string; hint: string; emphasis?: boolean; good?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3.5", emphasis ? "border-navy-200 bg-navy-50/60" : "border-slate-200 bg-white")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("tabular mt-1.5 text-xl font-semibold", good ? "text-emerald-700" : "text-slate-900")}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/* ---------- How much safer are we now? ---------- */

export function BeforeAfter({ evaluation }: { evaluation: EvaluateResponse }) {
  const m = evaluation.metrics;
  const b = evaluation.baseline_metrics;
  const changed = evaluation.expected_annual_avoided_loss_usd > 0.5;
  const pairs = [
    { label: "Expected annual ransomware loss", before: b.expected_annual_loss_usd, after: m.expected_annual_loss_usd, fmt: (v: number) => formatCurrency(v, { compact: true }) },
    { label: "Disruptive incidents per year", before: b.expected_events_per_year, after: m.expected_events_per_year, fmt: (v: number) => formatNumber(v, 2) },
  ];
  return (
    <Card>
      <CardBody className="space-y-4">
        <p className="text-sm text-slate-700">
          {evaluation.investment_ids.length === 0
            ? "No investments are selected, so today's exposure is unchanged."
            : changed
              ? "Your selected protections reduce modeled ransomware exposure, but some risk remains."
              : "Your selection does not reduce modeled ransomware exposure."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {pairs.map((p) => {
            const max = Math.max(1e-9, p.before, p.after);
            return (
              <figure key={p.label} className="rounded-lg border border-slate-200 p-4">
                <figcaption className="text-xs font-medium text-slate-500">{p.label}</figcaption>
                <ul className="mt-3 space-y-2">
                  {[
                    { name: "Before investment", v: p.before, color: BEFORE },
                    { name: "After your plan", v: p.after, color: AFTER },
                  ].map((r) => (
                    <li key={r.name} className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
                      <span className="text-slate-600">{r.name}</span>
                      <span className="h-4 rounded-r-[4px] bg-slate-50">
                        <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max((r.v / max) * 100, 0.5)}%`, background: r.color }} />
                      </span>
                      <span className="tabular text-right font-semibold text-slate-900">{p.fmt(r.v)}</span>
                    </li>
                  ))}
                </ul>
              </figure>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Modeled averages under current assumptions <Kind>Modeled (analytic)</Kind>. No plan makes the hospital completely safe.
        </p>
      </CardBody>
    </Card>
  );
}

/* ---------- What could still go wrong? ---------- */

const STAGE_KEYS: { stage: string; metric: string; label: string }[] = [
  { stage: "initial_access", metric: "initial_access", label: "Chance of gaining access" },
  { stage: "deployment", metric: "deployment", label: "Chance of deploying ransomware after access" },
  { stage: "major_spread", metric: "major_spread", label: "Chance of spreading after deployment" },
  { stage: "severe_given_major_spread", metric: "", label: "Chance of becoming severe after a major spread" },
];

export function RemainingThreats({ models, evaluation, names }: { models: AttackStageModel[]; evaluation?: EvaluateResponse; names: Names }) {
  const entries = evaluation?.effects.entries ?? [];
  const allScenario = entries.filter((e) => e.scenario_id === "all");
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        All three attack paths remain possible after investing. The model does not report remaining loss for each attack separately, so dollar figures here
        are <strong className="font-semibold text-slate-800">today&apos;s, before investment</strong>; the overall residual risk is shown above.
        {allScenario.length > 0 && (
          <> Faster recovery from {joinNames([...new Set(allScenario.flatMap((e) => e.applied_investments))].map((id) => invName(names, id)))} helps against every attack.</>
        )}
      </p>
      <ul className="grid items-start gap-3 lg:grid-cols-3">
        {models.map((m) => {
          const mine = entries.filter((e) => e.scenario_id === m.scenario_id);
          const strongest = Math.max(0, ...mine.map((e) => e.applied_relative_reduction));
          const actingIds = [...new Set(mine.flatMap((e) => e.applied_investments))];
          const name = names.scenario.get(m.scenario_id) ?? humanize(m.scenario_id);
          return (
            <li key={m.scenario_id}>
              <DisclosureCard
                header={
                  <>
                    <span className="block font-semibold text-navy-900">{name}</span>
                    <span className="tabular mt-1 block text-sm text-slate-600">
                      {formatCurrency(m.expected_annual_loss_contribution_usd, { compact: true })}/yr expected loss today
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-slate-600">
                      {actingIds.length ? (
                        <>
                          Your plan targets this attack with {joinNames(actingIds.map((id) => invName(names, id)))}. Attempts still occur (
                          {formatNumber(m.relevant_attempts_per_year, 1)} a year) and the strongest assumed reduction at any step is{" "}
                          {formatFraction(strongest)}.
                        </>
                      ) : (
                        <>
                          None of your selected investments target this attack path, so its chances of success are unchanged (
                          {formatNumber(m.relevant_attempts_per_year, 1)} attempts a year).
                        </>
                      )}
                    </span>
                  </>
                }
              >
                <dl className="space-y-2 text-sm">
                  {STAGE_KEYS.map((k) => {
                    const st = m.stages.find((s) => s.stage === k.stage);
                    const applied = mine.find((e) => e.affected_metric === k.metric);
                    if (!st) return null;
                    return (
                      <div key={k.stage}>
                        <dt className="text-xs text-slate-500">{k.label}</dt>
                        <dd className="tabular text-slate-800">
                          {formatFraction(st.triangular_mean, 1)} today
                          {applied && (
                            <span className="text-navy-800">
                              {" "}
                              · your plan assumes {formatFraction(applied.applied_relative_reduction)} lower
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                  <div>
                    <dt className="text-xs text-slate-500">Ransomware launches per year today</dt>
                    <dd className="tabular text-slate-800">{formatNumber(m.expected_deployments_per_year, 2)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-slate-500">
                  <Kind>Engine assumption</Kind> Lower chances apply to one step only; they are not reductions in this attack&apos;s total loss.
                </p>
              </DisclosureCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- How these estimates are made ---------- */

export function MethodSection() {
  return (
    <DisclosureSection
      title="How these estimates are made"
      icon={<BookOpen className="size-4" aria-hidden />}
      summary="Where the numbers on this page come from."
    >
      <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-600">
        <li>
          Remaining risk, incidents and patient figures are the risk engine&apos;s analytic expected values for your plan, using average probabilities and costs.
        </li>
        <li>Bad-year figures come from thousands of one-year Monte Carlo trials. The simulated average can vary with the random sample.</li>
        <li>Investments lower specific attack steps by assumed amounts; overlapping protections are not added up.</li>
        <li>All inputs are synthetic and illustrative, and the results are not validated forecasts.</li>
      </ul>
    </DisclosureSection>
  );
}

export function SectionHeading({ id, n, title, children }: { id: string; n: number; title: string; children?: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-navy-900">
        <span className="flex size-6 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">{n}</span>
        {title}
      </h2>
      {children && <p className="mt-0.5 pl-8 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

