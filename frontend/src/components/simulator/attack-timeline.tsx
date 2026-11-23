"use client";

import { ChevronLeft, ChevronRight, Flag, Wrench } from "lucide-react";
import { SEVERITIES } from "@/lib/simulator";
import type { AttackStageModel, SeverityDetail, SeverityKey } from "@/lib/types";
import { MISSING, formatFraction, formatNumber } from "@/lib/format";
import { Card, CardBody, CardHeader, cn } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { SEVERITY_PLAIN } from "./sim-copy";

type Node = { kind: "step"; text: string } | { kind: "outcome" } | { kind: "recovery" };

/**
 * Crisis timeline: the scenario's source-defined attack sequence (ordered, not timed), then the selected
 * severity outcome, then disruption & recovery with the engine's recovery-day range for that severity.
 */
export function AttackTimeline({
  steps,
  active,
  onActive,
  severity,
  detail,
  model,
}: {
  steps: string[];
  active: number;
  onActive: (i: number) => void;
  severity: SeverityKey;
  detail?: SeverityDetail;
  model?: AttackStageModel;
}) {
  const nodes: Node[] = [...steps.map((text) => ({ kind: "step" as const, text })), { kind: "outcome" }, { kind: "recovery" }];
  const current = Math.min(active, nodes.length - 1);
  const node = nodes[current];
  const sev = SEVERITIES.find((s) => s.key === severity)!;
  const rec = detail?.recovery_days;
  const recoveryChip = rec ? `~${formatNumber(rec.mode, 0)} days` : null;
  const titleOf = (n: Node) => (n.kind === "step" ? n.text : n.kind === "outcome" ? `${SEVERITY_PLAIN[severity].title} incident` : "Disruption & recovery");

  return (
    <Card>
      <CardHeader
        title="How could this attack unfold?"
        description="Step through the attack, the incident and the recovery. Select any step for details."
      />
      <CardBody>
        {steps.length === 0 ? (
          <EmptyState message="This scenario has no attack sequence in the source data." />
        ) : (
          <>
            <ol className="relative grid gap-1 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:gap-0" style={{ ["--n" as string]: nodes.length }}>
              {nodes.map((n, i) => {
                const done = i < current;
                const isCurrent = i === current;
                return (
                  <li key={i} className="relative flex md:flex-col md:items-center">
                    {i < nodes.length - 1 && (
                      <span
                        className={cn("absolute hidden h-0.5 md:left-1/2 md:top-4 md:block md:w-full", done ? "bg-navy-700" : "bg-slate-200")}
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onActive(i)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-controls="crisis-step-detail"
                      className="group relative z-10 flex w-full items-center gap-3 rounded-lg p-1.5 text-left focus-visible:outline-2 focus-visible:outline-accent-500 md:flex-col md:gap-2 md:text-center"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                          isCurrent && n.kind === "step" && "border-navy-800 bg-navy-900 text-white",
                          isCurrent && n.kind === "outcome" && "border-rose-600 bg-rose-600 text-white",
                          isCurrent && n.kind === "recovery" && "border-accent-600 bg-accent-600 text-white",
                          !isCurrent && done && "border-navy-700 bg-white text-navy-800",
                          !isCurrent && !done && n.kind === "step" && "border-slate-300 bg-white text-slate-500 group-hover:border-navy-300",
                          !isCurrent && !done && n.kind === "outcome" && "border-rose-300 bg-white text-rose-600",
                          !isCurrent && !done && n.kind === "recovery" && "border-accent-300 bg-white text-accent-700",
                        )}
                      >
                        {n.kind === "outcome" ? <Flag className="size-3.5" aria-hidden /> : n.kind === "recovery" ? <Wrench className="size-3.5" aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0 md:px-1">
                        <span className={cn("block text-xs leading-snug", isCurrent ? "font-semibold text-navy-900" : "text-slate-600")}>{titleOf(n)}</span>
                        {n.kind === "recovery" && recoveryChip && <span className="tabular block text-[11px] text-accent-700">{recoveryChip}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div id="crisis-step-detail" aria-live="polite" className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
                    {node.kind === "step" ? `The attack · step ${current + 1} of ${steps.length}` : node.kind === "outcome" ? "The incident" : "The aftermath"}
                  </p>
                  <p className="mt-1 text-base font-semibold text-navy-900">{titleOf(node)}</p>

                  {node.kind === "step" && (
                    <>
                      <p className="mt-1 text-sm text-slate-600">One step of the attacker&apos;s path in this scenario.</p>
                      {model && (
                        <p className="mt-2 text-sm text-slate-600">
                          Along these steps the model checks two things: does the attacker get in (
                          <Pct v={model.stages.find((s) => s.stage === "initial_access")?.triangular_mean} /> of attempts), and is ransomware launched (
                          <Pct v={model.stages.find((s) => s.stage === "deployment")?.triangular_mean} /> after access)?
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Timing not modeled: the scenario data gives the order of steps, not how long each takes.</p>
                    </>
                  )}

                  {node.kind === "outcome" && (
                    <>
                      <p className="mt-1 text-sm text-slate-600">{SEVERITY_PLAIN[severity].summary}</p>
                      <p className="mt-2 text-xs text-slate-500">Model definition: {sev.branch}</p>
                      {typeof model?.severity_branch_weights_given_deployment?.[severity] === "number" && (
                        <p className="mt-1 text-xs text-slate-500">
                          In this scenario, <Pct v={model.severity_branch_weights_given_deployment[severity]} /> of ransomware deployments end as a{" "}
                          {sev.label.toLowerCase()} incident.
                        </p>
                      )}
                    </>
                  )}

                  {node.kind === "recovery" && (
                    <>
                      <p className="mt-1 text-sm text-slate-600">Affected systems are restored while staff work around the outage.</p>
                      {rec ? (
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                          <Fact label="Recovery time (most likely)" value={`${formatNumber(rec.mode, 1)} days`} sub={`Range ${formatNumber(rec.low, 1)}–${formatNumber(rec.high, 1)} days`} />
                          <Fact
                            label="Patients diverted (most likely)"
                            value={formatNumber(detail?.clinical_indicators.diverted_patients?.mode)}
                            sub={detail?.clinical_indicators.diverted_patients ? `Range ${formatNumber(detail.clinical_indicators.diverted_patients.low)}–${formatNumber(detail.clinical_indicators.diverted_patients.high)}` : undefined}
                          />
                          <Fact
                            label="Appointments delayed (most likely)"
                            value={formatNumber(detail?.clinical_indicators.delayed_appointments?.mode)}
                            sub={detail?.clinical_indicators.delayed_appointments ? `Range ${formatNumber(detail.clinical_indicators.delayed_appointments.low)}–${formatNumber(detail.clinical_indicators.delayed_appointments.high)}` : undefined}
                          />
                        </dl>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">{MISSING}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Assumptions for any {sev.label.toLowerCase()} incident; the same for every attack scenario.</p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onActive(Math.max(0, current - 1))}
                    disabled={current === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" aria-hidden /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => onActive(Math.min(nodes.length - 1, current + 1))}
                    disabled={current === nodes.length - 1}
                    className="inline-flex items-center gap-1 rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Pct({ v }: { v?: number }) {
  return <span className="tabular font-semibold text-slate-800">{formatFraction(v, 1)}</span>;
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold text-slate-900">{value}</dd>
      {sub && <dd className="tabular text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}
