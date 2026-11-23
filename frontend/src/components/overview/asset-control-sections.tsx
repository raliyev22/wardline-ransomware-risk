"use client";

import { Building2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { AssetRecord, RansomwareScenario, SecurityControlRecord } from "@/lib/types";
import { MISSING, asNumber, asText, formatNumber, formatPercentValue, humanize, splitIds } from "@/lib/format";
import { Badge, criticalityTone } from "@/components/ui/badge";
import { CoverageBar } from "@/components/ui/progress";
import { DisclosureCard, DisclosureSection } from "@/components/ui/disclosure";
import { EmptyState, LoadingState, Skeleton } from "@/components/ui/states";

/** Capitalize the first letter of a source sentence fragment (text unchanged otherwise). */
const sentence = (v: unknown) => {
  const t = asText(v);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
};

const hours = (v: unknown) => (asNumber(v) !== null ? `${formatNumber(v)} hours` : MISSING);

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-1.5 @md:grid-cols-[10rem_1fr] @md:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/** IDs resolved to names from the API asset inventory; the ID stays as a subtle secondary reference. */
function NamedIds({ ids, names }: { ids: string[]; names: Map<string, string> }) {
  if (ids.length === 0) return <span className="text-slate-400">None listed</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id} className="inline-flex items-baseline gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {names.get(id) || id}
          {names.get(id) && <span className="font-mono text-[10px] text-slate-400">{id}</span>}
        </li>
      ))}
    </ul>
  );
}

function SummarySkeleton() {
  return <Skeleton className="mt-1 inline-block h-3.5 w-56 align-middle" />;
}

/* ---------------- Critical hospital assets ---------------- */

