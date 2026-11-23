const references = {
  cohort: ["Neprash et al., US healthcare ransomware cohort", "https://jamanetwork.com/journals/jama-health-forum/fullarticle/2799961"],
  firsthealth: ["FirstHealth system profile", "https://talent.firsthealth.org/careers-home"],
  finances: ["Vermont hospital FY2025 actuals, p. 70", "https://gmcboard.vermont.gov/sites/gmcb/files/documents/Final%20actuals%20presentation_0.pdf#page=70"],
  cms: ["CMS hospital cost reports", "https://data.cms.gov/provider-compliance/cost-reports/hospital-provider-cost-report"],
  hhs: ["HHS healthcare cybersecurity goals", "https://hhscyber.hhs.gov/cybersecurity-performance-goals.html"],
  cisa: ["CISA ransomware guide", "https://www.cisa.gov/stopransomware/ransomware-guide"],
  change: ["Change Healthcare testimony, May 2024", "https://www.finance.senate.gov/download/0501-witty-testimony"],
  gateway: ["CISA gateway advisory, February 2024", "https://www.cisa.gov/sites/default/files/2024-02/AA24-060B-Threat-Actors-Exploit-Multiple-Vulnerabilities-in-Ivanti-Connect-Secure-and-Policy-Secure-Gateways_0.pdf"],
  ibm: ["IBM 2025 breach cost study", "https://newsroom.ibm.com/2025-07-30-ibm-report-13-of-organizations-reported-breaches-of-ai-models-or-applications%2C-97-of-which-reported-lacking-proper-ai-access-controls"],
  disruption: ["CMS on Change Healthcare service disruption", "https://www.cms.gov/files/document/hpmsmemoonchangehealthcarecyberattack03062024.pdf"],
  duo: ["Cisco Duo edition prices", "https://duo.com/editions-and-pricing?locale=en_us"],
  nessus: ["Tenable license prices", "https://www.tenable.com/buy"],
  wages: ["BLS May 2024 occupational wages", "https://www.bls.gov/news.release/archives/ocwage_04022025.pdf"],
  edr: ["CrowdStrike endpoint pricing", "https://www.crowdstrike.com/en-us/pricing/"],
  firewall: ["AWS Network Firewall pricing examples", "https://aws.amazon.com/network-firewall/pricing/"],
  backup: ["AWS Backup pricing examples", "https://aws.amazon.com/backup/pricing/"],
  identity: ["Microsoft Entra pricing", "https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing"],
  drills: ["CISA tabletop exercise packages", "https://www.cisa.gov/sites/default/files/2023-02/ctep_fact_sheet_v._11_16_2021_final.pdf"],
  devices: ["NIST hospital infusion pump reference design", "https://www.nccoe.nist.gov/sites/default/files/legacy-files/hit-wip-nist-sp1800-8c.pdf"],
};
export type Reference = keyof typeof references;

export function References({ ids }: { ids: Reference[] }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">{ids.map((id) => (
    <a key={id} className="font-medium text-accent-700 underline underline-offset-2" href={references[id][1]}>{references[id][0]}</a>
  ))}</div>;
}
