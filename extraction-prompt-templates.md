# Extraction Prompt Templates
# Used by Data Bank extraction service after Python structural parse

## Overview
The extraction flow is two-phase:
1. **Python (openpyxl):** Read file, detect sheets, extract raw tabular data
2. **Claude API:** Classify columns, normalize values, handle edge cases

These prompts are sent to `claude-sonnet-4-5-20250929` via the Anthropic API.

---

## Prompt 1: Sales Comp Column Classification

**When:** After Python reads a tabular sheet and detects it's likely a comp tracker.
**Input:** First 5 rows of data plus detected column headers.
**Goal:** Map raw column names to standardized schema fields.

```python
COMP_CLASSIFICATION_PROMPT = """
You are a CRE data extraction specialist. Below is a preview of a sales comp tracker spreadsheet.

## Raw Headers
{headers}

## Sample Rows (first 5)
{sample_rows}

## Task
Map each column to one of these standardized fields. Return ONLY a JSON object mapping column index (0-based) to field name. If a column doesn't match any field, map it to null.

Standardized fields:
- property_name: Name of the property
- market: Submarket or market area name
- metro: Metro area (if separate from market)
- property_type: Garden, Midrise, Highrise, BFR, Townhome, etc.
- sale_date: Date of sale/closing
- year_built: Construction year (may include renovation as "1987/2017")
- year_renovated: Renovation year (if separate column)
- units: Number of units
- avg_unit_sf: Average unit square footage
- total_sf: Total square footage
- avg_eff_rent: Average effective rent per unit
- sale_price: Total sale price
- price_per_unit: Price per unit
- price_per_sf: Price per square foot
- cap_rate: Cap rate (may be decimal like 0.055 or percentage like 5.5%)
- cap_rate_qualifier: "In Place", "Yr 1", "T-12", "Proforma", etc.
- buyer: Buyer name
- seller: Seller name
- occupancy: Occupancy at time of sale
- county: County name
- state: State
- address: Property address
- notes: Any other notes or comments

Rules:
- If two rows form a split header (e.g., row 1 has "Sale" and row 2 has "Price"), combine them
- If a column could be either price_per_unit or price_per_sf, check the sample values — $/unit is typically $100K-$500K, $/SF is typically $100-$600
- If cap_rate values are < 1 (like 0.055), they're decimals. If > 1 (like 5.5), they're percentages.
- Some columns may be empty in the sample — still classify them based on the header

Respond with ONLY valid JSON:
{
  "column_mapping": {
    "0": "property_name",
    "1": "market",
    ...
  },
  "header_row": <int>,  // Which row number is the actual header (0-indexed)
  "data_start_row": <int>,  // Which row the data starts
  "cap_rate_format": "decimal" | "percentage",
  "notes": "<any issues or ambiguities>"
}
"""
```

---

## Prompt 2: Sales Comp Value Normalization

**When:** After column mapping is established, for each row of data.
**Input:** Raw row values with their mapped field names.
**Goal:** Clean and normalize values to database-ready format.

```python
COMP_NORMALIZATION_PROMPT = """
Normalize these CRE sales comp records to clean, database-ready values.

## Input Records (JSON array)
{records}

## Rules
For each record, return a cleaned version following these rules:

1. **sale_date**: Convert to ISO format "YYYY-MM-DD". Handle: "12/18/25" → "2025-12-18", "Jan 2025" → "2025-01-15", "Q4 2025" → "2025-10-01"
2. **year_built**: Integer. If "1987/2017" format, return year_built=1987, year_renovated=2017
3. **units**: Integer. Remove commas. "294 units" → 294
4. **sale_price**: Integer (dollars). "$63.88M" → 63880000, "$210,340" → 210340, "63.88" (if clearly millions) → 63880000
5. **price_per_unit**: Integer. "$256,000" → 256000
6. **price_per_sf**: Float. "$285.50" → 285.50
7. **cap_rate**: Float as decimal. "5.25%" → 0.0525, "0.0525" → 0.0525, "TBD" → null
8. **cap_rate_qualifier**: Normalize to one of: "In Place", "Yr 1", "T-12", "T-3", "Proforma", "Stabilized", "TBD", null
9. **avg_eff_rent**: Float. "$1,850" → 1850.0
10. **occupancy**: Float as decimal. "95%" → 0.95, "95" → 0.95
11. **property_type**: Normalize to: "Garden", "HD-Garden", "Midrise", "Highrise", "BFR", "Townhome", "Lowrise", "Single-Family"
12. **market**: Strip trailing/leading whitespace. Preserve original submarket name.
13. **nulls**: For any field that is empty, "N/A", "TBD", "-", or nonsensical, return null

Return a JSON array of cleaned records. Each record should have ALL standardized fields (use null for missing ones).
"""
```

