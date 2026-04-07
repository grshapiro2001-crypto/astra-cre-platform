# TALISMAN IO — COMMAND CENTER BUG REPORT
**Date:** 2026-04-07
**Audited by:** QA Test Engineer (via Chief of Staff)
**Commit:** c0487ad
**Branch:** main

---

## BUILD STATUS

| Check | Status | Details |
|-------|--------|---------|
| `tsc --noEmit` | :x: FAIL (1 error) | TS5101: Option `baseUrl` is deprecated — blocks entire build pipeline |
| `npm run build` | :x: FAIL | Blocked by tsc error above — never reaches Vite bundler |
| Python compile | :white_check_mark: PASS | All backend `.py` files compile cleanly |

---

## CRITICAL — Blocks users or breaks core flows

### BUG-001: Production build completely broken — tsconfig baseUrl deprecation
- **Severity:** CRITICAL
- **Location:** `frontend/tsconfig.json:24`
- **Description:** The `baseUrl` compiler option triggers TypeScript error TS5101 in TypeScript 5.3+, which is treated as a hard error. The build script (`tsc && vite build`) fails at the `tsc` step and never reaches Vite, making production deployment impossible.
- **Root cause:** `"baseUrl": "."` on line 24 of tsconfig.json is deprecated in TypeScript 7.0 and errors without the `ignoreDeprecations` flag. The project uses TypeScript 5.3.3 which already enforces this.
- **Impact:** No production builds can be created. Zero deployability.
- **Suggested fix:** Add `"ignoreDeprecations": "6.0"` to the `compilerOptions` object in `tsconfig.json`.
- **Estimated effort:** S

### BUG-002: Multi-tenant data leakage — missing org_id scoping in comp matching
- **Severity:** CRITICAL
- **Location:** `backend/app/services/comp_matching_service.py:381,392,403`
- **Description:** The comparables matching service queries `SalesComp` records filtered by `user_id` only, without any `organization_id` filter. In a multi-tenant environment, this allows users to potentially see comparables belonging to users in other organizations.
- **Root cause:** `find_comps_for_subject()` and related functions do not accept or enforce an `org_id` parameter. All queries default to user-level isolation instead of org-level.
- **Impact:** Cross-organization data exposure. Users could see competitor deal comparables.
- **Suggested fix:** Add `org_id` parameter to all comp query functions and include `SalesComp.organization_id == org_id` in filter conditions.
- **Estimated effort:** M

---

## HIGH — Significant UX issues or data integrity risks

### BUG-003: Organization scoping bypass in Data Bank document deletion
- **Severity:** HIGH
- **Location:** `backend/app/api/routes/data_bank.py:425-450`
- **Description:** The delete endpoint verifies document ownership by `user_id` only, ignoring `organization_id`. A user who knows a document ID from another organization could delete it.
- **Root cause:** Delete query filters on `DataBankDocument.user_id == user_id` without also checking `organization_id`.
- **Impact:** Cross-organization document deletion if document IDs are guessable or exposed.
- **Suggested fix:** Add `organization_id` validation to the delete query, consistent with how other endpoints scope by org.
- **Estimated effort:** S

### BUG-004: Anthropic client missing base_url and API key in excel extraction
- **Severity:** HIGH
- **Location:** `backend/app/services/excel_extraction_service.py:1215`
- **Description:** One Anthropic client initialization uses `anthropic.Anthropic()` with no arguments — no `api_key`, no `base_url`, no `timeout`. Every other service in the codebase correctly passes all three parameters.
- **Root cause:** This function was likely added later without following the established pattern from `floor_plan_extraction_service.py` and others.
- **Impact:** Excel T12 extraction may fail in production if the `ANTHROPIC_API_KEY` environment variable isn't set at the process level (the SDK falls back to env var, but other services explicitly pass the key from config).
- **Suggested fix:** Change to `anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, base_url="https://api.anthropic.com", timeout=120.0)` matching the pattern in other services.
- **Estimated effort:** S

### BUG-005: Overly permissive CORS configuration
- **Severity:** HIGH
- **Location:** `backend/app/main.py:186-192`
- **Description:** CORS middleware is configured with `allow_methods=["*"]` and `allow_headers=["*"]` combined with `allow_credentials=True`. This maximally permissive configuration widens the attack surface.
- **Root cause:** Convenience configuration that was never tightened for production.
- **Impact:** Increases risk of CSRF attacks and preflight exploitation. Combined with credentials, attackers can probe private API patterns.
- **Suggested fix:** Restrict to `allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"]` and `allow_headers=["Content-Type", "Authorization"]`.
- **Estimated effort:** S

