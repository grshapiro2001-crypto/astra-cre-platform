# ARCHIVED — See .ai/ folder for current documentation

> **Note:** This spec is archived as of February 11, 2026. The Deal Score system has been implemented with a **three-layer architecture** (not the two-layer model described here). See [.ai/03-CODEBASE.md](.ai/03-CODEBASE.md) and `backend/app/services/scoring_service.py` for current implementation.

## Overview
Build a 0-100 Deal Score system for the Astra CRE Platform. Every property gets a score based on weighted quantitative metrics + an AI market intelligence adjustment. Users can customize metric weights in Settings. Scores appear in three places: Library cards, Property Detail, and Comparison view.

## Architecture

### Two-Layer Scoring Model

**Layer 1: Quantitative Score (0-100 base)**
Computed on the fly from property data + user weight preferences. Four metrics:

| Metric | What It Measures | Source Fields | Higher = Better? |
|--------|-----------------|---------------|-----------------|
| Cap Rate (T3/T12) | Current yield | `t12_noi` or `t3_noi` / asking price | Yes (within reason) |
| Economic Occupancy | Revenue efficiency | from `t12_financials_json` | Yes |
| Loss to Lease | Rent upside potential | `average_market_rent` vs `average_inplace_rent` | Yes (more gap = more upside) |
| OpEx Ratio | Operational efficiency | from `t12_financials_json` | No (lower is better) |

Each metric is scored 0-25 individually using benchmark ranges, then multiplied by the user's weight, and normalized to 0-100.

**Layer 2: AI Market Intelligence Adjustment (-10 to +10)**
Computed ONCE at extraction time (when document is uploaded). Cached on the property record. Claude searches the web for the property's submarket and produces:
- A numeric adjustment: -10 (very negative market signals) to +10 (very positive)
- A text rationale explaining the adjustment (2-3 sentences)

**Final Score = clamp(Quantitative Score + Market Adjustment, 0, 100)**

---

## Backend Implementation

### 1. New Database Fields on Property Model

Add to the existing property model:
```python
# On the Property table/model
market_sentiment_score = Column(Integer, nullable=True)  # -10 to +10
market_sentiment_rationale = Column(Text, nullable=True)  # AI explanation
market_sentiment_updated_at = Column(DateTime, nullable=True)
```

### 2. New Table: UserScoringWeights

```python
class UserScoringWeights(Base):
    __tablename__ = "user_scoring_weights"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Weights sum to 100
    cap_rate_weight = Column(Integer, default=30)
    economic_occupancy_weight = Column(Integer, default=25)
    loss_to_lease_weight = Column(Integer, default=25)
    opex_ratio_weight = Column(Integer, default=20)
    
    # Preset name (if using a preset)
    preset_name = Column(String, nullable=True)  # "value_add", "cash_flow", "core", "opportunistic", null=custom
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

### 3. Scoring Presets

```python
SCORING_PRESETS = {
    "value_add": {
        "cap_rate_weight": 20,
        "economic_occupancy_weight": 15,
        "loss_to_lease_weight": 40,  # Heavy weight on upside
        "opex_ratio_weight": 25,
    },
    "cash_flow": {
        "cap_rate_weight": 40,  # Heavy weight on yield
        "economic_occupancy_weight": 30,
        "loss_to_lease_weight": 10,
        "opex_ratio_weight": 20,
    },
    "core": {
        "cap_rate_weight": 25,
        "economic_occupancy_weight": 35,  # Stability focused
        "loss_to_lease_weight": 15,
        "opex_ratio_weight": 25,
    },
    "opportunistic": {
        "cap_rate_weight": 15,
        "economic_occupancy_weight": 15,
        "loss_to_lease_weight": 45,  # Maximum upside focus
        "opex_ratio_weight": 25,
    },
}
```

### 4. Score Calculation Engine

```python
# scoring_service.py

def calculate_metric_score(value: float, metric: str) -> float:
    """Score a single metric 0-100 based on benchmark ranges."""
    
    BENCHMARKS = {
        "cap_rate": {
            # Cap rate scoring: 4-7% is typical multifamily range
            "min": 3.0,   # Below this = 0 (overpriced)
            "low": 4.5,   # Below this = 25
            "mid": 5.5,   # This = 50
            "high": 6.5,  # This = 75
            "max": 8.0,   # Above this = 100
            "higher_is_better": True,
        },
        "economic_occupancy": {
            "min": 70.0,
            "low": 80.0,
            "mid": 88.0,
            "high": 93.0,
            "max": 97.0,
            "higher_is_better": True,
        },
        "loss_to_lease": {
            # Higher loss to lease = more upside = better for value-add
            "min": 0.0,
            "low": 2.0,
            "mid": 5.0,
            "high": 10.0,
            "max": 20.0,
            "higher_is_better": True,
        },
        "opex_ratio": {
            # Lower OpEx ratio = more efficient = better
            "min": 30.0,   # Best case
            "low": 38.0,
            "mid": 45.0,
            "high": 52.0,
            "max": 65.0,   # Worst case
            "higher_is_better": False,
        },
    }
    
    bench = BENCHMARKS[metric]
    # Linear interpolation within benchmark ranges
    # Return 0-100 score
    # If higher_is_better is False, invert the scale


