# Comp Matching Logic — Astra CRE Deal Score Layer 3

## The Problem
When scoring a property, we need to answer: "Which comps from the Data Bank are relevant to THIS deal?" The wrong comps produce a meaningless score. The right comps tell you whether the pricing is fair.

## Design Principles

1. **Progressive relaxation** — Start narrow, widen until we have enough comps
2. **Minimum viable comp set** — Need at least 3 comps with cap rate data to score confidently
3. **Ideal comp set** — 5-10 comps, all with cap rates and $/unit
4. **Similarity scoring** — Not binary include/exclude; each comp gets a relevance weight
5. **Transparency** — The modal shows exactly which comps were used and why

---

## Matching Dimensions

### 1. Geography (most important)
The submarket is the tightest filter. But "submarket" names aren't standardized — the same area might be called "Buckhead", "Buckhead/Lenox", or "North Atlanta" depending on the source.

**Matching approach:**
- **Tier 1 — Same submarket:** Exact match or fuzzy match (Levenshtein distance ≤ 2, or one contains the other). Example: "Gainesville" matches "Gainesville".
- **Tier 2 — Adjacent submarkets:** Same county, or within a defined submarket cluster. Example: Gainesville → also includes Oakwood, Hoschton, Buford (NE Atlanta I-985 corridor).
- **Tier 3 — Same metro:** All submarkets within the metro area. Example: all of Metro Atlanta.
- **Tier 4 — Regional:** Same state or region. Only used as last resort.

**Submarket clustering:**
Rather than hardcoding clusters, derive them from the Data Bank. If the user's comp tracker has "Market" or "Submarket" columns, group properties that share the same county or are within 15 miles of each other (using geocoded addresses if available). For the MVP, the user can define clusters manually or we use county as a proxy.

### 2. Property Type
Garden-style apartment comps aren't relevant to a high-rise condo conversion.

**Type matching groups:**
```
Garden Group:    Garden, HD-Garden, HD Garden, LD-Garden, LD Garden
Midrise Group:   Midrise, Lowrise, Wrap
Highrise Group:  Highrise, High-Rise
Specialty Group: BFR, Build-for-Rent, Townhome, Single-Family Rental
```

- **Exact type match:** 100% relevance weight
- **Same group match:** 80% relevance weight (Garden matches HD-Garden)
- **Adjacent group:** 50% relevance weight (Garden matches Midrise — both suburban product)
- **Different group:** 20% relevance weight (Garden matches Highrise — barely comparable)

### 3. Vintage (Year Built)
A 2024 new construction trades very differently than a 1985 value-add.

**Vintage brackets:**
```
New Construction:  2020+
Recent Build:      2010-2019
Mature:            2000-2009
Vintage:           1990-1999
Legacy:            Pre-1990
```

**Relevance decay:**
- Same bracket: 100% weight
- Adjacent bracket: 70% weight
- Two brackets apart: 40% weight
- Three+ brackets apart: 15% weight

**Renovation adjustment:** If a comp has a renovation year (e.g., "1987/2017"), use the renovation year for matching if within 10 years of the subject property. A 1987 property renovated in 2017 is more comparable to a 2020 build than to an unrenovated 1987 property.

### 4. Size (Unit Count)
A 50-unit property has different economics than a 500-unit property (different management efficiency, different buyer pool, different cap rate expectations).

**Size matching:**
- Within ±25% of subject: 100% weight
- Within ±50% of subject: 75% weight
- Within ±75%: 50% weight
- Beyond ±75%: 25% weight

Example for Prose Gainesville (300 units):
- 225-375 units: 100% weight
- 150-450 units: 75% weight
- 75-525 units: 50% weight

---

## Composite Relevance Score

Each comp gets a relevance score (0-1) that is the product of all dimension weights:

```
relevance = geo_weight × type_weight × vintage_weight × size_weight
```

Example:
- Story Mundy Mill (Oakwood, Garden, 2022, 300 units):
  - Geo: Tier 2 adjacent submarket = 0.85
  - Type: Garden matches Garden = 1.0
  - Vintage: Same bracket (2020+) = 1.0
  - Size: 300 units, exactly same = 1.0
  - **Relevance: 0.85**

- Cortland Windward (Alpharetta, Garden, 1987, 294 units):
  - Geo: Tier 3 same metro = 0.50
  - Type: Garden = 1.0
  - Vintage: Legacy vs New Construction (3 brackets) = 0.15
  - Size: 294 vs 300 = 1.0
  - **Relevance: 0.075** — effectively excluded

