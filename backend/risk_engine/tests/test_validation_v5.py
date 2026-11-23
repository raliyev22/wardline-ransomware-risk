import unittest
from engine.portfolio_model import expected_metrics,optimize
from engine.investments import effects
from sensitivity import run

class ValidationV5Tests(unittest.TestCase):
 def test_central_analytic_unchanged(self):
  self.assertAlmostEqual(expected_metrics()['expected_annual_loss_usd'],3096077.59614706,places=4)
 def test_risk_scale_doubles_frequency_and_loss(self):
  self.assertAlmostEqual(expected_metrics(risk_scale=2)['expected_annual_loss_usd'],2*expected_metrics()['expected_annual_loss_usd'])
 def test_loss_scale_doubles_only_financial(self):
  a=expected_metrics();b=expected_metrics(loss_scale=2)
  self.assertAlmostEqual(b['expected_annual_loss_usd'],2*a['expected_annual_loss_usd'])
  self.assertAlmostEqual(b['expected_annual_recovery_days'],a['expected_annual_recovery_days'])
 def test_zero_efficacy_zero_benefit(self):
  self.assertAlmostEqual(expected_metrics(('I01',),efficacy_scale=0)['expected_annual_loss_usd'],expected_metrics()['expected_annual_loss_usd'])
 def test_stress_robustness(self):
  r=run();self.assertEqual(len(r['results']['central_portfolio_robustness']),8)
 def test_invalid_scale(self):
  with self.assertRaises(ValueError): expected_metrics(risk_scale=0)

class DurationCouplingTests(unittest.TestCase):
 def test_same_duration_used_in_cost_and_days(self):
  from engine import comparison
  from engine.bottom_up import drivers
  from engine.risk_model import load_recovery
  import numpy as np
  from unittest.mock import patch
  original=comparison._events
  def force_double_duration(years,seed,uncertainty_mode='central'):
   events=original(years,seed,uncertainty_mode)
   for sid,index,p,u,samples in events:
    for severity in samples:
     samples[severity]['days']*=2
   return events
  base=comparison.compare(1000,2026,{'baseline':()})['strategies']['baseline']
  with patch.object(comparison,'_events',side_effect=force_double_duration):
   doubled=comparison.compare(1000,2026,{'baseline':()})['strategies']['baseline']
  self.assertAlmostEqual(doubled['mean_annual_recovery_days'],2*base['mean_annual_recovery_days'])
  self.assertGreater(doubled['mean_annual_loss_usd'],base['mean_annual_loss_usd'])
  self.assertAlmostEqual(doubled['mean_annual_reputation_loss_usd'],base['mean_annual_reputation_loss_usd'])
