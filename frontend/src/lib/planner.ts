"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPost, toApiError } from "./api";
import type {
  EvaluateResponse,
  InvestmentItem,
  InvestmentsResponse,
  JsonRecord,
  MarginalsResponse,
  NoEligiblePortfolioDetail,
  OptimizeResponse,
} from "./types";

/* ---------- display grouping (by the stage each investment acts on, from engine inputs) ---------- */

export const STAGE_GROUPS = [
  { key: "entry", label: "Stop attackers getting in", metrics: ["initial_access"], blurb: "Reduce the chance an attempt gains a foothold." },
  { key: "deployment", label: "Stop ransomware from running", metrics: ["deployment"], blurb: "Detect and interrupt attackers before encryption." },
  { key: "spread", label: "Contain the spread", metrics: ["major_spread", "iomt_disruption"], blurb: "Limit how far an incident moves through clinical networks." },
  { key: "recovery", label: "Recover clinical services faster", metrics: ["recovery_days"], blurb: "Shorten downtime once an incident happens." },
] as const;

export const METRIC_LABEL: Record<string, string> = {
  initial_access: "initial access",
  deployment: "deployment",
  major_spread: "major spread",
  recovery_days: "recovery days",
  iomt_disruption: "IoMT disruption",
};

export interface InvestmentGroup {
  key: string;
  label: string;
  blurb: string;
  items: InvestmentItem[];
}

export function groupInvestments(data: InvestmentsResponse): InvestmentGroup[] {
  const metricsById = new Map<string, string[]>();
  for (const row of data.control_effectiveness ?? []) {
    const id = String(row.investment_id ?? "");
    metricsById.set(id, [...(metricsById.get(id) ?? []), String(row.affected_metric ?? "")]);
  }
  const used = new Set<string>();
  const groups: InvestmentGroup[] = STAGE_GROUPS.map((g) => {
    const metrics: readonly string[] = g.metrics;
    const items = data.investments.filter((inv) => {
      if (used.has(inv.id)) return false;
      const hit = (metricsById.get(inv.id) ?? []).some((m) => metrics.includes(m));
      if (hit) used.add(inv.id);
      return hit;
    });
    return { key: g.key, label: g.label, blurb: g.blurb, items };
  });
  const other = data.investments.filter((i) => !used.has(i.id));
  if (other.length) groups.push({ key: "other", label: "Other investments", blurb: "", items: other });
  return groups.filter((g) => g.items.length > 0);
}

export function effectRowsFor(data: InvestmentsResponse, id: string): JsonRecord[] {
  return (data.control_effectiveness ?? []).filter((r) => r.investment_id === id);
}

/* ---------- debounced backend evaluation of the current plan ---------- */

export interface PlannerState {
  evaluation?: EvaluateResponse;
  marginals?: MarginalsResponse;
  optimum?: OptimizeResponse;
  noEligible?: NoEligiblePortfolioDetail;
  error?: ApiError;
  loading: boolean;
}

const DEBOUNCE_MS = 250;

/** Re-evaluates selection + budget on the backend; ignores responses from superseded requests. */
export function usePlannerEvaluation(selected: string[], budget: number | null) {
  const [state, setState] = useState<PlannerState>({ loading: true });
  const seq = useRef(0);
  const key = `${[...selected].sort().join(",")}|${budget ?? ""}`;

  useEffect(() => {
    if (budget === null) return;
    const id = ++seq.current;
    const ids = key.split("|")[0].split(",").filter(Boolean);
    const timer = setTimeout(() => {
      if (id !== seq.current) return;
      setState((s) => ({ ...s, loading: true }));
      const body = { investment_ids: ids, budget_usd: budget };
      const optimize = apiGet<OptimizeResponse>(`/api/portfolio/optimize?budget_usd=${budget}`, { force: true }).then(
        (optimum) => ({ optimum, noEligible: undefined }),
        (err: unknown) => {
          const e = toApiError(err);
          if (e.status === 409 && e.detail && typeof e.detail === "object") {
            return { optimum: undefined, noEligible: e.detail as NoEligiblePortfolioDetail };
          }
          throw e;
        },
      );
      Promise.all([
        apiPost<EvaluateResponse>("/api/portfolio/evaluate", body),
        apiPost<MarginalsResponse>("/api/portfolio/marginals", body),
        optimize,
      ]).then(
        ([evaluation, marginals, opt]) => {
          if (id === seq.current) setState({ evaluation, marginals, ...opt, loading: false });
        },
        (err: unknown) => {
          if (id === seq.current) setState((s) => ({ ...s, error: toApiError(err), loading: false }));
        },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, budget]);

  return state;
}
