import unittest
from engine.investments import validate_portfolio,effects,spending,feasible_portfolios
from engine.portfolio_model import expected_metrics,optimize
from engine.comparison import compare

class InvestmentTests(unittest.TestCase):
    def test_constraints(self):
        with self.assertRaises(ValueError):validate_portfolio(['I08'])
        with self.assertRaises(ValueError):validate_portfolio(['I01','I01'])
        with self.assertRaises(ValueError):validate_portfolio(['I01','I02','I03','I04','I05','I06','I07','I08'])
        self.assertGreater(len(list(feasible_portfolios())),0)

    def test_effect_mapping(self):
        stage,recovery,iomt=effects(['I04','I06'])
        self.assertEqual(stage[('vpn_exploit','initial_access')],.5)
        self.assertEqual(recovery,.3)
        self.assertEqual(iomt,0)

    def test_analytic_baseline_and_benefits(self):
        baseline=expected_metrics(())
        improved=expected_metrics(('I01','I04','I06'))
        self.assertLess(improved['expected_annual_loss_usd'],baseline['expected_annual_loss_usd'])
        self.assertLess(improved['expected_events_per_year'],baseline['expected_events_per_year'])

    def test_optimizer(self):
        best=optimize()
        validate_portfolio(best['selected_investments'])
        self.assertGreaterEqual(best['expected_annual_net_benefit_usd'],0)

    def test_paired_reproducible(self):
        p={'baseline':(), 'ciso':('I04',)}
        a=compare(1000,123,p); b=compare(1000,123,p)
        self.assertEqual(a,b)
        self.assertLess(a['strategies']['ciso']['mean_annual_loss_usd'],a['strategies']['baseline']['mean_annual_loss_usd'])
        self.assertEqual(a['strategies']['ciso']['expected_events_per_year'],a['strategies']['baseline']['expected_events_per_year'])

    def test_zero_effect_identity(self):
        r=compare(500,9,{'baseline':(), 'same':()})['strategies']
        self.assertEqual(r['baseline']['mean_annual_loss_usd'],r['same']['mean_annual_loss_usd'])
