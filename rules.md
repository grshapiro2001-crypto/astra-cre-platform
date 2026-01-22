# Astra CRE Platform - Development Rules

## Project Overview
AI-powered commercial real estate deal analysis platform. Extracts data from OMs/BOVs, enables property comparison, and provides portfolio-level analysis.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python FastAPI + SQLite
- **AI:** Anthropic Claude API (Sonnet 4)
- **Deployment:** Vercel (frontend) + Render (backend)

## Code Style & Standards

### Frontend
- Use functional components with TypeScript
- Use shadcn/ui components (not custom UI from scratch)
- Tailwind utility classes only (no custom CSS unless absolutely necessary)
- File naming: PascalCase for components (e.g., `PropertyCard.tsx`)
- Props: Always define TypeScript interfaces
- State management: React hooks (useState, useContext)
- API calls: Centralized in `/services` folder

### Backend
- Type hints for all functions
- Pydantic models for request/response validation
- Error handling: Return proper HTTP status codes
- Database: Use SQLAlchemy ORM, no raw SQL
- File structure: Routes in `/api/routes`, logic in `/services`

### Git Workflow
- Commit messages: Descriptive (e.g., "Add BOV pricing tier extraction")
- Branch naming: `feature/portfolio-map`, `fix/folder-delete-bug`
- Never commit `.env` files or secrets
- Push frequently to backup work

## File Organization

### Frontend Structure
```
frontend/src/
├── components/     (Reusable UI components)
│   ├── ui/        (shadcn components - don't modify)
│   ├── library/   (Library-specific components)
│   ├── comparison/(Comparison feature components)
│   └── property/  (Property detail components)
├── pages/         (Full page components)
├── services/      (API integration)
├── types/         (TypeScript type definitions)
└── utils/         (Helper functions)
```

### Backend Structure
```
backend/app/
├── api/routes/    (API endpoints)
├── models/        (Database models)
├── schemas/       (Pydantic schemas)
├── services/      (Business logic)
└── utils/         (Helper functions)
```

## What Exists Already (DON'T REBUILD)

### ✅ Completed Features
- Document upload (PDF processing)
- Claude AI extraction (OM/BOV data)
- Folder organization (deal folders)
- Property detail pages (with BOV pricing tiers)
- Side-by-side comparison (2-5 properties)
- Investment criteria filtering (with gradient highlighting)
- CSV export
- Dark/light mode

### ✅ Existing Components (REUSE THESE)
- `ComparisonTable.tsx` - Side-by-side property table
- `InvestmentCriteriaPanel.tsx` - Filter selection UI
- `PropertyDetail.tsx` - Full property view
- `BOVPricingTiers.tsx` - Multi-tier pricing display
- All shadcn/ui components in `/components/ui`

## Common Tasks & How to Approach Them

### Adding a New Page
1. Create component in `/pages`
2. Add route in `App.tsx`
3. Add navigation link in `Header.tsx`
4. Create corresponding API endpoints if needed
5. Add service functions in `/services`

### Adding a New API Endpoint
1. Create route in `backend/app/api/routes/`
2. Create service function in `backend/app/services/`
3. Add Pydantic schema if needed in `backend/app/schemas/`
4. Update database model if needed in `backend/app/models/`
5. Test endpoint before frontend integration

### Modifying Existing Features
1. Check what files are involved (use file search)
2. Read existing code to understand pattern
3. Maintain same coding style
4. Don't break existing functionality
5. Test thoroughly

## Cost Optimization Rules

### To Save Money on Claude Code Sessions
1. **Be specific in prompts** - "Update ComparisonTable.tsx to add X" not "improve comparison page"
2. **Batch related changes** - Do 3 small things in one session, not 3 sessions
3. **Reference existing code** - "Use same pattern as PropertyDetail.tsx"
4. **Provide exact requirements** - Don't make Claude guess

### When to Use Claude Code vs Manual Coding
- **Claude Code:** New features, complex logic, file creation, refactoring
- **Manual:** Small tweaks, bug fixes, copy-paste adjustments, config changes

