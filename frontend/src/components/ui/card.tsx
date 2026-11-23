import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white shadow-panel", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-[650] tracking-[-0.036em] text-slate-900">{title}</h2>
          {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-5 sm:px-6", className)}>{children}</div>;
}