export function AssetsSection({ assets, names, loading }: { assets?: AssetRecord[]; names: Map<string, string>; loading: boolean }) {
  const count = assets?.length ?? 0;
  const byCriticality = new Map<string, number>();
  for (const a of assets ?? []) {
    const c = asText(a.criticality);
    if (c) byCriticality.set(c, (byCriticality.get(c) ?? 0) + 1);
  }
  const mix = [...byCriticality].map(([c, n]) => `${n} ${c.toLowerCase()}`).join(", ");

  return (
    <DisclosureSection
      title="Critical Hospital Assets"
      icon={<Building2 className="size-4" aria-hidden />}
      summary={
        loading ? (
          <SummarySkeleton />
        ) : (
          <>
            The systems ransomware would disrupt, with recovery targets and dependencies.{" "}
            <span className="text-slate-700">
              {formatNumber(count)} asset groups{mix && ` · ${mix}`}
            </span>
          </>
        )
      }
      meta={!loading && count > 0 ? <Badge tone="navy">{formatNumber(count)} groups</Badge> : undefined}
    >
      {loading ? (
        <LoadingState label="Loading assets" rows={4} />
      ) : assets && count > 0 ? (
        <>
          <ul className="grid items-start gap-3 md:grid-cols-2">
            {assets.map((a, i) => (
              <li key={String(a.asset_id ?? i)}>
                <AssetCard asset={a} names={names} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Select an asset for recovery targets and dependencies. Severe-event recovery times are illustrative.</p>
        </>
      ) : (
        <EmptyState message="No asset records returned by the backend." />
      )}
    </DisclosureSection>
  );
}

function AssetCard({ asset: a, names }: { asset: AssetRecord; names: Map<string, string> }) {
  const crit = asText(a.criticality);
  const category = asText(a.asset_category);
  return (
    <DisclosureCard
      header={
        <>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-slate-900">{asText(a.asset_name) ?? MISSING}</span>
            {crit && <Badge tone={criticalityTone(crit)}>{humanize(crit)}</Badge>}
          </span>
          <span className="mt-1 block text-sm text-slate-500">{category ? humanize(category) : sentence(a.primary_service)}</span>
        </>
      }
    >
      <dl className="@container divide-y divide-slate-50">
        <Detail label="Description">
          {sentence(a.primary_service) ?? MISSING}.
          {asText(a.ransomware_exposure_note) && <span className="mt-1 block text-slate-600">Ransomware exposure: {a.ransomware_exposure_note}.</span>}
        </Detail>
        <Detail label="Quantity">{formatNumber(a.quantity)}</Detail>
        <Detail label="Target recovery time (RTO)">{hours(a.target_rto_hours)}</Detail>
        <Detail label="Severe-event recovery (illustrative)">{hours(a.illustrative_severe_event_recovery_hours)}</Detail>
        <Detail label="Depends on">
          <NamedIds ids={splitIds(a.depends_on_asset_ids)} names={names} />
        </Detail>
        <Detail label="Reference">
          <span className="font-mono text-xs text-slate-400">{asText(a.asset_id) ?? MISSING}</span>
        </Detail>
      </dl>
    </DisclosureCard>
  );
}

/* ---------------- Existing security controls ---------------- */

export function ControlsSection({
  controls,
  names,
  scenarios,
  loading,
}: {
  controls?: SecurityControlRecord[];
  names: Map<string, string>;
  scenarios: RansomwareScenario[];
  loading: boolean;
}) {
  const count = controls?.length ?? 0;
  const scenarioNames = new Map(scenarios.map((s) => [String(s.scenario_id ?? ""), asText(s.name) ?? ""]));
  return (
    <DisclosureSection
      title="Existing Security Controls"
      icon={<ShieldCheck className="size-4" aria-hidden />}
      summary={
        loading ? (
          <SummarySkeleton />
        ) : (
          <>
            The hospital&apos;s current ransomware defenses and how much of their scope each one covers today.{" "}
            <span className="text-slate-700">{formatNumber(count)} existing controls</span>
          </>
        )
      }
      meta={!loading && count > 0 ? <Badge tone="navy">{formatNumber(count)} controls</Badge> : undefined}
    >
      {loading ? (
        <LoadingState label="Loading controls" rows={4} />
      ) : controls && count > 0 ? (
        <>
          <ul className="grid items-start gap-3 md:grid-cols-2">
            {controls.map((c, i) => (
              <li key={String(c.control_id ?? i)}>
                <ControlCard control={c} names={names} scenarioNames={scenarioNames} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Coverage is the share of each control&apos;s stated scope covered today, as recorded in the source data. It is not a risk-reduction percentage.
          </p>
        </>
      ) : (
        <EmptyState message="No security control records returned by the backend." />
      )}
    </DisclosureSection>
  );
}

function ControlCard({
  control: c,
  names,
  scenarioNames,
}: {
  control: SecurityControlRecord;
  names: Map<string, string>;
  scenarioNames: Map<string, string>;
}) {
  const isPercent = String(c.unit ?? "").toLowerCase() === "percent";
  const coverage = isPercent ? formatPercentValue(c.baseline_coverage) : `${formatNumber(c.baseline_coverage)} ${c.unit ?? ""}`.trim();
  const domain = asText(c.control_domain);
  const stage = asText(c.modeled_effect_stage);
  const scenarioIds = splitIds(c.relevant_scenario_ids);
  return (
    <DisclosureCard
      header={
        <>
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-900">{asText(c.control_name) ?? MISSING}</span>
            <span className="tabular shrink-0 text-base font-semibold text-navy-900">
              {coverage}
              <span className="sr-only"> coverage</span>
            </span>
          </span>
          {isPercent && (
            <span className="mt-2 block" aria-hidden>
              <CoverageBar value={c.baseline_coverage} label={`${c.control_name ?? "Control"} coverage`} />
            </span>
          )}
          <span className="mt-2 block text-sm text-slate-500">
            {domain ? `${humanize(domain)} control` : "Control"}
            {stage && ` acting on the ${humanize(stage).toLowerCase()} stage`}
          </span>
        </>
      }
    >
      <dl className="@container divide-y divide-slate-50">
        <Detail label="Documented gap">
          {asText(c.baseline_gap) ? <span className="text-amber-900">{sentence(c.baseline_gap)}</span> : MISSING}
        </Detail>
        <Detail label="Coverage scope">
          {coverage} of {asText(c.coverage_denominator) ?? "its stated scope"}
        </Detail>
        <Detail label="Attack stage affected">{stage ? humanize(stage) : MISSING}</Detail>
        <Detail label="Protected assets">
          <NamedIds ids={splitIds(c.relevant_asset_ids)} names={names} />
        </Detail>
        {scenarioIds.length > 0 && (
          <Detail label="Relevant attack scenarios">
            <ul className="space-y-0.5">
              {scenarioIds.map((id) => (
                <li key={id}>{scenarioNames.get(id) || humanize(id)}</li>
              ))}
            </ul>
          </Detail>
        )}
        <Detail label="Reference">
          <span className="font-mono text-xs text-slate-400">
            {asText(c.control_id) ?? MISSING}
            {domain && ` · ${domain} domain`}
          </span>
        </Detail>
      </dl>
    </DisclosureCard>
  );
}
