# Astra CRE — AI-Powered Commercial Real Estate Investment Platform

AI-powered commercial real estate deal analysis platform. Upload offering memorandums (OMs) and broker opinion of values (BOVs), extract financial metrics with Claude AI, score deals against benchmarks, screen against custom investment criteria, and manage your deal pipeline with an interactive Kanban board. Built for real estate investors, analysts, and firms who need fast, intelligent underwriting and portfolio management.

<!-- TODO: Add screenshot -->

---

## Features

All features below are **fully implemented and working** in the codebase:

### 🤖 AI-Powered Document Extraction
- **OM Support** — Extract property details, unit mix, rent comps, financials (T12, T3, Y1), renovation assumptions
- **BOV Support** — Extract multi-tier pricing scenarios with cap rates, returns, loan assumptions
- **Intelligent Parsing** — Claude Sonnet 4.5 extracts structured data from unstructured PDFs
- **Granular Financials** — 40+ financial line items per period including loss-to-lease, concessions, expense breakdown

### 📊 Automated Deal Scoring
- **Three-Layer Scoring System**:
  - **Layer 1: Property Fundamentals (30%)** — Economic occupancy, opex ratio, supply pipeline pressure
  - **Layer 2: Market Intelligence (20%)** — AI-generated market sentiment score (cached)
  - **Layer 3: Comp Analysis (50%)** — Relevance-weighted comp matching (cap rate, price/unit, vintage)
- **Configurable Weights** — Adjust metric and layer weights via Settings
- **Presets** — Value-add, Cash Flow, Core, Opportunistic scoring profiles
- **Color-Coded Badges** — Visual deal score indicators (green = strong, yellow = moderate, red = weak)

### ✅ Deal Screening Against Investment Criteria
- **Custom Investment Criteria** — Define thresholds for IRR, cap rate, opex ratio, NOI growth, unit count, etc.
- **Automated Screening** — Properties automatically evaluated against criteria on upload
- **Pass/Fail/Review Verdicts** — Visual screening badges on property cards
- **Screening Modal** — Detailed breakdown of which criteria passed or failed

### 🔬 Interactive Sensitivity Analysis & Quick Underwriting
- **Cap Rate What-If Analysis** — Adjust cap rates and see immediate impact on pricing
- **Per-Unit Toggle** — View all financials per unit for easy scaling comparisons
- **BOV Multi-Tier Pricing** — Compare multiple pricing scenarios with different leverage and return assumptions
- **Financial Period Toggle** — Switch between T12, T3, and Y1 views

### 📄 Executive Deal Summary PDF Export
- **PDF Report Generation** — Export property summaries with key metrics, financials, and analysis
- **Professional Formatting** — Presentation-ready reports for investor memos

### 🎯 Drag-and-Drop Pipeline Kanban Board
- **Customizable Stages** — New, Active, Review, Passed, Closed
- **Deal Cards** — Visual cards with deal scores, property details, and key metrics
- **Real-Time Updates** — Drag properties between stages to update pipeline status
- **Pipeline Analytics** — Dashboard metrics showing total NOI, average cap rate, property count, folder count

### 💬 AI Pipeline Analyst Chat (Claude-Powered)
- **Natural Language Queries** — Ask questions about your portfolio and deals
- **Context-Aware Responses** — Claude provides insights based on your data
- **Follow-Up Questions** — Continue conversations about specific properties

### 🗺️ Interactive Comp Map (Google Maps)
- **Geographic Visualization** — View properties and comps on an interactive map
- **Comp Proximity** — See which sales comps are geographically close to your subject property
- **Rent Comps** — Display rent comps extracted from OM documents

### 📈 Rent Comps and Unit Mix Tables
- **Unit Mix Breakdown** — Bedroom/bathroom breakdown, square footage, in-place vs proforma rent
- **Rent Comps** — Comps extracted from OM documents (distinct from Data Bank sales comps)
- **Renovation Analysis** — Cost per unit, total cost, rent premium, ROI, duration