- Solis Sugar Hill (Sugar Hill, Garden, 2023, 294 units):
  - Geo: Tier 2 adjacent = 0.85
  - Type: Garden = 1.0 (assuming from type data)
  - Vintage: Same bracket = 1.0
  - Size: 294 vs 300 = 1.0
  - **Relevance: 0.85**

## Selection Algorithm

```python
def select_comps(subject_property: dict, all_comps: list, 
                  min_comps: int = 3, target_comps: int = 8, 
                  max_comps: int = 15) -> list:
    """
    Select relevant comps for Deal Score Layer 3.
    
    Returns comps sorted by relevance score, with at least min_comps
    if available. Uses progressive relaxation if needed.
    """
    
    # Step 1: Score every comp
    scored_comps = []
    for comp in all_comps:
        rel = calculate_relevance(subject_property, comp)
        if rel > 0.05:  # Minimum threshold to consider
            scored_comps.append({**comp, "_relevance": rel})
    
    # Step 2: Filter to comps with cap rate data (preferred)
    comps_with_cap = [c for c in scored_comps if c.get("cap_rate") is not None]
    comps_without_cap = [c for c in scored_comps if c.get("cap_rate") is None]
    
    # Step 3: Sort by relevance
    comps_with_cap.sort(key=lambda c: c["_relevance"], reverse=True)
    comps_without_cap.sort(key=lambda c: c["_relevance"], reverse=True)
    
    # Step 4: Select
    selected = []
    
    # Prefer comps with cap rates
    for c in comps_with_cap:
        if len(selected) >= target_comps:
            break
        if c["_relevance"] >= 0.3:  # Minimum relevance for inclusion
            selected.append(c)
    
    # If we don't have enough, lower the relevance threshold
    if len(selected) < min_comps:
        for c in comps_with_cap:
            if c not in selected and c["_relevance"] >= 0.20:
                selected.append(c)
                if len(selected) >= min_comps:
                    break
    
    # If STILL not enough, include comps without cap rates (for $/unit comparison)
    if len(selected) < min_comps:
        for c in comps_without_cap:
            if c["_relevance"] >= 0.20:
                selected.append(c)
                if len(selected) >= min_comps:
                    break
    
    # Cap at max
    selected = selected[:max_comps]
    
    return selected


def calculate_relevance(subject: dict, comp: dict) -> float:
    """Calculate composite relevance score for a comp."""
    
    geo = geo_relevance(subject.get("submarket"), comp.get("market"),
                         subject.get("metro"), comp.get("metro"))
    ptype = type_relevance(subject.get("property_type"), comp.get("property_type"))
    vintage = vintage_relevance(subject.get("year_built"), comp.get("year_built"),
                                 comp.get("year_renovated"))
    size = size_relevance(subject.get("units"), comp.get("units"))
    
    return geo * ptype * vintage * size
```

---

## Layer 3 Scoring with Selected Comps

Once comps are selected, Layer 3 calculates three sub-metrics:

### Cap Rate vs Comps
Measures whether the subject's cap rate is fair relative to comparable trades.

```python
def score_cap_rate_vs_comps(subject_cap: float, comps: list) -> dict:
    """
    Score based on spread between subject cap rate and relevance-weighted comp average.
    
    Wider cap = better deal (more yield) = higher score, BUT
    too wide might signal something wrong.
    """
    # Relevance-weighted average cap rate
    caps = [(c["cap_rate"], c["_relevance"]) for c in comps if c.get("cap_rate")]
    if not caps:
        return {"raw_score": 50, "context": "No comp cap rate data available"}
    
    weighted_avg = sum(c * r for c, r in caps) / sum(r for _, r in caps)
    spread_bps = (subject_cap - weighted_avg) * 10000  # In basis points
    
    # Scoring:
    # +100 bps or more wider: 90-100 (significant discount to market)
    # +50 to +100 bps wider: 70-90 (favorable pricing)
    # +25 to +50 bps wider: 55-70 (slight discount)
    # -25 to +25 bps (in line): 40-55 (market pricing)
    # -50 to -25 bps tighter: 25-40 (slight premium)
    # -100 to -50 bps tighter: 10-25 (paying up)
    # More than -100 bps: 0-10 (significantly overpriced vs comps)
    
    if spread_bps >= 100:
        score = 90 + min((spread_bps - 100) / 50 * 10, 10)
    elif spread_bps >= 50:
        score = 70 + (spread_bps - 50) / 50 * 20
    elif spread_bps >= 25:
        score = 55 + (spread_bps - 25) / 25 * 15
    elif spread_bps >= -25:
        score = 40 + (spread_bps + 25) / 50 * 15
    elif spread_bps >= -50:
        score = 25 + (spread_bps + 50) / 25 * 15
    elif spread_bps >= -100:
        score = 10 + (spread_bps + 100) / 50 * 15
    else:
        score = max(0, 10 + spread_bps / 100 * 10)
    
    # Context string
    if spread_bps > 25:
        context = f"+{int(spread_bps)} bps wider than comps — discount to market"
    elif spread_bps < -25:
        context = f"{int(spread_bps)} bps tighter than comps — premium to market"
    else:
        context = f"Within {abs(int(spread_bps))} bps of comp avg — market pricing"
    
    return {
        "raw_score": round(min(max(score, 0), 100)),
        "property_value": round(subject_cap * 100, 2),
        "comp_avg": round(weighted_avg * 100, 2),
        "spread_bps": round(spread_bps),
        "context": context,
    }
```