### BUG-006: Missing org_id scoping across 19+ backend service query locations
- **Severity:** HIGH
- **Location:** Multiple files:
  - `backend/app/services/bov_service.py:113-120`
  - `backend/app/services/property_service.py:321,328,395,406,433,481`
  - `backend/app/services/market_sentiment_scoring_service.py:210,225`
  - `backend/app/services/scoring_service.py:139,173,465,568,577`
  - `backend/app/services/screening_service.py:247`
  - `backend/app/services/pdf_report_service.py:1376`
  - `backend/app/services/assistant_service.py:244,253,334,424,463,515`
- **Description:** Systematic multi-tenant isolation gap. Many service-layer functions query by `user_id` only and don't accept or enforce `organization_id`. Some routes pass `org_id` but the service functions ignore it.
- **Root cause:** Organization support was added incrementally; service-layer functions weren't all updated.
- **Impact:** Users may access properties, scores, and reports from other organizations in edge cases.
- **Suggested fix:** Audit all service-layer DB queries and add `organization_id` filtering. This is a systematic fix across ~19 locations.
- **Estimated effort:** L

### BUG-007: Race condition — polling interval not cleaned up on unmount
- **Severity:** HIGH
- **Location:** `frontend/src/pages/PropertyDetail.tsx:214-227`
- **Description:** A `setInterval` is created inside an async `poll()` function within a `useEffect`, but the interval ID is not tracked or cleared on component unmount. If the user navigates away during polling, callbacks continue to fire.
- **Root cause:** The interval is created inside a nested async function, making it inaccessible to the useEffect cleanup return.
- **Impact:** "Can't perform a React state update on an unmounted component" warnings, potential memory leaks, and wasted API calls.
- **Suggested fix:** Store the interval ID in a ref (`useRef`) and clear it in the useEffect cleanup function. Also check mounted state before calling setState.
- **Estimated effort:** S

### BUG-008: Silent error swallowing in Dashboard
- **Severity:** HIGH
- **Location:** `frontend/src/pages/Dashboard.tsx:571,583`
- **Description:** API calls for screening summary and scoring data use `.catch(() => {})` — completely empty catch handlers that silently discard errors with no logging or user feedback.
- **Root cause:** Defensive coding that went too far — errors are hidden instead of handled.
- **Impact:** Users see blank/missing sections (screening summary, deal scores) with no indication that data failed to load. Debugging production issues becomes impossible.
- **Suggested fix:** Add `console.error()` logging at minimum, and ideally show a toast or inline error message to the user.
- **Estimated effort:** S

---

## MEDIUM — Functional but degraded experience

### BUG-009: Dead button handler in Library page
- **Severity:** MEDIUM
- **Location:** `frontend/src/pages/Library.tsx:1002`
- **Description:** Score button uses `onClick={scores[property.id] ? () => setScoreModalPropertyId(property.id) : undefined}`. When scores haven't loaded, the button appears clickable but does nothing on click — no visual disabled state.
- **Root cause:** Conditional onClick set to `undefined` instead of using a proper `disabled` attribute.
- **Impact:** Users click a button that appears active but nothing happens. Confusing UX.
- **Suggested fix:** Add `disabled={!scores[property.id]}` with appropriate styling (opacity, cursor).
- **Estimated effort:** S

### BUG-010: Hardcoded masked API key in Settings
- **Severity:** MEDIUM
- **Location:** `frontend/src/pages/Settings.tsx:289`
- **Description:** A hardcoded string `'sk-talisman-..............3f8a'` is displayed to users as if it's their actual API key. This is placeholder data.
- **Root cause:** API key management feature not yet connected to backend.
- **Impact:** Users may believe they have an API key when they don't. Misleading UI.
- **Suggested fix:** Either fetch actual API key from backend, show "Coming Soon" badge, or hide the section entirely.
- **Estimated effort:** S

### BUG-011: Notification settings stored locally only — UI suggests functional
- **Severity:** MEDIUM
- **Location:** `frontend/src/pages/Settings.tsx:253-286`
- **Description:** Email notification and deal alert toggles use local `useState` only. A small note says "stored locally for now" but the UI strongly implies these are real settings.
- **Root cause:** Backend notification service not yet implemented; frontend was built speculatively.
- **Impact:** Users change settings expecting them to work, but they reset on page reload and never affect actual notifications.
- **Suggested fix:** Either disable toggles with a "Coming Soon" badge or implement backend persistence.
- **Estimated effort:** S (to add badge) / M (to implement backend)

