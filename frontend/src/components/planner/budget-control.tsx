"use client";

import { TriangleAlert } from "lucide-react";
import type { InvestmentsResponse } from "@/lib/types";
import { asNumber, formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardBody, cn } from "@/components/ui/card";
import { InlineDisclosure } from "@/components/ui/disclosure";

const STEP = 5_000;

/** Selected first-year budget (≤ engine budget), what the plan costs, and what is left. */
export function BudgetControl({
  budget,
  engineBudget,
  onBudget,
  used,
  remaining,
  withinBudget,
  annualized,
  itBudget,
  costConvention,
}: {
  budget: number;
  engineBudget: number;
  onBudget: (v: number) => void;
  used?: number;
  remaining?: number;
  withinBudget?: boolean;
  annualized?: number;
  itBudget?: number | null;
  costConvention?: InvestmentsResponse["budget"]["cost_convention"];
}) {
  const presets = [0.25, 0.5, 0.75, 1].map((f) => Math.round((engineBudget * f) / STEP) * STEP);
  const usedPct = used !== undefined && budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
  const over = withinBudget === false;
  const life = asNumber(costConvention?.assumed_useful_life_years);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label htmlFor="budget-range" className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Your available budget
            </label>
            <p className="tabular mt-1 text-3xl font-semibold text-navy-900">{formatCurrency(budget)}</p>
            <input
              id="budget-range"
              type="range"
              min={STEP}
              max={engineBudget}
              step={STEP}
              value={budget}
              onChange={(e) => onBudget(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--color-navy-700)]"
              aria-valuetext={formatCurrency(budget)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onBudget(p)}
                  aria-pressed={p === budget}
                  className={cn(
                    "tabular rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                    p === budget ? "border-navy-700 bg-navy-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {formatCurrency(p, { compact: true })}
                </button>
              ))}
              <span className="text-xs text-slate-500">up to {formatCurrency(engineBudget, { compact: true })}</span>
            </div>
          </div>

          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col justify-between">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cost of your selected investments</dt>
                <dd className={cn("tabular mt-1 text-2xl font-semibold", over ? "text-rose-700" : "text-navy-900")}>
                  {used !== undefined ? formatCurrency(used) : "—"}
                </dd>
              </div>
              <div className="flex flex-col justify-between">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{over ? "Over budget by" : "Budget remaining"}</dt>
                <dd className={cn("tabular mt-1 text-2xl font-semibold", over ? "text-rose-700" : "text-accent-700")}>
                  {remaining !== undefined ? formatCurrency(Math.abs(remaining)) : "—"}
                </dd>
              </div>
            </dl>
            <div
              className="h-3 overflow-hidden rounded-full bg-slate-100"
              role="meter"
              aria-label="Share of budget used"
              aria-valuemin={0}
              aria-valuemax={budget}
              aria-valuenow={Math.min(used ?? 0, budget)}
              aria-valuetext={used !== undefined ? `${formatCurrency(used)} of ${formatCurrency(budget)}` : "Calculating"}
            >
              <div className={cn("h-full rounded-full transition-[width] duration-300", over ? "bg-rose-500" : "bg-accent-500")} style={{ width: `${usedPct}%` }} />
            </div>
            {over ? (
              <p role="alert" className="flex gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Your plan costs more than this budget. Raise the budget or remove an investment.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {used !== undefined ? `${formatNumber(usedPct)}% of the budget used in year one.` : "Calculating…"}
              </p>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-600">
          This is <strong className="font-semibold text-slate-800">new money for ransomware defenses</strong>
          {typeof itBudget === "number" ? <>, separate from the hospital&apos;s existing {formatCurrency(itBudget, { compact: true })} annual IT budget.</> : "."}
        </p>

        <InlineDisclosure label="How costs are counted">
          <dl className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div>
              <dt className="font-medium text-slate-800">First-year cost</dt>
              <dd className="text-slate-600">
                One-time purchase and setup (capex) plus the first year of running costs (opex). This is what must fit within the budget.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-800">Annualized cost</dt>
              <dd className="text-slate-600">
                Capex spread over {life !== null ? `${formatNumber(life)} years` : "the assumed useful life"} plus yearly opex. Used to calculate net benefit
                {annualized !== undefined && <> (your plan: {formatCurrency(annualized)} per year)</>}.
              </dd>
            </div>
            {costConvention?.budget_constraint && (
              <p className="pt-1 font-mono text-[11px] text-slate-500">Engine rule: {costConvention.budget_constraint}</p>
            )}
            {costConvention?.annualized_cost && <p className="font-mono text-[11px] text-slate-500">Annualized: {costConvention.annualized_cost}</p>}
          </dl>
        </InlineDisclosure>
      </CardBody>
    </Card>
  );
}