### Price/Unit vs Comps
Similar logic but for $/unit basis.

```python
def score_price_per_unit_vs_comps(subject_ppu: int, comps: list) -> dict:
    """
    Score based on subject's $/unit vs relevance-weighted comp average.
    Lower $/unit = better basis = higher score.
    """
    ppus = [(c["price_per_unit"], c["_relevance"]) for c in comps if c.get("price_per_unit")]
    if not ppus:
        return {"raw_score": 50, "context": "No comp $/unit data available"}
    
    weighted_avg = sum(p * r for p, r in ppus) / sum(r for _, r in ppus)
    pct_diff = (subject_ppu - weighted_avg) / weighted_avg * 100
    
    # Scoring (lower price = higher score):
    # -20% or more below comps: 90-100 (huge discount)
    # -10% to -20% below: 70-90
    # -5% to -10% below: 55-70
    # -5% to +5% (in line): 40-55
    # +5% to +10% above: 25-40
    # +10% to +20% above: 10-25
    # +20%+ above: 0-10
    
    # Invert because LOWER price = BETTER
    if pct_diff <= -20:
        score = 90 + min((-20 - pct_diff) / 10 * 10, 10)
    elif pct_diff <= -10:
        score = 70 + (-10 - pct_diff) / 10 * 20
    elif pct_diff <= -5:
        score = 55 + (-5 - pct_diff) / 5 * 15
    elif pct_diff <= 5:
        score = 40 + (5 - pct_diff) / 10 * 15
    elif pct_diff <= 10:
        score = 25 + (10 - pct_diff) / 5 * 15
    elif pct_diff <= 20:
        score = 10 + (20 - pct_diff) / 10 * 15
    else:
        score = max(0, 10 - (pct_diff - 20) / 10 * 10)
    
    return {
        "raw_score": round(min(max(score, 0), 100)),
        "property_value": subject_ppu,
        "comp_avg": round(weighted_avg),
        "pct_diff": round(pct_diff, 1),
        "context": f"{'Below' if pct_diff < 0 else 'Above'} comp avg by {abs(round(pct_diff, 1))}%",
    }
```

### Vintage/Quality Adjustment
Adjusts for the fact that newer properties SHOULD trade at tighter caps / higher $/unit.

```python
def score_vintage_adjustment(subject_vintage: int, comps: list) -> dict:
    """
    If the subject is newer than the comp set median, tighter pricing
    is justified — don't penalize it. If older, wider pricing is expected.
    
    This metric answers: "Given its age relative to comps, is the 
    pricing appropriately adjusted?"
    """
    vintages = [c["year_built"] for c in comps if c.get("year_built")]
    if not vintages:
        return {"raw_score": 50, "context": "No comp vintage data"}
    
    median_vintage = sorted(vintages)[len(vintages) // 2]
    age_diff = subject_vintage - median_vintage  # Positive = newer
    
    # If subject is newer than comps, tighter pricing is justified
    # Score represents how well the pricing reflects the vintage advantage
    # This is somewhat subjective — newer is generally better but 
    # the cap rate/ppu scores already capture the pricing delta
    
    # For now: newer vintage gets a small boost, older gets a penalty
    # Range: -5 years or more older = 20, same age = 50, +5 years newer = 80
    score = 50 + (age_diff * 6)  # 6 points per year
    score = min(max(score, 10), 90)
    
    if age_diff > 0:
        context = f"{age_diff} years newer than comp median — justifies tighter pricing"
    elif age_diff < 0:
        context = f"{abs(age_diff)} years older than comp median — should trade wider"
    else:
        context = "Same vintage as comp median"
    
    return {
        "raw_score": round(score),
        "property_vintage": subject_vintage,
        "comp_median_vintage": median_vintage,
        "context": context,
    }
```

