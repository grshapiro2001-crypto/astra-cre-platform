# Astra CRE Platform

AI-powered commercial real estate deal analysis platform. Upload OMs and BOVs, extract financial metrics with Claude AI, score deals against benchmarks, organize into deal folders, and compare properties side-by-side.

## Features

All features listed below are **fully implemented and working** in the codebase:

### AI Document Extraction
- **OM Support** - Extract property details, unit mix, rent comps, financials (T12, T3, Y1), renovation assumptions
- **BOV Support** - Extract multi-tier pricing scenarios with cap rates, returns, loan assumptions
- **Intelligent Parsing** - Claude Sonnet 4.5 extracts structured data from unstructured PDFs
- **Granular Financials** - 40+ financial line items per period including loss-to-lease, concessions, expense breakdown

### Deal Folders
- **Hierarchical Organization** - Organize properties by deal/property into folders
- **Flexible Management** - Create folders before or after upload, move properties between folders
- **Orphaned Properties** - Properties can exist without folders for flexible workflow

### Property Detail
- **Financial Breakdown** - View T12, T3, and Y1 financials with per-unit toggle
- **Unit Mix Table** - Bedroom/bathroom breakdown, square footage, in-place vs proforma rent
- **Rent Comps** - Comps extracted from the OM document (distinct from Data Bank sales comps)
- **Renovation Card** - Cost per unit, total cost, rent premium, ROI, duration
- **BOV Pricing Tiers** - Multiple pricing scenarios with returns and cap rates
- **Progressive Empty States** - Show what's available vs what's missing
- **Navigation** - Previous/next property navigation within folder context

### Side-by-Side Comparison
- **2-5 Properties** - Compare multiple properties in table format
- **Real API Data** - Wired to `/api/v1/properties/compare` endpoint
- **Gradient Highlighting** - Best values highlighted green, worst red, middle yellow
- **Investment Criteria Filtering** - Filter by IRR, cap rate, opex ratio, NOI growth
- **Sortable Columns** - Click to sort by any metric
- **CSV Export** - Export comparison table to CSV
- **Metric Categories** - Pricing, Cap Rates, BOV Returns, Financials, Operations

### Deal Scoring
- **Three-Layer System**:
  - **Layer 1: Property Fundamentals** - Economic occupancy, opex ratio, supply pipeline pressure
  - **Layer 2: Market Intelligence** - AI-generated market sentiment score (cached)
  - **Layer 3: Comp Analysis** - Relevance-weighted comp matching (cap rate, price/unit, vintage)
- **Configurable Weights** - Adjust metric and layer weights via Settings
- **Presets** - Value-add, Cash Flow, Core, Opportunistic scoring profiles
- **Color-Coded Badges** - Visual deal score indicators (green = strong, yellow = moderate, red = weak)

### Data Bank
- **Sales Comps** - Upload Excel files with sales comp data
- **Pipeline Projects** - Track under-construction and planned developments
- **Submarket Inventory** - Set inventory denominators for supply pressure calculations
- **AI Extraction** - Claude classifies columns and normalizes values from user Excel files
- **Comp Matching** - Automated relevance scoring based on geography, type, vintage, size

### Dashboard
- **Real API Data** - Fetches from `/api/v1/properties` and `/api/v1/deal-folders`
- **Pipeline Board** - Kanban view with customizable stages (New, Active, Review, Passed, Closed)
- **Metrics Cards** - Total NOI, average cap rate, property count, folder count
- **Geography Distribution** - Bar chart by submarket
- **Tag Filtering** - Filter entire dashboard by tags (not fully implemented)
- **Time-of-Day Greeting** - Personalized welcome message

### Design System
- **Purple Theme** - Violet-to-purple gradient primary color scheme
- **Dark Mode** - Full dark/light mode support with toggle
- **Responsive Layout** - Collapsible sidebar, mobile-friendly navigation
- **Skeleton Loading** - Progressive loading states for all pages
- **Page Transitions** - Smooth transitions between routes
- **Typography** - Syne (display), Instrument Sans (body), JetBrains Mono (numbers)

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Zustand + Framer Motion
- **Backend:** Python FastAPI + SQLAlchemy + SQLite + Alembic
- **AI:** Anthropic Claude Sonnet 4.5
- **Design:** Purple theme with dark mode support

