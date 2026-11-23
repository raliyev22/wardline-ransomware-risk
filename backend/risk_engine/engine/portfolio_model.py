"""Analytical expected loss, used to rank all feasible investment sets."""
from __future__ import annotations
from .risk_model import load_scenarios,load_losses,load_recovery,load_clinical
from .investments import effects,spending,feasible_portfolios,config

EXPOSURE_PROB={'contained':0.08,'major':0.30,'severe':0.55}
TIME_LINKED={'interruption','continuity','extra_staff'}
IOMT_CONTINUITY_SHARE=0.20  # illustrative; only major/severe

def tri_mean(t):
    return (t.low+t.mode+t.high)/3


def mean_incident(severity,losses,recovery,clinical,recovery_factor,iomt_factor):
    financial=0.0
    reputation=0.0
    for key,dist in losses[severity].items():
        val=tri_mean(dist)
        if key=='notification':
            val*=EXPOSURE_PROB[severity]
        if key in TIME_LINKED:
            val*=recovery_factor
        if key=='continuity' and severity!='contained':
            val*=1-IOMT_CONTINUITY_SHARE*(1-iomt_factor)
        financial+=val
        if key=='reputation':
            reputation+=val
    diverted=tri_mean(clinical[severity]['diverted_patients'])
    if severity!='contained':
        diverted*=1-IOMT_CONTINUITY_SHARE*(1-iomt_factor)
    return financial,reputation,tri_mean(recovery[severity])*recovery_factor,diverted


def expected_metrics(selected=(), risk_scale=1.0, loss_scale=1.0, efficacy_scale=1.0):
    if not (0<risk_scale<=3 and 0<loss_scale<=3 and 0<=efficacy_scale<=2): raise ValueError("Invalid stress parameters")
    stage,recovery_reduction,iomt_reduction=effects(selected, efficacy_scale)
    losses=load_losses(); recovery=load_recovery(); clinical=load_clinical()
    loss=0.0; reputation=0.0; days=0.0; diverted=0.0; deployments=0.0
    for s in load_scenarios():
        access=tri_mean(s.access)*(1-stage.get((s.id,'initial_access'),0))
        deploy=tri_mean(s.deployment)*(1-stage.get((s.id,'deployment'),0))
        spread=tri_mean(s.spread)*(1-stage.get((s.id,'major_spread'),0))
        severe=tri_mean(s.severe_given_spread)
        freq=s.attempts_per_year*risk_scale*access*deploy
        deployments+=freq
        weights={'contained':1-spread,'major':spread*(1-severe),'severe':spread*severe}
        for severity,w in weights.items():
            fin,rep,rec,div=mean_incident(severity,losses,recovery,clinical,1-recovery_reduction,1-iomt_reduction)
            loss+=freq*w*fin*loss_scale
            reputation+=freq*w*rep*loss_scale
            days+=freq*w*rec
            diverted+=freq*w*div
    return {'expected_annual_loss_usd':loss,'expected_annual_reputation_loss_usd':reputation,
            'expected_events_per_year':deployments,'expected_annual_recovery_days':days,
            'expected_annual_diverted_patients':diverted}


def config_clinical_guardrails():
    return config()['optimization']['clinical_safety']

def optimize(risk_scale=1.0, loss_scale=1.0, efficacy_scale=1.0):
    baseline=expected_metrics((),risk_scale,loss_scale,efficacy_scale)['expected_annual_loss_usd']
    scored=[]
    for selected in feasible_portfolios():
        metrics=expected_metrics(selected,risk_scale,loss_scale,efficacy_scale)
        costs=spending(selected)
        benefit=baseline-metrics['expected_annual_loss_usd']
        net=benefit-costs['annualized_spend_usd']
        scored.append((net,selected,metrics,costs,benefit))
    guard=config_clinical_guardrails()
    baseline_metrics=expected_metrics((),risk_scale,loss_scale,efficacy_scale)
    eligible=[row for row in scored if row[2]['expected_annual_diverted_patients']<=baseline_metrics['expected_annual_diverted_patients']*guard['max_annual_diverted_patients_fraction_of_baseline'] and row[2]['expected_annual_recovery_days']<=baseline_metrics['expected_annual_recovery_days']*guard['max_annual_recovery_days_fraction_of_baseline']]
    if not eligible: raise ValueError('No portfolio satisfies budget and clinical guardrails')
    best=max(eligible,key=lambda row:(row[0],-row[3]['first_year_cash_usd'],row[1]))
    return {'evaluated_feasible_portfolios':len(scored),'clinical_eligible_portfolios':len(eligible),'clinical_guardrails':guard,'selected_investments':list(best[1]),
            'expected_annual_loss_usd':best[2]['expected_annual_loss_usd'],
            'expected_annual_avoided_loss_usd':best[4],
            'expected_annual_net_benefit_usd':best[0],**best[3],
            'baseline_expected_annual_loss_usd':baseline,
            'method':'exhaustive enumeration of first-year-cash-feasible binary portfolios with synthetic clinical guardrails; analytic triangular means'}
