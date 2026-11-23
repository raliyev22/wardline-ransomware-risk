import type { Metadata } from "next";
import { ThreatExplorer } from "@/components/threats/threat-explorer";

export const metadata: Metadata = { title: "Ransomware Threats" };

export default function ThreatsPage() {
  return <ThreatExplorer />;
}
