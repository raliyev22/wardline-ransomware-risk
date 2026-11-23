import { asNumber } from "@/lib/format";

/** Horizontal coverage bar for values on a 0–100 scale. */
export function CoverageBar({ value, label }: { value: unknown; label: string }) {
  const n = asNumber(value);
  if (n === null) return <div className="h-2 rounded-full bg-slate-100" aria-label={`${label}: not available`} />;
  const pct = Math.max(0, Math.min(100, n));
  const tone = pct >= 70 ? "bg-accent-500" : pct >= 50 ? "bg-navy-500" : "bg-amber-500";
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-100"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
