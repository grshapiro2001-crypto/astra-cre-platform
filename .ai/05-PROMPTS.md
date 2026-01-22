# Prompt Templates - Astra CRE Platform

**Purpose:** Reusable, proven prompt templates for Claude Code sessions.  
**Usage:** Copy template, fill in specifics, paste to Claude Code.  
**Goal:** Save time and money with consistent, effective prompts.

---

## Template Format
```
GOAL: [One clear sentence of what you want]

FILES TO MODIFY:
- [Exact file paths]

CONTEXT:
- [What already exists]
- [What this builds on]

REQUIREMENTS:
- [Specific functionality needed]
- [Edge cases to handle]

REUSE:
- [Existing code/patterns to follow]

SUCCESS CRITERIA:
- [How to verify it works]

BUDGET: $X-Y
```

---

## Template 1: Add New Page

**Use when:** Creating a new full-page component with routing.
```
GOAL: Add [Page Name] page to the application

FILES TO MODIFY:
- frontend/src/pages/[PageName].tsx (CREATE NEW)
- frontend/src/App.tsx (add route)
- frontend/src/components/layout/Header.tsx (add nav link)

CONTEXT:
- Similar to [ExistingPage.tsx] in structure
- Follows existing routing pattern in App.tsx

REQUIREMENTS:
- TypeScript functional component
- Uses shadcn/ui components for UI
- Responsive design (mobile + desktop)
- Loading state while fetching data
- Error handling with user-friendly messages
- Route: /[page-path]

REUSE:
- Follow same layout pattern as [ExistingPage.tsx]
- Use same API call pattern as [ExistingService.ts]

SUCCESS CRITERIA:
- Page accessible at /[page-path]
- Navigation link appears in header
- Page renders without errors
- Responsive on mobile and desktop

BUDGET: $20-30
```

**Example:**
```
GOAL: Add Settings page to the application

FILES TO MODIFY:
- frontend/src/pages/Settings.tsx (CREATE NEW)
- frontend/src/App.tsx (add route)
- frontend/src/components/layout/Header.tsx (add nav link)

CONTEXT:
- Similar to Library.tsx in structure
- Follows existing routing pattern in App.tsx

REQUIREMENTS:
- User preferences form (theme, notifications)
- Save button that persists to localStorage
- Uses Card, Input, Label, Button from shadcn/ui
- Route: /settings

REUSE:
- Follow same layout pattern as Library.tsx
- Use same form pattern as CreateFolderModal.tsx

SUCCESS CRITERIA:
- Page accessible at /settings
- Settings icon appears in header
- Preferences save and persist
- Theme changes apply immediately

BUDGET: $25-35
```

---

## Template 2: Add New Component

**Use when:** Creating a reusable UI component.
```
GOAL: Create [ComponentName] reusable component

FILES TO MODIFY:
- frontend/src/components/[feature]/[ComponentName].tsx (CREATE NEW)
- [Parent component that will use it].tsx (import and use)

CONTEXT:
- Will be used in [ParentComponent]
- Similar to existing [SimilarComponent]

REQUIREMENTS:
- TypeScript with proper interface for props
- Uses shadcn/ui components
- Handles loading and error states
- Props:
  - [prop1]: [type] - [description]
  - [prop2]: [type] - [description]

REUSE:
- Follow same pattern as [SimilarComponent.tsx]
- Use same styling approach (Tailwind classes)

SUCCESS CRITERIA:
- Component renders with mock data
- Props typed correctly (no TypeScript errors)
- Responsive design
- Works in [ParentComponent]

BUDGET: $15-25
```

**Example:**
```
GOAL: Create PropertyCard reusable component for folder grid

FILES TO MODIFY:
- frontend/src/components/library/PropertyCard.tsx (CREATE NEW)
- frontend/src/pages/FolderDetail.tsx (use the new card)

CONTEXT:
- Will display property summary in folder detail page
- Similar to existing folder cards in Library.tsx

REQUIREMENTS:
- TypeScript with PropertyCardProps interface
- Uses Card, Badge from shadcn/ui
- Shows: property name, type, units, documents
- Click handler for navigation
- Hover effects (scale + shadow)
- Props:
  - property: Property - full property object
  - onClick: () => void - navigation handler

REUSE:
- Follow same pattern as folder cards in Library.tsx
- Use same hover effects from existing cards

SUCCESS CRITERIA:
- Card renders in folder detail grid
- Clicking navigates to property detail
- Hover effects work smoothly
- Responsive on all screen sizes

BUDGET: $15-20
```

