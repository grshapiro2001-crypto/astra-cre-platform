# Current State - CRE Investment Platform

**Last Updated:** 2026-01-17
**Status:** Phase 3A In Progress

---

## Overview

Commercial Real Estate investment platform for analyzing Offering Memorandums (OMs) and Broker Opinions of Value (BOVs). Built for senior analysts at major brokerages who need to quickly extract and compare financial metrics from property documents.

---

## Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** SQLite with SQLAlchemy 2.0+ ORM
- **Migrations:** Alembic (batch operations for SQLite compatibility)
- **AI/ML:** Claude API (Anthropic) - Sonnet 4.5 model
- **PDF Processing:** pdfplumber
- **Authentication:** JWT tokens

### Frontend
- **Framework:** React 18 with TypeScript 5
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Build Tool:** Vite

### Infrastructure
- Local development (macOS)
- File storage: Local filesystem for PDFs
- No Docker/cloud deployment yet

---

## Completed Features

### ✅ Phase 1: Authentication
- User registration with email/password
- Login with JWT token generation
- Protected routes with auth middleware
- Token storage in localStorage
- Auto-refresh on page load

**Status:** Stable, production-ready

---

### ✅ Phase 2: PDF Upload & Claude API Extraction
- Drag-and-drop PDF upload (25MB max)
- File type and size validation
- Claude API integration for intelligent extraction
- Document type detection (OM vs BOV)
- Multi-period financial extraction (T12, T3, Y1)
- Flexible metric labeling (handles "TTM", "Trailing 12", etc.)
- Calculated metrics (Economic Occupancy, OpEx Ratio)
- Extraction results preview with side-by-side comparison
- Visual display of financials by period

**Status:** Stable, production-ready

**Known Issues:** None

---

### ✅ Phase 3A: Deal Folders (Partial)

#### Completed:
1. **Database Schema**
   - `deal_folders` table with user association
   - `properties.deal_folder_id` foreign key
   - `properties.document_subtype` field
   - BOV pricing tier tables (`bov_pricing_tiers`, `bov_cap_rates`)
   - All migrations applied successfully

2. **Folder CRUD Endpoints**
   - `POST /api/v1/deal-folders` - Create folder (auto-appends numbers for duplicates)
   - `GET /api/v1/deal-folders` - List user's folders
   - `GET /api/v1/deal-folders/{id}` - Get folder details
   - `GET /api/v1/deal-folders/{id}/properties` - List properties in folder
   - `PATCH /api/v1/deal-folders/{id}` - Update folder
   - `DELETE /api/v1/deal-folders/{id}` - Delete folder

3. **Property-Folder Association**
   - `PATCH /api/v1/properties/{id}/folder?folder_id={id}` - Reassign property to folder
   - Automatic document_count updates on save/delete/move
   - Orphaned property support (deal_folder_id = NULL)

4. **Duplicate Property Handling** ✅ JUST FIXED
   - Detects duplicate properties on save (same name/address)
   - Shows comparison modal (existing vs new)
   - Three options: Replace Existing, Keep Both, Cancel
   - Replace: Deletes old property, saves new (count stays same)
   - Keep Both: Uses `?force=true` to bypass duplicate check (count increases)
   - Visual comparison with upload dates and NOI values

5. **Library Page**
   - Displays folders in responsive grid (1/2/3 columns)
   - Folder cards show: name, type, address, units, document count, last updated
   - Links to folder detail pages
   - Empty state with upload CTA
   - "+ Upload Document" button in header

6. **Folder Detail Page**
   - Shows folder metadata
   - Lists properties in folder
   - Links to individual property detail pages
   - Empty state when folder has no documents
   - Back button to library

7. **Save to Folder Modal**
   - Radio: Create new folder OR use existing folder
   - New folder: Pre-filled with property name
   - Existing folder: Dropdown with document counts
   - Document subtype dropdown (OM/BOV/Rent Roll/T-12/Other)
   - Auto-detects document type from extraction
   - Property summary preview
   - Success navigation to folder detail

8. **BOV Detection & Extraction** ✅ NEW
   - Backend extracts complete BOV pricing tier packages
   - Each tier includes: pricing, cap rates, loan assumptions, return metrics, terminal assumptions
   - Stores in `bov_pricing_tiers` and `bov_cap_rates` tables
   - Frontend types updated to support BOV data
   - NO LLM calls in views (data loaded from database)

