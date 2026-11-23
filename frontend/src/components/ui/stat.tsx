import type { ReactNode } from "react";
import { cn } from "./card";

export function Stat({
  label,
  value,
  hint,
  icon,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border bg-white px-4 py-4 shadow-panel", emphasis ? "border-navy-200" : "border-slate-200")}>
      <div className="flex items-center justify-between gap-2 text-[13px] leading-snug font-[570] text-slate-600">
        <span>{label}</span>
        {icon && <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>}
      </div>
      <div className={cn("tabular mt-1.5 font-[635] tracking-[-0.05em] text-slate-900", emphasis ? "text-[clamp(1.5rem,2.3vw,2.22rem)]" : "text-2xl")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
