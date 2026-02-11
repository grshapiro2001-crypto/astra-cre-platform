# Current Work - Astra CRE Platform

**Purpose:** What am I working on RIGHT NOW? Update this daily or per session.
**Length:** Keep under 150 lines. Archive completed work.
**Last Updated:** February 11, 2026

---

## Just Completed (Feb 11, 2026)

### Documentation Overhaul
- ✅ Rewrote README.md in professional open-source style
  - Hero section with description
  - Comprehensive feature list (14 feature categories)
  - Detailed tech stack breakdown (frontend, backend, APIs)
  - Getting started guide with step-by-step setup
  - Project structure tree
  - Environment variables table
  - API overview with all endpoint groups
- ✅ Updated `.ai/01-CORE-RULES.md` with current development practices
  - Added checks: Run `npx tsc --noEmit` and `npm run build` after frontend changes
  - Added Alembic workflow for schema changes
  - Updated tech stack versions
  - Added common gotchas section
- ✅ Updated `.ai/03-CODEBASE.md` with accurate architecture
  - Complete backend structure (13 models, 8 route files, 12 services)
  - Complete frontend structure (8 pages, 50+ components, 8 services)
  - Key data flows documented
  - Known issues catalogued
- ✅ Updated `.ai/04-CURRENT-WORK.md` (this file) with current status

### First-Run Onboarding Wizard
- ✅ Created `OnboardingWizard.tsx` component with 4-step wizard
  - Step 1: Welcome screen with value props
  - Step 2: Set investment criteria (optional)
  - Step 3: Upload first document (optional)
  - Step 4: Completion screen with quick links
- ✅ Integrated onboarding into App.tsx
- ✅ Added restart option to Settings page

---

## Previously Completed (Feb 10, 2026)

### Schema Expansion & Extraction Pipeline
- ✅ Added `property_unit_mix` table (floorplan, bedrooms, bathrooms, rents)
- ✅ Added `property_rent_comps` table (comps extracted FROM the OM document)
- ✅ Added `metro` field to properties (fixes comp matching)
- ✅ Added renovation fields (cost/unit, total cost, rent premium, ROI, duration)
- ✅ Added granular T12/T3/Y1 financial line items (40+ fields)
- ✅ Added screening fields (screening_verdict, screening_score, screening_details_json)
- ✅ Added pipeline management fields (pipeline_stage, pipeline_notes, pipeline_updated_at)
- ✅ Wired extraction pipeline end-to-end for all new fields

### Progressive Empty States
- ✅ PropertyDetail shows what's available vs missing
- ✅ Unit mix table with "No unit mix data" fallback
- ✅ Rent comps section with "No rent comps" fallback
- ✅ Renovation card with empty state when no renovation data
- ✅ "—" displayed for null/undefined numeric values

### Deal Score System (Three-Layer)
- ✅ Three-layer architecture implemented
  - Layer 1 (30%): Property Fundamentals (economic occupancy, opex ratio, supply pipeline)
  - Layer 2 (20%): Market Intelligence (AI sentiment score, cached on property)
  - Layer 3 (50%): Comp Analysis (relevance-weighted comp matching)
- ✅ Configurable scoring weights via Settings
- ✅ Four presets (Value-Add, Cash Flow, Core, Opportunistic)
- ✅ Color-coded badges (green/yellow/red based on score)
- ✅ Sortable comparison table by deal score
- ✅ Deal score modal with detailed breakdown

### Investment Criteria & Screening
- ✅ `UserInvestmentCriteria` model for thresholds
- ✅ Screening service evaluates properties against criteria
- ✅ Pass/Fail/Review verdicts on property cards
- ✅ Screening modal with detailed breakdown
- ✅ Investment criteria form in Settings

### Data Bank Feature
- ✅ Excel upload with Claude-powered column classification
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
- ✅ Radar chart for multi-metric comparison

### Dashboard Enhancements
- ✅ Time-of-day greeting personalization
- ✅ Pipeline Kanban board with customizable stages
- ✅ Real API integration with properties and folders
- ✅ Key metrics cards (NOI, cap rate, property count, folder count)
- ✅ Geographic distribution bar chart

---

## Next Priority

### End-to-End Upload Testing
1. **Upload 1160 Hammond test file** - Verify extraction pipeline with real OM
2. **Validate all new fields extract correctly**:
   - Unit mix rows
   - Rent comps
   - Renovation assumptions
   - Metro field
   - Granular financials
   - Screening evaluation
3. **Check progressive empty states** work when fields are missing
4. **Test onboarding flow** for new users

### Merge Conflict Resolution
- **Review all feature branches** and resolve conflicts with main
- **Ensure database migrations** are in correct order
- **Test full application** after merge

