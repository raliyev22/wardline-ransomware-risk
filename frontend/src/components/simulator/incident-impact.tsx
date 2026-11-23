"use client";

import { CalendarClock, DollarSign, HeartPulse, Megaphone, Users } from "lucide-react";
import { LOSS_COMPONENTS, SEVERITIES } from "@/lib/simulator";
import type { AttackStageModel, BaselineResponse, SeverityDetail, TriangularValue } from "@/lib/types";
import { MISSING, asNumber, formatCurrency, formatFraction, formatNumber, humanize } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DisclosureSection, InlineDisclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/states";
import { Kind } from "@/components/threats/threat-copy";
import { COST_PLAIN, SEVERITY_PLAIN } from "./sim-copy";

const range = (t?: TriangularValue | null, unit = "") => (t ? `Range ${formatNumber(t.low, 1)}–${formatNumber(t.high, 1)}${unit}` : "Not provided");

/* ---------- What could happen to our hospital? (always visible) ---------- */

export function ImpactSummary({
  detail,
  model,
  baseline,
  scenarioName,
}: {
  detail: SeverityDetail;
  model?: AttackStageModel;
  baseline?: BaselineResponse;
  scenarioName: string;
}) {
  const sev = SEVERITY_PLAIN[detail.severity];
  const rec = detail.recovery_days;
  const ci = detail.clinical_indicators;
  const trustMonths = asNumber(detail.source_clinical_reputation_indicators?.trust_recovery_months_mode);
  const perIncident = detail.expected_loss_per_incident?.expected_loss_per_incident_usd;

  const cards = [
    {
      icon: DollarSign,
      label: "Financial loss",
      value: formatCurrency(perIncident, { compact: true }),
      hint: "Expected cost of one incident like this",
      emphasis: true,
    },
    {
      icon: CalendarClock,
      label: "Service disruption",
      value: `${formatNumber(rec.mode, 1)} days`,
      hint: `Most likely recovery time · ${range(rec, " days")}`,
    },
    {
      icon: Users,
      label: "Patient care",
      value: ci.diverted_patients ? `${formatNumber(ci.diverted_patients.mode)} diverted` : MISSING,
      hint: ci.delayed_appointments ? `Most likely · plus ~${formatNumber(ci.delayed_appointments.mode)} delayed appointments` : "Most likely",
    },
    {
      icon: Megaphone,
      label: "Reputation",
      value: ci.trust_index_drop ? `−${formatNumber(ci.trust_index_drop.mode)} trust pts` : MISSING,
      hint: `On a synthetic 0–100 trust index${trustMonths !== null ? ` · ~${formatNumber(trustMonths)} months to recover` : ""}`,
    },
  ];

  const comparisons: { label: string; value?: number | null; note: string }[] = [
    { label: `One ${sev.title.toLowerCase()} incident`, value: perIncident, note: "Expected cost if an incident of this severity happens. Same for every scenario." },
    {
      label: `Average ransomware incident in this scenario`,
      value: model?.mean_loss_per_deployment_usd,
      note: "Expected cost per ransomware launch, weighting contained, major and severe by how often each happens here.",
    },
    {
      label: "This scenario per year",
      value: model?.expected_annual_loss_contribution_usd,
      note: "Expected annual loss from this attack path, under current controls.",
    },
    {
      label: "Whole hospital per year",
      value: baseline?.metrics.expected_annual_loss_usd,
      note: "Expected annual loss across all attack scenarios, under current controls.",
    },
  ];

  return (
    <Card>
      <CardHeader
        title="What could happen to our hospital?"
        description={
          <>
            If a <strong className="font-semibold text-slate-700">{sev.title.toLowerCase()}</strong> incident happened. These figures depend on severity
            only, so they are the same for every attack scenario.
          </>
        }
        actions={<Kind>Modeled · one incident</Kind>}
      />
      <CardBody className="space-y-4">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ icon: Icon, label, value, hint, emphasis }) => (
            <li key={label} className={"rounded-lg border px-4 py-3.5 " + (emphasis ? "border-navy-200 bg-navy-50/60" : "border-slate-200 bg-white")}>
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </div>
              <div className="tabular mt-1.5 text-xl font-semibold text-slate-900">{value}</div>
              <div className="mt-1 text-xs leading-snug text-slate-500">{hint}</div>
            </li>
          ))}
        </ul>
        <InlineDisclosure label="How does this compare with yearly losses?">
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
            {comparisons.map((c) => (
              <div key={c.label} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="min-w-0">
                  <span className="text-sm font-medium text-slate-800">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.note}</span>
                </dt>
                <dd className="tabular shrink-0 text-sm font-semibold text-slate-900">{c.value != null ? formatCurrency(c.value) : MISSING}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            These are different quantities and should not be added together. &ldquo;This scenario&rdquo; refers to {scenarioName.toLowerCase()}.
          </p>
        </InlineDisclosure>
      </CardBody>
    </Card>
  );
}

