"""Read-only governance report. Does NOT overwrite v5 model parameters."""
import csv,json,argparse
from pathlib import Path
BASE=Path(__file__).resolve().parent
def build_report():
    with (BASE/'parameter_evidence_crosswalk.csv').open(newline='') as f: rows=list(csv.DictReader(f))
    with (BASE/'evidence_sources.csv').open(newline='') as f: sources=list(csv.DictReader(f))
    statuses={}
    for row in rows: statuses[row['evidence_status']]=statuses.get(row['evidence_status'],0)+1
    unsupported=[r['parameter_key'] for r in rows if r['evidence_status']!='quantitatively_calibrated']
    return {'model_version':'v6_governance_over_v5','calibration_policy':'NO automatic parameter changes based on non-comparable evidence','sources':len(sources),'parameters_reviewed':len(rows),'evidence_status_counts':statuses,'parameters_requiring_quantitative_calibration':unsupported,'external_benchmark':{'source_id':'E03','value_usd':7420000,'population':'studied healthcare data breaches, 2025','comparison':'context_only_not_annual_loss_or_ransomware_incident_calibration'},'release_gate':{'quantitative_calibration_complete':len(unsupported)==0,'external_hospital_use_approved':False,'reason':'Illustrative synthetic assumptions and no independent clinical/financial validation'},'note':'All v5 input parameters remain unchanged; tests verify governance records, not external accuracy.'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output');a=p.parse_args();s=json.dumps(build_report(),indent=2);Path(a.output).write_text(s+'\n') if a.output else print(s)
