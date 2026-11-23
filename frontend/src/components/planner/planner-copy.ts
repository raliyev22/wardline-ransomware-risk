import type { HospitalResponse, InvestmentsResponse, JsonRecord } from "@/lib/types";
import { asText, humanize } from "@/lib/format";
import { scenarioList } from "@/lib/threats";

/** What each engine `affected_metric` means for the hospital, in plain words. */
export const METRIC_PURPOSE: Record<string, string> = {
  initial_access: "Helps keep attackers from getting in",
  deployment: "Helps stop ransomware before it runs",
  major_spread: "Limits how far ransomware can spread",
  iomt_disruption: "Shields connected medical devices if ransomware spreads",
  recovery_days: "Shortens recovery after an incident",
};

/** The engine quantity each metric reduces (input assumption, never a loss change). */
export const METRIC_TARGET: Record<string, string> = {
  initial_access: "the chance an attacker gains access",
  deployment: "the chance ransomware is deployed after access",
  major_spread: "the chance of widespread infection after deployment",
  iomt_disruption: "the chance connected medical devices are hit after a major spread",
  recovery_days: "recovery days per incident",
};

/** Why each kind of effect reduces modeled risk (consistent with how the engine applies it). */
export const METRIC_WHY: Record<string, string> = {
  initial_access: "Fewer attacks get a foothold, so fewer can go on to deploy ransomware.",
  deployment: "Attackers who get in are more likely to be detected and stopped before ransomware runs.",
  major_spread: "Incidents are more likely to stay contained instead of spreading across hospital systems.",
  iomt_disruption: "When ransomware does spread, connected medical devices are less likely to be affected.",
  recovery_days: "Incidents still happen, but services come back sooner, which lowers downtime-related costs.",
};

/** Name lookups so the page never has to show raw IDs as primary labels. */
export interface Names {
  investment: Map<string, string>;
  asset: Map<string, string>;
  control: Map<string, JsonRecord>;
  scenario: Map<string, string>;
}

export function buildNames(invest?: InvestmentsResponse, hospital?: HospitalResponse): Names {
  return {
    investment: new Map((invest?.investments ?? []).map((i) => [i.id, i.name])),
    asset: new Map((hospital?.assets ?? []).map((a) => [String(a.asset_id), asText(a.asset_name) ?? String(a.asset_id)])),
    control: new Map((hospital?.security_controls ?? []).map((c) => [String(c.control_id), c])),
    scenario: new Map(scenarioList(hospital).map((s) => [String(s.scenario_id), asText(s.name) ?? String(s.scenario_id)])),
  };
}

export const invName = (n: Names, id: string) => n.investment.get(id) ?? id;
export const scenarioLabel = (n: Names, id: string) => (id === "all" ? "all scenarios" : n.scenario.get(id) ?? humanize(id));

/** "A, B and C" */
export function joinNames(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Replace known IDs (investments, assets, controls) inside source text with their names. */
export function withNames(text: string, n: Names): string {
  return text.replace(/\b([ACI]\d{2})\b/g, (id) => {
    const name = n.investment.get(id) ?? n.asset.get(id) ?? asText(n.control.get(id)?.control_name);
    return name ?? id;
  });
}
