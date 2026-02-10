# Codebase Inventory - Astra CRE Platform

**Purpose:** Quick reference of what EXISTS. Check this BEFORE building anything new.
**Update:** Add new files/components as you create them.
**Last Updated:** February 10, 2026

---

## Backend Structure

### Models (`backend/app/models/`)

**`property.py`** - 175 lines
- `Property` model - Core property table with 40+ financial fields
  - Core: id, user_id, deal_folder_id, deal_name, uploaded_filename, upload_date
  - Document: document_type, document_subtype
  - Property info: property_address, property_type, submarket, metro, year_built, total_units, total_residential_sf
  - Rents: average_market_rent, average_inplace_rent
  - Renovation: renovation_cost_per_unit, renovation_total_cost, renovation_rent_premium, renovation_roi_pct, renovation_duration_years
  - Financials JSON: t12_financials_json, t3_financials_json, y1_financials_json
  - Extracted NOI: t12_noi, t3_noi, y1_noi
  - Granular T12: t12_loss_to_lease, t12_vacancy_rate_pct, t12_concessions, t12_credit_loss, t12_net_rental_income, t12_utility_reimbursements, t12_parking_storage_income, t12_other_income, t12_management_fee_pct, t12_real_estate_taxes, t12_insurance, t12_replacement_reserves, t12_net_cash_flow, t12_expense_ratio_pct
  - Granular T3: (same fields as T12)
  - Granular Y1: (same fields as T12)
  - Market Intelligence: market_sentiment_score, market_sentiment_rationale, market_sentiment_updated_at
  - Metadata: raw_pdf_path, analysis_date, last_viewed_date, analysis_count, last_analyzed_at, analysis_model, analysis_status, search_text
  - Relationships: unit_mix, rent_comps
- `AnalysisLog` model - Audit log of extraction operations
- `PropertyUnitMix` model - Unit mix rows (floorplan, bedrooms, bathrooms, rents)
- `PropertyRentComp` model - Rent comps extracted from OM

**`deal_folder.py`** - 79 lines
- `DealFolder` model - Folder organization
  - Core: id, user_id, folder_name
  - Summary: property_type, property_address, submarket, total_units, total_sf
  - Metadata: created_date, last_updated, document_count, status, notes
- `BOVPricingTier` model - BOV pricing scenarios
  - Core: id, property_id, pricing_tier_id, tier_label, tier_type
  - Pricing: pricing, price_per_unit, price_per_sf
  - Loan: leverage, loan_amount, interest_rate, io_period_months, amortization_years
  - Returns: unlevered_irr, levered_irr, equity_multiple, avg_cash_on_cash
  - Terminal: terminal_cap_rate, hold_period_years
- `BOVCapRate` model - Cap rates linked to pricing tiers
  - Core: id, pricing_tier_id, cap_rate_type, cap_rate_value, noi_basis, qualifier

**`data_bank.py`** - 110 lines
- `DataBankDocument` model - Uploaded Excel file tracking
- `SalesComp` model - Sales comp records (27 fields)
  - Identification: property_name, market, metro, submarket, county, state, address
  - Details: property_type, sale_date, year_built, year_renovated, units, avg_unit_sf
  - Financials: avg_eff_rent, sale_price, price_per_unit, price_per_sf, cap_rate, cap_rate_qualifier, occupancy
  - Parties: buyer, seller, notes
- `PipelineProject` model - Pipeline/development projects
  - Identification: project_name, address, county, metro, submarket
  - Details: units, status, developer, delivery_quarter, start_quarter, property_type
- `SubmarketInventory` model - User-input inventory denominators

**`scoring.py`** - 35 lines
- `UserScoringWeights` model - User scoring configuration
  - Layer 1 metrics: economic_occupancy_weight, opex_ratio_weight, supply_pipeline_weight
  - Layer weights: layer1_weight, layer2_weight, layer3_weight
  - Preset: preset_name
  - Timestamps: created_at, updated_at

**`user.py`** - 21 lines
- `User` model - User accounts
  - Core: id (UUID string), email, hashed_password, full_name
  - Status: is_active
  - Timestamps: created_at, updated_at

### API Routes (`backend/app/api/routes/`)

