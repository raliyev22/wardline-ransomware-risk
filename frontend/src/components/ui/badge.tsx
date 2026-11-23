import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./card";

export type BadgeTone = "neutral" | "navy" | "accent" | "warning" | "danger" | "success";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  navy: "bg-navy-50 text-navy-700 ring-navy-100",
  accent: "bg-accent-50 text-accent-700 ring-accent-100",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Required on every surface that shows model inputs or outputs. */
export function SyntheticBadge({ label = "Synthetic / Illustrative" }: { label?: string }) {
  return (
    <Badge tone="warning">
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

export type Provenance = "source" | "narrative" | "engine_input" | "explanatory";

const PROVENANCE: Record<Provenance, { label: string; tone: BadgeTone; title: string }> = {
  source: { label: "Source mapping", tone: "accent", title: "Documented relationship in the synthetic source data" },
  narrative: { label: "Illustrative narrative", tone: "neutral", title: "Descriptive storyline from the scenario data; not a modeled calculation" },
  engine_input: { label: "Engine input assumption", tone: "navy", title: "Synthetic parameter fed into the risk engine; not a modeled outcome" },
  explanatory: { label: "Explanatory", tone: "neutral", title: "General explanation; not a scenario-specific model output" },
};

/** Tells the reader whether content is documented data, narrative, an engine assumption, or explanation. */
export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const p = PROVENANCE[kind];
  return (
    <span title={p.title}>
      <Badge tone={p.tone}>{p.label}</Badge>
    </span>
  );
}

export function criticalityTone(value: unknown): BadgeTone {
  switch (String(value ?? "").toLowerCase()) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "navy";
    default:
      return "neutral";
  }
}
