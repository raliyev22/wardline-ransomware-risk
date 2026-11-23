"use client";

import { useRef, type KeyboardEvent } from "react";
import { Crosshair, Server } from "lucide-react";
import type { RansomwareScenario } from "@/lib/types";
import { asText, formatNumber, splitIds } from "@/lib/format";
import { cn } from "@/components/ui/card";

/** Accessible tablist of scenario cards (arrow keys move between scenarios). */
export function ScenarioSelector({
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
        const affected = Array.isArray(s.potentially_affected_asset_ids) ? s.potentially_affected_asset_ids.length : splitIds(s.potentially_affected_asset_ids).length;
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
              "group relative flex flex-col rounded-xl border bg-white p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:p-5",
              selected ? "border-navy-700 shadow-[0_0_0_1px_var(--color-navy-700)]" : "border-slate-200 hover:border-navy-300",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400">Scenario {i + 1}</span>
              <span
                className={cn("size-2.5 rounded-full ring-2 ring-offset-1", selected ? "bg-navy-700 ring-navy-200" : "bg-white ring-slate-200")}
                aria-hidden
              />
            </span>
            <span className="mt-2 font-semibold text-navy-900">{asText(s.name) ?? id}</span>
            <span className="mt-1 line-clamp-2 text-sm text-slate-600">{asText(s.description) ?? ""}</span>
            <span className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Crosshair className="size-3.5" aria-hidden />
                {asText(s.entry_point) ?? "Entry point not provided"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Server className="size-3.5" aria-hidden />
                {formatNumber(affected)} assets exposed
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
