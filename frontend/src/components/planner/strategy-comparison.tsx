"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import type { EvaluateResponse, NoEligiblePortfolioDetail, OptimizeResponse } from "@/lib/types";
import { MISSING, formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardBody, cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";
import { LoadingState } from "@/components/ui/states";
import { type Names, invName, withNames } from "./planner-copy";

const money = (v: number | undefined) => (v === undefined ? MISSING : `${v < 0 ? "−" : ""}${formatCurrency(Math.abs(v))}`);

/** "What would the model recommend?" — reveals the backend optimizer's result for the selected budget. */
export function Recommendation({
  evaluation,
  optimum,
  noEligible,
  budget,
  loading,
  revealed,
  onReveal,
  onLoadOptimized,
  onSetBudget,
  names,
  objective,
}: {
  evaluation?: EvaluateResponse;
  optimum?: OptimizeResponse;
  noEligible?: NoEligiblePortfolioDetail;
  budget: number;
  loading: boolean;
  revealed: boolean;
  onReveal: () => void;
  onLoadOptimized: (ids: string[]) => void;
  onSetBudget: (v: number) => void;
  names: Names;
  objective?: string;
}) {
  if (!revealed) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-slate-600">
            See which combination of investments the model recommends for your {formatCurrency(budget, { compact: true })} budget and the hospital&apos;s
            patient-safety requirements.
          </p>
          <button
            type="button"
            onClick={onReveal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <Sparkles className="size-4" aria-hidden /> Find the model&apos;s recommended plan
          </button>
        </CardBody>
      </Card>
    );
  }

  if (!evaluation || (!optimum && !noEligible)) {
    return (
      <Card>
        <CardBody>
          <LoadingState label="Finding the recommended plan" rows={4} />
        </CardBody>
      </Card>
    );
  }

  if (noEligible) {
    const min = noEligible.min_first_year_cash_for_eligible_portfolio_usd;
    return (
      <Card>
        <CardBody>
          <div role="alert" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="font-semibold">No investment combination meets the hospital&apos;s required safeguards within this budget.</p>
              <p className="mt-1 leading-relaxed">{withNames(noEligible.message, names)}</p>
              {typeof min === "number" && (
                <button
                  type="button"
                  onClick={() => onSetBudget(min)}
                  className="mt-3 inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-accent-500"
                >
                  Raise budget to {formatCurrency(min)}
                </button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const opt = optimum!;
  const same = [...opt.selected_investments].sort().join() === [...evaluation.investment_ids].sort().join();
  const remaining = budget - opt.spending.first_year_cash_usd;

  const rows: { label: string; mine: string; rec: string }[] = [
    {
      label: "Investments",
      mine: evaluation.investment_ids.length ? evaluation.investment_ids.map((id) => invName(names, id)).join(", ") : "None",
      rec: opt.selected_investments.map((id) => invName(names, id)).join(", "),
    },
    { label: "First-year cost", mine: formatCurrency(evaluation.spending.first_year_cash_usd), rec: formatCurrency(opt.spending.first_year_cash_usd) },
    { label: "Expected annual loss", mine: formatCurrency(evaluation.metrics.expected_annual_loss_usd), rec: formatCurrency(opt.metrics.expected_annual_loss_usd) },
    {
      label: "Annual loss reduction",
      mine: formatCurrency(evaluation.expected_annual_avoided_loss_usd),
      rec: formatCurrency(opt.optimization.expected_annual_avoided_loss_usd),
    },
    { label: "Net benefit / yr", mine: money(evaluation.expected_annual_net_benefit_usd), rec: money(opt.optimization.expected_annual_net_benefit_usd) },
    { label: "Patient-safety requirements", mine: evaluation.clinical_guardrails.satisfied ? "Met" : "Not met", rec: "Met" },
  ];

  return (
    <Card className={cn(loading && "opacity-70 transition-opacity")}>
      <CardBody className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Model-recommended plan for {formatCurrency(budget)}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {opt.selected_investments.map((id) => (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-2.5 py-1 text-sm font-medium text-white">
                <CircleCheck className="size-3.5 text-wardline-lime" aria-hidden /> {invName(names, id)}
              </li>
            ))}
          </ul>
        </div>

        <dl className="tabular grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Mini label="First-year cost" value={formatCurrency(opt.spending.first_year_cash_usd)} />
          <Mini label="Budget remaining" value={formatCurrency(remaining)} />
          <Mini label="Expected annual loss" value={formatCurrency(opt.metrics.expected_annual_loss_usd)} />
          <Mini label="Annual loss reduction" value={formatCurrency(opt.optimization.expected_annual_avoided_loss_usd)} good />
          <Mini label="Net benefit / yr" value={money(opt.optimization.expected_annual_net_benefit_usd)} good />
        </dl>

        <p className="text-sm text-slate-600">
          &ldquo;Recommended&rdquo; means the combination with the highest modeled net benefit per year that fits the budget, respects investment
          prerequisites and meets the patient-safety requirements. It is not necessarily the lowest-risk or cheapest plan.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-slate-800">Your plan vs. the recommendation</h3>
          <div className="-mx-5 mt-2 overflow-x-auto sm:-mx-6">
            <table className="tabular min-w-full text-sm">
              <caption className="sr-only">Your investment plan compared with the model-recommended plan</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5 pl-5 text-left font-semibold sm:pl-6">
                    <span className="sr-only">Measure</span>
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold text-navy-800">Your investment plan</th>
                  <th scope="col" className="px-4 py-2.5 pr-5 text-right font-semibold sm:pr-6">Model-recommended plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.label} className={r.mine !== r.rec ? undefined : "text-slate-500"}>
                    <th scope="row" className="whitespace-nowrap px-4 py-2.5 pl-5 text-left font-normal text-slate-600 sm:pl-6">
                      {r.label}
                    </th>
                    <td className="max-w-[16rem] px-4 py-2.5 text-right font-medium text-navy-900">{r.mine}</td>
                    <td className="max-w-[16rem] px-4 py-2.5 pr-5 text-right text-slate-800 sm:pr-6">{r.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            {same
              ? "Your plan matches the model's recommendation for this budget."
              : "The recommendation is one input to the decision; leadership may weigh factors the model does not capture."}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!same && (
              <button
                type="button"
                onClick={() => onLoadOptimized(opt.selected_investments)}
                className="inline-flex items-center justify-center rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                Use the recommended plan
              </button>
            )}
            <Link
              href="/comparison"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Full comparison <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <InlineDisclosure label="How the model picks its recommendation">
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
            <p>
              The model tries every affordable combination of investments ({formatNumber(opt.optimization.evaluated_feasible_portfolios)} fit this budget;{" "}
              {formatNumber(opt.optimization.clinical_eligible_portfolios)} also meet the patient-safety requirements) and picks the one with the highest
              expected annual net benefit: savings minus annualized cost.
            </p>
            <p>
              It does not search for the lowest-risk plan, the cheapest plan, or the plan with the smallest bad-year (P95) loss, and it cannot guarantee the
              best real-world outcome. Bad-year losses can be checked with the simulation below.
            </p>
            {objective && <p className="text-xs text-slate-500">Engine objective: {objective}.</p>}
            <p className="text-xs text-slate-500">Method: {opt.optimization.method}.</p>
          </div>
        </InlineDisclosure>
      </CardBody>
    </Card>
  );
}

function Mini({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 font-semibold", good ? "text-emerald-700" : "text-slate-900")}>{value}</dd>
    </div>
  );
}
