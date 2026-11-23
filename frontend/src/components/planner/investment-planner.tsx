"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { usePlanStore } from "@/lib/plan-store";
import { effectRowsFor, groupInvestments, usePlannerEvaluation } from "@/lib/planner";
import type { HospitalResponse, InvestmentsResponse, MarginalItem } from "@/lib/types";
import { asNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { BudgetControl } from "./budget-control";
import { InvestmentCard } from "./investment-card";
import { HipaaSection } from "@/components/overview/hipaa-section";
import { PlanResults } from "./portfolio-summary";
import { Recommendation } from "./strategy-comparison";
import { PlannerMonteCarlo } from "./planner-monte-carlo";
import { MarginalSection, MethodSection, WhySection } from "./planner-sections";
import { buildNames, invName, joinNames } from "./planner-copy";

/** The engine's run-script example selection (shown by name, loaded only on request). */
const CISO_EXAMPLE = ["I01", "I04", "I06"];

function Step({ id, n, title, hint, children }: { id: string; n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-navy-900">
          <span className="flex size-6 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">{n}</span>
          {title}
        </h2>
        {hint && <p className="mt-0.5 pl-8 text-sm text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function InvestmentPlanner() {
  const invest = useApi<InvestmentsResponse>("/api/investments");
  const hospital = useApi<HospitalResponse>("/api/hospital");
  // Shared with Risk Analytics and Executive Comparison via the session plan store (inputs only).
  const { plan: savedPlan, setSelected, setBudget: setBudgetChoice } = usePlanStore();
  const selected = savedPlan.selected;
  const budgetChoice = savedPlan.budget;
  const [showRecommendation, setShowRecommendation] = useState(false);

  const engineBudget = invest.data?.budget?.budget_first_year_cash_usd ?? null;
  const budget = budgetChoice ?? engineBudget;
  const plan = usePlannerEvaluation(selected, budget);

  const groups = useMemo(() => (invest.data ? groupInvestments(invest.data) : []), [invest.data]);
  const names = useMemo(() => buildNames(invest.data, hospital.data), [invest.data, hospital.data]);
  const marginalById = useMemo(() => {
    // Only trust marginals computed for the current selection.
    const m = plan.marginals;
    const current = [...selected].sort().join();
    if (!m || [...m.investment_ids].sort().join() !== current) return new Map<string, MarginalItem>();
    return new Map(m.items.map((i) => [i.investment_id, i]));
  }, [plan.marginals, selected]);
  const requiredBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const inv of invest.data?.investments ?? []) {
      if (!selected.includes(inv.id)) continue;
      for (const r of inv.requires) map.set(r, [...(map.get(r) ?? []), inv.id]);
    }
    return map;
  }, [invest.data, selected]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pending = plan.loading || marginalById.size === 0;
  const itBudget = asNumber(hospital.data?.hospital_profile?.financials_usd?.annual_digital_infrastructure_spend);
  const example = CISO_EXAMPLE.filter((id) => names.investment.has(id));

  const header = (
    <PageHeader
      eyebrow="Investment Planner"
      title="Where should we invest our cybersecurity budget?"
      description="Build a cybersecurity investment plan, explore how it could reduce ransomware losses, and compare your choices with the model's recommendation."
      actions={
        <Link
          href="/comparison"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Executive Comparison
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    />
  );

  if (invest.loading) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" className="space-y-6">
          <span className="sr-only">Loading investments</span>
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (invest.error || !invest.data || budget === null || engineBudget === null) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorState error={invest.error ?? new Error("Investment data unavailable.")} onRetry={invest.reload} />
      </div>
    );
  }

  if (!invest.data.investments.length) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState message="The backend returned no investments." />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {header}

      <Step id="plan-step-1" n={1} title="How much can we invest?">
        <BudgetControl
          budget={budget}
          engineBudget={engineBudget}
          onBudget={setBudgetChoice}
          used={plan.evaluation?.spending.first_year_cash_usd}
          remaining={plan.evaluation?.budget?.remaining_usd}
          withinBudget={plan.evaluation?.budget?.within_selected_budget}
          annualized={plan.evaluation?.spending.annualized_spend_usd}
          itBudget={itBudget}
          costConvention={invest.data.budget.cost_convention}
        />
      </Step>

      {plan.error && (
        <ErrorState error={plan.error} title="The risk model could not evaluate this plan" compact />
      )}

      <Step id="plan-step-2" n={2} title="Which protections should we strengthen?" hint="Select the investments you want in your plan. Results below update automatically.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="tabular font-semibold text-navy-900">{selected.length}</span> of {invest.data.investments.length} investments selected
          </p>
          <div className="flex flex-wrap gap-2">
            {example.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected(example)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500"
                title={joinNames(example.map((id) => invName(names, id)))}
              >
                Load the CISO&apos;s example plan
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected([])}
              disabled={!selected.length}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Clear selection
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`grp-${g.key}`}>
              <h3 id={`grp-${g.key}`} className="text-sm font-semibold text-slate-700">
                {g.label}
                {g.blurb && <span className="font-normal text-slate-500"> · {g.blurb}</span>}
              </h3>
              <ul className="mt-2 grid items-start gap-3 md:grid-cols-2">
                {g.items.map((inv) => (
                  <InvestmentCard
                    key={inv.id}
                    inv={inv}
                    selected={selected.includes(inv.id)}
                    selectedIds={selected}
                    requiredBy={requiredBy.get(inv.id) ?? []}
                    marginal={marginalById.get(inv.id)}
                    effects={effectRowsFor(invest.data!, inv.id)}
                    names={names}
                    pending={pending}
                    onToggle={() => toggle(inv.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Step>

      <Step id="plan-step-3" n={3} title="How much could our plan reduce ransomware risk?" hint="The risk model's estimate for your current selection.">
        <PlanResults evaluation={plan.evaluation} loading={plan.loading} names={names} />
        {plan.evaluation && !plan.error && marginalById.size > 0 && (
          <HipaaSection controls={hospital.data?.security_controls} loading={hospital.loading}
            projects={invest.data.investments.filter((item) => selected.includes(item.id))} />
        )}
      </Step>

      <Step id="plan-step-4" n={4} title="What would the model recommend?">
        <Recommendation
          evaluation={plan.evaluation}
          optimum={plan.optimum}
          noEligible={plan.noEligible}
          budget={budget}
          loading={plan.loading}
          revealed={showRecommendation}
          onReveal={() => setShowRecommendation(true)}
          onLoadOptimized={setSelected}
          onSetBudget={setBudgetChoice}
          names={names}
          objective={typeof invest.data.config?.objective === "string" ? invest.data.config.objective : undefined}
        />
        <div className="flex justify-end">
          <Link
            href="/comparison"
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            Review updated comparison
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Step>

      <section aria-label="Supporting analysis" className="space-y-3">
        <WhySection invest={invest.data} selected={selected} names={names} />
        <MarginalSection items={plan.marginals?.items ?? []} names={names} pending={pending} />
        <PlannerMonteCarlo selected={selected} budget={budget} />
        <MethodSection invest={invest.data} />
      </section>

      <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Next step</p>
          <h2 className="mt-1 text-lg font-semibold">Prepare the board view</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-200">
            Compare no new investment, your plan and the model&apos;s recommendation side by side, with risk analysis for the board.
          </p>
        </div>
        <Link
          href="/comparison"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Continue to Executive Comparison
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
