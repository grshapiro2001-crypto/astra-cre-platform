# Codebase Inventory - Astra CRE Platform

**Purpose:** Quick reference of what EXISTS. Check this BEFORE building anything new.
**Update:** Add new files/components as you create them.
**Last Updated:** February 11, 2026

---

## Backend Structure

### Models (`backend/app/models/`)

**`property.py`** - 175 lines
- `Property` model (~80 columns) - Core property table
  - Core: id, user_id, deal_folder_id, deal_name, uploaded_filename, upload_date
  - Document: document_type, document_subtype
  - Property info: property_address, property_type, submarket, metro, year_built, total_units, total_residential_sf
  - Rents: average_market_rent, average_inplace_rent
  - Renovation: renovation_cost_per_unit, renovation_total_cost, renovation_rent_premium, renovation_roi_pct, renovation_duration_years, renovation_stabilized_revenue
  - Financials JSON: t12_financials_json, t3_financials_json, y1_financials_json
  - Extracted NOI: t12_noi, t3_noi, y1_noi (for sorting)
  - Granular T12 (14 fields): loss_to_lease, vacancy_rate_pct, concessions, credit_loss, net_rental_income, utility_reimbursements, parking_storage_income, other_income, management_fee_pct, real_estate_taxes, insurance, replacement_reserves, net_cash_flow, expense_ratio_pct
  - Granular T3 (14 fields): same structure as T12
  - Granular Y1 (14 fields): same structure as T12
  - Market Intelligence (Layer 2): market_sentiment_score, market_sentiment_rationale, market_sentiment_updated_at
  - Screening: screening_verdict (PASS/FAIL/REVIEW), screening_score, screening_details_json
  - Pipeline: pipeline_stage (screening, under_review, loi, under_contract, closed, passed), pipeline_notes, pipeline_updated_at
  - Metadata: raw_pdf_path, analysis_date, last_viewed_date, analysis_count, last_analyzed_at, analysis_model, analysis_status, search_text
  - Relationships: unit_mix, rent_comps, folder

- `PropertyUnitMix` model - Unit mix rows extracted from OM
  - Core: id, property_id
  - Unit details: floorplan, bedrooms, bathrooms, avg_sf
  - Rents: inplace_rent, proforma_rent, market_rent
  - Count: unit_count

- `PropertyRentComp` model - Rent comps extracted from OM (distinct from sales comps)
  - Core: id, property_id
  - Property: comp_property_name, address, distance_miles
  - Details: year_built, units, avg_unit_sf
  - Rent: market_rent, occupancy, notes

- `AnalysisLog` model - Audit log of all extraction operations
  - Core: id, property_id, user_id
  - Analysis: analysis_date, model_used, prompt_version, status, error_message
  - Metrics: token_count, cost_estimate

**`deal_folder.py`** - 79 lines
- `DealFolder` model - Deal folder organization
  - Core: id, user_id, folder_name
  - Summary: property_type, property_address, submarket, total_units, total_sf
  - Metadata: created_date, last_updated, document_count, status (active/archived), notes
  - Relationships: properties

**`bov.py`** - BOV-specific models
- `BOVPricingTier` model - Multi-tier pricing scenarios per property
  - Core: id, property_id, pricing_tier_id, tier_label, tier_type
  - Pricing: valuation, price_per_unit, price_per_sf
  - Loan: leverage (LTV %), loan_amount, interest_rate, io_period_months, amortization_years
  - Returns: unlevered_irr, levered_irr, equity_multiple, avg_cash_on_cash
  - Terminal: terminal_cap_rate, hold_period_years

- `BOVCapRate` model - Cap rates linked to pricing tiers
  - Core: id, pricing_tier_id, cap_rate_type, cap_rate_value, noi_basis, qualifier

**`data_bank.py`** - 110 lines
- `DataBankDocument` model - Uploaded Excel file tracking
  - Core: id, user_id, filename, upload_date
  - Status: extraction_status (pending/processing/completed/failed), error_message
  - Stats: total_rows, extracted_count

- `SalesComp` model - Sales comp records (27 fields)
  - Identification: property_name, market, metro, submarket, county, state, address
  - Details: property_type, sale_date, year_built, year_renovated, units, avg_unit_sf
  - Financials: avg_eff_rent, sale_price, price_per_unit, price_per_sf, cap_rate, cap_rate_qualifier, occupancy
  - Transaction: buyer, seller, notes
  - Metadata: user_id, document_id

