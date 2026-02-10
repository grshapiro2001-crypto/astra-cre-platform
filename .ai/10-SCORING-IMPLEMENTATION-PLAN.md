# Property Scoring System - Implementation Plan
**Status:** Ready to Build
**Priority:** 9/10 (Golden Feature)
**Timeline:** 2-3 weeks
**Plugs Into:** Existing Comparison page + Deal Score UI

---

## Why This First?

You already have the UI built:
- **Comparison page** has a "Deal Score" column (currently empty)
- **Property cards** have space for scores
- **Library view** can display scores

This isn't net-new UI work — it's **filling in existing placeholders** with real logic.

---

## Lean Implementation (No Fluff)

### Week 1: Core Scoring Engine

**Backend (Python/FastAPI)**

```python
# backend/services/scoring_service.py
class PropertyScoringService:
    """Calculate 0-100 property scores based on financial metrics"""

    WEIGHTS = {
        'financial': 0.35,
        'market': 0.25,
        'asset': 0.25,
        'operational': 0.15
    }

    def calculate_score(self, property_id: int, strategy: str = 'value-add') -> dict:
        """Main scoring function"""
        prop = self.db.query(Property).get(property_id)

        scores = {
            'financial': self._score_financial(prop),
            'market': self._score_market(prop),
            'asset': self._score_asset(prop),
            'operational': self._score_operational(prop)
        }

        final = sum(score * self.WEIGHTS[key] for key, score in scores.items())

        return {
            'final_score': round(final, 1),
            'components': scores,
            'strategy': strategy
        }

    def _score_financial(self, prop) -> float:
        """Financial metrics: IRR, Cash-on-Cash, Cap Rate"""
        score = 0

        # IRR (0-40 points)
        if prop.levered_irr:
            if prop.levered_irr >= 18: score += 40
            elif prop.levered_irr >= 15: score += 30
            elif prop.levered_irr >= 12: score += 20
            else: score += 10

        # Cash-on-Cash (0-30 points)
        if prop.cash_on_cash:
            if prop.cash_on_cash >= 10: score += 30
            elif prop.cash_on_cash >= 8: score += 20
            else: score += 10

        # Cap Rate (0-30 points)
        if prop.t12_cap_rate:
            if prop.t12_cap_rate >= 6: score += 30
            elif prop.t12_cap_rate >= 5: score += 20
            else: score += 10

        return min(score, 100)

    def _score_market(self, prop) -> float:
        """Market factors: location, growth, supply/demand"""
        score = 50  # Base score (neutral market)

        # Adjust based on known market indicators
        if prop.submarket_growth == 'high': score += 25
        elif prop.submarket_growth == 'low': score -= 15

        if prop.location_quality == 'premium': score += 25
        elif prop.location_quality == 'standard': score += 10

        return max(0, min(score, 100))

    def _score_asset(self, prop) -> float:
        """Asset quality: condition, age, amenities"""
        score = 50  # Base score

        if prop.year_built:
            age = 2026 - prop.year_built
            if age < 10: score += 30
            elif age < 20: score += 15
            elif age > 40: score -= 15

        if prop.condition == 'excellent': score += 20
        elif prop.condition == 'good': score += 10
        elif prop.condition == 'poor': score -= 20

        return max(0, min(score, 100))

    def _score_operational(self, prop) -> float:
        """Operational efficiency: DSCR, occupancy, expenses"""
        score = 0

        # DSCR (0-40 points)
        if prop.dscr:
            if prop.dscr >= 1.35: score += 40
            elif prop.dscr >= 1.25: score += 30
            elif prop.dscr >= 1.20: score += 20
            else: score += 10

        # Occupancy (0-35 points)
        if prop.occupancy:
            if prop.occupancy >= 95: score += 35
            elif prop.occupancy >= 90: score += 25
            elif prop.occupancy >= 85: score += 15
            else: score += 5

        # Expense ratio (0-25 points)
        if prop.expense_ratio:
            if prop.expense_ratio <= 35: score += 25
            elif prop.expense_ratio <= 45: score += 15
            else: score += 5

        return min(score, 100)
```

**API Endpoint**

```python
# backend/routers/properties.py

@router.post("/properties/{property_id}/score")
async def score_property(
    property_id: int,
    strategy: str = 'value-add',
    db: Session = Depends(get_db)
):
    """Calculate property score"""
    service = PropertyScoringService(db)
    score = service.calculate_score(property_id, strategy)

    # Save to database
    db_score = PropertyScore(
        property_id=property_id,
        strategy_type=strategy,
        financial_score=score['components']['financial'],
        market_score=score['components']['market'],
        asset_score=score['components']['asset'],
        operational_score=score['components']['operational'],
        final_score=score['final_score']
    )
    db.add(db_score)
    db.commit()

    return score
```

**Database Migration**

