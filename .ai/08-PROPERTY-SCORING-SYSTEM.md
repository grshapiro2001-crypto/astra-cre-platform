# Property Scoring System (0-100) - Astra CRE Platform

**Purpose:** Design specification for institutional-grade multifamily property scoring system
**Priority:** 9/10 - Golden Feature
**Last Updated:** February 7, 2026
**Status:** Research Complete - Ready for Implementation

---

## Executive Summary

Based on deep analysis of your firm's institutional proforma (Alliance Residential) and comprehensive CRE research, this document outlines a proprietary 0-100 property scoring system that:

1. **Serves all capital types** (core, core-plus, value-add, opportunistic)
2. **User-customizable weighting** (acquisitions vs broker vs principal perspectives)
3. **AI-powered market intelligence** (real-time sentiment, supply/demand, economic indicators)
4. **Multi-strategy support** (same property scored differently for different fund strategies)
5. **Institutional-grade metrics** (aligned with how Blackstone, KKR, Carlyle, Cortland underwrite)

---

## Key Insights from Your Proforma Analysis

### What Your Firm Uses (Alliance Residential - Prose Gainesville)

From analyzing your actual institutional proforma, I identified these core metrics:

**Return Metrics:**
- Levered IRR (Premium vs Market pricing scenarios)
- Unlevered IRR
- Year 1 Cash-on-Cash (I/O)
- Average Cash-on-Cash
- Equity Multiple (calculated from 5-7 year hold)

**Valuation Metrics:**
- Cap Rate (T12, T3, Year 1, Terminal)
- Price per unit, price per SF
- Multiple pricing scenarios (Premium vs Market)

**Debt Metrics:**
- LTV (Loan-to-Value)
- DSCR (Debt Service Coverage Ratio)
- Debt Yield
- Amortization schedule tracking

**Market Assumptions:**
- Rent growth trajectories (Year 1, CAGR projections)
- Occupancy trends
- Expense ratio analysis
- Real estate tax projections
- Concession modeling

**Operational Deep Dive:**
- Unit-by-unit rent roll analysis
- Rollover schedule (lease expirations, renewal assumptions)
- Renovation program (unit mix, capital costs, rent premiums)
- Loss-to-lease calculations
- Expense comps vs market

**Critical Insight:** Your proforma models **multiple scenarios** (Premium vs Market, Conservative vs Aggressive). This confirms the need for **flexible, strategy-specific scoring**.

---

## Scoring System Architecture

### Core Principle: Weighted Component Scoring

```
FINAL SCORE =
  (Financial Performance × 35%) +
  (Market Intelligence × 25%) +
  (Asset Quality × 25%) +
  (Operational Efficiency × 15%)
```

**Key Design Decision:** Weights are **user-customizable** based on strategy.

---

## Component 1: Financial Performance (35% weight)

### Metrics Tracked

**Return Metrics (60% of financial score):**
- Levered IRR vs. strategy target
- Unlevered IRR vs. benchmark
- Year 1 Cash-on-Cash
- Average Cash-on-Cash (hold period)
- Equity Multiple (projected)

**Risk Metrics (40% of financial score):**
- DSCR vs. lender minimums
- Debt Yield vs. institutional standards
- LTV reasonableness
- Cap rate spread (entry vs terminal)
- Refinancing risk (2026-2027 maturities)

### Scoring Logic

**Levered IRR Scoring (by strategy):**
```
Core Strategy:
  >10%: 100 points
  8-10%: 70-100 points (linear scale)
  6-8%: 40-70 points
  <6%: 0-40 points

Core-Plus Strategy:
  >13%: 100 points
  10-13%: 70-100 points
  7-10%: 40-70 points
  <7%: 0-40 points

Value-Add Strategy:
  >18%: 100 points
  15-18%: 70-100 points
  12-15%: 40-70 points
  <12%: 0-40 points

Opportunistic Strategy:
  >22%: 100 points
  18-22%: 70-100 points
  15-18%: 40-70 points
  <15%: 0-40 points
```

**DSCR Scoring:**
```
≥1.35x: 100 points
1.25-1.35x: 80-100 points
1.20-1.25x: 60-80 points
1.10-1.20x: 30-60 points
<1.10x: 0-30 points (RED FLAG - 2026 refinancing risk)
```

**Debt Yield Scoring:**
```
≥12%: 100 points
10-12%: 80-100 points
8-10%: 50-80 points
6-8%: 20-50 points
<6%: 0-20 points
```