- `PipelineProject` model - Pipeline/development projects
  - Identification: project_name, address, county, metro, submarket
  - Details: units, status, developer, delivery_quarter, start_quarter, property_type
  - Metadata: user_id, document_id

- `SubmarketInventory` model - User-input inventory denominators for supply calculations
  - Core: id, user_id, metro, submarket, total_units

**`scoring.py`** - 35 lines
- `UserScoringWeights` model - User scoring configuration
  - Layer 1 metric weights: economic_occupancy_weight, opex_ratio_weight, supply_pipeline_weight
  - Layer weights: layer1_weight (30%), layer2_weight (20%), layer3_weight (50%)
  - Preset: preset_name (Value-add, Cash Flow, Core, Opportunistic)
  - Timestamps: created_at, updated_at

**`criteria.py`** - Investment criteria model
- `UserInvestmentCriteria` model - Investment thresholds for deal screening
  - Core: id, user_id, criteria_name
  - Thresholds: min_units, max_units, min_cap_rate, min_irr, max_opex_ratio, min_noi_growth, target_markets
  - Status: is_active
  - Timestamps: created_at, updated_at

**`user.py`** - 21 lines
- `User` model - User accounts
  - Core: id (UUID string), email, hashed_password, full_name
  - Status: is_active
  - Timestamps: created_at, updated_at

---

### API Routes (`backend/app/api/routes/`)

**`properties.py`** - 627 lines
- `POST /properties` - Save property to library (NO LLM)
- `GET /properties` - List properties with filters, search, sorting (NO LLM)
- `GET /properties/{id}` - Get property detail (NO LLM)
- `PATCH /properties/{id}/folder` - Move property to folder (NO LLM)
- `DELETE /properties/{id}` - Delete property (NO LLM)
- `POST /properties/{id}/reanalyze` - Re-analyze with Claude (EXPLICIT LLM CALL)
- `POST /properties/compare` - Compare 2-5 properties (NO LLM)

**`upload.py`** - 86 lines
- `POST /upload` - Upload PDF and extract with Claude (USES LLM)
- `GET /upload/health` - Health check

**`deal_folders.py`** - 253 lines
- `POST /deal-folders` - Create folder (auto-appends number if name exists)
- `GET /deal-folders` - List folders with status filter
- `GET /deal-folders/{id}` - Get folder detail
- `PATCH /deal-folders/{id}` - Update folder (name, status, notes)
- `DELETE /deal-folders/{id}` - Delete folder with cascade/orphan option
- `GET /deal-folders/{id}/properties` - Get properties in folder

**`scoring.py`** - 174 lines
- `GET /scoring/weights` - Get user weights (creates defaults if missing)
- `PUT /scoring/weights` - Update user weights (validates sums = 100%)
- `GET /scoring/presets` - List scoring presets (Value-add, Cash Flow, Core, Opportunistic)
- `PUT /scoring/weights/preset` - Apply preset
- `GET /scoring/score/{property_id}` - Score single property
- `POST /scoring/scores` - Batch score multiple properties

**`criteria.py`** - Investment criteria endpoints
- `GET /criteria` - Get user investment criteria
- `PUT /criteria` - Update investment criteria
- `POST /criteria/screen/{property_id}` - Screen property against criteria

**`data_bank.py`** - 355 lines
- `POST /data-bank/inventory` - Set submarket inventory (upsert)
- `GET /data-bank/inventory` - List inventory by user
- `GET /data-bank/comps` - Query sales comps with filters (metro, submarket, type, vintage, size)
- `GET /data-bank/pipeline` - Query pipeline projects with filters
- `POST /data-bank/upload` - Upload Excel file (USES LLM for column classification)
- `GET /data-bank/documents` - List uploaded documents
- `GET /data-bank/document/{id}` - Get document detail with extracted records
- `DELETE /data-bank/document/{id}` - Delete document and cascade records

**`chat.py`** - AI chat endpoints
- `POST /chat` - Send chat message to AI Pipeline Analyst (USES LLM)
- `GET /chat/history` - Get chat history

**`auth.py`** - 84 lines
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token (sets httpOnly cookie)
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout (clears cookie)

---

### Services (`backend/app/services/`)