def calculate_deal_score(property_data: dict, weights: dict) -> dict:
    """
    Calculate the full deal score for a property.
    
    Returns:
    {
        "total_score": 78,
        "quantitative_score": 72,
        "market_adjustment": 6,
        "breakdown": {
            "cap_rate": {"value": 5.15, "score": 58, "weight": 30, "weighted_contribution": 17.4},
            "economic_occupancy": {"value": 91.2, "score": 71, "weight": 25, "weighted_contribution": 17.75},
            "loss_to_lease": {"value": 8.5, "score": 68, "weight": 25, "weighted_contribution": 17.0},
            "opex_ratio": {"value": 42.0, "score": 65, "weight": 20, "weighted_contribution": 13.0},
        },
        "market_sentiment": {
            "adjustment": 6,
            "rationale": "Buckhead submarket shows strong rent growth of 4.2% YoY with limited new supply. Major employer expansions announced. Positive outlook.",
            "updated_at": "2026-02-07T12:33:00Z"
        }
    }
    """
```

### 5. API Endpoints

```
GET  /api/v1/scoring/weights          — Get current user's weights (or defaults)
PUT  /api/v1/scoring/weights          — Update user's weights
GET  /api/v1/scoring/presets          — List available presets
PUT  /api/v1/scoring/weights/preset   — Apply a preset by name

GET  /api/v1/scoring/score/{property_id}     — Get score for one property
POST /api/v1/scoring/scores                  — Get scores for multiple properties (batch, for Library)
     Body: { "property_ids": [1, 2, 3, ...] }
     
POST /api/v1/scoring/refresh-market/{property_id}  — Re-run AI market analysis
```

### 6. AI Market Intelligence (at extraction time)

Add to the extraction pipeline in `claude_extraction_service.py`. After extracting property data, make a SEPARATE Claude call:

```python
MARKET_INTEL_PROMPT = """
You are a commercial real estate market analyst. Given this property information, research the submarket and provide a market sentiment assessment.

Property: {deal_name}
Location: {property_address}
Submarket: {submarket}
Property Type: {property_type}

Research and assess:
1. Supply pipeline — new developments under construction or recently delivered in this submarket
2. Rent trends — is the submarket seeing rent growth, stagnation, or decline?
3. Concession activity — are properties in this submarket offering significant concessions?
4. Employment/economic drivers — major employers, job growth trends
5. Any notable risk factors — crime trends, infrastructure issues, regulatory changes

Based on your analysis, provide:
- A numeric adjustment from -10 to +10 (0 = neutral, positive = favorable market, negative = unfavorable)
- A 2-3 sentence rationale

Respond in JSON format:
{
    "market_adjustment": <integer -10 to 10>,
    "rationale": "<2-3 sentence explanation>"
}
"""
```

IMPORTANT: This call should use web search (tool use) to get real-time data. Use `claude-sonnet-4-5-20250929` with web search enabled. Set `base_url="https://api.anthropic.com"` explicitly (same gotcha as extraction service).

---

## Frontend Implementation

### 1. New Service: `scoringService.ts`

```typescript
// src/services/scoringService.ts

interface ScoringWeights {
  cap_rate_weight: number;
  economic_occupancy_weight: number;
  loss_to_lease_weight: number;
  opex_ratio_weight: number;
  preset_name: string | null;
}

interface MetricBreakdown {
  value: number;
  score: number;
  weight: number;
  weighted_contribution: number;
}

interface DealScore {
  total_score: number;
  quantitative_score: number;
  market_adjustment: number;
  breakdown: {
    cap_rate: MetricBreakdown;
    economic_occupancy: MetricBreakdown;
    loss_to_lease: MetricBreakdown;
    opex_ratio: MetricBreakdown;
  };
  market_sentiment: {
    adjustment: number;
    rationale: string;
    updated_at: string;
  } | null;
}

