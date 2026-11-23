"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Clock, DollarSign, HeartPulse, Megaphone, Server, Wallet, type LucideIcon } from "lucide-react";
import { STAGES, type ControlLink, type MitigatingInvestment, type ScenarioView, type StageKey } from "@/lib/threats";
import type { AttackStageModel, BaselineResponse, HospitalResponse, InvestmentsResponse, JsonRecord } from "@/lib/types";
import { MISSING, asNumber, asText, formatCurrency, formatFraction, formatNumber, formatPercentValue, humanize, splitIds } from "@/lib/format";
import { Badge, criticalityTone } from "@/components/ui/badge";
import { DisclosureCard, DisclosureSection, InlineDisclosure } from "@/components/ui/disclosure";
import { CoverageBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { Detail, Kind, NamedIds, PLAIN_METRIC, PLAIN_STAGE, sentence } from "./threat-copy";

const stageLabel = (s: StageKey) => PLAIN_STAGE[s].label;
const hours = (v: unknown) => (asNumber(v) !== null ? `${formatNumber(v)} hours` : MISSING);

/* ---------- Attack storyline (narrative steps from the scenario data) ---------- */

export function Storyline({ view }: { view: ScenarioView }) {
  if (!view.sequence.length) return null;
  return (
    <InlineDisclosure label={`Read the attack storyline (${view.sequence.length} steps)`}>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {view.sequence.map((step, i) => (
          <li key={`${i}-${step}`} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-semibold text-navy-700">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        An illustrative narrative from the scenario data. Its steps do not map one-to-one to the five modeled steps above.
      </p>
    </InlineDisclosure>
  );
}

/* ---------- Relevant hospital weaknesses ---------- */

interface Weakness {
  link: ControlLink;
  stages: StageKey[];
  notes: string[];
}

function weaknessesFor(view: ScenarioView): Weakness[] {
  const byControl = new Map<string, Weakness>();
  for (const s of STAGES) {
    for (const link of view.controlsByStage[s.key]) {
      if (!asText(link.control?.baseline_gap)) continue;
      const w = byControl.get(link.controlId) ?? { link, stages: [], notes: [] };
      if (!w.stages.includes(s.key)) w.stages.push(s.key);
      if (link.note && !w.notes.includes(link.note)) w.notes.push(link.note);
      byControl.set(link.controlId, w);
    }
  }
  return [...byControl.values()];
}

export function WeaknessesSection({ view }: { view: ScenarioView }) {
  const items = weaknessesFor(view);
  return (
    <DisclosureSection
      title="Relevant hospital weaknesses"
      icon={<AlertTriangle className="size-4" aria-hidden />}
      summary={`Gaps in today's defenses that this attack could exploit. ${formatNumber(items.length)} documented gap${items.length === 1 ? "" : "s"} along this path.`}
    >
      {items.length ? (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {items.map((w) => {
            const c = w.link.control!;
            const isPercent = String(c.unit ?? "").toLowerCase() === "percent";
            return (
              <li key={w.link.controlId}>
                <DisclosureCard
                  header={
                    <>
                      <span className="block font-medium text-slate-900">{sentence(c.baseline_gap)}</span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {asText(c.control_name)}
                        {isPercent && <> covers {formatPercentValue(c.baseline_coverage)} of its scope today</>}
                        {" · "}
                        {w.stages.map(stageLabel).join(", ").toLowerCase()} step
                      </span>
                    </>
                  }
                >
                  <dl className="@container divide-y divide-slate-50">
                    <Detail label="Documented gap">
                      <span className="text-amber-900">{sentence(c.baseline_gap)}</span>
                    </Detail>
                    <Detail label="Attack step affected">{w.stages.map(stageLabel).join(", ")}</Detail>
                    <Detail label="Existing control">
                      {asText(c.control_name) ?? w.link.controlId}
                      {isPercent && (
                        <span className="mt-1.5 block max-w-xs" aria-hidden>
                          <CoverageBar value={c.baseline_coverage} label={`${c.control_name} coverage`} />
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-slate-500">
                        {isPercent ? formatPercentValue(c.baseline_coverage) : formatNumber(c.baseline_coverage)} of {asText(c.coverage_denominator) ?? "its scope"}
                      </span>
                    </Detail>
                    <Detail label="Why it matters">
                      {w.stages.map((s) => PLAIN_STAGE[s].summary).join(" ")}
                      {w.link.direction === "decrease" && " This control makes that step less likely; the gap is the part of its scope still uncovered."}
                      {w.notes.length > 0 && <span className="mt-1 block text-xs text-slate-500">Model note: {w.notes.map((n) => sentence(n)).join("; ")}.</span>}
                    </Detail>
                    <Detail label="Reference">
                      <span className="font-mono text-xs text-slate-400">{w.link.controlId}</span>
                    </Detail>
                  </dl>
                </DisclosureCard>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState message="No documented control gaps for this scenario." />
      )}
    </DisclosureSection>
  );
}

/* ---------- Potentially affected hospital systems ---------- */

export function SystemsSection({ view, assetNames }: { view: ScenarioView; assetNames: Map<string, string> }) {
  const entryIds = new Set(view.entryAssets.map((a) => String(a.asset_id)));
  const assets = [...view.entryAssets, ...view.affectedAssets.filter((a) => !entryIds.has(String(a.asset_id)))];
  const entryNames = view.entryAssets.map((a) => asText(a.asset_name)).filter(Boolean).join(", ");
  return (
    <DisclosureSection
      title="Potentially affected hospital systems"
      icon={<Server className="size-4" aria-hidden />}
      summary={
        <>
          {formatNumber(assets.length)} hospital system{assets.length === 1 ? "" : "s"} could be disrupted
          {entryNames && <> · the attack starts at {entryNames}</>}.
        </>
      }
    >
      {assets.length ? (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {assets.map((a) => {
            const isEntry = entryIds.has(String(a.asset_id));
            const crit = asText(a.criticality);
            return (
              <li key={String(a.asset_id)}>
                <DisclosureCard
                  header={
                    <>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-slate-900">{asText(a.asset_name) ?? MISSING}</span>
                        {crit && <Badge tone={criticalityTone(crit)}>{humanize(crit)}</Badge>}
                        {isEntry && <Badge tone="navy">Entry point</Badge>}
                      </span>
                      {asText(a.ransomware_exposure_note) && <span className="mt-1 block text-sm text-slate-500">{sentence(a.ransomware_exposure_note)}.</span>}
                    </>
                  }
                >
                  <dl className="@container divide-y divide-slate-50">
                    <Detail label="What it does">{sentence(a.primary_service) ?? MISSING}</Detail>
                    <Detail label="Ransomware exposure">{sentence(a.ransomware_exposure_note) ?? MISSING}</Detail>
                    <Detail label="Category">{asText(a.asset_category) ? humanize(String(a.asset_category)) : MISSING}</Detail>
                    <Detail label="Quantity">{formatNumber(a.quantity)}</Detail>
                    <Detail label="Target recovery time (RTO)">{hours(a.target_rto_hours)}</Detail>
                    <Detail label="Severe-event recovery (illustrative)">{hours(a.illustrative_severe_event_recovery_hours)}</Detail>
                    <Detail label="Depends on">
                      <NamedIds ids={splitIds(a.depends_on_asset_ids)} names={assetNames} />
                    </Detail>
                    <Detail label="Reference">
                      <span className="font-mono text-xs text-slate-400">{asText(a.asset_id)}</span>
                    </Detail>
                  </dl>
                </DisclosureCard>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState message="No asset mapping provided for this scenario." />
      )}
      {view.missingAssetIds.length > 0 && (
        <p className="mt-3 text-xs text-amber-800">Referenced but not found in the asset inventory: {view.missingAssetIds.join(", ")}</p>
      )}
    </DisclosureSection>
  );
}

/* ---------- Security investments and defenses ---------- */

export function InvestmentsSection({
  view,
  invest,
  hospital,
  assetNames,
}: {
  view: ScenarioView;
  invest: InvestmentsResponse;
  hospital: HospitalResponse;
  assetNames: Map<string, string>;
}) {
  const items = view.mitigatingInvestments;
  const investName = new Map(invest.investments.map((i) => [i.id, i.name]));
  const controls = new Map((hospital.security_controls ?? []).map((c) => [String(c.control_id), c]));
  return (
    <DisclosureSection
      title="Security investments that could help"
      icon={<Wallet className="size-4" aria-hidden />}
      summary={`${formatNumber(items.length)} investment${items.length === 1 ? "" : "s"} could interrupt this attack at one or more steps.`}
    >
      {items.length ? (
        <>
          <ul className="grid items-start gap-3 md:grid-cols-2">
            {items.map((m) => (
              <li key={m.investment.id}>
                <InvestmentCard m={m} investName={investName} controls={controls} assetNames={assetNames} />
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <span className="font-medium text-slate-800">Assumed step effect ≠ modeled loss reduction.</span> Each percentage is an engine input: the
            assumed change to one attack step at full implementation. Overlapping investments do not stack (only the strongest effect counts). The change in
            expected annual loss is calculated by the engine in the{" "}
            <Link href="/investments" className="font-medium text-navy-700 underline-offset-2 hover:underline">
              Investment Planner
            </Link>
            .
          </p>
        </>
      ) : (
        <EmptyState message="No investments are linked to this scenario." />
      )}
    </DisclosureSection>
  );
}

function InvestmentCard({
  m,
  investName,
  controls,
  assetNames,
}: {
  m: MitigatingInvestment;
  investName: Map<string, string>;
  controls: Map<string, JsonRecord>;
  assetNames: Map<string, string>;
}) {
  const inv = m.investment;
  const src = inv.source_record ?? {};
  const first = m.links[0];
  const months = asNumber(src.implementation_months);
  const base = asNumber(src.baseline_coverage_pct);
  const target = asNumber(src.target_coverage_pct);
  return (
    <DisclosureCard
      header={
        <>
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-900">{inv.name}</span>
            <span className="tabular shrink-0 text-sm font-semibold text-navy-900">
              {formatCurrency(inv.first_year_cash_usd, { compact: true })}
              <span className="block text-right text-[10px] font-normal uppercase tracking-wide text-slate-400">first year</span>
            </span>
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            {first ? <>Lowers {PLAIN_METRIC[first.metric] ?? humanize(first.metric).toLowerCase()}</> : "Listed as relevant to this scenario"}
            {m.stages.length > 0 && <> · {m.stages.map(stageLabel).join(", ").toLowerCase()} step</>}
          </span>
        </>
      }
    >
      <dl className="@container divide-y divide-slate-50">
        <Detail label="Cost">
          <span className="tabular">
            {formatCurrency(inv.capex_usd)} capex · {formatCurrency(inv.annual_opex_usd)} / yr opex
          </span>
          <span className="tabular mt-0.5 block text-xs text-slate-500">First-year cash {formatCurrency(inv.first_year_cash_usd)}</span>
        </Detail>
        <Detail label="Assumed effect on attack steps">
          {m.links.length ? (
            <ul className="space-y-1.5">
              {m.links.map((l) => (
                <li key={`${l.metric}-${l.appliesTo}`}>
                  <span className="tabular font-semibold text-navy-800">{formatFraction(l.assumedRelativeReduction)}</span> assumed reduction in{" "}
                  {PLAIN_METRIC[l.metric] ?? humanize(l.metric).toLowerCase()}
                  {l.appliesTo === "all_scenarios" && <span className="text-slate-500"> (all scenarios)</span>} <Kind>Engine assumption</Kind>
                  {l.note && <span className="block text-xs text-slate-500">{sentence(l.note)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500">No step effect is defined in the engine inputs for this scenario.</span>
          )}
        </Detail>
        <Detail label="Attack steps">{m.stages.length ? m.stages.map(stageLabel).join(", ") : MISSING}</Detail>
        <Detail label="Strengthens controls">
          {splitIds(src.affected_control_ids).length ? (
            <ul className="space-y-0.5">
              {splitIds(src.affected_control_ids).map((id) => (
                <li key={id}>
                  {asText(controls.get(id)?.control_name) ?? id} <span className="font-mono text-[10px] text-slate-400">{id}</span>
                </li>
              ))}
            </ul>
          ) : (
            MISSING
          )}
          {base !== null && target !== null && (
            <span className="tabular mt-0.5 block text-xs text-slate-500">
              Coverage {formatPercentValue(base)} today → {formatPercentValue(target)} target
            </span>
          )}
        </Detail>
        <Detail label="Protects">
          <NamedIds ids={splitIds(src.protected_asset_ids)} names={assetNames} />
        </Detail>
        <Detail label="Implementation time">{months !== null ? `${formatNumber(months)} months` : MISSING}</Detail>
        <Detail label="Prerequisites">
          {inv.requires.length ? inv.requires.map((id) => `${investName.get(id) ?? id} (${id})`).join(", ") : "None"}
        </Detail>
        <Detail label="Reference">
          <span className="font-mono text-xs text-slate-400">
            {inv.id}
            {asText(src.domain) && ` · ${src.domain} domain`}
          </span>
        </Detail>
      </dl>
    </DisclosureCard>
  );
}

/* ---------- Possible healthcare consequences ---------- */

interface Consequence {
  icon: LucideIcon;
  title: string;
  short: string;
  detail: string;
}

const CONSEQUENCES: Consequence[] = [
  {
    icon: DollarSign,
    title: "Financial impact",
    short: "Costs to respond, restore systems and cover lost services.",
    detail:
      "Modeled across eight separate cost categories: restoration, response, unrecovered service interruption, continuity of care, breach notification (only if data is exposed), legal, reputation and extra staffing.",
  },
  {
    icon: Clock,
    title: "Hospital service disruption",
    short: "Systems go down and staff fall back to manual downtime procedures.",
    detail:
      "Encrypted or isolated systems force downtime procedures. The engine samples recovery days for each incident based on its severity, and those days drive interruption, continuity and overtime costs.",
  },
  {
    icon: HeartPulse,
    title: "Patient care disruption",
    short: "Patients may be diverted to other facilities and appointments delayed.",
    detail:
      "The engine reports diverted patients and delayed appointments as clinical exposure indicators, kept separate from dollars. They are never converted to a monetary value and are not measures of patient harm.",
  },
  {
    icon: Megaphone,
    title: "Reputation",
    short: "Some patients may go elsewhere after services are restored.",
    detail:
      "Modeled as future patient volume lost after services are restored, valued at contribution margin. It is kept separate from outage-period losses to avoid double counting.",
  },
];

export function ConsequencesSection({
  view,
  model,
  baseline,
  hospital,
}: {
  view: ScenarioView;
  model?: AttackStageModel;
  baseline?: BaselineResponse;
  hospital: HospitalResponse;
}) {
  const contribution = model?.expected_annual_loss_contribution_usd;
  const perDeployment = model?.mean_loss_per_deployment_usd;
  const indicators = (hospital.clinical_reputation_indicators ?? []) as JsonRecord[];
  return (
    <DisclosureSection
      title="Possible healthcare consequences"
      icon={<HeartPulse className="size-4" aria-hidden />}
      summary="Financial, service, patient-care and reputation effects of a successful attack, and how the model represents them."
    >
      <ul className="grid items-start gap-3 md:grid-cols-2">
        {CONSEQUENCES.map((c) => (
          <li key={c.title}>
            <DisclosureCard
              header={
                <span className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-navy-700">
                    <c.icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-500">{c.short}</span>
                  </span>
                </span>
              }
            >
              <p className="text-sm leading-relaxed text-slate-700">{c.detail}</p>
              {c.title === "Financial impact" && contribution != null && (
                <dl className="mt-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-1">
                    <dt className="text-xs text-slate-500">
                      This scenario&apos;s expected annual loss <Kind>Modeled (analytic)</Kind>
                    </dt>
                    <dd className="tabular text-sm font-semibold text-slate-900">{formatCurrency(contribution)}</dd>
                  </div>
                  {perDeployment != null && (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-1">
                      <dt className="text-xs text-slate-500">Average loss per ransomware deployment</dt>
                      <dd className="tabular text-sm font-semibold text-slate-900">{formatCurrency(perDeployment)}</dd>
                    </div>
                  )}
                  {baseline && (
                    <p className="pt-1 text-xs text-slate-500">
                      Part of the {formatCurrency(baseline.metrics.expected_annual_loss_usd)} baseline expected annual loss across all{" "}
                      {formatNumber((hospital.attack_stage_model ?? []).length)} scenarios, under current controls.
                    </p>
                  )}
                </dl>
              )}
              {c.title === "Patient care disruption" && indicators.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500">
                    Diverted patients per incident, by severity <Kind>Engine assumption</Kind>
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {indicators.map((r) => (
                      <li key={String(r.severity_id)} className="flex justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
                        <span className="text-slate-600">{humanize(String(r.severity_id))}</span>
                        <span className="tabular text-slate-900">
                          {formatNumber(r.diverted_patients_min)}–{formatNumber(r.diverted_patients_max)}{" "}
                          <span className="text-xs text-slate-500">(most likely {formatNumber(r.diverted_patients_mode)})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-slate-500">Severity ranges apply to every scenario; they are not specific to {view.name.toLowerCase()}.</p>
                </div>
              )}
            </DisclosureCard>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Simulated yearly downtime, diversion and loss figures are in the{" "}
        <Link href="/simulator" className="font-medium text-navy-700 underline-offset-2 hover:underline">
          Crisis Simulator
        </Link>
        .
      </p>
    </DisclosureSection>
  );
}

/* ---------- Technical methodology ---------- */

export function MethodologySection({ hospital }: { hospital: HospitalResponse }) {
  return (
    <DisclosureSection
      title="How this page uses the model"
      icon={<BookOpen className="size-4" aria-hidden />}
      summary="Where the scenarios, steps and percentages come from, and what this page does not estimate."
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-600">
        <div>
          <h3 className="font-semibold text-slate-800">Attack steps</h3>
          <p className="mt-1">
            The five steps are the risk engine&apos;s stage structure: relevant attempts per year → chance of initial access → chance of deployment → chance
            of major spread → severity and recovery. {hospital.attack_stage_model_note}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Labels on this page</h3>
          <ul className="mt-1 space-y-1">
            <li>
              <Kind>Engine assumption</Kind> a synthetic input fed into the risk engine, such as a stage probability or an investment&apos;s assumed effect.
            </li>
            <li>
              <Kind>Modeled (analytic)</Kind> a result calculated by the engine from those inputs using analytic expected values.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">What this page does not estimate</h3>
          <p className="mt-1">
            It does not calculate how much any investment lowers overall risk or loss; that requires the engine to evaluate a full portfolio in the Investment
            Planner. Every scenario is modeled toward the same disruptive event (ransomware that disrupts clinical or business services); the source data has
            no scenario-specific attacker objective.
          </p>
        </div>
        <p className="text-xs text-slate-500">All scenarios, costs and probabilities are synthetic and illustrative, not calibrated to a real hospital.</p>
      </div>
    </DisclosureSection>
  );
}

/* ---------- CTA ---------- */

export function SimulatorCta() {
  return (
    <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Next step</p>
        <h2 className="mt-1 text-lg font-semibold">Simulate a year of ransomware activity</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-navy-200">
          Run the Monte Carlo engine across all scenarios to see disruptive-event frequency, recovery days, patient diversions and loss distribution.
        </p>
      </div>
      <Link
        href="/simulator"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Continue to Crisis Simulator
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
