"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { useApi } from "@/lib/use-api";
import type { HospitalResponse } from "@/lib/types";

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { data, loading, error, reload } = useApi<HospitalResponse>("/api/hospital");
  const profile = data?.hospital_profile;
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(reload, 5_000);
    return () => clearTimeout(timer);
  }, [error, reload]);

  return (
    <header className="sticky top-0 z-30 flex h-[63px] items-center gap-2 border-b border-slate-200 bg-white px-4 sm:gap-3 sm:px-6 lg:px-[clamp(24px,3vw,52px)]">
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-accent-500 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy-50">
          <Image src="/wardline/mark.svg" width={24} height={24} alt="" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-navy-900">
            {profile?.name ?? (loading ? "Loading hospital network…" : "Hospital network unavailable")}
          </p>
          <p className="truncate text-xs text-slate-500">
            Fictional organization{profile?.organization_id ? ` · ${profile.organization_id}` : ""}
          </p>
        </div>
      </div>

    </header>
  );
}
