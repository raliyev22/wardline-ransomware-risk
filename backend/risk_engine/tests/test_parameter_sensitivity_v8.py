import unittest
from parameter_sensitivity import parameters,perturb,evaluate,run
from engine.portfolio_model import optimize
from engine.risk_model import load_scenarios
from engine.investments import investments
class V8Tests(unittest.TestCase):
 def test_count(self):self.assertEqual(len(parameters()),28)
 def test_risk_reverts(self):
  before=load_scenarios()[0].access.mode
  with perturb('risk:phishing_credentials:p_initial_access_given_attempt',1.5):self.assertAlmostEqual(load_scenarios()[0].access.mode,before*1.5)
  self.assertEqual(load_scenarios()[0].access.mode,before)
 def test_cost_reverts(self):
  before=investments()['I01'].capex
  with perturb('investment:I01:capex_usd',1.5):self.assertEqual(investments()['I01'].capex,int(before*1.5))
  self.assertEqual(investments()['I01'].capex,before)
 def test_baseline(self):self.assertEqual(optimize()['selected_investments'],['I01','I02','I03','I06'])
 def test_cost_infeasible(self):
  r=evaluate('investment:I03:capex_usd',1.5,('I01','I02','I03','I06'))
  self.assertFalse(r['central_portfolio_eligible'])
 def test_report(self):
  r=run();self.assertEqual(r['tested_parameters'],28)
  self.assertEqual(len(r['priority_order']),28)