**`claude_extraction_service.py`** - 600+ lines
- `CLAUDE_EXTRACTION_PROMPT` - Comprehensive extraction prompt for OMs
- `extract_property_data()` - Main extraction logic
- Extracts: property info, T12/T3/Y1 financials, unit mix, rent comps, renovation assumptions, BOV pricing tiers
- Handles both OM and BOV document types

**`scoring_service.py`** - 400+ lines
- `BENCHMARKS` - Thresholds for economic occupancy, opex ratio, supply pipeline
- `SCORING_PRESETS` - Value-add, Cash Flow, Core, Opportunistic configurations
- `calculate_metric_score()` - Linear interpolation between benchmarks
- `calculate_property_score()` - Three-layer scoring:
  - Layer 1 (30%): Property Fundamentals (economic occupancy, opex ratio, supply pipeline)
  - Layer 2 (20%): Market Intelligence (AI sentiment, cached)
  - Layer 3 (50%): Comp Analysis (relevance-weighted matching)

**`comp_matching_service.py`** - 506 lines
- `TYPE_GROUPS` - Property type classifications (garden, midrise, highrise, wrap, etc.)
- `VINTAGE_BRACKETS` - Year ranges for age scoring
- `calculate_relevance()` - Product of geo × type × vintage × size scores
- `select_comps()` - Progressive threshold relaxation (0.25 → 0.10 → 0.03)
- `score_cap_rate_vs_comps()` - Score cap rate vs weighted comp average (35% of Layer 3)
- `score_price_per_unit_vs_comps()` - Score price/unit vs weighted comp average (40% of Layer 3)
- `score_vintage_adjustment()` - Score vintage vs comp median (25% of Layer 3)
- `calculate_layer3_score()` - Full Layer 3 calculation

**`comparison_service.py`** - 300+ lines
- `get_comparison_data()` - Fetch and prepare comparison data for 2-5 properties
- `build_comparison_item()` - Build comparison for single property
- `build_pricing_data()` - Extract pricing metrics
- `build_cap_rates()` - Extract cap rate metrics
- `build_bov_returns()` - Extract BOV return metrics
- `build_financials()` - Extract financial metrics (T12/T3/Y1)
- `build_operations()` - Extract operational metrics
- `identify_best_values()` - Find best/worst values for gradient highlighting

**`screening_service.py`** - Investment criteria evaluation
- `evaluate_criteria()` - Evaluate property against user investment criteria
- Returns: screening_verdict (PASS/FAIL/REVIEW), screening_score, screening_details

**`pdf_report_service.py`** - PDF report generation
- `generate_property_report()` - Generate executive deal summary PDF
- Uses ReportLab for professional formatting

**`bov_service.py`** - BOV-specific extraction logic
- `extract_bov_data()` - Extract BOV pricing tiers and cap rates

**`data_bank_extraction_service.py`** - Excel parsing and extraction
- `classify_columns()` - Use Claude to classify Excel columns (USES LLM)
- `parse_excel()` - Parse Excel file and extract records
- `normalize_values()` - Normalize extracted values

**`property_service.py`** - Property CRUD operations
- `create_property()`, `get_property()`, `update_property()`, `delete_property()`
- `check_duplicate()` - Duplicate checking logic

**`auth_service.py`** - Authentication logic
- `hash_password()` - bcrypt password hashing
- `verify_password()` - Password verification
- `create_access_token()` - JWT token creation

**`pdf_service.py`** - PDF file handling
- `extract_text()` - Extract text from PDF using PDFPlumber
- `save_pdf()` - Save uploaded PDF file

---

### Other Backend Files

**`main.py`** - 45 lines
- FastAPI app initialization
- CORS configuration (localhost:5173, localhost:3000)
- Routes: auth, upload, properties, deal_folders, scoring, data_bank, criteria, chat
- Root endpoint (`/`) - Welcome message
- Health check endpoint (`/health`)

**`config.py`** - Configuration and environment variables
- `DATABASE_URL` - Database connection string (default: SQLite)
- `SECRET_KEY` - JWT secret key
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude
- `ALGORITHM` - JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time (default: 60)
- `UPLOAD_DIR` - Directory for uploaded files (default: ./uploads)
- `CORS_ORIGINS` - Comma-separated allowed origins

**`database.py`** - SQLAlchemy session management
- `engine` - Database engine
- `SessionLocal` - Session factory
- `Base` - Declarative base for models
- `get_db()` - Dependency for database session

