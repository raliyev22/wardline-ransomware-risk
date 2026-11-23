# Engine v7 — calibration prioritization and evidence intake

**Scope:** This is a rigorous *prioritization and evidence collection* release, NOT a completed empirical calibration. All 106 existing parameters remain synthetic. No model parameters or baseline forecasts are changed.

## New files
- `calibration.py`: ranks three broad stress levers using **portfolio regret** and lists two groups that require future parameter-level perturbations. Never changes model data.
- `calibration_priority_report.json`: generated audit of sensitivity and remaining evidence gaps.
- `calibration_intake_template.csv`: 106-row structured form for defensible, parameter-specific evidence.
- `tests/test_calibration_v7.py`: coverage, nonmutation, and evidence-review gates.

## Commands
```bash
python3 -m unittest discover -s tests -v
python3 calibration.py --output calibration_priority_report.json
python3 calibration.py --validate-intake calibration_intake_template.csv
```

The final validation command passes if no values have been proposed. If a row contains a proposed value, it requires a source/interview, population and denominator, measurement definition, transferability rationale, reviewer, numeric uncertainty bounds, and `review_status=approved`. Validation **does not apply values to the model**. An approved change must be implemented and regression-tested explicitly.

## Limitations
- Stress ranges are synthetic judgmental scenarios, not confidence or credible intervals.
- A multiplier applied to all attack attempts is not a measured per-scenario likelihood.
- Financial multiplier is not a validated estimate of per-category hospital costs.
- Control-effectiveness multiplier is not a clinical or causal effectiveness study.
- Portfolio regret at two endpoints is a triage heuristic, not a formal value-of-information estimate.
- Investment-cost and conditional-probability parameter-specific sensitivity remain incomplete.
- The model is for educational illustration, not actual clinical investment decisions.

## Next phase
Obtain matched source evidence and/or structured expert elicitation; approve a small number of high-leverage parameters, implement them in a new version, rerun tests and stress analyses, and document how recommendations changed.
