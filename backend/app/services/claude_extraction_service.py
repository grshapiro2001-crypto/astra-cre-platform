"""
Claude API-based intelligent extraction service for CRE documents
"""
import json
import re
from typing import Dict, Any, Optional, Tuple
import anthropic
from app.config import settings

def detect_document_type(pdf_text: str) -> Tuple[str, str]:
    """
    Detect document type from PDF text by looking for characteristic indicators.
    Returns tuple of (document_type, confidence)

    Args:
        pdf_text: Extracted text from PDF

    Returns:
        Tuple of ("OM" | "BOV" | "OTHER", "high" | "medium" | "low")
    """
    text_lower = pdf_text.lower()
    first_2000_chars = text_lower[:2000]  # Focus on header/title area

    # BOV indicators (check first as BOV is more specific)
    bov_indicators = [
        "broker opinion of value",
        "broker's opinion of value",
        "bov",
        "pricing scenarios",
        "premium price",
        "market price",
        "as-is price",
        "stabilized price",
        "tax-adjusted cap rate",
        "vac-adjusted cap rate",
        "vac/con/bd adjusted",
        "levered irr",
        "unlevered irr",
        "equity multiple",
        "terminal value",
        "exit cap rate",
        "recommended list price"
    ]

    # OM indicators
    om_indicators = [
        "offering memorandum",
        "investment sales",
        "pleased to present",
        "investment highlights",
        "investment opportunity",
        "exclusively listed",
        "rent comparable analysis",
        "market overview",
        "value-add opportunity"
    ]

    bov_score = sum(1 for indicator in bov_indicators if indicator in text_lower)
    om_score = sum(1 for indicator in om_indicators if indicator in first_2000_chars)

    # Decision logic
    if bov_score >= 3:
        return ("BOV", "high")
    elif bov_score >= 1 and "opinion of value" in text_lower:
        return ("BOV", "medium")
    elif om_score >= 2:
        return ("OM", "high")
    elif om_score >= 1 and "offering memorandum" in first_2000_chars:
        return ("OM", "medium")
    elif bov_score > 0:
        return ("BOV", "low")
    elif om_score > 0:
        return ("OM", "low")
    else:
        return ("OTHER", "low")

# Shared extraction instructions used by all prompts
SHARED_INSTRUCTIONS = """
CRITICAL RULES:
- Return valid JSON only. No markdown, no backticks, no commentary.
- For monetary values: use raw numbers (7586324 not "$7,586,324")
- For percentages: use the number (5.0 not "5.0%" not 0.05) EXCEPT cap rates which are decimals (0.055 not 5.5)
- For missing data: use null, never 0 or empty string
- metro: ALWAYS populate this. Infer from address/submarket if not explicitly stated. Use MSA name (e.g. "Atlanta", "Dallas-Fort Worth", "Phoenix")
- bedroom_count: 0 for Studio, 1 for 1BD, 2 for 2BD, 3 for 3BD
- Do NOT include the subject property as its own rent comp
- Do NOT fabricate data. If a section doesn't exist in the document, return null/empty array for those fields.

METRO EXTRACTION:
- This is the MSA/metro area, NOT the submarket
- For Atlanta properties, metro = "Atlanta"
- For Dallas properties, metro = "Dallas-Fort Worth"
- If not explicitly stated, infer from city/state in the address
- This MUST always be populated if address or submarket is known

UNIT MIX EXTRACTION:
- Usually in Financial Analysis section or a "Unit Mix" table
- Each row = one floorplan
- bedroom_count: 0 for Studio, 1 for 1BD, 2 for 2BD, 3 for 3BD
- proforma_rent_psf = proforma_rent / unit_sf
- renovation_premium: only present in value-add OMs, null otherwise
- Sort by bedroom_count ascending, then by num_units descending
- Return empty array if no unit mix found

RENT COMP EXTRACTION:
- Usually in "Rental Market" or "Rent Comparable Analysis" section
- Extract "All Unit" summary as bedroom_type = "All"
- If per-bedroom tables exist, extract those too with bedroom_type = "Studio", "1BR", "2BR", "3BR"
- is_new_construction = true if comp is labeled as "New Construction"
- Do NOT include the subject property itself as a comp
- Return empty array if no rent comps found
"""

