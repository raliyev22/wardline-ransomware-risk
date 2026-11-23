"use client";

import { Landmark, Layers } from "lucide-react";
import type { ReactNode } from "react";
import type { HospitalResponse, InvestmentsResponse } from "@/lib/types";
import { asNumber, formatCurrency, formatNumber, humanize, numericEntries } from "@/lib/format";
import { DisclosureSection } from "@/components/ui/disclosure";
import { EmptyState, LoadingState, Skeleton } from "@/components/ui/states";

type Profile = HospitalResponse["hospital_profile"];

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="min-w-0 flex-1 text-sm text-slate-600">{label}</dt>
      <dd className="tabular max-w-[60%] text-right text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Group({ title, why, children }: { title: string; why?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {why && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{why}</p>}
      <dl className="mt-2 divide-y divide-slate-100">{children}</dl>
    </div>
  );
}

/* ---------------- Hospital Operations & Technology ---------------- */

/** Presentation-only grouping of profile keys; any key not listed falls into "Other figures". */
const OPS_GROUPS: { title: string; why: string; keys: string[] }[] = [
  {
    title: "Patient activity",
    why: "Volume of care that depends on clinical systems. Categories can overlap, so they are not summed.",
    keys: ["annual_patient_encounters", "annual_inpatient_admissions", "annual_emergency_visits", "annual_telehealth_visits"],
  },
  { title: "Workforce", why: "Staff accounts and inboxes are the main target of phishing and credential theft.", keys: ["employees"] },
  {
    title: "Endpoints & medical devices",
    why: "Each workstation and connected device is a possible entry point or path for ransomware to spread.",
    keys: ["workforce_endpoints", "networked_medical_devices"],
  },
  {
    title: "Servers, applications & vendors",
    why: "Servers hold the systems that must be restored; vendor connections are a separate route in.",
    keys: ["virtual_servers_and_cloud_workloads", "critical_technology_vendors"],
  },
];

const HEADLINE_FACILITIES = new Set(["hospitals", "specialty_clinics"]);

export function OperationsSection({ profile, loading }: { profile?: Profile; loading: boolean }) {
  const ops = numericEntries(profile?.operations);
  const opsMap = new Map(ops);
  const known = new Set(OPS_GROUPS.flatMap((g) => g.keys));
  const other = ops.filter(([k]) => !known.has(k));
  const sites = numericEntries(profile?.facilities).filter(([k]) => !HEADLINE_FACILITIES.has(k));
  const groups = OPS_GROUPS.map((g) => ({ ...g, entries: g.keys.flatMap((k) => (opsMap.has(k) ? [[k, opsMap.get(k)!] as [string, number]] : [])) })).filter(
    (g) => g.entries.length > 0,
  );

  return (
    <DisclosureSection
      title="Hospital Operations & Technology"
      icon={<Layers className="size-4" aria-hidden />}
      summary={
        loading ? (
          <Skeleton className="mt-1 inline-block h-3.5 w-56" />
        ) : (
          "Care volumes, workforce and the digital footprint that shape ransomware exposure."
        )
      }
    >
      {loading ? (
        <LoadingState rows={5} />
      ) : ops.length === 0 && sites.length === 0 ? (
        <EmptyState message="Not provided in the hospital profile." />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {sites.length > 0 && (
            <Group title="Other care sites and capacity" why="Facilities beyond the hospitals and specialty clinics shown above.">
              {sites.map(([k, v]) => (
                <Figure key={k} label={humanize(k)} value={formatNumber(v)} />
              ))}
            </Group>
          )}
          {groups.map((g) => (
            <Group key={g.title} title={g.title} why={g.why}>
              {g.entries.map(([k, v]) => (
                <Figure key={k} label={humanize(k)} value={formatNumber(v)} />
              ))}
            </Group>
          ))}
          {other.length > 0 && (
            <Group title="Other figures">
              {other.map(([k, v]) => (
                <Figure key={k} label={humanize(k)} value={formatNumber(v)} />
              ))}
            </Group>
          )}
        </div>
      )}
    </DisclosureSection>
  );
}

/* ---------------- Hospital Financial Profile ---------------- */

const FINANCE_LABELS: Record<string, string> = {
  annual_operating_revenue: "Annual revenue",
  annual_operating_expenses: "Annual operating expenses",
  annual_operating_margin: "Annual operating margin",
  annual_digital_infrastructure_spend: "Existing annual IT budget",
};
const NEW_BUDGET_KEYS = new Set(["new_ransomware_resilience_capex_budget", "budget_horizon_months"]);

export function FinanceSection({ profile, invest, loading }: { profile?: Profile; invest?: InvestmentsResponse; loading: boolean }) {
  const fin = numericEntries(profile?.financials_usd);
  const org = fin.filter(([k]) => !NEW_BUDGET_KEYS.has(k));
  const fmt = (k: string, v: number) => (k.endsWith("_months") ? `${formatNumber(v)} months` : formatCurrency(v, { compact: true }));
  const newBudget = asNumber(profile?.financials_usd?.new_ransomware_resilience_capex_budget);
  const horizon = asNumber(profile?.financials_usd?.budget_horizon_months);
  const life = asNumber(invest?.budget?.cost_convention?.assumed_useful_life_years);

  return (
    <DisclosureSection
      title="Hospital Financial Profile"
      icon={<Landmark className="size-4" aria-hidden />}
      summary={loading ? <Skeleton className="mt-1 inline-block h-3.5 w-56" /> : "Revenue, operating costs, existing IT spending and the new investment budget."}
    >
      {loading ? (
        <LoadingState rows={5} />
      ) : fin.length === 0 ? (
        <EmptyState message="Not provided in the hospital profile." />
      ) : (
        <div className="space-y-4">
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Group title="Organization finances" why="Annual figures for the whole network.">
              {org.map(([k, v]) => (
                <Figure key={k} label={FINANCE_LABELS[k] ?? humanize(k)} value={fmt(k, v)} />
              ))}
            </Group>
            <Group title="Available new cybersecurity investment budget" why="The extra money the Investment Planner can allocate to new controls.">
              {newBudget !== null && <Figure label="New resilience budget" value={formatCurrency(newBudget, { compact: true })} />}
              {horizon !== null && <Figure label="Budget horizon" value={`${formatNumber(horizon)} months`} />}
              {life !== null && <Figure label="Assumed useful life of investments" value={`${formatNumber(life)} years`} />}
            </Group>
          </div>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
            The <span className="font-medium text-slate-800">existing annual IT budget</span> funds today&apos;s technology operations. It is separate from the{" "}
            <span className="font-medium text-slate-800">new cybersecurity investment budget</span>, which is the only money the planner spends on additional
            ransomware defenses.
          </p>
        </div>
      )}
    </DisclosureSection>
  );
}
