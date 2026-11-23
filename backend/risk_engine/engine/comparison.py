"""Paired Monte Carlo comparisons using identical random event draws per strategy."""
from __future__ import annotations
import numpy as np
from .risk_model import load_scenarios,load_losses,load_recovery,load_clinical
from .investments import effects,spending
from .portfolio_model import EXPOSURE_PROB,TIME_LINKED,IOMT_CONTINUITY_SHARE
from .bottom_up import drivers


def _tri(rng,t,n):
    return rng.triangular(t.low,t.mode,t.high,size=n)


def _events(years,seed,uncertainty_mode="central"):
    """Generate shared attempts, uniform stage outcomes and shared loss draws."""
    rng=np.random.default_rng(seed)
    losses=load_losses(); recovery=load_recovery(); clinical=load_clinical()
    events=[]
    for s in load_scenarios():
        counts=rng.poisson(s.attempts_per_year,size=years)
        index=np.repeat(np.arange(years),counts)
        n=len(index)
        p=[((t.low+t.mode+t.high)/3 if uncertainty_mode=='central' else float(_tri(rng,t,1)[0])) for t in (s.access,s.deployment,s.spread,s.severe_given_spread)]
        uniforms=rng.random((4,n))
        samples={}
        for severity in ('contained','major','severe'):
            components={k:_tri(rng,v,n) for k,v in losses[severity].items()}
            # Same notification exposure random draw reused across strategies.
            components['notification']=components['notification']*(rng.random(n)<EXPOSURE_PROB[severity])
            samples[severity]={'components':components,'days':_tri(rng,recovery[severity],n),
                'diverted':_tri(rng,clinical[severity]['diverted_patients'],n),
                'delayed':_tri(rng,clinical[severity]['delayed_appointments'],n)}
        events.append((s.id,index,p,uniforms,samples))
    return events


def compare(years=20000,seed=2026,portfolios=None,uncertainty_mode="central", *, on_annual_results=None):
    if uncertainty_mode not in ("central","epistemic_draw"): raise ValueError("Invalid uncertainty mode")
    if years<1: raise ValueError('years must be positive')
    if portfolios is None: portfolios={'baseline':(), 'ciso':()}
    draws=_events(years,seed,uncertainty_mode)
    output={}
    central_days={k:v['disruption_days'] for k,v in drivers()['severity'].items()}
    for label,selected in portfolios.items():
        stage,recovery_red,iomt_red=effects(selected)
        annual_loss=np.zeros(years); annual_reputation=np.zeros(years)
        annual_days=np.zeros(years); annual_diverted=np.zeros(years)
        annual_delayed=np.zeros(years); annual_count=np.zeros(years,dtype=int)
        for sid,index,prob,u,samples in draws:
            access=u[0]<prob[0]*(1-stage.get((sid,'initial_access'),0))
            deployed=access & (u[1]<prob[1]*(1-stage.get((sid,'deployment'),0)))
            spread=deployed & (u[2]<prob[2]*(1-stage.get((sid,'major_spread'),0)))
            severe=spread & (u[3]<prob[3])
            levels={'contained':deployed & ~spread,'major':spread & ~severe,'severe':severe}
            np.add.at(annual_count,index[deployed],1)
            for severity,mask in levels.items():
                if not np.any(mask):continue
                subset=index[mask]; sample=samples[severity]
                fin=np.zeros(len(subset)); rep=np.zeros(len(subset))
                sampled_days=sample['days'][mask]*(1-recovery_red)
                for k,arr in sample['components'].items():
                    val=arr[mask]
                    if k in TIME_LINKED: val=val*(sampled_days/central_days[severity])
                    if k=='continuity' and severity!='contained':
                        val=val*(1-IOMT_CONTINUITY_SHARE*iomt_red)
                    fin+=val
                    if k=='reputation':rep+=val
                np.add.at(annual_loss,subset,fin)
                np.add.at(annual_reputation,subset,rep)
                np.add.at(annual_days,subset,sampled_days)
                divert=sample['diverted'][mask]
                if severity!='contained':divert=divert*(1-IOMT_CONTINUITY_SHARE*iomt_red)
                np.add.at(annual_diverted,subset,divert)
                np.add.at(annual_delayed,subset,sample['delayed'][mask]*(1-recovery_red))
        if on_annual_results is not None:
            on_annual_results(label, annual_loss, annual_count)
        output[label]={'investments':list(sorted(selected)),**spending(selected),
            'mean_annual_loss_usd':float(annual_loss.mean()),
            'median_annual_loss_usd':float(np.median(annual_loss)),
            'p90_annual_loss_usd':float(np.quantile(annual_loss,.9)),
            'p95_annual_loss_usd':float(np.quantile(annual_loss,.95)),
            'probability_any_disruptive_event':float(np.mean(annual_count>0)),
            'expected_events_per_year':float(annual_count.mean()),
            'mean_annual_recovery_days':float(annual_days.mean()),
            'mean_annual_diverted_patients':float(annual_diverted.mean()),
            'mean_annual_delayed_appointments':float(annual_delayed.mean()),
            'mean_annual_reputation_loss_usd':float(annual_reputation.mean())}
    base=output.get('baseline')
    if base:
        for label,item in output.items():
            item['avoided_annual_loss_usd']=base['mean_annual_loss_usd']-item['mean_annual_loss_usd']
            item['annualized_net_benefit_usd']=item['avoided_annual_loss_usd']-item['annualized_spend_usd']
    return {'years':years,'seed':seed,'uncertainty_mode':uncertainty_mode,'strategies':output,
        'note':'V5 couples interruption, continuity, and overtime to the SAME sampled recovery days per incident; other costs remain severity-dependent. Central mode uses triangular means for probabilities. Shared draws across portfolios; assumptions synthetic.'}