# OM-specific extraction prompt
OM_EXTRACTION_PROMPT = """You are extracting data from a Commercial Real Estate Offering Memorandum (OM).

OMs are MARKETING documents created by a seller's broker to attract buyers. Key characteristics:
- They typically contain ONLY Year 1 Proforma financials (not T12 or T3 in-document — those are in the data room)
- They include investment highlights and a "sell" narrative
- They have detailed unit mix tables with floorplan-level rents
- They include rent comparable analysis (often by bedroom type)
- They may include renovation/value-add assumptions
- They do NOT typically include explicit pricing — the buyer sets their price
- They include market overview, demographics, and location highlights

EXTRACTION PRIORITIES FOR OMs:
1. Property basics (name, address, metro, submarket, units, year built, SF)
2. Y1 Proforma financials (this is the MAIN financial data — extract every line item)
3. Unit mix (CRITICAL — every floorplan with units, SF, in-place rent, proforma rent)
4. Rent comps (extract the "All Unit" summary table AND per-bedroom tables if present)
5. Renovation assumptions (if this is a value-add OM — cost/unit, ROI, premiums)
6. T12/T3 financials — ONLY if they appear in-document. Do NOT fabricate. Most OMs put these in the data room.

FINANCIAL EXTRACTION FOR Y1 PROFORMA:
Extract the FULL income waterfall:
- Gross Scheduled Rent → Loss to Lease → Gross Potential Rent
- Less: Vacancy, Concessions, Non-Revenue Units, Credit Loss
- = Net Rental Income
- Plus: Utility Reimbursements, Parking/Storage Income, Other Income
- = Effective Gross Income
- Less: All expense line items (Utilities, R&M, Make Ready, Contract Services, Marketing, Payroll, G&A, Taxes, Insurance, Management Fee)
- = Net Operating Income
- Less: Replacement Reserves
- = Net Cash Flow

For each financial period found (Y1 is primary, T12/T3 if present):
- gsr: Gross Scheduled Rent
- vacancy: Vacancy loss amount
- concessions: Concessions amount
- bad_debt: Bad debt / credit loss
- non_revenue_units: Non-revenue units loss
- loss_to_lease: Loss to lease amount
- net_rental_income: Net rental income after deductions
- utility_reimbursements: Utility reimbursement income
- parking_storage_income: Parking, storage income
- other_income: Other miscellaneous income
- total_opex: Total Operating Expenses (READ CAREFULLY - see opex extraction rules below)
- noi: Net Operating Income
- replacement_reserves: Replacement reserves
- net_cash_flow: NOI minus replacement reserves
- vacancy_rate_pct: Vacancy rate as percentage
- expense_ratio_pct: OpEx / EGI ratio
- management_fee_pct: Management fee as % of EGI

OPERATING EXPENSES - CRITICAL:
- FIRST look for "Total Operating Expenses" or "Total OpEx" row
- If not found, calculate: Controllable Expenses + Management Fee + Insurance + Property Taxes
- DO NOT use just "Controllable Expenses" subtotal - this is INCORRECT
- Extract component breakdown if available:
  * controllable_expenses: Payroll, Utilities, R&M, Turnover, Marketing, etc.
  * management_fee: Management fee (usually 3-5% of EGI)
  * insurance: Insurance expense
  * property_taxes: Real estate / property taxes

RENOVATION ASSUMPTIONS (if value-add OM):
- Look for sections titled "Renovation Assumptions", "Value-Add", "Renovation Summary"
- renovation_cost_per_unit: Cost per unit
- renovation_total_cost: Total renovation cost
- renovation_rent_premium: Weighted average rent premium per renovated unit
- renovation_roi_pct: ROI / Return on Cost
- renovation_duration_years: Duration in years
- renovation_stabilized_revenue: Stabilized revenue after renovation

AVERAGE RENTS:
- market_rent: What units COULD rent for (average per unit)
- in_place_rent: What tenants CURRENTLY pay (average per unit)

{shared_instructions}

Return JSON format:
{{
  "document_type": "OM",
  "confidence": "high" | "medium" | "low",
  "property_info": {{
    "deal_name": "string or null (use filename {filename} if not found)",
    "property_address": "string or null",
    "property_type": "string or null",
    "submarket": "string or null",
    "metro": "string or null",
    "year_built": number or null,
    "total_units": number or null,
    "total_sf": number or null
  }},
  "average_rents": {{
    "market_rent": number or null,
    "in_place_rent": number or null
  }},
  "renovation": {{
    "renovation_cost_per_unit": number or null,
    "renovation_total_cost": number or null,
    "renovation_rent_premium": number or null,
    "renovation_roi_pct": number or null,
    "renovation_duration_years": number or null,
    "renovation_stabilized_revenue": number or null
  }},
  "financials_by_period": {{
    "y1": {{
      "period_label": "exact label from doc",
      "gsr": number or null,
      "vacancy": number or null,
      "concessions": number or null,
      "bad_debt": number or null,
      "non_revenue_units": number or null,
      "loss_to_lease": number or null,
      "net_rental_income": number or null,
      "utility_reimbursements": number or null,
      "parking_storage_income": number or null,
      "other_income": number or null,
      "total_opex": number or null,
      "opex_components": {{
        "controllable_expenses": number or null,
        "management_fee": number or null,
        "insurance": number or null,
        "property_taxes": number or null
      }},
      "noi": number or null,
      "replacement_reserves": number or null,
      "net_cash_flow": number or null,
      "vacancy_rate_pct": number or null,
      "expense_ratio_pct": number or null,
      "management_fee_pct": number or null,
      "real_estate_taxes": number or null,
      "insurance_amount": number or null,
      "credit_loss": number or null
    }},
    "t12": {{...same structure as y1 - ONLY if found in document...}},
    "t3": {{...same structure as y1 - ONLY if found in document...}}
  }},
  "unit_mix": [
    {{
      "floorplan_name": "string or null",
      "unit_type": "string (e.g. '1 BD/1 BA')",
      "bedroom_count": number (0=Studio, 1, 2, 3),
      "bathroom_count": number or null,
      "num_units": number,
      "unit_sf": number or null,
      "in_place_rent": number or null,
      "proforma_rent": number or null,
      "proforma_rent_psf": number or null,
      "renovation_premium": number or null
    }}
  ],
  "rent_comps": [
    {{
      "comp_name": "string",
      "location": "string or null",
      "num_units": number or null,
      "avg_unit_sf": number or null,
      "in_place_rent": number or null,
      "in_place_rent_psf": number or null,
      "bedroom_type": "All" | "Studio" | "1BR" | "2BR" | "3BR",
      "is_new_construction": boolean
    }}
  ],
  "bov_pricing_tiers": [],
  "source_notes": {{
    "property_info_source": "e.g., Page 2, Executive Summary",
    "financials_source": "e.g., Page 8, Operating Statement"
  }},
  "missing_fields": ["array of field names that could not be found"]
}}

PDF TEXT:
{pdf_text}
"""

