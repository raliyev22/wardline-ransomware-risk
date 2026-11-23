import unittest
from engine.risk_model import load_scenarios, load_losses
from engine.monte_carlo import simulate

class ModelTests(unittest.TestCase):
    def test_scenarios(self):
        scenarios = load_scenarios()
        self.assertEqual(len(scenarios), 3)
        self.assertEqual(sum(s.attempts_per_year for s in scenarios), 19)

    def test_losses(self):
        self.assertEqual(set(load_losses()), {"contained", "major", "severe"})
        self.assertTrue(all(len(v) == 8 for v in load_losses().values()))

    def test_reproducible(self):
        a = simulate(1000, 11)
        b = simulate(1000, 11)
        self.assertEqual(a.mean_annual_loss_usd, b.mean_annual_loss_usd)
        self.assertGreaterEqual(a.p95_annual_loss_usd, a.p90_annual_loss_usd)
        self.assertGreaterEqual(a.p90_annual_loss_usd, a.median_annual_loss_usd)
        self.assertTrue(0 <= a.probability_any_disruptive_event <= 1)

if __name__ == "__main__":
    unittest.main()
