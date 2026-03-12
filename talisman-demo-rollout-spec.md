# Talisman IO — Demo Rollout Spec

**Author:** Griffin Shapiro (CEO) + Claude
**Date:** March 11, 2026
**Status:** Draft v2 (peer-reviewed)
**Timeline:** 3–5 weeks (rolling launch, 1 user at a time)

---

## 1. Problem Statement

Talisman IO is approaching its first external demo with 5–15 select users from Griffin's network — primarily CRE acquisition professionals. There is currently no mechanism for test users to report bugs, submit feature ideas, or provide structured feedback. There is also no system for the AI extraction engine to improve over time as more documents are uploaded. Finally, the platform lacks the observability infrastructure needed for a CEO to monitor demo health, user engagement, and product-market fit signals during a critical validation phase.

This spec covers three systems that must exist before demo launch:

1. **Bug Reporting & Feedback System** — user-facing submission + Command Center delivery
2. **AI Learning Pipeline** — behind-the-scenes extraction improvement as data volume grows
3. **Demo Rollout Infrastructure** — user approval gate, analytics, and CEO tracking dashboard

---

## 2. Goals

- **G1:** Every test user can report a bug or submit an idea in under 30 seconds without leaving the page they're on
- **G2:** 100% of submissions arrive in the Command Center with full context (screenshot, page URL, browser info, console errors) — zero "which page were you on?" follow-up needed
- **G3:** Griffin can reply to feedback directly from the Command Center, creating a closed-loop conversation
- **G4:** Extraction accuracy measurably improves as the system processes more documents, tracked by per-field confidence scores
- **G5:** Griffin has a single dashboard view showing active users, bug volume, feature requests, extraction health, and engagement metrics

---

## 3. Non-Goals

- **Building a public-facing support desk.** This is a lightweight internal feedback loop for 5–15 known users, not Zendesk.
- **User-visible AI learning indicators.** The learning pipeline operates entirely behind the scenes. Users should never see confidence scores, pattern libraries, or "the AI is learning" messaging.
- **Self-service user management.** For this phase, Griffin manually approves users. No admin panel for delegating approval to others.
- **Email notifications to users.** Feedback acknowledgment happens in-app only. No email integration needed for v1.
- **Mobile-responsive feedback widget.** Demo users will be on desktop (CRE workflow is desktop-first).

---

## 4. System 1: Bug Reporting & Feedback

### 4.1 User Stories

**As a test user, I want to:**
- Report a bug from any page without navigating away, so I can capture the issue in context
- Attach a screenshot (upload or in-app capture) so I don't have to describe visual problems in words
- Categorize my submission (Bug / Feature Idea / Other) so the developer knows how to prioritize it
- See confirmation that my report was received so I know it didn't disappear into the void
- View my past submissions and see if there's a reply, so I can track the conversation
- Reply back to Griffin's follow-up questions within the same thread, so the conversation doesn't spill into Slack/email

**As Griffin (admin), I want to:**
- See all incoming reports in the Command Center as a live feed, with newest first
- View the full context of each report (screenshot, URL, browser, console errors) without asking the user
- Reply to a report from the Command Center, with the reply visible to the user in-app
- Filter reports by type (Bug / Idea / Other), severity, user, and status (Open / In Progress / Resolved)
- Mark reports as resolved when addressed

### 4.2 Requirements

#### P0 — Must-Have (Required for Demo Launch)

**Feedback Widget (Frontend)**
- Fixed position in the bottom-left sidebar area, next to user account info
- Icon button that expands into a slide-up panel (not a modal — user should still see the page behind it)
- Fields: Category selector (Bug / Feature Idea / Other), severity toggle on Bug category (Critical: "blocking my workflow" / Normal: "cosmetic or minor"), free-text description (required), screenshot attachment (optional)
- Screenshot: support both file upload (drag-and-drop or file picker) and in-app viewport capture (html2canvas)
- On submit: auto-attach metadata — current page URL, browser/OS info, user email, timestamp
- **Application state snapshot**: auto-capture current context — active property ID (if on property detail), active tab/section, active filters, sidebar state, any in-progress upload status. This is critical for CRE-specific bugs like "this number looks wrong on this deal" where the page URL alone is insufficient.
- Console error snapshot: capture the last 20 console errors at time of submission
- Success toast confirmation after submission
- **My Submissions view**: accessible from the feedback widget, shows past reports with status badges and threaded replies. User can reply to Griffin's follow-up questions directly here. Unread reply indicator (dot) on the feedback button when Griffin has responded.
- Acceptance criteria: User can submit a bug report with screenshot from any authenticated page in under 30 seconds. User can view and reply to admin responses within the same widget.