---

## Prompt 3: Pipeline Tracker Classification

**When:** After Python detects a pipeline tracker format.
**Input:** Headers and sample rows.

```python
PIPELINE_CLASSIFICATION_PROMPT = """
You are a CRE data extraction specialist. Below is a preview of a development pipeline tracker spreadsheet.

## Raw Headers
{headers}

## Sample Rows (first 5)
{sample_rows}

## Task
Map each column to one of these standardized fields:

- project_name: Name of the development project
- address: Street address
- county: County
- metro: Metro area
- submarket: Submarket name
- units: Number of planned/delivered units
- status: Project status (see normalization below)
- developer: Developer/sponsor name
- delivery_quarter: Expected delivery date/quarter
- start_quarter: Construction start date/quarter
- property_type: Garden, Midrise, etc.
- total_sf: Total planned square footage
- stories: Number of stories
- acres: Site acreage
- notes: Additional notes

Status normalization — map raw values to one of:
- "lease_up" — includes: "Lease-Up", "Leasing", "Stabilizing", "Recently Delivered", "Delivered"
- "under_construction" — includes: "Under Construction", "UC", "In Construction", "Building"
- "proposed" — includes: "Proposed", "Planning", "Planned", "Pre-Development", "Entitled", "Approved"

Respond with ONLY valid JSON:
{
  "column_mapping": { "0": "project_name", ... },
  "header_row": <int>,
  "data_start_row": <int>,
  "status_value_mapping": {
    "Lease-Up": "lease_up",
    "Under Construction": "under_construction",
    ...
  },
  "notes": "<any issues>"
}
"""
```

---

## Prompt 4: Pipeline Value Normalization

```python
PIPELINE_NORMALIZATION_PROMPT = """
Normalize these CRE pipeline project records to clean, database-ready values.

## Input Records
{records}

## Rules
1. **units**: Integer. Remove commas.
2. **status**: Must be one of: "lease_up", "under_construction", "proposed"
3. **delivery_quarter**: Normalize to "YYYY-QN" format. "Q2 2027" → "2027-Q2", "Summer 2027" → "2027-Q3", "2027" → "2027-Q2" (default to Q2), "Late 2026" → "2026-Q4"
4. **start_quarter**: Same format as delivery_quarter
5. **developer**: Clean name, remove trailing LLC/Inc unless it's part of a well-known firm name
6. **submarket**: Strip whitespace. If no submarket but county is present, note in a "submarket_source" field
7. **nulls**: Empty, "N/A", "TBD", "-" → null

Return JSON array of cleaned records.
"""
```

---

## Prompt 5: Underwriting Model Extraction

**When:** Python has identified high-value sheets and extracted raw data grids.
**Input:** Sheet inventory + raw data from top sheets.
**Goal:** Extract key financial metrics organized by scenario.

```python
UNDERWRITING_EXTRACTION_PROMPT = """
You are a CRE underwriting analyst. Below are extracts from a multifamily underwriting model.

## Sheet Inventory
{sheet_inventory}

## Extracted Data
{sheet_data}

## Task
Extract the following financial metrics from the data. The model may have multiple pricing scenarios (e.g., "Premium" and "Market" or "Base Case" and "Upside"). Extract ALL scenarios found.

### Property Information
- property_name
- address
- city, state
- units
- total_sf (or avg_unit_sf × units)
- year_built
- property_type

### For EACH pricing scenario, extract:
**Pricing**
- scenario_name: Name of the scenario
- purchase_price: Total purchase price
- price_per_unit
- price_per_sf

**Cap Rates**
- going_in_cap (Y1 cap rate)
- in_place_cap (T-12 or current cap rate)
- exit_cap (terminal/reversion cap rate)
- t3_cap (trailing 3-month annualized, if available)

**Returns**
- levered_irr
- unlevered_irr (if available)
- cash_on_cash_y1
- equity_multiple

**Debt**
- loan_amount
- ltv (loan-to-value)
- interest_rate
- dscr (debt service coverage ratio)
- io_period_months (interest-only period)
- loan_term_months
- amortization_months

**Financials (capture for each period available: T-12, T-3, Proforma/Y1, Y2)**
- gross_potential_rent
- loss_to_lease (informational — NOT used in scoring)
- vacancy_loss
- concessions
- other_income
- effective_gross_income
- total_operating_expenses
- net_operating_income
- economic_occupancy

### Extraction Rules
- Values should be numbers, not formatted strings. "$63.88M" → 63880000
- Percentages as decimals: "5.25%" → 0.0525
- If a metric appears on multiple sheets with different values, prefer the Summary/Output sheet
- If In Place and Proforma values exist, label them clearly
- Look for terms like "Going-In", "Entry", "Y1" for going-in cap rate
- Look for "Exit", "Terminal", "Reversion" for exit cap rate
- "T-12" = trailing 12 months, "T-3" = trailing 3 months annualized, "T6" = trailing 6 months

Respond with valid JSON:
{
  "property_info": { ... },
  "scenarios": [
    {
      "scenario_name": "Market",
      "pricing": { ... },
      "cap_rates": { ... },
      "returns": { ... },
      "debt": { ... },
      "financials": {
        "t12": { ... },
        "proforma": { ... }
      }
    }
  ],
  "data_quality": {
    "completeness": "high" | "medium" | "low",
    "missing_fields": ["list of important fields not found"],
    "notes": "any issues or assumptions"
  }
}
"""
```