---

## Template 3: Add API Endpoint

**Use when:** Creating new backend endpoint.
```
GOAL: Add [HTTP Method] [endpoint path] endpoint

FILES TO MODIFY:
- backend/app/api/routes/[route_file].py (add endpoint)
- backend/app/services/[service_file].py (add business logic - CREATE if needed)
- backend/app/schemas/[schema_file].py (add Pydantic schema - if needed)

CONTEXT:
- Similar to existing [similar endpoint]
- Part of [feature] functionality

REQUIREMENTS:
- HTTP Method: [GET/POST/PUT/DELETE]
- Path: /api/v1/[path]
- Request body: [describe or reference schema]
- Response: [describe or reference schema]
- Error handling: [specific errors to handle]
- Database operations: [what queries needed]

REUSE:
- Follow same pattern as [similar endpoint]
- Use existing [Model] for database queries

SUCCESS CRITERIA:
- Endpoint accessible at /api/v1/[path]
- Returns expected data structure
- Handles errors gracefully (404, 500, etc.)
- Works with existing database schema

BUDGET: $20-30
```

**Example:**
```
GOAL: Add GET /properties endpoint with filtering

FILES TO MODIFY:
- backend/app/api/routes/properties.py (add endpoint)
- backend/app/services/property_service.py (add filter logic)

CONTEXT:
- Similar to existing GET /deal-folders endpoint
- Part of property browsing functionality

REQUIREMENTS:
- HTTP Method: GET
- Path: /api/v1/properties
- Query params: property_type, min_units, max_units (all optional)
- Response: List of properties matching filters
- Error handling: Return empty array if no matches (not 404)
- Database: Query properties table with filters

REUSE:
- Follow same pattern as deal_folders.py list endpoint
- Use SQLAlchemy filter() method like existing queries

SUCCESS CRITERIA:
- GET /properties returns all properties (no filters)
- GET /properties?property_type=Multifamily returns filtered
- Returns empty array if no matches
- No errors in FastAPI logs

BUDGET: $20-25
```

---

## Template 4: Fix Bug

**Use when:** Debugging and fixing existing code.
```
GOAL: Fix [describe the bug]

FILES TO CHECK:
- [File where bug occurs]
- [Related files that might be involved]

BUG DESCRIPTION:
- What's happening: [current behavior]
- What should happen: [expected behavior]
- Steps to reproduce:
  1. [Step 1]
  2. [Step 2]
  3. [Bug occurs]

ERROR MESSAGES (if any):
```
[Paste exact error from console/logs]
```

CONTEXT:
- This broke after [recent change]
- OR: This never worked correctly

INVESTIGATION NEEDED:
- Check [specific function/component]
- Verify [specific data/state]
- Test [specific scenario]

SUCCESS CRITERIA:
- Bug no longer occurs
- No new bugs introduced
- Existing functionality still works

BUDGET: $10-20
```

**Example:**
```
GOAL: Fix folder count not updating after property deletion

FILES TO CHECK:
- backend/app/api/routes/properties.py (DELETE endpoint)
- backend/app/models/deal_folder.py (document_count field)
- frontend/src/pages/FolderDetail.tsx (displays count)

BUG DESCRIPTION:
- What's happening: After deleting a property, folder shows old count
- What should happen: Count decrements immediately
- Steps to reproduce:
  1. Open folder with 3 properties
  2. Delete one property
  3. Count still shows "3 documents"
  4. Refresh page, then it shows "2 documents"

ERROR MESSAGES: None (no errors, just wrong count)

CONTEXT:
- This worked before, might have broken during folder deletion feature

INVESTIGATION NEEDED:
- Check if DELETE /properties/{id} updates folder.document_count
- Verify frontend refetches folder data after delete
- Test if count updates on folder detail page

SUCCESS CRITERIA:
- Delete property, count updates immediately
- No page refresh needed
- Count is accurate

BUDGET: $10-15
```

---

## Template 5: Refactor Code

**Use when:** Improving existing code without changing functionality.
```
GOAL: Refactor [component/function] for [better performance/readability/reusability]

FILES TO MODIFY:
- [File to refactor]
- [Files that import it - may need updates]

CURRENT ISSUES:
- [What's wrong with current code]
- [Why it needs refactoring]

REFACTORING PLAN:
- [Specific improvement 1]
- [Specific improvement 2]
- [Specific improvement 3]

CONSTRAINTS:
- DO NOT change functionality
- DO NOT break existing tests
- Keep same external API (props/params)

SUCCESS CRITERIA:
- Code is cleaner/faster/more reusable
- All existing functionality works
- No TypeScript errors
- No console warnings

BUDGET: $15-25
```

