"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPost, toApiError } from "./api";
import type { EvaluateResponse, MarginalsResponse, NoEligiblePortfolioDetail, OptimizeResponse } from "./types";

/**
 * Executive Comparison data, all from existing backend endpoints (no figures computed in the browser):
 * - evaluate([])        → baseline metrics + guardrail check
 * - evaluate(ciso)      → CISO metrics, spending, avoided loss, net benefit, guardrails, overlap effects
 * - optimize(budget)    → engine optimum for the budget, or a 409 "no eligible portfolio" explanation
 * - evaluate(optimized) → same detail for the optimum (guardrail limits, overlap effects)
 * - marginals(ciso)     → engine impact of adding/removing each investment relative to the CISO portfolio
 */
export interface DecisionData {
  baseline: EvaluateResponse;
  /** Undefined when the saved plan breaks a dependency rule (see cisoInvalid). */
  ciso?: EvaluateResponse;
  /** Backend invalid_portfolio message for the saved plan, if any. */
  cisoInvalid?: string;
  optimum?: OptimizeResponse;
  optimizedEval?: EvaluateResponse;
  noEligible?: NoEligiblePortfolioDetail;
  marginals?: MarginalsResponse;
  key: string;
}

export function decisionKey(selected: string[], budget: number | null) {
  return JSON.stringify([[...selected].sort(), budget]);
}

export function useDecisionData(selected: string[], budget: number | null) {
  const [state, setState] = useState<{ data?: DecisionData; error?: ApiError; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  const key = decisionKey(selected, budget);

  useEffect(() => {
    if (budget === null) return;
    const id = ++seq.current;
    const [ids] = JSON.parse(key) as [string[], number];
    const t = setTimeout(async () => {
      if (id !== seq.current) return;
      setState((s) => ({ ...s, loading: true, error: undefined }));
      try {
        const body = { investment_ids: ids, budget_usd: budget };
        const optimizeP = apiGet<OptimizeResponse>(`/api/portfolio/optimize?budget_usd=${budget}`, { force: true }).then(
          (optimum) => ({ optimum, noEligible: undefined as NoEligiblePortfolioDetail | undefined }),
          (err: unknown) => {
            const e = toApiError(err);
            if (e.status === 409 && e.detail && typeof e.detail === "object") {
              return { optimum: undefined, noEligible: e.detail as NoEligiblePortfolioDetail };
            }
            throw e;
          },
        );
        // An invalid saved plan (dependency rule broken) must not hide the baseline and the recommendation.
        let cisoInvalid: string | undefined;
        const tolerateInvalid = (err: unknown) => {
          const e = toApiError(err);
          const d = e.detail as { error?: string; message?: string } | undefined;
          if (e.status === 400 && d?.error === "invalid_portfolio") {
            cisoInvalid = d.message ?? "Invalid plan";
            return undefined;
          }
          throw e;
        };
        const [baseline, ciso, marginals, opt] = await Promise.all([
          apiPost<EvaluateResponse>("/api/portfolio/evaluate", { investment_ids: [], budget_usd: budget }),
          apiPost<EvaluateResponse>("/api/portfolio/evaluate", body).catch(tolerateInvalid),
          apiPost<MarginalsResponse>("/api/portfolio/marginals", body).catch(tolerateInvalid),
          optimizeP,
        ]);
        const optimizedEval = opt.optimum
          ? await apiPost<EvaluateResponse>("/api/portfolio/evaluate", { investment_ids: opt.optimum.selected_investments, budget_usd: budget })
          : undefined;
        if (id === seq.current) {
          setState({ data: { baseline, ciso, cisoInvalid, marginals, optimizedEval, ...opt, key }, loading: false });
        }
      } catch (err) {
        if (id === seq.current) setState((s) => ({ ...s, error: toApiError(err), loading: false }));
      }
    }, 150);
    return () => clearTimeout(t);
  }, [key, budget, attempt]);

  return { ...state, stale: state.data !== undefined && state.data.key !== key, retry: () => setAttempt((n) => n + 1) };
}

/** Membership comparison of two ID lists (not a risk calculation). */
export function portfolioDiff(ciso: string[], optimized: string[]) {
  const a = new Set(ciso);
  const b = new Set(optimized);
  return {
    shared: ciso.filter((id) => b.has(id)),
    onlyCiso: ciso.filter((id) => !b.has(id)),
    onlyOptimized: optimized.filter((id) => !a.has(id)),
    identical: a.size === b.size && ciso.every((id) => b.has(id)),
  };
}
