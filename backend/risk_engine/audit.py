"""Explain synthetic baseline model inputs, event frequency, severity and losses."""
import json
from engine.risk_model import load_scenarios,load_losses,load_recovery,load_clinical,rows
from engine.portfolio_model import tri_mean,EXPOSURE_PROB,expected_metrics
from engine.investments import investments,spending

def audit():
    losses=load_losses(); output={"model_status":"synthetic_illustrative_not_empirically_validated","formula":"annual loss = sum over scenarios [attempts/year * P(access|attempt) * P(deployment|access) * sum over severity P(severity|deployment)* E(loss|severity)]", "scenarios":[],"loss_components_by_severity":{},"investments":[],"warnings":[]}
    severity_totals={}
    for severity,parts in losses.items():
        components={}
        for key,t in parts.items():
            raw=tri_mean(t); multiplier=EXPOSURE_PROB[severity] if key=='notification' else 1.0
            components[key]={"min_usd":t.low,"most_likely_usd":t.mode,"max_usd":t.high,"triangular_mean_usd":raw,"applicability_probability":multiplier,"expected_usd":raw*multiplier,"provenance":"synthetic_illustrative"}
        severity_totals[severity]=sum(v['expected_usd'] for v in components.values())
        output['loss_components_by_severity'][severity]={"components":components,"expected_loss_per_incident_usd":severity_totals[severity]}
    for s in load_scenarios():
        a,d,spread,severe=map(tri_mean,(s.access,s.deployment,s.spread,s.severe_given_spread))
        frequency=s.attempts_per_year*a*d
        weights={'contained':1-spread,'major':spread*(1-severe),'severe':spread*severe}
        expected_per_event=sum(weights[k]*severity_totals[k] for k in weights)
        output['scenarios'].append({'scenario_id':s.id,'relevant_attempts_per_year':s.attempts_per_year,'p_access_given_attempt':a,'p_deployment_given_access':d,'p_spread_given_deployment':spread,'p_severe_given_spread':severe,'expected_deployments_per_year':frequency,'severity_weights_given_deployment':weights,'mean_loss_per_deployment_usd':expected_per_event,'expected_annual_loss_contribution_usd':frequency*expected_per_event,'provenance':'synthetic_illustrative'})
    for i in investments().values():
        output['investments'].append({'id':i.id,'name':i.name,'capex_usd':i.capex,'annual_opex_usd':i.annual_opex,'first_year_cash_usd':i.capex+i.annual_opex,'cost_basis':'Synthetic planning estimate; no vendor quote, labor breakdown or empirical benchmark yet'})
    output['analytic_baseline']=expected_metrics(())
    output['warnings']=['Attack frequencies and conditional probabilities are assumed, not sourced to hospital incident logs','Loss min/mode/max are synthetic estimates, not bottom-up priced invoices','Notification exposure probabilities are assumed and conditional on severity','Reputation loss is an assumed future contribution loss; ensure no overlap with interruption','Clinical diversion and delays are modeled indicators, not verified patient harm','Asset-level daily loss proxies are not summed with severity-level costs','Severity probabilities in severity_parameters.csv are descriptive only; the stage-derived severity branches govern calculations','Investment costs and control efficacy need stakeholder or literature calibration before external use','Clinical safety thresholds are illustrative governance choices, not medical standards','The model assumes independent scenario attempt counts and uses simplified event losses; cross-scenario dependence and correlated loss tails are not yet modeled']
    return output
if __name__=='__main__':print(json.dumps(audit(),indent=2))
