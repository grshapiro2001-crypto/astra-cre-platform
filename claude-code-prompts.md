# Claude Code Session Prompts — February 9, 2026

Drop these files in your project root:
```
/Users/griffinshapiro/Documents/Claude Test/deal-score-spec-v2.md
/Users/griffinshapiro/Documents/Claude Test/comp-matching-logic.md
/Users/griffinshapiro/Documents/Claude Test/deal-score-modal.html
```

---

## PROMPT 1: Phase 1.5 — Update Scoring Engine (Opus)

```
Read these spec documents first:
/Users/griffinshapiro/Documents/Claude Test/deal-score-spec-v2.md
/Users/griffinshapiro/Documents/Claude Test/comp-matching-logic.md

This is the Astra CRE Platform at /Users/griffinshapiro/Documents/Claude Test.
Frontend: /frontend (React+TypeScript at :5173)
Backend: /backend (FastAPI+SQLAlchemy at :8000)

## Task: Update the Deal Score backend from v1 → v2

The scoring engine already exists from Phase 1. We need to update it:

1. REMOVE loss_to_lease from scoring metrics entirely
2. ADD supply_pipeline_pressure as a new metric (see benchmarks in spec)
3. UPDATE UserScoringWeights model:
   - Remove loss_to_lease_weight and cap_rate_weight fields
   - Add supply_pipeline_weight field
   - Add layer weights: layer1_weight (default 30), layer2_weight (default 20), layer3_weight (default 50)
   - Keep economic_occupancy_weight and opex_ratio_weight
4. UPDATE scoring presets in SCORING_PRESETS dict (see spec for all 4 presets)
5. CREATE new database tables:
   - DataBankDocument (for tracking uploaded files)
   - SalesComp (extracted comp data)
   - PipelineProject (extracted pipeline data)
   - SubmarketInventory (user-input inventory denominators)
6. CREATE calculate_supply_pipeline_score() function (see spec for full logic)
7. UPDATE calculate_deal_score() to return the new three-layer response shape
8. ADD new API endpoints:
   - POST /api/v1/data-bank/inventory (set submarket inventory)
   - GET /api/v1/data-bank/inventory (get all inventories)
   - GET /api/v1/data-bank/comps (query comps with filters)
   - GET /api/v1/data-bank/pipeline (query pipeline projects)
9. Run alembic migration for all schema changes
10. CREATE backend/app/services/comp_matching_service.py
    - calculate_relevance(subject, comp) → float (0-1), product of geo × type × vintage × size weights
    - select_comps(subject, all_comps, min=3, target=8, max=15) → list sorted by relevance
    - score_cap_rate_vs_comps(subject_cap, comps) → dict with raw_score, spread_bps, context
    - score_price_per_unit_vs_comps(subject_ppu, comps) → dict with raw_score, pct_diff, context
    - score_vintage_adjustment(subject_vintage, comps) → dict with raw_score, context
    - calculate_layer3_score(subject, user_id, db) → full Layer 3 result dict
    - See "Comp Matching Service" section in the spec for all matching dimensions and scoring curves
11. WIRE comp_matching_service into scoring_service.py — when calculate_deal_score() runs, it should call calculate_layer3_score() for Layer 3

## Important:
- Do NOT delete the existing scoring endpoints — update them in place
- The Phase 1 scoring_service.py has working code — modify it, don't rewrite from scratch
- Weight redistribution: if no comp data exists for a property, redistribute Layer 3 weight to Layers 1 and 2
- For now, Layer 3 (Deal Comp Analysis) can return empty/placeholder — we'll wire the actual comp matching logic next
- Do NOT touch frontend code
- Test by hitting the updated scoring endpoint with curl
```

---

## PROMPT 2: Phase 2 — Frontend Score Display + Modal (Opus)

Run this AFTER Prompt 1 is complete and tested.

