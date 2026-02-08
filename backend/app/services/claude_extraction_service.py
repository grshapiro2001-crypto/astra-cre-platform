"""
Claude API-based intelligent extraction service for CRE documents
"""
import json
import re
from typing import Dict, Any, Optional
import anthropic
from app.config import settings

# Claude API extraction prompt template
CLAUDE_EXTRACTION_PROMPT = """You are a commercial real estate analyst. Analyze this PDF text and extract structured data.

DOCUMENT TYPE DETECTION:
- Identify if this is an Offering Memorandum (OM) or Broker Opinion of Value (BOV)
- Confidence level: high/medium/low

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
    "year_built": number or null,
    "total_units": number or null,
    "total_sf": number or null
  }},
  "average_rents": {{
    "market_rent": number or null,
    "in_place_rent": number or null
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
      "noi": number or null
    }},
    "t3": {{...}},
    "y1": {{...}}
  }},
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

        # Call Claude API
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": CLAUDE_EXTRACTION_PROMPT.format(
                    pdf_text=truncated_text,
                    filename=filename
                )
            }]
        )

        # Extract response text
        response_text = message.content[0].text

        # Parse JSON response - handle markdown code blocks
        extraction_data = parse_json_response(response_text)

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