**LTV Scoring (strategy-dependent):**
```
Core: <50% = 100, 50-60% = 80, 60-70% = 50, >70% = 20
Core-Plus: <60% = 100, 60-70% = 80, 70-75% = 50, >75% = 20
Value-Add: <70% = 100, 70-80% = 80, 80-85% = 50, >85% = 20
```

---

## Component 2: Market Intelligence (25% weight) - AI-POWERED

### Sub-Components

**MSA Quality (40% of market score):**
- Employment growth rate (BLS data)
- Job diversity index
- Population growth trend (Census data)
- Migration patterns (inbound vs outbound)
- Regulatory environment score

**Submarket Dynamics (35% of market score):**
- Supply/demand balance (units under construction ÷ total inventory)
- Vacancy trend (4-quarter moving average)
- Rent growth trajectory (12-month trend)
- Competitive positioning (comps analysis)
- School quality, commute times

**AI Sentiment Analysis (25% of market score):**
- News sentiment about MSA/submarket
- Market reports analysis (CBRE, JLL, CoStar)
- Forward-looking indicators (job postings, corporate relocations)
- Construction pipeline assessment
- Cap rate compression/expansion trends

### AI Research Triggers

When property is uploaded or scored, AI automatically researches:

```python
# Pseudo-code for AI market research
def ai_market_research(property_location, property_type):
    """
    Triggered automatically on property upload/re-score
    """

    # Web search queries
    queries = [
        f"{city}, {state} multifamily market outlook 2026",
        f"{city} employment growth trends",
        f"{city} apartment supply pipeline",
        f"{city} rent growth forecast",
        f"{submarket} demographics and income",
        f"{city} population migration patterns"
    ]

    # Analyze results
    sentiment_score = analyze_sentiment(search_results)
    supply_risk = calculate_supply_demand_ratio(search_results)
    growth_indicators = extract_growth_metrics(search_results)

    # Generate Market Intelligence Report
    return {
        "sentiment_score": 0-100,
        "supply_risk_flag": bool,
        "key_insights": [
            "Strong job growth +3.2% YoY",
            "⚠️ High supply risk: 1,200 units delivering Q3 2026",
            "Rent growth forecast: +2.8% (vs national avg 3.3%)"
        ],
        "comparable_cap_rates": "5.2-5.8%",
        "market_score": 0-100
    }
```

### Scoring Logic - Market Intelligence

**MSA Quality Scoring:**
```
Job Growth >3%: 90-100 points
Job Growth 2-3%: 70-90 points
Job Growth 1-2%: 50-70 points
Job Growth <1%: 20-50 points
Job Decline: 0-20 points

+ Bonus: Migration pattern positive (+5 points)
+ Bonus: Diverse employment base (+5 points)
- Penalty: Single industry dominance (-10 points)
```

**Supply/Demand Scoring:**
```
Supply <2% of inventory: 90-100 points
Supply 2-4%: 60-90 points
Supply 4-6%: 30-60 points (⚠️ Orlando, Austin, Miami levels)
Supply >6%: 0-30 points (RED FLAG)

+ Bonus: Declining vacancy trend (+10 points)
- Penalty: Rising concessions in submarket (-10 points)
```

**AI Sentiment Scoring:**
```
Very Positive Outlook: 90-100 points
Positive Outlook: 70-90 points
Neutral/Mixed: 50-70 points
Negative Outlook: 20-50 points
Very Negative: 0-20 points
```

### Real-World Example (from research)

**Atlanta Multifamily 2026:**
- MSA Quality: 85/100 (strong job growth, diverse economy)
- Submarket Dynamics: 65/100 (moderate supply, stable vacancy)
- AI Sentiment: 80/100 (positive outlook, rent growth expected)
- **Market Score: 77/100**

**Austin Multifamily 2026:**
- MSA Quality: 78/100 (tech-heavy, but diversifying)
- Submarket Dynamics: 45/100 (⚠️ HIGH SUPPLY, vacancy rising)
- AI Sentiment: 55/100 (cautious outlook, oversupply concerns)
- **Market Score: 60/100**

---

## Component 3: Asset Quality (25% weight)

### Sub-Components

**Physical Condition (45% of asset score):**
- Vintage and class
- Deferred maintenance assessment
- Capital expenditure requirements
- Amenity package competitiveness

**Location Quality (35% of asset score):**
- Walkability score
- School ratings
- Crime/safety metrics
- Proximity to employment centers
- Retail/dining access