**`requirements.txt`** - Python dependencies
- FastAPI, uvicorn, SQLAlchemy, Alembic, Pydantic
- anthropic (Claude SDK), pdfplumber, reportlab
- python-jose, passlib, bcrypt
- pytest, pytest-asyncio

---

## Frontend Structure

### Pages (`frontend/src/pages/`)

**`Dashboard.tsx`** - Dashboard with Kanban board and metrics
- Time-of-day greeting personalization
- Key metrics cards (customizable): NOI, cap rate, property count, folder count
- Pipeline Kanban board with customizable stages (New, Active, Review, Passed, Closed)
- Geographic distribution bar chart
- Status donut chart and NOI distribution
- AI pipeline summary panel (placeholder)
- Widget visibility toggling
- Real API integration with `/api/v1/properties` and `/api/v1/deal-folders`

**`Upload.tsx`** - PDF upload page
- How-it-works steps (Upload → AI Extract → Review & Save)
- PDF drag-and-drop uploader (PDFUploader component)
- Recent uploads list
- Direct redirect to Property Detail on successful upload

**`Library.tsx`** - Property library with grid/list view
- Deal pipeline command center
- Grid/list view toggle
- Search, filter (type, status), sort capabilities
- Batch property selection for comparison
- Status filtering (all, active, new, review, passed, closed)
- Deal score integration with color-coded badges
- Folder management modal
- Real API integration with `/api/v1/properties`

**`PropertyDetail.tsx`** - Property detail view
- Financial breakdown: T3, T12, Y1 with per-unit toggle
- Unit mix table (bedroom/bathroom, sq footage, rents)
- Rent comps section (from OM document)
- Renovation card (cost per unit, total cost, rent premium, ROI, duration)
- BOV pricing tiers with tabs
- Cap sensitivity analysis (what-if cap rate slider)
- Progressive empty states for missing data
- Previous/next navigation within folder context
- Deal score modal with breakdown
- Re-analyze with Claude button
- Known issue: "Add Note" button doesn't persist, "Ask Follow-up" button has no handler

**`ComparisonPage.tsx`** - Side-by-side comparison
- Quick view vs Deep analysis mode toggle
- Deal scores with animated circles
- Bar race metric comparisons
- Sensitivity analysis (what-if cap rate slider)
- Category leaders panel
- Radar chart for multi-metric comparison (SVG)
- CSV export functionality
- Investment criteria filtering
- Gradient highlighting (green=best, yellow=middle, red=worst)
- Metric categories: Pricing, Cap Rates, BOV Returns, Financials, Operations
- Real API integration with `/api/v1/properties/compare`

**`DataBankPage.tsx`** - Data bank management
- Three tabs: Inventory, Sales Comps, Pipeline Projects
- Excel drag-and-drop upload with Claude extraction
- Sales comps table with filtering (metro, submarket, type, vintage)
- Pipeline projects table with filters
- Inventory management (metro/submarket/units)
- Document list with extraction status
- Real API integration with `/api/v1/data-bank`

**`FolderDetail.tsx`** - Folder detail page
- Properties within a specific folder
- Folder management (rename, delete, notes)
- Real API integration with `/api/v1/deal-folders/{id}/properties`

**`Settings.tsx`** - User settings page
- Profile management (placeholder - "Save Changes" button disabled)
- Scoring weight configuration (DealScoreSettings component)
- API & Integrations (placeholder)
- Notifications (placeholder)

**`Login.tsx`** & **`Register.tsx`** - Authentication pages
- Login form with validation
- Registration form with password confirmation
- JWT authentication with httpOnly cookies

---

### Components - Layout (`frontend/src/components/layout/`)

**`MainLayout.tsx`** - App shell
- Sidebar, header, main content area (outlet)
- Ambient orbs background effect
- Responsive layout

**`Sidebar.tsx`** - Collapsible sidebar navigation
- Purple gradient logo
- Navigation links (Dashboard, Library, Upload, DataBank, Comparisons, Settings)
- Pipeline stats card (hardcoded $24.5M, 12 Active Deals - needs API)
- Theme toggle (dark/light mode)
- User section with logout button
- Collapse/expand functionality

**`Header.tsx`** - Dynamic page header
- Page title
- Breadcrumbs
- Mobile menu toggle
- Notification bell (no handler)

