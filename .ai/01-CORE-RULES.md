# Core Development Rules - Astra CRE Platform

**Purpose:** Essential coding standards and constraints. Read this FIRST every session.  
**Length:** Keep under 200 lines. Move examples to PROMPTS.md.

---

<critical_rules>
## BEFORE YOU START CODING

1. **Check existing code:** Review `.ai/03-CODEBASE.md` - Don't rebuild what exists
2. **Verify active task:** Check `.ai/04-CURRENT-WORK.md` - Only work on listed tasks
3. **Reuse over rebuild:** Can you adapt existing components instead of creating new ones?

## NEVER DO THIS

- ❌ Use `localStorage` or `sessionStorage` (not supported in Claude.ai artifacts)
- ❌ Create custom UI components when shadcn/ui has them
- ❌ Write raw SQL queries (use SQLAlchemy ORM only)
- ❌ Ignore TypeScript errors
- ❌ Rebuild features that already exist
- ❌ Hardcode API keys or secrets (use environment variables)

## ALWAYS DO THIS

- ✅ Use TypeScript with proper interfaces
- ✅ Use Tailwind utility classes only (no custom CSS unless absolutely necessary)
- ✅ Test locally before marking task complete
- ✅ Update `.ai/03-CODEBASE.md` if you create new files/components
- ✅ Handle errors gracefully with proper HTTP status codes
- ✅ Add loading states for async operations
</critical_rules>

---

## Tech Stack

