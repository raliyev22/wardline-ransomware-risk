"""API tests. Run from the project root:

    backend/.venv/bin/python -m unittest discover -s backend/api/tests -t . -v
"""
import csv
import json
import unittest

from fastapi.testclient import TestClient

from backend.api.engine_bridge import DATA_DIR, comparison, investments, portfolio_model
from backend.api.main import app
from backend.api.tests import IsolatedRunHistory

# Known v5+ analytic baseline asserted by the engine's own tests (tests/test_validation_v5.py).
ENGINE_BASELINE_LOSS = 3096077.59614706


class _Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def assertMetricsEqual(self, api: dict, engine: dict):
        self.assertEqual(set(api), set(engine))
        for key, value in engine.items():
            self.assertAlmostEqual(api[key], value, places=6, msg=key)


class HealthAndDataTests(_Base):
    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "ok")
        self.assertTrue(body["synthetic_model"])
        self.assertTrue(body["engine_path_found"])
        self.assertEqual(body["engine_version"], "v8")

    def test_hospital_preserves_sources(self):
        r = self.client.get("/api/hospital")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        profile = json.loads((DATA_DIR / "hospital_profile.json").read_text())
        scenarios = json.loads((DATA_DIR / "ransomware_scenarios.json").read_text())
        self.assertEqual(body["hospital_profile"], profile)
        self.assertEqual(body["ransomware_scenarios"], scenarios)
        for key, filename in [("assets", "assets.csv"), ("security_controls", "security_controls.csv")]:
            with (DATA_DIR / filename).open(newline="", encoding="utf-8") as f:
                raw = list(csv.DictReader(f))
            self.assertEqual(len(body[key]), len(raw))
            self.assertEqual(list(body[key][0]), list(raw[0]))  # same fields, same order
            self.assertEqual([r[next(iter(raw[0]))] for r in body[key]], [r[next(iter(raw[0]))] for r in raw])
        self.assertIn("control_stage_mapping", body["mappings"])
        self.assertIn("investment_asset_mapping", body["mappings"])
        self.assertEqual(body["assets"][0]["target_rto_hours"], 4)  # numeric cells typed

    def test_investments(self):
        r = self.client.get("/api/investments")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        catalog = investments.investments()
        cfg = investments.config()
        self.assertEqual([i["id"] for i in body["investments"]], sorted(catalog))
        for item in body["investments"]:
            self.assertEqual(item["capex_usd"], catalog[item["id"]].capex)
            self.assertEqual(item["annual_opex_usd"], catalog[item["id"]].annual_opex)
        self.assertEqual(body["budget"]["budget_first_year_cash_usd"], cfg["budget_first_year_cash_usd"])
        self.assertEqual(body["clinical_constraints"], cfg["optimization"]["clinical_safety"])
        deps = {d["investment_id"]: d["requires"] for d in body["dependencies"]}
        self.assertEqual(deps, {"I08": ["I03"]})  # discovered from validate_portfolio
        i08 = next(i for i in body["investments"] if i["id"] == "I08")
        self.assertEqual(i08["requires"], ["I03"])


class AnalyticTests(_Base):
    def test_baseline_matches_engine(self):
        r = self.client.get("/api/risk/baseline")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["result_type"], "analytic")
        self.assertMetricsEqual(body["metrics"], portfolio_model.expected_metrics(selected=()))
        self.assertAlmostEqual(body["metrics"]["expected_annual_loss_usd"], ENGINE_BASELINE_LOSS, places=4)

    def test_evaluate_matches_engine(self):
        r = self.client.post("/api/portfolio/evaluate", json={"investment_ids": ["I06", "I01", "I04"]})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        selected = ("I01", "I04", "I06")
        self.assertEqual(body["investment_ids"], list(selected))
        engine = portfolio_model.expected_metrics(selected=selected)
        base = portfolio_model.expected_metrics(selected=())
        cost = investments.spending(selected)
        self.assertMetricsEqual(body["metrics"], engine)
        self.assertMetricsEqual(body["baseline_metrics"], base)
        self.assertEqual(body["spending"]["capex_usd"], cost["capex_usd"])
        self.assertAlmostEqual(body["spending"]["annualized_spend_usd"], cost["annualized_spend_usd"])
        avoided = base["expected_annual_loss_usd"] - engine["expected_annual_loss_usd"]
        self.assertAlmostEqual(body["expected_annual_avoided_loss_usd"], avoided, places=6)
        self.assertAlmostEqual(body["expected_annual_net_benefit_usd"], avoided - cost["annualized_spend_usd"], places=6)
        self.assertIn("satisfied", body["clinical_guardrails"])

    def test_evaluate_empty_portfolio_is_baseline(self):
        r = self.client.post("/api/portfolio/evaluate", json={"investment_ids": []})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertAlmostEqual(body["expected_annual_avoided_loss_usd"], 0.0)
        self.assertEqual(body["spending"]["first_year_cash_usd"], 0)

    def test_optimize_matches_engine(self):
        r = self.client.get("/api/portfolio/optimize")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        engine = portfolio_model.optimize()
        self.assertEqual(body["selected_investments"], engine["selected_investments"])
        info = body["optimization"]
        for key in ("evaluated_feasible_portfolios", "clinical_eligible_portfolios", "method"):
            self.assertEqual(info[key], engine[key])
        for key in ("expected_annual_loss_usd", "expected_annual_avoided_loss_usd",
                    "expected_annual_net_benefit_usd", "baseline_expected_annual_loss_usd"):
            self.assertAlmostEqual(info[key], engine[key], places=6)
        for key in ("capex_usd", "annual_opex_usd", "first_year_cash_usd"):
            self.assertEqual(body["spending"][key], engine[key])
        self.assertAlmostEqual(body["metrics"]["expected_annual_loss_usd"], engine["expected_annual_loss_usd"], places=6)


