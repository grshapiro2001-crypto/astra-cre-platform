# Deal Score System v2 — Implementation Spec
# Updated: February 9, 2026

## What Changed from v1
- **Removed Loss to Lease** from scoring — it's seller-controlled and meaningless in lease-ups
- **Added Supply Pipeline Pressure** — measures submarket-level supply risk using Data Bank uploads
- **Restructured to Three-Layer Architecture** — Property Fundamentals (30%), Market Intelligence (20%), Deal Comp Analysis (50%)
- **Added Deal Score Modal** — click-to-expand scoring breakdown popup
- **Added Data Bank Extraction** — backend service for parsing Excel uploads (sales comps, pipeline trackers, underwriting models)

## Overview
Build a 0-100 Deal Score system for the Astra CRE Platform. Every property gets a score based on three layers: property fundamentals, AI market intelligence, and deal comp analysis from the Data Bank. Users can customize metric weights in Settings. Scores appear in Library cards, Property Detail, and Comparison view. Clicking a score badge opens a detailed breakdown modal.

---

## Three-Layer Scoring Architecture

### Layer 1: Property Fundamentals (30% of total score)
Computed on the fly from property data + user weight preferences.

| Metric | What It Measures | Source | Higher = Better? |
|--------|-----------------|--------|-----------------|
| Economic Occupancy | Revenue efficiency / demand health | OM / Rent Roll | Yes |
| OpEx Ratio | Operational efficiency | T-12 financials | No (lower is better) |
| Supply Pipeline Pressure | Future competitive risk in submarket | Data Bank uploads | No (more supply = worse) |

**Metric weights within Layer 1 sum to 100:**
- Economic Occupancy: 35 (default)
- OpEx Ratio: 30 (default)
- Supply Pipeline Pressure: 35 (default)

### Layer 2: Market Intelligence (20% of total score)
AI adjustment computed at extraction time. Cached on property record.
- Numeric adjustment: -10 to +10 (maps to 0-100 for the layer)
- Text rationale: 2-3 sentences explaining the adjustment
- Sources: FRED employment, Apartment List rents, Census permits, + Claude web search

### Layer 3: Deal Comp Analysis (50% of total score)
Computed against Data Bank comp data. If no comps loaded, weight redistributes to Layer 1.

| Metric | What It Measures | Source |
|--------|-----------------|--------|
| Cap Rate vs Comps | Is the pricing fair relative to recent trades? | Data Bank sales comps |
| Price/Unit vs Comps | Basis relative to comparable trades | Data Bank sales comps |
| Vintage/Quality Adjustment | Age/condition relative to comp set | Property data + comps |

**Weight redistribution when data is unavailable:**
- All three layers have data: 30% / 20% / 50% (default)
- No comp data: 55% / 45% / 0%
- No comp data AND no market intel: 100% / 0% / 0%
- No property fundamentals data: Cannot score — show "Insufficient Data"

**Final Score = clamp(weighted_layer_scores, 0, 100)**

---

## Backend Implementation

### Phase 1: Scoring Engine (COMPLETED ✅)
Already built by Claude Code. Includes:
- Database fields on Property model (market_sentiment_score, rationale, updated_at)
- UserScoringWeights model
- scoring_service.py with calculation engine
- API endpoints for weights CRUD and score computation
- Tested with Mezzo (scored 68.6 with 3/4 metrics)

### Phase 1.5: Update Scoring Engine (NEW — needs implementation)

**File: `backend/app/services/scoring_service.py`**

Replace Loss to Lease metric with Supply Pipeline Pressure. Update the three-metric model:

```python
BENCHMARKS = {
    "economic_occupancy": {
        "min": 70.0,    # Below = 0
        "low": 80.0,    # 25
        "mid": 88.0,    # 50
        "high": 93.0,   # 75
        "max": 97.0,    # 100
        "higher_is_better": True,
    },
    "opex_ratio": {
        "min": 30.0,    # Best case = 100
        "low": 38.0,    # 75
        "mid": 45.0,    # 50
        "high": 52.0,   # 25
        "max": 65.0,    # Worst case = 0
        "higher_is_better": False,
    },
    "supply_pipeline_pressure": {
        # Pipeline as % of existing submarket inventory (weighted)
        # Lower supply pressure = better score
        "min": 0.0,     # No pipeline = 100
        "low": 2.0,     # 75
        "mid": 5.0,     # 50
        "high": 8.0,    # 25
        "max": 15.0,    # 15%+ = 0
        "higher_is_better": False,
    },
}
```