**`properties.py`** - 627 lines
- `POST /properties` - Save property to library (NO LLM)
- `GET /properties` - List properties with filters (NO LLM)
- `GET /properties/{id}` - Get property detail (NO LLM)
- `PATCH /properties/{id}/folder` - Update property folder (NO LLM)
- `DELETE /properties/{id}` - Delete property (NO LLM)
- `POST /properties/{id}/reanalyze` - Re-analyze with LLM (EXPLICIT LLM CALL)
- `POST /properties/compare` - Compare multiple properties (NO LLM)

**`upload.py`** - 86 lines
- `POST /api/v1/upload` - Upload PDF and extract with Claude (USES LLM)
- `GET /api/v1/upload/health` - Health check

**`deal_folders.py`** - 253 lines
- `POST /deal-folders` - Create folder (auto-appends number if name exists)
- `GET /deal-folders` - List folders with status filter
- `GET /deal-folders/{id}` - Get folder detail
- `PATCH /deal-folders/{id}` - Update folder
- `DELETE /deal-folders/{id}` - Delete folder (with delete_contents option)
- `GET /deal-folders/{id}/properties` - Get properties in folder

**`data_bank.py`** - 355 lines
- `POST /data-bank/inventory` - Set submarket inventory (upsert)
- `GET /data-bank/inventory` - List inventory
- `GET /data-bank/comps` - Query sales comps with filters
- `GET /data-bank/pipeline` - Query pipeline projects with filters
- `POST /data-bank/upload` - Upload Excel file (USES LLM for classification)
- `GET /data-bank/documents` - List uploaded documents
- `GET /data-bank/document/{id}` - Get document detail
- `DELETE /data-bank/document/{id}` - Delete document and records

**`scoring.py`** - 174 lines
- `GET /scoring/weights` - Get user weights (creates defaults if missing)
- `PUT /scoring/weights` - Update user weights (validates sums = 100)
- `GET /scoring/presets` - List scoring presets
- `PUT /scoring/weights/preset` - Apply preset
- `GET /scoring/score/{property_id}` - Score single property
- `POST /scoring/scores` - Batch score multiple properties

**`auth.py`** - 84 lines
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token (sets httpOnly cookie)
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout (clears cookie)

### Services (`backend/app/services/`)

**`claude_extraction_service.py`** - ~600+ lines (only read first 100)
- `CLAUDE_EXTRACTION_PROMPT` - Comprehensive extraction prompt
- Extracts: property info, financials (T12/T3/Y1), unit mix, rent comps, renovation, BOV tiers

**`scoring_service.py`** - ~400+ lines (only read first 100)
- `BENCHMARKS` - Economic occupancy, opex ratio, supply pipeline thresholds
- `SCORING_PRESETS` - Value-add, Cash Flow, Core, Opportunistic
- `calculate_metric_score()` - Linear interpolation between benchmarks
- Three-layer scoring architecture

**`comparison_service.py`** - ~300+ lines (only read first 100)
- `get_comparison_data()` - Fetch and prepare comparison data
- `build_comparison_item()` - Build comparison for single property
- `build_pricing_data()`, `build_cap_rates()`, `build_bov_returns()`, `build_financials()`, `build_operations()`
- `identify_best_values()` - Find best/worst values for gradient highlighting

**`comp_matching_service.py`** - 506 lines
- `TYPE_GROUPS` - Property type groups (garden, midrise, highrise, wrap, etc.)
- `VINTAGE_BRACKETS` - Year ranges for vintage scoring
- `calculate_relevance()` - Product of geo × type × vintage × size scores
- `select_comps()` - Progressive threshold relaxation (0.25 → 0.10 → 0.03)
- `score_cap_rate_vs_comps()` - Score cap rate vs weighted comp average
- `score_price_per_unit_vs_comps()` - Score price/unit vs weighted comp average
- `score_vintage_adjustment()` - Score vintage vs comp median
- `calculate_layer3_score()` - Full Layer 3 calculation (35% cap, 40% price, 25% vintage)

**`property_service.py`** - Functions for property CRUD operations

**`bov_service.py`** - BOV-specific extraction logic

**`pdf_service.py`** - PDF file handling and processing

**`auth_service.py`** - Password hashing, JWT token creation

**`data_bank_extraction_service.py`** - Excel file parsing and Claude column classification

### Other Backend Files

**`main.py`** - 45 lines
- FastAPI app initialization
- CORS configuration
- Routes: auth, upload, properties, deal_folders, scoring, data_bank
- Root and health check endpoints

**`config.py`** - Configuration and environment variables

