"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "./card";

/** Open/closed state plus the ids that link a toggle button to its panel. */
export function useDisclosure(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  return { open, toggle: () => setOpen((o) => !o), buttonId: `${id}-button`, panelId: `${id}-panel` };
}

/**
 * Collapsible panel. Closed content is `inert` (not focusable, hidden from screen readers);
 * the height change is a short grid-rows transition, disabled for reduced-motion users.
 */
export function DisclosurePanel({
  open,
  id,
  labelledBy,
  region = false,
  className,
  children,
}: {
  open: boolean;
  id: string;
  labelledBy: string;
  region?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role={region ? "region" : undefined}
      aria-labelledby={labelledBy}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}

export function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180", className)}
      aria-hidden
    />
  );
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500";

/** Card-style accordion section: heading button with a one-line summary, collapsed by default. */
export function DisclosureSection({
  title,
  summary,
  icon,
  meta,
  defaultOpen = false,
  bodyClassName,
  children,
}: {
  title: string;
  summary?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const d = useDisclosure(defaultOpen);
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-panel">
      <h2>
        <button
          type="button"
          id={d.buttonId}
          aria-expanded={d.open}
          aria-controls={d.panelId}
          onClick={d.toggle}
          className={cn("group flex w-full items-center gap-3 rounded-xl px-5 py-4 text-left hover:bg-slate-50/70 sm:px-6", FOCUS)}
        >
          {icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-base font-[650] tracking-tight text-slate-900">{title}</span>
            {summary && <span className="mt-0.5 block text-sm text-slate-500">{summary}</span>}
          </span>
          {meta && <span className="hidden shrink-0 sm:inline-flex">{meta}</span>}
          <Chevron open={d.open} className="group-hover:text-slate-600" />
        </button>
      </h2>
      <DisclosurePanel open={d.open} id={d.panelId} labelledBy={d.buttonId} region>
        <div className={cn("border-t border-slate-100 px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
      </DisclosurePanel>
    </section>
  );
}

/** Small expandable card used inside a section (one asset, one control). */
export function DisclosureCard({ header, children }: { header: ReactNode; children: ReactNode }) {
  const d = useDisclosure(false);
  return (
    <div className={cn("rounded-lg border bg-white transition-colors", d.open ? "border-navy-200" : "border-slate-200 hover:border-slate-300")}>
      <h3>
        <button
          type="button"
          id={d.buttonId}
          aria-expanded={d.open}
          aria-controls={d.panelId}
          onClick={d.toggle}
          className={cn("flex w-full items-start gap-3 rounded-lg p-4 text-left", FOCUS)}
        >
          <span className="min-w-0 flex-1">{header}</span>
          <Chevron open={d.open} className="mt-0.5" />
        </button>
      </h3>
      <DisclosurePanel open={d.open} id={d.panelId} labelledBy={d.buttonId}>
        <div className="mx-4 border-t border-slate-100 pt-3 pb-4">{children}</div>
      </DisclosurePanel>
    </div>
  );
}

/** Compact inline toggle (text button + panel) for secondary details. */
export function InlineDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const d = useDisclosure(false);
  return (
    <div>
      <button
        type="button"
        id={d.buttonId}
        aria-expanded={d.open}
        aria-controls={d.panelId}
        onClick={d.toggle}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-navy-700 hover:text-navy-900", FOCUS)}
      >
        {label}
        <Chevron open={d.open} className="text-current" />
      </button>
      <DisclosurePanel open={d.open} id={d.panelId} labelledBy={d.buttonId} region>
        <div className="pt-3">{children}</div>
      </DisclosurePanel>
    </div>
  );
}
