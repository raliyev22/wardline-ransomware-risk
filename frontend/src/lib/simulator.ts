import type { SeverityKey } from "./types";

/** Severity labels and their engine branch definitions (engine/monte_carlo.py, comparison.py). */
export const SEVERITIES: { key: SeverityKey; label: string; branch: string }[] = [
  { key: "contained", label: "Contained", branch: "Ransomware deployed, but no major spread across the network." },
  { key: "major", label: "Major", branch: "Major spread across the network without severe ecosystem-wide escalation." },
  { key: "severe", label: "Severe", branch: "Major spread followed by severe, ecosystem-wide disruption." },
];

/** Engine loss components in display order, with one-line definitions from the engine's loss model. */
export const LOSS_COMPONENTS: { key: string; label: string; definition: string }[] = [
  { key: "restoration", label: "Restoration", definition: "System rebuild, external recovery days and server replacement" },
  { key: "response", label: "Incident response", definition: "Response specialists and forensic retainer" },
  { key: "interruption", label: "Service interruption", definition: "Contribution margin from cancelled care that is not recovered later" },
  { key: "continuity", label: "Continuity of care", definition: "Temporary clinical capacity and diversion workarounds" },
  { key: "notification", label: "Breach notification", definition: "Patient notification, applied only if data is exposed" },
  { key: "legal", label: "Legal counsel", definition: "Incident-specific counsel hours; no automatic regulatory fine" },
  { key: "reputation", label: "Reputation", definition: "Future patient volume lost after services are restored" },
  { key: "extra_staff", label: "Extra staffing", definition: "Incremental overtime during the disruption" },
];

export const STAGE_LABELS: Record<string, { label: string; event: string }> = {
  initial_access: { label: "Initial access", event: "initial access" },
  deployment: { label: "Ransomware deployment", event: "ransomware deployment" },
  major_spread: { label: "Major spread", event: "major spread" },
  severe_given_major_spread: { label: "Severe escalation", event: "severe escalation" },
};
