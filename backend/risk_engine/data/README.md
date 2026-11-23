# Dataset Package 4 — Security investment and effectiveness

This package connects to the control IDs C01–C08 and asset IDs A01–A06 in Package 1 and the scenario IDs in Package 2. All costs and effectiveness estimates are **synthetic illustrative assumptions**, not empirically validated.

## Files
- `security_investments.csv`: 8 selectable projects with capital costs, incremental recurring costs, implementation times and target control coverage.
- `control_effectiveness.csv`: scenario-stage-specific effect sizes at full implementation. Reduction values are **relative** (0.30 means 30% reduction of the affected baseline conditional parameter, not 30 percentage points).
- `investment_asset_mapping.csv`: investment-to-asset relationships; these do not imply additive asset-level loss savings.
- `optimization_config.json`: cost horizon, conservative overlap policy, budget constraint, objective and safeguards.

## Important limitations
1. The `control_effectiveness.csv` figures are **not outputs** from FAIR or Monte Carlo. They are inputs to be justified by sensitivity tests.
2. C01 and C07 overlap, so I01 has one combined identity effect. I01 and I05 both touch vendor identity; apply conservative strongest-effect handling until a better combined model is calibrated.
3. I03 and I08 share segmentation infrastructure; I08 is a targeted IoMT isolation project, not a second global segmentation multiplier. I08 depends on I03 in this first version.
4. I04 and I07 both affect recovery duration. Do not stack naively.
5. For optimization use upfront capex for budget feasibility, and separately show annualized cost and first-year cash outlay.
6. Clinical impacts must be displayed separately and considered in clinical-safety constraints or a documented multi-objective analysis.
7. Coverage percentages are descriptive operational metrics; changes only influence the model through explicitly defined response functions.
8. No computed expected loss or optimized recommendation is claimed here; the Monte Carlo engine is the next phase.