### Production Deployment Planning
- **Environment configuration** for production
- **Database migration strategy** (SQLite vs PostgreSQL)
- **API key management** (secure storage for ANTHROPIC_API_KEY)
- **CORS configuration** for production domains
- **Frontend build optimization** (Vite build)
- **Backend deployment** (Render, Railway, or similar)
- **Frontend deployment** (Vercel, Netlify, or similar)

---

## Known Issues

### Critical
- [ ] Need to re-upload 1160 Hammond OM to test unit_mix/rent_comps pipeline
- [ ] ANTHROPIC_API_KEY env var override issue

### Medium Priority
- [ ] "Add Note" button doesn't persist notes (PropertyDetail line 1466)
- [ ] "Ask Follow-up" button has no onClick handler (PropertyDetail line 1783)
- [ ] "Save Comparison" button closes modal without saving form data (ComparisonPage line 1886)
- [ ] Kanban `moveDeal` only console.logs (Dashboard line 499)
- [ ] Settings page "Save Changes" button permanently disabled
- [ ] Notification bell has no handler (Header component)
- [ ] Sidebar pipeline stats hardcoded ($24.5M, 12 Active Deals - needs API)

### Low Priority
- [ ] 6 debug console.logs need removal
- [ ] Tag filtering on Dashboard not fully implemented
- [ ] `_cffi_backend` environment dependency warning on backend startup (pre-existing, non-blocking)

---

## Active Phase

**Phase:** Documentation + Onboarding + Pre-Deployment Testing
**Status:** Documentation complete, onboarding wizard complete, ready for testing and deployment planning

---

## Architecture Notes

### Database Schema (Feb 11, 2026)
**Core Tables (13):**
1. `users` - User accounts
2. `properties` (~80 columns) - Core property table with 40+ financial fields
3. `property_unit_mix` - Unit mix rows extracted from OM
4. `property_rent_comps` - Rent comps extracted from OM
5. `deal_folders` - Deal folder organization
6. `bov_pricing_tiers` - Multi-tier pricing scenarios
7. `bov_cap_rates` - Cap rates linked to tiers
8. `sales_comps` - User-uploaded sales comp records
9. `pipeline_projects` - User-uploaded pipeline/development projects
10. `submarket_inventory` - User-input inventory denominators
11. `user_scoring_weights` - Configurable scoring weights
12. `user_investment_criteria` - Investment thresholds for screening
13. `analysis_logs` - Audit log of extraction operations
14. `data_bank_documents` - Uploaded Excel file tracking

**Migrations:** 12 migration files tracking schema evolution

### API Routes (8 prefixes)
- `/api/v1/auth` - Authentication (register, login, logout, me)
- `/api/v1/upload` - PDF upload and extraction (USES LLM)
- `/api/v1/properties` - Property CRUD, reanalysis, comparison
- `/api/v1/deal-folders` - Folder management
- `/api/v1/scoring` - Deal scoring system (weights, presets, scoring)
- `/api/v1/criteria` - Investment criteria and screening
- `/api/v1/data-bank` - Data Bank (comps, pipeline, inventory, uploads)
- `/api/v1/chat` - AI Pipeline Analyst chat (USES LLM)

### Frontend Routes (8 pages)
- `/` - Dashboard (Kanban board, metrics cards)
- `/library` - Property library (grid/list view)
- `/upload` - PDF upload page
- `/properties/:id` - Property detail view
- `/comparisons` - Side-by-side comparison
- `/data-bank` - Data bank management
- `/folders/:id` - Folder detail view
- `/settings` - User settings (scoring weights, criteria)

---

## Before Next Session

**Read These First:**
1. `.ai/01-CORE-RULES.md` - Coding standards and development practices
2. `.ai/03-CODEBASE.md` - What exists (don't rebuild!)
3. This file - Current priorities and active work

**Test Before Deploying:**
1. Upload test OM (1160 Hammond) and verify extraction
2. Test onboarding flow for new users
3. Run `npx tsc --noEmit` and `npm run build` to verify no errors
4. Test all key features: upload, scoring, screening, comparison, data bank
5. Verify all API endpoints work correctly

**Deployment Checklist:**
- [ ] Set up production environment variables
- [ ] Configure production database (SQLite or PostgreSQL)
- [ ] Set up CORS for production domain
- [ ] Build and test frontend production build
- [ ] Set up backend hosting (Render, Railway, etc.)
- [ ] Set up frontend hosting (Vercel, Netlify, etc.)
- [ ] Test full application in production environment

---

**Token Count:** ~650 (lightweight for context)
