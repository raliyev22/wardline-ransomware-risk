"use client";

import { ArrowDown, GitBranch } from "lucide-react";
import { SEVERITIES } from "@/lib/simulator";
import type { AttackStageModel, SeverityKey } from "@/lib/types";
import { formatFraction, formatNumber, humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/card";
import { DisclosureSection, InlineDisclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/states";
import { Kind } from "@/components/threats/threat-copy";
import { STAGE_PLAIN } from "./sim-copy";

/** Conditional attack-stage funnel (engine inputs), each with its conditional denominator from the API. */
export function StageProbabilities({ model, note, severity }: { model?: AttackStageModel; note?: string; severity: SeverityKey }) {
  return (
    <DisclosureSection
      title="How likely is the attack to progress?"
      icon={<GitBranch className="size-4" aria-hidden />}
      summary="Explore the chances of an attack reaching each stage."
    >
      {!model ? (
        <EmptyState message="The API did not return stage probabilities for this scenario." />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Each chance applies <strong className="font-semibold text-slate-800">only if the previous stage happened</strong>. They are not the overall
            chance of an attack. <Kind>Engine assumption</Kind>
          </p>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ol className="space-y-1.5">
              <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">Relevant attack attempts per year</span>
                  <span className="tabular text-lg font-semibold text-navy-900">{formatNumber(model.relevant_attempts_per_year, 1)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Attempts that actually reach this entry path, on average</p>
              </li>
              {model.stages.map((st) => {
                const meta = STAGE_PLAIN[st.stage] ?? { label: humanize(st.stage), question: "" };
                return (
                  <li key={st.stage}>
                    <span className="flex justify-center py-0.5 text-slate-300" aria-hidden>
                      <ArrowDown className="size-4" />
                    </span>
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{meta.label}</span>
                        <span className="tabular text-lg font-semibold text-navy-900">{formatFraction(st.triangular_mean, 1)}</span>
                      </div>
                      <p className="text-xs text-slate-500">If: {st.conditional_on}</p>
                      <RangeBar low={st.low} mode={st.mode} high={st.high} />
                      <p className="tabular mt-1 text-xs text-slate-500">
                        Assumed range {formatFraction(st.low, 1)}–{formatFraction(st.high, 1)} · most likely {formatFraction(st.mode, 1)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ransomware launches per year</p>
                <p className="tabular mt-1 text-2xl font-semibold text-navy-900">{formatNumber(model.expected_deployments_per_year, 3)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Expected for this scenario under current controls <Kind>Modeled (analytic)</Kind>
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How launched attacks end</p>
                {model.severity_branch_weights_given_deployment ? (
                  <ul className="mt-3 space-y-2.5">
                    {SEVERITIES.map((s) => {
                      const w = model.severity_branch_weights_given_deployment?.[s.key];
                      return (
                        <li key={s.key}>
                          <div className="flex items-center justify-between text-sm">
                            <span className={cn("flex items-center gap-2", s.key === severity ? "font-semibold text-navy-900" : "text-slate-700")}>
                              {s.label}
                              {s.key === severity && <Badge tone="navy">Selected</Badge>}
                            </span>
                            <span className="tabular font-medium text-slate-900">{formatFraction(w, 1)}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                            <div
                              className={cn("h-full rounded-full", s.key === severity ? "bg-navy-700" : "bg-slate-300")}
                              style={{ width: `${Math.max(0, Math.min(1, w ?? 0)) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Not available.</p>
                )}
              </div>
            </div>
          </div>
          <InlineDisclosure label="Technical details">
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
              <p>
                Headline chances are the triangular mean of the low, most likely and high values, as used by the analytic engine. The range bar shows low to
                high; the dark marker is the most likely value.
              </p>
              <p>Ransomware launches per year = attempts × chance of access × chance of deployment (from the engine&apos;s audit report).</p>
              <p>
                Contained = 1 − chance of spread. Major = chance of spread × (1 − chance of severe). Severe = chance of spread × chance of severe.
              </p>
              {note && <p>{note}</p>}
            </div>
          </InlineDisclosure>
        </div>
      )}
    </DisclosureSection>
  );
}

/** 0–100% track showing the low–high range and the most likely value. */
function RangeBar({ low, mode, high }: { low: number; mode: number; high: number }) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  return (
    <div className="relative mt-2 h-2 rounded-full bg-slate-100" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-navy-200" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
      <div className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-sm bg-navy-800" style={{ left: pct(mode) }} />
    </div>
  );
}