## Quick Start

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
# OR: venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Create .env file with:
# ANTHROPIC_API_KEY=your_key_here
# SECRET_KEY=your_secret_key

uvicorn app.main:app --reload
# Runs at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

## Project Structure

```
astra-cre-platform/
├── backend/
│   ├── app/
│   │   ├── api/routes/     # API endpoints (auth, properties, deal_folders, scoring, data_bank, upload)
│   │   ├── models/         # SQLAlchemy models (property, deal_folder, data_bank, scoring, user)
│   │   ├── schemas/        # Pydantic schemas for request/response validation
│   │   ├── services/       # Business logic (claude_extraction, scoring, comparison, comp_matching)
│   │   ├── utils/          # File handling, helpers
│   │   ├── main.py         # FastAPI app initialization
│   │   ├── config.py       # Configuration and environment variables
│   │   └── database.py     # Database connection and session management
│   ├── requirements.txt
│   └── astra.db           # SQLite database file
├── frontend/
│   ├── src/
│   │   ├── components/    # React components (layout, library, comparison, property, scoring, ui)
│   │   ├── pages/         # Page components (Dashboard, Library, PropertyDetail, ComparisonPage, etc.)
│   │   ├── services/      # API service functions (propertyService, dealFolderService, scoringService)
│   │   ├── store/         # Zustand stores (authSlice, uiStore)
│   │   ├── types/         # TypeScript interfaces
│   │   ├── utils/         # Utility functions (csvExport, criteriaEvaluation)
│   │   ├── App.tsx        # Main app component with routing
│   │   └── main.tsx       # React entry point
│   ├── package.json
│   └── vite.config.ts
└── .ai/                   # Documentation for developers and AI assistants
    ├── 01-CORE-RULES.md
    ├── 02-ARCHITECTURE.md
    ├── 03-CODEBASE.md
    └── 04-CURRENT-WORK.md
```

## API Endpoints

All endpoints are prefixed with `/api/v1`:

- **`/auth`** - User authentication (register, login, logout, me)
- **`/upload`** - PDF upload and extraction
- **`/properties`** - Property CRUD, reanalysis, comparison, folder assignment
- **`/deal-folders`** - Folder CRUD, get folder properties
- **`/scoring`** - Scoring weights, presets, score property, batch scoring
- **`/data-bank`** - Inventory, sales comps, pipeline projects, Excel upload

## Database Schema

**Core Tables:**
- `users` - User accounts (email, hashed_password, full_name)
- `properties` - Property data with 40+ financial fields
- `property_unit_mix` - Unit mix rows (floorplan, bedrooms, bathrooms, rents)
- `property_rent_comps` - Rent comps extracted from OM documents
- `deal_folders` - Deal folder organization
- `bov_pricing_tiers` - BOV multi-tier pricing scenarios
- `bov_cap_rates` - Cap rates linked to pricing tiers
- `analysis_logs` - Audit log of all LLM extraction operations

**Data Bank Tables:**
- `sales_comps` - User-uploaded sales comp records
- `pipeline_projects` - User-uploaded pipeline/development projects
- `submarket_inventory` - User-input inventory denominators
- `data_bank_documents` - Uploaded Excel file tracking

**Scoring Tables:**
- `user_scoring_weights` - User-configurable scoring weights and presets

## Documentation

For developers and AI assistants, see `.ai/` directory:

- **[01-CORE-RULES.md](.ai/01-CORE-RULES.md)** - Coding standards, patterns, constraints
- **[02-ARCHITECTURE.md](.ai/02-ARCHITECTURE.md)** - Technical decisions and rationale
- **[03-CODEBASE.md](.ai/03-CODEBASE.md)** - Complete inventory of what exists
- **[04-CURRENT-WORK.md](.ai/04-CURRENT-WORK.md)** - Active tasks and priorities

## Current Status

**Phase:** Active Development - Deal Scoring + Data Bank Integration
**Last Updated:** February 10, 2026

**Recently Completed:**
- Schema expansion for unit mix, rent comps, metro, renovation fields
- Progressive empty states on PropertyDetail
- Extraction pipeline wired for new fields
- Comp matching uses metro field
- Deal Score UI with color coding and sortable comparison
- Comparison page wired to real API
- Data Bank page with Excel upload and Claude-powered extraction

**Known Issues:**
- _cffi_backend env dependency warning on backend startup (pre-existing, non-blocking)

---

**Maintained by Griffin Shapiro**
