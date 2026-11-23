"use client";

import { useApi } from "@/lib/use-api";
import { API_BASE_URL } from "@/lib/api";
import { asNumber, formatCurrency as usd, formatFraction, formatNumber, formatPercentValue, humanize, numericEntries } from "@/lib/format";
import type { BaselineResponse, HospitalResponse, InvestmentsResponse, SeveritiesResponse } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { DisclosureSection } from "@/components/ui/disclosure";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { References } from "./references";
import { ProjectCosts } from "./project-costs";
import { FrequencySources, LossSources } from "./risk-sources";

const carriedForward = new Set(["hospitals", "specialty_clinics", "urgent_care_centers", "workforce_endpoints",
  "networked_medical_devices", "virtual_servers_and_cloud_workloads", "critical_technology_vendors",
  "annual_operating_revenue", "annual_operating_expenses", "annual_digital_infrastructure_spend"]);

function ProfileValues({ fields, financial = false }: { fields?: Record<string, unknown>; financial?: boolean }) {
  return <DataTable rows={numericEntries(fields)} rowKey={([key]) => key} columns={[
    { key: "label", header: "Hospital figure", render: ([key]) => key === "annual_operating_margin" ? "Operating income" : humanize(key) },
    { key: "value", header: "Model value", render: ([key, value]) => financial && key !== "budget_horizon_months" ? usd(value) : formatNumber(value) },
    { key: "origin", header: "Origin", render: ([key]) => key === "annual_operating_margin" ? "Revenue less expenses" :
      carriedForward.has(key) ? "Milestone 1 scenario assumption" : "Hospital profile assumption" },
  ]}/>;
}

function ProfileSources({ data }: { data: HospitalResponse }) {
  const p = data.hospital_profile;
  const revenue = asNumber(p.financials_usd?.annual_operating_revenue);
  const expenses = asNumber(p.financials_usd?.annual_operating_expenses);
  return <>
    <DisclosureSection title="Hospital size, workforce and technology" summary="Where the facility counts, licensed beds, patient volumes and equipment counts come from.">
      <div className="space-y-4 text-sm text-slate-700">
        <p>The project defines a fictional regional provider. The modeling notes in <code>hospital_profile.json</code> identify the site and technology counts carried forward from Milestone 1.
          The remaining figures describe the scale of the demonstration. Encounters measure activity and can overlap across services.</p>
        <ProfileValues fields={p.facilities}/><ProfileValues fields={p.operations}/>
        <p><strong>Regional comparison.</strong> FirstHealth reports four hospitals, more than 600 beds and 94 outpatient clinics.
          It illustrates how multiple hospitals can share a larger outpatient network. Its clinic categories differ from this profile’s specialty clinics.
          To validate local counts, reconcile a facility roster and bed licenses with staffing, patient activity and asset inventories.</p>
        <References ids={["firsthealth","cms"]}/>
      </div>
    </DisclosureSection>
    <DisclosureSection title="Finances and cybersecurity budget" summary="Trace operating revenue, expenses, margin and available investment cash.">
      <div className="space-y-4 text-sm text-slate-700">
        <p>The team chose a nonprofit network budget for Milestone 1 and recorded it in <code>hospital_profile.json</code>. The existing technology budget funds current operations.
          The separate planning allowance limits first-year cash in <code>optimization_config.json</code>.</p>
        <ProfileValues fields={p.financials_usd} financial/>
        {revenue !== null && revenue > 0 && expenses !== null && <p className="rounded-lg bg-slate-50 p-3"><strong>Operating margin calculation</strong><br/>
          {usd(revenue)} revenue − {usd(expenses)} expenses = {usd(revenue-expenses)} operating income. Dividing income by revenue gives a {formatFraction((revenue-expenses)/revenue,2)} margin.</p>}
        <p><strong>Reported comparison.</strong> Vermont’s FY2025 actuals for Rutland Regional Medical Center show $382.4 million of operating revenue and $360.9 million of operating expense.
          These figures give a single-hospital comparison. The project used its own network figures. Validation would require consolidated financial statements and an approved IT budget covering the same fiscal year.</p>
        <References ids={["finances","cms"]}/>
      </div>
    </DisclosureSection>
    <DisclosureSection title="Existing controls and asset recovery targets" summary="What the overview’s coverage percentages and recovery times measure.">
      <div className="space-y-4 text-sm text-slate-700">
        <p>Each value in <code>security_controls.csv</code> describes the assumed baseline for a specific population. The hospital would need dated deployment reports,
          eligible population counts and exercise records to verify these percentages. HHS guidance explains why the protections matter.</p>
        <DataTable rows={data.security_controls} rowKey={(c)=>String(c.control_id)} columns={[
          {key:"c",header:"Control",render:c=>c.control_name}, {key:"v",header:"Coverage",render:c=>formatPercentValue(c.baseline_coverage)},
          {key:"scope",header:"Measured population",render:c=>c.coverage_denominator},
        ]}/>
        <p><code>assets.csv</code> assigns each asset a target recovery time and a separate severe-event estimate.
          The target is an assumed service requirement. A restoration drill or timed incident record would validate the estimated hours.
          The financial engine uses incident-level cost drivers to avoid counting shared service outages multiple times.</p>
        <DataTable rows={data.assets} rowKey={a=>String(a.asset_id)} columns={[
          {key:"name",header:"Asset",render:a=>a.asset_name}, {key:"rto",header:"Target (hours)",render:a=>formatNumber(a.target_rto_hours)},
          {key:"severe",header:"Severe event (hours)",render:a=>formatNumber(a.illustrative_severe_event_recovery_hours)},
        ]}/>
        <References ids={["hhs"]}/>
      </div>
    </DisclosureSection>
  </>;
}