**`PageTransition.tsx`** - Framer Motion page transitions
- Smooth fade-in transitions between routes

---

### Components - Feature Areas

**Library (`/components/library/`)**
- `CreateFolderModal.tsx` - Dialog for creating new deal folders
- `DeleteFolderModal.tsx` - Confirmation dialog for folder deletion
- `SaveToFolderModal.tsx` - Assign property to existing/new folder

**Comparison (`/components/comparison/`)**
- `ComparisonTable.tsx` - Main comparison table with gradient highlighting and sorting
- `InvestmentCriteriaPanel.tsx` - Metric selection for highlighting

**Property (`/components/property/`)**
- `BOVPricingTiers.tsx` - Multi-tier pricing display with tabs
- `PricingAnalysis.tsx` - Pricing summary cards
- `SensitivityAnalysis.tsx` - Cap rate what-if analysis with slider
- `CompMap.tsx` - Geographic comparison map (Google Maps integration)

**Scoring (`/components/scoring/`)**
- `DealScoreBadge.tsx` - Color-coded badge (green/yellow/red)
- `DealScoreModal.tsx` - Detailed score breakdown with layer explanations
- `DealScoreSettings.tsx` - Weight configuration UI with presets

**Screening (`/components/screening/`)**
- `ScreeningBadge.tsx` - Investment criteria pass/fail indicator
- `ScreeningModal.tsx` - Detailed screening results with criteria breakdown
- `InvestmentCriteriaForm.tsx` - Criteria input form

**Upload (`/components/upload/`)**
- `PDFUploader.tsx` - Drag-and-drop file upload with progress indicator
- `ExtractionPreview.tsx` - Show extracted data before save

**Auth (`/components/auth/`)**
- `LoginForm.tsx` - Login form with validation
- `RegisterForm.tsx` - Registration with password confirmation
- `ProtectedRoute.tsx` - Route guard for authenticated pages