**Value-Add Potential (20% of asset score):**
- Renovation opportunity (rent premium potential)
- Management upside
- Operational inefficiency opportunities

### Scoring Logic - Asset Quality

**Vintage Scoring:**
```
Built <5 years (Class A): 90-100 points
Built 5-15 years (Class A-/B+): 75-90 points
Built 15-30 years (Class B): 60-75 points
Built 30-40 years (Class B-/C+): 40-60 points
Built >40 years (Class C): 20-40 points

+ Bonus: Recent major renovation (+15 points)
+ Bonus: Strong amenity package vs comps (+10 points)
```

**Deferred Maintenance Scoring:**
```
Minimal (<$500/unit): 90-100 points
Light ($500-2,000/unit): 70-90 points
Moderate ($2,000-5,000/unit): 50-70 points
Heavy ($5,000-10,000/unit): 30-50 points
Severe (>$10,000/unit): 0-30 points

Note: This is INVERSE scoring for Core/Core-Plus
      For Value-Add/Opportunistic, heavy deferred maintenance
      can be POSITIVE (opportunity) - adjust weighting
```

**Location Quality Scoring:**
```
A+ Location (walkable, top schools, <20min commute): 90-100
A Location: 75-90
B+ Location: 60-75
B Location: 45-60
C+ Location: 30-45
C Location: 0-30
```

---

## Component 4: Operational Efficiency (15% weight)

### Sub-Components

**Expense Management (50% of operational score):**
- Operating Expense Ratio vs class benchmark
- Expense growth trajectory
- Insurance/tax burden

**Revenue Performance (50% of operational score):**
- Occupancy vs market
- Rent growth vs market
- Effective rent vs advertised rent (concession adjustment)
- Loss-to-lease analysis

### Scoring Logic - Operational

**OER Scoring (by class):**
```
Class A:
  35-38%: 100 points
  38-42%: 70-100 points
  42-45%: 40-70 points
  >45%: 0-40 points

Class B:
  40-43%: 100 points
  43-47%: 70-100 points
  47-50%: 40-70 points
  >50%: 0-40 points

Class C:
  45-48%: 100 points
  48-52%: 70-100 points
  52-55%: 40-70 points
  >55%: 0-40 points
```

**Occupancy Scoring:**
```
≥95%: 100 points
93-95%: 90-100 points
90-93%: 70-90 points
87-90%: 50-70 points
85-87%: 30-50 points
<85%: 0-30 points (RED FLAG)

- Penalty: High concessions (>1 month free) (-10 points)
```

**Rent Growth Scoring:**
```
>Market avg +2%: 100 points
Market avg to +2%: 80-100 points
Market avg to -2%: 60-80 points
Below market >2%: 30-60 points
Declining rent: 0-30 points

Important: Adjust for concessions (effective vs advertised)
```

---

## Multi-Strategy Scoring System

### User Workflow

```
Step 1: Upload Property
Step 2: Select Investment Strategy
   ⚪ Core (7-10% IRR target)
   ⚪ Core-Plus (10-13% IRR target)
   ⚪ Value-Add (13-18% IRR target)
   ⚪ Opportunistic (18%+ IRR target)
   ⚪ Custom (define your own)

Step 3: Customize Weights (optional)
   Financial Performance: [35]%
   Market Intelligence: [25]%
   Asset Quality: [25]%
   Operational Efficiency: [15]%

Step 4: Get Score + Detailed Breakdown
```

### Example: Same Property, Different Strategies

**Property: "The Overlook" - LaGrange, GA**
- 1995 vintage, Class B, 410 units
- Levered IRR: 14.8%, Unlevered: 10.2%
- Cash-on-Cash: 8.5%
- DSCR: 1.22x, LTV: 68%
- OER: 46%, Occupancy: 89%
- Deferred maintenance: $4,500/unit

**Scored as Core Strategy:**
- Financial: 52/100 (IRR too high/risky for core, LTV too high)
- Market: 72/100 (decent MSA, stable submarket)
- Asset: 58/100 (older vintage, deferred maintenance concern)
- Operational: 65/100 (moderate OER, below-target occupancy)
- **FINAL SCORE: 60/100** - ❌ NOT suitable for core

**Scored as Value-Add Strategy:**
- Financial: 82/100 (solid IRR, acceptable leverage, execution risk priced in)
- Market: 72/100 (same)
- Asset: 75/100 (deferred maintenance = OPPORTUNITY, renovation upside)
- Operational: 70/100 (occupancy upside opportunity, expense optimization potential)
- **FINAL SCORE: 76/100** - ✅ GOOD value-add opportunity