# BOV-specific extraction prompt
BOV_EXTRACTION_PROMPT = """You are extracting data from a Broker Opinion of Value (BOV).

BOVs are VALUATION documents that provide pricing guidance. Key characteristics:
- They contain MULTIPLE financial periods (T3, T12, AND Y1 Proforma)
- They include explicit pricing scenarios (Premium, Market, As-Is, Stabilized, etc.)
- They include cap rates with specific qualifiers (Tax-Adjusted, Vac/Con/BD Adjusted, etc.)
- They include return metrics (IRR, Cash-on-Cash, Equity Multiple)
- They include terminal/exit assumptions
- They may include debt/leverage assumptions

EXTRACTION PRIORITIES FOR BOVs:
1. Property basics (name, address, metro, submarket, units, year built, SF)
2. ALL financial periods (T3, T12, AND Y1 — extract every one that exists)
3. Pricing tiers (CRITICAL — extract each scenario with: price, price/unit, price/SF)
4. Cap rates for each tier (with qualifiers: "Tax Adjusted", "Vac/Con/BD Adjusted", etc.)
5. Return metrics per tier (levered IRR, unlevered IRR, cash-on-cash, equity multiple)
6. Terminal assumptions (exit cap rate, terminal value, hold period)
7. Debt assumptions if present (LTV, interest rate, IO period, amortization)
8. Unit mix and rent comps (if present — BOVs sometimes include these, sometimes not)
9. Renovation assumptions (if present)

FINANCIAL EXTRACTION FOR EACH PERIOD (T3, T12, Y1):
Extract the FULL income waterfall for EACH period:
- Gross Scheduled Rent
- Less: Vacancy, Concessions, Bad Debt, Non-Revenue Units, Loss to Lease
- Plus: Utility Reimbursements, Parking/Storage Income, Other Income
- = Effective Gross Income
- Less: Operating Expenses (with breakdown: Controllable, Management Fee, Insurance, Taxes)
- = Net Operating Income
- Less: Replacement Reserves
- = Net Cash Flow

For each period extract:
- period_label: Exact label from document
- gsr, vacancy, concessions, bad_debt, non_revenue_units
- loss_to_lease, net_rental_income
- utility_reimbursements, parking_storage_income, other_income
- total_opex (with opex_components breakdown)
- noi, replacement_reserves, net_cash_flow
- vacancy_rate_pct, expense_ratio_pct, management_fee_pct

PRICING TIERS - CRITICAL:
BOVs typically have MULTIPLE pricing scenarios. Extract ALL tiers found.

For EACH pricing tier, extract:
- pricing_tier_id: Sequential ("tier_1", "tier_2", "tier_3")
- tier_label: Exact label from document (e.g., "Premium Price", "Market Assumptions", "As-Is Value")
- tier_type: "asking_price" (if recommended price) | "market_assumption" (if market-based scenario) | null
- pricing: Total valuation amount
- price_per_unit: Price per unit
- price_per_sf: Price per square foot

- cap_rates: Array of cap rates for this tier:
  [
    {{
      "rate_type": "T3" | "T12" | "Y1" | "Trailing" | "Proforma" | "Stabilized",
      "qualifier": "Tax Adjusted" | "Vac/Con/BD Adjusted" | "As-Is" | "Stabilized" | null,
      "value": number (as decimal, e.g., 0.0495 for 4.95%)
    }}
  ]

- loan_assumptions (if present):
  {{
    "leverage": number (LTV as decimal, e.g., 0.65 for 65%),
    "loan_amount": number,
    "interest_rate": number (as percentage, e.g., 5.25 for 5.25%),
    "io_period_months": number,
    "amortization_years": number
  }}

- return_metrics (if present):
  {{
    "levered_irr": number (as decimal, e.g., 0.115 for 11.5%),
    "unlevered_irr": number (as decimal),
    "equity_multiple": number (e.g., 1.85),
    "avg_cash_on_cash": number (as decimal, e.g., 0.067 for 6.7%)
  }}

- terminal_assumptions (if present):
  {{
    "terminal_cap_rate": number (as decimal, e.g., 0.055),
    "hold_period_years": number
  }}

IMPORTANT:
- Extract ALL pricing tiers found in the document
- Each tier is a complete isolated package
- Cap rates are nested within each tier with their specific qualifiers
- If a field is not provided for a specific tier, use null

{shared_instructions}

Return JSON format:
{{
  "document_type": "BOV",
  "confidence": "high" | "medium" | "low",
  "property_info": {{
    "deal_name": "string or null (use filename {filename} if not found)",
    "property_address": "string or null",
    "property_type": "string or null",
    "submarket": "string or null",
    "metro": "string or null",
    "year_built": number or null,
    "total_units": number or null,
    "total_sf": number or null
  }},
  "average_rents": {{
    "market_rent": number or null,
    "in_place_rent": number or null
  }},
  "renovation": {{
    "renovation_cost_per_unit": number or null,
    "renovation_total_cost": number or null,
    "renovation_rent_premium": number or null,
    "renovation_roi_pct": number or null,
    "renovation_duration_years": number or null,
    "renovation_stabilized_revenue": number or null
  }},
  "financials_by_period": {{
    "t3": {{
      "period_label": "exact label from doc",
      "gsr": number or null,
      "vacancy": number or null,
      "concessions": number or null,
      "bad_debt": number or null,
      "non_revenue_units": number or null,
      "loss_to_lease": number or null,
      "net_rental_income": number or null,
      "utility_reimbursements": number or null,
      "parking_storage_income": number or null,
      "other_income": number or null,
      "total_opex": number or null,
      "opex_components": {{
        "controllable_expenses": number or null,
        "management_fee": number or null,
        "insurance": number or null,
        "property_taxes": number or null
      }},
      "noi": number or null,
      "replacement_reserves": number or null,
      "net_cash_flow": number or null,
      "vacancy_rate_pct": number or null,
      "expense_ratio_pct": number or null,
      "management_fee_pct": number or null,
      "real_estate_taxes": number or null,
      "insurance_amount": number or null,
      "credit_loss": number or null
    }},
    "t12": {{...same structure as t3...}},
    "y1": {{...same structure as t3...}}
  }},
  "unit_mix": [
    {{
      "floorplan_name": "string or null",
      "unit_type": "string (e.g. '1 BD/1 BA')",
      "bedroom_count": number (0=Studio, 1, 2, 3),
      "bathroom_count": number or null,
      "num_units": number,
      "unit_sf": number or null,
      "in_place_rent": number or null,
      "proforma_rent": number or null,
      "proforma_rent_psf": number or null,
      "renovation_premium": number or null
    }}
  ],
  "rent_comps": [
    {{
      "comp_name": "string",
      "location": "string or null",
      "num_units": number or null,
      "avg_unit_sf": number or null,
      "in_place_rent": number or null,
      "in_place_rent_psf": number or null,
      "bedroom_type": "All" | "Studio" | "1BR" | "2BR" | "3BR",
      "is_new_construction": boolean
    }}
  ],
  "bov_pricing_tiers": [
    {{
      "pricing_tier_id": "tier_1",
      "tier_label": "string",
      "tier_type": "asking_price" | "market_assumption" | null,
      "pricing": number or null,
      "price_per_unit": number or null,
      "price_per_sf": number or null,
      "cap_rates": [
        {{
          "rate_type": "string",
          "value": number or null,
          "qualifier": "string or null"
        }}
      ],
      "loan_assumptions": {{
        "leverage": number or null,
        "loan_amount": number or null,
        "interest_rate": number or null,
        "io_period_months": number or null,
        "amortization_years": number or null
      }},
      "return_metrics": {{
        "unlevered_irr": number or null,
        "levered_irr": number or null,
        "equity_multiple": number or null,
        "avg_cash_on_cash": number or null
      }},
      "terminal_assumptions": {{
        "terminal_cap_rate": number or null,
        "hold_period_years": number or null
      }}
    }}
  ],
  "source_notes": {{
    "property_info_source": "e.g., Page 2, Executive Summary",
    "financials_source": "e.g., Page 8, Operating Statement"
  }},
  "missing_fields": ["array of field names that could not be found"]
}}

PDF TEXT:
{pdf_text}
"""

