"""Step 5 tests: additive /api/hospital fields and GET /api/incidents/severities agree with the engine."""
import csv
import unittest

from fastapi.testclient import TestClient

from backend.api.engine_bridge import DATA_DIR, bottom_up, engine_audit, portfolio_model, risk_model
from backend.api.main import app

ORIGINAL_HOSPITAL_KEYS = {
    "model_status", "data_status", "sources", "hospital_profile", "ransomware_scenarios",
    "assets", "security_controls", "mappings",
}


def _csv(name):
    with (DATA_DIR / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


class HospitalExtensionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.body = TestClient(app).get("/api/hospital").json()

    def test_backward_compatible(self):
        self.assertTrue(ORIGINAL_HOSPITAL_KEYS.issubset(self.body))
        self.assertIn("control_stage_mapping", self.body["mappings"])
        self.assertIn("investment_asset_mapping", self.body["mappings"])

    def test_stage_probabilities_match_engine_loader(self):
        model = {m["scenario_id"]: m for m in self.body["attack_stage_model"]}
        scenarios = risk_model.load_scenarios()
        self.assertEqual(set(model), {s.id for s in scenarios})
        attrs = {"initial_access": "access", "deployment": "deployment", "major_spread": "spread",
                 "severe_given_major_spread": "severe_given_spread"}
        for s in scenarios:
            m = model[s.id]
            self.assertEqual(m["relevant_attempts_per_year"], s.attempts_per_year)
            self.assertEqual([st["stage"] for st in m["stages"]], list(attrs))
            for st in m["stages"]:
                tri = getattr(s, attrs[st["stage"]])
                self.assertEqual((st["low"], st["mode"], st["high"]), (tri.low, tri.mode, tri.high))
                self.assertAlmostEqual(st["triangular_mean"], portfolio_model.tri_mean(tri))
            self.assertEqual(
                [st["conditional_on"] for st in m["stages"]],
                ["relevant attempt", "initial access", "ransomware deployment", "major spread"],
            )

    def test_severity_branches_match_audit(self):
        audit = {s["scenario_id"]: s for s in engine_audit.audit()["scenarios"]}
        for m in self.body["attack_stage_model"]:
            a = audit[m["scenario_id"]]
            self.assertAlmostEqual(m["expected_deployments_per_year"], a["expected_deployments_per_year"])
            for sev, w in a["severity_weights_given_deployment"].items():
                self.assertAlmostEqual(m["severity_branch_weights_given_deployment"][sev], w)
            self.assertAlmostEqual(sum(m["severity_branch_weights_given_deployment"].values()), 1.0)

    def test_raw_source_tables(self):
        for key, name in [("attack_stage_parameters", "risk_parameters.csv"),
                          ("severity_parameters", "severity_parameters.csv"),
                          ("clinical_reputation_indicators", "clinical_reputation_indicators.csv")]:
            raw = _csv(name)
            self.assertEqual(len(self.body[key]), len(raw), key)
            self.assertEqual(list(self.body[key][0]), list(raw[0]), key)
        self.assertIn("descriptive only", self.body["severity_parameters_note"])


class SeverityEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = TestClient(app).get("/api/incidents/severities")
        assert r.status_code == 200, r.text
        cls.body = r.json()
        cls.by_sev = {s["severity"]: s for s in cls.body["severities"]}

    def test_shape(self):
        self.assertEqual(self.body["result_type"], "engine_per_incident_by_severity")
        self.assertEqual(list(self.by_sev), ["contained", "major", "severe"])
        self.assertTrue(any("not calibrated separately" in n for n in self.body["notes"]))

    def test_breakdown_matches_engine(self):
        for sev, item in self.by_sev.items():
            engine = bottom_up.breakdown(sev)
            api = item["bottom_up_breakdown"]
            self.assertEqual(set(api["components_usd"]), set(engine["components_usd"]))
            for k, v in engine["components_usd"].items():
                self.assertAlmostEqual(api["components_usd"][k], v, places=6, msg=f"{sev}/{k}")
            for k in ("days", "daily_encounters", "affected_encounters", "cancelled_encounters", "unrecovered_encounters"):
                self.assertAlmostEqual(api[k], engine[k], places=6)
            self.assertEqual(item["cost_drivers"], bottom_up.drivers()["severity"][sev])

    def test_loss_ranges_and_expected_match_engine(self):
        losses = risk_model.load_losses()
        audit = engine_audit.audit()["loss_components_by_severity"]
        for sev, item in self.by_sev.items():
            for k, t in losses[sev].items():
                d = item["loss_distribution_usd"][k]
                self.assertAlmostEqual(d["low"], t.low)
                self.assertAlmostEqual(d["mode"], t.mode)
                self.assertAlmostEqual(d["high"], t.high)
                # Central breakdown estimate is the triangular mode.
                self.assertAlmostEqual(d["mode"], item["bottom_up_breakdown"]["components_usd"][k] * self.body["loss_variability"]["mode_factor"])
            self.assertAlmostEqual(item["expected_loss_per_incident"]["expected_loss_per_incident_usd"],
                                   audit[sev]["expected_loss_per_incident_usd"])

    def test_recovery_and_clinical_match_engine(self):
        recovery = risk_model.load_recovery()
        clinical = risk_model.load_clinical()
        for sev, item in self.by_sev.items():
            r = recovery[sev]
            self.assertEqual((item["recovery_days"]["low"], item["recovery_days"]["mode"], item["recovery_days"]["high"]),
                             (r.low, r.mode, r.high))
            for k, t in clinical[sev].items():
                self.assertEqual(item["clinical_indicators"][k]["mode"], t.mode)
            self.assertEqual(item["source_severity_parameters"]["severity_id"], sev)
            self.assertIn("trust_recovery_months_mode", item["source_clinical_reputation_indicators"])


if __name__ == "__main__":
    unittest.main()
