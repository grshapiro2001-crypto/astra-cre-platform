# TODO - CRE Investment Platform

**Last Updated:** 2026-01-17
**Current Phase:** Phase 3A - Deal Folders

---

## Active Work

### Status: Awaiting User Approval for Plan

---

## Remaining Features (From User Request)

### Priority 2: Manual Folder Creation
**Objective:** Allow users to create empty folders without uploading a document.

**Why:** Currently users can only create folders during the save flow. Need standalone folder creation for organizing deals before documents arrive.

**Tasks:**
1. Create `CreateFolderModal.tsx` component
   - Input: folder_name (required)
   - Input: property_type dropdown (optional) - Multifamily, Office, Retail, Industrial, Other
   - [Cancel] and [Create] buttons
   - Validation: folder name required, max 255 chars
   - Success: Close modal, refresh folder list

2. Add [+ New Deal Folder] button to Library.tsx
   - Position: Top right of page (near existing "+ Upload Document" button)
   - Opens CreateFolderModal on click
   - Uses existing Tailwind button styling

3. Wire up modal to API
   - Call `dealFolderService.createFolder()`
   - Handle duplicate names (backend auto-appends numbers)
   - Show success message on creation
   - Refresh folder grid after creation

**Files to Modify:**
- `frontend/src/components/library/CreateFolderModal.tsx` (NEW)
- `frontend/src/pages/Library.tsx` (add button + modal state)

**Risks:**
- None (minimal change)

**Testing:**
- Create empty folder, verify it appears in Library
- Create folder with duplicate name, verify auto-append works
- Leave folder name blank, verify validation error

---

### Priority 3: Delete Folder with Confirmation
**Objective:** Allow users to delete folders with clear warnings about document deletion.

**Why:** Need safe way to remove folders. Must handle two cases: empty folders (safe) and folders with documents (dangerous).

**Tasks:**
1. Create `DeleteFolderModal.tsx` component
   - Show folder name and document count
   - If document_count = 0: Simple confirmation
   - If document_count > 0: Two radio options
     - ○ Delete folder only (documents become orphaned)
     - ● Delete folder and all documents (default safer option: folder only)
   - Red warning text for "delete all documents" option
   - [Cancel] and [Delete Folder] buttons (Delete button red)

2. Add [Delete Folder] button to FolderDetail.tsx
   - Position: Top right of folder detail page
   - Red button styling (destructive action)
   - Opens DeleteFolderModal on click

3. Wire up modal to API
   - If "folder only": `DELETE /api/v1/deal-folders/{id}` (existing endpoint already sets properties to orphaned)
   - If "folder and documents": Add `?delete_contents=true` parameter to endpoint
   - Show success message
   - Navigate to Library page after deletion

4. Update backend DELETE endpoint to support delete_contents parameter
   - `DELETE /api/v1/deal-folders/{id}?delete_contents=true`
   - If true: Delete all properties first, then folder
   - If false: Set properties.deal_folder_id = NULL, then delete folder

**Files to Modify:**
- `frontend/src/components/library/DeleteFolderModal.tsx` (NEW)
- `frontend/src/pages/FolderDetail.tsx` (add button + modal state)
- `backend/app/api/routes/deal_folders.py` (update DELETE endpoint)

**Risks:**
- Accidental data loss if user selects "delete all documents"
- Mitigation: Default to safer option, require explicit selection, show warning

**Testing:**
- Delete empty folder, verify it's removed
- Delete folder with documents (folder only), verify properties become orphaned
- Delete folder with documents (all), verify properties are deleted
- Cancel deletion, verify nothing happens

---

### Priority 4: Rename Folder
**Objective:** Allow users to rename folders without recreating them.

**Why:** Users may want to change folder names as deal names evolve or to fix typos.

**Tasks:**
1. Add inline edit OR modal for folder name
   - Option A (Recommended): Inline edit on FolderDetail page
     - Click folder name to make it editable
     - [Save] [Cancel] buttons appear
     - Enter key saves, Escape cancels
   - Option B: Rename button opens modal with input

2. Wire up to API
   - Call `PATCH /api/v1/deal-folders/{id}` with `{folder_name: "New Name"}`
   - Backend already supports this (existing endpoint)
   - Updates `last_updated` timestamp automatically
   - Show success message