**Status:** Core functionality working, some features pending

---

## In Progress / Pending

### 🚧 Phase 3A: Remaining Folder Features

#### Not Yet Implemented:
1. **Manual Folder Creation** (Priority 2)
   - [+ New Deal Folder] button on Library page
   - Modal with folder name input and optional property type
   - Creates empty folder (document_count = 0)
   - NO property association needed

2. **Delete Folder with Confirmation** (Priority 3)
   - Delete button on folder detail page
   - Confirmation modal with two options:
     - Delete folder only (properties become orphaned)
     - Delete folder AND all documents (cascade delete)
   - Warning about document count if folder not empty
   - Red warning text for destructive actions

3. **Rename Folder** (Priority 4)
   - Rename button on folder detail page
   - Inline edit or modal
   - Updates `folder_name` and `last_updated`

4. **BOV Property Detail View** (Priority 5)
   - Check if property has BOV pricing tiers
   - Show "Pricing Scenarios" section
   - Horizontal tabs/pills for each tier
   - Display cards: Pricing Summary, Cap Rate Analysis, Return Metrics, Loan/Terminal Assumptions
   - Clean Tailwind styling matching existing UI

---

## Architecture Decisions

### Cost Optimization Strategy (CRITICAL)
**LLM calls ONLY in:**
- Initial PDF upload (`POST /api/v1/upload`)
- Explicit re-analyze (`POST /api/v1/properties/{id}/reanalyze`)

**NO LLM calls in:**
- Library views
- Folder views
- Property detail views
- BOV pricing tier views
- Any list/read operations

All view operations use pure database queries with NO model inference.

### Data Flow
```
Upload PDF → Claude API Extraction → Display Preview → Save to Folder → View in Library
                                                           ↓
                                    (BOV data saved to separate tables)
                                                           ↓
                                        Property Detail Page (NO LLM, reads from DB)
```

### Type Consistency
- **User.id:** String(36) UUID
- **All user_id foreign keys:** String(36) to match
- **Folder/Property IDs:** Integer (auto-increment)

### Folder Management
- **Duplicate folder names:** Auto-append (2), (3), etc.
- **Duplicate properties:** User chooses Replace or Keep Both
- **Orphaned properties:** Supported (deal_folder_id = NULL)
- **Folder deletion:** Two modes (folder only vs folder + documents)

---

## Known Issues & Technical Debt

### Fixed Issues:
- ✅ User ID type mismatch (was Integer, now String(36))
- ✅ Duplicate folder names causing save failures (now auto-appends numbers)
- ✅ Document count not updating (was failing due to duplicate folder error)
- ✅ Infinite loading spinner on save (JavaScript scope issue - `folderId` not accessible in catch block)

### Current Issues:
- None critical

### Technical Debt:
1. No pagination on folder/property lists (limit 100 items)
2. No search/filter on Library page yet
3. No bulk operations (delete multiple properties)
4. No folder sharing/collaboration features
5. No export functionality (CSV, Excel)
6. No property comparison view
7. No analytics/dashboard (portfolio summary)

---

## Database Schema Summary

### Core Tables:
- `users` - Authentication (email, hashed_password, UUID id)
- `deal_folders` - Deal organization (folder_name, property_type, document_count)
- `properties` - Analyzed documents (deal_name, financials as JSON, deal_folder_id FK)
- `analysis_logs` - Audit trail for LLM calls

### BOV Tables:
- `bov_pricing_tiers` - BOV pricing scenarios (pricing, loan assumptions, returns)
- `bov_cap_rates` - Cap rates within each tier (type, value, NOI basis)

### Key Relationships:
- User → Folders (one-to-many)
- User → Properties (one-to-many)
- Folder → Properties (one-to-many, nullable)
- Property → BOV Tiers (one-to-many)
- BOV Tier → Cap Rates (one-to-many)

---