**Update UserScoringWeights model:**
```python
class UserScoringWeights(Base):
    __tablename__ = "user_scoring_weights"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Layer 1: Property Fundamentals (weights sum to 100 within layer)
    economic_occupancy_weight = Column(Integer, default=35)
    opex_ratio_weight = Column(Integer, default=30)
    supply_pipeline_weight = Column(Integer, default=35)
    
    # Layer weights (sum to 100)
    layer1_weight = Column(Integer, default=30)  # Property Fundamentals
    layer2_weight = Column(Integer, default=20)  # Market Intelligence
    layer3_weight = Column(Integer, default=50)  # Deal Comp Analysis
    
    preset_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

**Update scoring presets:**
```python
SCORING_PRESETS = {
    "value_add": {
        "economic_occupancy_weight": 25,
        "opex_ratio_weight": 35,
        "supply_pipeline_weight": 40,
        "layer1_weight": 25,
        "layer2_weight": 20,
        "layer3_weight": 55,  # Heavy comp analysis
    },
    "cash_flow": {
        "economic_occupancy_weight": 40,
        "opex_ratio_weight": 30,
        "supply_pipeline_weight": 30,
        "layer1_weight": 35,
        "layer2_weight": 25,
        "layer3_weight": 40,
    },
    "core": {
        "economic_occupancy_weight": 40,
        "opex_ratio_weight": 25,
        "supply_pipeline_weight": 35,
        "layer1_weight": 30,
        "layer2_weight": 20,
        "layer3_weight": 50,
    },
    "opportunistic": {
        "economic_occupancy_weight": 20,
        "opex_ratio_weight": 30,
        "supply_pipeline_weight": 50,  # Supply risk very important
        "layer1_weight": 20,
        "layer2_weight": 20,
        "layer3_weight": 60,  # Maximum comp focus
    },
}
```

**Updated score calculation return shape:**
```python
def calculate_deal_score(property_data: dict, weights: dict, 
                          comp_data: list = None, pipeline_data: dict = None) -> dict:
    """
    Returns:
    {
        "total_score": 52,
        "layer_scores": {
            "property_fundamentals": {
                "score": 62,
                "weight": 30,
                "weighted_contribution": 18.6,
                "metrics": {
                    "economic_occupancy": {
                        "value": 95.0,
                        "raw_score": 71,
                        "weight": 35,
                        "weighted_score": 24.85,
                        "context": "Scored on Proforma — property stabilizing from lease-up"
                    },
                    "opex_ratio": {
                        "value": 36.4,
                        "raw_score": 78,
                        "weight": 30,
                        "weighted_score": 23.4,
                        "context": "Efficient for 2024 garden — new construction advantage"
                    },
                    "supply_pipeline_pressure": {
                        "value": 20.4,
                        "raw_score": 18,
                        "weight": 35,
                        "weighted_score": 6.3,
                        "pipeline_detail": {
                            "lease_up_units": 300,
                            "under_construction_units": 520,
                            "proposed_units": 680,
                            "weighted_pipeline": 920,
                            "existing_inventory": 4500,
                            "pct_of_inventory": 20.4
                        },
                        "context": "33.3% of submarket stock — significantly oversupplied"
                    }
                }
            },
            "market_intelligence": {
                "score": 54,  # mapped from adjustment: (adjustment + 10) / 20 * 100
                "weight": 20,
                "weighted_contribution": 10.8,
                "adjustment": 4,
                "rationale": "Gainesville MSA shows strong employment growth...",
                "updated_at": "2026-02-09T12:00:00Z"
            },
            "deal_comp_analysis": {
                "score": 48,
                "weight": 50,
                "weighted_contribution": 24.0,
                "metrics": {
                    "cap_rate_vs_comps": {
                        "property_value": 5.55,
                        "comp_avg": 5.20,
                        "spread_bps": 35,
                        "raw_score": 62,
                        "context": "+35 bps wider than comps — slight discount to market"
                    },
                    "price_per_unit_vs_comps": {
                        "property_value": 200617,
                        "comp_avg": 228400,
                        "pct_diff": -12.2,
                        "raw_score": 58,
                        "context": "12% below comp avg — favorable basis"
                    },
                    "vintage_adjustment": {
                        "property_vintage": 2024,
                        "comp_median_vintage": 2021,
                        "raw_score": 25,
                        "context": "Newest asset in comp set — justifies tighter pricing"
                    }
                },
                "comps_used": [
                    {"name": "Story Mundy Mill", "market": "Oakwood", "units": 300, 
                     "vintage": 2022, "cap_rate": 5.6, "price_per_unit": 215333},
                    {"name": "The Finch", "market": "Hoschton", "units": 275,
                     "vintage": 2023, "cap_rate": 5.3, "price_per_unit": 242755}
                ],
                "total_comps_available": 6
            }
        },
        "confidence": "high",  # high/medium/low based on data availability
        "data_sources": [
            {"name": "Q4 Atlanta Sales Comps", "type": "user_upload"},
            {"name": "Gainesville Pipeline Tracker", "type": "user_upload"},
            {"name": "FRED Employment Data", "type": "api"},
            {"name": "Apartment List Rent Trends", "type": "api"}
        ],
        "warnings": [
            "Lease-up property — T-12 occupancy averaged 44%. Proforma used for scoring."
        ]
    }
    """