```
Read this spec document:
/Users/griffinshapiro/Documents/Claude Test/deal-score-spec-v2.md

Also look at this HTML file for the exact modal design:
/Users/griffinshapiro/Documents/Claude Test/deal-score-modal.html

This is the Astra CRE Platform at /Users/griffinshapiro/Documents/Claude Test.
Frontend: /frontend (React+TypeScript at :5173)
Backend: /backend (FastAPI+SQLAlchemy at :8000)

## Task: Build frontend Deal Score display with clickable modal breakdown

1. CREATE src/services/scoringService.ts
   - getWeights(), updateWeights(), getPresets(), applyPreset()
   - getScore(propertyId), getScores(propertyIds[]) for batch
   - refreshMarketIntel(propertyId)
   - All using the existing API service pattern in the codebase

2. CREATE src/components/scoring/DealScoreBadge.tsx
   - Circular badge showing score number
   - Sizes: sm (40px for library cards), md (64px for detail), lg (80px for comparison)
   - Color coding: 80+: green-400, 60-79: primary (purple), 40-59: yellow-400, 0-39: red-400
   - null/undefined: show "—" in muted style
   - onClick prop to trigger modal open
   - Hover hint "View Details" (see HTML artifact)

3. CREATE src/components/scoring/DealScoreModal.tsx
   - MATCH THE DESIGN in deal-score-modal.html exactly
   - Use Astra purple dark theme tokens from globals.css
   - Three layer sections with metric rows, bars, and scores
   - Supply pipeline detail breakdown
   - Market intelligence with AI rationale text
   - Deal comp table
   - Sources footer with purple tags for user data, gray for API data
   - Warning callouts for lease-up or missing data
   - Close on overlay click or Escape key
   - Animated metric bars on open

4. INTEGRATE into Property Detail page
   - Add DealScoreBadge (size md) in the property header area
   - Click badge → open DealScoreModal
   - Fetch score on page mount
   - Handle loading state (skeleton/shimmer)
   - Handle error state (show "—" badge)

5. INTEGRATE into Library page
   - Add DealScoreBadge (size sm) to each property card
   - Batch fetch scores for all visible properties
   - Handle properties without enough data gracefully (show "—")

## Design Rules:
- Use JetBrains Mono for all numeric/score display
- DM Sans for all other text
- Use existing shadcn components where possible
- Purple theme tokens — reference globals.css
- framer-motion for modal enter/exit animations if available, otherwise CSS transitions
- After changes: npx tsc --noEmit → npm run build → npm run dev → STOP
```

---

## PROMPT 3: Data Bank Extraction Service (Opus) — OPTIONAL TONIGHT

Only run this if Prompts 1 and 2 went smoothly. This can wait for a future session.

```
Read this spec document:
/Users/griffinshapiro/Documents/Claude Test/deal-score-spec-v2.md

Also read the extraction prototype (for reference, do NOT copy it directly):
/Users/griffinshapiro/Documents/Claude Test/extraction_prototype.py

This is the Astra CRE Platform at /Users/griffinshapiro/Documents/Claude Test.
Backend: /backend (FastAPI+SQLAlchemy at :8000)

## Task: Build the Data Bank extraction service

1. CREATE backend/app/services/extraction_service.py (or update existing)
   - detect_document_type(filepath) → "sales_comps" | "pipeline_tracker" | "underwriting_model" | "unknown"
   - extract_sales_comps(filepath) → list of comp dicts
   - extract_pipeline_tracker(filepath) → list of project dicts
   - extract_underwriting_model(filepath) → property financial data dict

2. CREATE API endpoint: POST /api/v1/data-bank/upload
   - Accept file upload (multipart form)
   - Save file, detect type, run extraction
   - Store DataBankDocument record with extraction_status
   - For sales_comps: parse → store in SalesComp table
   - For pipeline_tracker: parse → store in PipelineProject table
   - For underwriting_model: parse → store in extraction_data JSON field
   - Return extraction results for user confirmation

3. CREATE API endpoint: GET /api/v1/data-bank/documents
   - List all uploaded documents for current user
   - Include extraction status and summary

4. The extraction approach should be INTENT-BASED:
   - For tabular files (comps, pipeline): detect header row by matching CRE vocabulary
   - For models: classify sheets by name, read summary/output sheets, find metrics by label matching
   - Do NOT hardcode cell references
   - Use openpyxl with data_only=True for formula results

5. Handle edge cases:
   - .xlsx and .xlsm files
   - Split header rows (header across 2 rows)
   - Year built with renovation year ("1987/2017")
   - Cap rate as decimal (0.055) vs percentage (5.5%)
   - TBD / N/A values in cap rate fields
   - Market name normalization (strip trailing spaces)

## Do NOT touch frontend code.
## Test with curl — upload a sample file and verify extraction results.
```

---

## Notes for Tonight

1. **Start with Prompt 1** — it's the smallest change and updates the foundation
2. **Then Prompt 2** — this is the big one, gets scores visible in the app
3. **Prompt 3 is optional** — nice to have but the extraction service can wait
4. **Copy deal-score-spec-v2.md AND deal-score-modal.html into your project root before starting**
5. **Use Opus for all prompts** — this is architecture-level work
6. After Phase 2, you can start the calibration loop: load real deals, check scores, adjust
