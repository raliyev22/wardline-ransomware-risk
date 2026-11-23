"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { BaselineResponse, HospitalResponse, InvestmentsResponse } from "@/lib/types";
import { asText } from "@/lib/format";
import { buildScenarioView, scenarioList, type StageKey } from "@/lib/threats";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ScenarioCards } from "./scenario-cards";
import { AttackPathway } from "./attack-pathway";
import { AttackMapping } from "./attack-mapping";
import {
  ConsequencesSection,
  InvestmentsSection,
  MethodologySection,
  SimulatorCta,
  Storyline,
  SystemsSection,
  WeaknessesSection,
} from "./threat-sections";

export function ThreatExplorer() {
  const hospital = useApi<HospitalResponse>("/api/hospital");
  const invest = useApi<InvestmentsResponse>("/api/investments");
  const baseline = useApi<BaselineResponse>("/api/risk/baseline");
  const [selected, setSelected] = useState<string | null>(null);
  const [openStage, setOpenStage] = useState<StageKey | null>(null);

  const scenarios = useMemo(() => scenarioList(hospital.data), [hospital.data]);
  const activeId = selected && scenarios.some((s) => s.scenario_id === selected) ? selected : String(scenarios[0]?.scenario_id ?? "");
  const activeScenario = scenarios.find((s) => s.scenario_id === activeId);

  const view = useMemo(
    () => (activeScenario && hospital.data ? buildScenarioView(activeScenario, hospital.data, invest.data) : null),
    [activeScenario, hospital.data, invest.data],
  );
  const model = hospital.data?.attack_stage_model?.find((m) => m.scenario_id === activeId);
  const assetNames = useMemo(
    () => new Map((hospital.data?.assets ?? []).map((a) => [String(a.asset_id), asText(a.asset_name) ?? ""])),
    [hospital.data],
  );

  const header = (
    <PageHeader
      eyebrow="Ransomware Threats"
      title="How ransomware could reach our hospital"
      description="Explore how ransomware could enter our hospital, spread through critical systems, and disrupt patient care."
      actions={
        <Link
          href="/simulator"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Continue to Crisis Simulator
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    />
  );

  if (hospital.loading) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" aria-live="polite" className="space-y-6">
          <span className="sr-only">Loading ransomware scenarios</span>
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
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
          title={hospital.error?.kind === "network" ? undefined : "Scenario data unavailable"}
          onRetry={() => {
            hospital.reload();
            invest.reload();
            baseline.reload();
          }}
        />
      </div>
    );
  }

  if (!scenarios.length || !view) {
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

      <section aria-labelledby="scenario-heading" className="space-y-3">
        <h2 id="scenario-heading" className="text-sm font-semibold text-slate-700">
          Choose an attack scenario <span className="font-normal text-slate-500">· {scenarios.length} modeled</span>
        </h2>
        <ScenarioCards scenarios={scenarios} selectedId={activeId} onSelect={setSelected} />
      </section>

      <div id="scenario-panel" role="tabpanel" aria-labelledby={`scenario-tab-${activeId}`} className="space-y-4">
        <AttackPathway view={view} model={model} openStage={openStage} onToggleStage={setOpenStage} assetNames={assetNames} />
        <AttackMapping view={view} />
        <Storyline view={view} />

        <div className="space-y-3 pt-4">
          {invest.error && <ErrorState error={invest.error} onRetry={invest.reload} title="Investment data unavailable" compact />}
          <WeaknessesSection view={view} />
          <SystemsSection view={view} assetNames={assetNames} />
          {invest.data && <InvestmentsSection view={view} invest={invest.data} hospital={hospital.data} assetNames={assetNames} />}
          {invest.loading && <Skeleton className="h-[72px] rounded-xl" />}
          <ConsequencesSection view={view} model={model} baseline={baseline.data} hospital={hospital.data} />
          <MethodologySection hospital={hospital.data} />
        </div>
      </div>

      <SimulatorCta />
    </div>
  );
}
