import type { Metadata } from "next";
import { HospitalOverview } from "@/components/overview/hospital-overview";

export const metadata: Metadata = { title: "Hospital Overview" };

export default function HospitalOverviewPage() {
  return <HospitalOverview />;
}
