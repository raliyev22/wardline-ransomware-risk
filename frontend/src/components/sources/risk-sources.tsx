import { DisclosureSection } from "@/components/ui/disclosure";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency as usd, formatFraction as pct, formatNumber as num, humanize, numericEntries } from "@/lib/format";
import type { HospitalResponse, SeveritiesResponse, BaselineResponse } from "@/lib/types";
import { References } from "./references";

export function FrequencySources({ hospital, baseline }: { hospital: HospitalResponse; baseline?: BaselineResponse }) {
  const models = hospital.attack_stage_model ?? [];
  const names = new Map(hospital.ransomware_scenarios.scenarios?.map(s => [s.scenario_id, s.name]));
  return <DisclosureSection title="Attack frequency and annual risk" summary="Follow each scenario from relevant attempts to its share of the overview’s expected annual loss.">
    <div className="space-y-4 text-sm text-slate-700">
      <p>The team chose a Poisson mean for each entry path in <code>risk_parameters.csv</code>. An attempt must reach the modeled entry point.
        These rates and conditional probabilities have low confidence in the project’s evidence register. A defensible local rate needs deduplicated email,
        gateway and vendor-access observations over a known period.</p>
      <p>Neprash and colleagues identified 374 ransomware attacks on US healthcare delivery organizations from 2016 through 2021.
        Their study counted known attacks. Estimating a conditional access probability would also require counting unsuccessful attempts on the same entry path.
        CISA’s ransomware guide supports the choice of entry paths and defenses.</p>
      <References ids={["cohort", "cisa"]}/>
      {models.map(m => <div key={m.scenario_id} className="space-y-2 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-navy-900">{names.get(m.scenario_id) ?? humanize(m.scenario_id)}</h3>
        <p><strong>{num(m.relevant_attempts_per_year)} relevant attempts per year</strong> assumed. The low, most likely and high probabilities are team estimates.
          The analytic engine averages the three values with equal weight.</p>
        <DataTable rows={m.stages} rowKey={r=>r.stage} caption={`Conditional probabilities for ${m.scenario_id}`}
          columns={[
            {key:"stage",header:"Event",render:r=>humanize(r.stage)},
            {key:"given",header:"Given",render:r=>r.conditional_on},
            {key:"range",header:"Low / likely / high",render:r=>[r.low,r.mode,r.high].map(v=>pct(v,2)).join(" / ")},
            {key:"mean",header:"Mean",render:r=>pct(r.triangular_mean,2)},
          ]}/>
        <p>Attempts × mean access probability × mean deployment probability gives <strong>{num(m.expected_deployments_per_year,3)} deployments/year</strong>.
          At {usd(m.mean_loss_per_deployment_usd)} per deployment, this contributes <strong>{usd(m.expected_annual_loss_contribution_usd)} per year</strong>.</p>
      </div>)}
      <div className="rounded-lg bg-navy-50 p-4">
        <h3 className="font-semibold">How the overview gets its annual figures</h3>
        <p>The engine adds the three scenario contributions. Within each scenario it weights contained, major and severe incidents by the spread and escalation branches.
          Recovery days, diversions and reputation losses use those same event weights. Reputation loss is included once in financial loss.</p>
        {baseline && <p className="mt-2 font-semibold">{usd(baseline.metrics.expected_annual_loss_usd)} expected annual loss · {num(baseline.metrics.expected_events_per_year,3)} expected deployments/year</p>}
      </div>
    </div>
  </DisclosureSection>;
}

export function LossSources({ data }: { data: SeveritiesResponse }) {
  const major = data.severities.find(s=>s.severity==="major");
  return <DisclosureSection title="Incident losses, recovery and clinical disruption" summary="See how quantities, unit rates and severity produce the financial estimates.">
    <div className="space-y-4 text-sm text-slate-700">
      <p><code>bottom_up_cost_drivers.json</code> supplies assumed staffing, service volumes, disruption days and unit rates. The engine multiplies quantities by rates
        for restoration, response, missed care, continuity, notifications, legal work, reputation and overtime. Only unrecovered visits lose contribution margin.
        Diverted patients remain a separate care indicator.</p>
      {major && data.unit_rates && <p className="rounded-lg bg-slate-50 p-3"><strong>Worked example · major incident response</strong><br/>
        {num(major.cost_drivers.ir_specialists)} specialists × {num(major.cost_drivers.ir_hours_each)} hours × {usd(data.unit_rates.incident_response_specialist_hour_usd)}/hour
        {" + "}{usd(data.unit_rates.forensic_retainer_usd)} retainer = <strong>{usd(major.bottom_up_breakdown.components_usd.response)}</strong> at the most likely cost.</p>}
      <p>Each calculated component gets a triangular range at {num(data.loss_variability.low_factor,2)}, {num(data.loss_variability.mode_factor,2)} and {num(data.loss_variability.high_factor,2)} times its central cost.
        Notification costs also depend on the assumed chance of data exposure. Recovery ranges come from severity_parameters.csv and clinical indicators from clinical_reputation_indicators.csv.</p>
      <DataTable rows={data.severities} rowKey={r=>r.severity} caption="Synthetic severity inputs and derived incident losses" columns={[
        {key:"s",header:"Severity",render:r=>humanize(r.severity)},
        {key:"d",header:"Recovery days · low / likely / high",render:r=>[r.recovery_days.low,r.recovery_days.mode,r.recovery_days.high].join(" / ")},
        {key:"p",header:"Exposure chance",render:r=>pct(r.expected_loss_per_incident?.components.notification?.applicability_probability)},
        {key:"l",header:"Expected loss per incident",render:r=>usd(r.expected_loss_per_incident?.expected_loss_per_incident_usd)},
      ]}/>
      {data.unit_rates && <details><summary className="cursor-pointer font-semibold">Assumed unit rates</summary>
        <dl className="mt-2 grid gap-x-5 sm:grid-cols-2">{numericEntries(data.unit_rates).map(([k,v])=>
          <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1"><dt>{humanize(k.replace(/_usd$/, ""))}</dt><dd>{usd(v)}</dd></div>)}</dl>
      </details>}
      <p>IBM reported a $7.42 million average across healthcare breaches in its 2025 study. That is a per-breach comparison across organizations.
        The model calculates ransomware deployment losses from local scenario assumptions. CMS documented care disruption after the Change Healthcare incident.
        Hospital response invoices, outage logs and canceled-visit records would give the unit rates and affected volumes a local basis.</p>
      <References ids={["ibm","disruption"]}/>
    </div>
  </DisclosureSection>;
}
