import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <div className="mt-2 text-[15px] leading-relaxed text-slate-600">{description}</div>}
        {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
      </div>
      {actions && <div className="flex max-w-full shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