# Generic extraction prompt for unknown document types
GENERIC_EXTRACTION_PROMPT = """You are a commercial real estate analyst. Analyze this PDF text and extract structured data.

FOR ALL DOCUMENTS, EXTRACT:

Property Information:
- Deal Name (or use filename: {filename})
- Property Address (full address)
- Property Type (Office, Retail, Industrial, Multifamily, etc.)
- Submarket
- Year Built
- Total Units (if multifamily)
- Total Square Footage (typically "Total Residential SF" for multifamily)

CRITICAL - EXTRACT ALL FINANCIAL PERIODS (DO NOT STOP AFTER FIRST):
⚠️ MOST OMs CONTAIN TWO SETS OF FINANCIALS - YOU MUST EXTRACT BOTH:
1. Historical/Trailing period (T12, T3, T1, etc.)
2. Proforma/Forward-looking (Y1, Year 1, Pro Forma, etc.)

SEARCH STRATEGY:
- DO NOT stop after finding the first financial table
- Scan the ENTIRE document for all financial periods
- Look in multiple sections: Executive Summary, Financial Analysis, Operating Statement, Investment Summary
- Common structure: Historical data comes first, then Proforma/Y1 appears later in document

PERIOD LABELS - Find ALL of these:

HISTORICAL/TRAILING (extract this):
- T12, T-12, TTM, Trailing 12 Months, 12 Month Trailing
- T3, T-3, Trailing 3 Months, 3 Month Trailing
- T1, T-1, Trailing 1 Month

PROFORMA/FORWARD (extract this too - CRITICAL):
- Y1, Year 1, Year One, FY1, First Year
- Pro Forma, Proforma, Pro-Forma
- Budget, Projected, Forward
- Stabilized (sometimes used instead of Y1)

COMMON DOCUMENT PATTERNS:
Pattern A: Side-by-side columns in same table (T3 | Y1) - Extract BOTH columns
Pattern B: Separate tables/sections (first table = T12, later section = Proforma) - Extract from BOTH sections
Pattern C: Multiple periods in one table (T12 | T3 | Y1) - Extract ALL three

Use the EXACT terminology from the document as the period_label.

FINANCIAL EXTRACTION (READ FROM CORRECT ROWS):
For EACH time period column you find, extract from the CORRECT rows:

Revenue:
- Gross Scheduled Rent/Revenue (GSR) - from "Gross Scheduled Rent" row, NOT "Market Rents"

Deductions (these will display in RED):
- Vacancy ($ amount)
- Concessions ($ amount)
- Bad Debt ($ amount)
- Non-Revenue Units ($ amount)

Operating Expenses - CRITICAL EXTRACTION:
- Total Operating Expenses (OpEx) - READ CAREFULLY:
  * FIRST look for "Total Operating Expenses" or "Total OpEx" row
  * If not found, calculate: Controllable Expenses + Management Fee + Insurance + Property Taxes
  * DO NOT use just "Controllable Expenses" subtotal - this is INCORRECT
  * Common structure:
    - Controllable Expenses (subtotal): Payroll, Utilities, R&M, Turnover, etc.
    - Plus: Management Fee (usually 3-5% of EGI)
    - Plus: Insurance
    - Plus: Property Taxes / Real Estate Taxes
    - Equals: Total Operating Expenses
  * Extract component breakdown if available:
    - controllable_expenses: number or null
    - management_fee: number or null
    - insurance: number or null
    - property_taxes: number or null
- Net Operating Income (NOI)

Average Rents (for Multifamily properties):
- Market Rent (average per unit) - what units COULD rent for
- In Place Rent (average per unit) - what tenants CURRENTLY pay
- Label clearly if document shows both

Period Label - exact text from document column header

FOR BOVs EXTRACT PRICING TIERS:
⚠️ CRITICAL: BOVs typically have MULTIPLE pricing scenarios/tiers

BOV STRUCTURE:
- Each pricing tier is a COMPLETE ISOLATED PACKAGE with:
  * Pricing (valuation for this tier)
  * Price per Unit
  * Price per SF
  * Cap Rate(s) with NOI basis
  * Loan assumptions (LTV, interest rate, amortization)
  * Return metrics (levered/unlevered IRR, equity multiple, cash-on-cash)
  * Terminal assumptions (exit cap rate, hold period)

EXTRACTION STRATEGY:
1. Identify ALL pricing scenarios/tiers in the document
2. For EACH tier, extract the complete package of metrics
3. Use tier_label from document (e.g., "Market Assumptions", "Premium Pricing", "Tier 1")
4. Identify tier_type:
   - "asking_price" if it's the broker's asking/recommended price
   - "market_assumption" if it's a market-based valuation scenario
   - null for other scenarios

TIER STRUCTURE - Extract for EACH tier:
{{
  "pricing_tier_id": "tier_1" | "tier_2" | "tier_3" (sequential),
  "tier_label": "exact label from document or descriptive name",
  "tier_type": "asking_price" | "market_assumption" | null,

  "pricing": number (valuation),
  "price_per_unit": number,
  "price_per_sf": number,

  "cap_rates": [
    {{
      "cap_rate_type": "trailing" | "proforma" | "stabilized" | "t12" | "y1",
      "cap_rate_value": number (4.75),
      "noi_basis": number (NOI value used),
      "qualifier": "as-is" | "stabilized" | null
    }}
  ],

  "loan_assumptions": {{
    "leverage": number (LTV % as decimal, e.g., 0.65),
    "loan_amount": number,
    "interest_rate": number (5.25),
    "io_period_months": number,
    "amortization_years": number
  }},

  "return_metrics": {{
    "unlevered_irr": number,
    "levered_irr": number,
    "equity_multiple": number,
    "avg_cash_on_cash": number
  }},

  "terminal_assumptions": {{
    "terminal_cap_rate": number,
    "hold_period_years": number
  }}
}}

IMPORTANT:
- Extract ALL tiers found in document
- Each tier must be a complete package
- Cap rates are nested within each tier
- If a field is not provided for a specific tier, use null

METRO EXTRACTION:
- This is the MSA/metro area, NOT the submarket
- For Atlanta properties, metro = "Atlanta"
- For Dallas properties, metro = "Dallas-Fort Worth"
- If not explicitly stated, infer from city/state in the address
- This MUST always be populated if address or submarket is known

RENOVATION ASSUMPTIONS EXTRACTION:
- Look for sections titled "Renovation Assumptions", "Value-Add", "Renovation Summary", "Capital Improvements"
- These may not exist in every OM — return null for all if not found
- Cost per unit is often prominently displayed
- ROI / Return on Cost is usually calculated as (stabilized revenue increase / total cost)
- renovation_rent_premium = weighted average rent premium per renovated unit

GRANULAR FINANCIAL LINE ITEMS (per period — Y1, T12, T3):
For whichever period(s) exist, also extract these additional line items:
- loss_to_lease: Loss to Lease amount (negative number or null)
- vacancy_rate_pct: Vacancy as a percentage (e.g. 5.0)
- credit_loss: Credit loss / bad debt amount
- net_rental_income: NRI = GSR + Renovation Premium + Loss to Lease - Vacancy - Concessions - Credit Loss
- utility_reimbursements: Utility reimbursement income
- parking_storage_income: Parking, storage, garage income
- other_income: Other miscellaneous income items
- management_fee_pct: Management fee as % of EGI (e.g. 2.5)
- real_estate_taxes: Real estate / property tax amount
- insurance_amount: Insurance expense amount
- replacement_reserves: Capital replacement reserves
- net_cash_flow: NOI minus replacement reserves
- expense_ratio_pct: Total OpEx / EGI (or GSR) as stated in document
Not all OMs include every line item — return null for missing items, never fabricate.

UNIT MIX EXTRACTION:
- Usually in Financial Analysis section or a "Unit Mix" table
- Each row = one floorplan
- bedroom_count: 0 for Studio, 1 for 1BD, 2 for 2BD, 3 for 3BD
- proforma_rent_psf = proforma_rent / unit_sf
- renovation_premium: only present in value-add OMs, null otherwise
- Sort by bedroom_count ascending, then by num_units descending
- Return empty array if no unit mix found

RENT COMP EXTRACTION:
- Usually in "Rental Market" or "Rent Comparable Analysis" section
- Extract "All Unit" summary as bedroom_type = "All"
- If per-bedroom tables exist, extract those too with bedroom_type = "Studio", "1BR", "2BR", "3BR"
- is_new_construction = true if comp is labeled as "New Construction"
- Do NOT include the subject property itself as a comp
- Return empty array if no rent comps found

VERIFICATION - CRITICAL STEP:
- Verify: GSR - Vacancy - Concessions - Bad Debt - Non-Revenue Units ≈ EGI
- If numbers don't match, double-check which row you're reading from
- ⚠️ VERIFY YOU EXTRACTED BOTH PERIODS:
  * Did you find a historical period (T12/T3/T1)? YES/NO
  * Did you find a proforma period (Y1/Pro Forma)? YES/NO
  * If you only found ONE period, add to missing_fields: "Y1_Proforma_financials" or "Historical_financials"
  * Most OMs have BOTH - if you only found one, scan the document again more thoroughly

IMPORTANT:
- Use EXACT column headers from document - don't standardize them
- Extract from CORRECT rows - "Gross Scheduled Rent" ≠ "Market Rents"
- All numbers as numeric values only (no commas, no $) - UI will format
- Extract ALL financial periods found - do not stop after first
- If only one period found, flag this in missing_fields
- Optionally note source page/section for key data

Return JSON format:
{{
  "document_type": "OM" | "BOV" | "Unknown",
  "confidence": "high" | "medium" | "low",
  "property_info": {{
    "deal_name": "string or null",
    "property_address": "string or null",
    "property_type": "string or null",
    "submarket": "string or null",
    "metro": "string or null — MSA-level metro area (e.g. 'Atlanta', 'Dallas-Fort Worth'). Infer from city/state if not explicit.",
    "year_built": number or null,
    "total_units": number or null,
    "total_sf": number or null
  }},
  "average_rents": {{
    "market_rent": number or null,
    "in_place_rent": number or null
  }},
  "renovation": {{
    "renovation_cost_per_unit": number or null,
    "renovation_total_cost": number or null,
    "renovation_rent_premium": number or null,
    "renovation_roi_pct": number or null,
    "renovation_duration_years": number or null,
    "renovation_stabilized_revenue": number or null
  }},
  "financials_by_period": {{
    "t12": {{
      "period_label": "exact label from doc",
      "gsr": number or null,
      "vacancy": number or null,
      "concessions": number or null,
      "bad_debt": number or null,
      "non_revenue_units": number or null,
      "total_opex": number or null,
      "opex_components": {{
        "controllable_expenses": number or null,
        "management_fee": number or null,
        "insurance": number or null,
        "property_taxes": number or null
      }},
      "noi": number or null,
      "loss_to_lease": number or null,
      "vacancy_rate_pct": number or null,
      "credit_loss": number or null,
      "net_rental_income": number or null,
      "utility_reimbursements": number or null,
      "parking_storage_income": number or null,
      "other_income": number or null,
      "management_fee_pct": number or null,
      "real_estate_taxes": number or null,
      "insurance_amount": number or null,
      "replacement_reserves": number or null,
      "net_cash_flow": number or null,
      "expense_ratio_pct": number or null
    }},
    "t3": {{...same structure as t12...}},
    "y1": {{...same structure as t12...}}
  }},
  "unit_mix": [
    {{
      "floorplan_name": "string or null",
      "unit_type": "string (e.g. '1 BD/1 BA')",
      "bedroom_count": number (0=Studio, 1, 2, 3),
      "bathroom_count": number or null,
      "num_units": number,
      "unit_sf": number or null,
      "in_place_rent": number or null,
      "proforma_rent": number or null,
      "proforma_rent_psf": number or null,
      "renovation_premium": number or null
    }}
  ],
  "rent_comps": [
    {{
      "comp_name": "string",
      "location": "string or null",
      "num_units": number or null,
      "avg_unit_sf": number or null,
      "in_place_rent": number or null,
      "in_place_rent_psf": number or null,
      "bedroom_type": "All" | "Studio" | "1BR" | "2BR" | "3BR",
      "is_new_construction": boolean
    }}
  ],
  "bov_pricing_tiers": [
    {{
      "pricing_tier_id": "tier_1",
      "tier_label": "string",
      "tier_type": "asking_price" | "market_assumption" | null,
      "pricing": number or null,
      "price_per_unit": number or null,
      "price_per_sf": number or null,
      "cap_rates": [
        {{
          "cap_rate_type": "string",
          "cap_rate_value": number or null,
          "noi_basis": number or null,
          "qualifier": "string or null"
        }}
      ],
      "loan_assumptions": {{
        "leverage": number or null,
        "loan_amount": number or null,
        "interest_rate": number or null,
        "io_period_months": number or null,
        "amortization_years": number or null
      }},
      "return_metrics": {{
        "unlevered_irr": number or null,
        "levered_irr": number or null,
        "equity_multiple": number or null,
        "avg_cash_on_cash": number or null
      }},
      "terminal_assumptions": {{
        "terminal_cap_rate": number or null,
        "hold_period_years": number or null
      }}
    }}
  ],
  "source_notes": {{
    "property_info_source": "e.g., Page 2, Executive Summary",
    "financials_source": "e.g., Page 8, Operating Statement"
  }},
  "missing_fields": ["array of field names that could not be found"]
}}

PDF TEXT:
{pdf_text}
"""