```

### New Database Tables for Data Bank

```python
class DataBankDocument(Base):
    __tablename__ = "data_bank_documents"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    filename = Column(String, nullable=False)
    document_type = Column(String, nullable=False)  # sales_comps, pipeline_tracker, underwriting_model, market_report
    metro = Column(String, nullable=True)
    upload_date = Column(DateTime, default=func.now())
    extraction_status = Column(String, default="pending")  # pending, processing, completed, failed
    extraction_data = Column(JSON, nullable=True)  # Full extracted JSON
    
    created_at = Column(DateTime, default=func.now())


class SalesComp(Base):
    __tablename__ = "sales_comps"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("data_bank_documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    property_name = Column(String)
    market = Column(String)        # Submarket name
    metro = Column(String)         # Metro area
    property_type = Column(String) # Garden, Midrise, etc.
    sale_date = Column(Date)
    year_built = Column(Integer, nullable=True)
    year_renovated = Column(Integer, nullable=True)
    units = Column(Integer, nullable=True)
    avg_unit_sf = Column(Integer, nullable=True)
    avg_eff_rent = Column(Float, nullable=True)
    sale_price = Column(BigInteger, nullable=True)
    price_per_unit = Column(Integer, nullable=True)
    price_per_sf = Column(Float, nullable=True)
    cap_rate = Column(Float, nullable=True)         # As decimal (0.055)
    cap_rate_qualifier = Column(String, nullable=True) # "In Place", "Yr 1", "TBD"
    buyer = Column(String, nullable=True)
    seller = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=func.now())


class PipelineProject(Base):
    __tablename__ = "pipeline_projects"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("data_bank_documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    project_name = Column(String)
    address = Column(String, nullable=True)
    county = Column(String, nullable=True)
    metro = Column(String, nullable=True)
    submarket = Column(String, nullable=True)
    units = Column(Integer)
    status = Column(String)        # lease_up, under_construction, proposed, planning
    developer = Column(String, nullable=True)
    delivery_quarter = Column(String, nullable=True)  # "2027-Q2"
    start_quarter = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=func.now())


class SubmarketInventory(Base):
    """User-provided total inventory for pipeline scoring denominator."""
    __tablename__ = "submarket_inventory"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    metro = Column(String)
    submarket = Column(String)
    total_units = Column(Integer)
    source = Column(String, default="user_input")  # user_input, census_estimate
    
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

### Supply Pipeline Scoring Logic