---

## Prompt 6: Market/Submarket Normalization

**When:** After extracting comps or pipeline data with market names.
**Goal:** Normalize submarket names across documents so they match for scoring.

```python
MARKET_NORMALIZATION_PROMPT = """
Below are submarket/market names extracted from two different CRE documents in the same metro area.

## Document A (Sales Comps) — Unique Markets
{comp_markets}

## Document B (Pipeline Tracker) — Unique Submarkets
{pipeline_submarkets}

## Task
Create a mapping that groups equivalent or overlapping market names. Some names may be:
- Exact matches (easy)
- Slight variations: "Buckhead" vs "Buckhead/Lenox"
- Parent-child: "North Atlanta" contains "Alpharetta" and "Roswell"
- Misspellings or abbreviation differences

Return a JSON object:
{
  "normalized_groups": [
    {
      "canonical_name": "Gainesville",
      "aliases": ["Gainesville", "Gainesville/Hall County"],
      "comp_documents": ["Gainesville"],
      "pipeline_documents": ["Gainesville"]
    },
    {
      "canonical_name": "Buckhead",
      "aliases": ["Buckhead", "Buckhead/Lenox", "North Buckhead"],
      "comp_documents": ["Buckhead"],
      "pipeline_documents": ["Buckhead/Lenox"]
    }
  ],
  "unmatched_comp_markets": ["list of comp markets with no pipeline equivalent"],
  "unmatched_pipeline_submarkets": ["list of pipeline submarkets with no comp equivalent"]
}
"""
```

---

## Usage in Extraction Service

```python
# backend/app/services/data_bank_extraction_service.py

import json
from anthropic import AsyncAnthropic

client = AsyncAnthropic(base_url="https://api.anthropic.com")

async def classify_comp_columns(headers: list, sample_rows: list) -> dict:
    """Use Claude to map raw headers to standardized fields."""
    prompt = COMP_CLASSIFICATION_PROMPT.format(
        headers=json.dumps(headers),
        sample_rows=json.dumps(sample_rows[:5]),
    )
    response = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    # Strip markdown fences if present
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def normalize_comp_records(records: list) -> list:
    """Use Claude to clean and normalize extracted comp records."""
    # Process in batches of 25 to stay within token limits
    BATCH_SIZE = 25
    normalized = []
    
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i+BATCH_SIZE]
        prompt = COMP_NORMALIZATION_PROMPT.format(
            records=json.dumps(batch, indent=2)
        )
        response = await client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        text = text.replace("```json", "").replace("```", "").strip()
        batch_normalized = json.loads(text)
        normalized.extend(batch_normalized)
    
    return normalized


async def extract_underwriting_model(sheet_inventory: list, sheet_data: dict) -> dict:
    """Use Claude to extract financials from underwriting model."""
    prompt = UNDERWRITING_EXTRACTION_PROMPT.format(
        sheet_inventory=json.dumps(sheet_inventory, indent=2),
        sheet_data=json.dumps(sheet_data, indent=2),
    )
    response = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
```

---

## Cost Estimates

| Operation | Model | Input Tokens | Output Tokens | Est. Cost |
|-----------|-------|-------------|---------------|-----------|
| Column classification | Sonnet | ~500 | ~300 | $0.003 |
| Comp normalization (per 25 records) | Sonnet | ~2,000 | ~2,500 | $0.02 |
| Full 177-comp file | Sonnet | ~15,000 | ~18,000 | $0.15 |
| Pipeline classification + normalization | Sonnet | ~1,500 | ~1,500 | $0.01 |
| Underwriting model extraction | Sonnet | ~8,000 | ~3,000 | $0.05 |
| Market normalization | Sonnet | ~1,000 | ~500 | $0.005 |

**Total per document upload: $0.01 - $0.20 depending on size and type.**