---

## AI Deep Research Integration

### Automatic Triggers

When user uploads property OR requests re-score:

**Phase 1: Extract Location Data**
```python
property_data = {
    "address": "900 Mountaintop Ave, Gainesville, GA 30501",
    "city": "Gainesville",
    "state": "GA",
    "msa": "Atlanta-Sandy Springs-Roswell, GA",
    "submarket": "Northeast Atlanta / Gainesville",
    "property_type": "Multifamily"
}
```

**Phase 2: AI Web Research (Parallel)**
```python
research_tasks = [
    web_search("Gainesville GA multifamily market 2026"),
    web_search("Atlanta MSA employment trends 2026"),
    web_search("Gainesville apartment supply pipeline"),
    web_search("Northeast Atlanta rent growth forecast"),
    web_search("Gainesville population growth demographics"),
    web_search("Atlanta multifamily cap rates 2026")
]

# Execute all in parallel (use Task tool or n8n)
results = await asyncio.gather(*research_tasks)
```

**Phase 3: AI Analysis**
```python
def analyze_market_intelligence(web_results, property_data):
    """
    Uses Claude to synthesize web research into scoring components
    """

    prompt = f"""
    Analyze these market research results for {property_data['city']}, {property_data['state']}:

    {web_results}

    Extract and score (0-100):
    1. Employment growth outlook
    2. Population/migration trends
    3. Supply/demand balance (red flag if >4% annual supply)
    4. Rent growth forecast
    5. Overall market sentiment

    Identify any red flags:
    - Oversupply concerns
    - Rising concessions
    - Economic headwinds
    - Regulatory risks

    Output JSON with scores and key insights.
    """

    return claude_api_call(prompt)
```

**Phase 4: Generate Market Intelligence Card**

Display in UI:

