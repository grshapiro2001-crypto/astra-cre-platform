# Architecture & Technical Decisions - Astra CRE Platform

**Purpose:** Explains WHY we made certain technical choices. Reference when making similar decisions.  
**Length:** Keep under 250 lines. Details in code comments, not here.

---

## Tech Stack Decisions

### Why React + Vite?
**Chose:** React 18 with Vite build tool  
**Over:** Vue, Svelte, Next.js, Create React App

**Reasons:**
- Large ecosystem and community support
- TypeScript integration excellent
- Vite: Fast dev server, instant HMR
- shadcn/ui built for React
- Developer already familiar with React

**Trade-offs:**
- More boilerplate than Vue
- Not SSR out-of-box (don't need it yet)

---

### Why FastAPI?
**Chose:** FastAPI (Python)  
**Over:** Express (Node.js), Django, Flask

**Reasons:**
- Automatic API documentation (Swagger)
- Native async support
- Pydantic validation built-in
- Type hints for better IDE support
- Fast performance (comparable to Node)
- Python ecosystem for PDF processing (PyPDF2, pdfplumber)

**Trade-offs:**
- Smaller ecosystem than Node.js/Express
- Python deployment slightly more complex

---

### Why SQLite?
**Chose:** SQLite file database  
**Over:** PostgreSQL, MySQL, MongoDB

**Reasons:**
- Zero configuration (no server to run)
- Single file = easy backups
- Perfect for single-user local app
- SQLAlchemy makes migration to Postgres easy later
- Fast for < 100k records (plenty for MVP)

**Trade-offs:**
- No concurrent writes (not an issue for single user)
- Limited to local filesystem
- Will need to migrate to Postgres for multi-user

**Migration Plan (Future):**
- SQLAlchemy abstractions make this ~1 day of work
- Same ORM code, different connection string
- When: 100+ users or need multi-user concurrent access

---

### Why Tailwind CSS?
**Chose:** Tailwind utility-first CSS  
**Over:** Bootstrap, Material-UI, custom CSS

**Reasons:**
- No context switching (styles in JSX)
- No naming conflicts (no class name collisions)
- Tree-shakeable (small bundle size)
- shadcn/ui built on Tailwind
- Faster than writing custom CSS

**Trade-offs:**
- HTML can look cluttered
- Learning curve for utility classes
- Need to remember class names

---

### Why shadcn/ui?
**Chose:** shadcn/ui component library  
**Over:** Material-UI, Ant Design, Chakra UI

**Reasons:**
- Copy-paste, not npm package (full control)
- Built on Radix UI (accessible primitives)
- Tailwind-based (consistent with our styling)
- Customizable at source level
- Modern, clean design

**Trade-offs:**
- Smaller component library than Material-UI
- Need to copy components manually
- Less "batteries included" than full frameworks

---

## Data Model Design

### Deal-Centric Organization

**Core Principle:** Everything revolves around "Deals" (represented as Folders).

**Schema:**
```
deal_folders (The Deal)
  ├── id
  ├── folder_name (e.g., "Tower on Piedmont")
  ├── property_type (Multifamily, Office, etc.)
  └── document_count (cached for performance)

properties (Documents within a Deal)
  ├── id
  ├── deal_folder_id (FK to deal_folders)
  ├── property_name
  ├── document_type (OM, BOV, Rent Roll)
  └── [all extracted metrics]

bov_pricing_tiers (BOV Scenarios)
  ├── id
  ├── property_id (FK to properties)
  ├── tier_number (1, 2, 3)
  ├── tier_label ("Market", "Premium")
  └── [pricing, cap rates, returns]

bov_cap_rates (Cap Rates with Context)
  ├── id
  ├── property_id (FK to properties)
  ├── bov_pricing_tier_id (optional FK)
  ├── rate_type (Trailing, Proforma, Stabilized)
  ├── value (decimal)
  ├── noi_basis (T12, Y1, T3)
  └── qualifier (free text: "Tax-adjusted", "Proforma NOI")
```

**Why This Design:**
- Reflects user mental model (deals, not properties)
- Supports multiple documents per deal
- BOV tiers separate (can have 1-5 scenarios)
- Cap rates separate (multiple per property, with full context)

**Why NOT Simpler:**
- Could flatten everything into `properties` table
- But: BOV tiers would be JSON blobs (hard to query)
- But: Cap rates lose context (which NOI? which qualifier?)

---

### Orphaned Properties Pattern

**Design Decision:** Allow properties without folders (orphaned state).

**Why:**
- Users might upload before creating folders
- Deleting folder shouldn't force deleting documents
- Can reassign orphaned properties later

**Implementation:**
```python
# properties.deal_folder_id can be NULL
deal_folder_id = Column(Integer, ForeignKey("deal_folders.id"), nullable=True)
```

**UI Handling:**
- Library page shows folders (not orphaned properties)
- Separate "Orphaned Documents" section (future feature)
- Can assign orphans to folders via modal

---

## API Design Patterns

### RESTful Principles

**Endpoints:**
- `GET /deal-folders` - List all folders
- `POST /deal-folders` - Create folder
- `GET /deal-folders/{id}` - Get folder with properties
- `DELETE /deal-folders/{id}` - Delete folder
- `GET /properties/{id}` - Get property detail
- `POST /upload` - Upload & extract document
- `POST /compare` - Compare multiple properties

**Why REST:**
- Standard, well-understood
- Easy to test with curl/Postman
- FastAPI has excellent REST support

**Why NOT GraphQL:**
- Overkill for simple CRUD operations
- Adds complexity (schema, resolvers)
- REST is sufficient for current needs

---

### Response Format

**Standard Success Response:**
```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

**Standard Error Response:**
```json
{
  "detail": "Error message here"
}
```

**Why:**
- Consistent structure across all endpoints
- FastAPI HTTPException provides this automatically
- Frontend knows what to expect

---

## Performance Optimizations

### No LLM Calls on Reads

**Critical Decision:** Claude API ONLY called on upload, never on view.

**Why:**
- Claude API: $0.50-$2 per analysis
- If called on every property view: 100x higher costs
- Extract once, cache in database, serve from cache

**Implementation:**
- Upload flow: PDF → Claude API → Extracted JSON → Database
- View flow: Database → JSON → Frontend (no Claude)

**Cost Impact:**
- With caching: $1 per property (one-time)
- Without caching: $1 per VIEW (100x more expensive)

---

### Document Count Caching

**Decision:** Cache document count in `deal_folders.document_count`.

**Why:**
- Avoid COUNT queries on every folder card render
- Library page shows 20+ folders = 20+ COUNT queries
- Caching: Single query, instant load

**Implementation:**
- Increment on property save
- Decrement on property delete
- Re-calculate on folder load (if mismatch detected)

**Trade-off:**
- Cached value might be stale (rare)
- Performance gain worth it (20x faster Library page load)

---

## Frontend Architecture

### Component Structure

**Pages:**
- Full-page components
- Handle routing, data fetching
- Compose smaller components

**Components:**
- Reusable UI pieces
- Receive data via props
- No direct API calls (use services)

**Services:**
- API integration layer
- Centralized API calls
- Return typed data

**Example:**
```
PropertyDetail.tsx (Page)
  └─ calls propertyService.getProperty()
  └─ renders BOVPricingTiers.tsx (Component)
       └─ receives tiers as props
```

---

### State Management

**Decision:** React hooks only, no Redux.

**Why:**
- Simple app, no complex global state
- Context API sufficient for auth (future)
- Props drilling acceptable for now

**When to Add Redux:**
- 5+ components need same data
- Complex state updates (undo/redo)
- Real-time collaboration (future)

**Current State:**
- Local state: `useState` in components
- Server state: React Query (future optimization)

---

## Security Considerations

### Current (MVP):
- No authentication (single-user local app)
- No authorization (all data belongs to one user)
- API keys in `.env` (not committed)

### Future (Production):
- JWT authentication
- User table with hashed passwords
- Row-level security (users see only their data)
- HTTPS only
- Rate limiting on API endpoints

---

## Deployment Architecture (Future)

### Current (Local):
```
Frontend: npm run dev → localhost:5173
Backend: uvicorn → localhost:8000
Database: SQLite file → local filesystem
```

### Future (Production):
```
Frontend: Vercel (auto-deploy from GitHub)
Backend: Render (Docker container)
Database: Render PostgreSQL (managed service)
File Storage: Cloudflare R2 (PDF uploads)
```

**Why Vercel:**
- Free tier generous
- Auto-deploy from GitHub
- CDN built-in
- Zero config for Vite apps

**Why Render:**
- Free tier for hobby projects
- Supports Python/FastAPI
- Managed PostgreSQL included
- Docker support

**Why Cloudflare R2:**
- Cheaper than AWS S3 ($0.015/GB vs $0.023/GB)
- No egress fees
- S3-compatible API

---

## Trade-offs & Future Refactors

### Known Technical Debt:

1. **SQLite → PostgreSQL**
   - When: 100+ users or multi-user access needed
   - Effort: ~1 day (SQLAlchemy makes this easy)

2. **Local Files → Cloud Storage**
   - When: Deploying to production
   - Effort: ~2 days (integrate R2, update upload flow)

3. **No Authentication → JWT**
   - When: Multi-user MVP
   - Effort: ~3 days (backend auth, frontend login)

4. **No Pagination → Paginated Lists**
   - When: Users have 100+ properties
   - Effort: ~1 day (backend pagination, frontend infinite scroll)

5. **React Query for Server State**
   - When: Lots of API calls, need caching
   - Effort: ~2 days (refactor services)

---

<architecture_principles>
## Core Architecture Principles

1. **Optimize for Iteration Speed**
   - Choose tools that let you build fast
   - Avoid premature optimization
   - SQLite before Postgres, local before cloud

2. **Optimize for Cost**
   - Cache LLM results (don't re-call API)
   - Use free tiers (Vercel, Render free tier)
   - Avoid expensive services until necessary

3. **Plan for Scale, But Don't Build It Yet**
   - SQLAlchemy abstractions allow easy DB migration
   - RESTful API can add pagination later
   - File storage can move to cloud later

4. **Keep It Simple**
   - No microservices (monolith is fine)
   - No GraphQL (REST is sufficient)
   - No complex state management (hooks are enough)
</architecture_principles>

---

**Last Updated:** January 21, 2026  
**Token Count:** ~1,800 (optimized for context)
