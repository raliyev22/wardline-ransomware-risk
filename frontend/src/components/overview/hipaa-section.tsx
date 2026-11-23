"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { assessStandards, SECURITY_RULE } from "@/lib/hipaa";
import { formatPercentValue } from "@/lib/format";
import type { InvestmentItem, SecurityControlRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DisclosureSection } from "@/components/ui/disclosure";
import { EmptyState, LoadingState } from "@/components/ui/states";

type Filter = "all" | "supported" | "gaps" | "targets";
const sourceStyle = "text-accent-700 underline underline-offset-2 hover:text-accent-900";

export function HipaaSection({ controls, projects, loading }: {
  controls?: SecurityControlRecord[];
  /** Omit for the baseline view. An empty list is a plan with no investment. */
  projects?: InvestmentItem[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = assessStandards(controls ?? [], projects ?? []);
  const supported = rows.filter((row) => row.evidence.length > 0);
  const gaps = rows.filter((row) => row.evidence.length === 0);
  const targeted = rows.filter((row) => row.targets.length > 0);
  const filtered = { all: rows, supported, gaps, targets: targeted }[filter];
  const comparing = projects !== undefined;
  const summary = comparing
    ? `The selected plan targets controls supporting ${targeted.length} of ${rows.length} standards.`
    : `${rows.length} standards reviewed · 0 verified in full · ${supported.length} with partial evidence · ${gaps.length} without mapped evidence`;

  return (
    <DisclosureSection
      title={comparing ? "HIPAA safeguards before and after the selected plan" : "HIPAA Security Rule standards"}
      icon={<ShieldCheck className="size-4" aria-hidden />}
      summary={loading ? "Loading hospital controls…" : controls ? summary : "Hospital control inventory unavailable"}
    >
      {loading ? <LoadingState rows={3} /> : !controls ? <EmptyState message="Hospital control inventory unavailable." /> : (
        <div className="space-y-5 text-sm text-slate-700">
          <p>
            This review covers standards for a hospital acting as a healthcare provider and protecting electronic patient
            information (ePHI). The hospital inventory is illustrative. Full implementation requires evidence that the
            entire standard is met. No standard has that verification in the available records.
          </p>
          {comparing && (
            <div className="rounded-lg bg-navy-50 px-4 py-3">
              <p className="font-semibold text-navy-900">{projects.length ? "Selected investments" : "No new investment selected"}</p>
              {projects.length > 0 && <p className="mt-1">{projects.map((project) => project.name).join(" · ")}</p>}
              <p className="mt-2">Today, 0 of {rows.length} standards are verified as fully implemented.
                {projects.length ? " Meeting the project targets would verify 0 additional standards. Each percentage below is a target for the named project’s scope." :
                  " The projected position matches the baseline."}</p>
            </div>
          )}
          <label className="flex flex-wrap items-center gap-2 font-medium">
            Show
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="all">All standards ({rows.length})</option>
              {comparing && <option value="targets">Targeted by this plan ({targeted.length})</option>}
              <option value="supported">With current control evidence ({supported.length})</option>
              <option value="gaps">Without mapped evidence ({gaps.length})</option>
            </select>
          </label>
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {filtered.map((row) => (
              <li key={row.cite} className="space-y-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-semibold text-navy-900">{row.title}</h3>
                  <a className={sourceStyle} href={`${SECURITY_RULE}#p-${row.cite}`}>45 CFR § {row.cite}</a>
                </div>
                <div className={comparing ? "grid gap-3 sm:grid-cols-2" : ""}>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500">Today</p>
                    <Badge tone={row.evidence.length ? "navy" : "neutral"}>{row.evidence.length ? "Partial control evidence" : "No mapped evidence"}</Badge>
                    {row.evidence.length > 0 && <>
                      <p className="my-1">{row.rationale}</p>
                      <ul className="list-disc space-y-1 pl-5">{row.evidence.map((control) => (
                        <li key={control.control_id}>{control.control_name} ({control.control_id}) · <strong>{formatPercentValue(control.baseline_coverage)}</strong> of {control.coverage_denominator}</li>
                      ))}</ul>
                    </>}
                  </div>
                  {comparing && <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500">After implementation · projected</p>
                    {row.targets.length > 0 ? <>
                      <Badge tone="accent">Partial support at target</Badge>
                      <ul className="mt-1 space-y-1">{row.targets.map(({ id, name, source_record }) => (
                        <li key={id}>{name} ({id}) · project coverage {formatPercentValue(source_record.baseline_coverage_pct)} → <strong>{formatPercentValue(source_record.target_coverage_pct)}</strong></li>
                      ))}</ul>
                    </> : <p>{row.evidence.length ? "Same partial support as today." : "No mapped evidence."}</p>}
                  </div>}
                </div>
                <p className="text-slate-600"><strong className="font-medium text-slate-800">Evidence to review. </strong>{row.review}</p>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <EmptyState message="No standards match this filter." />}
          <p className="text-xs text-slate-600">Scope includes administrative, physical, technical, vendor and documentation standards.
            The group health plan provision applies to a separate role.{" "}
            <a className={sourceStyle} href={SECURITY_RULE}>Read the Security Rule</a>{" · "}
            <a className={sourceStyle} href="https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html">HHS guidance</a>
          </p>
        </div>
      )}
    </DisclosureSection>
  );
}