**`database.py`** - SQLAlchemy session management

**`requirements.txt`** - Python dependencies

---

## Frontend Structure

### Pages (`frontend/src/pages/`)

**`Dashboard.tsx`** - 80+ lines (read first 80)
- Welcome header with time-of-day greeting
- Key metrics cards (customizable)
- Pipeline kanban board with customizable stages
- Tag-based filtering
- Status donut chart, geographic bars, NOI distribution
- AI pipeline summary simulation panel
- Widget visibility toggling

**`Upload.tsx`** - 80+ lines (read first 80)
- How-it-works steps (Upload → AI Extract → Review & Save)
- PDFUploader component integration
- Recent uploads list
- Drag-and-drop upload zone

**`Library.tsx`** - 80+ lines (read first 80)
- Deal pipeline command center
- Grid/list views
- Search, filter, sort
- Batch comparison selection
- Status filtering (all, active, new, review, passed, closed)
- Deal score integration
- Folder creation modal

**`PropertyDetail.tsx`** - 80+ lines (read first 80)
- Full property analysis
- Financial breakdown (T3, T12, Y1) with per-unit toggle
- Unit mix table
- Rent comps section
- Renovation card
- BOV pricing tiers
- Cap sensitivity analysis (placeholder)
- Progressive empty states
- Previous/next navigation
- Deal score modal

**`ComparisonPage.tsx`** - 80+ lines (read first 80)
- Quick view vs Deep analysis mode toggle
- Deal scores with animated circles
- Bar race metric comparisons
- Sensitivity analysis (what-if cap rate slider)
- Category leaders panel
- Radar chart for multi-metric comparison (SVG)
- CSV export
- Investment criteria filtering (deep view)
- Preset scoring templates

**`DataBankPage.tsx`** - 80+ lines (read first 80)
- Three tabs: Inventory, Sales Comps, Pipeline Projects
- Excel upload with drag-and-drop
- Sales comps table with filters
- Pipeline projects table with filters
- Inventory management (metro/submarket/units)
- Document list with extraction status

**`FolderDetail.tsx`** - Properties within a folder view

**`Settings.tsx`** - Settings page structure (ready for expansion)

### Components - Layout (`frontend/src/components/layout/`)

**`MainLayout.tsx`** - App shell with sidebar, header, outlet, ambient orbs

**`Sidebar.tsx`** - Collapsible purple-gradient nav with:
- Logo and brand
- Navigation links (Dashboard, Library, Data Bank, Settings)
- Pipeline stats summary
- Theme toggle
- User section

**`Header.tsx`** - Dynamic page title + breadcrumbs + mobile menu toggle

**`PageTransition.tsx`** - Framer Motion page transition wrapper

### Components - Library (`frontend/src/components/library/`)

**`CreateFolderModal.tsx`** - Create new deal folder dialog

**`DeleteFolderModal.tsx`** - Delete folder with confirmation

**`SaveToFolderModal.tsx`** - Save property to folder (new or existing)

### Components - Comparison (`frontend/src/components/comparison/`)

**`ComparisonTable.tsx`** - Main comparison table with gradient highlighting

**`InvestmentCriteriaPanel.tsx`** - Select metrics to highlight in comparison

### Components - Property (`frontend/src/components/property/`)

**`BOVPricingTiers.tsx`** - Display BOV pricing tiers with tabs

**`PricingAnalysis.tsx`** - Pricing summary cards

### Components - Scoring (`frontend/src/components/scoring/`)

**`DealScoreBadge.tsx`** - Color-coded deal score badge (green/yellow/red)

**`DealScoreModal.tsx`** - Detailed deal score breakdown modal

**`DealScoreSettings.tsx`** - Scoring weight configuration UI

### Components - Upload (`frontend/src/components/upload/`)

**`PDFUploader.tsx`** - Drag-and-drop file upload component

**`ExtractionPreview.tsx`** - Show extracted data before saving to library

### Components - Auth (`frontend/src/components/auth/`)

**`LoginForm.tsx`** - Login form

**`RegisterForm.tsx`** - Registration form

**`ProtectedRoute.tsx`** - Route guard for authenticated pages

### Components - UI (`frontend/src/components/ui/`)