### BUG-012: Chat endpoint fetches all user properties without org scoping
- **Severity:** MEDIUM
- **Location:** `backend/app/api/routes/chat.py:87`
- **Description:** Chat context loads all properties by `user_id` without filtering by the user's current organization.
- **Root cause:** Organization context not threaded through to chat endpoint.
- **Impact:** AI assistant may reference properties from other orgs in responses, leaking deal information.
- **Suggested fix:** Accept org_id parameter or derive from user's current org membership and filter properties accordingly.
- **Estimated effort:** S

### BUG-013: Inconsistent error message extraction across pages
- **Severity:** MEDIUM
- **Location:** `frontend/src/pages/Upload.tsx:275-290`, `PropertyDetail.tsx`, `OrganizationSettings.tsx`
- **Description:** Each page implements its own version of Pydantic validation error parsing from Axios error responses. The logic differs across files — some handle arrays, some don't, some format differently.
- **Root cause:** No shared utility was created; each page reimplemented error parsing independently.
- **Impact:** Inconsistent error messages shown to users across different pages. Maintenance burden.
- **Suggested fix:** Extract to a shared `utils/extractErrorMessage.ts` utility and use it across all pages.
- **Estimated effort:** S

### BUG-014: Default placeholder API keys in config with no production validation
- **Severity:** MEDIUM
- **Location:** `backend/app/config.py:15`
- **Description:** `ANTHROPIC_API_KEY` defaults to `"your-api-key-here"`. No validation checks whether this placeholder is still present in production.
- **Root cause:** Development convenience that should have a production guard.
- **Impact:** If `.env` is missing in production, the app starts with a fake API key and all AI features silently fail.
- **Suggested fix:** Add a startup validator that raises an error if API key is the placeholder value when `DEBUG=False`.
- **Estimated effort:** S

### BUG-015: File upload accepts by extension only — no magic byte validation
- **Severity:** MEDIUM
- **Location:** `backend/app/utils/file_handler.py:12-29`
- **Description:** Upload validation checks only that the filename ends in `.pdf`. No content inspection is performed.
- **Root cause:** Quick implementation that relied on filename extension only.
- **Impact:** A malicious file renamed to `.pdf` would pass validation. Low risk in practice since the file is processed by pdfplumber (which would fail), but defense-in-depth is missing.
- **Suggested fix:** Add PDF magic byte check (`%PDF-` header) after extension validation.
- **Estimated effort:** S

### BUG-016: Chat stream response assumes response.body exists
- **Severity:** MEDIUM
- **Location:** `frontend/src/services/chatService.ts:30-34`
- **Description:** Uses `response.body?.getReader()` with optional chaining, but the subsequent null check and error handler could be more robust for edge cases in older browsers.
- **Root cause:** Streaming API compatibility not fully handled.
- **Impact:** In browsers without ReadableStream support, the error message may not display correctly.
- **Suggested fix:** Add explicit `if (!response.body)` check before the optional chaining and provide a clearer fallback.
- **Estimated effort:** S

---

## LOW — Cosmetic, polish, or minor annoyances

### BUG-017: Index as key in PropertyDetail follow-up responses
- **Severity:** LOW
- **Location:** `frontend/src/pages/PropertyDetail.tsx:1010`
- **Description:** `key={idx}` used on follow-up response items that can be dynamically added/removed.
- **Root cause:** Quick implementation using array index instead of stable identifier.
- **Impact:** React reconciliation issues if items are reordered — stale content may display.
- **Suggested fix:** Use a stable key like `key={`followup-${item.question}-${idx}`}` or add UUID to each item.
- **Estimated effort:** S

### BUG-018: Index as key in Upload and FolderDetail skeleton loaders
- **Severity:** LOW
- **Location:** `frontend/src/pages/Upload.tsx:88`, `frontend/src/pages/FolderDetail.tsx:103`
- **Description:** Skeleton loading placeholders use array index as key.
- **Root cause:** Static arrays for skeleton UI — low-risk use of index keys.
- **Impact:** Minimal — these are temporary loading states with static content.
- **Suggested fix:** Use `key={`skeleton-${i}`}` for correctness, though impact is negligible.
- **Estimated effort:** S