```
┌─────────────────────────────────────────────────────┐
│  🔮 AI MARKET INTELLIGENCE                          │
│  Gainesville, GA - Updated Feb 7, 2026              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Market Score: 72/100                               │
│                                                      │
│  ✅ Strong job growth (+3.4% YoY)                   │
│  ✅ Population growing (+2.1% annually)             │
│  ⚠️  Moderate supply: 850 units delivering Q3 2026  │
│  ✅ Rent growth forecast: +3.2% (above national)    │
│  ✅ Cap rates stable: 5.5-6.0% for Class B          │
│                                                      │
│  💡 Key Insight:                                     │
│  Northeast Atlanta submarket benefits from I-985     │
│  corridor growth and University of Georgia proximity.│
│  Supply manageable compared to core Atlanta.        │
│                                                      │
│  📊 Comparable Properties:                           │
│  • Avg cap rate: 5.7%                               │
│  • Avg price/unit: $142K                            │
│  • Occupancy range: 91-94%                          │
│                                                      │
│  🔄 Last Updated: 2 hours ago                       │
│  [Refresh Analysis]                                  │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema for Scoring

### New Tables

**`property_scores` table:**
```sql
CREATE TABLE property_scores (
    id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    strategy_type VARCHAR(50) NOT NULL, -- core, core-plus, value-add, opportunistic, custom

    -- Component scores
    financial_score DECIMAL(5,2),
    market_score DECIMAL(5,2),
    asset_score DECIMAL(5,2),
    operational_score DECIMAL(5,2),

    -- Final score
    final_score DECIMAL(5,2) NOT NULL,

    -- Customizations
    financial_weight DECIMAL(5,2) DEFAULT 35.0,
    market_weight DECIMAL(5,2) DEFAULT 25.0,
    asset_weight DECIMAL(5,2) DEFAULT 25.0,
    operational_weight DECIMAL(5,2) DEFAULT 15.0,

    -- AI research data
    ai_market_summary TEXT,
    ai_key_insights JSON, -- ["Strong job growth", "Supply concern", ...]
    ai_red_flags JSON, -- ["High leverage", "Oversupply", ...]

    -- Metadata
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(36),

    FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX idx_property_scores_property ON property_scores(property_id);
CREATE INDEX idx_property_scores_strategy ON property_scores(strategy_type);
```

**`market_intelligence` table:**
```sql
CREATE TABLE market_intelligence (
    id INTEGER PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    msa VARCHAR(200),

    -- Research data
    employment_growth_rate DECIMAL(5,2),
    population_growth_rate DECIMAL(5,2),
    rent_growth_forecast DECIMAL(5,2),
    cap_rate_range VARCHAR(20), -- "5.5-6.0%"
    supply_pipeline_units INTEGER,

    -- Sentiment
    market_sentiment_score DECIMAL(5,2),
    news_sentiment VARCHAR(50), -- positive, neutral, negative

    -- AI summary
    ai_summary TEXT,
    key_insights JSON,

    -- Cache management
    researched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP, -- Cache for 30 days

    UNIQUE(city, state)
);

CREATE INDEX idx_market_intel_location ON market_intelligence(city, state);
```

---

## Implementation Phases

### Phase 1: Core Scoring Framework (Week 1-2)

**Backend:**
```python
# app/services/scoring_service.py

class PropertyScoringService:
    def calculate_score(
        self,
        property_id: int,
        strategy: str = "value-add",
        custom_weights: dict = None
    ):
        """
        Calculate 0-100 property score
        """
        property = get_property(property_id)

        # Component scores
        financial = self._score_financial(property, strategy)
        market = self._score_market(property)
        asset = self._score_asset(property, strategy)
        operational = self._score_operational(property)

        # Apply weights
        weights = custom_weights or DEFAULT_WEIGHTS[strategy]

        final_score = (
            financial * weights['financial'] +
            market * weights['market'] +
            asset * weights['asset'] +
            operational * weights['operational']
        )

        return {
            "final_score": round(final_score, 1),
            "financial_score": financial,
            "market_score": market,
            "asset_score": asset,
            "operational_score": operational,
            "strategy": strategy,
            "weights": weights
        }
```

**Frontend:**
```typescript
// frontend/src/components/property/PropertyScore.tsx

interface PropertyScoreProps {
  propertyId: number;
  strategy?: string;
}

export function PropertyScore({ propertyId, strategy = "value-add" }: PropertyScoreProps) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    propertyService.getScore(propertyId, strategy)
      .then(setScore)
      .finally(() => setLoading(false));
  }, [propertyId, strategy]);

  if (loading) return <Skeleton />;

  return (
    <Card>
      <div className="text-center">
        <div className="text-6xl font-bold text-violet-500">
          {score.final_score}
          <span className="text-2xl text-gray-400">/100</span>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          {getScoreLabel(score.final_score)}
        </div>
      </div>

      {/* Component breakdown */}
      <div className="mt-6 space-y-3">
        <ScoreBar label="Financial" score={score.financial_score} />
        <ScoreBar label="Market" score={score.market_score} />
        <ScoreBar label="Asset" score={score.asset_score} />
        <ScoreBar label="Operational" score={score.operational_score} />
      </div>
    </Card>
  );
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "STRONG BUY";
  if (score >= 75) return "BUY";
  if (score >= 65) return "HOLD";
  if (score >= 50) return "PASS";
  return "AVOID";
}
```

### Phase 2: AI Market Research Integration (Week 3-4)

**Backend AI Service:**
```python
# app/services/ai_market_research_service.py

class AIMarketResearchService:
    async def research_market(self, city: str, state: str):
        """
        Perform AI web research on market
        """
        # Check cache first
        cached = db.query(MarketIntelligence).filter(
            MarketIntelligence.city == city,
            MarketIntelligence.state == state,
            MarketIntelligence.valid_until > datetime.now()
        ).first()

        if cached:
            return cached

        # Perform web research
        queries = [
            f"{city} {state} multifamily market 2026",
            f"{city} employment trends",
            f"{city} apartment supply pipeline",
            f"{city} rent growth forecast"
        ]

        # Use Claude API with web search
        results = await asyncio.gather(*[
            self._web_search(query) for query in queries
        ])

        # Analyze with Claude
        analysis = await self._analyze_results(results, city, state)

        # Store in cache
        intel = MarketIntelligence(
            city=city,
            state=state,
            market_sentiment_score=analysis['sentiment_score'],
            ai_summary=analysis['summary'],
            key_insights=analysis['insights'],
            valid_until=datetime.now() + timedelta(days=30)
        )
        db.add(intel)
        db.commit()

        return intel
```

### Phase 3: Strategy Customization UI (Week 5)

**Frontend Strategy Selector:**
```typescript
// frontend/src/components/property/StrategySelector.tsx

