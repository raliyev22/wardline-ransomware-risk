"use client";

import { useRef, type KeyboardEvent } from "react";
import { DoorOpen } from "lucide-react";
import type { RansomwareScenario } from "@/lib/types";
import { asText } from "@/lib/format";
import { cn } from "@/components/ui/card";
import { sentence } from "./threat-copy";

/** First clause of the source description (text before the first ";"), so the card stays short. */
function shortDescription(s: RansomwareScenario) {
  const d = asText(s.description);
  if (!d) return null;
  const first = d.split(";")[0].trim();
  return sentence(first.endsWith(".") ? first : `${first}.`);
}

/** Accessible tablist of scenario cards (arrow keys move between scenarios). */
export function ScenarioCards({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: RansomwareScenario[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + scenarios.length) % scenarios.length;
    onSelect(String(scenarios[next].scenario_id));
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Ransomware scenarios" className="grid gap-3 md:grid-cols-3">
      {scenarios.map((s, i) => {
        const id = String(s.scenario_id);
        const selected = id === selectedId;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`scenario-tab-${id}`}
            aria-selected={selected}
            aria-controls="scenario-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex flex-col rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:p-5",
              selected ? "border-navy-800 bg-navy-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-navy-300",
            )}
          >
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", selected ? "text-wardline-lime" : "text-slate-400")}>
              Scenario {i + 1}
            </span>
            <span className={cn("mt-1 font-semibold", selected ? "text-white" : "text-navy-900")}>{asText(s.name) ?? id}</span>
            {shortDescription(s) && (
              <span className={cn("mt-1.5 text-sm leading-relaxed", selected ? "text-navy-100" : "text-slate-600")}>{shortDescription(s)}</span>
            )}
            {asText(s.entry_point) && (
              <span className={cn("mt-auto flex items-center gap-1.5 pt-3 text-xs", selected ? "text-navy-200" : "text-slate-500")}>
                <DoorOpen className="size-3.5 shrink-0" aria-hidden />
                Entry: {s.entry_point}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