**Example:**
```
GOAL: Refactor ComparisonTable to extract row rendering logic

FILES TO MODIFY:
- frontend/src/components/comparison/ComparisonTable.tsx
- frontend/src/components/comparison/ComparisonRow.tsx (CREATE NEW)

CURRENT ISSUES:
- ComparisonTable.tsx is 300+ lines (too long)
- Row rendering logic mixed with table logic
- Hard to test row rendering separately
- Repeated code for each row type

REFACTORING PLAN:
- Extract row rendering into ComparisonRow component
- Pass row data as props
- Keep gradient logic in criteriaEvaluation.ts
- Reduce ComparisonTable to ~150 lines

CONSTRAINTS:
- DO NOT change how table looks or works
- Keep same props interface for ComparisonTable
- Keep gradient highlighting working

SUCCESS CRITERIA:
- ComparisonRow.tsx created and reusable
- ComparisonTable.tsx under 200 lines
- Table renders identically
- Gradient highlighting still works

BUDGET: $20-25
```

---

## Template 6: UI Polish

**Use when:** Improving visual design without adding features.
```
GOAL: Polish UI of [page/component]

FILES TO MODIFY:
- [Component file]

IMPROVEMENTS NEEDED:
- [Specific visual improvement 1]
- [Specific visual improvement 2]
- [Specific visual improvement 3]

DESIGN REFERENCE:
- Follow design from [screenshot/mockup]
- Match style of [existing component]
- Use [specific Tailwind classes]

REQUIREMENTS:
- No functionality changes
- Responsive on mobile and desktop
- Consistent with existing design system
- Uses shadcn/ui components where possible

SUCCESS CRITERIA:
- Looks polished and professional
- Matches design reference
- No broken layouts
- Responsive on all sizes

BUDGET: $15-25
```

---

## Template 7: Add Feature to Existing Page

**Use when:** Extending an existing page with new functionality.
```
GOAL: Add [feature] to [ExistingPage]

FILES TO MODIFY:
- frontend/src/pages/[ExistingPage].tsx
- [New component file if needed]
- [Service file if new API calls needed]

CONTEXT:
- [ExistingPage] currently does [X]
- Adding [new functionality]

REQUIREMENTS:
- [Specific requirement 1]
- [Specific requirement 2]
- Integration with existing [feature]
- No breaking changes to current functionality

REUSE:
- Similar to how [OtherPage] does [similar thing]
- Use existing [service/component]

SUCCESS CRITERIA:
- New feature works as expected
- Existing functionality unaffected
- Integrates smoothly with page layout
- No errors or warnings

BUDGET: $20-30
```

---

## Budget Estimates by Task Type

**Quick Reference:**

| Task Type | Typical Cost | Time |
|-----------|--------------|------|
| Bug fix (simple) | $10-15 | 30 min |
| Bug fix (complex) | $20-30 | 1 hour |
| New component | $15-25 | 1 hour |
| New page | $25-35 | 1-2 hours |
| New API endpoint | $20-30 | 1 hour |
| Refactor | $15-25 | 1 hour |
| UI polish | $15-25 | 1 hour |
| Feature addition | $25-40 | 1-2 hours |
| Major feature | $50-80 | 2-3 hours |

**Factors that increase cost:**
- Complex business logic
- Many files to modify
- Unclear requirements (Claude has to guess)
- No existing code to reference
- Breaking changes required

**Factors that decrease cost:**
- Clear, specific requirements
- Existing similar code to follow
- Small, focused scope
- Well-defined success criteria

---

<prompt_optimization_tips>
## Tips for Effective Prompts

1. **Be Specific:** "Update line 45" not "improve the function"
2. **Reference Existing Code:** "Use same pattern as PropertyCard.tsx"
3. **Set Budget Upfront:** "Target: $20-25" prevents runaway costs
4. **Define Success:** Clear criteria = Claude knows when to stop
5. **Batch Tasks:** Do 3 small things in one session (cheaper than 3 sessions)
6. **Provide Context:** Link to docs, mention what exists
7. **XML Tags for Critical Info:**
```xml
   <critical>
   DO NOT modify files in /components/ui
   </critical>
```
</prompt_optimization_tips>

---

**Last Updated:** January 21, 2026  
**Token Count:** ~2,500 (comprehensive template library)
