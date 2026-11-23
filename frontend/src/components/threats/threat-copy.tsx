import type { ReactNode } from "react";
import type { StageKey } from "@/lib/threats";
import { asText } from "@/lib/format";

/**
 * Plain-language labels for the engine's five stages. The precise engine definitions stay in
 * `STAGES` (lib/threats.ts) and are shown inside each stage's expanded details.
 */
export const PLAIN_STAGE: Record<StageKey, { label: string; summary: string; chanceSuffix: string }> = {
  attempt: { label: "Attack attempt", summary: "An attacker tries to get into the hospital network.", chanceSuffix: "" },
  initial_access: { label: "Initial access", summary: "The attacker gets past defenses and gains a foothold.", chanceSuffix: "per attempt" },
  deployment: { label: "Ransomware deployment", summary: "Ransomware is launched before it can be detected and stopped.", chanceSuffix: "after access" },
  major_spread: { label: "Major spread", summary: "Ransomware spreads from the first system to other hospital systems.", chanceSuffix: "after deployment" },
  recovery_severity: {
    label: "Severity & recovery",
    summary: "Services are disrupted and the hospital works to restore them.",
    chanceSuffix: "of major spreads turn severe",
  },
};

/** What an investment's `affected_metric` changes, in plain words (engine input, not loss). */
export const PLAIN_METRIC: Record<string, string> = {
  initial_access: "the chance an attacker gains access",
  deployment: "the chance ransomware is deployed after access",
  major_spread: "the chance of widespread infection after deployment",
  recovery_days: "recovery days per incident",
  iomt_disruption: "the chance connected medical devices are hit after a major spread",
};

export const sentence = (v: unknown) => {
  const t = asText(v);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
};

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-1.5 @md:grid-cols-[10rem_1fr] @md:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/** IDs resolved to names; the ID stays as a subtle secondary reference. */
export function NamedIds({ ids, names }: { ids: string[]; names: Map<string, string> }) {
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

/** Small neutral label for engine assumptions vs modeled outputs (replaces repeated orange badges). */
export function Kind({ children }: { children: ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</span>;
}
