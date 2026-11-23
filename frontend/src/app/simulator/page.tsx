import type { Metadata } from "next";
import { CrisisSimulator } from "@/components/simulator/crisis-simulator";

export const metadata: Metadata = { title: "Crisis Simulator" };

export default function SimulatorPage() {
  return <CrisisSimulator />;
}
