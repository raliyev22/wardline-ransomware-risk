"""Transparent synthetic bottom-up incident loss estimates; replaces v3 lump-sum loss amounts.

All eight categories are mutually exclusive by definition. A single representative
severity-specific disruption duration is used for central dollar estimates; recovery
duration uncertainty is reported separately. See README for this limitation.
"""
import json
from pathlib import Path
from .risk_model import Triangular

DATA=Path(__file__).resolve().parents[1]/'data'

def drivers():
    return json.loads((DATA/'bottom_up_cost_drivers.json').read_text())

def breakdown(severity, config=None):
    c=config or drivers()
    if severity not in c['severity']: raise ValueError('Unknown severity')
    d=c['severity'][severity]; u=c['unit_rates']; m=c['metadata']
    days=d['disruption_days']
    if days<=0 or m['operating_days_per_year']<=0: raise ValueError('Invalid duration')
    daily=m['annual_encounters']/m['operating_days_per_year']
    affected=daily*days*d['affected_encounter_fraction']
    cancelled=affected*d['cancelled_fraction_of_affected']
    unrecovered=cancelled*d['unrecovered_fraction']
    costs={
      'restoration':d['systems_restored']*d['engineer_hours_per_system']*u['restoration_engineer_hour_usd']+d['external_recovery_days']*u['external_recovery_day_usd']+d['replacement_servers']*u['replacement_per_server_usd'],
      'response':d['ir_specialists']*d['ir_hours_each']*u['incident_response_specialist_hour_usd']+u['forensic_retainer_usd'],
      'interruption':unrecovered*u['service_contribution_margin_usd'],
      'continuity':days*d['continuity_daily_capacity_factor']*u['temporary_care_capacity_per_day_usd'],
      'notification':d['exposed_records_if_breach']*u['notification_per_record_usd'],
      'legal':d['legal_hours']*u['legal_counsel_hour_usd'],
      'reputation':d['reputation_patients_lost']*d['reputation_probability']*u['reputation_lost_contribution_per_patient_usd'],
      'extra_staff':d['extra_staff_count']*d['overtime_hours_each_per_day']*days*u['overtime_hour_usd']}
    if not all(v>=0 for v in costs.values()): raise ValueError('Negative cost')
    return {'severity':severity,'days':days,'daily_encounters':daily,'affected_encounters':affected,'cancelled_encounters':cancelled,'unrecovered_encounters':unrecovered,'components_usd':costs,'conditional_breach_notification_cost_usd':costs['notification']}

def loss_distributions():
    c=drivers(); f=c['loss_variability']; out={}
    if not (0<=f['low_factor']<=f['mode_factor']<=f['high_factor']): raise ValueError('Invalid variability')
    for severity in c['severity']:
        b=breakdown(severity,c)
        out[severity]={k:Triangular(v*f['low_factor'],v*f['mode_factor'],v*f['high_factor']) for k,v in b['components_usd'].items()}
    return out
