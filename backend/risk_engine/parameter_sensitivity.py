"""V8 one-at-a-time hypothetical parameter perturbations. Never edits source data."""
import argparse,csv,json
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from engine import risk_model,investments
from engine.portfolio_model import optimize,expected_metrics,config_clinical_guardrails
from engine.investments import spending,validate_portfolio
ROOT=Path(__file__).resolve().parent
FACTORS=(0.5,1.5)

def parameters():
    with (ROOT/'parameter_evidence_crosswalk.csv').open(newline='') as f:
        return [r for r in csv.DictReader(f) if r['parameter_key'].startswith('investment:') or
                (r['parameter_key'].startswith('risk:') and not r['parameter_key'].endswith(':annual_relevant_attempts'))]

@contextmanager
def perturb(key,factor):
    """Patch CSV readers in memory, including the imported alias in investments."""
    original=risk_model.rows
    parts=key.split(':')
    if parts[0]=='risk':
        _,scenario,parameter=parts
        filename='risk_parameters.csv'
        def match(row):return row['scenario_id']==scenario and row['parameter_id']==parameter
        columns=('min_value','mode_or_mean','max_value')
    elif parts[0]=='investment':
        _,investment,parameter=parts
        filename='security_investments.csv'
        if parameter not in ('capex_usd','incremental_annual_opex_usd'):raise ValueError(key)
        def match(row):return row['investment_id']==investment
        columns=(parameter,)
    else:raise ValueError(key)
    def patched(name):
        rows=original(name)
        if name!=filename:return rows
        for row in rows:
            if match(row):
                for column in columns:
                    if row[column]=='':continue
                    new=float(row[column])*factor
                    if filename=='risk_parameters.csv':new=min(1.,new)
                    row[column]=str(int(round(new))) if filename=='security_investments.csv' else str(new)
        return rows
    with patch.object(risk_model,'rows',patched),patch.object(investments,'rows',patched):
        yield

def evaluate(key,factor,central):
    with perturb(key,factor):
        best=optimize()
        base=expected_metrics(())
        original_validate=investments.validate_portfolio
        def allow_budget_only(selected):
            try:return original_validate(selected)
            except ValueError as exc:
                if 'exceeds first-year cash budget' not in str(exc):raise
                return tuple(sorted(selected))
        with patch.object(investments,'validate_portfolio',allow_budget_only):
            current=expected_metrics(central)
        cash=spending(central)['first_year_cash_usd']
        budget=investments.config()['budget_first_year_cash_usd']
        guard=config_clinical_guardrails()
        eligible=(cash<=budget and current['expected_annual_diverted_patients']<=base['expected_annual_diverted_patients']*guard['max_annual_diverted_patients_fraction_of_baseline'] and current['expected_annual_recovery_days']<=base['expected_annual_recovery_days']*guard['max_annual_recovery_days_fraction_of_baseline'])
        net=base['expected_annual_loss_usd']-current['expected_annual_loss_usd']-spending(central)['annualized_spend_usd']
        return {'factor':factor,'optimal_portfolio':best['selected_investments'],
                'optimal_net_benefit_usd':round(best['expected_annual_net_benefit_usd'],2),
                'central_portfolio_net_benefit_usd':round(net,2),
                'central_portfolio_eligible':eligible,
                'central_portfolio_regret_usd':round(max(0,best['expected_annual_net_benefit_usd']-net),2) if eligible else None,
                'central_portfolio_first_year_cash_usd':round(cash,2)}

def run():
    central=tuple(optimize()['selected_investments'])
    results=[]
    for row in parameters():
        key=row['parameter_key']
        stress=[evaluate(key,factor,central) for factor in FACTORS]
        eligible=[s['central_portfolio_regret_usd'] for s in stress if s['central_portfolio_eligible']]
        results.append({'parameter_key':key,'baseline_value':row['current_value'],
                        'evidence_status':row['evidence_status'], 'stress':stress,
                        'max_regret_usd':max(eligible) if eligible else None,
                        'central_ineligible_at_any_endpoint':any(not s['central_portfolio_eligible'] for s in stress)})
    ranked=sorted(results,key=lambda r:(not r['central_ineligible_at_any_endpoint'], -(r['max_regret_usd'] or 0)))
    return {'version':'v8','status':'hypothetical_one_at_a_time_stress_not_quantitative_calibration',
            'central_portfolio':list(central),'tested_parameters':len(results),'endpoints_per_parameter':list(FACTORS),
            'results':results,'priority_order':[r['parameter_key'] for r in ranked],
            'limitations':['Multipliers are arbitrary illustrative stresses, not empirical bounds',
                           'Each parameter is varied separately; correlated changes are not represented',
                           'A 50% increase in a conditional probability is capped at 1.0',
                           'Investment costs affect feasibility as well as annualized net benefit',
                           'All baseline values remain synthetic and unvalidated',
                           'No source data files are modified']}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='parameter_sensitivity_report.json')
    args=parser.parse_args()
    report=run()
    Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
    print('Wrote',args.output,'with',report['tested_parameters'],'parameters')