def parse_json_response(response_text: str) -> Dict[str, Any]:
    """
    Parse JSON from Claude's response, handling markdown code blocks and extra text.

    Args:
        response_text: Raw text response from Claude API

    Returns:
        Parsed JSON as dictionary

    Raises:
        json.JSONDecodeError: If no valid JSON found
    """
    # First, try to parse as-is
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from markdown code blocks
    # Look for ```json ... ``` or ``` ... ```
    code_block_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
    match = re.search(code_block_pattern, response_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find JSON object by looking for balanced braces
    # Start from first { and try to find matching }
    start_idx = response_text.find('{')
    if start_idx != -1:
        brace_count = 0
        for i in range(start_idx, len(response_text)):
            if response_text[i] == '{':
                brace_count += 1
            elif response_text[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    # Found matching closing brace
                    try:
                        return json.loads(response_text[start_idx:i+1])
                    except json.JSONDecodeError:
                        break

    # If all else fails, raise error with the response for debugging
    raise json.JSONDecodeError(
        f"Could not find valid JSON in response. Response text: {response_text[:500]}...",
        response_text,
        0
    )

async def extract_with_claude(
    pdf_text: str,
    filename: str
) -> Dict[str, Any]:
    """
    Use Claude API to intelligently extract structured data from PDF text.

    Args:
        pdf_text: Extracted text from PDF
        filename: Original filename (may contain deal name)

    Returns:
        Dictionary containing extraction results with calculated metrics

    Raises:
        Exception: If Claude API call fails or response is invalid
    """
    # Check if API key is configured
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-api-key-here":
        raise Exception(
            "ANTHROPIC_API_KEY not configured. Please add your Claude API key to the .env file."
        )

    try:
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, base_url="https://api.anthropic.com")

        # Truncate PDF text if too long (Claude has 200k context but let's be conservative)
        max_text_length = 100000
        truncated_text = pdf_text[:max_text_length]
        if len(pdf_text) > max_text_length:
            truncated_text += "\n\n[Text truncated due to length...]"

        # Phase 1: Detect document type
        doc_type, confidence = detect_document_type(truncated_text)

        # Phase 2: Select appropriate extraction prompt
        if doc_type == "OM":
            extraction_prompt = OM_EXTRACTION_PROMPT.format(
                pdf_text=truncated_text,
                filename=filename,
                shared_instructions=SHARED_INSTRUCTIONS
            )
        elif doc_type == "BOV":
            extraction_prompt = BOV_EXTRACTION_PROMPT.format(
                pdf_text=truncated_text,
                filename=filename,
                shared_instructions=SHARED_INSTRUCTIONS
            )
        else:
            # Use generic prompt for unknown document types
            extraction_prompt = GENERIC_EXTRACTION_PROMPT.format(
                pdf_text=truncated_text,
                filename=filename
            )

        # Call Claude API with specialized prompt
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": extraction_prompt
            }]
        )

        # Extract response text
        response_text = message.content[0].text

        # Parse JSON response - handle markdown code blocks
        extraction_data = parse_json_response(response_text)

        # Ensure document_type and confidence are set (override if detection differs)
        if 'document_type' not in extraction_data or extraction_data['document_type'] in [None, 'Unknown']:
            extraction_data['document_type'] = doc_type
        if 'confidence' not in extraction_data:
            extraction_data['confidence'] = confidence

        # Calculate derived metrics
        extraction_data['calculated_metrics'] = calculate_metrics(
            extraction_data.get('financials_by_period', {})
        )

        return extraction_data

    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse Claude API response as JSON: {str(e)}")
    except anthropic.APIError as e:
        raise Exception(f"Claude API error: {str(e)}")
    except Exception as e:
        raise Exception(f"Extraction failed: {str(e)}")

