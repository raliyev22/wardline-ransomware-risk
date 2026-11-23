import type { SeverityKey } from "@/lib/types";

/** Plain-language severity descriptions (engine definitions stay in lib/simulator SEVERITIES). */
export const SEVERITY_PLAIN: Record<SeverityKey, { title: string; summary: string }> = {
  contained: { title: "Contained", summary: "The ransomware incident is stopped before widespread infection." },
  major: { title: "Major", summary: "Ransomware spreads and disrupts important hospital operations." },
  severe: { title: "Severe", summary: "A widespread incident causes especially serious disruption and recovery costs." },
};

/** Plain labels for the engine's conditional stage parameters (keys from attack_stage_model.stages[].stage). */
export const STAGE_PLAIN: Record<string, { label: string; question: string }> = {
  initial_access: { label: "Chance of gaining access", question: "Does the attacker get in?" },
  deployment: { label: "Chance of deploying ransomware after access", question: "Is ransomware launched?" },
  major_spread: { label: "Chance of spreading after deployment", question: "Does it spread widely?" },
  severe_given_major_spread: { label: "Chance of becoming severe after major spread", question: "Does it escalate?" },
};

/** Short, plain labels for the engine's eight loss components (definitions in lib/simulator LOSS_COMPONENTS). */
export const COST_PLAIN: Record<string, { label: string; plain: string }> = {
  restoration: { label: "System restoration", plain: "Rebuilding and restoring systems and servers" },
  response: { label: "Emergency response", plain: "Incident-response specialists and forensics" },
  interruption: { label: "Lost revenue", plain: "Margin from cancelled care that never comes back" },
  continuity: { label: "Keeping care running", plain: "Temporary capacity and diversion workarounds" },
  notification: { label: "Patient notification", plain: "Notifying patients, only if data is exposed" },
  legal: { label: "Legal counsel", plain: "Incident-specific legal advice (no automatic fines)" },
  reputation: { label: "Reputation", plain: "Patients who go elsewhere after services return" },
  extra_staff: { label: "Staff overtime", plain: "Extra staffing hours during the disruption" },
};
