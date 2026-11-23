"""Risk Analytics API tests: stress tests, parameter report, FAIR fields, stress-aware optimizer."""
import json
import unittest

from fastapi.testclient import TestClient

from backend.api import planner
from backend.api.engine_bridge import RISK_ENGINE_DIR, engine_audit, engine_sensitivity, investments, portfolio_model
from backend.api.main import app


class _Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)


class StressOptimizerTests(unittest.TestCase):
    def test_enumeration_matches_optimize_under_every_stress(self):
        budget = investments.config()["budget_first_year_cash_usd"]
        for key, (r, l, e) in engine_sensitivity.STRESSES.items():
            engine = portfolio_model.optimize(r, l, e)
            enum = planner.optimize_by_enumeration(budget, r, l, e)
            for k, v in engine.items():
                if k != "method":
                    self.assertEqual(enum[k], v, f"{key}/{k}")


class StressEndpointTests(_Base):
    def test_cases_match_engine(self):
        ids = ("I01", "I04", "I06")
        r = self.client.post("/api/sensitivity/stress", json={"investment_ids": list(ids)})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual([c["key"] for c in body["cases"]], list(engine_sensitivity.STRESSES))
        self.assertIn("not confidence", body["note"])
        cost = investments.spending(ids)
        for c in body["cases"]:
            r_, l_, e_ = engine_sensitivity.STRESSES[c["key"]]
            self.assertEqual(c["multipliers"], {"attack_attempt_frequency": r_, "incident_financial_losses": l_, "control_effectiveness": e_})
            base = portfolio_model.expected_metrics((), r_, l_, e_)
            mine = portfolio_model.expected_metrics(ids, r_, l_, e_)
            self.assertAlmostEqual(c["baseline_metrics"]["expected_annual_loss_usd"], base["expected_annual_loss_usd"], places=6)
            self.assertAlmostEqual(c["portfolio_metrics"]["expected_annual_loss_usd"], mine["expected_annual_loss_usd"], places=6)
            self.assertAlmostEqual(c["portfolio_net_benefit_usd"],
                                   base["expected_annual_loss_usd"] - mine["expected_annual_loss_usd"] - cost["annualized_spend_usd"], places=6)
            opt = portfolio_model.optimize(r_, l_, e_)
            self.assertEqual(c["optimized"]["selected_investments"], opt["selected_investments"])

    def test_matches_engine_sensitivity_run_for_central_portfolio(self):
        """Engine's own sensitivity.run() robustness numbers are reproduced for the central optimum."""
        run = engine_sensitivity.run()["results"]
        central = run["central"]["portfolio"]
        body = self.client.post("/api/sensitivity/stress", json={"investment_ids": central}).json()
        for c in body["cases"]:
            eng = run["central_portfolio_robustness"][c["key"]]
            self.assertAlmostEqual(c["portfolio_net_benefit_usd"], eng["annual_net_benefit_usd"], places=6)
            self.assertEqual(c["portfolio_guardrails_satisfied"], eng["clinical_guardrails_satisfied"])
            self.assertEqual(c["optimized"]["selected_investments"], run[c["key"]]["portfolio"])

    def test_low_budget_reports_no_eligible(self):
        body = self.client.post("/api/sensitivity/stress", json={"investment_ids": [], "budget_usd": 300000}).json()
        cases = {c["key"]: c for c in body["cases"]}
        # Central case: nothing within $300K meets the guardrails.
        self.assertEqual(cases["central"]["optimized"]["status"], "no_eligible_portfolio")
        self.assertIn("clinical guardrails", cases["central"]["optimized"]["message"])
        # Under stronger assumed control effects, I06 alone ($220K) becomes eligible (engine result).
        self.assertEqual(cases["stronger_control_effects"]["optimized"]["selected_investments"], ["I06"])
        # No central optimum to compare against, so the change flag is undefined.
        self.assertTrue(all(c["optimized"]["differs_from_central_optimum"] is None for c in body["cases"]))
        for key, c in cases.items():
            if c["optimized"]["status"] == "optimal":
                r, l, e = engine_sensitivity.STRESSES[key]
                self.assertEqual(c["optimized"]["selected_investments"],
                                 planner.optimize_by_enumeration(300000, r, l, e)["selected_investments"])

    def test_validation(self):
        self.assertEqual(self.client.post("/api/sensitivity/stress", json={"investment_ids": ["I08"]}).status_code, 400)
        self.assertEqual(self.client.post("/api/sensitivity/stress", json={"investment_ids": [], "budget_usd": 3_000_000}).status_code, 400)


class ParameterReportTests(_Base):
    def test_report_served_and_current(self):
        body = self.client.get("/api/sensitivity/parameters").json()
        self.assertEqual(body["result_type"], "engine_parameter_sensitivity_report")
        stored = json.loads((RISK_ENGINE_DIR / "parameter_sensitivity_report.json").read_text())
        self.assertEqual(body["report"], stored)
        # The stored engine report must equal a fresh run (run here, single-threaded, never in the server).
        import parameter_sensitivity
        self.assertEqual(json.loads(json.dumps(parameter_sensitivity.run())), stored)


class FairFieldTests(_Base):
    def test_attack_stage_model_fair_fields_match_audit(self):
        model = {m["scenario_id"]: m for m in self.client.get("/api/hospital").json()["attack_stage_model"]}
        audit = engine_audit.audit()
        for s in audit["scenarios"]:
            m = model[s["scenario_id"]]
            self.assertAlmostEqual(m["mean_loss_per_deployment_usd"], s["mean_loss_per_deployment_usd"], places=6)
            self.assertAlmostEqual(m["expected_annual_loss_contribution_usd"], s["expected_annual_loss_contribution_usd"], places=6)
        total = sum(m["expected_annual_loss_contribution_usd"] for m in model.values())
        self.assertAlmostEqual(total, portfolio_model.expected_metrics(())["expected_annual_loss_usd"], places=4)


if __name__ == "__main__":
    unittest.main()
