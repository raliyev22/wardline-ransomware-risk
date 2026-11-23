import csv,unittest
from pathlib import Path
from governance import build_report
ROOT=Path(__file__).resolve().parents[1]
class GovernanceTests(unittest.TestCase):
 def test_sources_have_urls_and_transferability_warnings(self):
  with (ROOT/'evidence_sources.csv').open() as f: rows=list(csv.DictReader(f))
  self.assertGreaterEqual(len(rows),5)
  for r in rows:
   self.assertTrue(r['url'].startswith('https://'))
   self.assertTrue(r['transferability_warning'])
 def test_all_entries_are_explicitly_unvalidated(self):
  report=build_report()
  self.assertGreater(report['parameters_reviewed'],40)
  self.assertFalse(report['release_gate']['external_hospital_use_approved'])
  self.assertEqual(report['evidence_status_counts']['synthetic_unvalidated'],report['parameters_reviewed'])
 def test_risk_and_investment_parameters_covered(self):
  with (ROOT/'parameter_evidence_crosswalk.csv').open() as f: keys={r['parameter_key'] for r in csv.DictReader(f)}
  with (ROOT/'data/risk_parameters.csv').open() as f:
   for r in csv.DictReader(f): self.assertIn(f"risk:{r['scenario_id']}:{r['parameter_id']}",keys)
  with (ROOT/'data/security_investments.csv').open() as f:
   for r in csv.DictReader(f): self.assertIn(f"investment:{r['investment_id']}:capex_usd",keys)
 def test_benchmark_is_not_used_as_calibration(self):
  report=build_report()
  self.assertIn('context_only',report['external_benchmark']['comparison'])