---

## Validation Against Real Data

### Prose Gainesville Test Case

Subject: 300 units, 2024, Gainesville, Garden, 5.55% Y1 cap (Market), $200,617/unit

**Best matching comps (Tier 2, NE ATL, 2020+, 150-500 units):**

| Comp | Market | Units | Year | Cap | $/Unit | Relevance |
|------|--------|-------|------|-----|--------|-----------|
| Story Mundy Mill | Oakwood | 300 | 2022 | 5.60% | $228,000 | 0.85 |
| The Finch | Hoschton | 275 | 2023 | 5.30% | $242,755 | 0.85 |
| Prose Fairview | Covington | 318 | 2022 | 5.60% | $197,012 | 0.80 |
| Cove at Covington | Covington | 350 | 2022 | 5.60% | $207,357 | 0.75 |
| Pointe Grand | Athens | 240 | 2022 | 5.60% | $213,541 | 0.70 |
| The Tomlin | Snellville | 288 | 2022 | 5.30% | $269,097 | 0.75 |
| Dylan at Grayson | Grayson | 234 | 2020 | 5.30% | $242,094 | 0.65 |
| Centennial Ridge | Conyers | 153 | 2022 | 5.50% | $413,954 | 0.50 |

Weighted avg cap rate: ~5.48%
Weighted avg $/unit: ~$240,000

**Scoring results:**
- Cap Rate: 5.55% vs 5.48% avg → +7 bps wider → Score ~48 (essentially at market)
- $/Unit: $200,617 vs ~$240,000 → -16.4% below → Score ~75 (favorable basis)
- Vintage: 2024 vs 2022 median → +2 years newer → Score ~62

**Layer 3 composite: ~60** (weighted average of the three sub-metrics)

This feels right. The deal is priced essentially at market on cap rate, has a favorable basis on $/unit (likely because Gainesville is a secondary market vs Suwanee/Buford), and has a slight vintage premium. Not a screaming deal, not overpriced — mid-range score.

---

## Edge Cases

### Not Enough Comps
If fewer than 3 comps match with relevance > 0.1:
- Score Layer 3 as 50 (neutral)
- Set confidence to "low"
- Show warning: "Insufficient comp data for reliable analysis. Upload more comps for this market."
- Redistribute Layer 3 weight to Layers 1 and 2

### No Cap Rate on Subject Property
If the subject property doesn't have a cap rate (e.g., no asking price yet):
- Skip cap rate vs comps sub-metric
- Double weight on $/unit comparison
- Skip vintage adjustment OR keep at half weight

### Outlier Comps
Centennial Ridge at $413,954/unit is a clear outlier relative to the other NE ATL comps. 

**Outlier detection:** If a comp's $/unit or cap rate is more than 2 standard deviations from the set mean, reduce its relevance weight by 50%. Don't exclude entirely — the user may want to see it — but don't let it skew the average.

### Cap Rate Qualifier Mismatch
"In Place" cap rates aren't directly comparable to "Yr 1" cap rates. An In Place cap of 4.5% might correspond to a Yr 1 cap of 5.2% after lease-up.

**For MVP:** Display the qualifier in the comp table so the user can assess. Don't adjust algorithmically yet — this requires deal-specific knowledge about concessions and lease-up timeline.

**Future enhancement:** If the subject has a Yr 1 cap, prefer comps with Yr 1 caps. If mixing qualifiers, flag in the modal: "⚠ Comp cap rates include mixed qualifiers (In Place and Yr 1)."

---

## Implementation Notes

### For Claude Code (add to deal-score-spec-v2.md)

```python
# backend/app/services/comp_matching_service.py

# This is a new service file. Key functions:
# 
# calculate_relevance(subject, comp) -> float (0-1)
# select_comps(subject, all_comps, min=3, target=8, max=15) -> list
# score_cap_rate_vs_comps(subject_cap, comps) -> dict
# score_price_per_unit_vs_comps(subject_ppu, comps) -> dict
# score_vintage_adjustment(subject_vintage, comps) -> dict
# calculate_layer3_score(subject, comps) -> dict
#
# The scoring_service.py should call comp_matching_service
# when calculating the full deal score.
#
# Query flow:
# 1. Get all SalesComp records for user from DB
# 2. Filter by metro (same metro as subject)
# 3. Run select_comps() to get relevance-scored set
# 4. Run three sub-metric scores
# 5. Return Layer 3 result dict
```