**UI (`/components/ui/`)** - shadcn/ui primitives (DON'T MODIFY)
- Button, Card, Dialog, Input, Label, Select, Table, Tabs
- Badge, Alert, Checkbox, RadioGroup, Separator, Skeleton, Slider
- All styled with Tailwind CSS

---

### Frontend Services (`frontend/src/services/`)

**`api.ts`** - Base Axios configuration
- Base URL: `http://localhost:8000/api/v1`
- JWT interceptor: Attaches Bearer token from authSlice
- Auto-redirect on 401 (unauthorized)

**`authService.ts`** - Authentication API calls
- `login()` - Login with email/password
- `register()` - Register new user
- `logout()` - Logout and clear session
- `checkAuth()` - Verify authentication status

**`propertyService.ts`** - Property API calls
- `createProperty()` - Save property to library
- `getProperties()` - List properties with filters
- `getProperty()` - Get property detail
- `updateProperty()` - Update property
- `deleteProperty()` - Delete property
- `reanalyzeProperty()` - Re-analyze with Claude
- `movePropertyToFolder()` - Move property to folder

**`dealFolderService.ts`** - Deal folder API calls
- `createFolder()` - Create new folder
- `getFolders()` - List folders
- `getFolder()` - Get folder detail
- `updateFolder()` - Update folder
- `deleteFolder()` - Delete folder
- `getFolderProperties()` - Get properties in folder

**`comparisonService.ts`** - Comparison API calls
- `compareProperties()` - Fetch comparison data for 2-5 properties

**`scoringService.ts`** - Scoring API calls
- `getWeights()` - Get user scoring weights
- `updateWeights()` - Update scoring weights
- `getPresets()` - List scoring presets
- `applyPreset()` - Apply preset
- `scoreProperty()` - Score single property
- `scoreProperties()` - Batch score multiple properties

**`criteriaService.ts`** - Investment criteria API calls
- `getCriteria()` - Get user investment criteria
- `updateCriteria()` - Update investment criteria
- `screenProperty()` - Screen property against criteria

**`dataBankService.ts`** - Data bank API calls
- `setInventory()` - Set submarket inventory
- `getInventory()` - Get inventory
- `getComps()` - Query sales comps
- `getPipeline()` - Query pipeline projects
- `uploadDocument()` - Upload Excel file
- `getDocuments()` - List uploaded documents
- `getDocument()` - Get document detail
- `deleteDocument()` - Delete document

---

### Frontend State Management (`frontend/src/store/`)

**`authSlice.ts`** (Zustand) - Authentication state
- `user` - Current user object
- `token` - JWT token
- `isAuthenticated` - Boolean flag
- `isLoading` - Loading state
- `setUser()`, `setToken()`, `logout()` - Actions

**`uiStore.ts`** (Zustand + persist) - UI preferences
- `theme` - light/dark mode
- `sidebarCollapsed` - Sidebar collapse state
- `mobileSidebarOpen` - Mobile sidebar state
- `toggleTheme()`, `toggleSidebar()` - Actions

---

### Frontend Utilities (`frontend/src/utils/`)

**`criteriaEvaluation.ts`** - Gradient color calculation
- `evaluateMetric()` - Calculate gradient color for comparison table cells
- Returns: green (best), yellow (middle), red (worst)

**`csvExport.ts`** - CSV export logic
- `exportToCSV()` - Export comparison data to CSV file

---

### Frontend Types (`frontend/src/types/`)

**TypeScript interfaces for:**
- Property, PropertyDetail, PropertyListItem
- DealFolder, FolderDetail
- BOVPricingTier, BOVCapRate
- SalesComp, PipelineProject, SubmarketInventory
- UserScoringWeights, ScoringPreset
- InvestmentCriteria, ScreeningResult
- ComparisonData, ComparisonMetric
- User, AuthState

---

## Key Data Flows

### 1. Upload PDF → Extract → Save
1. User uploads PDF via `PDFUploader` component
2. Frontend calls `POST /api/v1/upload` (USES LLM)
3. Backend extracts with Claude Sonnet 4.5
4. Data saved to `properties` table (and related tables: unit_mix, rent_comps, bov_pricing_tiers, bov_cap_rates)
5. Frontend redirects to Property Detail page

### 2. Deal Scoring
1. User navigates to Library or Property Detail
2. Frontend calls `GET /api/v1/scoring/score/{property_id}`
3. Backend calculates three-layer score:
   - Layer 1: Property fundamentals (economic occupancy, opex ratio, supply pipeline)
   - Layer 2: Market intelligence (cached AI sentiment)
   - Layer 3: Comp analysis (relevance-weighted matching from Data Bank)
4. Score returned with color coding (green/yellow/red)

### 3. Deal Screening
1. User sets investment criteria in Settings page
2. Frontend calls `PUT /api/v1/criteria`
3. On property view, frontend calls `POST /api/v1/criteria/screen/{property_id}`
4. Backend evaluates property against criteria
5. Returns screening verdict (PASS/FAIL/REVIEW) with details

### 4. Side-by-Side Comparison
1. User selects 2-5 properties in Library
2. Frontend calls `POST /api/v1/properties/compare`
3. Backend fetches comparison data from database (NO LLM)
4. Frontend displays comparison table with gradient highlighting

### 5. Data Bank Upload
1. User uploads Excel file via DataBankPage
2. Frontend calls `POST /api/v1/data-bank/upload` (USES LLM)
3. Backend uses Claude to classify columns and extract records
4. Records saved to `sales_comps` or `pipeline_projects` table
5. Frontend displays extracted records

---

## Known Issues & TODOs

### Frontend
- [ ] "Add Note" button doesn't persist notes (PropertyDetail line 1466)
- [ ] "Ask Follow-up" button has no onClick handler (PropertyDetail line 1783)
- [ ] "Save Comparison" button closes modal without saving form data (ComparisonPage line 1886)
- [ ] Kanban `moveDeal` only console.logs (Dashboard line 499)
- [ ] Settings page buttons permanently disabled
- [ ] Notification bell has no handler
- [ ] Sidebar pipeline stats hardcoded ($24.5M, 12 Active Deals)
- [ ] 6 debug console.logs need removal

### Backend
- [ ] Need to re-upload 1160 Hammond OM to test unit_mix/rent_comps pipeline
- [ ] ANTHROPIC_API_KEY env var override issue

---

**Database:** SQLite with 13 tables, 12 migration files
**Frontend Routes:** 8 pages (Dashboard, Library, Upload, PropertyDetail, ComparisonPage, DataBankPage, FolderDetail, Settings)
**Backend Endpoints:** 50+ endpoints across 8 route files
**Total Lines of Code:** ~15,000+ lines (backend: ~8,000, frontend: ~7,000)