## Database Schema (Current)

### Tables
- `deal_folders` - Container for related properties
- `properties` - Individual property data
- `bov_pricing_tiers` - Multi-tier BOV pricing
- `bov_cap_rates` - Cap rates with qualifiers
- `analysis_logs` - Extraction history

### Relationships
- Folders have many Properties (one-to-many)
- Properties have many BOV tiers (one-to-many)
- Properties have many Cap rates (one-to-many)

## API Endpoints (Current)

### Deal Folders
- `GET /deal-folders` - List all folders
- `POST /deal-folders` - Create folder
- `GET /deal-folders/{id}` - Get folder with properties
- `DELETE /deal-folders/{id}` - Delete folder

### Properties
- `GET /properties/{id}` - Get property details
- `GET /properties` - Get all properties (with filters)
- `DELETE /properties/{id}` - Delete property

### Upload
- `POST /upload` - Upload and extract OM/BOV
- `POST /upload/save-to-folder` - Save extracted property to folder

### Comparison
- `POST /compare` - Get comparison data for multiple properties

## Important Notes

### Never Do This
- ❌ Hardcode API keys (use environment variables)
- ❌ Use localStorage for sensitive data (Claude.ai artifacts don't support it)
- ❌ Create custom UI components when shadcn has them
- ❌ Write raw SQL (use SQLAlchemy ORM)
- ❌ Ignore TypeScript errors
- ❌ Break existing features when adding new ones

### Always Do This
- ✅ Test locally before committing
- ✅ Check if similar code exists before writing new
- ✅ Use existing patterns and conventions
- ✅ Keep components small and focused
- ✅ Handle errors gracefully
- ✅ Add loading states for async operations

## Project Goals & Priorities

### Phase 1: MVP Polish (Current)
- Visual improvements
- Bug fixes
- Beta testing preparation

### Phase 2: Portfolio Analysis (Next)
- Map view with property pins
- Advanced filtering
- Manual portfolios
- Smart portfolios (filter-based)

### Phase 3: Collaboration (Future)
- Team features
- Sharing
- Commenting

### Phase 4: AI Features (Future)
- Chatbot
- IC memo generation
- Predictive analytics

## Communication Preferences

### When Working with Claude Code
1. Start with clear objective: "Goal: Add X feature"
2. Specify files to modify: "Update: ComparisonTable.tsx"
3. Provide context: "This builds on existing comparison feature"
4. Define success criteria: "Should display Y when user does Z"
5. Note constraints: "Keep existing filtering functionality"
6. Set budget: "Target: $20-30"

### Good Prompt Example
```
GOAL: Add export to Excel functionality to comparison page

FILES TO MODIFY:
- frontend/src/pages/ComparisonPage.tsx (add export button)
- frontend/src/utils/excelExport.ts (create new file)

REQUIREMENTS:
- Button next to existing "Export CSV" button
- Use xlsx library (need to install: npm install xlsx)
- Export same data structure as CSV export
- Include property names as column headers
- Style: Match existing export button

REUSE:
- Follow same pattern as csvExport.ts
- Use same data structure from ComparisonTable

SUCCESS CRITERIA:
- Clicking button downloads Excel file
- File contains all comparison data
- Works with filtered data (investment criteria)

BUDGET: $15-20
```

### Bad Prompt Example (Don't Do This)
```
Can you make the comparison page better and add some export features?
```

## Questions to Ask Before Starting

When planning a feature with Claude Code, answer these first:
1. What files need to be modified?
2. What existing code can be reused?
3. What new dependencies are needed?
4. What's the expected cost (time/money)?
5. Does this break anything existing?
6. How will this be tested?

---

**Last Updated:** January 21, 2026  
**Maintained By:** Griffin Shapiro  
**Repository:** github.com/grshapiro2001-crypto/astra-cre-platform

/Users/griffinshapiro/Documents/Claude\ Test/rules.md cat rules.md
cat rules.md
