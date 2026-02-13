# Deal Score Calibration Test Plan

## Purpose
After the scoring engine is live, run 5-10 known deals through it and compare Astra's score to your own gut assessment. This validates the benchmarks, thresholds, and weight distributions before you share the tool with anyone.

## Methodology

### Step 1: Pick Test Deals
Select 5-10 deals that span a range:

| # | Deal | Your Gut Rating | Why |
|---|------|-----------------|-----|
| 1 | Prose Gainesville | Moderate (50-60?) | New construction lease-up in oversupplied submarket. Good basis but supply risk. |
| 2 | A strong deal you've seen recently | High (75+) | Well-priced, good market, stable occupancy |
| 3 | A deal you passed on | Low (30-40) | Overpriced or bad market or both |
| 4 | A value-add deal | Moderate-High (60-70) | Good upside potential, some risk |
| 5 | A core/stabilized deal | High (70-80) | Low risk, fair pricing, strong market |

Ideally include:
- At least one lease-up / new construction
- At least one stabilized 90%+ occupied deal
- At least one deal in a secondary market (like Gainesville)
- At least one in a primary market (Buckhead, Midtown)
- At least one you think is overpriced

### Step 2: Input Data
For each deal, make sure the following data is in the system:

**Layer 1 inputs:**
- [ ] Economic occupancy (from OM or rent roll)
- [ ] OpEx ratio (from T-12 financials)
- [ ] Supply pipeline data uploaded for the submarket
- [ ] Submarket inventory entered

**Layer 3 inputs:**
- [ ] Sales comps uploaded covering the relevant market
- [ ] Subject property has cap rate and $/unit from OM

**Layer 2:**
- [ ] Market intel will run automatically via Claude + FRED

### Step 3: Score and Compare

For each deal, record:

```
Deal: _______________
Your gut score: ___/100
Astra score: ___/100
Delta: ___

Layer 1 (Fundamentals): ___/100
  - Econ Occupancy: ___ (raw score: ___)
  - OpEx Ratio: ___ (raw score: ___)
  - Supply Pipeline: ___ (raw score: ___)

Layer 2 (Market Intel): ___ adjustment
  - Rationale: ________________________

Layer 3 (Deal Comps): ___/100
  - Cap Rate vs Comps: ___ (spread: ___ bps)
  - $/Unit vs Comps: ___ (diff: __%)
  - Vintage Adj: ___
  - Comps used: ___ (relevance range: ___-___)
```

### Step 4: Identify Calibration Issues

Common problems and fixes:

| Problem | Symptom | Fix |
|---------|---------|-----|
| All scores clustered 45-55 | Not enough spread | Widen benchmark ranges or steepen scoring curves |
| Lease-up deals always score low | Occupancy tanking the score | Add lease-up context flag that uses Proforma occupancy with a discount |
| Supply pipeline dominating | Good deals in hot markets penalized | Reduce supply pipeline weight or soften the high end (>12% cap at 15 instead of 0) |
| Comp matching too loose | Irrelevant comps diluting averages | Tighten geographic/vintage matching (raise minimum relevance threshold from 0.10 to 0.20) |
| Comp matching too tight | Not enough comps, defaulting to 50 | Add more MSAs to comp data or relax vintage brackets |
| Market intel always neutral | Adjustment always 0-2 | Provide more structured data to the prompt, or use Opus instead of Sonnet |
| Good deal scored poorly | Layer 3 pulling it down because comps have higher cap rates | Check if comps are apples-to-apples (same vintage, size range) |
| Bad deal scored highly | Missing data causing weight redistribution to favorable layers | Ensure all three layers have data before trusting the score |

### Step 5: Tune

Based on patterns, adjust:

1. **Benchmark thresholds** — If 95% economic occupancy is scoring too low (e.g., 70/100), the "high" threshold may be too aggressive. Adjust from 93% to 92% or the "max" from 97% to 96%.

2. **Layer weights** — If Layer 3 is consistently the biggest driver and comps feel unreliable, reduce layer3_weight from 50 to 40 and redistribute.

3. **Scoring curves** — If the cap rate vs comps scoring feels too generous/harsh at certain spreads, adjust the bps breakpoints in score_cap_rate_vs_comps().

4. **Comp relevance threshold** — If too many distant/old comps are being included, raise the minimum relevance score from 0.10 to 0.20 or 0.25.

5. **Supply pipeline weighting** — If the status weights (lease-up 100%, UC 80%, proposed 30%) don't feel right, adjust. Proposed at 30% might be too aggressive for some markets where most proposed projects die.

### Step 6: Re-Run

After tuning, re-score all test deals and check if:
- Scores are more spread out (20-85 range)
- Your gut ranking matches the Astra ranking order
- The highest-scored deal is one you'd actually pursue
- The lowest-scored deal is one you'd actually pass on

You don't need the absolute numbers to match your gut — the RANKING is more important. If Astra ranks Deal A > Deal B > Deal C and you agree, the weights are working even if the exact scores are off by 10 points.

---

## Quick Validation Checklist

After the first scoring run, answer these yes/no:

- [ ] Does the best deal in the set have the highest score?
- [ ] Does the worst deal have the lowest score?
- [ ] Are scores spread across at least a 30-point range?
- [ ] Does a lease-up deal score reasonably (not just 20/100)?
- [ ] Does supply pipeline pressure feel proportional to actual risk?
- [ ] Are the right comps being selected (check comp table in modal)?
- [ ] Does the market intel rationale sound credible?
- [ ] Would you trust this score enough to rank a new deal you haven't seen?

If mostly yes → scoring is calibrated, move on to UI polish.
If mostly no → identify the biggest offender (usually one layer is off) and tune.

---

## Ongoing Calibration

After initial tuning, the scoring should be stable. Revisit calibration when:
- You add a new market with very different dynamics
- You significantly update the comp database (e.g., add 200+ new comps)
- You notice scores feeling "off" for a deal where you have strong conviction
- Every ~3 months as a health check
