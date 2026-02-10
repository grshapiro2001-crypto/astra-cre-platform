# QA Audit — Placeholder & No-Op Handlers

> **Note:** This audit is archived as of February 10, 2026. Many issues listed here may have been resolved. Run a new audit if needed.

**Generated:** February 8, 2026
**Scope:** `frontend/src/` — all `.tsx` and `.ts` files
**Methodology:** Full scan for empty onClick handlers, console.log-only stubs, missing handlers, disabled buttons without implementation, TODO/placeholder comments, and hardcoded mock data on interactive elements.

---

## Critical — User-Facing Actions That Do Nothing

### pages/PropertyDetail.tsx — "Add Note" button (line 1466–1477)

**Element:** `<button>` labeled "Add Note"
**Current handler:** `onClick` calls `console.log('Adding note:', newNote)` then clears the input. Note is never persisted.
**Should do:** POST the note to a backend endpoint and append it to a notes list on the property.

### pages/PropertyDetail.tsx — "Ask a Follow-up" button (line 1783–1785)

**Element:** `<button>` with `<ArrowRight>` icon next to a text input
**Current handler:** No `onClick` attribute at all. Button renders but is completely inert.
**Should do:** Send the follow-up question to the Claude API (similar to re-analysis) and display the AI response in the panel.

### pages/ComparisonPage.tsx — "Save Comparison" button (line 1886–1890)

**Element:** `<button>` labeled "Save Comparison" inside a modal with fields for name, tags, and notes
**Current handler:** `onClick={() => setShowSaveModal(false)}` — closes the modal without reading or persisting any form values.
**Should do:** Capture the comparison name, tags, and notes from the modal form, POST to a backend endpoint, and confirm save to the user.

### pages/Dashboard.tsx — Kanban `moveDeal` function (line 499–500)

**Element:** Kanban board drag-and-drop handler
**Current handler:** Function body is only `` console.log(`Moving deal ${dealId} to ${newStage}`) ``. Stage change is never persisted.
**Should do:** PATCH the deal's stage via the backend API so the pipeline board reflects real state.

---

## High — Permanently Disabled Buttons

### pages/Settings.tsx — "Save Changes" button (line 127–129)

**Element:** `<Button variant="outline" size="sm" disabled>` labeled "Save Changes" in the Profile section
**Current handler:** No `onClick`. Button is hardcoded `disabled`.
**Should do:** Enable when form fields are dirty, then PUT/PATCH profile updates (full name, email) to the auth API.

### pages/Settings.tsx — "Regenerate Key" button (line 253–256)

**Element:** `<Button variant="outline" size="sm" disabled>` with `<RefreshCw>` icon, labeled "Regenerate Key"
**Current handler:** No `onClick`. Button is hardcoded `disabled`.
**Should do:** Trigger API key regeneration via a backend endpoint and display the new key.

---

## Medium — Missing Click Handlers

### components/layout/Header.tsx — Notification bell (line 151–154)

**Element:** `<button>` containing `<Bell>` icon with a purple dot indicator (suggesting unread notifications)
**Current handler:** No `onClick` attribute. Button is purely decorative.
**Should do:** Open a notifications dropdown or panel. If notifications aren't implemented yet, either hide the bell or add a "coming soon" tooltip.

---

## Medium — Hardcoded Mock Data on Interactive Elements

### components/layout/Sidebar.tsx — Pipeline stats (line 112–128)

**Element:** Stats box showing "$24.5M Total Value" and "12 Active Deals"
**Current values:** Hardcoded strings. Comment on line 112 reads `{/* Pipeline Stats (mock) */}`.
**Should do:** Fetch real aggregate pipeline data from the dashboard or deal-folders API and display actual totals.

---

## Low — Debug console.log Statements

These aren't broken UX, but they should be removed before production.

| File | Line | Statement |
|------|------|-----------|
| `pages/FolderDetail.tsx` | 56 | `console.log('✅ Folder deleted, navigating to library')` |
| `components/library/CreateFolderModal.tsx` | 33 | `console.log('🔵 Creating folder:', { folderName, propertyType })` |
| `components/library/CreateFolderModal.tsx` | 49 | `console.log('✅ Folder created successfully:', newFolder)` |

---

## Low — Placeholder Comments in Settings

| File | Line | Comment |
|------|------|---------|
| `pages/Settings.tsx` | 7 | `* - Notifications (placeholder toggles)` |
| `pages/Settings.tsx` | 8 | `* - API & Integrations (placeholder masked key)` |
| `pages/Settings.tsx` | 258 | `API access is not yet available. Keys shown are placeholders.` |

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 4 | User-facing buttons/actions that silently do nothing |
| **High** | 2 | Permanently disabled buttons with no path to enable |
| **Medium** | 2 | Missing handler on visible element; hardcoded mock data |
| **Low** | 6 | Debug logs and placeholder comments to clean up |
| **Total** | **14** | |

### Not flagged

- The **AI Summary** button on Dashboard (line 595–601) opens a panel — this is functional, not a stub.
- All **modal close/cancel** buttons work correctly.
- All **navigation links** in the Sidebar route properly.
- **Form submissions** on Login, Register, Upload, CreateFolder, and DeleteFolder all hit real API endpoints.
