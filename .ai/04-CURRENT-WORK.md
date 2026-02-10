# Current Work - Astra CRE Platform

**Purpose:** What am I working on RIGHT NOW? Update this daily or per session.
**Length:** Keep under 100 lines. Archive completed work.

---

## Just Completed (Feb 10, 2026)

### Schema Expansion & Extraction Pipeline
- ✅ Added `property_unit_mix` table (floorplan, bedrooms, bathrooms, rents, renovation premium)
- ✅ Added `property_rent_comps` table (comps extracted FROM the OM document)
- ✅ Added `metro` field to properties (fixes comp matching)
- ✅ Added renovation fields (cost/unit, total cost, rent premium, ROI, duration)
- ✅ Added granular T12/T3/Y1 financial line items (40+ fields)
- ✅ Wired extraction pipeline end-to-end for all new fields

### Progressive Empty States
- ✅ PropertyDetail now shows what's available vs missing
- ✅ Unit mix table with "No unit mix data" fallback
- ✅ Rent comps section with "No rent comps" fallback
- ✅ Renovation card with empty state when no renovation data
- ✅ "—" displayed for null/undefined numeric values

### Deal Score v2
- ✅ Three-layer architecture implemented
  - Layer 1: Property Fundamentals (economic occupancy, opex ratio, supply pipeline)
  - Layer 2: Market Intelligence (AI sentiment score, cached on property)
  - Layer 3: Deal Comp Analysis (relevance-weighted comp matching)
- ✅ Configurable scoring weights via Settings
- ✅ Four presets (Value-Add, Cash Flow, Core, Opportunistic)
- ✅ Color-coded badges (green/yellow/red based on score)
- ✅ Sortable comparison table by deal score

### Data Bank Feature
- ✅ Excel upload with Claude-powered extraction
- ✅ Sales comps table (properties sold in the market)
- ✅ Pipeline projects table (developments in progress)
- ✅ Submarket inventory (user-input denominators for supply pressure)
- ✅ Document tracking (uploaded files, extraction status, record count)
- ✅ Three tabs: Inventory, Sales Comps, Pipeline Projects
- ✅ Comp matching service uses Data Bank for Layer 3 scoring

### Comparison Page Enhancements
- ✅ Wired to real API (`/api/v1/properties/compare`)
- ✅ Gradient highlighting (best=green, worst=red, middle=yellow)
- ✅ Investment criteria filtering (highlight rows by user-selected metrics)
- ✅ CSV export of comparison data
- ✅ Deal score column with sortable badges

### QA & Bug Fixes
- ✅ Comp matching now uses metro field (previously was matching incorrectly)
- ✅ Fixed empty state UI inconsistencies across PropertyDetail
- ✅ Updated all documentation to reflect Feb 10 state

---

## Next Priority

### Upload Test & Validation
1. **Upload 1160 Hammond test file** - Verify extraction pipeline with real OM
2. **Validate all new fields extract correctly**:
   - Unit mix rows
   - Rent comps
   - Renovation assumptions
   - Metro field
   - Granular financials
3. **Check progressive empty states** work when fields are missing

### Google Maps Integration
- **PropertyDetail location section** - Currently shows static address text
- **Add Google Maps embed** or static map image
- **Requirements**: Google Maps API key (not currently in .env)

### Dashboard Enhancement
- **Use new schema fields** in dashboard metrics and charts
- **Show unit mix summary** in deal cards
- **Display renovation status** in pipeline board

---

## Known Issues

1. **`_cffi_backend` environment dependency warning** on backend startup (pre-existing, non-blocking)
2. **No migrations folder** - Database schema changes are manual (consider adding Alembic migrations)
3. **Tag filtering on Dashboard** - UI exists but functionality not fully implemented

---

## Active Phase

**Phase:** Active Development - OM Extraction Pipeline + Deal Scoring
**Status:** Core features implemented, testing phase

---

## Architecture Notes

### Database Schema (Feb 10, 2026)
**Core Tables (11):**
1. `users`
2. `properties` (with 40+ financial fields)
3. `property_unit_mix` (NEW)
4. `property_rent_comps` (NEW)
5. `deal_folders`
6. `bov_pricing_tiers`
7. `bov_cap_rates`
8. `sales_comps`
9. `pipeline_projects`
10. `submarket_inventory`
11. `user_scoring_weights`
12. `analysis_logs`
13. `data_bank_documents`

### API Routes (6 prefixes)
- `/api/v1/auth` - Authentication
- `/api/v1/upload` - PDF upload and extraction
- `/api/v1/properties` - Property CRUD, reanalysis, comparison
- `/api/v1/deal-folders` - Folder management
- `/api/v1/scoring` - Deal scoring system
- `/api/v1/data-bank` - Data Bank (comps, pipeline, inventory, uploads)

---

## Before Next Session

**Read These First:**
1. `.ai/01-CORE-RULES.md` - Coding standards
2. `.ai/03-CODEBASE.md` - What exists (don't rebuild!)
3. This file - Current priorities

**Test Before Building:**
1. Upload test OM (1160 Hammond)
2. Verify all extraction fields populate
3. Check PropertyDetail displays correctly
4. Test comparison with real data

---

**Last Updated:** February 10, 2026
**Token Count:** ~500 (lightweight for context)