```python
def calculate_supply_pipeline_score(submarket: str, metro: str, 
                                     user_id: int, db: Session) -> dict:
    """
    Calculate supply pipeline pressure for a submarket.
    
    Weighting by status:
    - lease_up: 100% (already competing)
    - under_construction: 80% (high certainty)
    - proposed/planning: 30% (many never break ground)
    """
    STATUS_WEIGHTS = {
        "lease_up": 1.0,
        "lease-up": 1.0,
        "under_construction": 0.8,
        "under construction": 0.8,
        "proposed": 0.3,
        "planning": 0.3,
        "proposed/planning": 0.3,
    }
    
    # Query pipeline projects for this submarket
    projects = db.query(PipelineProject).filter(
        PipelineProject.user_id == user_id,
        PipelineProject.submarket.ilike(f"%{submarket}%")
    ).all()
    
    if not projects:
        # No pipeline data — return neutral score with low confidence
        return {
            "raw_score": 50,
            "pipeline_detail": None,
            "context": "No pipeline data uploaded for this submarket",
            "confidence": "low"
        }
    
    # Tally by status
    lease_up_units = 0
    uc_units = 0
    proposed_units = 0
    
    for p in projects:
        status = p.status.lower().strip()
        weight = STATUS_WEIGHTS.get(status, 0.3)
        if weight == 1.0:
            lease_up_units += p.units
        elif weight == 0.8:
            uc_units += p.units
        else:
            proposed_units += p.units
    
    total_raw = lease_up_units + uc_units + proposed_units
    weighted_pipeline = (lease_up_units * 1.0) + (uc_units * 0.8) + (proposed_units * 0.3)
    
    # Get existing inventory
    inventory = db.query(SubmarketInventory).filter(
        SubmarketInventory.user_id == user_id,
        SubmarketInventory.submarket.ilike(f"%{submarket}%")
    ).first()
    
    if not inventory:
        return {
            "raw_score": 50,
            "pipeline_detail": {
                "lease_up_units": lease_up_units,
                "under_construction_units": uc_units,
                "proposed_units": proposed_units,
                "total_pipeline": total_raw,
                "weighted_pipeline": round(weighted_pipeline),
                "existing_inventory": None,
                "pct_of_inventory": None
            },
            "context": f"Pipeline data found ({total_raw} units) but no inventory baseline. Enter submarket inventory for accurate scoring.",
            "confidence": "low"
        }
    
    pct = (weighted_pipeline / inventory.total_units) * 100
    
    # Score using benchmarks (higher supply = lower score)
    raw_score = calculate_metric_score(pct, "supply_pipeline_pressure")
    
    # Generate context string
    if pct < 2:
        context_str = "Minimal new supply — favorable absorption outlook"
    elif pct < 5:
        context_str = "Manageable supply — market should absorb"
    elif pct < 8:
        context_str = "Elevated supply — monitor concession trends"
    elif pct < 12:
        context_str = "Heavy supply — likely rent pressure and concessions"
    else:
        context_str = f"{pct:.1f}% of submarket stock — significantly oversupplied"
    
    return {
        "raw_score": raw_score,
        "pipeline_detail": {
            "lease_up_units": lease_up_units,
            "under_construction_units": uc_units,
            "proposed_units": proposed_units,
            "total_pipeline": total_raw,
            "weighted_pipeline": round(weighted_pipeline),
            "existing_inventory": inventory.total_units,
            "pct_of_inventory": round(pct, 1)
        },
        "context": context_str,
        "confidence": "high"
    }
```

---

## Data Bank Extraction Service

### Architecture
Two-phase extraction with no file-specific configuration:

1. **Phase A (Python):** Structural parsing — read Excel, inventory sheets, detect document type, extract tabular data
2. **Phase B (Claude API):** Semantic extraction — classify data, normalize fields, handle edge cases

### Document Type Detection

```python
def detect_document_type(filepath: str) -> str:
    """Detect CRE document type from Excel file structure."""
    wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
    sheet_names = [s.lower() for s in wb.sheetnames]
    
    # Underwriting model: 10+ sheets with financial tabs
    model_indicators = ["assumptions", "proforma", "valuation", "financing", 
                        "rent roll", "trailing", "cash flow", "cf "]
    model_matches = sum(1 for s in sheet_names for ind in model_indicators if ind in s)
    if model_matches >= 3 or len(wb.sheetnames) >= 15:
        return "underwriting_model"
    
    # Sales comp tracker: single sheet with comp columns
    if len(wb.sheetnames) <= 3:
        ws = wb.active
        first_rows = []
        for row in ws.iter_rows(max_row=5, values_only=True):
            first_rows.append([str(c).lower() if c else "" for c in row])
        all_text = " ".join(" ".join(r) for r in first_rows)
        
        if any(term in all_text for term in ["cap rate", "sale price", "buyer", "seller"]):
            return "sales_comps"
        if any(term in all_text for term in ["delivery", "under construction", "developer", "pipeline"]):
            return "pipeline_tracker"
    
    return "unknown"
```

### Extraction Schemas

**Sales Comps** (column detection — same approach as prototype):
```
property_name, market, property_type, sale_date, year_built, units, 
avg_unit_sf, avg_eff_rent, sale_price, price_per_unit, price_per_sf, 
cap_rate, cap_rate_qualifier, buyer, seller
```

