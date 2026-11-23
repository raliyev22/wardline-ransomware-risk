import Link from "next/link";
import { ArrowLeft, Clock, Plug, type LucideIcon } from "lucide-react";
import { Badge, SyntheticBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export interface PlannedFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface DataSource {
  method: "GET" | "POST";
  path: string;
  purpose: string;
}

/** Layout for pages whose functionality is planned but not yet connected. Shows no model results. */
export function PlaceholderPage({
  eyebrow,
  title,
  description,
  features,
  dataSources,
  resultLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  features: PlannedFeature[];
  dataSources: DataSource[];
  resultLabel: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        badges={
          <>
            <Badge tone="navy">
              <Clock className="size-3" aria-hidden />
              Planned
            </Badge>
            <SyntheticBadge />
          </>
        }
      />

      <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50/50 px-5 py-4 text-sm text-navy-800">
        This page is a layout preview. It does not show any simulation or analysis results yet; once connected, every figure will
        come from the decision-support API and be labelled <span className="font-medium">{resultLabel}</span>.
      </div>

      <section aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Planned functionality
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="mt-3 font-medium text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <CardHeader
          title="Data sources"
          icon={<Plug className="size-4" aria-hidden />}
          description="Backend endpoints this page will use. No figures are computed in the browser."
        />
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {dataSources.map((s) => (
              <li key={`${s.method} ${s.path}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                <code className="flex shrink-0 items-center gap-2 font-mono text-xs text-slate-700 sm:w-64">
                  <span className={s.method === "GET" ? "font-semibold text-accent-700" : "font-semibold text-navy-600"}>{s.method}</span>
                  {s.path}
                </code>
                <span className="text-sm text-slate-600">{s.purpose}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900">
        <ArrowLeft className="size-4" aria-hidden />
        Back to Hospital Overview
      </Link>
    </div>
  );
}