### BUG-019: Dead code block in PropertyDetail
- **Severity:** LOW
- **Location:** `frontend/src/pages/PropertyDetail.tsx:~950`
- **Description:** `{false && <div />}` — a conditional render that is permanently false, likely leftover from development/debugging.
- **Root cause:** Commented-out feature that was disabled via `false &&` instead of being removed.
- **Impact:** No runtime impact. Code clutter only.
- **Suggested fix:** Remove the dead block entirely.
- **Estimated effort:** S

### BUG-020: localStorage access without error handling in Settings reset
- **Severity:** LOW
- **Location:** `frontend/src/pages/Settings.tsx:240-241`
- **Description:** `localStorage.removeItem('talisman_onboarding_complete')` followed by `window.location.reload()` — no try-catch wrapper, and uses hard page reload instead of SPA navigation.
- **Root cause:** Quick implementation; other parts of the app correctly wrap localStorage in try-catch.
- **Impact:** Could throw in private browsing mode. Hard reload is jarring vs. SPA navigation.
- **Suggested fix:** Wrap in try-catch and use `navigate('/dashboard')` instead of `window.location.reload()`.
- **Estimated effort:** S

### BUG-021: 42 uses of `any` type across frontend
- **Severity:** LOW
- **Location:** Across 20+ files — majority are `catch (err: any)` in error handlers
- **Description:** Widespread use of TypeScript `any` type, primarily in catch blocks and a few data mapping functions.
- **Root cause:** TypeScript doesn't natively type catch clause variables; `any` is the common escape hatch.
- **Impact:** Reduced type safety in error paths. Not a runtime bug but increases maintenance risk.
- **Suggested fix:** Use `unknown` type with type narrowing where practical. Low priority.
- **Estimated effort:** M

### BUG-022: Dynamic SQL column names via f-strings in migrations
- **Severity:** LOW
- **Location:** `backend/app/main.py:49,77,88,103,118,128,138,148,165`
- **Description:** Column names are interpolated into SQL `ALTER TABLE` statements using f-strings. While the column names are hardcoded (not user input), this is an anti-pattern.
- **Root cause:** Manual migration logic using raw SQL text instead of SQLAlchemy DDL helpers.
- **Impact:** No current vulnerability (column names are hardcoded constants), but if refactored to accept dynamic input this becomes SQL injection. Code smell.
- **Suggested fix:** Use SQLAlchemy DDL helpers (`AddColumn`, `Column`) or at minimum maintain a strict whitelist of allowed column names.
- **Estimated effort:** M

---

## MOCKED / PLACEHOLDER FEATURES

List of features that appear functional in the UI but use hardcoded or fake data:

| Feature | Location | Current state | Notes |
|---------|----------|---------------|-------|
| API Key display | `frontend/src/pages/Settings.tsx:289` | Hardcoded masked string `sk-talisman-...3f8a` | No backend API key management exists |
| Notification preferences | `frontend/src/pages/Settings.tsx:253-286` | Local state only, resets on reload | Small note says "stored locally for now" |
| Command Center bug tracker | `frontend/src/pages/CommandCenter.tsx` | Hardcoded bug/task list | Useful internal tool but data is static, not from API |

---

## DESIGN SYSTEM VIOLATIONS (separate track — do NOT fix in bug session)

### DSV-001: Old display font classes (Cinzel/Questrial) still in use
- **Location:** 177+ instances across nearly all components
- **Current:** `font-display` CSS class used extensively for headings and titles
- **Should be:** Inter font family only per B&W Liquid Glass v3 design system

### DSV-002: Amber Tailwind utilities (old Champagne Gold system)
- **Location:** 30 instances across `badge.tsx`, `PricingAnalysis.tsx`, `UnitMixTab.tsx`, `ComparablesTab.tsx`, `OnboardingWizard.tsx`, `KanbanBoard.tsx`, `ScreeningModal.tsx`, `tabUtils.ts`, `UWT12MappingPage.tsx`
- **Current:** `amber-50`, `amber-100`, `amber-200`, `amber-300`, `amber-400`, `amber-500`, `amber-600`, `amber-800`, `amber-900` Tailwind classes
- **Should be:** Design system accent colors via CSS custom properties