## File Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py          # Authentication endpoints
│   │   │   ├── upload.py        # PDF upload + Claude extraction
│   │   │   ├── properties.py    # Property CRUD + re-analyze
│   │   │   └── deal_folders.py  # Folder CRUD
│   │   └── deps.py              # Dependencies (auth, db session)
│   ├── models/
│   │   ├── user.py              # User model
│   │   ├── property.py          # Property + AnalysisLog models
│   │   └── deal_folder.py       # DealFolder, BOVPricingTier, BOVCapRate models
│   ├── schemas/
│   │   ├── user.py              # Pydantic schemas for users
│   │   ├── property.py          # Pydantic schemas for properties + BOV data
│   │   └── deal_folder.py       # Pydantic schemas for folders
│   ├── services/
│   │   ├── claude_extraction_service.py  # Claude API integration
│   │   ├── pdf_service.py                # PDF text extraction
│   │   ├── property_service.py           # Property database operations
│   │   └── bov_service.py                # BOV data database operations
│   ├── utils/
│   │   └── file_handler.py      # File upload/validation
│   ├── database.py              # SQLAlchemy setup
│   ├── config.py                # Settings (API keys, etc.)
│   └── main.py                  # FastAPI app + CORS
├── alembic/                     # Database migrations
├── uploads/                     # Stored PDF files
└── requirements.txt

frontend/
├── src/
│   ├── components/
│   │   ├── layout/              # Header, MainLayout
│   │   ├── library/             # SaveToFolderModal
│   │   └── upload/              # PDFUploader, ExtractionPreview
│   ├── pages/
│   │   ├── Login.tsx            # Login page
│   │   ├── Register.tsx         # Registration page
│   │   ├── Upload.tsx           # PDF upload page
│   │   ├── Library.tsx          # Folder grid view
│   │   ├── FolderDetail.tsx     # Properties in folder
│   │   └── PropertyDetail.tsx   # Individual property view
│   ├── services/
│   │   ├── api.ts               # Axios instance with auth
│   │   ├── authService.ts       # Login/register API calls
│   │   ├── propertyService.ts   # Property API calls
│   │   └── dealFolderService.ts # Folder API calls
│   ├── types/
│   │   └── property.ts          # TypeScript interfaces
│   ├── App.tsx                  # Routing
│   └── main.tsx                 # React root
└── package.json
```

---

## Environment Variables

### Backend (.env):
```
ANTHROPIC_API_KEY=sk-ant-...  # Required for Claude API
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=your-secret-key-here
UPLOAD_DIR=uploads/
```

### Frontend:
- API base URL hardcoded: `http://localhost:8000/api/v1`
- No environment variables needed for development

---

## Running the Application

### Backend:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

### Frontend:
```bash
cd frontend
npm run dev
```

### Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Testing Status

### Manual Testing:
- ✅ User registration and login
- ✅ PDF upload and extraction
- ✅ Save to new folder
- ✅ Save to existing folder
- ✅ Duplicate folder name handling (auto-append)
- ✅ Duplicate property handling (Replace/Keep Both)
- ✅ Folder list display
- ✅ Folder detail with properties
- ✅ Property detail view
- ⏳ BOV property detail view (not yet implemented)

### Automated Testing:
- ❌ No unit tests yet
- ❌ No integration tests yet
- ❌ No E2E tests yet

---

## Performance Considerations

### Current Limits:
- **PDF upload:** 25MB max file size
- **Property list:** 100 properties max (no pagination)
- **Folder list:** Unlimited (but no pagination)
- **Claude API:** ~100k token context window used

### Optimization Opportunities:
1. Add pagination to lists
2. Implement search/filter before lists get large
3. Consider caching frequently accessed folders
4. Add database indexes if queries slow down
5. Compress PDF storage

---

## Security Considerations

### Current Security:
- ✅ JWT authentication on all protected routes
- ✅ User isolation (can only see own data)
- ✅ Password hashing (bcrypt)
- ✅ CORS enabled for localhost
- ✅ File type validation (PDF only)
- ✅ File size limits (25MB)

### Security Gaps:
- ⚠️ No rate limiting
- ⚠️ No email verification
- ⚠️ No password reset flow
- ⚠️ No HTTPS in development
- ⚠️ Uploaded files not encrypted
- ⚠️ API keys in .env (should use secrets manager in production)

---

## Next Steps

See TODO.md for planned work and priorities.
