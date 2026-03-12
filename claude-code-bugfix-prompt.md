# Claude Code Bug Fix Prompt — Astra CRE Platform
**Generated:** February 26, 2026
**Source:** QA-AUDIT.md live inspection (Feb 26, 2026)
**Repo:** grshapiro2001-crypto/astra-cre-platform

Paste this entire prompt into a Claude Code session to address all open bugs.

---

## Context

You are working on the Astra CRE Platform — a commercial real estate deal analysis tool.

**Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (frontend), FastAPI + SQLAlchemy + SQLite/PostgreSQL (backend).

**Critical rules:**
- Run `npx tsc --noEmit` after ALL frontend changes. Fix any TypeScript errors before committing.
- Run `npm run build` to verify production build.
- Use feature branches. Never push directly to `main`.
- Design system: purple theme only. `bg-primary` / `text-primary`. Never use `bg-emerald-*` or `text-emerald-*`.
- For backend schema changes: `alembic revision --autogenerate -m "message"` then review migration.
- The `ANTHROPIC_BASE_URL` env var may be overridden in `~/.zshrc` — extraction service must hardcode `base_url="https://api.anthropic.com"`.

**Before starting:** Read `.ai/01-CORE-RULES.md`, `.ai/03-CODEBASE.md`, `.ai/04-CURRENT-WORK.md`.

---

## Bug Fixes to Implement

Work through these in order. Each bug includes the exact file, the current broken behavior, and what it should do.

---

### BUG-001 + BUG-002 — Google Maps API Loaded Multiple Times / Retired Version

**Severity:** Critical (console ERROR on every page load)

**Current behavior:**
- Google Maps JavaScript API script is being injected multiple times per page, causing:
  `You have included the Google Maps JavaScript API multiple times on this page.`
- The API is loading retired version v3.55, causing 8+ `RetiredVersion` warnings per load.

**Files to check:** Search for `maps.googleapis.com/maps/api/js` across all `.tsx`, `.ts`, `.html`, and `index.html` files. Find every place the Maps script is loaded or injected.

**Fix:**
1. Remove ALL Maps script injections except ONE.
2. Move the single script tag to `frontend/index.html` (or load once in `App.tsx` via a single `useEffect` with a loaded-check guard).
3. Change the API version from `v=3.55` to `v=weekly` in the script URL.
4. Add a `window.googleMapsLoaded` guard if loading dynamically so it never loads twice.
5. Verify zero Maps-related errors in the browser console after fix.

---

### BUG-003 — "Add Note" Button Silently Drops Data

**Severity:** Critical (user-facing data loss)

**File:** `frontend/src/pages/PropertyDetail.tsx`

**Current behavior (search for this pattern):**
```typescript
console.log('Adding note:', newNote)
// Note is cleared but never persisted
```

**Fix:**

**Backend:** Add a notes endpoint. In `backend/app/api/routes/properties.py`:
```python
# POST /api/v1/properties/{id}/notes
# Body: { "note": string }
# Behavior: Append note with timestamp to a `notes_json` field on the Property model,
#   or create a separate `property_notes` table if you prefer normalized storage.
#   Return the updated notes list.
```
If adding a `notes_json` column to the Property model, generate an Alembic migration.

**Frontend:** In `PropertyDetail.tsx`:
- Replace the `console.log` stub with `await api.post(\`/properties/${property.id}/notes\`, { note: newNote })`
- On success: append the note (with timestamp) to a local `notes` state array so it appears immediately
- On error: show a toast/error message. Do not clear the input on failure.
- Show existing notes below the input (fetch on page load via `GET /api/v1/properties/{id}/notes`)

---

### BUG-004 — "Ask a Follow-up" Button Has No onClick Handler

**Severity:** Critical (AI feature appears present but is completely broken)

**File:** `frontend/src/pages/PropertyDetail.tsx`

**Current behavior:** There is an `<input>` and a `<button>` (with ArrowRight icon) for follow-up questions. The button has no `onClick`. Nothing happens on click or Enter keypress.

**Fix:**
- Add `onClick` handler to the button
- Add `onKeyDown` handler to the input (submit on Enter)
- On submit:
  1. Validate input is non-empty
  2. Show a loading state on the button (spinner)
  3. POST to `POST /api/v1/chat` with body `{ "message": userQuestion, "property_id": property.id }`
  4. Display the response in the AI Insights panel below the existing analysis
  5. On error: show error message inline
  6. Clear input after successful submission
- Use the exact same `api` Axios instance used elsewhere in the file (already has JWT auth interceptor)

---

### BUG-005 — Kanban `moveDeal` Not Persisted to Backend

**Severity:** High (pipeline board resets on reload)

**File:** `frontend/src/pages/Dashboard.tsx` (search for `moveDeal`)

**Current behavior:**
```typescript
const moveDeal = (dealId, newStage) => {
  console.log(`Moving deal ${dealId} to ${newStage}`)
  // Never calls API
}
```

**Fix:**
- Replace the console.log stub with an actual API call:
  ```typescript
  await api.patch(`/properties/${dealId}`, { pipeline_stage: newStage })
  ```
- Update local state optimistically (move card before API confirms) for snappy UX
- On API error: revert the optimistic update and show an error toast
- The `pipeline_stage` field already exists on the Property model with values: `screening`, `under_review`, `loi`, `under_contract`, `closed`, `passed`
- The PATCH `/api/v1/properties/{id}` endpoint already supports partial updates — verify `pipeline_stage` is in the update schema; add it if missing

---

### BUG-006 — "Save Comparison" Modal Closes Without Saving

**Severity:** High (comparison saves are lost)

**File:** `frontend/src/pages/ComparisonPage.tsx`

