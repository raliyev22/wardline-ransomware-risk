"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Pencil } from "lucide-react";
import { portfolioDiff, useDecisionData } from "@/lib/decision";
import { usePlanHydrated, usePlanStore } from "@/lib/plan-store";
import { useApi } from "@/lib/use-api";
import type { HospitalResponse, InvestmentsResponse } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { buildNames, withNames } from "@/components/planner/planner-copy";
import { StrategyColumns, buildStrategies } from "./strategy-columns";
import { ExecutiveConclusion } from "./executive-conclusion";
import { HipaaSection } from "@/components/overview/hipaa-section";
import { BadYearSection, FinancialDetails, HowRecommended, OperationsDetails } from "./executive-sections";

function ChangeInvestments({ variant = "primary" }: { variant?: "primary" | "inverse" }) {
  return (
    <Link
      href="/investments"
      className={
        variant === "primary"
          ? "inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          : "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      }
    >
      <Pencil className="size-4" aria-hidden /> Change investments
    </Link>
  );
}

export function ExecutiveComparison() {
  const hydrated = usePlanHydrated();
  const { plan, setBudget } = usePlanStore();
  const invest = useApi<InvestmentsResponse>("/api/investments");
  const hospital = useApi<HospitalResponse>("/api/hospital");

  const engineBudget = invest.data?.budget?.budget_first_year_cash_usd ?? null;
  const budget = engineBudget === null ? null : Math.min(plan.budget ?? engineBudget, engineBudget);
  const catalogIds = useMemo(() => new Set((invest.data?.investments ?? []).map((i) => i.id)), [invest.data]);
  const selected = useMemo(() => plan.selected.filter((id) => catalogIds.has(id)), [plan.selected, catalogIds]);
  const ready = hydrated && budget !== null && invest.data !== undefined;
  const decision = useDecisionData(selected, ready ? budget : null);

  const allNames = useMemo(() => buildNames(invest.data, hospital.data), [invest.data, hospital.data]);
  const names = allNames.investment;
  const data = decision.data;
  const strategies = useMemo(() => (data ? buildStrategies(data) : []), [data]);
  const cisoInvalid = data?.cisoInvalid ? withNames(data.cisoInvalid, allNames) : undefined;
  const matches = Boolean(data?.ciso && data.optimum && data.ciso.investment_ids.length > 0 && portfolioDiff(data.ciso.investment_ids, data.optimum.selected_investments).identical);

  const header = (
    <PageHeader
      eyebrow="Executive Comparison"
      title="Which cybersecurity strategy should our hospital choose?"
      description="Compare your investment choices with today's protections and the model-recommended strategy to see the financial, operational, and patient-care tradeoffs."
      actions={<ChangeInvestments />}
    />
  );

  if (invest.loading || !hydrated) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" className="grid gap-4 lg:grid-cols-3">
          <span className="sr-only">Loading executive comparison</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (invest.error || !invest.data || !ready || budget === null) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorState error={invest.error ?? new Error("Investment data unavailable.")} onRetry={() => (invest.reload(), hospital.reload())} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <section aria-labelledby="ex-cols" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="ex-cols" className="text-base font-semibold text-navy-900">
            Strategy comparison
          </h2>
          <p className="text-xs text-slate-500">
            First-year budget {formatCurrency(budget)}
            {budget === engineBudget && " (model maximum)"} · from the Investment Planner
          </p>
        </div>

        {decision.error && <ErrorState error={decision.error} onRetry={decision.retry} title="Could not load the comparison" compact />}

        {!data && decision.loading && (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        )}

        {data && (
          <div className={decision.loading || decision.stale ? "space-y-3 opacity-60 transition-opacity" : "space-y-3"} aria-busy={decision.loading}>
            {matches && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-900">
                <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />
                Your selected investments match the model&apos;s recommendation for this budget.
              </p>
            )}
            <StrategyColumns
              strategies={strategies}
              names={names}
              matches={matches}
              cisoInvalid={cisoInvalid}
              noEligibleMessage={data.noEligible ? withNames(data.noEligible.message, allNames) : undefined}
              minEligibleBudget={data.noEligible?.min_first_year_cash_for_eligible_portfolio_usd}
              onSetBudget={setBudget}
            />
            <p className="text-xs text-slate-500">
              Modeled averages per year. &ldquo;Model-recommended&rdquo; means the highest modeled net benefit within the budget and safety requirements, not
              necessarily the safest plan in a bad year.
            </p>
          </div>
        )}
      </section>

      {data && (
        <div className={decision.loading || decision.stale ? "opacity-60 transition-opacity" : undefined}>
          <ExecutiveConclusion data={data} strategies={strategies} budget={budget} names={names} cisoInvalid={cisoInvalid} />
        </div>
      )}

      {data && (
        <section aria-label="Supporting detail" className="space-y-3">
          {data.ciso && !decision.stale && (
            <HipaaSection controls={hospital.data?.security_controls} loading={hospital.loading}
              projects={invest.data.investments.filter((item) => selected.includes(item.id))} />
          )}
          <FinancialDetails strategies={strategies} />
          <OperationsDetails strategies={strategies} />
          {!cisoInvalid && <BadYearSection selected={selected} budget={budget} names={names} />}
          <HowRecommended optimum={data.optimum} budget={budget} />
        </section>
      )}

      <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Not convinced yet?</p>
          <h2 className="mt-1 text-lg font-semibold">Adjust your plan and compare again</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-200">
            Your budget and selections are kept. Change them in the Investment Planner, then return here to see the updated comparison.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <ChangeInvestments variant="inverse" />
          <Link href="/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-navy-200 hover:text-white">
            Review residual risk <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