**shadcn/ui components (DON'T MODIFY):**
- `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`
- `select.tsx`, `table.tsx`, `tabs.tsx`, `badge.tsx`, `checkbox.tsx`
- `alert.tsx`, `alert-dialog.tsx`, `radio-group.tsx`, `separator.tsx`
- `skeleton.tsx`, `slider.tsx`

**`PageSkeleton.tsx`** - Loading skeletons for Dashboard, Library, PropertyDetail, Comparison

### Services (`frontend/src/services/`)

**`api.ts`** - Base API configuration and fetch wrapper

**`authService.ts`** - Auth operations (login, register, logout, checkAuth)

**`propertyService.ts`** - Property operations
- `listProperties()`, `getProperty()`, `saveProperty()`, `deleteProperty()`
- `updatePropertyFolder()`, `reanalyzeProperty()`

**`dealFolderService.ts`** - Folder operations
- `listFolders()`, `createFolder()`, `updateFolder()`, `deleteFolder()`
- `getFolderProperties()`

**`comparisonService.ts`** - Comparison data fetching
- `compareProperties()`

**`scoringService.ts`** - Scoring operations
- `getWeights()`, `updateWeights()`, `listPresets()`, `applyPreset()`
- `scoreProperty()`, `batchScoreProperties()`

**`dataBankService.ts`** - Data Bank operations
- `setInventory()`, `listInventory()`
- `queryComps()`, `queryPipeline()`
- `uploadDocument()`, `listDocuments()`, `deleteDocument()`

### Store (`frontend/src/store/`)

**`authSlice.ts`** - Zustand auth store
- State: user, token, isAuthenticated, isLoading
- Actions: login, logout, checkAuth, setUser

**`uiStore.ts`** - Zustand UI store with persist middleware
- State: theme (light/dark), sidebarCollapsed, mobileSidebarOpen
- Actions: toggleTheme, toggleSidebar, toggleMobileSidebar

### Utils (`frontend/src/utils/`)

**`criteriaEvaluation.ts`** - Calculate gradient colors for comparison table
- `rankProperties()` - Rank properties by criteria
- `getGradientColor()` - Returns Tailwind class (bg-emerald-500/20, bg-yellow-400/20, etc.)

**`csvExport.ts`** - Export comparison data to CSV

### Types (`frontend/src/types/`)

**`property.ts`** - TypeScript interfaces
- `PropertyDetail`, `PropertyListItem`, `FinancialPeriod`, `BOVPricingTier`
- `UnitMixItem`, `RentCompItem`, `UploadResponse`

### Other Frontend Files

**`App.tsx`** - Main app component with React Router routes

**`main.tsx`** - React entry point

**`index.css`** - Purple palette CSS variables + Google Fonts imports

**`lib/utils.ts`** - `cn()` utility (clsx + tailwind-merge)

**`components.json`** - shadcn/ui configuration

**`tailwind.config.js`** - Extended design system (fonts, colors, animations)

**`vite.config.ts`** - Vite configuration

**`tsconfig.json`** - TypeScript configuration

**`package.json`** - Frontend dependencies

---

## Database Schema

### Core Tables (13 tables)

**`users`** (5 columns)
- id, email, hashed_password, full_name, is_active, created_at, updated_at

**`properties`** (~80 columns)
- Core: id, user_id, deal_folder_id, deal_name, uploaded_filename, upload_date
- Document: document_type, document_subtype
- Property: property_address, property_type, submarket, metro, year_built, total_units, total_residential_sf
- Rents: average_market_rent, average_inplace_rent
- Renovation: 6 fields (cost, premium, ROI, duration)
- Financials JSON: t12/t3/y1_financials_json
- Extracted NOI: t12/t3/y1_noi
- Granular T12: 14 fields (loss_to_lease, vacancy_rate_pct, concessions, etc.)
- Granular T3: 14 fields (same as T12)
- Granular Y1: 14 fields (same as T12)
- Market Intelligence: market_sentiment_score, market_sentiment_rationale, market_sentiment_updated_at
- Metadata: raw_pdf_path, analysis_date, last_viewed_date, analysis_count, etc.

**`property_unit_mix`** (14 columns)
- id, property_id, floorplan_name, unit_type, bedroom_count, bathroom_count
- num_units, unit_sf, in_place_rent, proforma_rent, proforma_rent_psf, renovation_premium, created_at

**`property_rent_comps`** (13 columns)
- id, property_id, comp_name, location, num_units, avg_unit_sf
- in_place_rent, in_place_rent_psf, bedroom_type, is_new_construction, created_at

**`deal_folders`** (12 columns)
- id, user_id, folder_name, property_type, property_address, submarket
- total_units, total_sf, created_date, last_updated, document_count, status, notes

**`bov_pricing_tiers`** (20 columns)
- id, property_id, pricing_tier_id, tier_label, tier_type
- pricing, price_per_unit, price_per_sf
- leverage, loan_amount, interest_rate, io_period_months, amortization_years
- unlevered_irr, levered_irr, equity_multiple, avg_cash_on_cash
- terminal_cap_rate, hold_period_years

**`bov_cap_rates`** (7 columns)
- id, pricing_tier_id, cap_rate_type, cap_rate_value, noi_basis, qualifier

**`sales_comps`** (27 columns)
- id, document_id, user_id
- property_name, market, metro, submarket, county, state, address
- property_type, sale_date, year_built, year_renovated, units, avg_unit_sf
- avg_eff_rent, sale_price, price_per_unit, price_per_sf, cap_rate, cap_rate_qualifier, occupancy
- buyer, seller, notes

**`pipeline_projects`** (12 columns)
- id, document_id, user_id
- project_name, address, county, metro, submarket
- units, status, developer, delivery_quarter, start_quarter, property_type

**`submarket_inventory`** (6 columns)
- id, user_id, metro, submarket, total_units, updated_at

**`user_scoring_weights`** (11 columns)
- id, user_id
- economic_occupancy_weight, opex_ratio_weight, supply_pipeline_weight
- layer1_weight, layer2_weight, layer3_weight
- preset_name
- created_at, updated_at

**`analysis_logs`** (8 columns)
- id, property_id, user_id, timestamp, action, model, status, error_message

**`data_bank_documents`** (9 columns)
- id, user_id, filename, file_path, document_type, extraction_status, extraction_data, record_count, created_at

---

## Key Patterns & Conventions

### Design System

**Color Palette:**
- Primary: Purple/violet gradient (`from-violet-500 to-purple-600`)
- Theme: Dark mode support with CSS variables
- Status colors: NEW=blue, ACTIVE=emerald, REVIEW=amber, PASSED=slate, CLOSED=purple

**Typography:**
- Display: Syne (`font-display`)
- Body: Instrument Sans (default)
- Numbers: JetBrains Mono (`font-mono`)

**UI Patterns:**
- Card: `border border-border rounded-2xl bg-card`
- Empty state: "—" for null/undefined numeric values
- Icons: lucide-react only
- Transitions: Tailwind transitions + Framer Motion for page transitions

### API Conventions

**No LLM Calls:**
- All property/folder CRUD operations
- List, detail, delete endpoints
- Comparison endpoint

**Explicit LLM Calls:**
- `/api/v1/upload` - Initial PDF upload
- `/api/v1/properties/{id}/reanalyze` - Re-analyze property PDF
- `/api/v1/data-bank/upload` - Excel file column classification

**Response Patterns:**
- Success: 200/201 with data
- Not found: 404 with detail message
- Validation error: 400 with detail
- Conflict (duplicate): 409 with existing property data

### Database Patterns

**Relationships:**
- Property → PropertyUnitMix (one-to-many)
- Property → PropertyRentComp (one-to-many)
- Property → DealFolder (many-to-one, nullable)
- Property → BOVPricingTier (one-to-many)
- BOVPricingTier → BOVCapRate (one-to-many)

**Cascade Deletes:**
- Delete property → delete unit_mix, rent_comps, BOV tiers
- Delete folder → optionally delete properties or orphan them

---

## What's NOT Built Yet

**Not Implemented:**
- Portfolio analysis with map view
- Team collaboration features
- Comments on properties
- Activity feed
- Bulk property operations
- Keyboard shortcuts
- Offline mode
- Pagination (shows all items)

---

## Before Building Anything New

**Ask yourself:**

1. **Does this component exist?** Check `/components/ui` (shadcn), feature folders (`/library`, `/comparison`, `/property`), other pages
2. **Does this API endpoint exist?** Check `backend/app/api/routes/` files
3. **Does this utility function exist?** Check `/utils` folders (frontend and backend)
4. **Is this data already in the database?** Check schema above

**If YES → REUSE, don't rebuild!**

---

**Last Updated:** February 10, 2026
**Token Count:** ~3,000 (comprehensive inventory)
