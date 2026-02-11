# ARCHIVED — See .ai/ folder for current documentation

> **Note:** This file is archived as of February 11, 2026. See [.ai/04-CURRENT-WORK.md](.ai/04-CURRENT-WORK.md) and [README.md](README.md) for current documentation.

> Context file for AI assistants. Not user documentation. Last updated: Feb 8, 2026.

## Tech Stack

**Frontend:** React 18.2 · TypeScript 5.3 · Vite 5 · Tailwind 3.4 · shadcn/ui · Zustand 4.4 · Framer Motion · Axios · React Router 6
**Backend:** FastAPI 0.109 · Python 3.11 · SQLAlchemy 2.0 · Pydantic 2.5 · Alembic · Uvicorn
**Database:** SQLite (dev), PostgreSQL 15 (prod via Docker)
**AI:** Anthropic Claude Sonnet 4.5 via `anthropic` SDK — PDF extraction only
**Auth:** JWT (python-jose) + bcrypt, 60-min token expiry, httpOnly cookies

## What's Built and Working

- **Dashboard** — Pipeline kanban, metrics cards, area charts, AI summary panel. Real API integration (no mocks except kanban `moveDeal` which only console.logs).
- **Library** — Grid/list views, search, type/sort filters, batch property selection for comparison, deal folder CRUD.
- **Upload** — Drag-and-drop PDF upload → pdfplumber text extraction → Claude analysis → auto-save → redirect to property detail. No preview step.
- **Property Detail** — Full property view with T12/T3/Y1 financials, BOV multi-tier pricing, cap rate tables, AI re-analysis button.
- **Comparison** — Side-by-side (2–5 properties), scoring criteria panel, gradient highlighting, radar chart, CSV export.
- **Deal Folders** — Create, update, delete folders. Properties optionally belong to folders. Cascade or orphan on delete.
- **Auth** — Login, register, logout, protected routes, token refresh on app load.
- **Settings** — Renders but is non-functional (disabled buttons, placeholder toggles).
- **Design System** — Purple gradient theme, dark/light mode, page transitions, skeleton loading on all data-heavy pages.

## Actively Being Built

- **Deal Scoring System** — Backend implementation in progress in a separate Claude Code session. Do NOT touch `deal-score-spec.md`, `.ai/10-SCORING-IMPLEMENTATION-PLAN.md`, or scoring-related files to avoid merge conflicts.

## Known Bugs / QA Issues (see QA-AUDIT.md for full list)

- **"Add Note" button** (PropertyDetail, line 1466): console.logs only, never persists.
- **"Ask Follow-up" button** (PropertyDetail, line 1783): no onClick handler at all.
- **"Save Comparison" button** (ComparisonPage, line 1886): closes modal without saving form data.
- **Kanban moveDeal** (Dashboard, line 499): console.logs stage change, never persists.
- **Settings page**: "Save Changes" and "Regenerate Key" buttons are permanently disabled.
- **Notification bell** (Header, line 151): no onClick, purely decorative.
- **Sidebar pipeline stats**: hardcoded "$24.5M" / "12 Active Deals" — not fetched from API.
- **6 debug console.logs** in FolderDetail and CreateFolderModal should be removed.

## Design Rules

- **Purple theme only.** No emerald, no green accent colors. Primary is `#7c5cfc` / purple-violet gradient.
- **shadcn/ui for all primitives.** Button, Card, Dialog, Table, Tabs, Badge, etc. Never build custom when shadcn has it.
- **Fonts:** Syne (display headings), Instrument Sans (body), JetBrains Mono (code/monospace).
- **Dark mode:** class-based via Tailwind `dark:` prefix + CSS variables.
- **Animations:** Framer Motion for page transitions. Keyframes: fade-in, scale-in, shimmer, float.

## Architecture Rules

- **LLM calls only on upload and explicit re-analyze.** All other reads are DB-only. This saves 99% of API cost.
- **Financials stored as JSON strings** in Property model. Denormalized NOI fields for fast sorting.
- **Zustand for global state** (auth, UI prefs). React hooks for local/component state.
- **Axios interceptor** attaches JWT Bearer token. Auto-redirects to login on 401.
- **Path alias:** `@` → `frontend/src/` in Vite + tsconfig.
- **API proxy:** Vite proxies `/api/*` to `http://localhost:8000`.

## Git Status

- **Branch:** `main` (all work lands here)
- **3 merged branches** pending remote deletion: `claude/astra-cre-ui-integration-djd1t`, `claude/emerald-forest-design-system-DT9rs`, `claude/dashboard-api-integration-iMrNR`
- **Uncommitted:** `package-lock.json`, `astra-ecosystem-map.html`, `QA-AUDIT.md`

## Key File Locations

- Planning docs: `.ai/` (01-CORE-RULES through 10-SCORING-IMPLEMENTATION-PLAN)
- Frontend pages: `frontend/src/pages/`
- Frontend components: `frontend/src/components/` (layout/, library/, comparison/, property/, upload/, auth/, ui/)
- Frontend stores: `frontend/src/store/` (authSlice.ts, uiStore.ts)
- Frontend services: `frontend/src/services/` (api.ts, authService.ts, propertyService.ts, dealFolderService.ts, comparisonService.ts)
- Backend routers: `backend/app/routers/`
- Backend services: `backend/app/services/` (claude_extraction_service.py, property_service.py, bov_service.py, auth_service.py, pdf_service.py, comparison_service.py)
- Backend models: `backend/app/models/`
- Uploaded PDFs: `backend/uploads/{user_id}/`
