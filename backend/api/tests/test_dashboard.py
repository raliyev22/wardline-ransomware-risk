from contextlib import closing
import json
import os
import sqlite3
import unittest

import numpy as np
from fastapi.testclient import TestClient

from backend.api.dashboard import summarize_periods
from backend.api.main import app
from backend.api.tests import IsolatedRunHistory


class DashboardTests(IsolatedRunHistory, unittest.TestCase):
    def test_saved_plan_budget_warning_for_new_and_older_runs(self):
        client = TestClient(app)
        url = "/api/dashboard/runs"
        args = {"years": 20, "investment_ids": ["I01", "I02", "I03", "I06"]}
        response = client.post(url, json={**args, "budget_usd": 500_000})
        self.assertEqual(response.status_code, 201)
        run = response.json()
        self.assertEqual(run["ciso_first_year_cash_usd"], 1_845_000)
        self.assertEqual(run["ciso_over_budget_usd"], 1_345_000)
        run_url = f"{url}/{run['id']}"
        self.assertEqual(client.get(run_url).json(), run)

        with closing(sqlite3.connect(os.environ["WARDLINE_RUN_DATABASE"])) as conn, conn:
            (raw_report,) = conn.execute("SELECT report FROM runs WHERE id = ?", (run["id"],)).fetchone()
            report = json.loads(raw_report)
            del report["ciso_first_year_cash_usd"]
            del report["ciso_over_budget_usd"]
            conn.execute("UPDATE runs SET report = ? WHERE id = ?", (json.dumps(report), run["id"]))
        self.assertEqual(client.get(run_url).json(), run)

        response = client.post(url, json={**args, "budget_usd": 2_000_000})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["ciso_first_year_cash_usd"], 1_845_000)
        self.assertEqual(response.json()["ciso_over_budget_usd"], 0)

    def test_period_boundaries_and_partial_years(self):
        charts = summarize_periods(np.array([0, 500_000, 0, 200_000, 800_000, 0, 0]),
                                   np.array([0, 1, 0, 1, 2, 0, 0]))
        self.assertEqual(charts[1]["loss_counts"][:3], [4, 1, 2])
        self.assertEqual(charts[3]["periods"], 2)
        self.assertEqual(charts[3]["incident_counts"], [0, 1, 0, 1])
        self.assertEqual(charts[3]["mean_loss_usd"], 750_000)
        self.assertEqual(charts[5]["mean_loss_usd"], 1_500_000)
        self.assertEqual(list(summarize_periods(np.zeros(1), np.zeros(1, dtype=int))), [1])

    def test_longer_horizon_percentiles_use_grouped_losses(self):
        annual_loss = np.repeat([100, 300, 500], 10)
        annual_loss = np.append(annual_loss, 1_000_000)
        charts = summarize_periods(annual_loss, np.ones(len(annual_loss), dtype=int))
        ten_year = charts[10]
        self.assertEqual(ten_year["periods"], 3)
        self.assertEqual(ten_year["mean_loss_usd"], 3_000)
        self.assertEqual(ten_year["median_loss_usd"], 3_000)
        self.assertEqual(ten_year["p90_loss_usd"], 4_600)
        self.assertEqual(ten_year["p95_loss_usd"], 4_800)
        self.assertEqual(charts[30]["mean_loss_usd"], 9_000)
        self.assertNotIn(50, charts)

    def test_saved_run_matches_original_simulation_and_survives_reread(self):
        client = TestClient(app)
        url = "/api/dashboard/runs"
        self.assertEqual(client.get(url).json(), [])
        args = {"years": 503, "seed": 19, "investment_ids": ["I06"], "budget_usd": 300_000}
        result = client.post("/api/simulate", json=args).json()
        summary, = client.get(url).json()
        detail = client.get(f"{url}/{summary['id']}").json()
        horizons = result["simulated"]["baseline_horizons"]
        self.assertEqual(horizons["10"]["periods"], 50)
        self.assertEqual(horizons["10"]["p95_loss_usd"], detail["strategies"]["baseline"]["horizons"]["10"]["p95_loss_usd"])
        self.assertEqual(set(detail["strategies"]), {"baseline", "ciso"})
        for key, data in detail["strategies"].items():
            self.assertEqual(data["investments"], result["portfolios"][key])
            annual = data["horizons"]["1"]
            self.assertEqual(annual["mean_loss_usd"], result["simulated"]["strategies"][key]["mean_annual_loss_usd"])
            self.assertEqual(annual["p95_loss_usd"], result["simulated"]["strategies"][key]["p95_annual_loss_usd"])
            self.assertAlmostEqual(data["events_per_year"] * data["mean_loss_per_event_usd"], data["expected_annual_loss_usd"])
            for years, h in data["horizons"].items():
                self.assertEqual(h["periods"], args["years"] // int(years))
                self.assertEqual(sum(h["loss_counts"]), h["periods"])
                self.assertEqual(sum(h["incident_counts"]), h["periods"])
        created = client.post(url, json={**args, "seed": 2})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(client.get(url).json()[0]["id"], created.json()["id"])
        self.assertEqual(client.get(f"{url}/{summary['id']}").json(), detail)
        self.assertEqual(client.post(url, json={"years": 0}).status_code, 422)
        self.assertEqual(len(client.get(url).json()), 2)
        self.assertEqual(client.get(f"{url}/99999").status_code, 404)
