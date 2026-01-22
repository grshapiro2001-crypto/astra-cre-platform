# Context - CRE Investment Platform

**Last Updated:** 2026-01-17

---

## Product Vision

Build an intelligent commercial real estate analysis platform that helps senior analysts at major brokerages quickly extract, compare, and organize financial metrics from property documents.

**Core Value Proposition:**
- **Speed:** Analyze 50-page OMs in seconds instead of hours
- **Accuracy:** Claude API intelligently extracts metrics regardless of formatting
- **Organization:** Deal-centric folder system matches real-world workflow
- **Cost:** NO LLM calls for viewing data (only on initial upload)

---

## Target User

**Primary Persona: Sarah - Senior Investment Analyst**
- Works at a top-tier brokerage (CBRE, JLL, Marcus & Millichap)
- Analyzes 10-20 deals per week
- Receives OMs and BOVs from brokers in various formats
- Needs to quickly compare multiple scenarios (T12 vs Y1, different BOV pricing tiers)
- Limited technical expertise (not a developer)
- Values speed and accuracy over fancy features

**Pain Points We Solve:**
1. **Manual Data Entry:** Manually typing metrics from PDFs into Excel (2-3 hours per OM)
2. **Inconsistent Formatting:** Brokers use different labels ("TTM" vs "T-12" vs "Trailing Twelve Months")
3. **Lost Documents:** PDFs scattered across email, desktop, folders
4. **No Deal History:** Hard to track when documents were uploaded or analyzed
5. **BOV Complexity:** BOVs have 3-5 pricing scenarios that are tedious to compare
6. **No Version Control:** Can't easily compare updated versions of the same property

**Workflow Before Platform:**
1. Receive OM via email
2. Save PDF to desktop or shared drive
3. Open PDF, manually find financial tables
4. Type numbers into Excel template
5. Calculate metrics manually
6. Repeat for each pricing scenario (BOVs)
7. Lose track of which version is current

**Workflow After Platform:**
1. Upload PDF (drag & drop)
2. Claude extracts ALL metrics in 10 seconds
3. Review extraction results
4. Save to deal folder
5. Compare scenarios instantly
6. Access from anywhere

---

## Business Context

### Market
- **Industry:** Commercial Real Estate Investment
- **Market Size:** Billions in transactions annually
- **Competition:** CoStar, PropertyMetrics, Excel templates
- **Differentiation:** AI-powered extraction, deal-centric organization

### Business Model (Future)
- Freemium: 10 documents/month free
- Pro: $99/mo unlimited documents
- Enterprise: Custom pricing for teams

### Cost Structure
- **Variable Costs:** Claude API calls ($0.50-$2 per document depending on length)
- **Fixed Costs:** Hosting, storage, development
- **Cost Optimization Strategy:** NO LLM calls in views (massive savings)

---

## Core Entities

### Deal (The Center of Everything)
A **Deal** represents a single commercial real estate property acquisition opportunity.

**Properties:**
- Has a unique name ("Tower on Piedmont")
- Has one or more documents (OM, BOV, Rent Roll, T-12)
- Has property-level details (address, type, size)
- Has a lifecycle (sourcing → underwriting → closed/passed)

**Why Deal-Centric:**
- Matches how analysts think ("I'm working on the Piedmont deal")
- Natural organization (all documents for one property in one place)
- Enables deal-level analytics (track all versions, compare scenarios)

### Document Types

**Offering Memorandum (OM):**
- Marketing package from seller's broker
- Typical length: 30-80 pages
- Contains: Property details, financial history, market analysis, photos
- Key metrics: T12/T3 trailing financials, Y1 pro forma projections
- Purpose: Help buyer evaluate acquisition opportunity

**Broker Opinion of Value (BOV):**
- Valuation analysis from buyer's broker
- Typical length: 15-40 pages
- Contains: Multiple pricing scenarios (2-5 tiers), cap rates, return metrics
- Key metrics: Pricing, cap rates, IRR, equity multiple, loan assumptions
- Purpose: Help buyer determine what price to offer

**Other Document Types (Future):**
- Rent Roll: List of all tenants and lease terms
- T-12: Trailing 12 months financial statement only
- Underwriting Model: Excel model with buyer's assumptions

---

## User Workflows

### Workflow 1: Upload & Analyze New OM

