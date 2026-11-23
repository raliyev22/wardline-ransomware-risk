"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApiError, apiPost, toApiError } from "@/lib/api";
import { usePlanHydrated, usePlanStore } from "@/lib/plan-store";
import { useApi } from "@/lib/use-api";
import type { EvaluateResponse, HospitalResponse, InvestmentsResponse, StressTestResponse } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState, Skeleton } from "@/components/ui/states";
import { buildNames, withNames } from "@/components/planner/planner-copy";
import { BeforeAfter, MethodSection, PlanContext, RemainingRisk, RemainingThreats, SectionHeading } from "./residual-sections";
import { ResidualMonteCarlo } from "./residual-monte-carlo";
import { StressResults } from "./stress-results";

interface Fetched<T> {
  data?: T;
  error?: ApiError;
  /** Backend 400 invalid_portfolio message (dependency rule broken). */
  invalid?: string;
  loading: boolean;
  key?: string;
}

/** POSTs the shared plan to an endpoint; re-runs when the plan changes and ignores superseded responses. */
function usePlanPost<T>(path: string, selected: string[], budget: number | null) {
  const [state, setState] = useState<Fetched<T>>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  const key = JSON.stringify([[...selected].sort(), budget]);

  useEffect(() => {
    if (budget === null) return;
    const id = ++seq.current;
    const [ids] = JSON.parse(key) as [string[], number];
    const t = setTimeout(() => {
      setState({ loading: true, key });
      apiPost<T>(path, { investment_ids: ids, budget_usd: budget }).then(
        (data) => id === seq.current && setState({ data, loading: false, key }),
        (e: unknown) => {
          if (id !== seq.current) return;
          const err = toApiError(e);
          const d = err.detail as { error?: string; message?: string } | undefined;
          if (err.status === 400 && d?.error === "invalid_portfolio") setState({ invalid: d.message ?? "Invalid plan", loading: false, key });
          else setState({ error: err, loading: false, key });
        },
      );
    }, 200);
    return () => clearTimeout(t);
  }, [path, key, budget, attempt]);

  return { ...state, stale: state.key !== undefined && state.key !== key, retry: () => setAttempt((n) => n + 1) };
}

export function RiskAnalytics() {
  const hydrated = usePlanHydrated();
  const { plan } = usePlanStore();
  const invest = useApi<InvestmentsResponse>("/api/investments");
  const hospital = useApi<HospitalResponse>("/api/hospital");

  const engineBudget = invest.data?.budget?.budget_first_year_cash_usd ?? null;
  const budget = engineBudget === null ? null : Math.min(plan.budget ?? engineBudget, engineBudget);
  const catalogIds = useMemo(() => new Set((invest.data?.investments ?? []).map((i) => i.id)), [invest.data]);
  const selected = useMemo(() => plan.selected.filter((id) => catalogIds.has(id)), [plan.selected, catalogIds]);
  const ready = hydrated && budget !== null && invest.data !== undefined;
  const evaluation = usePlanPost<EvaluateResponse>("/api/portfolio/evaluate", selected, ready ? budget : null);
  const names = useMemo(() => buildNames(invest.data, hospital.data), [invest.data, hospital.data]);
  const invalidMessage = evaluation.invalid ? withNames(evaluation.invalid, names) : undefined;
  const currentEval = evaluation.stale ? undefined : evaluation.data;
  const stress = usePlanPost<StressTestResponse>("/api/sensitivity/stress", selected, currentEval ? budget : null);

  const header = (
    <PageHeader
      eyebrow="Risk Analytics"
      title="Residual risk: how safe is our hospital after investing?"
      description={
        <>
          See how much ransomware risk remains after your selected security improvements, which threats still matter, and how costly a bad year could
          become.
          <span className="mt-2 block text-sm text-slate-500">
            <strong className="font-semibold text-slate-700">Residual risk</strong> is the risk that remains even after we improve our security.
          </span>
        </>
      }
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

  if (invest.loading || !hydrated) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" className="space-y-6">
          <span className="sr-only">Loading residual risk</span>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (invest.error || !ready || budget === null || engineBudget === null) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorState
          error={invest.error ?? new Error("Investment data unavailable.")}
          onRetry={() => {
            invest.reload();
            hospital.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {header}

      <PlanContext selected={selected} budget={budget} engineBudget={engineBudget} names={names} evaluation={currentEval} invalidMessage={invalidMessage} />

      <section aria-labelledby="rr-1" className="space-y-3">
        <SectionHeading id="rr-1" n={1} title="How much ransomware risk remains?" />
        <RemainingRisk
          evaluation={currentEval}
          loading={evaluation.loading}
          error={evaluation.error}
          invalidMessage={invalidMessage}
          onRetry={evaluation.retry}
        />
      </section>

      {currentEval && !invalidMessage && (
        <section aria-labelledby="rr-2" className="space-y-3">
          <SectionHeading id="rr-2" n={2} title="How much safer are we now?" />
          <BeforeAfter evaluation={currentEval} />
        </section>
      )}

      <section aria-labelledby="rr-3" className="space-y-3">
        <SectionHeading id="rr-3" n={3} title="What could still go wrong?" />
        {hospital.error ? (
          <ErrorState error={hospital.error} onRetry={hospital.reload} title="Threat data unavailable" compact />
        ) : hospital.loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <RemainingThreats models={hospital.data?.attack_stage_model ?? []} evaluation={invalidMessage ? undefined : currentEval} names={names} />
        )}
      </section>

      <section aria-labelledby="rr-4" className="space-y-3">
        <SectionHeading id="rr-4" n={4} title="How costly could a bad ransomware year become?">
          What thousands of one-year trials say about the residual risk of {selected.length ? "your plan" : "today's protections"}.
        </SectionHeading>
        <ResidualMonteCarlo
          selected={selected}
          budget={budget}
          disabled={Boolean(invalidMessage)}
          waiting={!invalidMessage && !currentEval && !evaluation.error}
        />
      </section>

      {currentEval && (
        <section aria-labelledby="rr-5" className="space-y-3">
          <SectionHeading id="rr-5" n={5} title="Stress testing" />
          {stress.stale || stress.loading ? (
            <LoadingState label="Loading stress tests" />
          ) : stress.data ? (
            <StressResults report={stress.data} />
          ) : (
            <ErrorState error={stress.error ?? new Error(stress.invalid ?? "Stress test results are unavailable.")} onRetry={stress.retry} compact />
          )}
        </section>
      )}

      <section aria-label="Assumptions and method" className="space-y-3">
        <MethodSection />
      </section>

      <section className="risk-banner risk-cta flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wardline-lime">Next step</p>
          <h2 className="mt-1 text-lg font-semibold">Summarize for the board</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-200">Bring today&apos;s protections, your plan and the model&apos;s recommendation together in one executive view.</p>
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
