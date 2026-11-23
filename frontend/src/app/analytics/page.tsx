import type { Metadata } from "next";
import { RiskAnalytics } from "@/components/analytics/risk-analytics";

export const metadata: Metadata = { title: "Risk Analytics" };

export default function AnalyticsPage() {
  return <RiskAnalytics />;
}
