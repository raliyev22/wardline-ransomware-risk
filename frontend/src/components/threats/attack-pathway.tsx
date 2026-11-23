"use client";

import { useId } from "react";
import { ChevronDown, ChevronRight, ShieldCheck, Wallet, X } from "lucide-react";
import { STAGES, type ControlLink, type InvestmentLink, type ScenarioView, type StageKey } from "@/lib/threats";
import type { AttackStage, AttackStageModel } from "@/lib/types";
import { MISSING, asText, formatFraction, formatNumber, formatPercentValue, humanize } from "@/lib/format";
import { Card, CardBody, CardHeader, cn } from "@/components/ui/card";
import { Chevron, DisclosurePanel } from "@/components/ui/disclosure";
import { CoverageBar } from "@/components/ui/progress";
import { Kind, NamedIds, PLAIN_METRIC, PLAIN_STAGE, sentence } from "./threat-copy";

/** Engine attack-stage parameter that belongs to each pathway stage. */
const MODEL_STAGE: Partial<Record<StageKey, string>> = {
  initial_access: "initial_access",
  deployment: "deployment",
  major_spread: "major_spread",
  recovery_severity: "severe_given_major_spread",
};

function stageParam(model: AttackStageModel | undefined, key: StageKey): AttackStage | undefined {
  return model?.stages.find((s) => s.stage === MODEL_STAGE[key]);
}

/**
 * The five engine stages as an always-visible flow. Each stage is a toggle button; the details
 * for the open stage appear in one panel under the flow (click again or press Close to collapse).
 */