**Pipeline Tracker** (column detection):
```
project_name, address, county, metro, submarket, units, status, 
developer, delivery_quarter, start_quarter
```

**Underwriting Model** (intent-based sheet scanning):
- Scan sheet names → classify by CRE vocabulary
- Read top 80 rows of summary/output sheets
- Semantic search for: property info, unit mix, financials (T-12, T3, Proforma), pricing scenarios, returns, assumptions, debt terms
- Cross-reference values found on multiple sheets for confidence

### API Endpoints

```
POST /api/v1/data-bank/upload          — Upload Excel file, trigger extraction
GET  /api/v1/data-bank/documents       — List uploaded documents
GET  /api/v1/data-bank/document/{id}   — Get extraction results for one document

GET  /api/v1/data-bank/comps           — Query sales comps (with filters)
     ?metro=Atlanta&submarket=Gainesville&min_units=100&max_vintage=2020
     
GET  /api/v1/data-bank/pipeline        — Query pipeline projects
     ?submarket=Gainesville&status=under_construction

POST /api/v1/data-bank/inventory       — Set submarket inventory
     Body: { "metro": "Atlanta", "submarket": "Gainesville", "total_units": 4500 }
GET  /api/v1/data-bank/inventory       — Get all submarket inventories
```

---

## Comp Matching Service

### File: `backend/app/services/comp_matching_service.py`

This service selects relevant comps and scores Layer 3. See `comp-matching-logic.md` for full algorithm details.

**Core concept:** Every comp gets a relevance score (0-1) = geo_weight × type_weight × vintage_weight × size_weight. Comps are ranked by relevance; top 5-10 with cap rate data are used.

**Four matching dimensions:**

1. **Geography** — Tier 1: same submarket (1.0), Tier 2: adjacent/same county (0.85), Tier 3: same metro (0.50), Tier 4: regional (0.25)
2. **Property Type** — Same type (1.0), same group e.g. Garden/HD-Garden (0.8), adjacent group e.g. Garden/Midrise (0.5), different group (0.2)
3. **Vintage** — Same bracket (1.0), adjacent e.g. 2020+ vs 2010-2019 (0.7), two apart (0.4), three+ apart (0.15). Brackets: 2020+, 2010-2019, 2000-2009, 1990-1999, pre-1990. Renovation year used if within 10 years of subject.
4. **Size** — Within ±25% (1.0), ±50% (0.75), ±75% (0.5), beyond (0.25)

**Minimum threshold:** relevance > 0.10 to be considered. Minimum 3 comps with cap rate data for confident scoring.

**Three Layer 3 sub-metrics:**

1. **Cap Rate vs Comps** — Spread in basis points. +100bps wider = score 90+, in line (±25bps) = score 40-55, -100bps tighter = score 10.
2. **Price/Unit vs Comps** — Percentage difference. -20% below = score 90+, in line (±5%) = score 40-55, +20% above = score 0-10. Lower price = higher score.
3. **Vintage/Quality Adjustment** — Years newer/older than comp median. +5 years newer = 80, same = 50, -5 years older = 20. 6 points per year.

**Key functions:**
```python
calculate_relevance(subject: dict, comp: dict) -> float
select_comps(subject: dict, all_comps: list, min_comps=3, target=8, max=15) -> list
score_cap_rate_vs_comps(subject_cap: float, comps: list) -> dict
score_price_per_unit_vs_comps(subject_ppu: int, comps: list) -> dict
score_vintage_adjustment(subject_vintage: int, comps: list) -> dict
calculate_layer3_score(subject: dict, user_id: int, db: Session) -> dict
```

**Query flow in calculate_layer3_score:**
1. Get all SalesComp records for user from DB
2. Filter by metro (same metro as subject property)
3. Run select_comps() to get relevance-scored set
4. Run three sub-metric scores
5. Return Layer 3 result dict with comps_used list

**Edge cases:**
- Fewer than 3 comps: score Layer 3 as 50, confidence "low", redistribute weight to Layers 1+2
- No cap rate on subject: skip cap rate sub-metric, double $/unit weight
- Outlier comps (>2 std dev from mean): reduce relevance weight by 50%
- Mixed cap rate qualifiers (In Place vs Yr 1): display in comp table, flag warning

---

## Frontend Implementation

### Phase 2: Score Display + Modal (NEXT UP)

#### DealScoreBadge Component
`src/components/scoring/DealScoreBadge.tsx`

