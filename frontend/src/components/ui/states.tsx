import { CircleAlert, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "./card";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} aria-hidden />;
}

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  compact = false,
}: {
  error: ApiError | Error;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const isNetwork = "kind" in error && error.kind === "network";
  const Icon = isNetwork ? WifiOff : CircleAlert;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-900",
        compact ? "p-4" : "p-6",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
        <div>
          <p className="font-medium">{title ?? (isNetwork ? "Backend not reachable" : "Could not load data")}</p>
          <p className="mt-1 text-sm text-rose-800/90">{error.message}</p>
          {isNetwork && !compact && (
            <p className="mt-2 text-sm text-rose-800/90">
              Start the API from the project root with{" "}
              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">
                backend/.venv/bin/uvicorn backend.api.main:app --port 8000
              </code>
              , or set <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_API_BASE_URL</code>{" "}
              (currently <code className="font-mono text-xs">{API_BASE_URL}</code>).
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = "No data available from the backend." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
      <Inbox className="size-4" aria-hidden />
      {message}
    </div>
  );
}
