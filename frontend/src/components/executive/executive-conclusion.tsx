"use client";

import type { ReactNode } from "react";
import { MessageSquareQuote } from "lucide-react";
import type { DecisionData } from "@/lib/decision";
import { portfolioDiff } from "@/lib/decision";
import { formatCurrency } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import type { StrategyView } from "./strategy-columns";

const usd = (v: number) => formatCurrency(v);
const signedUsd = (v: number) => `${v < -0.5 ? "−" : ""}${formatCurrency(Math.abs(v))}`;
const list = (ids: string[], names: Map<string, string>) => {
  const l = ids.map((id) => names.get(id) ?? id);
  return l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
};

/**
 * "What does this comparison tell us?" — sentences built only from backend values.
 * The text compares values (higher/lower, met/not met); it never computes new figures or declares a universal winner.
 */
export function ExecutiveConclusion({
  data,
  strategies,
  budget,
  names,
  cisoInvalid,
}: {
  data: DecisionData;
  strategies: StrategyView[];
  budget: number;
  names: Map<string, string>;
  cisoInvalid?: string;
}) {
  const base = strategies.find((s) => s.key === "baseline")!;
  const mine = strategies.find((s) => s.key === "ciso")!;
  const rec = strategies.find((s) => s.key === "optimized")!;
  const empty = mine.available && mine.ids.length === 0;
  const over = mine.available && mine.withinBudget === false;
  const mineUsable = mine.available && !empty;
  const match = mineUsable && rec.available && portfolioDiff(mine.ids, rec.ids).identical;
  const points: ReactNode[] = [];

  // 1. Your plan vs. no new investment
  if (!mine.available) {
    points.push(<>Your plan can&apos;t be evaluated as selected{cisoInvalid ? `: ${cisoInvalid}` : ""}. Change your investments to compare it.</>);
  } else if (empty) {
    points.push(<>You haven&apos;t selected any investments yet, so your plan is the same as making no new investment.</>);
  } else {
    points.push(
      <>
        {over && (
          <>
            Your plan costs <strong>{usd(mine.cash)}</strong> in the first year, more than the <strong>{usd(budget)}</strong> budget, so it is not feasible as
            selected.{" "}
          </>
        )}
        Your selected investments reduce expected annual ransomware losses from <strong>{usd(base.loss)}</strong> to <strong>{usd(mine.loss)}</strong>
        {mine.net > 0.5 ? (
          <>
            , with a modeled annual net benefit of <strong>{usd(mine.net)}</strong>.
          </>
        ) : (
          <>
            , but the modeled savings do not cover their annualized cost (net benefit <strong>{signedUsd(mine.net)}</strong> per year).
          </>
        )}
      </>,
    );
  }

  // 2. Recommendation vs. your plan
  if (!rec.available) {
    const min = data.noEligible?.min_first_year_cash_for_eligible_portfolio_usd;
    points.push(
      <>
        The model has no recommendation at this budget: no combination of investments meets the clinical safety requirements within {usd(budget)}
        {typeof min === "number" && (
          <>
            {" "}
            (the lowest budget with an eligible plan is <strong>{usd(min)}</strong>)
          </>
        )}
        .
      </>,
    );
  } else if (match) {
    points.push(<>Your selected investments match the model&apos;s recommendation for this budget.</>);
  } else {
    points.push(
      <>
        The model-recommended plan ({list(rec.ids, names)}) requires <strong>{usd(rec.cash)}</strong> in first-year funding and reduces expected annual losses to{" "}
        <strong>{usd(rec.loss)}</strong>, with a modeled annual net benefit of <strong>{usd(rec.net)}</strong>.
      </>,
    );
  }

  // 3. Clinical safety
  if (mineUsable && rec.available && !match) {
    const a = mine.guardrails?.satisfied;
    const b = rec.guardrails?.satisfied;
    points.push(
      a && b
        ? "Both plans meet the modeled clinical safety requirements."
        : !a && b
          ? "Your plan does not meet the modeled clinical safety requirements; the recommended plan does."
          : a && !b
            ? "Your plan meets the modeled clinical safety requirements; the recommended plan does not."
            : "Neither plan meets the modeled clinical safety requirements.",
    );
  } else if (mineUsable) {
    points.push(mine.guardrails?.satisfied ? "Your plan meets the modeled clinical safety requirements." : "Your plan does not meet the modeled clinical safety requirements.");
  } else if (rec.available) {
    points.push(
      `The recommended plan ${rec.guardrails?.satisfied ? "meets" : "does not meet"} the modeled clinical safety requirements; making no new investment ${
        base.guardrails?.satisfied ? "does too" : "does not"
      }.`,
    );
  }

  // 4. The main trade-off (comparisons only)
  if (mineUsable && rec.available && !match) {
    const cmp = (a: number, b: number, lessWord: string, moreWord: string) => (a < b - 0.5 ? lessWord : a > b + 0.5 ? moreWord : "the same");
    points.push(
      <>
        The main trade-off: your plan costs {cmp(mine.cash, rec.cash, "less", "more")} in the first year ({usd(mine.cash)} vs {usd(rec.cash)}) and leaves{" "}
        {cmp(mine.loss, rec.loss, "lower", "higher")} expected annual losses ({usd(mine.loss)} vs {usd(rec.loss)}).{" "}
        {rec.net > mine.net + 0.5
          ? "Once annualized costs are counted, the recommendation has the higher modeled net benefit."
          : mine.net > rec.net + 0.5
            ? `Your plan has the higher modeled net benefit${
                over
                  ? ", but it does not fit the selected budget, which the recommendation must respect"
                  : mine.guardrails?.satisfied
                    ? ""
                    : ", but it does not meet the clinical safety requirements the recommendation must satisfy"
              }.`
            : "Their modeled net benefits are the same."}
      </>,
    );
    if (mine.diverted < rec.diverted || mine.recovery < rec.recovery) {
      points.push("Your plan is lower on at least one patient-care measure (diversions or recovery days), which is a real trade-off against expected value.");
    }
    const d = portfolioDiff(mine.ids, rec.ids);
    if (d.onlyCiso.length || d.onlyOptimized.length) {
      points.push(
        <>
          Where they differ: {d.onlyCiso.length ? <>only your plan includes {list(d.onlyCiso, names)}</> : "your plan has nothing the recommendation lacks"}
          {d.onlyOptimized.length ? <>; only the recommendation includes {list(d.onlyOptimized, names)}</> : ""}.
        </>,
      );
    }
  }

  return (
    <Card>
      <CardBody>
        <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
          <MessageSquareQuote className="size-4 text-navy-600" aria-hidden /> What does this comparison tell us?
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-navy-500" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Modeled averages on illustrative assumptions. The recommendation supports the decision; it does not replace leadership judgment.
        </p>
      </CardBody>
    </Card>
  );
}
