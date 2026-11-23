"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/components/ui/card";

/** Stable strategy colors shared by the charts, comparison cards and legends. */
export const STRATEGY_SERIES = [
  { key: "baseline", label: "No new investment", color: "var(--chart-current)" },
  { key: "ciso", label: "Your plan", color: "var(--chart-funded)" },
  { key: "optimized", label: "Model-recommended plan", color: "var(--chart-recommended)" },
] as const;

export type SeriesDef = { key: string; label: string; color: string };

export interface BarGroup {
  label: string;
  hint?: string;
  values: Record<string, number | null | undefined>;
}

/** Horizontal grouped bars on one shared zero-based axis, with legend, hover/focus tooltip and a table view. */
export function GroupedBarChart({
  groups,
  series,
  format,
  caption,
}: {
  groups: BarGroup[];
  series: readonly SeriesDef[];
  format: (v: number) => string;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const active = series.filter((s) => groups.some((g) => typeof g.values[s.key] === "number"));
  const max = Math.max(1, ...groups.flatMap((g) => active.map((s) => g.values[s.key] ?? 0)));

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
          {active.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          aria-pressed={table}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Table2 className="size-3.5" aria-hidden /> {table ? "Show chart" : "Show table"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="tabular min-w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-4 text-left font-semibold">Statistic</th>
                {active.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => (
                <tr key={g.label}>
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-slate-700">
                    {g.label}
                  </th>
                  {active.map((s) => {
                    const v = g.values[s.key];
                    return (
                      <td key={s.key} className="px-3 py-2 text-right text-slate-900">
                        {typeof v === "number" ? format(v) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="group" aria-label={caption} className="space-y-4">
          {groups.map((g, gi) => (
            <div
              key={g.label}
              tabIndex={0}
              onMouseEnter={() => setHover(gi)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(gi)}
              onBlur={() => setHover(null)}
              className="relative grid gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
            >
              <div className="text-sm">
                <p className="font-medium text-slate-800">{g.label}</p>
                {g.hint && <p className="text-xs text-slate-500">{g.hint}</p>}
              </div>
              <div className="space-y-[2px] py-0.5">
                {active.map((s) => {
                  const v = g.values[s.key];
                  const pct = typeof v === "number" ? Math.max(0, v / max) * 100 : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <div className="h-3 flex-1">
                        {typeof v === "number" && (
                          <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(pct, 0.5)}%`, background: s.color }} />
                        )}
                      </div>
                      <span className="tabular w-16 shrink-0 text-right text-xs text-slate-600">{typeof v === "number" ? format(v) : "—"}</span>
                    </div>
                  );
                })}
              </div>
              {hover === gi && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
                >
                  <p className="font-semibold text-slate-900">{g.label}</p>
                  <ul className="mt-1.5 space-y-1">
                    {active.map((s) => (
                      <li key={s.key} className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                          {s.label}
                        </span>
                        <span className="tabular font-medium text-slate-900">
                          {typeof g.values[s.key] === "number" ? format(g.values[s.key] as number) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <div className={cn("hidden border-t border-slate-200 pt-1 text-[11px] text-slate-400 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4")} aria-hidden>
            <span />
            <span className="flex justify-between pr-[4.5rem]">
              <span>0</span>
              <span>{format(max)}</span>
            </span>
          </div>
        </div>
      )}
    </figure>
  );
}
