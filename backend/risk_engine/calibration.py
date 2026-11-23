"""V7 prioritization and evidence-intake workflow. No automatic calibration."""
from pathlib import Path
import csv,json,argparse
from engine.portfolio_model import optimize,expected_metrics
from engine.investments import spending
BASE=Path(__file__).resolve().parent
GROUPS={
 'attack_frequency': {'prefixes':('risk:',),'field':'annual_relevant_attempts','lever':'risk_scale','range':(0.65,1.5),'owner':'Hospital SOC / incident response'},
 'financial_severity': {'prefixes':('unit_rate:','severity:'),'field':None,'lever':'loss_scale','range':(0.7,1.5),'owner':'Finance / revenue cycle / clinical operations'},
 'control_effectiveness': {'prefixes':('effect:',),'field':None,'lever':'efficacy_scale','range':(0.5,1.3),'owner':'Security engineering / external assessor'},
 'investment_cost': {'prefixes':('investment:',),'field':None,'lever':None,'range':None,'owner':'Procurement / vendor quotes'},
 'attack_conditional_probabilities': {'prefixes':('risk:',),'field':'probability','lever':None,'range':None,'owner':'SOC / incident response'},
}

def group_for(key):
 if key.startswith('risk:'):
  return 'attack_frequency' if key.endswith(':annual_relevant_attempts') else 'attack_conditional_probabilities'
 if key.startswith('effect:'): return 'control_effectiveness'
 if key.startswith('investment:'): return 'investment_cost'
 return 'financial_severity'

def read_csv(name):
 with (BASE/name).open(newline='') as f: return list(csv.DictReader(f))

def run():
 rows=read_csv('parameter_evidence_crosswalk.csv')
 central=optimize(); portfolio=tuple(central['selected_investments'])
 base=expected_metrics(())['expected_annual_loss_usd']
 central_net=central['expected_annual_net_benefit_usd']
 results={}
 for group,spec in GROUPS.items():
  subset=[r for r in rows if group_for(r['parameter_key'])==group]
  entry={'parameter_count':len(subset),'unvalidated_count':sum(r['evidence_status']!='quantitatively_calibrated' for r in subset),'data_owner':spec['owner'],'parameter_examples':[r['parameter_key'] for r in subset[:5]],'group_stress_is_not_parameter_level_calibration':True}
  if spec['lever']:
   evaluations=[]
   for factor in spec['range']:
    kwargs={'risk_scale':1.,'loss_scale':1.,'efficacy_scale':1.}
    kwargs[spec['lever']]=factor
    best=optimize(**kwargs)
    current=expected_metrics(portfolio,**kwargs)
    baseline=expected_metrics((),**kwargs)
    net=baseline['expected_annual_loss_usd']-current['expected_annual_loss_usd']-spending(portfolio)['annualized_spend_usd']
    evaluations.append({'factor':factor,'optimal_portfolio':best['selected_investments'],'optimal_net_benefit_usd':best['expected_annual_net_benefit_usd'],'central_portfolio_net_benefit_usd':net,'central_portfolio_regret_usd':round(max(0,best['expected_annual_net_benefit_usd']-net),2)})
   entry['illustrative_group_stress']=evaluations
   entry['max_portfolio_regret_usd']=max(x['central_portfolio_regret_usd'] for x in evaluations)
  else:
   entry['max_portfolio_regret_usd']=None
   entry['limitation']='Not evaluated by group multiplier; requires parameter-level cost/conditional probability perturbation'
  results[group]=entry
 priority=sorted(results,key=lambda k:(results[k]['max_portfolio_regret_usd'] is None,-(results[k]['max_portfolio_regret_usd'] or 0)))
 return {'version':'v7','status':'prioritization_only_no_new_quantitative_calibration','baseline_analytic_usd':base,'central_portfolio':list(portfolio),'central_annual_net_benefit_usd':central_net,'groups':results,'stress_ranked_groups':priority,'limitations':['Group multipliers are hypothetical, not empirical confidence intervals','Rank is based on portfolio regret at selected stress endpoints, not parameter-specific importance','Conditional attack probabilities and investment costs are not independently stressed here','No values in model data files are changed','Clinical guardrails and asset-specific calibration require separate validation']}

def intake_template():
 rows=read_csv('parameter_evidence_crosswalk.csv')
 return [{'parameter_key':r['parameter_key'],'current_value':r['current_value'],'unit':r['unit'],'proposed_value':'','lower_bound':'','upper_bound':'','source_id_or_interview':'','source_url_or_document':'','source_date':'','population_and_denominator':'','measurement_definition':'','hospital_transferability_rationale':'','reviewer':'','review_status':'pending','notes':''} for r in rows]

def validate_intake(rows):
 errors=[]
 for i,r in enumerate(rows,2):
  if not r.get('proposed_value','').strip(): continue
  for k in ('source_id_or_interview','population_and_denominator','measurement_definition','hospital_transferability_rationale','reviewer'):
   if not r.get(k,'').strip(): errors.append(f'row {i} {r.get("parameter_key")}: missing {k}')
  try:
   val=float(r['proposed_value']);lo=float(r['lower_bound']);hi=float(r['upper_bound'])
   if not lo<=val<=hi: errors.append(f'row {i}: proposed value outside bounds')
   if r['unit']=='probability' and not (0<=lo<=hi<=1): errors.append(f'row {i}: probability bounds must be within [0,1]')
  except (ValueError,KeyError): errors.append(f'row {i}: proposed value and both numeric bounds required')
  if r.get('review_status')!='approved': errors.append(f'row {i}: proposed value not approved')
 return errors

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',default='calibration_priority_report.json');p.add_argument('--validate-intake');args=p.parse_args()
 if args.validate_intake:
  with open(args.validate_intake,newline='') as f: data=list(csv.DictReader(f))
  errors=validate_intake(data);print(json.dumps({'valid':not errors,'errors':errors},indent=2));raise SystemExit(bool(errors))
 Path(args.output).write_text(json.dumps(run(),indent=2)+'\n');print('Wrote',args.output)
