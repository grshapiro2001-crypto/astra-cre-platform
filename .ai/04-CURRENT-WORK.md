# Current Work - Astra CRE Platform

**Purpose:** What am I working on RIGHT NOW? Update this daily or per session.
**Length:** Keep under 150 lines. Archive completed work.
**Last Updated:** March 8, 2026

---

## Just Completed (Feb 26 – Mar 8, 2026)

### 🏗 3D Stacking Viewer — Full Feature Build (PRs #62–94, ~50 commits)
**The biggest single feature shipped.** An interactive Three.js 3D building model wired directly to rent roll data.

- ✅ **Phase 1** (PR #62): Base 3D model — linear, L-shape, U-shape, courtyard, tower building geometries
- ✅ **Phase 2** (PR #63–65): Satellite auto-generation for layout inference; connected building / wing detection
- ✅ **Phase 2.3–2.5** (PRs #66–68): Investor-grade visual polish — glass materials, unit labels, LTL guards, tooltip, as-of date; filter sidebar with floor plan type checkboxes
- ✅ **Tier 3** (PR #79): Fullscreen mode, floor isolation, keyboard shortcuts, duplicate unit fix
- ✅ **Tier 4** (PRs #80–82): Analyst workflow — unit click → side panel, LOD labels, multi-compare, glass materials; independent raycast for click precision
- ✅ **Rent Roll Parser Rewrite** (PRs #69–73, #83, #86): Complete rewrite for charge-code sub-rows, charge code column misidentification fix, unit dedup, floor-aware mapping
- ✅ **Floor Plan Extraction** (PRs #84–85): Upload screenshots → extract unit position map; `unit_position_map_json` column added, auto-migration added to `main.py`
- ✅ **Floor Plan Overlay** (PR #94): 2D overlay mode alongside 3D viewer — floor tabs, image display, colored unit markers; toggle between "3D Model" and "Floor Plan"
- ✅ **Proportional Unit Sizing** (PR #93): Unit widths proportional to sqft (0.5x–2.0x clamped)
- ✅ **Unit Matching Fixes** (PRs #87–92): Floor inference logic, ground floor (0xx) support, position map priority for label assignment, glass pane removal for unmatched units, camera framing tightened to unit bounding box

### 📊 Market Research + Layer 2 Scoring (PR #50)
- ✅ Market research PDF extraction pipeline
- ✅ Layer 2 AI sentiment scoring wired to market research documents

### 🏢 Organizations Feature (PRs #46–49)
- ✅ Team workspaces with invite flow
- ✅ Organization context surfaced on Dashboard and Library
- ✅ `OrganizationSettings` page added (`/organization`)
- ✅ MigrateDealModal for moving deals between orgs
- ✅ Black screen fix on `/organization` when API fails

### 🔧 Critical Bug Fixes
- ✅ **BUG-005 FIXED** (PR #61): Kanban `moveDeal` now persists to DB with org-level template selection
- ✅ T12 Excel upload extraction (PRs #56–60): Fuzzy matching engine with Claude AI fallback
- ✅ Async re-analyze endpoint (PR #55): Fixed Render HTTP timeout
- ✅ PDF memory spike fix (PR #56): Stays under 512 MB
- ✅ Rent roll in_place_rent derivation from charge_details (PR #71)

### 🆕 New Pages
- `Welcome.tsx` — Post-onboarding welcome
- `Landing.tsx` — Public landing page
- `OrganizationSettings.tsx` — Team/org management
- `ErrorBoundary.tsx` — React error boundary (wraps app)

### 🆕 New Backend Services
- `stacking_extraction_service.py` — Satellite image analysis → building layout
- `floor_plan_extraction_service.py` — Floor plan screenshot → unit position map
- `market_research_extraction_service.py` — Market research PDF → sentiment data
- `market_sentiment_scoring_service.py` — Layer 2 scoring from market research
- `excel_extraction_service.py` — T12 Excel upload extraction
- `geocoding_service.py` — Address → lat/lng for map markers
- `t12_taxonomy.py` — T12 field taxonomy for fuzzy matching

---

## Current State (Mar 8, 2026)

**Production URL:** https://astra-cre-platform.vercel.app
**Backend:** https://astra-cre-backend.onrender.com
**Latest Deployment:** PR #94 — READY ✅ (Vercel confirmed)
**Current PR:** #94 (last merged)
**TypeScript:** Clean (last confirmed Feb 26, no regressions expected)
**Total PRs Merged (all time):** 94
**PRs Merged Since Feb 26:** 47+

---

## Open Bugs (Carry-forward — See QA-AUDIT.md)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| BUG-001 | Google Maps API loaded multiple times | Critical | Open |
| BUG-002 | Google Maps retired API v3.55 | Critical | Open |
| BUG-003 | "Add Note" silently drops data | Critical | Open |
| BUG-004 | "Ask Follow-up" button inert | Critical | Open |
| BUG-005 | Kanban moveDeal not persisted | High | **FIXED PR #61** |
| BUG-006 | "Save Comparison" doesn't save | High | Open |
| BUG-007 | NOI chart shows "---" when T12 null | High | Open |
| BUG-008 | Settings "Save Changes" disabled | High | Open |
| BUG-009 | Dashboard metrics fluctuate cold start | Medium | Open (PR #41 pending) |
| BUG-010 | Notification bell non-functional | Medium | Open |
| BUG-011 | Notification prefs local only | Medium | Open |
| BUG-012 | Debug console.logs in prod | Low | Open |
| BUG-013 | API key labeled as placeholder | Low | Open |

---

## Immediate Priorities (Mar 8, 2026)

1. **Build Command Center** — Admin-only `/command-center` route (in progress)
2. **Fix BUG-001 + BUG-002** — Google Maps API loaded multiple times + retire v3.55
3. **Fix BUG-003** — "Add Note" persistence via `POST /api/v1/properties/{id}/notes`
4. **Fix BUG-004** — Wire "Ask Follow-up" to Claude chat API
5. **Fix BUG-006** — "Save Comparison" needs to POST to `/api/v1/comparisons`
6. **Fix BUG-007** — NOI chart fallback: T12 null → T3 → Y1
7. **Fix BUG-008** — Settings "Save Changes" dirty-state tracking

---

## Architecture Quick Reference

### Backend
- FastAPI + SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
- 14+ DB tables, 9 API route prefixes, 18+ services
- LLM calls: upload extraction, re-analyze, data-bank Excel, chat, market research, floor plan extraction
- Model: `claude-sonnet-4-5-20250929`
- GOTCHA: `base_url="https://api.anthropic.com"` must be hardcoded in claude_extraction_service.py

### Frontend
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand
- **11 pages**, 60+ components, 8+ services
- New major component: `StackingViewer3D.tsx` (Three.js, ~2000+ lines)
- Path alias: `@` → `frontend/src/`
- Design: purple theme only (`bg-primary`, never `bg-emerald-*`)