**Frontend:**
- React 18 + Vite + TypeScript
- Tailwind CSS (utility-first, no custom CSS)
- shadcn/ui components (don't modify `/components/ui`)
- React Router for navigation
- Lucide React for icons

**Backend:**
- Python 3.11+ with FastAPI
- SQLAlchemy ORM (no raw SQL)
- Pydantic for validation
- SQLite database (local file)
- Anthropic Claude API (Sonnet 4)

**Deployment (Future):**
- Frontend: Vercel
- Backend: Render
- Database: SQLite file storage

---

## Code Style Standards

### Frontend (TypeScript/React)

**Components:**
# Core Development Rules - Astra CRE Platform

**Purpose:** Essential coding standards and constraints. Read this FIRST every session.  
**Length:** Keep under 200 lines. Move examples to PROMPTS.md.

---

<critical_rules>
## BEFORE YOU START CODING

1. **Check existing code:** Review `.ai/03-CODEBASE.md` - Don't rebuild what exists
2. **Verify active task:** Check `.ai/04-CURRENT-WORK.md` - Only work on listed tasks
3. **Reuse over rebuild:** Can you adapt existing components instead of creating new ones?

## NEVER DO THIS

- ❌ Use `localStorage` or `sessionStorage` (not supported in Claude.ai artifacts)
- ❌ Create custom UI components when shadcn/ui has them
- ❌ Write raw SQL queries (use SQLAlchemy ORM only)
- ❌ Ignore TypeScript errors
- ❌ Rebuild features that already exist
- ❌ Hardcode API keys or secrets (use environment variables)

## ALWAYS DO THIS

- ✅ Use TypeScript with proper interfaces
- ✅ Use Tailwind utility classes only (no custom CSS unless absolutely necessary)
- ✅ Test locally before marking task complete
- ✅ Update `.ai/03-CODEBASE.md` if you create new files/components
- ✅ Handle errors gracefully with proper HTTP status codes
- ✅ Add loading states for async operations
</critical_rules>

---

## Tech Stack

**Frontend:**
- React 18 + Vite + TypeScript
- Tailwind CSS (utility-first, no custom CSS)
- shadcn/ui components (don't modify `/components/ui`)
- React Router for navigation
- Lucide React for icons

**Backend:**
- Python 3.11+ with FastAPI
- SQLAlchemy ORM (no raw SQL)
- Pydantic for validation
- SQLite database (local file)
- Anthropic Claude API (Sonnet 4)

**Deployment (Future):**
- Frontend: Vercel
- Backend: Render
- Database: SQLite file storage

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
- Use React hooks (`useState`, `useContext`)
- No Redux/MobX (keep it simple)
- API calls centralized in `/services`

**Styling:**
- Tailwind utility classes only
- Use shadcn/ui components
- No inline styles
- No CSS modules

### Backend (Python/FastAPI)

**Type Hints:**
```python
def get_property(property_id: int) -> Property:
    """Fetch property by ID."""
    return db.query(Property).filter(Property.id == property_id).first()
```

**File Naming:**
- Routes: `snake_case.py` (e.g., `deal_folders.py`)
- Models: `snake_case.py` (e.g., `property.py`)
- Services: `snake_case.py` (e.g., `claude_extraction_service.py`)

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
│   ├── ui/           # shadcn (DON'T MODIFY)
│   ├── library/      # Library feature components
│   ├── comparison/   # Comparison feature components
│   └── property/     # Property feature components
├── pages/            # Full page components
├── services/         # API integration
├── types/            # TypeScript definitions
└── utils/            # Helper functions
```

### Backend Structure
```
backend/app/
├── api/routes/       # API endpoints
├── models/           # Database models
├── schemas/          # Pydantic schemas
├── services/         # Business logic
└── utils/            # Helper functions
```

---

## Git Workflow

**Commit Messages:**
- Descriptive: `"Add BOV pricing tier extraction"`
- Not: `"updates"` or `"fix"`

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
- Explicit re-analyze request

**NO LLM calls on:**
- Viewing folders (database query)
- Viewing properties (database query)
- Navigation or browsing
- Any read-only operations

**Why:** Claude API costs $0.50-$2 per document. Caching extracted data in database saves 99% of costs.

### When to Use Claude Code vs Manual
**Use Claude Code for:**
- New features (components, pages, API endpoints)
- Complex logic (calculations, algorithms)
- File creation (multiple files at once)
- Refactoring (restructuring code)

**Code manually for:**
- Small tweaks (changing text, colors)
- Bug fixes (one-line changes)
- Config updates (environment variables)
- Copy-paste adjustments

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

---

## API Design

**Endpoints:**
- RESTful: `GET /properties/{id}`, `POST /properties`, `DELETE /properties/{id}`
- Consistent naming: plural nouns (`/properties`, not `/property`)
- Use HTTP methods correctly (GET for read, POST for create, etc.)

**Response Format:**
```python
# Success
return {"data": property, "message": "Property retrieved successfully"}

# Error
raise HTTPException(status_code=404, detail="Property not found")
```

---

## Component Reusability

**Before creating new components:**
1. Check `/components/ui` - shadcn has it?
2. Check existing feature folders - similar component exists?
3. Check other pages - can you extract and reuse?

**shadcn/ui Components Available:**
- Button, Card, Dialog, Input, Label, Select
- Table, Tabs, Badge, Alert, Checkbox
- Separator, Skeleton, RadioGroup

**Use these instead of building custom!**

---

<budget_rules>
## Budget & Cost Management

**Before starting a task:**
1. Estimate cost: $X-Y based on complexity
2. If task might exceed estimate, ASK before proceeding
3. If task is taking too long, STOP and reassess

**Batch related changes:**
- Do 3 small tasks in one session (saves money)
- Not: 3 separate sessions for 3 small tasks

**Be specific in prompts:**
- Good: "Update ComparisonTable.tsx line 45 to add sort button"
- Bad: "Make comparison page better"
</budget_rules>

---

## Testing Checklist

**Before marking task complete:**
- [ ] Code runs locally without errors
- [ ] TypeScript has no errors
- [ ] Existing features still work (didn't break anything)
- [ ] New feature works as expected
- [ ] Loading states display correctly
- [ ] Error states handle gracefully
- [ ] Responsive on different screen sizes

---

<remember>
## CRITICAL REMINDERS (Read This Last)

1. **Check Before Building:** Review CODEBASE.md - what already exists?
2. **Stay on Task:** Only work on tasks in CURRENT-WORK.md
3. **Budget Aware:** Tell me if task exceeds estimate BEFORE continuing
4. **Reuse Code:** Adapting existing code is faster and cheaper than new code
5. **Update Docs:** If you create new files, add them to CODEBASE.md

**Questions Before Starting:**
- What files need to be modified?
- What existing code can I reuse?
- What's the expected cost?
- Will this break anything existing?
</remember>

---

## New Patterns (Feb 2026)

### Progressive Empty States
When displaying extracted data, show what's available vs missing:
- **Unit Mix**: If no unit_mix data, show "No unit mix data extracted from this document"
- **Rent Comps**: If no rent_comps data, show "No rent comps extracted from this document"
- **Renovation**: If no renovation data, show empty card state
- **Null Values**: Use "—" (em dash) for null/undefined numeric values, not "$0" or "N/A"

### New Database Tables (Use These!)
- `property_unit_mix` - Unit mix rows extracted from OM (floorplan, bedrooms, rents)
- `property_rent_comps` - Rent comps extracted from OM (distinct from Data Bank sales comps)
- Use relationships: `property.unit_mix` and `property.rent_comps`

### Deal Scoring Patterns
- **Layer 1**: Property fundamentals (economic occupancy, opex ratio, supply pipeline)
- **Layer 2**: Market intelligence (AI sentiment, cached on property)
- **Layer 3**: Comp analysis (relevance-weighted matching)
- Color coding: Green (70-100), Yellow (40-69), Red (0-39)

---

**Last Updated:** February 10, 2026
**Token Count:** ~2,200 (optimized for Claude Code context)

