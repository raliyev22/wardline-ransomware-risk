/**
 * Joins API source data into a per-scenario view for the threat explorer.
 * Nothing here computes risk: it only links records that the backend returns.
 */
import { asNumber, asText, splitIds } from "./format";
import type {
  AssetRecord,
  HospitalResponse,
  InvestmentItem,
  InvestmentsResponse,
  JsonRecord,
  RansomwareScenario,
  SecurityControlRecord,
} from "./types";

export type StageKey = "attempt" | "initial_access" | "deployment" | "major_spread" | "recovery_severity";

export interface StageDefinition {
  key: StageKey;
  label: string;
  question: string;
  description: string;
}

/**
 * The engine's attack-stage structure (backend/risk_engine/engine/portfolio_model.py):
 * attempts/year → P(initial access) → P(deployment) → P(major spread) → severity & recovery.
 * Stage keys match `affected_stage` / `affected_metric` values in the source mappings.
 */
export const STAGES: StageDefinition[] = [
  {
    key: "attempt",
    label: "Relevant attempt",
    question: "How often is this entry path tried?",
    description:
      "Attempts capable of reaching the modeled entry path in a year, not all spam or scanning. The engine draws attempt counts from the stated distribution.",
  },
  {
    key: "initial_access",
    label: "Initial access",
    question: "Does the attacker gain a foothold?",
    description: "Conditional on an attempt, the attacker obtains an initial foothold under current controls.",
  },
  {
    key: "deployment",
    label: "Ransomware deployment",
    question: "Is ransomware executed?",
    description: "Conditional on access, ransomware is deployed before detection and containment interrupt it.",
  },
  {
    key: "major_spread",
    label: "Major spread",
    question: "Does it move laterally across the network?",
    description: "Conditional on deployment, the incident spreads beyond the initial foothold. Without major spread an event is modeled as contained.",
  },
  {
    key: "recovery_severity",
    label: "Severity & recovery",
    question: "How severe is the outage and how long is recovery?",
    description:
      "Spread incidents escalate to major or severe. Backups and recovery exercises shorten recovery and reduce loss severity; they do not change attack probability.",
  },
];

/** Investment `affected_metric` values that act at the severity/recovery stage rather than a probability stage. */
const METRIC_TO_STAGE: Record<string, StageKey> = {
  initial_access: "initial_access",
  deployment: "deployment",
  major_spread: "major_spread",
  recovery_severity: "recovery_severity",
  recovery_days: "recovery_severity",
  iomt_disruption: "recovery_severity",
};

export interface ControlLink {
  controlId: string;
  control?: SecurityControlRecord;
  stage: StageKey | null;
  rawStage: string;
  direction: string | null;
  note: string | null;
}

export interface InvestmentLink {
  investmentId: string;
  investment?: InvestmentItem;
  stage: StageKey | null;
  metric: string;
  /** Engine input assumption (target_relative_reduction), not a modeled outcome. */
  assumedRelativeReduction: number | null;
  appliesTo: "this_scenario" | "all_scenarios";
  overlapGroup: string | null;
  note: string | null;
}

export interface MitigatingInvestment {
  investment: InvestmentItem;
  stages: StageKey[];
  links: InvestmentLink[];
  listedForScenario: boolean;
}

export interface ScenarioView {
  scenario: RansomwareScenario;
  id: string;
  name: string;
  sequence: string[];
  entryAssets: AssetRecord[];
  affectedAssets: AssetRecord[];
  missingAssetIds: string[];
  controlsByStage: Record<StageKey, ControlLink[]>;
  unmappedControls: ControlLink[];
  investmentsByStage: Record<StageKey, InvestmentLink[]>;
  mitigatingInvestments: MitigatingInvestment[];
  attemptsPerYear: number | null;
  attemptDistribution: string | null;
}

function emptyStageMap<T>(): Record<StageKey, T[]> {
  return { attempt: [], initial_access: [], deployment: [], major_spread: [], recovery_severity: [] };
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : splitIds(value);
}

export function scenarioList(hospital?: HospitalResponse): RansomwareScenario[] {
  const list = hospital?.ransomware_scenarios?.scenarios;
  return Array.isArray(list) ? list.filter((s) => asText(s?.scenario_id)) : [];
}

