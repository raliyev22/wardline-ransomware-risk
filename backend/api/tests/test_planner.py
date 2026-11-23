"""Investment Planner API tests: budget-restricted optimization, overlap explanation, marginals."""
import unittest
from backend.api.tests import IsolatedRunHistory

from fastapi.testclient import TestClient

from backend.api import planner
from backend.api.engine_bridge import comparison, investments, portfolio_model
from backend.api.main import app

ENGINE_BUDGET = 2_000_000


class _Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)


class OptimizeBudgetTests(_Base):
    def test_enumeration_reproduces_engine_optimize(self):
        engine = portfolio_model.optimize()
        enum = planner.optimize_by_enumeration(investments.config()["budget_first_year_cash_usd"])
        for key, value in engine.items():
            if key == "method":
                continue
            self.assertEqual(enum[key], value, key)

    def test_default_optimize_unchanged(self):
        body = self.client.get("/api/portfolio/optimize").json()
        self.assertEqual(body["selected_investments"], portfolio_model.optimize()["selected_investments"])
        self.assertEqual(body["status"], "optimal")
        self.assertTrue(body["budget"]["is_engine_budget"])

    def test_lower_budget_respected_and_matches_engine_scoring(self):
        for budget in (445_000, 700_000, 1_000_000, 1_500_000):
            r = self.client.get("/api/portfolio/optimize", params={"budget_usd": budget})
            self.assertEqual(r.status_code, 200, r.text)
            body = r.json()
            sel = tuple(body["selected_investments"])
            investments.validate_portfolio(list(sel))  # dependency + engine budget
            self.assertLessEqual(body["spending"]["first_year_cash_usd"], budget)
            m = portfolio_model.expected_metrics(sel)
            base = portfolio_model.expected_metrics(())
            self.assertAlmostEqual(body["metrics"]["expected_annual_loss_usd"], m["expected_annual_loss_usd"], places=6)
            g = portfolio_model.config_clinical_guardrails()
            self.assertLessEqual(m["expected_annual_diverted_patients"],
                                 base["expected_annual_diverted_patients"] * g["max_annual_diverted_patients_fraction_of_baseline"])
            self.assertLessEqual(m["expected_annual_recovery_days"],
                                 base["expected_annual_recovery_days"] * g["max_annual_recovery_days_fraction_of_baseline"])
            # Brute-force check: no eligible portfolio within budget has higher net benefit.
            best_net = body["optimization"]["expected_annual_net_benefit_usd"]
            for p in investments.feasible_portfolios():
                c = investments.spending(p)
                if c["first_year_cash_usd"] > budget:
                    continue
                pm = portfolio_model.expected_metrics(p)
                ok = (pm["expected_annual_diverted_patients"] <= base["expected_annual_diverted_patients"] * g["max_annual_diverted_patients_fraction_of_baseline"]
                      and pm["expected_annual_recovery_days"] <= base["expected_annual_recovery_days"] * g["max_annual_recovery_days_fraction_of_baseline"])
                if ok:
                    net = base["expected_annual_loss_usd"] - pm["expected_annual_loss_usd"] - c["annualized_spend_usd"]
                    self.assertLessEqual(net, best_net + 1e-6)

    def test_no_eligible_portfolio_is_explained(self):
        r = self.client.get("/api/portfolio/optimize", params={"budget_usd": 300_000})
        self.assertEqual(r.status_code, 409)
        d = r.json()["detail"]
        self.assertEqual(d["error"], "no_eligible_portfolio")
        self.assertIn("clinical guardrails", d["message"])
        self.assertEqual(d["min_first_year_cash_for_eligible_portfolio_usd"], 445_000)
        self.assertGreater(d["portfolios_within_budget"], 0)

    def test_budget_above_engine_rejected(self):
        r = self.client.get("/api/portfolio/optimize", params={"budget_usd": ENGINE_BUDGET + 1})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"]["error"], "invalid_budget")
        self.assertEqual(self.client.get("/api/portfolio/optimize", params={"budget_usd": 0}).status_code, 422)


