"use client";

import { useRef, type KeyboardEvent } from "react";
import { SEVERITIES } from "@/lib/simulator";
import type { SeverityKey } from "@/lib/types";
import { formatFraction } from "@/lib/format";
import { cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { SEVERITY_PLAIN } from "./sim-copy";

const TONE: Record<SeverityKey, { dot: string; active: string }> = {
  contained: { dot: "bg-accent-500", active: "border-accent-600 shadow-[0_0_0_1px_var(--color-accent-600)]" },
  major: { dot: "bg-amber-500", active: "border-amber-500 shadow-[0_0_0_1px_var(--color-amber-500)]" },
  severe: { dot: "bg-rose-500", active: "border-rose-500 shadow-[0_0_0_1px_var(--color-rose-500)]" },
};

/** Radio group for a hypothetical incident severity; shows how often this scenario's deployments end that way. */
export function SeveritySelector({
  value,
  onChange,
  weights,
  scenarioName,
}: {
  value: SeverityKey;
  onChange: (s: SeverityKey) => void;
  weights?: Partial<Record<SeverityKey, number>> | null;
  scenarioName: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + SEVERITIES.length) % SEVERITIES.length;
    onChange(SEVERITIES[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Incident severity" className="grid gap-3 sm:grid-cols-3">
        {SEVERITIES.map((s, i) => {
          const selected = s.key === value;
          const w = weights?.[s.key];
          return (
            <button
              key={s.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(s.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex flex-col rounded-xl border bg-white p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                selected ? TONE[s.key].active : "border-slate-200 hover:border-navy-300",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", TONE[s.key].dot)} aria-hidden />
                <span className="font-semibold text-navy-900">{SEVERITY_PLAIN[s.key].title}</span>
              </span>
              <span className="mt-1.5 text-sm text-slate-600">{SEVERITY_PLAIN[s.key].summary}</span>
              {typeof w === "number" && (
                <span className="tabular mt-auto pt-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{formatFraction(w, 1)}</span> of ransomware deployments in this scenario end this way
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        This is a &ldquo;what if&rdquo; choice. Picking a severity does not predict that {scenarioName.toLowerCase()} will reach it.
      </p>
      <InlineDisclosure label="How the model defines each severity">
        <dl className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {SEVERITIES.map((s) => (
            <div key={s.key} className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
              <dt className="font-medium text-slate-800">{s.label}</dt>
              <dd className="text-slate-600">{s.branch}</dd>
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-500">
            Severity follows the attack-stage branches: contained = no major spread; major = major spread without severe escalation; severe = major spread
            with severe escalation.
          </p>
        </dl>
      </InlineDisclosure>
    </div>
  );
}