class ValidationTests(_Base):
    def _assert_invalid(self, ids, fragment):
        for path, extra in (("/api/portfolio/evaluate", {}), ("/api/simulate", {"years": 10})):
            r = self.client.post(path, json={"investment_ids": ids, **extra})
            self.assertEqual(r.status_code, 400, (path, r.text))
            detail = r.json()["detail"]
            self.assertEqual(detail["error"], "invalid_portfolio")
            self.assertIn(fragment, detail["message"])
            self.assertEqual(detail["investment_ids"], ids)

    def test_dependency_violation(self):
        self._assert_invalid(["I08"], "requires I03")

    def test_budget_violation(self):
        # Dependency satisfied but first-year cash (2.26M) exceeds the 2M budget.
        self._assert_invalid(["I01", "I03", "I04", "I08"], "budget")

    def test_unknown_and_duplicate(self):
        self._assert_invalid(["I99"], "unknown")
        self._assert_invalid(["I01", "I01"], "Duplicate")

    def test_pydantic_validation(self):
        bad = [
            {"investment_ids": ["I01"], "years": 0},
            {"investment_ids": ["I01"], "years": 50001},
            {"investment_ids": ["I01"], "seed": -1},
            {"investment_ids": ["I01"], "uncertainty_mode": "bogus"},
            {"investment_ids": "I01"},
            {"investment_ids": ["I01"], "unexpected": 1},
        ]
        for payload in bad:
            r = self.client.post("/api/simulate", json=payload)
            self.assertEqual(r.status_code, 422, payload)

    def test_cors_localhost_3000(self):
        r = self.client.options("/api/simulate", headers={
            "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["access-control-allow-origin"], "http://localhost:3000")
        r = self.client.get("/api/health", headers={"Origin": "http://evil.example"})
        self.assertNotIn("access-control-allow-origin", r.headers)


class SimulationTests(IsolatedRunHistory, _Base):
    def test_simulate_matches_compare(self):
        for mode in ("central", "epistemic_draw"):
            payload = {"investment_ids": ["I01", "I04", "I06"], "years": 2000, "seed": 123, "uncertainty_mode": mode}
            r = self.client.post("/api/simulate", json=payload)
            self.assertEqual(r.status_code, 200, r.text)
            body = r.json()
            optimized = tuple(portfolio_model.optimize()["selected_investments"])
            expected = comparison.compare(2000, 123, {"baseline": (), "ciso": ("I01", "I04", "I06"),
                                                      "optimized": optimized}, uncertainty_mode=mode)
            sim = body["simulated"]
            self.assertEqual(sim["result_type"], "simulated_monte_carlo")
            self.assertEqual(body["analytic"]["result_type"], "analytic")
            self.assertEqual((sim["years"], sim["seed"], sim["uncertainty_mode"]), (2000, 123, mode))
            self.assertEqual(set(sim["strategies"]), {"baseline", "ciso", "optimized"})
            self.assertEqual(body["portfolios"]["optimized"], list(optimized))
            for label, engine in expected["strategies"].items():
                api = sim["strategies"][label]
                self.assertEqual(set(api), set(engine), label)
                for key, value in engine.items():
                    if isinstance(value, float):
                        self.assertAlmostEqual(api[key], value, places=6, msg=f"{mode}/{label}/{key}")
                    else:
                        self.assertEqual(api[key], value, f"{mode}/{label}/{key}")

    def test_simulate_defaults_and_analytic_block(self):
        r = self.client.post("/api/simulate", json={"investment_ids": ["I04"], "years": 500})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["simulated"]["seed"], 2026)
        self.assertEqual(body["simulated"]["uncertainty_mode"], "central")
        self.assertMetricsEqual(body["analytic"]["ciso_metrics"], portfolio_model.expected_metrics(selected=("I04",)))
        # Same seed => reproducible.
        again = self.client.post("/api/simulate", json={"investment_ids": ["I04"], "years": 500}).json()
        self.assertEqual(body, again)

    def test_default_years(self):
        from backend.api.schemas import SimulationRequest
        req = SimulationRequest(investment_ids=["I01"])
        self.assertEqual((req.years, req.seed, req.uncertainty_mode), (20000, 2026, "central"))


if __name__ == "__main__":
    unittest.main()
