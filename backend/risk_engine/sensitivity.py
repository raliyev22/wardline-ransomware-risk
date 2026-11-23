"""Deterministic scenario stress tests; multipliers are illustrative, not confidence intervals."""
import json
from engine.portfolio_model import optimize,expected_metrics
from engine.investments import spending,feasible_portfolios

STRESSES={
 'central':(1.0,1.0,1.0),
 'lower_attack_pressure':(0.65,1.0,1.0),
 'higher_attack_pressure':(1.5,1.0,1.0),
 'lower_incident_costs':(1.0,0.7,1.0),
 'higher_incident_costs':(1.0,1.5,1.0),
 'weaker_control_effects':(1.0,1.0,0.5),
 'stronger_control_effects':(1.0,1.0,1.3),
 'combined_adverse':(1.5,1.5,0.5),
}

def run():
    results={}
    for name,(risk,loss,efficacy) in STRESSES.items():
        result=optimize(risk,loss,efficacy)
        results[name]={'multipliers':{'attack_attempt_frequency':risk,'incident_financial_losses':loss,'control_effectiveness':efficacy},'portfolio':result['selected_investments'],'expected_annual_loss_usd':result['expected_annual_loss_usd'],'expected_annual_net_benefit_usd':result['expected_annual_net_benefit_usd'],'first_year_cash_usd':result['first_year_cash_usd'],'eligible_portfolios':result['clinical_eligible_portfolios']}
    central=tuple(results['central']['portfolio'])
    results['central_portfolio_robustness']={}
    for name,(risk,loss,efficacy) in STRESSES.items():
        baseline=expected_metrics((),risk,loss,efficacy)
        m=expected_metrics(central,risk,loss,efficacy)
        cost=spending(central)
        results['central_portfolio_robustness'][name]={'annual_net_benefit_usd':baseline['expected_annual_loss_usd']-m['expected_annual_loss_usd']-cost['annualized_spend_usd'],'clinical_guardrails_satisfied':m['expected_annual_diverted_patients']<=.75*baseline['expected_annual_diverted_patients'] and m['expected_annual_recovery_days']<=.8*baseline['expected_annual_recovery_days']}
    return {'model_status':'synthetic_stress_tests_not_empirical_uncertainty_intervals','results':results}

if __name__=='__main__': print(json.dumps(run(),indent=2))