**Steps:**
1. User clicks "Upload Document"
2. Drags PDF or browses to select file
3. Filename appears with size
4. Clicks "Analyze Document"
5. Loading indicator shows progress (5-15 seconds)
6. Extraction results appear:
   - Document type detected (high/medium/low confidence)
   - Property information section
   - T12 financials section (if found)
   - T3 financials section (if found)
   - Y1 financials section (if found)
   - Calculated metrics with formulas visible
   - Warning for any missing fields
7. User reviews extracted data
8. Clicks "Save to Folder"
9. Modal appears:
   - Radio: Create new folder (name pre-filled)
   - Radio: Add to existing folder (dropdown)
   - Document type dropdown (pre-selected)
10. User selects option and clicks "Save"
11. If duplicate detected, modal shows comparison:
    - Existing property details (yellow box)
    - New property details (green box)
    - User chooses: Replace Existing, Keep Both, or Cancel
12. Redirected to folder detail page
13. Property appears in folder

**Success Criteria:**
- All metrics extracted correctly (Economic Occ, OpEx Ratio, NOI)
- Save completes without errors
- Folder shows updated document count
- Property accessible from folder

---

### Workflow 2: Upload BOV & Compare Pricing Tiers

**Steps:**
1. User uploads BOV PDF
2. Claude detects document_type = "BOV"
3. Extracts ALL pricing tiers (e.g., 3 scenarios)
4. Each tier includes:
   - Pricing (valuation)
   - Cap rates (trailing, proforma, stabilized)
   - Loan assumptions (LTV, rate, amortization)
   - Return metrics (IRR, equity multiple, cash-on-cash)
   - Terminal assumptions (exit cap, hold period)
5. User saves to existing deal folder
6. Opens property detail page
7. Sees "Pricing Scenarios" section
8. Tabs show: Tier 1 | Tier 2 | Tier 3
9. Clicks each tier to compare:
   - Pricing differences
   - Cap rate spread
   - Return profiles
10. User decides which scenario to pursue

**Success Criteria:**
- All tiers extracted completely
- Each tier is self-contained (complete package)
- Easy to switch between scenarios
- Can compare side-by-side

---

### Workflow 3: Organize Existing Deals

**Steps:**
1. User goes to Library page
2. Sees grid of deal folders
3. Clicks "+ New Deal Folder"
4. Modal appears with folder name input
5. Enters "Future Acquisitions Q1 2026"
6. Clicks Create
7. Empty folder appears in grid
8. User opens folder (empty)
9. User has orphaned properties (uploaded before folders existed)
10. User uses "Assign to Folder" feature (future)
11. Properties moved to correct folders

**Success Criteria:**
- Can create folders without documents
- Folders appear immediately in Library
- Can open empty folders
- Can add documents to them later

---

### Workflow 4: Handle Duplicate/Updated Documents

**Steps:**
1. User uploaded "Tower on Piedmont OM" last week
2. Broker sends updated OM with new pricing
3. User uploads new version
4. Tries to save to "Tower on Piedmont" folder
5. Duplicate detection triggers
6. Modal shows comparison:
   - Existing: Uploaded Jan 10, Y1 NOI $2.1M
   - New: Uploaded Jan 17, Y1 NOI $2.3M
7. User sees NOI increased
8. Clicks "Replace Existing"
9. Old property deleted, new property saved
10. Folder still shows 1 document (not 2)
11. User can see updated metrics

**Success Criteria:**
- User clearly sees differences (dates, metrics)
- Can choose to replace or keep both
- Document count updates correctly
- No confusion about which version is current

---

## Business Requirements

### Performance
- PDF analysis: < 30 seconds for 80-page OM
- Page load: < 2 seconds for Library view
- Navigation: Instant (no page reloads)

### Accuracy
- Metric extraction: 95%+ accuracy on common formats
- Handles various labeling conventions ("TTM", "T-12", "Trailing 12")
- Flags missing data instead of guessing

### Cost Optimization (CRITICAL)
- **LLM calls ONLY on:**
  - Initial upload (`POST /upload`)
  - Explicit re-analyze (`POST /properties/{id}/reanalyze`)
- **NO LLM calls on:**
  - List folders (database query)
  - View folder (database query)
  - View property detail (database query)
  - View BOV scenarios (database query)
  - Any navigation or browsing

**Why:** Claude API costs $0.50-$2 per analysis. If we called the LLM every time a user viewed a property, costs would be 100x higher. By caching extracted data in the database, we only pay for the initial extraction.

