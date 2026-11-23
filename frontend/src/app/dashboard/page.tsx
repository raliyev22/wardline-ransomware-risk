import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import "./dashboard.css";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <Dashboard />;
}