/* ---------- Where does the financial damage come from? ---------- */

export function FinancialBreakdown({ detail }: { detail: SeverityDetail }) {
  const sevLabel = SEVERITY_PLAIN[detail.severity].title.toLowerCase();
  const central = detail.bottom_up_breakdown.components_usd ?? {};
  const dist = detail.loss_distribution_usd ?? {};
  const expected = detail.expected_loss_per_incident?.components ?? {};
  const known = LOSS_COMPONENTS.filter((c) => c.key in central || c.key in dist);
  const extra = Object.keys(central)
    .filter((k) => !LOSS_COMPONENTS.some((c) => c.key === k))
    .map((k) => ({ key: k, label: humanize(k), definition: "" }));
  const rows = [...known, ...extra];
  const max = Math.max(1, ...rows.map((r) => dist[r.key]?.high ?? central[r.key] ?? 0));
  const pct = (v: number | undefined) => `${Math.max(0, Math.min(1, (v ?? 0) / max)) * 100}%`;

  return (
    <DisclosureSection
      title="Where does the financial damage come from?"
      icon={<DollarSign className="size-4" aria-hidden />}
      summary="Explore how ransomware creates costs across hospital operations."
    >
      {rows.length === 0 ? (
        <EmptyState message="No loss components returned for this severity." />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Costs of one <strong className="font-semibold text-slate-800">{sevLabel}</strong> incident, by category. <Kind>Modeled · one incident</Kind>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-navy-700" /> Most likely cost
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-navy-100" /> Possible range (low to high)
            </span>
          </div>
          <ul className="space-y-3.5">
            {rows.map((r) => {
              const d = dist[r.key];
              const e = expected[r.key];
              const gated = e && e.applicability_probability < 1;
              const plain = COST_PLAIN[r.key];
              const label = plain?.label ?? r.label;
              return (
                <li key={r.key} className="grid gap-1.5 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9rem)] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs leading-snug text-slate-500">{plain?.plain ?? r.definition}</p>
                  </div>
                  <div
                    className="relative h-5 rounded bg-slate-50"
                    role="img"
                    aria-label={`${label}: most likely ${formatCurrency(central[r.key])}${d ? `, range ${formatCurrency(d.low)} to ${formatCurrency(d.high)}` : ""}`}
                  >
                    {d && <div className="absolute inset-y-1 rounded-sm bg-navy-100" style={{ left: pct(d.low), width: `calc(${pct(d.high)} - ${pct(d.low)})` }} />}
                    <div className="absolute inset-y-1.5 left-0 rounded-sm bg-navy-700" style={{ width: pct(central[r.key]) }} />
                  </div>
                  <div className="tabular text-sm md:text-right">
                    <span className="font-semibold text-slate-900">{formatCurrency(central[r.key], { compact: true })}</span>
                    {d && (
                      <span className="block text-xs text-slate-500">
                        {formatCurrency(d.low, { compact: true })}–{formatCurrency(d.high, { compact: true })}
                      </span>
                    )}
                    {gated && (
                      <span className="block text-xs text-amber-700">
                        Only if data is exposed ({formatFraction(e.applicability_probability)} chance) → {formatCurrency(e.expected_usd, { compact: true })} expected
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-baseline justify-between gap-3 rounded-lg bg-navy-50/70 px-4 py-3 text-sm">
            <span className="text-navy-800">Expected cost of one {sevLabel} incident</span>
            <span className="tabular font-semibold text-navy-900">{formatCurrency(detail.expected_loss_per_incident?.expected_loss_per_incident_usd)}</span>
          </div>
          <InlineDisclosure label="How these costs are calculated">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
              <p>
                Each &ldquo;most likely&rdquo; cost is the central value of a triangular range set by synthetic multipliers, not a measured confidence
                interval. The expected cost uses each range&apos;s mean and counts patient notification only with the data-exposure probability. Costs are
                based on a central disruption of {formatNumber(detail.bottom_up_breakdown.days, 2)} days.
              </p>
              <dl className="space-y-1">
                {rows.map((r) => (
                  <div key={r.key} className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
                    <dt className="font-medium text-slate-700">{COST_PLAIN[r.key]?.label ?? r.label}</dt>
                    <dd>{r.definition || MISSING}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </InlineDisclosure>
        </div>
      )}
    </DisclosureSection>
  );
}

/* ---------- How could patients and hospital services be affected? ---------- */

export function CareImpact({ detail }: { detail: SeverityDetail }) {
  const b = detail.bottom_up_breakdown;
  const ci = detail.clinical_indicators;
  const sevLabel = SEVERITIES.find((s) => s.key === detail.severity)!.label.toLowerCase();
  const indicators: [string, TriangularValue | null | undefined, string][] = [
    ["Recovery time (days)", detail.recovery_days, "How long services are disrupted"],
    ["Patients diverted", ci.diverted_patients, "Sent to other facilities"],
    ["Appointments delayed", ci.delayed_appointments, "Postponed care"],
    ["Trust index drop (points)", ci.trust_index_drop, "Synthetic 0–100 index"],
  ];
  const encounters: [string, string, string][] = [
    ["Disruption length used for costs", `${formatNumber(b.days, 2)} days`, "Central duration behind the cost formulas"],
    ["Patient encounters per day", formatNumber(b.daily_encounters), "Annual encounters ÷ operating days"],
    ["Encounters affected", formatNumber(b.affected_encounters), "Encounters during the disruption × affected share"],
    ["Encounters cancelled", formatNumber(b.cancelled_encounters), "Affected × cancelled share"],
    ["Never rescheduled", formatNumber(b.unrecovered_encounters), "Cancelled × unrecovered share; these drive lost revenue"],
  ];
  return (
    <DisclosureSection
      title="How could patients and hospital services be affected?"
      icon={<HeartPulse className="size-4" aria-hidden />}
      summary="Explore possible delays, patient diversions, and recovery challenges."
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          For one <strong className="font-semibold text-slate-800">{sevLabel}</strong> incident. These assumptions depend on severity, not on the attack
          scenario. <Kind>Engine assumption</Kind>
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="tabular min-w-full text-sm">
            <caption className="sr-only">Clinical and operational indicators for one {sevLabel} incident</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-1 py-2 text-left font-semibold">Indicator</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Low</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Most likely</th>
                <th scope="col" className="px-1 py-2 text-right font-semibold">High</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {indicators.map(([label, t, hint]) => (
                <tr key={label}>
                  <th scope="row" className="px-1 py-2.5 text-left font-normal">
                    <span className="text-slate-800">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </th>
                  <td className="px-2 py-2.5 text-right text-slate-600">{t ? formatNumber(t.low, 1) : MISSING}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-900">{t ? formatNumber(t.mode, 1) : MISSING}</td>
                  <td className="px-1 py-2.5 text-right text-slate-600">{t ? formatNumber(t.high, 1) : MISSING}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InlineDisclosure label="How lost patient visits are counted">
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4 text-sm">
            {encounters.map(([label, value, hint]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt>
                  <span className="text-slate-800">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </dt>
                <dd className="tabular shrink-0 font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            <Kind>Modeled · one incident</Kind> Encounters are visits, not unique patients.
          </p>
        </InlineDisclosure>
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Diverted patients and delayed appointments show exposure, not harm. The model does not estimate injuries or deaths and never converts these
          indicators into dollars.
        </p>
      </div>
    </DisclosureSection>
  );
}