3. Update folder name in UI
   - Refresh folder detail page after save
   - Update breadcrumbs/header if present

**Files to Modify:**
- `frontend/src/pages/FolderDetail.tsx` (add inline edit or rename button + modal)

**Risks:**
- None (minimal change, existing backend support)

**Testing:**
- Rename folder, verify name updates in folder detail and Library grid
- Try to rename to blank, verify validation error
- Cancel rename, verify nothing changes

---

### Priority 5: BOV Property Detail View
**Objective:** Display BOV pricing tiers in property detail page.

**Why:** BOV documents have multiple pricing scenarios that need special visualization. Currently BOV data is extracted and stored but not displayed.

**Tasks:**
1. Update PropertyDetail.tsx to detect BOV documents
   - Check if `property.bov_pricing_tiers` exists and has length > 0
   - If yes, show "Pricing Scenarios" section below financials

2. Create `BOVPricingTiers.tsx` component
   - Horizontal tabs/pills for each tier (Tier 1, Tier 2, etc.)
   - Use tier_label if available ("Market Assumptions", "Premium Pricing")
   - Clicking tab shows that tier's details

3. Create tier detail cards
   - **Pricing Summary Card:**
     - Valuation (pricing)
     - Price per Unit
     - Price per SF
   - **Cap Rate Analysis Card:**
     - List all cap rates for this tier
     - Show: type, value, NOI basis, qualifier
     - Example: "Trailing: 4.75% (NOI: $2.1M, as-is)"
   - **Return Metrics Card:**
     - Unlevered IRR
     - Levered IRR
     - Equity Multiple
     - Avg Cash on Cash
   - **Loan & Terminal Assumptions Card:**
     - Leverage (LTV %)
     - Loan Amount
     - Interest Rate
     - I/O Period
     - Amortization Years
     - Terminal Cap Rate
     - Hold Period

4. Styling
   - Use existing Tailwind card styling
   - Match financial period cards design
   - Highlight tier_type = "asking_price" with special styling

**Files to Modify:**
- `frontend/src/pages/PropertyDetail.tsx` (add BOV section check)
- `frontend/src/components/property/BOVPricingTiers.tsx` (NEW)
- `frontend/src/components/property/BOVTierDetail.tsx` (NEW)

**Risks:**
- None (read-only display, data already in database)

**Testing:**
- Upload BOV document, verify pricing tiers display
- Switch between tiers, verify data updates
- Check all metrics display correctly
- Verify OM documents don't show BOV section

---

## Completed Tasks (Recent)

- ✅ Fixed infinite loading spinner on save (JavaScript scope issue)
- ✅ Implemented duplicate property handling (Replace vs Keep Both)
- ✅ Fixed duplicate folder name handling (auto-append numbers)
- ✅ Fixed user_id type mismatch (String vs Integer)
- ✅ Implemented BOV detection and extraction (backend)
- ✅ Updated Library page to show folder grid
- ✅ Created folder detail page
- ✅ Created save to folder modal

---

## Backlog (Not Prioritized)

### Search & Filter
- Search folders by name
- Filter folders by property type
- Filter folders by date range

### Pagination
- Paginate folder list (currently shows all)
- Paginate properties in folder

### Bulk Operations
- Select multiple properties
- Move multiple properties to different folder
- Delete multiple properties

### Analytics
- Portfolio summary dashboard
- Total NOI across all properties
- Average metrics by property type
- Deal count by status

### Export
- Export property data to CSV
- Export folder summary to Excel
- Generate PDF reports

### Collaboration
- Share folders with other users
- Comment on properties
- Activity feed

---

## Technical Debt

### High Priority:
- None currently

### Medium Priority:
- Add pagination to avoid performance issues with large datasets
- Add error boundary components for better error handling
- Add loading skeletons instead of generic "Loading..." text

### Low Priority:
- Add unit tests for services
- Add integration tests for API endpoints
- Add E2E tests for critical flows
- Set up CI/CD pipeline

---

## Notes

- All folder management features prioritize safety and data integrity
- Follow existing UI patterns (Tailwind, modal styling)
- All operations are NO LLM (database only)
- Keep changes small and focused
- Test each feature before moving to next