export function SourcesPage() {
  const hospital = useApi<HospitalResponse>("/api/hospital");
  const investments = useApi<InvestmentsResponse>("/api/investments");
  const severity = useApi<SeveritiesResponse>("/api/incidents/severities");
  const baseline = useApi<BaselineResponse>("/api/risk/baseline");
  return <div className="space-y-6">
    <PageHeader eyebrow="Sources & Assumptions" title="Where the figures come from"
      description="Trace a hospital figure to its dataset, follow the arithmetic behind an estimate, and check what the published evidence supports."/>
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-3">
      <div><h2 className="font-semibold text-navy-900">Project assumption</h2><p>The team chose the hospital profile, event rates, control effects and project budgets for the scenario.</p></div>
      <div><h2 className="font-semibold text-navy-900">Calculated value</h2><p>The engine combines those inputs to produce annual loss, incident costs and investment totals.</p></div>
      <div><h2 className="font-semibold text-navy-900">External evidence</h2><p>Linked reports, incidents and price lists provide comparisons. Each section explains what can transfer to this hospital.</p></div>
    </div>
    <div className="space-y-3">
      {([["Hospital profile", hospital], ["Investment catalog", investments], ["Incident losses", severity], ["Baseline risk", baseline]] as const)
        .map(([label, state]) => state.error && <ErrorState key={label} title={label + " unavailable"} error={state.error} onRetry={state.reload} compact/>)}
      {(hospital.loading || investments.loading || severity.loading || baseline.loading) && <LoadingState label="Loading model figures"/>}
      {hospital.data && <ProfileSources data={hospital.data}/>}
      {investments.data && <ProjectCosts data={investments.data}/>}
      {hospital.data && <FrequencySources hospital={hospital.data} baseline={baseline.data}/>}
      {severity.data && <LossSources data={severity.data}/>}
    </div>
    <section className="space-y-2 text-sm">
      <h2 className="font-semibold text-navy-900">Inspect the underlying data</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {[["Hospital inventory and scenario inputs", "/api/hospital"], ["Investment cost and effect records", "/api/investments"],
          ["Incident cost breakdowns", "/api/incidents/severities"], ["Calculated baseline", "/api/risk/baseline"]].map(([name, path]) =>
          <a key={path} className="text-accent-700 underline underline-offset-2" href={API_BASE_URL + path}>{name}</a>)}
      </div>
    </section>
  </div>;
}