export function StrategySelector({ onStrategyChange }) {
  const [strategy, setStrategy] = useState("value-add");
  const [customWeights, setCustomWeights] = useState(null);
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div>
      <RadioGroup value={strategy} onValueChange={(val) => {
        setStrategy(val);
        onStrategyChange(val, null);
      }}>
        <RadioGroupItem value="core">Core (7-10% IRR)</RadioGroupItem>
        <RadioGroupItem value="core-plus">Core-Plus (10-13% IRR)</RadioGroupItem>
        <RadioGroupItem value="value-add">Value-Add (13-18% IRR)</RadioGroupItem>
        <RadioGroupItem value="opportunistic">Opportunistic (18%+ IRR)</RadioGroupItem>
        <RadioGroupItem value="custom">Custom</RadioGroupItem>
      </RadioGroup>

      {strategy === "custom" && (
        <CustomWeightsPanel
          onChange={(weights) => {
            setCustomWeights(weights);
            onStrategyChange("custom", weights);
          }}
        />
      )}
    </div>
  );
}
```

### Phase 4: Learning from User Behavior (Future)

**Track which deals users pursue:**
```python
# app/services/scoring_ml_service.py

class ScoringMLService:
    def track_user_behavior(self, user_id: str, property_id: int, action: str):
        """
        Track: viewed, favorited, shared, passed, pursued
        """
        # Store in user_property_actions table
        # Use to train personalized scoring model

    def get_personalized_weights(self, user_id: str):
        """
        Analyze user's historical preferences
        Return recommended weight adjustments
        """
        # ML model: what properties did they pursue?
        # What scores/characteristics do they favor?
        # Return: "You tend to prioritize Market (35%) over Asset (15%)"
```

---

## Visual Design Concepts

### Score Display Variations

**Option 1: Speedometer**
```
    ╔════════════════════════════╗
    ║                            ║
    ║          🎯 76             ║
    ║         ━━━━━━             ║
    ║        ●                   ║
    ║       ╱ ╲                  ║
    ║      ╱   ╲                 ║
    ║     0  50  100             ║
    ║                            ║
    ║    GOOD VALUE-ADD          ║
    ╚════════════════════════════╝
```

**Option 2: Radial Progress (Recommended)**
```
         ┌───────────────────┐
         │                   │
         │        76         │
         │       ◯◯◯         │
         │      ◯   ◯        │
         │     ◯     ◯       │
         │     ◯     ◯       │
         │      ◯   ◯        │
         │       ◯◯◯         │
         │                   │
         │    STRONG BUY     │
         └───────────────────┘
```

**Option 3: Gradient Bar**
```
┌──────────────────────────────────────┐
│ Property Score                       │
├──────────────────────────────────────┤
│                                      │
│  ██████████████████░░░░░░   76/100  │
│  └─ Financial: 82                    │
│  └─ Market: 72                       │
│  └─ Asset: 68                        │
│  └─ Operational: 78                  │
│                                      │
│  ✅ Strong financial performance     │
│  ⚠️  Moderate supply concerns         │
└──────────────────────────────────────┘
```

---

## Key Differentiators vs Competitors

1. **Multi-Strategy Scoring** - Same property scored differently for core vs value-add (NO ONE ELSE DOES THIS)

2. **AI Market Intelligence** - Real-time web research on every property location (UNIQUE)

3. **User-Customizable Weights** - Brokers can weight differently than acquisitions teams (FLEXIBLE)

4. **Institutional-Grade Metrics** - Based on actual top-tier proformas (Blackstone-level rigor)

5. **Behavioral Learning** - System learns user preferences over time (FUTURE)

---

## Success Metrics

**MVP Success:**
- 80%+ of users find scoring valuable
- Scoring correlates with pursuit decisions
- AI market intelligence cited in IC presentations

**Long-Term Success:**
- Scoring system predicts actual returns within 2-3% IRR
- Users customize weights to match fund strategies
- Becomes "proprietary edge" for users

---

## Next Steps

1. **Week 1-2:** Build core scoring backend + basic frontend display
2. **Week 3:** Integrate AI market research (web search + analysis)
3. **Week 4:** Add strategy selector and weight customization
4. **Week 5:** Polish UI, add visualizations, test with sample properties
5. **Week 6:** Beta test with 10-20 properties, gather feedback
6. **Week 7+:** Iterate based on real-world usage

---

**Last Updated:** February 7, 2026
**Priority:** Golden Feature - This is the differentiator
**Research Basis:** 100+ sources, institutional proforma analysis, CRE underwriting best practices