def calculate_metrics(financials_by_period: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Calculate Economic Occupancy and OpEx Ratio for each financial period.

    Economic Occupancy = (GSR - Vacancy - Concessions - Bad Debt - Non-Revenue Units) / GSR
    OpEx Ratio = Total OpEx / GSR

    Args:
        financials_by_period: Dictionary of financial data by period (t12, t3, y1)

    Returns:
        Dictionary of calculated metrics by period
    """
    calculated = {}

    for period, data in financials_by_period.items():
        if not data or not isinstance(data, dict):
            continue

        gsr = data.get('gsr') or 0

        if gsr > 0:
            # Calculate deductions for Economic Occupancy
            vacancy = data.get('vacancy') or 0
            concessions = data.get('concessions') or 0
            bad_debt = data.get('bad_debt') or 0
            non_revenue_units = data.get('non_revenue_units') or 0

            total_deductions = vacancy + concessions + bad_debt + non_revenue_units

            # Economic Occupancy percentage
            economic_occupancy = ((gsr - total_deductions) / gsr) * 100

            # OpEx Ratio
            total_opex = data.get('total_opex') or 0
            opex_ratio = (total_opex / gsr) * 100 if gsr > 0 else 0

            calculated[period] = {
                'economic_occupancy': round(economic_occupancy, 2),
                'opex_ratio': round(opex_ratio, 2),
                'formula_econ_occ': f"(${gsr:,.0f} - ${total_deductions:,.0f}) / ${gsr:,.0f}",
                'formula_opex': f"${total_opex:,.0f} / ${gsr:,.0f}"
            }

    return calculated
