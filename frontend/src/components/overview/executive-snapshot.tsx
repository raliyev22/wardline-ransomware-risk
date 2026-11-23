"use client";

import { Hospital, Stethoscope, Wallet } from "lucide-react";
import type { useApi } from "@/lib/use-api";
import type { BaselineResponse, HospitalResponse, InvestmentsResponse } from "@/lib/types";
import { MISSING, asNumber, formatCurrency, formatNumber } from "@/lib/format";
import { Stat } from "@/components/ui/stat";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { InlineDisclosure } from "@/components/ui/disclosure";

type State<T> = ReturnType<typeof useApi<T>>;

const INDICATORS: { key: keyof BaselineResponse["metrics"]; label: string; format: (v: unknown) => string; hint: string }[] = [
  { key: "expected_events_per_year", label: "Disruptive events / year", format: (v) => formatNumber(v, 2), hint: "Expected ransomware deployments" },
  { key: "expected_annual_recovery_days", label: "Recovery days / year", format: (v) => formatNumber(v, 1), hint: "Expected service-recovery days" },
  { key: "expected_annual_diverted_patients", label: "Diverted patients / year", format: (v) => formatNumber(v), hint: "Clinical exposure indicator, not monetized" },
  { key: "expected_annual_reputation_loss_usd", label: "Reputation loss / year", format: (v) => formatCurrency(v, { compact: true }), hint: "Already included in expected annual loss" },
];

/** Always-visible headline: facilities, baseline loss and budget, each straight from the API. */
export function ExecutiveSnapshot({
  hospital,
  baseline,
  invest,
}: {
  hospital: State<HospitalResponse>;
  baseline: State<BaselineResponse>;
  invest: State<InvestmentsResponse>;
}) {
  const facilities = hospital.data?.hospital_profile?.facilities;
  const m = baseline.data?.metrics;
  const budget = invest.data?.budget;
  const horizon = asNumber(budget?.budget_horizon_months);

  const value = (loading: boolean, v: string) => (loading ? <Skeleton className="mt-1 h-7 w-28" /> : v);

  return (
    <section aria-labelledby="snapshot-heading" className="space-y-4">
      <h2 id="snapshot-heading" className="sr-only">
        Executive snapshot
      </h2>
      <div className="risk-banner risk-headline">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-navy-100 uppercase">
          <span className="size-[7px] shrink-0 rounded-full bg-wardline-lime" aria-hidden />
          Baseline expected annual loss
        </p>
        <div className="tabular risk-value">{value(baseline.loading, m ? formatCurrency(m.expected_annual_loss_usd) : MISSING)}</div>
        <p className="risk-caption">The model&apos;s expected yearly financial loss from ransomware under current controls, with no new investment.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_2fr]">
        <Stat
          label="Hospitals"
          icon={<Hospital className="size-3.5" aria-hidden />}
          value={value(hospital.loading, formatNumber(facilities?.hospitals))}
        />
        <Stat
          label="Specialty clinics"
          icon={<Stethoscope className="size-3.5" aria-hidden />}
          value={value(hospital.loading, formatNumber(facilities?.specialty_clinics))}
        />
        <div className="col-span-2 md:col-span-1 [&>div]:h-full">
          <Stat
            emphasis
            label="New cybersecurity budget"
            icon={<Wallet className="size-3.5" aria-hidden />}
            value={value(invest.loading, budget ? formatCurrency(budget.budget_first_year_cash_usd) : MISSING)}
            hint={`First-year cash (capex + first-year opex)${horizon !== null ? ` over ${formatNumber(horizon)} months` : ""} available for new resilience investments.`}
          />
        </div>
      </div>

      {baseline.error && <ErrorState error={baseline.error} onRetry={baseline.reload} title="Baseline risk unavailable" compact />}
      {invest.error && <ErrorState error={invest.error} onRetry={invest.reload} title="Investment budget unavailable" compact />}

      {m && (
        <InlineDisclosure label="Additional risk indicators">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INDICATORS.map((item) => (
              <Stat key={item.key} label={item.label} value={item.format(m[item.key])} hint={item.hint} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Analytic expected values under current controls, from the backend risk engine.</p>
        </InlineDisclosure>
      )}
    </section>
  );
}
