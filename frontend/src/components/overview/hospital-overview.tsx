"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { BaselineResponse, HospitalResponse, InvestmentsResponse } from "@/lib/types";
import { asNumber, asText, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { ExecutiveSnapshot } from "./executive-snapshot";
import { AssetsSection, ControlsSection } from "./asset-control-sections";
import { FinanceSection, OperationsSection } from "./profile-sections";
import { HipaaSection } from "./hipaa-section";

export function HospitalOverview() {
  const hospital = useApi<HospitalResponse>("/api/hospital");
  const invest = useApi<InvestmentsResponse>("/api/investments");
  const baseline = useApi<BaselineResponse>("/api/risk/baseline");

  const allFailed = hospital.error && invest.error && baseline.error;
  if (allFailed) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Hospital Overview" title="Hospital network" />
        <ErrorState
          error={hospital.error!}
          onRetry={() => {
            hospital.reload();
            invest.reload();
            baseline.reload();
          }}
        />
      </div>
    );
  }

  const profile = hospital.data?.hospital_profile;
  const scenarios = hospital.data?.ransomware_scenarios?.scenarios ?? [];
  const assetNames = new Map((hospital.data?.assets ?? []).map((a) => [String(a.asset_id ?? ""), asText(a.asset_name) ?? ""]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Hospital Overview"
        title={profile?.name ?? (hospital.loading ? "Loading hospital network…" : "Hospital network")}
        description={
          <>
            {profile && asText(profile.type) ? humanize(String(profile.type)) : "Fictional healthcare provider"}
            {asNumber(profile?.baseline_year) !== null && <> · Baseline year {profile?.baseline_year}</>}. Where the network stands today on ransomware risk,
            before any new investment.
          </>
        }
        actions={<ThreatsCta compact />}
      />

      {hospital.error && <ErrorState error={hospital.error} onRetry={hospital.reload} title="Hospital profile unavailable" compact />}

      <ExecutiveSnapshot hospital={hospital} baseline={baseline} invest={invest} />
      <Link href="/sources" className="inline-flex items-center gap-2 text-sm font-medium text-accent-700 underline underline-offset-4">
        Where do these figures come from? <ArrowRight className="size-4" aria-hidden />
      </Link>

      <div className="space-y-3">
        <AssetsSection assets={hospital.data?.assets} names={assetNames} loading={hospital.loading} />
        <ControlsSection controls={hospital.data?.security_controls} names={assetNames} scenarios={scenarios} loading={hospital.loading} />
        <OperationsSection profile={profile} loading={hospital.loading} />
        <FinanceSection profile={profile} invest={invest.data} loading={hospital.loading} />
        <HipaaSection controls={hospital.data?.security_controls} loading={hospital.loading} />
      </div>

      <ThreatsCta scenarioCount={scenarios.length || undefined} />
    </div>
  );
}

function ThreatsCta({ compact = false, scenarioCount }: { compact?: boolean; scenarioCount?: number }) {
  if (compact) {
    return (
      <Link
        href="/threats"
        className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        Explore ransomware threats
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    );
  }
  return (
    <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Next step</p>
        <h2 className="mt-1 text-lg font-semibold">See how attacks reach these assets</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-navy-200">
          Review the {scenarioCount ? `${scenarioCount} modeled ` : ""}ransomware scenarios: their entry points, attack sequence, and which existing
          controls stand in the way.
        </p>
      </div>
      <Link
        href="/threats"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Explore ransomware threats
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
