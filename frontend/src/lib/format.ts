/** Formatting helpers. All return an em dash for missing or non-numeric values. */

export const MISSING = "—";

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function formatCurrency(value: unknown, { compact = false }: { compact?: boolean } = {}): string {
  const n = asNumber(value);
  if (n === null) return MISSING;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? (Math.abs(n) >= 1e6 ? 2 : 1) : 0,
  }).format(n);
}

export function formatNumber(value: unknown, maximumFractionDigits = 0): string {
  const n = asNumber(value);
  if (n === null) return MISSING;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(n);
}

/** 0.75 -> "75%" */
export function formatFraction(value: unknown, maximumFractionDigits = 0): string {
  const n = asNumber(value);
  if (n === null) return MISSING;
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits }).format(n);
}

/** 65 (already a percentage) -> "65%" */
export function formatPercentValue(value: unknown, maximumFractionDigits = 0): string {
  const n = asNumber(value);
  if (n === null) return MISSING;
  return `${formatNumber(n, maximumFractionDigits)}%`;
}

const ACRONYMS: Record<string, string> = {
  usd: "USD", rto: "RTO", iomt: "IoMT", ehr: "EHR", it: "IT", mfa: "MFA", edr: "EDR", vpn: "VPN", id: "ID", ids: "IDs", us: "US",
};

/** "annual_patient_encounters" -> "Annual patient encounters" */
export function humanize(key: string): string {
  const words = key.split(/[_\s]+/).filter(Boolean).map((w) => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase());
  if (words.length === 0) return key;
  const first = words[0];
  words[0] = first === first.toLowerCase() ? first.charAt(0).toUpperCase() + first.slice(1) : first;
  return words.join(" ");
}

/** "A01;A02" -> ["A01", "A02"] (source CSVs store ID lists as semicolon-separated text). */
export function splitIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  return value.split(";").map((s) => s.trim()).filter(Boolean);
}

/** Entries of an object whose values are numbers, in source order. */
export function numericEntries(obj: unknown): [string, number][] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const n = asNumber(v);
    return n === null ? [] : [[k, n] as [string, number]];
  });
}
