"""Inspect how each bottom-up loss component was constructed and compare v3."""
import json
from engine.bottom_up import breakdown,drivers
from engine.risk_model import load_losses,load_legacy_losses
from engine.portfolio_model import tri_mean,EXPOSURE_PROB,expected_metrics,optimize

def report():
    c=drivers(); current=load_losses(); legacy=load_legacy_losses(); rows={}
    for severity in ('contained','major','severe'):
        b=breakdown(severity)
        b['expected_component_usd']={k:tri_mean(t)*(EXPOSURE_PROB[severity] if k=='notification' else 1) for k,t in current[severity].items()}
        b['expected_total_usd']=sum(b['expected_component_usd'].values())
        b['legacy_v3_expected_total_usd']=sum(tri_mean(t)*(EXPOSURE_PROB[severity] if k=='notification' else 1) for k,t in legacy[severity].items())
        rows[severity]=b
    return {'status':'synthetic_illustrative_not_empirically_validated','method':'bottom_up_drivers_with_triangular_cost_multiplier','assumptions':c,'by_severity':rows,'baseline_analytic':expected_metrics(()),'optimized_analytic':optimize(),'warnings':['No actual vendor quotes or validated unit costs','Recovery duration sampled separately from financial loss, so not yet fully coupled at incident level','Notification probability applied by existing risk model; cost shown conditional on breach','Clinical patient diversions remain nonfinancial and must not be monetized again','Existing v3 annualized cost horizon and control-effectiveness assumptions retained']}
if __name__=='__main__':print(json.dumps(report(),indent=2))