### Data Integrity
- Never lose uploaded PDFs
- Never lose extracted data
- Folder operations safe (confirm before delete)
- Clear audit trail (who uploaded what when)

### Security
- Users can only see their own deals
- JWT authentication on all endpoints
- PDF files stored securely (not publicly accessible)
- No sharing features yet (single-user for now)

---

## Technical Constraints

### Must Have:
- Works on macOS (primary development environment)
- SQLite database (simple, no server needed)
- Local file storage (no S3/cloud yet)
- React + FastAPI (established stack)

### Must NOT Have:
- No complex deployment (local-first for now)
- No real-time collaboration (single-user)
- No mobile app (desktop web only)
- No offline mode

### Nice to Have:
- Fast page loads
- Clean, modern UI
- Keyboard shortcuts
- Bulk operations

---

## Design Principles

### 1. Deal-Centric Organization
Everything revolves around deals. Folders are deals. Documents belong to deals.

### 2. Minimal Clicks
- Upload → Analyze → Save: 3 clicks max
- Library → Folder → Property: 2 clicks
- Don't make users navigate complex hierarchies

### 3. Show, Don't Tell
- Show actual metrics from extraction, not "Analysis complete"
- Show formulas, not just results
- Show warnings for missing data, don't hide them

### 4. Safe by Default
- Confirm before destructive actions (delete)
- Default to safer option (delete folder only, not documents)
- Make dangerous actions hard to trigger accidentally

### 5. Fast Feedback
- Show loading indicators
- Update counts immediately
- Navigate after successful save (don't leave user on old page)

---

## Success Metrics

### User Success:
- Can analyze an OM in < 2 minutes (vs 2 hours manual)
- Can organize 50+ deals without confusion
- Can compare BOV scenarios in < 30 seconds
- Can find any deal instantly

### Business Success:
- < $1 average cost per document analyzed (LLM + infrastructure)
- > 95% extraction accuracy on key metrics
- < 5% support tickets related to incorrect extraction
- Users analyze 10+ documents per week

### Technical Success:
- < 30 second average analysis time
- < 2 second page load times
- Zero data loss incidents
- < 1% API error rate

---

## Future Vision (Not Current Scope)

### Phase 4: Property Comparison
- Side-by-side comparison of 2-3 properties
- Normalized metrics across deals
- Highlight best/worst metrics

### Phase 5: Portfolio Analytics
- Dashboard with portfolio summary
- Total NOI, average cap rates
- Charts and graphs
- Export to Excel

### Phase 6: Collaboration
- Share deals with team members
- Comments and annotations
- Activity feed
- Role-based permissions

### Phase 7: Advanced Features
- Underwriting model integration
- Sensitivity analysis
- Market data integration (CoStar API)
- Automated comp analysis

---

## Questions to Ask Before Building

Before implementing any new feature, ask:

1. **Does it serve the core workflow?**
   - Does it help analysts get from PDF → insights faster?
   - Or is it a nice-to-have distraction?

2. **Does it respect cost optimization?**
   - Does it require LLM calls?
   - Can we use database queries instead?

3. **Is it deal-centric?**
   - Does it fit the folder/deal organization model?
   - Or does it break that mental model?

4. **Is it safe?**
   - Can users undo mistakes?
   - Are destructive actions clearly marked?

5. **Is it simple?**
   - Can we build this with < 100 lines of code?
   - Or are we over-engineering?

---

## Glossary

**OM:** Offering Memorandum - Marketing package for property sale
**BOV:** Broker Opinion of Value - Valuation analysis with pricing scenarios
**T12:** Trailing 12 months - Historical financial data
**T3:** Trailing 3 months - Recent quarterly financials
**Y1:** Year 1 / Pro Forma - Forward-looking projections
**NOI:** Net Operating Income - Revenue minus operating expenses
**Cap Rate:** Capitalization rate - NOI / Property Value
**IRR:** Internal Rate of Return - Annualized return over hold period
**Economic Occupancy:** Percentage of gross revenue actually collected
**OpEx Ratio:** Operating expenses as a percentage of revenue
**Deal Folder:** Container for all documents related to one property
**Pricing Tier:** One of several valuation scenarios in a BOV

---

## References

- User's original requirements document (in conversation history)
- Phase 2 implementation plan (in conversation history)
- Phase 3A requirements (in conversation history)
