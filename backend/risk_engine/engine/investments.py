"""Investment effects and budget rules; all effects are synthetic assumptions."""
from __future__ import annotations
from dataclasses import dataclass
from itertools import combinations
import json
from .risk_model import DATA, rows

@dataclass(frozen=True)
class Investment:
    id: str
    name: str
    capex: int
    annual_opex: int


def investments():
    return {r['investment_id']: Investment(r['investment_id'],r['investment_name'],int(r['capex_usd']),int(r['incremental_annual_opex_usd'])) for r in rows('security_investments.csv')}


def config():
    return json.loads((DATA/'optimization_config.json').read_text())


def validate_portfolio(selected):
    ids=set(selected)
    catalog=investments()
    if len(ids)!=len(tuple(selected)) or ids-set(catalog):
        raise ValueError('Duplicate or unknown investment ID')
    if 'I08' in ids and 'I03' not in ids:
        raise ValueError('I08 requires I03 (segmentation architecture)')
    capex=sum(catalog[i].capex for i in ids)
    opex=sum(catalog[i].annual_opex for i in ids)
    if capex+opex>config()['budget_first_year_cash_usd']:
        raise ValueError('Investment selection exceeds first-year cash budget')
    return tuple(sorted(ids))


def effects(selected, efficacy_scale=1.0):
    """Conservative strongest-only rule for shared scenario/stage.

    I08 is a conditional IoMT impact modifier, not a global spread effect.
    """
    if not 0<=efficacy_scale<=2: raise ValueError('Invalid efficacy scale')
    selected=validate_portfolio(selected)
    stage={}
    recovery_reduction=0.0
    iomt_reduction=0.0
    for r in rows('control_effectiveness.csv'):
        if r['investment_id'] not in selected:
            continue
        reduction=min(1.0,float(r['target_relative_reduction'])*efficacy_scale)
        metric=r['affected_metric']
        if metric=='recovery_days':
            recovery_reduction=max(recovery_reduction,reduction)
        elif metric=='iomt_disruption':
            iomt_reduction=max(iomt_reduction,reduction)
        elif metric in ('initial_access','deployment','major_spread'):
            stage[(r['scenario_id'],metric)]=max(stage.get((r['scenario_id'],metric),0),reduction)
        else:
            raise ValueError(f'Unknown effect metric: {metric}')
    return stage,recovery_reduction,iomt_reduction


def spending(selected):
    catalog=investments()
    capex=sum(catalog[i].capex for i in selected)
    opex=sum(catalog[i].annual_opex for i in selected)
    life=config()['cost_convention']['assumed_useful_life_years']
    return {'capex_usd':capex,'annual_opex_usd':opex,'annualized_spend_usd':capex/life+opex,'first_year_cash_usd':capex+opex}


def feasible_portfolios():
    ids=sorted(investments())
    for n in range(len(ids)+1):
        for candidate in combinations(ids,n):
            try:
                yield validate_portfolio(candidate)
            except ValueError:
                continue
