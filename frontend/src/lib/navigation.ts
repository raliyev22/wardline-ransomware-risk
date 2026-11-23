import { BookOpen, Building2, ChartColumn, LayoutDashboard, Scale, ShieldAlert, Siren, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "live" | "planned";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hospital Overview", description: "Profile, assets, controls and baseline risk", icon: Building2, status: "live" },
  { href: "/threats", label: "Ransomware Threats", description: "Attack scenarios and kill chains", icon: ShieldAlert, status: "live" },
  { href: "/simulator", label: "Crisis Simulator", description: "Monte Carlo incident simulation", icon: Siren, status: "live" },
  { href: "/investments", label: "Investment Planner", description: "Build and evaluate portfolios", icon: Wallet, status: "live" },
  { href: "/analytics", label: "Risk Analytics", description: "Loss distributions and tail risk", icon: ChartColumn, status: "live" },
  { href: "/comparison", label: "Executive Comparison", description: "Baseline vs CISO vs optimized", icon: Scale, status: "live" },
  { href: "/dashboard", label: "Dashboard", description: "Explore completed simulations and loss distributions", icon: LayoutDashboard, status: "live" },
  { href: "/sources", label: "Sources & Assumptions", description: "Trace the hospital figures, risk estimates and project budgets", icon: BookOpen, status: "live" },
];
