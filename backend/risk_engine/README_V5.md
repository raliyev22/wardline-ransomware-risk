# Engine v5 — incident-level duration coupling and deterministic stress testing

Built from v4 without changing source assumptions. **Synthetic decision-support demonstration, not validated hospital risk forecasting.**

## What changed
- Monte Carlo samples a single recovery duration per incident, and uses it for interruption, continuity and overtime costs. Investment-driven recovery reductions also reduce these costs. This eliminates the v4 inconsistency between reported recovery days and time-dependent costs.
- The analytical model still uses expected duration and the same central cost basis, so analytical expected loss remains comparable to Monte Carlo in central mode. Financial components retain an independent synthetic triangular multiplier; it is NOT a measured confidence interval.
- `sensitivity.py` reruns the exhaustive optimizer under eight deterministic stress cases changing attempt frequency, all incident losses, and assumed control effectiveness. Stress factors are illustrative *what-if* inputs, not probability distributions or validated plausible bounds.
- Every portfolio is checked against first-year cash and clinical guardrails. Stress tests may change which portfolio is optimal.

## Run
```bash
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s tests -v
python3 optimize.py --years 20000 --seed 2026 --ciso I01 I04 I06
python3 sensitivity.py > sensitivity_report.json
```

## Remaining limitations before deployment
1. **Independent evidence** for unit rates, clinical volume assumptions, control efficacy and attempt frequency; don't call synthetic values externally validated.
2. **Clinical indicators** still drawn separately from duration; patient diversions/delays should eventually depend on impacted clinical services and outage duration.
3. **Correlations** between scenario attempts, severity, duration and costs are simplified. The common multiplier across financial components is not a measured correlation model.
4. **Optimization objective** annualized benefit assumes 3-year useful life, constant yearly risk and no discounting; cash constraints cover first year only.
5. **Stress tests** are deterministic one-factor and combined cases, not statistical confidence intervals or probability-weighted portfolio recommendations.
6. **Reputation** is estimated as future lost contribution, not measured trust or patient harm.
7. **No actual healthcare institution's confidential data** are used.
