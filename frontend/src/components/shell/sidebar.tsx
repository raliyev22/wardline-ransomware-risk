"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/components/ui/card";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-[#fbfcfa] px-[15px] py-[22px]">
      <div className="flex items-center gap-2.5 px-2.5 pb-9 pt-2">
        <Image src="/wardline/mark.svg" width={38} height={38} alt="" className="shrink-0" />
        <span className="sr-only">
          RD
        </span>
        <div className="leading-tight">
          <p className="mb-1.5 text-[1.66rem] leading-none font-[730] tracking-[-0.06em] text-[#173e39]">Wardline</p>
          <p className="text-[11px] font-medium text-slate-600">Ransomware Resilience</p>
          <p className="text-[11px] text-slate-600">Decision Support</p>
        </div>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-1 py-1 -mx-1">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.145em] text-slate-500">Workspace</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[7px] px-2.5 py-[11px] text-sm tracking-[-0.012em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500",
                    active ? "bg-navy-100 font-[680] text-navy-800" : "font-[520] text-slate-600 hover:bg-navy-50 hover:text-navy-800",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.status === "planned" && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-700 ring-1 ring-inset ring-navy-200">
                      Soon
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </div>
  );
}
