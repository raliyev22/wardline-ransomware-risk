"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { BaselineResponse, HospitalResponse, SeveritiesResponse, SeverityKey } from "@/lib/types";
import { asText } from "@/lib/format";
import { scenarioList } from "@/lib/threats";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ScenarioCards } from "@/components/threats/scenario-cards";
import { AttackTimeline } from "./attack-timeline";
import { SeveritySelector } from "./severity-selector";
import { StageProbabilities } from "./stage-probabilities";
import { CareImpact, FinancialBreakdown, ImpactSummary } from "./incident-impact";
import { MonteCarloPanel } from "./monte-carlo-panel";

function PlannerLink({ variant = "primary" }: { variant?: "primary" | "inverse" }) {
  return (
    <Link
      href="/investments"
      className={
        variant === "primary"
          ? "inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          : "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      }
    >
      Continue to Investment Planner
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

function StepHeading({ id, n, children }: { id: string; n: number; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span className="flex size-5 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">{n}</span>
      {children}
    </h2>
  );
}

export function CrisisSimulator() {
  const hospital = useApi<HospitalResponse>("/api/hospital");
  const severities = useApi<SeveritiesResponse>("/api/incidents/severities");
  const baseline = useApi<BaselineResponse>("/api/risk/baseline");
  const [selected, setSelected] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityKey>("major");
  const [step, setStep] = useState(0);

  const scenarios = useMemo(() => scenarioList(hospital.data), [hospital.data]);
  const activeId = selected && scenarios.some((s) => s.scenario_id === selected) ? selected : String(scenarios[0]?.scenario_id ?? "");
  const scenario = scenarios.find((s) => s.scenario_id === activeId);
  const scenarioName = asText(scenario?.name) ?? activeId;
  const stageModel = hospital.data?.attack_stage_model?.find((m) => m.scenario_id === activeId);
  const detail = severities.data?.severities.find((s) => s.severity === severity);
  const sequence = Array.isArray(scenario?.sequence) ? scenario.sequence.filter((s): s is string => typeof s === "string") : [];

  const selectScenario = (id: string) => {
    setSelected(id);
    setStep(0);
  };

  const header = (
    <PageHeader
      eyebrow="Crisis Simulator"
      title="What would a ransomware crisis look like?"
      description="Experience how a ransomware attack could disrupt our hospital, affect patient care, and create financial losses."
      actions={<PlannerLink />}
    />
  );

  if (hospital.loading) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" className="space-y-6">
          <span className="sr-only">Loading simulator data</span>
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (hospital.error || !hospital.data) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorState
          error={hospital.error ?? new Error("No data returned.")}
          onRetry={() => {
            hospital.reload();
            severities.reload();
            baseline.reload();
          }}
        />
      </div>
    );
  }

  if (!scenarios.length || !scenario) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState message="The backend returned no ransomware scenarios." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <section aria-labelledby="sim-step-1" className="space-y-3">
        <StepHeading id="sim-step-1" n={1}>
          How does the attack start?
        </StepHeading>
        <ScenarioCards scenarios={scenarios} selectedId={activeId} onSelect={selectScenario} />
      </section>

      <div id="scenario-panel" role="tabpanel" aria-labelledby={`scenario-tab-${activeId}`} className="space-y-8">
        <section aria-labelledby="sim-step-2" className="space-y-3">
          <StepHeading id="sim-step-2" n={2}>
            How bad does it get?
          </StepHeading>
          <SeveritySelector
            value={severity}
            onChange={setSeverity}
            weights={stageModel?.severity_branch_weights_given_deployment}
            scenarioName={scenarioName}
          />
        </section>

        <section aria-labelledby="sim-step-3" className="space-y-4">
          <StepHeading id="sim-step-3" n={3}>
            Walk through the crisis
          </StepHeading>
          <AttackTimeline steps={sequence} active={step} onActive={setStep} severity={severity} detail={detail} model={stageModel} />
          {severities.loading && <Skeleton className="h-56 rounded-xl" />}
          {severities.error && <ErrorState error={severities.error} onRetry={severities.reload} title="Incident impact unavailable" compact />}
          {!severities.loading && !severities.error && !detail && <EmptyState message={`No engine output for ${severity} incidents.`} />}
          {detail && <ImpactSummary detail={detail} model={stageModel} baseline={baseline.data} scenarioName={scenarioName} />}
        </section>

        <section aria-label="More detail on this incident" className="space-y-3">
          <StageProbabilities model={stageModel} note={hospital.data.attack_stage_model_note} severity={severity} />
          {detail && (
            <>
              <FinancialBreakdown detail={detail} />
              <CareImpact detail={detail} />
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="sim-step-4" className="space-y-3">
        <StepHeading id="sim-step-4" n={4}>
          How much could ransomware cost over time?
        </StepHeading>
        <MonteCarloPanel scenarioCount={scenarios.length} />
      </section>

      <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Next step</p>
          <h2 className="mt-1 text-lg font-semibold">Reduce this exposure</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-200">
            Choose security investments within the budget and see how the engine estimates their effect on expected loss, recovery time and patient
            diversions.
          </p>
        </div>
        <PlannerLink variant="inverse" />
      </section>
    </div>
  );
}