### DSV-003: Raw hex colors instead of CSS custom properties
- **Location:** 15+ instances in `glass-calendar.tsx`, `ai-prompt-box.tsx`, `TalismanLogo.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`, `Sidebar.tsx`, `CompMap.tsx`
- **Current:** Hardcoded hex values like `#060608`, `#0c0c0f`, `#1a1a1e`, `#9b87f5`, `#B8B8C8`
- **Should be:** CSS custom properties from design system tokens

---

## CODE HEALTH OBSERVATIONS

### Developer markers found:
- `frontend/src/hooks/useGoogleMapsReady.ts:3` — `eslint-disable-next-line @typescript-eslint/no-explicit-any` (justified: Google Maps typing)
- `frontend/src/pages/Dashboard.tsx:612` — `eslint-disable-next-line react-hooks/exhaustive-deps` (intentional dependency omission)

### Dead code / unused:
- `frontend/src/pages/PropertyDetail.tsx:~950` — `{false && <div />}` block (BUG-019)
- No other significant dead code detected

### Missing error handling patterns:
- `frontend/src/pages/Dashboard.tsx:571` — `criteriaService.getScreeningSummary().catch(() => {})` (BUG-008)
- `frontend/src/pages/Dashboard.tsx:583` — `scoringService.getScores().catch(() => {})` (BUG-008)
- Multiple `try { localStorage... } catch { /* noop */ }` patterns in Dashboard (acceptable for non-critical state)

### Console statements in production:
- 15 `console.error`/`console.warn` statements across `ErrorBoundary.tsx`, `PDFUploader.tsx`, `ExcelUploader.tsx`, `UnderwritingTab.tsx`, `OnboardingWizard.tsx`, `StackingSection.tsx`, `main.tsx`, `Dashboard.tsx`, `Upload.tsx`, `FolderDetail.tsx`
- Most are in error handlers — acceptable for debugging but should be gated behind a DEBUG env var before client demos

### Localhost references:
- `frontend/src/services/api.ts:3` — `'http://localhost:8000/api/v1'` (fallback only, env-var protected)
- `frontend/src/services/assistantService.ts:3` — same pattern
- `frontend/src/services/chatService.ts:3` — same pattern

### Security observations:
- **Org scoping gaps:** 19+ backend queries missing `organization_id` filter (BUG-002, BUG-003, BUG-006, BUG-012)
- **CORS overly permissive:** Wildcard methods/headers with credentials (BUG-005)
- **No file content validation:** PDF uploads checked by extension only (BUG-015)
- **Placeholder secrets in config:** Default API key value not validated in production (BUG-014)
- **No exposed credentials found** in source code

### Anthropic client check:
- 7 of 8 services correctly initialize with explicit `api_key`, `base_url`, and `timeout`
- `excel_extraction_service.py:1215` uses bare `anthropic.Anthropic()` with no args (BUG-004) — **CRITICAL GOTCHA**

---

## SUMMARY

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 6 |
| Medium | 8 |
| Low | 6 |
| Design violations | 3 categories (220+ instances) |
| Mocked features | 3 |

**Recommended fix order:**
1. **BUG-001** — Fix tsconfig to unblock production builds (prerequisite for everything)
2. **BUG-002, BUG-003, BUG-006, BUG-012** — Multi-tenant org scoping (security-critical, systematic fix)
3. **BUG-004** — Anthropic client config in excel extraction (production functionality)
4. **BUG-005** — CORS lockdown (security hardening)
5. **BUG-007** — Polling cleanup in PropertyDetail (memory leak)
6. **BUG-008** — Dashboard silent error swallowing (debuggability)
7. **BUG-009 through BUG-016** — Medium severity in listed order
8. **BUG-017 through BUG-022** — Low severity cleanup pass

**Dependencies:**
- BUG-001 must be fixed first — blocks build verification of all other fixes
- BUG-006 is a superset that includes BUG-002, BUG-003, and BUG-012 — fix systematically together

**Estimated total effort:** ~8-12 hours for all fixable bugs (excluding design system violations which are a separate migration track)

**Areas NOT audited:**
- End-to-end integration tests — no test suite found in frontend
- Runtime behavior with real API responses — audit was static code analysis only
- Mobile responsiveness — not in scope for code audit
- Backend test files (`test_claude_api.py`, `test_data_bank.py`, `test_underwriting_engine_v2.py`) — utility scripts, not production code
- Database migration files in `alembic/versions/` — 21 migration files not individually audited
- Third-party dependency vulnerabilities — no `npm audit` or `pip audit` run
