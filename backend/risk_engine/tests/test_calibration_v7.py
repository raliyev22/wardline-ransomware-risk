import unittest
from pathlib import Path
from calibration import run,intake_template,validate_intake,BASE
class CalibrationTests(unittest.TestCase):
 def test_all_parameters_in_template(self):
  self.assertEqual(len(intake_template()),106)
 def test_all_groups_cover_parameters(self):
  r=run();self.assertEqual(sum(g['parameter_count'] for g in r['groups'].values()),106)
 def test_central_portfolio_unchanged(self):
  self.assertEqual(run()['central_portfolio'],['I01','I02','I03','I06'])
 def test_unapproved_proposal_rejected(self):
  rows=intake_template();rows[0]['proposed_value']='10';rows[0]['lower_bound']='8';rows[0]['upper_bound']='12'
  self.assertTrue(validate_intake(rows))
 def test_blank_template_allowed(self):
  self.assertEqual(validate_intake(intake_template()),[])
 def test_group_stress_does_not_modify_data(self):
  import hashlib
  path=BASE/'data'/'control_effectiveness.csv';before=hashlib.sha256(path.read_bytes()).digest();run();self.assertEqual(before,hashlib.sha256(path.read_bytes()).digest())