### 💼 Deal Folders & Organization
- **Hierarchical Organization** — Organize properties by deal/property into folders
- **Flexible Management** — Create folders before or after upload, move properties between folders
- **Orphaned Properties** — Properties can exist without folders for flexible workflow

### 📊 Side-by-Side Comparison
- **2-5 Properties** — Compare multiple properties in table format
- **Gradient Highlighting** — Best values highlighted green, worst red, middle yellow
- **Investment Criteria Filtering** — Filter by IRR, cap rate, opex ratio, NOI growth
- **Sortable Columns** — Click to sort by any metric
- **CSV Export** — Export comparison table to CSV
- **Metric Categories** — Pricing, Cap Rates, BOV Returns, Financials, Operations

### 📊 Data Bank with Sales Comps & Pipeline Projects
- **Sales Comps** — Upload Excel files with sales comp data
- **Pipeline Projects** — Track under-construction and planned developments
- **Submarket Inventory** — Set inventory denominators for supply pressure calculations
- **AI Extraction** — Claude classifies columns and normalizes values from user Excel files
- **Comp Matching** — Automated relevance scoring based on geography, type, vintage, size

### 🌙 Dark Mode UI
- **Full Dark/Light Mode Support** — Toggle between themes with persistent preferences
- **Purple Theme** — Violet-to-purple gradient primary color scheme
- **Responsive Layout** — Collapsible sidebar, mobile-friendly navigation
- **Skeleton Loading** — Progressive loading states for all pages
- **Page Transitions** — Smooth transitions between routes
- **Typography** — Syne (display), Instrument Sans (body), JetBrains Mono (numbers)

---

## Tech Stack

### Frontend
- **React 18** — UI framework
- **TypeScript 5.3** — Type safety
- **Vite 5** — Build tool
- **Tailwind CSS 3.4** — Styling
- **shadcn/ui** — Component primitives
- **Zustand 4.4** — State management
- **Framer Motion** — Animations
- **React Router 6** — Routing
- **Axios** — HTTP client
- **React Dropzone** — File uploads
- **TanStack Table** — Data tables
- **React Google Maps** — Map integration

### Backend
- **FastAPI** — Python web framework
- **SQLAlchemy 2.0** — ORM
- **SQLite** — Database (default, PostgreSQL supported)
- **Alembic** — Database migrations
- **Anthropic Claude SDK** — AI extraction
- **PDFPlumber** — PDF parsing
- **ReportLab** — PDF generation
- **python-jose** — JWT authentication
- **bcrypt** — Password hashing

### APIs
- **Anthropic Claude API** — Document extraction and chat
- **Google Maps API** — Geographic visualization

---

