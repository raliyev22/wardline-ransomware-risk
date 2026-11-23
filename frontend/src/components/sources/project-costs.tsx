import { DisclosureSection } from "@/components/ui/disclosure";
import { PLAIN_METRIC } from "@/components/threats/threat-copy";
import { formatCurrency as usd, formatFraction, formatNumber, formatPercentValue, humanize } from "@/lib/format";
import type { InvestmentsResponse } from "@/lib/types";
import { References, type Reference } from "./references";

const evidence: Record<string, { rationale: string; sizing: string; refs: Reference[] }> = {
  I01: {
    rationale: "Change Healthcare reported that the remote portal involved in its 2024 incident lacked MFA. This supports prioritizing externally accessible accounts.",
    sizing: "Count additional paid identities and security keys, then price enrollment, integration and help-desk time. Check which licenses the hospital already owns.",
    refs: ["change", "duo"],
  },
  I02: {
    rationale: "HHS recommends endpoint protection and incident detection. Endpoint products are commonly priced per covered device.",
    sizing: "Multiply newly eligible endpoints by an enterprise license quote. Add deployment labor and separately price managed response coverage.",
    refs: ["hhs", "edr"],
  },
  I03: {
    rationale: "HHS calls for separating critical assets so a compromise can be contained. AWS illustrates how firewall endpoint hours and inspected traffic affect running cost.",
    sizing: "Count clinical zones and redundant inspection points. Price hardware or subscriptions, traffic, network redesign and acceptance testing against the actual architecture.",
    refs: ["hhs", "firewall"],
  },
  I04: {
    rationale: "CISA recommends protected backups and restoration testing. An AWS pricing example charges $1.50 per recovery point evaluated in Northern Virginia, with storage and restore charges priced separately.",
    sizing: "Measure protected GB-months, retention, replication and restore tests. Add migration labor and verify that the selected storage meets immutability requirements.",
    refs: ["cisa", "backup"],
  },
  I05: {
    rationale: "Vendor sessions carry privileges into clinical systems. Identity governance licensing depends on the product and existing entitlements.",
    sizing: "Inventory privileged vendor identities and connections. Obtain applicable external-user licensing terms, onboarding hours and ongoing access-review effort.",
    refs: ["hhs", "identity"],
  },
  I06: {
    rationale: "CISA documented active compromise of Ivanti gateways in 2024. This supports funding the ability to identify exposed devices, schedule patch windows and verify remediation.",
    sizing: "Count gateways, maintenance windows and validation hours. Include staging, rollback tests, support and any replacement hardware in the local quote.",
    refs: ["gateway", "nessus", "wages"],
  },
  I07: {
    rationale: "CISA publishes ransomware exercise materials that a hospital can adapt. The staffing cost depends on who participates and how clinical shifts are covered.",
    sizing: "Add facilitator preparation, participants × exercise hours × loaded rates, clinical backfill and follow-up retests.",
    refs: ["drills", "wages"],
  },
  I08: {
    rationale: "NIST demonstrated network zoning for hospital infusion pumps. This provides a technical precedent for isolating legacy devices.",
    sizing: "Cost the devices and sites in the pilot, network changes, biomedical engineering time and manufacturer validation. Deduct work already covered by the segmentation project.",
    refs: ["devices"],
  },
};

export function ProjectCosts({ data }: { data: InvestmentsResponse }) {
  const life = data.budget.cost_convention?.assumed_useful_life_years;
  return <DisclosureSection title="Investment costs and expected effects" summary="First-year cash, annualized spending and cost checks for each proposed project.">
    <div className="space-y-4 text-sm text-slate-700">
      <p>The project team supplied the upfront and recurring budgets in <code>security_investments.csv</code>.
        The catalog contains no supplier quotes, quantities or labor worksheets. The public comparisons below were added during this review on November 21, 2026.</p>
      <p>First-year cash includes all upfront spending and one year of operating costs. Annualized spending spreads the upfront amount over {formatNumber(life)} years, then adds annual operating costs.</p>
      <p>Coverage targets and relative effect sizes are separate planning assumptions. For overlapping effects on the same scenario and stage, the engine uses the strongest reduction.</p>
      <p>The planner also uses illustrative board limits from <code>optimization_config.json</code>.
        A recommended plan must bring expected annual diversions to at most {formatFraction(data.clinical_constraints.max_annual_diverted_patients_fraction_of_baseline)} of baseline
        and recovery days to at most {formatFraction(data.clinical_constraints.max_annual_recovery_days_fraction_of_baseline)} of baseline.</p>
      {data.investments.map((project) => {
        const info = evidence[project.id];
        const effects = data.control_effectiveness.filter((r) => r.investment_id === project.id);
        return <details key={project.id} className="rounded-lg border border-slate-200 px-4">
          <summary className="cursor-pointer py-3 font-semibold text-navy-900">{project.name} · {usd(project.first_year_cash_usd)}</summary>
          <div className="space-y-3 border-t border-slate-100 py-3">
            <p><strong>First-year calculation</strong><br/>{usd(project.capex_usd)} upfront + {usd(project.annual_opex_usd)} recurring = {usd(project.first_year_cash_usd)}.
              Annualized spending is {usd(project.annualized_spend_usd)}.</p>
            <p><strong>Project scope</strong><br/>{formatPercentValue(project.source_record.baseline_coverage_pct)} to {formatPercentValue(project.source_record.target_coverage_pct)} coverage over {formatNumber(project.source_record.implementation_months)} months.</p>
            {info && <><p>{info.rationale}</p><p><strong>Local costing method</strong><br/>{info.sizing}</p></>}
            {project.id === "I01" && <p className="rounded-lg bg-slate-50 p-3"><strong>License budget check</strong><br/>
              Duo Essentials lists $3 per user per month. Dividing the annual operating allowance by $36 covers up to {formatNumber(Math.floor(project.annual_opex_usd / 36))} full-year seats before support or keys.
              The account inventory must show how many seats actually need a new license.</p>}
            {project.id === "I06" && <p className="rounded-lg bg-slate-50 p-3"><strong>Scanner and staffing check</strong><br/>
              One Nessus Professional license lists at $4,790 per year. Under that example, {usd(project.annual_opex_usd - 4790)} of the recurring allowance remains.
              At the BLS May 2024 median security analyst wage of $60.05/hour, that buys about {formatNumber((project.annual_opex_usd - 4790) / 60.05)} hours before benefits, overhead and other costs.
              The scanner identifies exposures. Patching and testing require separate work.</p>}
            {effects.length > 0 && <div><strong>Assumed reductions at target coverage</strong>
              <ul className="mt-1 list-disc pl-5">{effects.map((e) => <li key={String(e.scenario_id) + String(e.affected_metric)}>
                {e.scenario_id === "all" ? "All scenarios" : humanize(String(e.scenario_id))} · {formatFraction(e.target_relative_reduction)} reduction in {PLAIN_METRIC[String(e.affected_metric)] ?? humanize(String(e.affected_metric))}
              </li>)}</ul><small>Inputs from control_effectiveness.csv. Local pilot or exercise results would be needed to measure these effects.</small></div>}
            {info && <References ids={info.refs}/>}
          </div>
        </details>;
      })}
    </div>
  </DisclosureSection>;
}
