import unittest
from engine.investments import validate_portfolio,spending,config
from engine.portfolio_model import optimize,expected_metrics
from engine.comparison import compare
from audit import audit
class ValidationTests(unittest.TestCase):
    def test_first_year_budget(self):
        with self.assertRaises(ValueError): validate_portfolio(['I01','I02','I03','I05','I06','I07'])
        best=optimize()
        self.assertLessEqual(best['first_year_cash_usd'],2000000)
    def test_clinical_guardrails(self):
        best=optimize(); base=expected_metrics(()); chosen=expected_metrics(best['selected_investments'])
        g=config()['optimization']['clinical_safety']
        self.assertLessEqual(chosen['expected_annual_diverted_patients'],base['expected_annual_diverted_patients']*g['max_annual_diverted_patients_fraction_of_baseline'])
        self.assertLessEqual(chosen['expected_annual_recovery_days'],base['expected_annual_recovery_days']*g['max_annual_recovery_days_fraction_of_baseline'])
    def test_central_simulation_converges_to_analytic(self):
        a=expected_metrics(())['expected_annual_loss_usd']
        mc=compare(100000,2026,{'baseline':()})['strategies']['baseline']['mean_annual_loss_usd']
        self.assertLess(abs(mc-a)/a,.04)
    def test_audit_matches_analytic(self):
        x=audit(); total=sum(s['expected_annual_loss_contribution_usd'] for s in x['scenarios'])
        self.assertAlmostEqual(total,x['analytic_baseline']['expected_annual_loss_usd'])
