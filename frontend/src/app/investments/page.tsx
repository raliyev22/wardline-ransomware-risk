import type { Metadata } from "next";
import { InvestmentPlanner } from "@/components/planner/investment-planner";

export const metadata: Metadata = { title: "Investment Planner" };

export default function InvestmentsPage() {
  return <InvestmentPlanner />;
}
