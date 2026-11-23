import unittest
from engine.bottom_up import breakdown,drivers
from engine.risk_model import load_losses,load_legacy_losses
from engine.portfolio_model import tri_mean,expected_metrics
from engine.comparison import compare

class BottomUpTests(unittest.TestCase):
    def test_all_components_and_positive(self):
        for severity in ('contained','major','severe'):
            b=breakdown(severity)
            self.assertEqual(len(b['components_usd']),8)
            self.assertTrue(all(x>=0 for x in b['components_usd'].values()))
    def test_no_double_count_of_encounters(self):
        b=breakdown('major')
        self.assertLessEqual(b['unrecovered_encounters'],b['cancelled_encounters'])
        self.assertLessEqual(b['cancelled_encounters'],b['affected_encounters'])
    def test_interruption_formula(self):
        b=breakdown('major'); rate=drivers()['unit_rates']['service_contribution_margin_usd']
        self.assertAlmostEqual(b['components_usd']['interruption'],b['unrecovered_encounters']*rate)
    def test_reputation_separate_from_downtime(self):
        c=drivers(); a=breakdown('major',c)['components_usd']['reputation']
        c['severity']['major']['disruption_days']*=2
        self.assertEqual(a,breakdown('major',c)['components_usd']['reputation'])
    def test_v3_legacy_preserved(self):
        self.assertNotEqual(tri_mean(load_losses()['major']['restoration']),tri_mean(load_legacy_losses()['major']['restoration']))
    def test_simulation_agrees_with_analytic(self):
        a=expected_metrics(())['expected_annual_loss_usd']
        b=compare(30000,2026,{'baseline':()})['strategies']['baseline']['mean_annual_loss_usd']
        self.assertLess(abs(a-b)/a,.07)
    def test_invalid_severity(self):
        with self.assertRaises(ValueError):breakdown('unknown')
