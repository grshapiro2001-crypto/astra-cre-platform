# QA Audit — Talisman IO Platform

**Inspected:** March 8, 2026
**Scope:** Full codebase audit via git log, Vercel deployments, source file inspection
**Method:** Git log analysis (PRs #46–94), Vercel deployment inspection, source file review
**Previous audit:** February 26, 2026 (archived below)

---

## What Changed Since Last Audit (Feb 26 → Mar 8, 2026)

### ✅ Fixed / Resolved
- **BUG-005 RESOLVED** (PR #61): Kanban `moveDeal` now persists pipeline stage to DB with org-level template selection — no longer console.log-only
- **Render HTTP timeout** (PR #55): Async re-analyze endpoint prevents timeout on large documents
- **PDF memory spike** (PR #56): Memory usage reduced to stay under 512 MB on Render free tier
- **T12 extraction from OMs** (PR #59): All-null financials bug fixed; fuzzy matching engine added (PR #60)
- **T12 Excel upload extraction** (PRs #56–57): Empty financials from Excel uploads fixed
- **Rent roll parser**: Full rewrite for charge-code sub-rows, in_place_rent derivation, unit dedup, floor-aware mapping (PRs #69–73, #83, #86)

### 🆕 Major New Features Added
- **3D Stacking Viewer** (PRs #62–94): Interactive Three.js 3D building model, wired to rent roll. Tier 1→4, analyst side panel, unit click detail, fullscreen, floor isolation, screenshot export, proportional unit sizing, floor plan overlay mode (2D).
- **Organizations** (PRs #46–49): Team workspaces, invite flow, org context on Dashboard/Library
- **Market Research Extraction + Layer 2 Scoring** (PR #50): PDF → sentiment scoring
- **Floor Plan Extraction** (PRs #84–85, #94): Screenshot → unit position map → overlay on 3D viewer

### 📋 Still Open (carried from Feb 26)
- BUG-001: Google Maps API loaded multiple times
- BUG-002: Google Maps retired API version v3.55
- BUG-003: "Add Note" button silently drops data
- BUG-004: "Ask Follow-up" button inert
- BUG-006: "Save Comparison" closes modal without saving
- BUG-007: NOI chart shows "---" when T12 is null
- BUG-008: Settings "Save Changes" hardcoded disabled
- BUG-009: Dashboard metrics fluctuate on cold start
- BUG-010: Notification bell non-functional
- BUG-011: Notification preferences only stored locally
- BUG-012: Debug console.logs in production
- BUG-013: API key labeled as placeholder

---

## Current Bug Tracker (Mar 8, 2026)

### Critical

#### BUG-001 — Google Maps API Included Multiple Times
**Pages:** Dashboard, Library, Property Detail, Comparison (all map-bearing pages)
**Console:** `You have included the Google Maps JavaScript API multiple times on this page.` (ERROR level)
**Impact:** Map rendering instability, performance degradation, risk of silent failures
**Fix:** Load Maps API once at app root (`index.html` or single `useEffect` in `App.tsx`). Remove all other script injections.
**Status:** Open

#### BUG-002 — Google Maps Using Retired API Version (v3.55)
**Pages:** All map-bearing pages
**Console:** 8+ `RetiredVersion` warnings per load
**Impact:** Google may deprecate v3.55 at any time; maps could break in production without warning
**Fix:** Change script tag to `v=weekly` or `v=latest`
**Status:** Open

#### BUG-003 — "Add Note" Button Silently Drops Data
**File:** `pages/PropertyDetail.tsx` (approx. line 1466)
**Behavior:** `onClick` calls `console.log('Adding note:', newNote)` then clears input. Note never sent to backend.
**Impact:** Users believe they saved a note; data silently lost on page reload
**Fix:** POST note to `/api/v1/properties/{id}/notes`. Append to notes list in UI on success.
**Status:** Open

#### BUG-004 — "Ask a Follow-up" Button Completely Inert
**File:** `pages/PropertyDetail.tsx` (approx. line 1783)
**Behavior:** `<button>` has no `onClick` attribute. Does nothing.
**Impact:** Core AI feature appears present but is non-functional
**Fix:** Wire to `POST /api/v1/chat` (same pattern as AI pipeline analyst), stream response into panel.
**Status:** Open

---

### High

#### BUG-005 — Kanban `moveDeal` Not Persisted ✅ RESOLVED (PR #61)
**Fix Applied:** Pipeline stage now PATCHes backend; org-level template selection added
**Status:** **FIXED — Feb 2026**

#### BUG-006 — "Save Comparison" Closes Modal Without Saving
**File:** `pages/ComparisonPage.tsx` (approx. line 1886)
**Behavior:** `onClick={() => setShowSaveModal(false)}` — form values never sent anywhere
**Fix:** POST to `/api/v1/comparisons` (or deal-folders), confirm to user on success.
**Status:** Open

#### BUG-007 — NOI Chart Shows "---" in Operating Financials
**Page:** Property Detail → Operating Financials tab
**Affected:** Properties with null T12 data (e.g. The Skylark)
**Behavior:** NOI card shows `---` / `---/unit`
**Fix:** If T12 is null, fall back to T3 or Y1. Show banner: "T12 data unavailable — showing Y1 Pro Forma."
**Status:** Open

#### BUG-008 — Settings "Save Changes" Hardcoded Disabled
**File:** `pages/Settings.tsx` (Profile & Account section, approx. line 127)
**Behavior:** `<Button disabled>` — always disabled, no dirty-state tracking
**Fix:** Track form dirty state; enable when field differs from current value. PUT/PATCH to `/api/v1/auth/me`.
**Status:** Open

---

### Medium

#### BUG-009 — Dashboard Metrics Fluctuate on Reload
**Page:** Dashboard (metrics cards)
**Behavior:** Total Volume fluctuates across reloads on Render cold start
**Fix:** PR #41 (open) adds cold-start banner after 5s skeleton — merge to close
**Status:** Open (PR #41 pending merge)

#### BUG-010 — Notification Bell Has No Handler
**File:** `components/layout/Header.tsx`
**Behavior:** Bell icon renders with purple dot (implies unread), clicking does nothing
**Fix:** Wire to notifications panel, or hide dot + add "coming soon" tooltip
**Status:** Open

#### BUG-011 — Notification Preferences Only Stored Locally
**File:** `pages/Settings.tsx` (Notifications section)
**Behavior:** Toggles work visually but note says "stored locally for now"
**Fix:** Persist to user profile via `/api/v1/auth/me` or dedicated preferences endpoint
**Status:** Open

---

### Low

#### BUG-012 — Debug `console.log` Statements Still Present
**Files:** `pages/FolderDetail.tsx`, `components/library/CreateFolderModal.tsx`
**Note:** Additional debug logging may have been added during rent roll debugging (PRs #73–86) — audit before production demo
**Status:** Open

#### BUG-013 — Settings API Key Labeled as Placeholder
**File:** `pages/Settings.tsx` (API & Integrations)
**Text:** "API access is not yet available. Keys shown are placeholders."
**Status:** Open

---

## New Potential Issues (Mar 8, 2026)

#### BUG-014 — Stacking Viewer: Temporary Debug Logging in Production
**File:** Backend rent roll parser (PRs #73, #86 added diagnostic logging)
**Behavior:** `console.log` and Python debug prints visible in Render logs
**Impact:** Performance overhead, log noise; should be removed before external demos
**Severity:** Low
**Fix:** Remove or gate behind `DEBUG` env var

#### BUG-015 — Organization Invite Flow: Untested at Scale
**Page:** `/organization` — OrganizationSettings
**Behavior:** Invite flow added in PR #46 but not audited in production
**Impact:** Unknown — could fail silently if email delivery not configured
**Severity:** Medium
**Fix:** Test invite flow end-to-end; verify email delivery or add visible error state

#### BUG-016 — Floor Plan Overlay: Unit Marker Accuracy Unverified
**File:** `components/stacking/FloorPlanOverlay.tsx`
**Behavior:** Markers positioned by wing quadrant — may be approximate, not pixel-perfect
**Impact:** Cosmetic for now; could mislead investors if markers are far off
**Severity:** Low
**Fix:** Refine positioning algorithm or add "approximate" disclaimer

---

## Bug Summary (Mar 8, 2026)

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 4 | BUG-001, BUG-002, BUG-003, BUG-004 |
| High | 3 | BUG-006, BUG-007, BUG-008 |
| Medium | 3 | BUG-009, BUG-010, BUG-011 |
| Low | 5 | BUG-012, BUG-013, BUG-014, BUG-015 (med), BUG-016 |
| **Resolved** | **1** | BUG-005 ✅ |
| **Total Open** | **15** | |

---

## What's Working Well (Mar 8, 2026)

- **3D Stacking Viewer** — Full feature, 4 tiers, investor-grade visual quality
- **Floor Plan Overlay** — 2D mode with unit markers, toggleable with 3D
- **Organizations** — Multi-user workspace working; org context on all key pages
- **Kanban persistence** — Now saves to DB (BUG-005 resolved)
- **T12 extraction** — Fuzzy matching engine with Claude AI fallback
- **Rent Roll parser** — Comprehensive rewrite handles charge-code formats
- **Market Research** — Layer 2 sentiment scoring pipeline live
- **All 7 original API endpoints** — Still returning 200
- **Authentication** — JWT, protected routes, session expiry handling
- **Property Detail** — Street View, Quick Underwriting, Projected Returns, Deal Score

---

## Archived — Previous Audit (Feb 26, 2026)

<details>
<summary>View Feb 26 audit (archived)</summary>

Previous audit covered PRs up to #41 (cold-start banner, card interaction simplify). Key findings at that time:

**Newly Fixed (Feb 8 → Feb 26):**
- Notification toggles, Regenerate Key, Sidebar pipeline stats, PDF export, Street View, Quick Underwriting, Deal Score System

**Still Open at Feb 26:**
- BUG-001 through BUG-013 (except BUG-005 which was still open then)

**Open PRs at Feb 26:** #38 (simplify card interaction), #41 (cold-start banner)
- PR #38 status: Presumed merged (not visible in post-Feb-26 log)
- PR #41 status: Still pending (BUG-009 not resolved)

</details>
