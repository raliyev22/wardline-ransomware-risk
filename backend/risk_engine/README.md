# Healthcare Ransomware Risk Engine v4 — bottom-up cost model (synthetic)

**Status: computational prototype, NOT empirically calibrated.** v4 preserves v3's attack probabilities, control effects, clinical indicators, budget constraints, and optimizer. It replaces the eight severity-specific financial loss amounts with **calculated amounts** from `data/bottom_up_cost_drivers.json`. The old `data/loss_parameters.csv` is preserved for comparison, but is no longer used in v4 simulations.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s tests -v
python3 bottom_up_audit.py > bottom_up_audit_report.json
python3 optimize.py --years 20000 --seed 2026 --ciso I01 I04 I06
```

## Eight cost equations

- **Restoration:** restored systems × engineering hours/system × hourly engineering rate + external recovery days × daily fee + replaced servers × unit replacement cost.
- **Response:** response specialists × hours/specialist × hourly specialist rate + forensic retainer.
- **Interruption:** annual encounters / 365 × disrupted days × affected fraction × cancelled fraction × unrecovered fraction × contribution margin per encounter. Only unrecovered services count; no gross revenue double counting.
- **Continuity:** disruption days × capacity factor × incremental temporary-care capacity cost/day. Distinct from lost encounter contribution.
- **Notification:** exposed records × per-record notice cost, multiplied by severity-dependent breach/exposure probability **once** in the existing engine.
- **Legal:** incident-specific counsel hours × hourly rate. No automatic HIPAA fine.
- **Reputation:** future distinct encounters lost × probability of lasting volume reduction × contribution margin per encounter. Excludes immediate service interruptions.
- **Extra staffing:** staff × overtime hours/day × disrupted days × incremental overtime rate. Excludes standard salaried hours.

Each bottom-up point estimate becomes the mode of a triangular distribution using low ×0.65 and high ×1.55 multipliers. This uncertainty band is an *assumption*, not statistical evidence. The mean is therefore 1.0667× the central formula. The existing notification gate and control-effect multipliers are retained. See `bottom_up_audit.py` for the full calculation trace and v3 comparisons.

## Important limitations to fix before deployment

1. **Costs are not sourced:** hospital activity figures are fictional; hourly rates, contribution margins, counts, and costs are synthetic and need external sources, vendor quotations or sensitivity justification. No claim of real-world precision.
2. **Duration-cost coupling is incomplete:** bottom-up financial amounts use central severity duration; stochastic recovery-day indicators are sampled separately. We should couple the same incident duration draw to financial loss before finalizing the Monte Carlo.
3. **Cost uncertainty:** common arbitrary 0.65/1.55 triangular bands do not capture correlations, inflation, regional differences, or the possibility of large breach liabilities.
4. **Budget:** $2M is first-year cash, capex plus first-year opex. Three-year straight-line annualization is for comparison only, not cash flow.
5. **Clinical guardrails:** board-defined synthetic policy examples, not healthcare standards. The model does not monetize patient harm.
6. **Reputational loss:** future patient-volume decline must be mutually exclusive with the immediate cancelled-service loss. No speculative valuation of deaths or injuries.
7. **Investment prices:** v3 costs still synthetic lump sums. A future pass should similarly decompose each into licenses, labor, devices, consulting and maintenance.
8. **RTO/dependency graph:** asset dependencies may be cyclic and should be corrected or modeled as a directed network before using them for propagation.
9. **Data lineage:** no hospital-specific data, historical incident logs, or external validation. Model optimization results are conditional on assumptions and should be accompanied by sensitivity analysis.

Do not deploy or present these figures as empirically validated forecasts.

## V5 additions
See `README_V5.md` for incident-duration coupling, deterministic stress tests,
limitations, and run commands. Run `python3 sensitivity.py` for the stress report.