export function buildScenarioView(
  scenario: RansomwareScenario,
  hospital: HospitalResponse,
  investments?: InvestmentsResponse,
): ScenarioView {
  const id = String(scenario.scenario_id);
  const assetsById = new Map((hospital.assets ?? []).map((a) => [String(a.asset_id), a]));
  const controlsById = new Map((hospital.security_controls ?? []).map((c) => [String(c.control_id), c]));
  const investmentsById = new Map((investments?.investments ?? []).map((i) => [i.id, i]));

  const entryIds = idList(scenario.entry_asset_ids);
  const affectedIds = idList(scenario.potentially_affected_asset_ids);
  const allAssetIds = [...new Set([...entryIds, ...affectedIds])];

  // Controls: documented control-to-stage mapping for this scenario.
  const controlsByStage = emptyStageMap<ControlLink>();
  const unmappedControls: ControlLink[] = [];
  const mapped = new Set<string>();
  for (const row of (hospital.mappings?.control_stage_mapping ?? []) as JsonRecord[]) {
    if (asText(row.scenario_id) !== id) continue;
    const controlId = String(row.control_id ?? "");
    const rawStage = String(row.affected_stage ?? "");
    const stage = METRIC_TO_STAGE[rawStage] ?? null;
    const link: ControlLink = {
      controlId,
      control: controlsById.get(controlId),
      stage,
      rawStage,
      direction: asText(row.direction),
      note: asText(row.modeling_note),
    };
    mapped.add(controlId);
    if (stage) controlsByStage[stage].push(link);
    else unmappedControls.push(link);
  }
  // Primary controls listed on the scenario but absent from the stage mapping.
  for (const controlId of idList(scenario.primary_control_ids)) {
    if (mapped.has(controlId)) continue;
    unmappedControls.push({ controlId, control: controlsById.get(controlId), stage: null, rawStage: "", direction: null, note: null });
  }

  // Investments: engine control-effectiveness inputs for this scenario (or "all").
  const investmentsByStage = emptyStageMap<InvestmentLink>();
  const byInvestment = new Map<string, InvestmentLink[]>();
  for (const row of investments?.control_effectiveness ?? []) {
    const scope = asText(row.scenario_id);
    if (scope !== id && scope !== "all") continue;
    const investmentId = String(row.investment_id ?? "");
    const metric = String(row.affected_metric ?? "");
    const link: InvestmentLink = {
      investmentId,
      investment: investmentsById.get(investmentId),
      stage: METRIC_TO_STAGE[metric] ?? null,
      metric,
      assumedRelativeReduction: asNumber(row.target_relative_reduction),
      appliesTo: scope === "all" ? "all_scenarios" : "this_scenario",
      overlapGroup: asText(row.overlap_group),
      note: asText(row.modeling_note),
    };
    if (link.stage) investmentsByStage[link.stage].push(link);
    byInvestment.set(investmentId, [...(byInvestment.get(investmentId) ?? []), link]);
  }

  const mitigatingInvestments: MitigatingInvestment[] = [];
  for (const inv of investments?.investments ?? []) {
    const links = byInvestment.get(inv.id) ?? [];
    const listedForScenario = splitIds(inv.source_record?.relevant_scenario_ids).includes(id);
    if (!links.length && !listedForScenario) continue;
    const stages = [...new Set(links.map((l) => l.stage).filter((s): s is StageKey => s !== null))];
    mitigatingInvestments.push({ investment: inv, stages, links, listedForScenario });
  }

  return {
    scenario,
    id,
    name: asText(scenario.name) ?? id,
    sequence: Array.isArray(scenario.sequence) ? scenario.sequence.filter((s): s is string => typeof s === "string") : [],
    entryAssets: entryIds.flatMap((a) => (assetsById.has(a) ? [assetsById.get(a)!] : [])),
    affectedAssets: affectedIds.flatMap((a) => (assetsById.has(a) ? [assetsById.get(a)!] : [])),
    missingAssetIds: allAssetIds.filter((a) => !assetsById.has(a)),
    controlsByStage,
    unmappedControls,
    investmentsByStage,
    mitigatingInvestments,
    attemptsPerYear: asNumber(scenario.annual_attempt_mean),
    attemptDistribution: asText(scenario.annual_attempt_distribution),
  };
}
