# Core Development Rules - Astra CRE Platform

**Purpose:** Essential coding standards and constraints. Read this FIRST every session.
**Last Updated:** February 11, 2026

---

<critical_rules>
## BEFORE YOU START CODING

1. **Read documentation:** Review `.ai/SKILL.md` and all `.ai/*.md` docs before making changes
2. **Check existing code:** Review `.ai/03-CODEBASE.md` - Don't rebuild what exists
3. **Verify active task:** Check `.ai/04-CURRENT-WORK.md` - Only work on listed tasks
4. **Reuse over rebuild:** Can you adapt existing components instead of creating new ones?

## NEVER DO THIS

- ❌ Modify extraction prompts without testing with a real OM upload
- ❌ Use `localStorage` or `sessionStorage` (localStorage is OK for non-critical UI state like onboarding flags)
- ❌ Create custom UI components when shadcn/ui has them
- ❌ Write raw SQL queries (use SQLAlchemy ORM only)
- ❌ Ignore TypeScript errors
- ❌ Rebuild features that already exist
- ❌ Hardcode API keys or secrets (use environment variables)
- ❌ Push directly to main (use feature branches)

## ALWAYS DO THIS

- ✅ Run `npx tsc --noEmit` after frontend changes
- ✅ Run `npm run build` after frontend changes to verify build succeeds
- ✅ Run `alembic revision --autogenerate` for schema changes, review migration before committing
- ✅ Use TypeScript with proper interfaces
- ✅ Use Tailwind utility classes only (no custom CSS unless absolutely necessary)
- ✅ Test locally before marking task complete
- ✅ Handle errors gracefully with proper HTTP status codes
- ✅ Add loading states for async operations
- ✅ Commit to feature branches, merge to main after verification
- ✅ Use Opus for complex multi-file features, Sonnet for focused tasks
</critical_rules>

---

## Tech Stack