**Backend API**
- New model: `FeedbackReport` — id, user_id, category (bug/idea/other), severity (critical/normal, null for non-bugs), description, screenshot_url, page_url, app_state (JSON: property_id, active_tab, active_filters, sidebar_state), browser_info, console_errors, status (open/in_progress/resolved), created_at, updated_at
- New model: `FeedbackReply` — id, report_id, author_id, author_role (admin/user), message, created_at — supports threaded conversation in both directions (Griffin → user AND user → Griffin)
- Endpoints: `POST /api/v1/feedback` (create report), `GET /api/v1/feedback` (list, admin only), `PATCH /api/v1/feedback/:id` (update status), `POST /api/v1/feedback/:id/reply` (add reply), `GET /api/v1/feedback/mine` (user's own reports)
- Screenshot storage: save to local filesystem (SQLite mode) or S3-compatible bucket (production)
- **Rate limiting**: Per-user limit of 10 submissions per hour on `POST /api/v1/feedback`. Prevents duplicate floods from browser retry loops or rage-clicking submit. Returns 429 with a clear message. Trivial to implement, prevents Command Center noise.
- Acceptance criteria: Report persists to database with all metadata, retrievable via API within 1 second

**Command Center Integration**
- New tab in Command Center: "Feedback" alongside existing Bug Tracker and Feature Board
- Live feed of incoming reports, sorted by newest first
- Each report card shows: user email, category badge, description preview, screenshot thumbnail, timestamp, status badge
- Expandable detail view: full description, full-size screenshot, page URL (clickable), browser info, console errors
- Reply composer: text input + send button, reply appears in thread
- Status controls: Open → In Progress → Resolved
- Filter bar: by category, status, user
- Acceptance criteria: Griffin can view, reply to, and resolve a report entirely from the Command Center

#### P1 — Nice-to-Have (Build If Time Allows)

- **Annotation on screenshot**: Let the user draw/circle on the screenshot before submitting (canvas overlay)
- **Keyboard shortcut**: `Cmd+Shift+B` to open the feedback widget from anywhere
- **Unread indicator**: Badge count on the Command Center nav item showing unresolved report count
- **Screen recording**: Short GIF/video capture option (via MediaRecorder API) for interaction bugs

#### P2 — Future Considerations

- Email digest to Griffin: daily summary of new reports
- Slack webhook integration for real-time alerts on critical bugs
- Public-facing changelog or status page for test users

### 4.3 Technical Architecture

```
User submits feedback
    ↓
FeedbackWidget.tsx (bottom-left panel)
    ↓ POST /api/v1/feedback (multipart: JSON + screenshot file)
    ↓
feedback_routes.py → feedback_service.py → DB (FeedbackReport)
    ↓                                        ↓
    ↓ (screenshot saved to /uploads/feedback/)  ↓
    ↓                                        ↓
Command Center polls GET /api/v1/feedback (or WebSocket for real-time)
    ↓
FeedbackTab.tsx (new tab in CommandCenter.tsx)
    ↓
Griffin replies → POST /api/v1/feedback/:id/reply
    ↓
User sees reply via GET /api/v1/feedback/mine
```

### 4.4 UI Placement

The feedback button lives in the **sidebar footer**, directly adjacent to the user's account/avatar area in the bottom-left. This keeps it persistent across all pages, always accessible, and avoids collision with the 3D compass chat toggle (bottom-right). When clicked, it expands upward into a compact panel overlaying the sidebar area.

---

## 5. System 2: AI Learning Pipeline

### 5.1 Overview

This system operates entirely behind the scenes. No user-facing UI. The goal is for Talisman's extraction engine to get measurably smarter as more documents flow through the system — learning document structures, field-naming conventions, and CRE data patterns globally across all users.

### 5.2 User Stories

**As the system, I should:**
- Track extraction confidence per field per document, so low-confidence extractions can be flagged for review
- Build a pattern library of document structures (e.g., "Marcus & Millichap OMs put NOI on page 12 in a table titled 'Operating Statement'"), so repeat formats extract faster and more accurately
- Learn field-naming aliases globally (e.g., "Net Income from Operations" = "NOI", "Scheduled Gross Rent" = "GSR"), so extraction handles broker-specific terminology
- Improve extraction prompts over time based on aggregated success/failure patterns
- Track these improvements with measurable metrics (confidence scores, extraction success rates)

**As Griffin, I should:**
- See extraction health metrics in the Command Center (average confidence, failure rate, most-confused fields)
- Not need to intervene — the system self-improves within guardrails

### 5.3 Requirements

#### P0 — Must-Have

**Extraction Confidence Scoring**
- After every extraction, log per-field confidence scores (0.0–1.0) to a new `ExtractionLog` model
- Fields to score: property name, address, total units, year built, NOI (T12/T3/Y1), GSR, vacancy, cap rate, expense categories (all 24 taxonomy items)
- Confidence derived from: Claude's self-reported confidence, fuzzy match score (existing rapidfuzz pipeline), field completeness
- **Ground truth calibration**: Claude's self-reported confidence is notoriously uncalibrated. The golden dataset (3–5 properties with known-correct values, see CEO checklist) serves as the calibration benchmark. Run golden dataset re-extraction weekly; compare self-reported confidence against actual accuracy. Use the delta to apply a calibration curve to all confidence scores. Without this, confidence numbers are directionally useful but not trustworthy as absolute thresholds.
- Acceptance criteria: Every extraction produces a confidence vector stored in the database, queryable by field and time range. Golden dataset re-extraction produces a calibration report comparing predicted vs. actual accuracy.

**Document Pattern Registry**
- New model: `DocumentPattern` — id, source_broker, document_type (OM/BOV/RentRoll), structure_fingerprint (hash of section headings + table layouts), field_locations (JSON mapping field → page/section), times_seen, avg_confidence, created_at, updated_at
- **Composite key for pattern lookup**: broker + document_type + fingerprint (not fingerprint alone). Two brokers can have similar section headings but place data differently. Fingerprint collision without broker context would poison the hints. If broker is unknown, fall back to document_type + fingerprint but with lower weight on the hints.
- On each extraction, compute a structure fingerprint and check against existing patterns using the composite key
- If match found: use the pattern's field_locations as hints to the extraction prompt (prepend to system message)
- If no match: create a new pattern entry from the successful extraction
- Acceptance criteria: Second extraction of a document from the same broker is faster and higher-confidence than the first

**Field Alias Dictionary**
- New model: `FieldAlias` — id, canonical_field (from 24-category taxonomy), alias_text, source_count (how many documents used this alias), confidence
- After each extraction, log any non-standard field names that were successfully mapped to canonical fields
- Aliases with source_count > 3 get promoted to "high confidence" and are injected into extraction prompts
- Acceptance criteria: A novel alias encountered 4+ times is automatically recognized without Claude needing to reason about it

**Low-Confidence Field Indicator (Property Detail Page)**
- Any extracted field with calibrated confidence below 0.6 gets a subtle visual indicator on the property detail page — a small amber dot or dashed underline next to the value. Tooltip on hover: "This value was extracted with lower confidence. Verify against source document."
- This is NOT the same as exposing the AI learning system. It's a data-quality signal, like a yellow cell in a spreadsheet. Users in CRE expect to verify numbers — giving them a heads-up on which ones to double-check builds trust rather than undermining it.
- If a user corrects a flagged value, that correction feeds into the learning pipeline (see P1: User correction capture).
- Acceptance criteria: Fields below 0.6 confidence display the indicator. Fields above 0.6 display no indicator. Indicator is subtle enough to not alarm users but visible enough to catch attention during review.

**Command Center Metrics**
- New section in Command Center analytics: "Extraction Health"
- Metrics: average confidence (overall + per field), extraction success rate, pattern library size, alias dictionary size, most-confused fields (lowest avg confidence)
- Trend over time: confidence improvement week-over-week
- Acceptance criteria: Griffin can see at a glance whether extraction quality is improving or degrading

#### P1 — Nice-to-Have

- **User correction capture**: When a user manually edits an extracted value on the property detail page, log the correction (original → corrected) and feed it back into the learning pipeline
- **CRE knowledge enrichment**: Periodically augment the system's CRE knowledge by processing anonymized aggregate data (e.g., "average cap rate for Class B multifamily in the Southeast is trending at X") — no user content, just structural patterns
- **Anomaly detection**: Flag extractions where a field value is statistically unusual for its property type/market (e.g., NOI per unit that's 3x the market average)

#### P2 — Future Considerations

- Fine-tuning a specialized extraction model on anonymized document structures
- Per-user extraction preferences (e.g., "always prioritize T12 over proforma")
- Extraction comparison mode: show old vs. new extraction for the same document to demonstrate improvement

### 5.4 Technical Architecture

```
Document uploaded
    ↓
claude_extraction_service.py
    ↓
1. Compute structure fingerprint (section headings + table layouts)
2. Check DocumentPattern registry for match
    ↓ (match found)                    ↓ (no match)
    Use pattern hints in prompt         Standard extraction
    ↓                                   ↓
3. Extract with confidence scoring (Claude returns confidence per field)
4. Post-extraction:
    a. Log ExtractionLog (per-field confidence vector)
    b. Update or create DocumentPattern
    c. Update FieldAlias dictionary with any new mappings
    d. Update rapidfuzz alias list from high-confidence aliases
    ↓
Metrics aggregated → Command Center Extraction Health dashboard
```

### 5.5 Data Privacy Note

The learning pipeline operates on **document structure only**, not user content. What gets stored globally: section headings, table column names, field label text, page layouts, field-to-page mappings. What is never stored globally: actual financial figures, property addresses, deal terms, or any PII. Per-user data stays in their properties. The pattern registry and alias dictionary contain only structural metadata.

---

## 6. System 3: Demo Rollout Infrastructure

### 6.1 User Approval Gate

**Current state:** Anyone can register at talisman.io and access the full app immediately.

**Target state:** Registration creates the account in a "pending" state. User sees a "Your account is pending approval" screen. Griffin approves from the Command Center, which flips the user to "active."

#### Requirements (P0)

- Add `status` field to User model: `pending` | `active` | `suspended`
- New users default to `pending`
- Pending users see a branded waiting screen after login: Talisman compass + "Your account is pending approval. Griffin will reach out when you're in."
- **Manual notification workflow**: Since there's no email integration in v1, the pending screen should NOT say "we'll notify you" without a mechanism. Instead, when Griffin approves a user from the Command Center, the UI should display a reminder with a **pre-populated onboarding email template** — not just a copy-email button. Template includes: greeting with user's name, what Talisman is, login URL, link to the onboarding guide, and how to report bugs. One-click copy to clipboard, paste into your email client, personalize the first line, send. Saves you from rewriting the same message 15 times.
- Command Center gets a "Users" tab: list of all users with status, registration date, email, and an Approve / Suspend toggle
- Approving a user sets status to `active`; they can access the app on next page load
- Griffin's accounts (both emails) are hardcoded as `active` and `admin`
- **Org isolation verification**: Confirm that demo users are org-isolated — user #1 should never see properties uploaded by user #2 from a different org. The existing org system should handle this, but given the known NULL org_id bug from the chatbot (where properties without an org_id were visible across contexts), this needs an explicit test case before first user. Add a middleware check: if `org_id IS NULL` on any property, it is only visible to its uploader, never to other users.

### 6.2 Analytics & Engagement Tracking

The Command Center needs a real-time pulse on how demo users are engaging with the platform. This replaces the current static analytics in the Command Center with live data.

#### Requirements (P0)

**Event Tracking Model**
- New model: `UserEvent` — id, user_id, event_type, event_data (JSON), page_url, timestamp
- Event types to track: `page_view`, `document_upload`, `property_view`, `tab_switch`, `search`, `chat_message`, `feedback_submit`, `login`, `session_start`, `session_end`
- Frontend: lightweight event emitter that fires on route change, key interactions, and uploads
- Backend: `POST /api/v1/events` (batch endpoint, fires every 30 seconds with `visibilitychange` fallback)
- **Session duration**: Do NOT rely on `beforeunload`/`visibilitychange` for session_end — these are unreliable, especially on desktop where users just close tabs. Instead, use server-side session timeout: if no events received for 15 minutes, mark session as ended. This is the canonical source of truth for duration calculations. The frontend `session_end` event is a nice-to-have signal, not the authority.
- **Frontend error boundary tracking**: Wrap the React app (and specifically high-risk components like the 3D stacking model / Three.js viewer) in error boundaries that auto-submit a `frontend_crash` event with component stack trace, props snapshot, and error message. Users shouldn't have to manually report a blank screen — the system should tell you before they do.

**Command Center Dashboard**
- Active users (last 24h / last 7d)
- Total documents uploaded (cumulative + trend)
- Most-viewed properties
- Most-used features (by event count)
- Average session duration
- User engagement table: user email, last active, documents uploaded, pages visited, feedback submitted
- Extraction pipeline health (from System 2)

### 6.3 CEO Rollout Checklist

Beyond the three systems above, here's what you should be tracking and preparing as you begin the demo:

#### Before First User (Week 1–2)

- [ ] **Stress-test extraction with diverse sources**: Upload OMs and BOVs from at least 5 different brokerages (CBRE, Marcus & Millichap, Cushman, JLL, local/regional brokers). Document which formats extract cleanly and which need work.
- [ ] **Create a "golden dataset"**: 3–5 properties with known-correct values. Use these as regression tests — re-extract after every code change and verify values haven't drifted.
- [ ] **Write a 1-page onboarding guide**: What Talisman does, how to upload a doc, what to expect, how to report bugs. Send this to each user when you approve their account.
- [ ] **Set up error monitoring**: Ensure backend exceptions are logged somewhere you check daily (Render logs at minimum, Sentry if time allows).
- [ ] **Test the full flow end-to-end**: Register → pending → approve → login → upload OM → view property → report bug → see it in Command Center.

#### During Demo (Week 2–5, Rolling)

- [ ] **Onboard 1 user at a time**: Approve from Command Center → see the "Send onboarding guide" reminder → personally email/text the user with the guide and login link → ask them to try uploading 2–3 real documents. Watch the extraction results. Fix issues before the next user.
- [ ] **Check Command Center daily**: Review new feedback, extraction health metrics, and user engagement. Respond to every bug report within 24 hours.
- [ ] **Track "aha moment" signals**: Which users upload more than 3 documents? Which users return after day 1? Which users send feature ideas (not just bugs)? These are your strongest PMF signals.
- [ ] **Log feature requests in a ranked list**: Every "you should add X" from a test user goes into a feature board. After 10+ users, look for patterns — if 3+ people ask for the same thing, it's real.
- [ ] **Weekly self-check**: Is extraction improving? Are users coming back? Are they uploading real deal data (not just testing with junk)? If yes to all three, you have signal.

#### Key Metrics to Watch

| Metric | What It Tells You | Target |
|--------|-------------------|--------|
| Return rate (D7) | Are users coming back after the first session? | >50% |
| Docs uploaded per user | Are they using it with real workflow data? | >3 per user |
| Time-to-first-upload | Is onboarding frictionless? | <5 minutes |
| Bug reports per user | Is the product stable enough? | <2 critical per user |
| Feature requests | Are users engaged enough to imagine more? | >1 per user |
| Extraction confidence (avg) | Is the AI getting better? | Trending upward weekly |
| Session duration | Are they spending meaningful time? | >10 min average |

---

## 7. Open Questions

| # | Question | Owner | Notes |
|---|----------|-------|-------|
| 1 | ~~Should extraction confidence thresholds trigger auto-flagging?~~ | — | **RESOLVED: Promoted to P0.** Fields below 0.6 get a subtle amber indicator on the property detail page. |
| 2 | Do we need a data export mechanism for test users, or is the in-app view sufficient for demo? | Griffin | Some acquisition analysts may want to pull data into Excel |
| 3 | Should the feedback widget be accessible from the pending-approval screen? | Griffin | Could be useful if users hit issues before even getting in |
| 4 | What's the screenshot storage budget? | Engineering | S3 free tier may suffice for 15 users, but large screenshots add up |
| 5 | Should the AI learning pipeline's pattern matching be active from day 1, or should we accumulate data first and activate it after N documents? | Engineering | Cold-start pattern matching with <10 documents may not add value. Confidence logging starts in Phase 1 regardless. |
| 6 | ~~What's the 0.6 confidence threshold calibrated against?~~ | — | **RESOLVED: Phase 1 blocker.** First golden dataset calibration run must complete in Phase 1 before the indicator ships in Phase 2. Threshold adjusted based on calibration results. |

---

## 8. Phasing Recommendation

Given the 3–5 week timeline and rolling 1-user-at-a-time launch:

**Phase 1 (Week 1–2): Launch-Critical**
- User approval gate (pending/active status + org isolation verification)
- Feedback widget (bug + idea submission with screenshot + app state + severity)
- Command Center feedback tab (view + threaded reply + resolve)
- Basic event tracking (page views, uploads, logins) with server-side session timeout
- Frontend error boundaries on high-risk components (Three.js stacking viewer, extraction results)
- **Extraction confidence logging** (ExtractionLog model only — no pattern registry yet). This ensures the first few weeks of extraction data has confidence metadata to analyze retroactively. Without this in Phase 1, you lose your earliest and most valuable calibration data.
- Golden dataset creation + **first calibration run completed** (not just created — actually run the re-extraction, compare against known values, and validate that 0.6 is the right threshold before Phase 2 ships the indicator). This is a blocker for the low-confidence indicator, not a nice-to-have.

**Phase 2 (Week 2–3): Intelligence Layer**
- Document pattern registry (with composite broker+type+fingerprint key)
- Field alias dictionary
- Low-confidence field indicator on property detail page
- Command Center extraction health dashboard
- Ground truth calibration pipeline (golden dataset weekly re-extraction)

**Phase 3 (Week 3–5): Polish & Learn**
- User correction capture (edit-to-learn loop)
- Analytics dashboard refinements based on what you're actually looking at daily
- Any P1 items that prove necessary from real user feedback
- Demo teardown plan (see below)

This ordering ensures you have the feedback loop, user gate, and confidence logging before the first external user touches the app. The learning infrastructure layers on as documents start flowing in, and you have retroactive data to calibrate against.

---

## 9. Demo Teardown & Migration Plan

The demo is not a throwaway. Plan for what happens when it ends:

**Data that persists into production:**
- DocumentPattern registry and FieldAlias dictionary — these are the AI's accumulated knowledge. They carry forward.
- ExtractionLog confidence data — this is your calibration history. Keep it.
- Aggregated analytics (feature usage patterns, engagement metrics) — informs roadmap.

**Data that needs a decision:**
- User accounts: Do demo users become production users, or do they re-register? Recommendation: keep accounts active, grandfather them in.
- Feedback reports: Archive as a historical artifact. Don't delete — they document what was wrong at launch.
- User-uploaded properties and documents: These are the user's data. They persist unless the user deletes them.

**Infrastructure that changes:**
- Approval gate: Decide whether to keep (invite-only launch), switch to open registration, or add a waitlist.
- Feedback widget: Likely evolves into a permanent feature. The Command Center feedback tab becomes the long-term support tool.
- Event tracking: Graduate from polling-based to a proper analytics pipeline if user count exceeds ~50.

**One-liner version:** Nothing built for the demo is throwaway. Every model, every table, every API route is designed to become production infrastructure. The demo is Phase 1 of the real product, not a prototype.

---

*Generated March 11, 2026 — Talisman IO Pre-Demo Planning (v2, peer-reviewed)*
