import { MISSING } from "@/lib/format";

/** Compact list of source IDs (A01, C03, I04…); hover shows the record name when known. */
export function IdChips({ ids, names }: { ids: string[]; names?: Map<string, string> }) {
  if (ids.length === 0) return <span className="text-slate-400">{MISSING}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} title={names?.get(id) || undefined} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
          {id}
        </span>
      ))}
    </span>
  );
}
