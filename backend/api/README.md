# Decision-support API (Step 2)

FastAPI runs the v8 engine in `backend/risk_engine/`, validates inputs and saves chart summaries from the same annual draws used by the engine. All hospital data and results are synthetic and illustrative.

## Setup and run (from the project root)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/uvicorn backend.api.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs. CORS allows `http://localhost:3000` and `http://127.0.0.1:3000`.

## Tests

```bash
backend/.venv/bin/python -m unittest discover -s backend/api/tests -t . -v
cd backend/risk_engine && ../.venv/bin/python -m unittest discover -s tests -v
```

## Endpoints

| Method | Path | Engine source | Result type |
|---|---|---|---|
| GET | `/api/health` | — | status |
| GET | `/api/hospital` | data files: profile, scenarios, assets, controls, mappings | source data |
| GET | `/api/investments` | `investments.investments()`, `investments.config()`; prerequisites discovered through `validate_portfolio` | catalog |
| GET | `/api/risk/baseline` | `portfolio_model.expected_metrics(selected=())` | analytic |
| POST | `/api/portfolio/evaluate` | `validate_portfolio`, `expected_metrics`, `spending` | analytic |
| GET | `/api/portfolio/optimize` | `portfolio_model.optimize()` | analytic |
| POST | `/api/simulate` | `validate_portfolio`, `optimize`, `comparison.compare()` | simulated + analytic |
| GET | `/api/dashboard/runs` | Local simulation history | Completed run IDs, times and settings, newest first |
| GET | `/api/dashboard/runs/{run_id}` | Saved run | Portfolio snapshots, FAIR metrics and horizon distributions |
| POST | `/api/dashboard/runs` | Same request and computation as `/api/simulate` | Create and return one completed dashboard run |
| POST | `/api/portfolio/marginals` | `validate_portfolio`, `expected_metrics`, `spending`, `effects` for each add/remove variant | analytic |
| POST | `/api/sensitivity/stress` | `sensitivity.STRESSES` with `expected_metrics(selected, risk, loss, efficacy)` and the budget-aware optimizer | analytic, hypothetical stress cases |
| GET | `/api/sensitivity/parameters` | serves the engine-generated `parameter_sensitivity_report.json` as-is (a test checks it equals a fresh `parameter_sensitivity.run()`) | engine report |
| GET | `/api/incidents/severities` | `bottom_up.breakdown/drivers`, `risk_model.load_losses/load_recovery/load_clinical`, `audit.audit()` | modeled per incident, by severity |

**Step 5 additions to `/api/hospital`.** These fields are new and the existing fields are unchanged:
- `attack_stage_parameters`, `severity_parameters`, `clinical_reputation_indicators`: the raw source CSVs.
- `attack_stage_model`: per scenario, from `risk_model.load_scenarios` and `audit.audit()`. Includes the conditional stage probabilities with low, mode, high and triangular mean, plus expected deployments per year and the severity branch weights given deployment.

The severity probabilities in `severity_parameters.csv` are descriptive only. The engine derives severity from the stage branches instead.

**Investment Planner additions.** These are additive; default requests behave exactly as before.
- **`budget_usd` request field.** Optional on evaluate, marginals and simulate. Must be at most the engine's $2,000,000 first-year cash budget; larger values return 400 `invalid_budget`.
- **`GET /api/portfolio/optimize?budget_usd=`**
  - At the engine budget it calls `portfolio_model.optimize()` directly.
  - At a lower budget it uses the same portfolios, scoring, clinical guardrails and tie-break, restricted to first-year cash ≤ budget (see `planner.py`). A test confirms this reproduces `optimize()` exactly at $2M.
  - If nothing qualifies it returns **409** `no_eligible_portfolio`, with an explanation and the lowest first-year cash of any eligible portfolio.
- **`POST /api/simulate` with a low budget.** If no optimized portfolio qualifies it still runs baseline and CISO, sets `optimization_status: "no_eligible_portfolio"`, and leaves out the optimized strategy.
- **Evaluate response, new fields:**
  - `effects`: the output of `investments.effects()`, annotated with which investment's effect applies and which are superseded under the strongest-only overlap rule.
  - `budget`: remaining budget, and whether the selection is within the selected budget.

Request bodies:

```json
POST /api/portfolio/evaluate  {"investment_ids": ["I01", "I04", "I06"]}
POST /api/simulate            {"investment_ids": ["I01", "I04", "I06"], "years": 20000, "seed": 2026, "uncertainty_mode": "central"}
```

`years` must be 1–50000 and `uncertainty_mode` is `central` or `epistemic_draw`. An invalid selection (unknown or duplicate ID, I08 without I03, or over the first-year cash budget) returns **400** with `{"detail": {"error": "invalid_portfolio", "message": <engine message>, "investment_ids": [...]}}`. A malformed body returns **422**.

`/api/simulate` returns Monte Carlo output under `simulated` (`result_type: "simulated_monte_carlo"`) and the analytic expected values plus optimizer details under `analytic` (`result_type: "analytic"`). Keep the two labelled separately in any UI.

## Notes

- The legacy `monte_carlo.simulate()` is not used.
- Endpoints run synchronously in FastAPI's thread pool. A 50,000-year simulation took under 0.5 s locally.
- The clinical-guardrail check in `/api/portfolio/evaluate` applies the same thresholds and rule as `portfolio_model.optimize`, read from `optimization_config.json`.