```typescript
interface DealScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';  // sm=40px, md=64px, lg=80px
  onClick?: () => void;
  showHint?: boolean;  // Show "View Details" on hover
}

// Color coding:
// 80-100: emerald (green-400 in implementation)
// 60-79:  purple (primary)
// 40-59:  amber (yellow-400)
// 0-39:   rose (red-400)
// null:   muted "—"
```

#### DealScoreModal Component
`src/components/scoring/DealScoreModal.tsx`

Full-screen modal overlay showing three-layer breakdown. See `deal-score-modal.html` artifact for exact design.

Key sections:
1. **Header:** Score ring, property name, confidence badge
2. **Layer 1 - Property Fundamentals:** Three metric rows with bars + scores, supply pipeline detail
3. **Layer 2 - Market Intelligence:** AI adjustment with rationale text
4. **Layer 3 - Deal Comp Analysis:** Cap rate vs comps, $/unit vs comps, vintage adjustment, mini comp table
5. **Sources footer:** Tags distinguishing user uploads vs API data

Warnings/callouts for:
- Lease-up properties
- Missing data (no comps loaded, no pipeline data)
- Stale market intel (>30 days old)

#### Integration Points
- **Library cards:** DealScoreBadge (size sm) replaces gray circle placeholder. Batch load scores on page mount.
- **Property Detail:** DealScoreBadge (size md) in header area. Click opens DealScoreModal.
- **Comparison view:** Wire real scores to existing badge placeholders.

### Phase 3: Settings UI
Add scoring weights section to Settings page:
- Layer weight sliders (must sum to 100)
- Within-layer metric weight sliders (must sum to 100)
- Preset selector: Value-Add, Cash Flow, Core, Opportunistic, Custom
- Preview showing sample score with current weights

### Phase 4: AI Market Intelligence
- Add market intel prompt to extraction pipeline
- Use claude-sonnet-4-5-20250929 with web search tool
- Store results on property record
- Display rationale in modal Layer 2
- Refresh button to re-run analysis

### Phase 5: Data Bank Upload UI
- Upload flow: drag-drop Excel → auto-detect type → show extraction preview → confirm → store
- For pipeline trackers: after extraction, prompt user for submarket inventory numbers
- Data Bank page showing all uploaded documents with extraction status
- Comp browser: searchable/filterable table of all extracted comps

---

## Calibration Rules (from simulation testing)

### Lease-Up Confidence Discount
When T-12 economic occupancy < 75%, the property is in lease-up:
- Use Proforma occupancy for the economic_occupancy metric score
- Apply a 0.85× confidence discount to the entire Layer 1 score
- Add warning: "Lease-up property — fundamentals scored on Proforma targets, not actuals"
- This creates a proportional ~2-3 point penalty without crushing new construction deals

### Comp Selection Tightening
- Minimum relevance threshold: 0.25 (not 0.10)
- Target comp set size: 5-6 (not 8)
- Maximum: 10
- This prevents premium-market comps from inflating the discount signal

### Layer 3 Sub-Metric Weights
- Cap Rate vs Comps: 35% (reduced from 40)
- $/Unit vs Comps: 40% (increased from 35)
- Vintage Adjustment: 25% (unchanged)
- Rationale: $/unit is a harder, more comparable number than cap rate (which depends on NOI assumptions)

### Validated Scoring (Prose Gainesville, Value-Add Preset)
- Layer 1 (Property Fundamentals): 49.9/100 — supply pipeline (0/100) drags down strong occupancy/OpEx
- Layer 2 (Market Intelligence): 70/100 — positive employment, mixed rent signals
- Layer 3 (Deal Comp Analysis): 62.1/100 — market cap rate, favorable $/unit basis
- **Total: 61/100** — moderate deal with significant supply risk

---

## Design Rules (ALWAYS FOLLOW)
- Purple design tokens only (bg-primary, text-primary) — NEVER emerald for theme
- shadcn `<Button>` components, never raw `<button>`
- Show "—" for missing data, never "0" or "$0"
- Wrap any new pages in `<PageTransition>`
- Use service layer for API calls, never raw fetch
- After ANY changes: `npx tsc --noEmit` → `npm run build` → `npm run dev` → STOP for verification
- JetBrains Mono for numeric data display
- DM Sans for all other text

## Project Path
`/Users/griffinshapiro/Documents/Claude Test`
- Frontend: `/frontend` (React at :5173)
- Backend: `/backend` (FastAPI at :8000)