export function AttackPathway({
  view,
  model,
  openStage,
  onToggleStage,
  assetNames,
}: {
  view: ScenarioView;
  model?: AttackStageModel;
  openStage: StageKey | null;
  onToggleStage: (s: StageKey | null) => void;
  assetNames: Map<string, string>;
}) {
  const panelId = useId();
  const open = STAGES.find((s) => s.key === openStage) ?? null;

  return (
    <Card>
      <CardHeader
        title="How the attack happens"
        description={
          <>
            Each step can only happen if the one before it does, so many attacks stop early or are contained. Select a step for details.
          </>
        }
      />
      <CardBody>
        <ol className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-0" aria-label={`Attack stages for ${view.name}`}>
          {STAGES.map((s, i) => {
            const active = s.key === openStage;
            const plain = PLAIN_STAGE[s.key];
            const param = stageParam(model, s.key);
            const chip =
              s.key === "attempt"
                ? view.attemptsPerYear !== null
                  ? `${formatNumber(view.attemptsPerYear, 1)} relevant attempts / yr`
                  : null
                : param
                  ? `${formatFraction(param.triangular_mean, 1)} ${plain.chanceSuffix}`
                  : null;
            return (
              <li key={s.key} className="flex min-w-0 flex-col items-stretch lg:flex-1 lg:flex-row lg:items-center">
                <button
                  type="button"
                  id={`${panelId}-step-${s.key}`}
                  aria-expanded={active}
                  aria-controls={panelId}
                  onClick={() => onToggleStage(active ? null : s.key)}
                  className={cn(
                    "group flex w-full flex-col rounded-lg border px-3.5 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 lg:h-full",
                    active ? "border-navy-800 bg-navy-900 text-white" : "border-slate-200 bg-white hover:border-navy-300 hover:bg-navy-50/40",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wide", active ? "text-wardline-lime" : "text-slate-400")}>Step {i + 1}</span>
                    <Chevron open={active} className={active ? "text-navy-200" : undefined} />
                  </span>
                  <span className={cn("mt-0.5 text-sm font-semibold", active ? "text-white" : "text-navy-900")}>{plain.label}</span>
                  <span className={cn("mt-1 text-xs leading-relaxed", active ? "text-navy-100" : "text-slate-600")}>{plain.summary}</span>
                  {chip && (
                    <span className={cn("tabular mt-auto pt-2.5 text-xs font-medium", active ? "text-white" : "text-navy-800")}>
                      <span className={cn("block text-[10px] font-normal uppercase tracking-wide", active ? "text-navy-300" : "text-slate-400")}>
                        {s.key === "attempt" ? "Assumed rate" : "Assumed chance"}
                      </span>
                      {chip}
                    </span>
                  )}
                </button>
                {i < STAGES.length - 1 && (
                  <span className="flex justify-center py-0.5 text-slate-300 lg:px-0.5 lg:py-0" aria-hidden>
                    <ChevronDown className="size-4 lg:hidden" />
                    <ChevronRight className="hidden size-4 lg:block" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <DisclosurePanel open={open !== null} id={panelId} labelledBy={`${panelId}-title`} region>
          {open && (
            <StageDetails
              stageKey={open.key}
              titleId={`${panelId}-title`}
              view={view}
              model={model}
              assetNames={assetNames}
              onClose={() => {
                document.getElementById(`${panelId}-step-${open.key}`)?.focus();
                onToggleStage(null);
              }}
            />
          )}
        </DisclosurePanel>
      </CardBody>
    </Card>
  );
}

function StageDetails({
  stageKey,
  titleId,
  view,
  model,
  assetNames,
  onClose,
}: {
  stageKey: StageKey;
  titleId: string;
  view: ScenarioView;
  model?: AttackStageModel;
  assetNames: Map<string, string>;
  onClose: () => void;
}) {
  const def = STAGES.find((s) => s.key === stageKey)!;
  const plain = PLAIN_STAGE[stageKey];
  const param = stageParam(model, stageKey);
  const controls = view.controlsByStage[stageKey];
  const investments = view.investmentsByStage[stageKey];
  const weights = model?.severity_branch_weights_given_deployment;

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">{def.question}</p>
          <h3 id={titleId} className="mt-0.5 text-base font-semibold text-navy-900">{plain.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-accent-500"
        >
          <X className="size-3.5" aria-hidden /> Close
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* What the model assumes */}
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">How the model defines this step</h4>
            <p className="mt-1 leading-relaxed">{def.description}</p>
          </div>

          {stageKey === "attempt" ? (
            <dl className="rounded-lg border border-slate-200 bg-white p-3.5">
              <Row label="Entry point" value={asText(view.scenario.entry_point) ?? MISSING} />
              <Row
                label="Relevant attempts / yr"
                value={`${formatNumber(view.attemptsPerYear, 1)}${view.attemptDistribution ? ` (mean of a ${humanize(view.attemptDistribution).toLowerCase()} distribution)` : ""}`}
                kind="Engine assumption"
              />
              <div className="pt-2">
                <dt className="text-xs text-slate-500">Where it starts</dt>
                <dd className="mt-1">
                  <NamedIds ids={view.entryAssets.map((a) => String(a.asset_id))} names={assetNames} />
                </dd>
              </div>
            </dl>
          ) : param ? (
            <dl className="rounded-lg border border-slate-200 bg-white p-3.5">
              <Row
                label={stageKey === "recovery_severity" ? "Chance a major spread turns severe" : "Chance of this step"}
                value={formatFraction(param.triangular_mean, 1)}
                kind="Engine assumption"
              />
              <Row label="Only if this happened first" value={sentence(param.conditional_on) ?? MISSING} />
              <Row
                label="Assumed range"
                value={`${formatFraction(param.low, 1)} low · ${formatFraction(param.mode, 1)} most likely · ${formatFraction(param.high, 1)} high`}
              />
              {stageKey === "deployment" && model?.expected_deployments_per_year != null && (
                <Row label="Expected deployments / yr" value={formatNumber(model.expected_deployments_per_year, 2)} kind="Modeled (analytic)" />
              )}
              {stageKey === "recovery_severity" && weights && (
                <Row
                  label="Outcome of a deployment"
                  value={`${formatFraction(weights.contained)} contained · ${formatFraction(weights.major, 1)} major · ${formatFraction(weights.severe, 1)} severe`}
                  kind="Modeled (analytic)"
                />
              )}
              <p className="pt-2 text-xs text-slate-500">The engine uses the average of the low, most likely and high values.</p>
            </dl>
          ) : (
            <p className="text-xs text-slate-500">No stage probability is provided by the API for this step.</p>
          )}
        </div>

        {/* Defenses at this step */}
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ShieldCheck className="size-4 text-navy-600" aria-hidden /> Existing controls at this step
            </h4>
            {controls.length ? (
              <ul className="mt-2 space-y-2">
                {controls.map((c) => (
                  <ControlLine key={c.controlId} link={c} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                {stageKey === "attempt"
                  ? "None. In the source data, controls act on what happens after an attempt is made."
                  : "No existing control is mapped to this step for this scenario."}
              </p>
            )}
          </div>
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Wallet className="size-4 text-navy-600" aria-hidden /> Investments that act on this step
            </h4>
            {investments.length ? (
              <>
                <ul className="mt-2 space-y-2">
                  {investments.map((l) => (
                    <InvestmentLine key={`${l.investmentId}-${l.metric}`} link={l} />
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Percentages are engine input assumptions at full implementation, relative to this step&apos;s baseline. They do not mean total
                  ransomware risk or financial loss falls by that amount.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">No investment effect is defined for this step in the engine inputs.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, kind }: { label: string; value: string; kind?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-xs text-slate-500">
        {label} {kind && <Kind>{kind}</Kind>}
      </dt>
      <dd className="tabular text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ControlLine({ link }: { link: ControlLink }) {
  const c = link.control;
  const isPercent = String(c?.unit ?? "").toLowerCase() === "percent";
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-900">{asText(c?.control_name) ?? link.controlId}</span>
        {c && <span className="tabular text-sm font-semibold text-navy-900">{isPercent ? formatPercentValue(c.baseline_coverage) : formatNumber(c.baseline_coverage)}</span>}
      </div>
      {c && isPercent && (
        <div className="mt-1.5" aria-hidden>
          <CoverageBar value={c.baseline_coverage} label={`${c.control_name ?? link.controlId} coverage`} />
        </div>
      )}
      <p className="mt-1.5 text-xs text-slate-500">
        {asText(c?.coverage_denominator) && <>Coverage of {c?.coverage_denominator}. </>}
        {link.note && sentence(link.note)}
      </p>
    </li>
  );
}

function InvestmentLine({ link }: { link: InvestmentLink }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-900">{link.investment?.name ?? link.investmentId}</p>
      <p className="mt-0.5 text-sm text-navy-800">
        <span className="tabular font-semibold">{formatFraction(link.assumedRelativeReduction)}</span> assumed reduction in{" "}
        {PLAIN_METRIC[link.metric] ?? humanize(link.metric).toLowerCase()}
        {link.appliesTo === "all_scenarios" && <span className="text-slate-500"> (all scenarios)</span>}
      </p>
      {link.note && <p className="mt-1 text-xs text-slate-500">{sentence(link.note)}</p>}
    </li>
  );
}
