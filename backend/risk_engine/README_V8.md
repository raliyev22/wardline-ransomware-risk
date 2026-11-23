# Engine v8 — individual parameter sensitivity

Retains v7 source data and adds `parameter_sensitivity.py`. It tests 12 conditional attack probabilities and 16 investment CAPEX/OPEX parameters, one at a time, at 0.5x and 1.5x baseline. Changes are in-memory only. Reports optimal portfolio, central portfolio net benefit, regret, and budget/clinical eligibility. Infeasible central portfolios have null regret, rather than a misleading numerical comparison.

Run:
```
python3 -m unittest discover -s tests -v
python3 parameter_sensitivity.py --output parameter_sensitivity_report.json
```

All assumptions remain synthetic. Stress factors are illustrative, not empirically calibrated uncertainty bounds.
