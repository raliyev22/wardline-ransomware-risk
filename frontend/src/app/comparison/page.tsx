import type { Metadata } from "next";
import { ExecutiveComparison } from "@/components/executive/executive-comparison";

export const metadata: Metadata = { title: "Executive Comparison" };

export default function ComparisonPage() {
  return <ExecutiveComparison />;
}