```python
# Add to existing properties table
ALTER TABLE properties ADD COLUMN current_score DECIMAL(5,2);
ALTER TABLE properties ADD COLUMN score_strategy VARCHAR(50);

# New table for score history
CREATE TABLE property_scores (
    id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    financial_score DECIMAL(5,2),
    market_score DECIMAL(5,2),
    asset_score DECIMAL(5,2),
    operational_score DECIMAL(5,2),
    final_score DECIMAL(5,2) NOT NULL,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

---

### Week 2: Frontend Integration

**Add Score to Property Cards**

```tsx
// frontend/src/components/PropertyCard.tsx

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const [isScoring, setIsScoring] = useState(false);

  const handleScore = async () => {
    setIsScoring(true);
    try {
      const response = await fetch(`/api/properties/${property.id}/score`, {
        method: 'POST'
      });
      const score = await response.json();
      // Update local state or refetch
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <Card>
      {/* Existing property card content */}

      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Deal Score</span>
          {property.current_score ? (
            <ScoreBadge score={property.current_score} />
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleScore}
              disabled={isScoring}
            >
              {isScoring ? 'Scoring...' : 'Calculate Score'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
```

**Score Badge Component**

```tsx
// frontend/src/components/ScoreBadge.tsx

interface ScoreBadgeProps {
  score: number;
  showBreakdown?: boolean;
}

export function ScoreBadge({ score, showBreakdown = false }: ScoreBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600 bg-green-100';
    if (s >= 60) return 'text-blue-600 bg-blue-100';
    if (s >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-sm",
      getScoreColor(score)
    )}>
      <TrendingUp className="h-4 w-4" />
      <span>{score.toFixed(1)}</span>
    </div>
  );
}
```

**Add to Comparison Page**

The Comparison page already has a "Deal Score" column — just populate it:

```tsx
// frontend/src/pages/ComparePage.tsx

// In the table body
<TableCell>
  {property.current_score ? (
    <ScoreBadge score={property.current_score} />
  ) : (
    <Button variant="ghost" size="sm" onClick={() => scoreProperty(property.id)}>
      Score
    </Button>
  )}
</TableCell>
```

---

### Week 3: Polish & Strategy Support

**Strategy Selector**

```tsx
// frontend/src/components/StrategySelector.tsx

export function StrategySelector({ onStrategyChange }: Props) {
  const strategies = [
    { value: 'core', label: 'Core', description: 'Stabilized assets, 7-10% IRR' },
    { value: 'core-plus', label: 'Core+', description: 'Light repositioning, 10-13% IRR' },
    { value: 'value-add', label: 'Value-Add', description: 'Active management, 13-18% IRR' },
    { value: 'opportunistic', label: 'Opportunistic', description: 'Development, 18%+ IRR' }
  ];

  return (
    <Select onValueChange={onStrategyChange} defaultValue="value-add">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Investment Strategy" />
      </SelectTrigger>
      <SelectContent>
        {strategies.map(s => (
          <SelectItem key={s.value} value={s.value}>
            <div>
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.description}</div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Score Breakdown Modal**

```tsx
// frontend/src/components/ScoreBreakdown.tsx

export function ScoreBreakdown({ score }: { score: PropertyScoreDetail }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Score Breakdown</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ScoreBar
            label="Financial Performance"
            score={score.financial_score}
            weight={35}
          />
          <ScoreBar
            label="Market Intelligence"
            score={score.market_score}
            weight={25}
          />
          <ScoreBar
            label="Asset Quality"
            score={score.asset_score}
            weight={25}
          />
          <ScoreBar
            label="Operational Efficiency"
            score={score.operational_score}
            weight={15}
          />

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Final Score</span>
              <ScoreBadge score={score.final_score} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## What We're NOT Building (Yet)

✅ **Keep It Simple:**
- ❌ AI web search for market intelligence (add later)
- ❌ Custom weight adjustments (use defaults first)
- ❌ Historical score tracking (save for Phase 2)
- ❌ Automated re-scoring (manual trigger is fine)
- ❌ Multi-scenario comparison (single strategy per deal first)

---

## Testing Checklist

**Week 1:**
- [ ] Score calculation endpoint returns 0-100 score
- [ ] Financial component uses IRR, Cash-on-Cash, Cap Rate
- [ ] Score saves to database
- [ ] Can retrieve historical scores

**Week 2:**
- [ ] Property cards display score or "Calculate" button
- [ ] Clicking "Calculate" triggers API call
- [ ] Score badge colors match ranges (green/blue/yellow/red)
- [ ] Comparison page Deal Score column populates

**Week 3:**
- [ ] Strategy selector changes scoring logic
- [ ] Score breakdown modal shows component scores
- [ ] Scores update when property metrics change
- [ ] Mobile responsive

---

## Success Metrics

**Launch Criteria:**
1. Every property can be scored with one click
2. Score displays in Library and Comparison views
3. Score breakdown shows 4 components
4. Scoring completes in < 2 seconds

**Usage Goals (First Month):**
- Score at least 20 properties
- Compare scores across 5+ deals
- Identify patterns (high-scoring deals vs low-scoring)

---

## Future Enhancements (Phase 2)

Once this is working and being used:

1. **AI Market Research** - Web search for submarket data
2. **Custom Weights** - Let users adjust component weights
3. **Score History** - Track how scores change over time
4. **Auto-scoring** - Score new uploads automatically
5. **Benchmarking** - Compare to portfolio averages

---

## Implementation Order

```
Day 1-2:   Backend scoring logic + tests
Day 3-4:   API endpoint + database migration
Day 5-7:   Property card integration
Day 8-10:  Comparison page integration
Day 11-12: Score breakdown modal
Day 13-14: Strategy selector
Day 15:    End-to-end testing
```

---

## Key Files to Modify

**Backend:**
- `backend/services/scoring_service.py` (NEW)
- `backend/routers/properties.py` (add endpoint)
- `backend/models.py` (add PropertyScore model)
- `backend/migrations/` (add score tables)

**Frontend:**
- `frontend/src/components/ScoreBadge.tsx` (NEW)
- `frontend/src/components/ScoreBreakdown.tsx` (NEW)
- `frontend/src/components/PropertyCard.tsx` (modify)
- `frontend/src/pages/ComparePage.tsx` (modify)
- `frontend/src/pages/LibraryPage.tsx` (modify)

---

## Bottom Line

This is **2-3 weeks of focused work** that fills in existing UI placeholders with real functionality. No AI complexity, no automation, no chatbot. Just: click button → get score → make better decisions.

You can implement this **right now** with what you have. Ship it, get feedback, iterate.