**Frontend:**
- React 18.2 + Vite 5 + TypeScript 5.3
- Tailwind CSS 3.4 (utility-first, no custom CSS)
- shadcn/ui components (don't modify `/components/ui`)
- Zustand 4.4 for state management
- React Router 6 for navigation
- Framer Motion for animations
- Lucide React for icons
- React Dropzone for file uploads
- TanStack Table for data tables
- React Google Maps for map integration

**Backend:**
- Python 3.9+ with FastAPI
- SQLAlchemy 2.0 ORM (no raw SQL)
- Alembic for database migrations
- Pydantic 2.5 for validation
- SQLite database (default, PostgreSQL supported)
- Anthropic Claude SDK (Sonnet 4.5)
- PDFPlumber for PDF parsing
- ReportLab for PDF generation
- python-jose for JWT authentication
- bcrypt for password hashing

**APIs:**
- Anthropic Claude API (document extraction and chat)
- Google Maps API (geographic visualization)

---

## Code Style Standards

### Frontend (TypeScript/React)

**Components:**
```typescript
// Use functional components with TypeScript
interface PropertyCardProps {
  propertyName: string;
  units: number;
  onSelect: (id: string) => void;
}

export function PropertyCard({ propertyName, units, onSelect }: PropertyCardProps) {
  return (
    <Card onClick={() => onSelect(id)}>
      <h3>{propertyName}</h3>
      <p>{units} units</p>
    </Card>
  );
}
```

**File Naming:**
- Components: `PascalCase.tsx` (e.g., `PropertyCard.tsx`)
- Utils: `camelCase.ts` (e.g., `calculateMetrics.ts`)
- Services: `camelCase.ts` (e.g., `propertyService.ts`)
- Pages: `PascalCase.tsx` (e.g., `PropertyDetail.tsx`)

**State Management:**
- Use Zustand stores for global state (`authSlice.ts`, `uiStore.ts`)
- Use React hooks (`useState`, `useEffect`, `useContext`) for component-level state
- API calls centralized in `/services`
- Path alias: `@` maps to `frontend/src/`

**Styling:**
- Tailwind utility classes only
- Use shadcn/ui components
- No inline styles
- No CSS modules

### Backend (Python/FastAPI)

**Type Hints:**
```python
def get_property(db: Session, property_id: int) -> Property:
    """Fetch property by ID."""
    return db.query(Property).filter(Property.id == property_id).first()
```

**File Naming:**
- Routes: `snake_case.py` (e.g., `deal_folders.py`)
- Models: `snake_case.py` (e.g., `property.py`)
- Services: `snake_case_service.py` (e.g., `claude_extraction_service.py`)

**Error Handling:**
```python
from fastapi import HTTPException

if not property:
    raise HTTPException(status_code=404, detail="Property not found")
```

---

## File Organization

### Frontend Structure
```
frontend/src/
├── components/
│   ├── ui/           # shadcn/ui primitives (DON'T MODIFY)
│   ├── layout/       # MainLayout, Sidebar, Header, PageTransition
│   ├── library/      # Library feature components (CreateFolderModal, etc.)
│   ├── comparison/   # Comparison feature components (ComparisonTable, etc.)
│   ├── property/     # Property feature components (BOVPricingTiers, etc.)
│   ├── scoring/      # Scoring feature components (DealScoreBadge, etc.)
│   ├── screening/    # Screening feature components (ScreeningBadge, etc.)
│   ├── upload/       # Upload feature components (PDFUploader, etc.)
│   ├── auth/         # Auth feature components (LoginForm, etc.)
│   └── onboarding/   # Onboarding feature components (OnboardingWizard, etc.)
├── pages/            # Full page components
├── services/         # API integration
├── store/            # Zustand stores (authSlice, uiStore)
├── types/            # TypeScript definitions
└── utils/            # Helper functions
```

### Backend Structure
```
backend/app/
├── api/routes/       # API endpoints (auth, upload, properties, deal_folders, scoring, data_bank, criteria, chat)
├── models/           # Database models (property, deal_folder, bov, data_bank, scoring, criteria, user)
├── schemas/          # Pydantic schemas
├── services/         # Business logic (claude_extraction, scoring, comparison, comp_matching, etc.)
└── utils/            # Helper functions
```

---

## Git Workflow

**Commit Messages:**
- Descriptive: `"Add BOV pricing tier extraction"`
- Not: `"updates"` or `"fix"`
- Include Claude.ai session link in commit footer

**Branch Naming:**
- Features: `feature/portfolio-map`
- Fixes: `fix/folder-delete-bug`
- Main branch: `main`

**What to Commit:**
- ✅ Source code
- ✅ Configuration files
- ✅ Documentation

**What NOT to Commit:**
- ❌ `.env` files
- ❌ `node_modules/`
- ❌ `__pycache__/`
- ❌ Database files (`*.db`)
- ❌ API keys or secrets

---

## Cost Optimization

### Claude API Calls
**ONLY call LLM on:**
- Initial document upload (`POST /upload`)
- Explicit re-analyze request (`POST /properties/{id}/reanalyze`)
- Data Bank Excel upload with column classification (`POST /data-bank/upload`)
- AI chat requests (`POST /chat`)

**NO LLM calls on:**
- Viewing folders (database query)
- Viewing properties (database query)
- Navigation or browsing
- Any read-only operations
- Comparison (uses cached database data)
- Scoring (uses cached database data)

**Why:** Claude API costs $0.50-$2 per document. Caching extracted data in database saves 99% of costs.

---

## Database Patterns

**Use SQLAlchemy ORM:**
```python
# Good
property = db.query(Property).filter(Property.id == property_id).first()

# Bad - NO RAW SQL
db.execute("SELECT * FROM properties WHERE id = ?", (property_id,))
```

**Relationships:**
```python
# One-to-Many
class DealFolder(Base):
    properties = relationship("Property", back_populates="folder")

class Property(Base):
    folder = relationship("DealFolder", back_populates="properties")
```

**Migrations:**
```bash
# After schema changes
alembic revision --autogenerate -m "Add new field"
alembic upgrade head
```

---

## API Design

**Endpoints:**
- RESTful: `GET /properties/{id}`, `POST /properties`, `DELETE /properties/{id}`
- Consistent naming: plural nouns (`/properties`, not `/property`)
- Use HTTP methods correctly (GET for read, POST for create, etc.)
- All endpoints prefixed with `/api/v1`

**Response Format:**
```python
# Success
return {"data": property, "message": "Property retrieved successfully"}

# Error
raise HTTPException(status_code=404, detail="Property not found")
```

**HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Validation error
- 401: Unauthorized
- 404: Not found
- 409: Conflict (duplicate)
- 500: Server error

---

## Component Reusability

**Before creating new components:**
1. Check `/components/ui` - shadcn has it?
2. Check existing feature folders - similar component exists?
3. Check other pages - can you extract and reuse?

**shadcn/ui Components Available:**
- Button, Card, Dialog, Input, Label, Select
- Table, Tabs, Badge, Alert, Checkbox
- Separator, Skeleton, RadioGroup, Slider

**Use these instead of building custom!**

---

## Testing Checklist

**Before marking task complete:**
- [ ] Code runs locally without errors
- [ ] `npx tsc --noEmit` passes with no TypeScript errors
- [ ] `npm run build` succeeds
- [ ] Existing features still work (didn't break anything)
- [ ] New feature works as expected
- [ ] Loading states display correctly
- [ ] Error states handle gracefully
- [ ] Responsive on different screen sizes

---

## Current Patterns (Feb 2026)

### Progressive Empty States
When displaying extracted data, show what's available vs missing:
- **Unit Mix**: If no unit_mix data, show "No unit mix data extracted from this document"
- **Rent Comps**: If no rent_comps data, show "No rent comps extracted from this document"
- **Renovation**: If no renovation data, show empty card state
- **Null Values**: Use "—" (em dash) for null/undefined numeric values, not "$0" or "N/A"

### Database Tables (Use These!)
**Property Tables:**
- `properties` - Main property table with 80+ columns
- `property_unit_mix` - Unit mix rows extracted from OM (floorplan, bedrooms, rents)
- `property_rent_comps` - Rent comps extracted from OM (distinct from Data Bank sales comps)
- Use relationships: `property.unit_mix` and `property.rent_comps`

**Deal Folder Tables:**
- `deal_folders` - Deal folder organization

**BOV Tables:**
- `bov_pricing_tiers` - Multiple pricing scenarios per property
- `bov_cap_rates` - Cap rates linked to tiers

**Data Bank Tables:**
- `sales_comps` - User-uploaded sales comp records
- `pipeline_projects` - User-uploaded pipeline/development projects
- `submarket_inventory` - User-input inventory denominators
- `data_bank_documents` - Uploaded Excel file tracking

**Scoring & Screening Tables:**
- `user_scoring_weights` - Configurable scoring with layer weights
- `user_investment_criteria` - Investment thresholds for deal screening

### Deal Scoring Patterns
- **Layer 1 (30%)**: Property Fundamentals - economic occupancy, opex ratio, supply pipeline
- **Layer 2 (20%)**: Market Intelligence - AI sentiment (cached on property)
- **Layer 3 (50%)**: Comp Analysis - relevance-weighted comp matching
- Color coding: Green (70-100), Yellow (40-69), Red (0-39)
- Configurable weights via Settings page
- Presets: Value-add, Cash Flow, Core, Opportunistic

### Deal Screening Patterns
- Investment criteria defined by user (IRR, cap rate, opex ratio, NOI growth, unit count, etc.)
- Properties automatically evaluated against criteria on upload
- Pass/Fail/Review verdicts displayed on property cards
- Screening modal shows detailed breakdown

---

## Common Gotchas

### Frontend
- Don't forget to add new routes to `App.tsx`
- Always use `@/` path alias for imports
- Axios interceptor automatically attaches JWT Bearer token
- Auto-redirect on 401 (unauthorized)

### Backend
- Always use `db: Session = Depends(get_db)` for database dependency injection
- Always use `current_user: User = Depends(get_current_user)` for authentication
- Filter all queries by `user_id` for multi-tenancy
- JSON fields stored as strings, need `json.loads()` to parse

---

<remember>
## CRITICAL REMINDERS (Read This Last)

1. **Read SKILL.md and .ai docs FIRST:** Always review documentation before making changes
2. **Run checks after changes:** `npx tsc --noEmit` and `npm run build` for frontend
3. **Use Alembic for schema changes:** `alembic revision --autogenerate` for database changes
4. **Test extraction prompts:** Never modify extraction prompts without testing with a real OM upload
5. **Choose the right model:** Use Opus for complex multi-file features, Sonnet for focused tasks
6. **Commit to feature branches:** Merge to main after verification

**Questions Before Starting:**
- What files need to be modified?
- What existing code can I reuse?
- Will this break anything existing?
- Do I need to run migrations?
</remember>

---

**Token Count:** ~2,500 (optimized for Claude Code context)