## Getting Started

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **Anthropic API Key** — Sign up at [console.anthropic.com](https://console.anthropic.com/)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/astra-cre-platform.git
cd astra-cre-platform
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Mac/Linux
# OR: venv\Scripts\activate  # Windows

pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Edit .env and add your ANTHROPIC_API_KEY:
# ANTHROPIC_API_KEY=your_key_here
# SECRET_KEY=your_secret_key_change_in_production

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --port 8000
# Backend runs at http://localhost:8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# (Optional) Create .env file for custom API URL
# VITE_API_URL=http://localhost:8000/api/v1

npm run dev
# Frontend runs at http://localhost:5173
```

### 4. Open Browser
Navigate to `http://localhost:5173` and create an account to get started.

---

## Project Structure

```
astra-cre-platform/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoints
│   │   │   ├── auth.py          # User registration, login, logout
│   │   │   ├── upload.py        # PDF upload and extraction
│   │   │   ├── properties.py    # Property CRUD, reanalysis, comparison
│   │   │   ├── deal_folders.py  # Folder CRUD, folder properties
│   │   │   ├── scoring.py       # Scoring weights, presets, scoring
│   │   │   ├── criteria.py      # Investment criteria endpoints
│   │   │   ├── data_bank.py     # Data bank CRUD and extraction
│   │   │   └── chat.py          # AI chat endpoints
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── property.py      # Property, PropertyUnitMix, PropertyRentComp, AnalysisLog
│   │   │   ├── deal_folder.py   # DealFolder
│   │   │   ├── bov.py           # BOVPricingTier, BOVCapRate
│   │   │   ├── data_bank.py     # SalesComp, PipelineProject, SubmarketInventory, DataBankDocument
│   │   │   ├── scoring.py       # UserScoringWeights
│   │   │   ├── criteria.py      # UserInvestmentCriteria
│   │   │   └── user.py          # User
│   │   ├── schemas/             # Pydantic schemas for request/response validation
│   │   ├── services/            # Business logic
│   │   │   ├── claude_extraction_service.py  # Main extraction logic (600+ lines)
│   │   │   ├── scoring_service.py            # Three-layer scoring system (400+ lines)
│   │   │   ├── comp_matching_service.py      # Comp relevance scoring (506 lines)
│   │   │   ├── comparison_service.py         # Comparison data preparation (300+ lines)
│   │   │   ├── screening_service.py          # Investment criteria evaluation
│   │   │   ├── pdf_report_service.py         # PDF report generation
│   │   │   ├── bov_service.py                # BOV extraction
│   │   │   ├── data_bank_extraction_service.py  # Excel parsing and extraction
│   │   │   ├── property_service.py           # Property CRUD operations
│   │   │   └── auth_service.py               # Authentication logic
│   │   ├── utils/               # File handling, helpers
│   │   ├── main.py              # FastAPI app initialization
│   │   ├── config.py            # Configuration and environment variables
│   │   └── database.py          # Database connection and session management
│   ├── alembic/                 # Database migration files
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Example environment variables
│   └── astra.db                 # SQLite database file
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── layout/          # MainLayout, Sidebar, Header, PageTransition
│   │   │   ├── library/         # CreateFolderModal, DeleteFolderModal, SaveToFolderModal
│   │   │   ├── comparison/      # ComparisonTable, InvestmentCriteriaPanel
│   │   │   ├── property/        # BOVPricingTiers, PricingAnalysis, SensitivityAnalysis, CompMap
│   │   │   ├── scoring/         # DealScoreBadge, DealScoreModal, DealScoreSettings
│   │   │   ├── screening/       # ScreeningBadge, ScreeningModal, InvestmentCriteriaForm
│   │   │   ├── upload/          # PDFUploader, ExtractionPreview
│   │   │   ├── auth/            # LoginForm, RegisterForm, ProtectedRoute
│   │   │   └── ui/              # shadcn/ui primitives (button, card, dialog, input, etc.)
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.tsx    # Dashboard with Kanban board and metrics
│   │   │   ├── Library.tsx      # Property library with grid/list view
│   │   │   ├── PropertyDetail.tsx  # Property detail view
│   │   │   ├── ComparisonPage.tsx  # Side-by-side comparison
│   │   │   ├── DataBankPage.tsx    # Data bank management
│   │   │   ├── Settings.tsx        # User settings
│   │   │   └── Upload.tsx          # PDF upload page
│   │   ├── services/            # API service functions
│   │   │   ├── api.ts           # Axios base configuration
│   │   │   ├── authService.ts   # Auth API calls
│   │   │   ├── propertyService.ts     # Property API calls
│   │   │   ├── dealFolderService.ts   # Folder API calls
│   │   │   ├── comparisonService.ts   # Comparison API calls
│   │   │   ├── scoringService.ts      # Scoring API calls
│   │   │   ├── criteriaService.ts     # Criteria API calls
│   │   │   └── dataBankService.ts     # Data bank API calls
│   │   ├── store/               # Zustand stores
│   │   │   ├── authSlice.ts     # Authentication state
│   │   │   └── uiStore.ts       # UI preferences (theme, sidebar)
│   │   ├── types/               # TypeScript interfaces
│   │   ├── utils/               # Utility functions
│   │   │   ├── csvExport.ts     # CSV export logic
│   │   │   └── criteriaEvaluation.ts  # Gradient color calculation
│   │   ├── App.tsx              # Main app component with routing
│   │   └── main.tsx             # React entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example             # Example environment variables
└── .ai/                         # Documentation for developers and AI assistants
    ├── 01-CORE-RULES.md         # Coding standards, patterns, constraints
    ├── 02-ARCHITECTURE.md       # Technical decisions and rationale
    ├── 03-CODEBASE.md           # Complete inventory of what exists
    └── 04-CURRENT-WORK.md       # Active tasks and priorities
```

---

## Environment Variables

### Backend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string (default: SQLite) | No |
| `SECRET_KEY` | JWT secret key for token signing | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes |
| `ALGORITHM` | JWT algorithm (default: HS256) | No |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time (default: 60) | No |
| `UPLOAD_DIR` | Directory for uploaded files (default: ./uploads) | No |
| `CORS_ORIGINS` | Comma-separated allowed origins | No |

### Frontend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL (default: http://localhost:8000/api/v1) | No |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key for comp map | No |

---

## API Overview

All endpoints are prefixed with `/api/v1`:

### Authentication (`/auth`)
- `POST /auth/register` — User registration
- `POST /auth/login` — Login with JWT token generation
- `GET /auth/me` — Get current user info
- `POST /auth/logout` — Logout and clear session

### Upload (`/upload`)
- `POST /upload` — Upload PDF and extract with Claude
- `GET /upload/health` — Health check

### Properties (`/properties`)
- `POST /properties` — Save property to library
- `GET /properties` — List properties with filters, search, sorting
- `GET /properties/{id}` — Get property detail
- `PATCH /properties/{id}/folder` — Move property to folder
- `DELETE /properties/{id}` — Delete property
- `POST /properties/{id}/reanalyze` — Re-analyze with Claude
- `POST /properties/compare` — Compare 2-5 properties

### Deal Folders (`/deal-folders`)
- `POST /deal-folders` — Create folder
- `GET /deal-folders` — List folders with status filter
- `GET /deal-folders/{id}` — Get folder detail
- `PATCH /deal-folders/{id}` — Update folder
- `DELETE /deal-folders/{id}` — Delete folder (cascade or orphan)
- `GET /deal-folders/{id}/properties` — Get properties in folder

### Scoring (`/scoring`)
- `GET /scoring/weights` — Get user scoring weights
- `PUT /scoring/weights` — Update scoring weights
- `GET /scoring/presets` — List scoring presets
- `PUT /scoring/weights/preset` — Apply preset
- `GET /scoring/score/{property_id}` — Score single property
- `POST /scoring/scores` — Batch score multiple properties

### Investment Criteria (`/criteria`)
- `GET /criteria` — Get user investment criteria
- `PUT /criteria` — Update investment criteria
- `POST /criteria/screen/{property_id}` — Screen property against criteria

### Data Bank (`/data-bank`)
- `POST /data-bank/inventory` — Set submarket inventory
- `GET /data-bank/inventory` — List inventory by user
- `GET /data-bank/comps` — Query sales comps with filters
- `GET /data-bank/pipeline` — Query pipeline projects
- `POST /data-bank/upload` — Upload Excel file
- `GET /data-bank/documents` — List uploaded documents
- `GET /data-bank/document/{id}` — Get document detail
- `DELETE /data-bank/document/{id}` — Delete document

### Chat (`/chat`)
- `POST /chat` — Send chat message to AI Pipeline Analyst
- `GET /chat/history` — Get chat history

---

## License

MIT

---

**Maintained by Griffin Shapiro**