**Current behavior (search for `setShowSaveModal(false)`):**
```typescript
onClick={() => setShowSaveModal(false)}
// Form values for name, tags, notes are never read or sent
```

**Fix:**
1. Read the form state (comparison name, tags, notes) when Save is clicked
2. POST to the backend — you can use `POST /api/v1/deal-folders` or create a dedicated `POST /api/v1/comparisons` endpoint. Check which exists. If neither supports named comparisons, add a `saved_comparisons` table or serialize the comparison to an existing deal folder.
3. Show a success toast on save
4. Close modal only on success
5. Show an error state (don't close modal) on failure

---

### BUG-007 — NOI Chart Shows "---" When T12 Data Is Null

**Severity:** High (core financial metric invisible)

**File:** `frontend/src/pages/PropertyDetail.tsx` (Operating Financials section, NOI chart)

**Current behavior:** When `t12_noi` is null (e.g., The Skylark — no T12 financial document was uploaded), the NOI card shows `---` / `--- /unit` with no fallback.

**Fix:**
- Add fallback logic: if `t12_noi` is null, use `t3_noi`; if that's also null, use `y1_noi`
- Whichever period is used, label it clearly: "T12 NOI", "T3 NOI", or "Y1 Pro Forma NOI" (not just "NOI")
- In the chart selector, if T12 tab is selected but T12 data is unavailable, automatically select the next available period and show a muted banner: `"T12 data unavailable — showing [period] instead"`
- This affects both the metric card and any chart visualization

---

### BUG-008 — Settings "Save Changes" Hardcoded Disabled

**Severity:** High (users cannot update their profile)

**File:** `frontend/src/pages/Settings.tsx` (Profile & Account section)

**Current behavior:**
```tsx
<Button variant="outline" size="sm" disabled>Save Changes</Button>
```
Button is always disabled. No dirty state tracking.

**Fix:**
1. Add controlled state for `fullName` and `email` fields, initialized from `user.full_name` and `user.email`
2. Track dirty state: `const isDirty = fullName !== user?.full_name || email !== user?.email`
3. Remove `disabled` hardcode; replace with `disabled={!isDirty || isSaving}`
4. On click: `PATCH /api/v1/auth/me` with `{ full_name: fullName, email: email }`
5. On success: update Zustand auth store with new user data + show success toast
6. On error: show error toast, keep form editable

**Backend:** Verify `PATCH /api/v1/auth/me` exists and accepts `full_name` and `email`. If not, add it to `backend/app/api/routes/auth.py`.

---

### BUG-009 — Dashboard Metrics Fluctuate on Cold Start (Medium priority — do last)

**Severity:** Medium

**Context:** Render.com free tier spins down after inactivity. First API call on a cold start may return incomplete data while the backend warms up.

**Fix:** This is addressed by PR #41 (cold-start banner). If that PR isn't merged yet:
- Add a 5-second timeout to the skeleton loader: if data hasn't loaded in 5 seconds, show a banner:
  `"Backend is waking up from sleep — this may take up to 30 seconds on first load."`
- The banner should auto-dismiss when data loads

---

### BUG-010 — Notification Bell Has No Handler

**Severity:** Medium

**File:** `components/layout/Header.tsx` (search for Bell icon)

**Current behavior:** Bell renders with a purple dot but has no onClick.

**Fix (pick one):**
- **Option A (quick):** Remove the purple dot badge. Add a `title="Notifications coming soon"` tooltip to the button. This is honest and non-misleading.
- **Option B (better):** Implement a basic notification dropdown that shows the last 3 deal uploads or analysis completions, fetched from `GET /api/v1/properties?limit=3&sort=upload_date`.

Use Option A unless you have time for Option B.

---

### BUG-012 — Remove Debug console.log Statements

**Severity:** Low (cleanup)

Remove these three statements:

| File | Search string |
|------|--------------|
| `frontend/src/pages/FolderDetail.tsx` | `console.log('✅ Folder deleted` |
| `frontend/src/components/library/CreateFolderModal.tsx` | `console.log('🔵 Creating folder:` |
| `frontend/src/components/library/CreateFolderModal.tsx` | `console.log('✅ Folder created successfully:` |

---

## Commit Strategy

Create one feature branch per logical group:

1. `fix/maps-api-duplication` — BUG-001 + BUG-002 (Maps fix)
2. `fix/property-detail-stubs` — BUG-003 + BUG-004 + BUG-007 (PropertyDetail fixes)
3. `fix/persistence-stubs` — BUG-005 + BUG-006 (Kanban + Comparison save)
4. `fix/settings-profile` — BUG-008 (Settings Save Changes)
5. `fix/medium-cleanup` — BUG-009 + BUG-010 + BUG-012 (Medium/low priority)

After each branch: run `npx tsc --noEmit` and `npm run build`. Open a PR to main.

---

## Verification Checklist

After all fixes:
- [ ] Browser console shows zero errors and zero Google Maps warnings on Dashboard, Library, and Property Detail
- [ ] Typing a note on PropertyDetail and clicking "Add Note" persists it (visible after page reload)
- [ ] Typing a follow-up question and pressing Enter or clicking the button returns an AI response
- [ ] Dragging a Kanban card to a new stage shows the new stage after page reload
- [ ] "Save Comparison" modal — filling in name and clicking Save does not just close the modal
- [ ] The Skylark's Operating Financials chart shows T3 or Y1 NOI instead of "---"
- [ ] Settings profile fields are editable, Save button enables on change, submits correctly
- [ ] Bell icon either shows "coming soon" tooltip or a working dropdown
- [ ] Zero console.log debug statements visible in browser DevTools
