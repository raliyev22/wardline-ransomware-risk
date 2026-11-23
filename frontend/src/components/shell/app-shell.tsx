"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] shadow-xl">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="size-5" aria-hidden />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-width)]">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1610px] flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-[clamp(24px,3vw,52px)]">{children}</main>
      </div>
    </div>
  );
}
