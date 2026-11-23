import { formatCurrency, formatFraction } from "@/lib/format";
import type { StressCase, StressTestResponse } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

const CASE_LABELS: Record<string, (multipliers: StressCase["multipliers"]) => string> = {
  central: () => "Baseline assumptions",
  higher_attack_pressure: (m) => `${formatFraction(m.attack_attempt_frequency - 1)} more attack attempts`,
  higher_incident_costs: (m) => `${formatFraction(m.incident_financial_losses - 1)} higher incident costs`,
  weaker_control_effects: (m) => `${formatFraction(1 - m.control_effectiveness)} weaker control effects`,
};

export function StressResults({ report }: { report: StressTestResponse }) {
  const hasPlan = report.investment_ids.length > 0;
  const rows = report.cases
    .filter((test) => Object.hasOwn(CASE_LABELS, test.key))
    .map((test) => ({ ...test, label: CASE_LABELS[test.key](test.multipliers) }));

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm text-slate-600">
          {hasPlan
            ? "The same investment plan under different assumptions. Net benefit is avoided loss minus annualized investment cost."
            : "Losses under today’s protections. Select investments in the Planner to see their net benefit under stress."}
        </p>
        <DataTable
          caption="Annual loss and net benefit by stress scenario"
          rows={rows}
          rowKey={(row) => row.key}
          columns={[
            { key: "scenario", header: "Scenario", render: (row) => row.label },
            { key: "loss", header: "Expected annual loss", align: "right", render: (row) => formatCurrency(row.portfolio_metrics.expected_annual_loss_usd, { compact: true }) },
            { key: "benefit", header: "Annual net benefit", align: "right", render: (row) => hasPlan ? formatCurrency(row.portfolio_net_benefit_usd, { compact: true }) : "—" },
          ]}
        />
      </CardBody>
    </Card>
  );
}
