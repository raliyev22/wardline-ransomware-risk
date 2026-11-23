# Engine v6 — evidence governance (non-calibrating update)

This release preserves **all v5 simulation, optimization and financial model inputs**. It adds a traceable evidence register and parameter-level review crosswalk. **No numerical parameter is claimed to have been validated by the sources.**

## Files
- `evidence_sources.csv`: external primary/sector sources, precisely scoped claims and transferability warnings.
- `parameter_evidence_crosswalk.csv`: current inputs, evidence status, missing calibration and next steps.
- `governance.py`: machine-readable completeness/release gate report.
- `tests/test_governance_v6.py`: checks source and parameter traceability.

## Run
```bash
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s tests -v
python3 governance.py --output governance_report.json
python3 optimize.py --years 20000 --seed 2026 --ciso I01 I04 I06
```

## Evidence rules
1. Recommendations (HHS/CISA) support **control choice**, not a specific risk-reduction percentage.
2. Industry **data breach** averages (IBM) are not **ransomware event** means, conditional attack probabilities, or annual loss estimates.
3. The Change Healthcare incident illustrates operational and vendor concentration risk; do not scale its national losses down to this fictional hospital.
4. All monetary rates, incident quantities, attack frequencies, investment prices and effectiveness remain **synthetic** until validated with compatible observations or explicit stakeholder elicitation.
5. No automatic recalibration. Require provenance, population, denominator, date, currency basis and uncertainty justification before replacing an input.
6. Current objective uses synthetic guardrails and annualization. Governance report is a **release gate**, not a claim of real-world validity.

## Next step
Obtain credible compatible numerical evidence and structured expert elicitation for specific parameters. Then test calibration changes on a new branch and rerun robustness and financial reconciliation.
