import { asNumber, splitIds } from "./format";
import type { InvestmentItem, SecurityControlRecord } from "./types";

export const SECURITY_RULE = "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C";

// Provider-side standards from §§ 164.308–316. Each citation counts once, regardless
// of the number of supporting controls or underlying implementation specifications.
interface Standard {
  cite: string;
  title: string;
  review: string;
  controls?: string[];
  rationale?: string;
}

const standards: Standard[] = [
  { cite: "164.308(a)(1)(i)", title: "Managing security risks", controls: ["C03", "C06"],
    rationale: "Segmentation and timely patching reduce identified ransomware risks.",
    review: "Check the hospital-wide risk analysis, risk treatment decisions, sanction policy and system activity reviews." },
  { cite: "164.308(a)(2)", title: "Security leadership",
    review: "Look for the formal designation of the official responsible for the security program." },
  { cite: "164.308(a)(3)(i)", title: "Workforce access",
    review: "Review staff authorization, supervision, clearance and access removal when employment ends." },
  { cite: "164.308(a)(4)(i)", title: "Granting and reviewing access", controls: ["C05"],
    rationale: "Time limits and least privilege restrict vendor permissions.",
    review: "Check approvals, periodic reviews and changes to access rights across systems holding patient information." },
  { cite: "164.308(a)(5)(i)", title: "Workforce security training",
    review: "Look for the workforce training program and completion records for staff and management." },
  { cite: "164.308(a)(6)(i)", title: "Responding to security incidents", controls: ["C02"],
    rationale: "Endpoint detection helps staff identify and contain incidents on monitored devices.",
    review: "Review response and reporting procedures, incident records and documented outcomes." },
  { cite: "164.308(a)(7)(i)", title: "Continuity and recovery", controls: ["C04", "C08"],
    rationale: "Immutable copies support recovery. Exercises test the hospital’s ability to restore services.",
    review: "Check backup scope, restore results, emergency operating procedures and plan revisions after exercises." },
  { cite: "164.308(a)(8)", title: "Evaluating safeguards",
    review: "Look for technical and organizational evaluations against the Security Rule, including reviews after changes." },
  { cite: "164.308(b)(1)", title: "Obtaining vendor assurances",
    review: "Identify business associates handling patient information and check for signed agreements or qualifying arrangements." },
  { cite: "164.310(a)(1)", title: "Entry to facilities",
    review: "Review physical entry controls, visitor records and authorized access during recovery." },
  { cite: "164.310(b)", title: "Workstation use rules",
    review: "Check written rules for workstation tasks, how staff perform them and where devices may be used." },
  { cite: "164.310(c)", title: "Physical workstation protection",
    review: "Inspect physical safeguards that limit access to workstations handling patient information." },
  { cite: "164.310(d)(1)", title: "Equipment and storage media",
    review: "Review equipment movements, media disposal and the removal of patient information before reuse." },
  { cite: "164.312(a)(1)", title: "Restricting system access", controls: ["C05"],
    rationale: "Vendor access controls restrict privileged connections to authorized uses.",
    review: "Check access enforcement for all users and software, unique identifiers and emergency access procedures." },
  { cite: "164.312(b)", title: "Auditing system activity",
    review: "Look for records showing that activity on systems holding patient information is logged and examined." },
  { cite: "164.312(c)(1)", title: "Protecting data integrity", controls: ["C04"],
    rationale: "Immutable backup copies resist unauthorized changes to the data they contain.",
    review: "Check safeguards against alteration and destruction of patient information in live systems as well as backups." },
  { cite: "164.312(d)", title: "Verifying identity", controls: ["C01", "C05", "C07"],
    rationale: "Multifactor checks help verify the identities behind workforce, privileged and remote accounts.",
    review: "Verify authentication procedures and coverage for every person or entity requesting access to patient information." },
  { cite: "164.312(e)(1)", title: "Protecting data in transit",
    review: "Review how patient information is protected as it crosses networks, including integrity and encryption decisions." },
  { cite: "164.314(a)(1)", title: "Terms of business associate agreements",
    review: "Inspect contract terms covering safeguards, subcontractor obligations and reporting of security incidents." },
  { cite: "164.316(a)", title: "Implementing security policies", controls: ["C05", "C06"],
    rationale: "The vendor access and patch records measure adherence to two specific policies.",
    review: "Review the full set of security policies and evidence that staff follow them across the hospital." },
  { cite: "164.316(b)(1)", title: "Maintaining security documentation",
    review: "Check that required records are available, updated and kept for six years after creation or the last effective date, whichever is later." },
];

export function assessStandards(controls: SecurityControlRecord[], projects: InvestmentItem[]) {
  return standards.map((standard) => {
    const mapped = standard.controls ?? [];
    const evidence = controls.filter((control) => {
      const coverage = asNumber(control.baseline_coverage);
      return mapped.includes(control.control_id ?? "") && control.unit === "percent" &&
        coverage !== null && coverage > 0 && coverage <= 100;
    });
    // Targets belong to projects. One project can cover several controls and
    // two projects can target different subsets of the same control.
    const targets = projects.filter((item) =>
      splitIds(item.source_record.affected_control_ids).some((id) => mapped.includes(id)));
    return { ...standard, evidence, targets };
  });
}