class EvaluateEffectsTests(_Base):
    def test_overlap_strongest_only(self):
        r = self.client.post("/api/portfolio/evaluate", json={"investment_ids": ["I01", "I04", "I05", "I07"], "budget_usd": 1_500_000})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        stage, recovery, _ = investments.effects(("I01", "I04", "I05", "I07"))
        overlaps = {(o["scenario_id"], o["affected_metric"]): o for o in body["effects"]["overlaps"]}
        rec = overlaps[("all", "recovery_days")]
        self.assertEqual((rec["applied_investments"], rec["superseded_investments"]), (["I04"], ["I07"]))
        self.assertAlmostEqual(rec["applied_relative_reduction"], recovery)
        ven = overlaps[("vendor_credentials", "initial_access")]
        self.assertEqual((ven["applied_investments"], ven["superseded_investments"]), (["I05"], ["I01"]))
        self.assertAlmostEqual(ven["applied_relative_reduction"], stage[("vendor_credentials", "initial_access")])
        self.assertTrue(body["budget"]["within_selected_budget"])
        self.assertAlmostEqual(body["budget"]["remaining_usd"], 1_500_000 - investments.spending(("I01", "I04", "I05", "I07"))["first_year_cash_usd"])

    def test_over_selected_budget_flagged_not_rejected(self):
        body = self.client.post("/api/portfolio/evaluate", json={"investment_ids": ["I03"], "budget_usd": 500_000}).json()
        self.assertFalse(body["budget"]["within_selected_budget"])
        self.assertAlmostEqual(body["metrics"]["expected_annual_loss_usd"], portfolio_model.expected_metrics(("I03",))["expected_annual_loss_usd"])

    def test_engine_constraints_still_400(self):
        for ids in (["I08"], ["I01", "I03", "I04", "I08"]):
            self.assertEqual(self.client.post("/api/portfolio/evaluate", json={"investment_ids": ids}).status_code, 400)


class MarginalTests(_Base):
    def test_marginals_match_engine(self):
        body = self.client.post("/api/portfolio/marginals", json={"investment_ids": ["I04"]}).json()
        items = {i["investment_id"]: i for i in body["items"]}
        cur = portfolio_model.expected_metrics(("I04",))["expected_annual_loss_usd"]
        i02 = items["I02"]
        self.assertEqual(i02["action"], "add")
        self.assertAlmostEqual(i02["expected_annual_loss_change_usd"],
                               portfolio_model.expected_metrics(("I02", "I04"))["expected_annual_loss_usd"] - cur, places=6)
        self.assertEqual(items["I04"]["action"], "remove")
        self.assertAlmostEqual(items["I04"]["expected_annual_loss_change_usd"],
                               portfolio_model.expected_metrics(())["expected_annual_loss_usd"] - cur, places=6)
        # I07 is fully superseded by I04's stronger recovery effect.
        self.assertTrue(items["I07"]["no_additional_effect"])
        self.assertEqual(items["I07"]["overlaps"][0]["applied_investments"], ["I04"])
        # Dependency preserved.
        self.assertFalse(items["I08"]["valid"])
        self.assertIn("requires I03", items["I08"]["reason"])

    def test_removing_prerequisite_is_invalid(self):
        body = self.client.post("/api/portfolio/marginals", json={"investment_ids": ["I03", "I08"]}).json()
        items = {i["investment_id"]: i for i in body["items"]}
        self.assertFalse(items["I03"]["valid"])
        self.assertTrue(items["I08"]["valid"])

    def test_budget_flags(self):
        body = self.client.post("/api/portfolio/marginals", json={"investment_ids": [], "budget_usd": 300_000}).json()
        items = {i["investment_id"]: i for i in body["items"]}
        self.assertTrue(items["I06"]["within_selected_budget"])  # $220K
        self.assertFalse(items["I03"]["within_selected_budget"])  # $835K


class SimulateBudgetTests(IsolatedRunHistory, _Base):
    def test_simulate_with_lower_budget_uses_budget_optimum(self):
        body = self.client.post("/api/simulate", json={"investment_ids": ["I06"], "years": 300, "budget_usd": 700_000}).json()
        opt = planner.optimize_for_budget(700_000)["selected_investments"]
        self.assertEqual(body["portfolios"]["optimized"], opt)
        expected = comparison.compare(300, 2026, {"baseline": (), "ciso": ("I06",), "optimized": tuple(opt)})
        self.assertAlmostEqual(body["simulated"]["strategies"]["optimized"]["mean_annual_loss_usd"],
                               expected["strategies"]["optimized"]["mean_annual_loss_usd"], places=6)

    def test_simulate_without_eligible_optimum_still_runs(self):
        r = self.client.post("/api/simulate", json={"investment_ids": ["I06"], "years": 300, "budget_usd": 300_000})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["optimization_status"], "no_eligible_portfolio")
        self.assertNotIn("optimized", body["simulated"]["strategies"])
        self.assertIsNone(body["analytic"]["optimized_metrics"])
        self.assertIn("baseline", body["simulated"]["strategies"])


if __name__ == "__main__":
    unittest.main()
