import { STAGES, type ScenarioView, type StageKey } from "@/lib/threats";
import { DisclosureSection } from "@/components/ui/disclosure";

const techniques = {
  T1566: "Phishing",
  T1078: "Valid Accounts",
  T1190: "Exploit Public-Facing Application",
  T1199: "Trusted Relationship",
  T1133: "External Remote Services",
  T1486: "Data Encrypted for Impact",
};
const tactics = {
  TA0001: "Initial Access", TA0008: "Lateral Movement", TA0040: "Impact",
};

interface Mapping {
  tactic?: keyof typeof tactics;
  techniques?: (keyof typeof techniques)[];
  note: string;
}

const entry: Record<string, { attempt: Mapping; initial_access: Mapping }> = {
  phishing_credentials: {
    attempt: { tactic: "TA0001", techniques: ["T1566"], note: "The workforce email scenario explicitly includes phishing. Its delivery method is unspecified." },
    initial_access: { tactic: "TA0001", techniques: ["T1078"], note: "The sign-in uses a stolen workforce identity. MFA coverage determines which accounts have an additional identity check." },
  },
  vpn_exploit: {
    attempt: { tactic: "TA0001", techniques: ["T1190"], note: "The scenario identifies an exposed gateway as the entry point. Timely patching reduces that exposure." },
    initial_access: { tactic: "TA0001", techniques: ["T1190"], note: "A compromised gateway is the successful outcome of the same entry technique. Patch records help defenders assess coverage." },
  },
  vendor_credentials: {
    attempt: { tactic: "TA0001", techniques: ["T1199"], note: "The scenario depends on the hospital’s trusted vendor connection. How the credential was obtained is unspecified." },
    initial_access: { tactic: "TA0001", techniques: ["T1078", "T1133"], note: "A vendor identity is used on a remote access service. Time limits, MFA and least privilege restrict this path." },
  },
};
const later: Record<Exclude<StageKey, "attempt" | "initial_access">, Mapping> = {
  deployment: { tactic: "TA0040", techniques: ["T1486"], note: "Encryption is a possible effect of the modeled deployment. Endpoint monitoring gives responders an opportunity to interrupt it. The execution mechanism is unspecified." },
  major_spread: { tactic: "TA0008", note: "The scenario describes movement between systems. The model leaves the specific movement technique open. Segmentation limits which systems can be reached." },
  recovery_severity: { note: "Recovery time and care disruption are hospital outcomes. Immutable backups and rehearsed restoration procedures address the consequences." },
};
const linkStyle = "font-medium text-accent-700 underline underline-offset-2";

export function AttackMapping({ view }: { view: ScenarioView }) {
  const start = entry[view.id];
  return (
    <DisclosureSection title="MITRE ATT&CK mapping" summary={view.name}>
      <p className="mb-4 text-sm text-slate-600">A tactic names an attacker’s objective. A technique describes a way to achieve it.
        These mappings interpret the selected scenario so the team can match hospital defenses to specific behaviors.{" "}
        <a className={linkStyle} href="https://attack.mitre.org/tactics/enterprise/">MITRE Enterprise tactics</a>
      </p>
      {start ? <ol className="divide-y divide-slate-200">{STAGES.map(({ key, label }) => {
        const mapping = key === "attempt" || key === "initial_access" ? start[key] : later[key];
        const defenseStage = key === "attempt" ? "initial_access" : key;
        const controls = view.controlsByStage[defenseStage];
        return (
          <li key={key} className="grid gap-2 py-3 text-sm sm:grid-cols-[10rem_1fr]">
            <h3 className="font-semibold text-navy-900">{label}</h3>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {mapping.tactic && <a className={linkStyle} href={`https://attack.mitre.org/tactics/${mapping.tactic}/`}>{mapping.tactic} · {tactics[mapping.tactic]}</a>}
                {mapping.techniques?.map((id) => <a key={id} className={linkStyle} href={`https://attack.mitre.org/techniques/${id}/`}>{id} · {techniques[id]}</a>)}
              </div>
              <p>{mapping.note}</p>
              {controls.length > 0 && <p className="text-xs text-slate-600">Hospital controls · {controls.map((c) => c.control?.control_name ?? c.controlId).join(", ")}</p>}
            </div>
          </li>
        );
      })}</ol> : <p>No mapping has been reviewed for this scenario.</p>}
    </DisclosureSection>
  );
}