const scoringService = {
  getWeights(): Promise<ScoringWeights> { /* GET /api/v1/scoring/weights */ },
  updateWeights(weights: Partial<ScoringWeights>): Promise<ScoringWeights> { /* PUT */ },
  getPresets(): Promise<Record<string, ScoringWeights>> { /* GET */ },
  applyPreset(name: string): Promise<ScoringWeights> { /* PUT */ },
  getScore(propertyId: number): Promise<DealScore> { /* GET */ },
  getScores(propertyIds: number[]): Promise<Record<number, DealScore>> { /* POST batch */ },
  refreshMarketIntel(propertyId: number): Promise<DealScore> { /* POST refresh */ },
};
```

### 2. Deal Score Badge Component

Create `src/components/DealScoreBadge.tsx`:
- Circular badge (like the ones already in Comparison view)
- Color coding:
  - 80-100: green/teal (`text-emerald-400` — exception to no-emerald rule, this is data viz not theme)
  - Actually, use `text-green-400` to avoid any emerald confusion
  - 60-79: `text-primary` (purple)
  - 40-59: `text-yellow-400`
  - 0-39: `text-red-400`
- Sizes: `sm` (for Library cards, ~40px), `md` (for Property Detail, ~64px), `lg` (for Comparison, ~80px)
- Shows just the number inside the circle
- Tooltip or hover showing "Deal Score: 78/100"

### 3. Library Cards — Score Placement

In the Library card grid, replace the empty gray circle in the top-left of each card with the `DealScoreBadge` (size `sm`). The Library page should call the batch scoring endpoint on load to get scores for all visible properties.

If a property doesn't have enough data to compute a score (missing NOI, no financials), show a "—" or muted "N/A" badge instead.

### 4. Property Detail — Score Section

Add a new section between the property info header and the Economic Occupancy banner:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Deal Score                                              78/100    │
│                                                                     │
│  ████████████░░░░░░  Cap Rate (5.15%)          58 pts  ×30% = 17   │
│  █████████████░░░░░  Econ. Occupancy (91.2%)   71 pts  ×25% = 18   │
│  ████████████░░░░░░  Loss to Lease (8.5%)      68 pts  ×25% = 17   │
│  ██████████████░░░░  OpEx Ratio (42.0%)        65 pts  ×20% = 13   │
│                                                                     │
│  ┌─ Market Intelligence ──────────────────────────────────────────┐ │
│  │  +6 pts  Buckhead submarket shows strong rent growth of 4.2%  │ │
│  │          YoY with limited new supply. Positive outlook.       │ │
│  │                                    🔄 Refresh  · Feb 7, 2026  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

- Horizontal bar chart for each metric showing the individual score
- Weights shown alongside
- Market intelligence section with rationale text and refresh button
- Collapsible (expanded by default on first visit)

### 5. Comparison View — Already Has Score Badges

The Comparison view already shows circular score badges (93, 86 in the screenshots). Wire these to the real scoring API instead of hardcoded values.

### 6. Settings Page — Scoring Weights

New section on the existing Settings page:

- **Preset selector** — dropdown or pill buttons: Value-Add, Cash Flow, Core, Opportunistic, Custom
- **Weight sliders** — four sliders that must sum to 100
  - When one slider moves up, proportionally reduce the others
  - Or: let them be independent and show a "Total: 105% ⚠️" warning if they don't sum to 100, with a "Normalize" button
- **Save button** — persists to backend
- **Preview** — show a sample score calculation with the current weights so user can see the effect

---

## Implementation Order

### Phase 1: Backend (Session 1 — use Opus)
1. Add database fields and migration
2. Create `UserScoringWeights` model
3. Build `scoring_service.py` with calculation engine
4. Create API endpoints for weights CRUD and score computation
5. Test with existing property data

### Phase 2: Frontend Score Display (Session 2 — use Opus)
1. Create `scoringService.ts`
2. Build `DealScoreBadge` component
3. Add score to Library cards (batch load)
4. Add score breakdown section to Property Detail
5. Wire real scores into Comparison view

### Phase 3: Settings UI (Session 3 — use Sonnet)
1. Add scoring weights section to Settings page
2. Preset selector + weight sliders
3. Save/load weights from API
4. Preview calculation

### Phase 4: AI Market Intelligence (Session 4 — use Opus)
1. Add market intel prompt to extraction pipeline
2. Store results on property record
3. Display rationale in Property Detail
4. Add refresh button
5. Test with real submarket searches

---

## Design Rules (ALWAYS FOLLOW)
- Purple design tokens only (bg-primary, text-primary) — NEVER emerald for theme
- shadcn `<Button>` components, never raw `<button>`
- Show "—" for missing data, never "0" or "$0"
- Wrap any new pages in `<PageTransition>`
- Use service layer for API calls, never raw fetch
- After ANY changes: `npx tsc --noEmit` → `npm run build` → `npm run dev` → STOP for verification

## Project Path
`/Users/griffinshapiro/Documents/Claude Test`
- Frontend: `/frontend` (React at :5173)
- Backend: `/backend` (FastAPI at :8000)
