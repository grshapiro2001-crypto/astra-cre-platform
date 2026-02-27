"""
Market Research Extraction Service — PDF market research report processing

Extracts transaction comps and market sentiment signals from brokerage
market research PDFs (Walker & Dunlop, CBRE, Marcus & Millichap, JLL,
Cushman & Wakefield, CoStar, Yardi Matrix, Berkadia, Newmark, etc.).

Uses the same patterns as:
- pdf_service.py for PDF text extraction (pdfplumber)
- claude_extraction_service.py for Claude API calls and JSON parsing
- data_bank_extraction_service.py for SalesComp record creation
"""
import json
import logging
from datetime import datetime
from typing import List, Tuple

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models.data_bank import DataBankDocument, SalesComp
from app.models.market_sentiment import MarketSentimentSignal
from app.services.pdf_service import extract_text_from_pdf
from app.services.claude_extraction_service import parse_json_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------

MARKET_RESEARCH_PROMPT = """You are a commercial real estate analyst. Read the attached document and extract
all transaction comps and market sentiment signals.

This document could be from ANY CRE research firm — Walker & Dunlop, CBRE,
Marcus & Millichap, JLL, Cushman & Wakefield, CoStar, Yardi Matrix, Berkadia,
Newmark, Colliers, or others. Do not assume any particular format. Read the
document semantically and extract every piece of actionable intelligence.

## DOCUMENT METADATA

First, identify:
- source_firm: The firm that authored this document
- publication_date: Best estimate of when this was published (format: "YYYY-MM" or "YYYY-QN")
- geographies_covered: List of metros and submarkets discussed

## TRANSACTION COMPS

Extract every specific property trade mentioned anywhere in the document —
whether in a data table, a case study, a footnote, or narrative text.

For each comp, provide as JSON:
{{
  "property_name": string or null,
  "address": string or null,
  "city": string or null,
  "state": string or null,
  "submarket": string or null,
  "metro": string (required — normalized MSA name),
  "units": number or null,
  "year_built": number or null,
  "sale_date": string or null (format: "YYYY-MM-DD" or "YYYY-MM" or "YYYY-QN"),
  "price_total": number or null (in dollars, not millions),
  "price_per_unit": number or null,
  "cap_rate": number or null (as decimal, e.g. 0.055 not 5.5),
  "buyer": string or null,
  "seller": string or null,
  "asset_class": string or null (e.g. "Garden", "Mid-Rise", "High-Rise", "Townhome"),
  "notes": string or null (any additional context — renovation status, assumable debt, motivation),
  "confidence": "high" | "medium" | "low"
}}

If a trade is referenced but missing key details, still extract what you can and
set confidence to "low" or "medium". Do NOT skip a trade just because some
fields are missing.

## MARKET SENTIMENT SIGNALS

Extract every market-level data point, trend, or qualitative insight.
This includes: absorption data, supply pipeline metrics, construction
starts/completions, rent growth figures, occupancy trends, concession
prevalence, employment/population data, cap rate movements, buyer demand
shifts, seller motivation patterns, debt market conditions, regulatory
changes, and any other market intelligence.

For each signal, provide as JSON:
{{
  "signal_type": one of ["absorption", "supply_pipeline", "construction_starts",
    "rent_growth", "occupancy", "concessions", "employment", "population",
    "cap_rate_trend", "buyer_demand", "seller_motivation", "debt_market",
    "regulatory", "other"],
  "geography_source_label": string (exactly how the document labels the geography),
  "geography_metro": string (your best normalized MSA name — e.g. "Atlanta-Sandy Springs-Roswell, GA"),
  "geography_submarket": string or null (if signal is submarket-specific),
  "direction": "positive" | "negative" | "neutral" | "mixed",
  "magnitude": "strong" | "moderate" | "slight",
  "time_reference": string or null (e.g. "2025", "Q4 2025", "YTD 2025"),
  "quantitative_value": string or null (e.g. "20,732 units", "-35% YoY"),
  "narrative_summary": string (one sentence, plain English, e.g.
    "Absorption outpaced deliveries for the first time since 2021, reaching 106% above the 10-year average"),
  "verbatim_excerpt": string or null (short quote from document for attribution, under 50 words),
  "confidence": "high" | "medium" | "low"
}}

Direction guidance:
- "positive" = bullish for property values/rents (strong absorption, declining supply, rent growth)
- "negative" = bearish (oversupply, rising concessions, declining employment)
- "neutral" = stable/flat
- "mixed" = conflicting signals within the same metric

Magnitude guidance:
- "strong" = notable deviation from historical norms or consensus expectations
- "moderate" = meaningful but within normal range
- "slight" = marginal movement

## OUTPUT FORMAT

Return a single JSON object:
{{
  "metadata": {{
    "source_firm": "...",
    "publication_date": "...",
    "geographies_covered": ["..."]
  }},
  "comps": [ ... ],
  "signals": [ ... ]
}}

Extract EVERYTHING. It is better to extract too many signals than too few.
The scoring engine will weight and filter them. Do not pre-filter based on
what you think is "important enough."

CRITICAL RULES:
- Return valid JSON only. No markdown, no backticks, no commentary.
- For monetary values: use raw numbers (7586324 not "$7,586,324")
- For cap rates: use decimals (0.055 not 5.5)
- For missing data: use null, never 0 or empty string
- Do NOT fabricate data. Only extract what is actually in the document.

PDF TEXT:
{pdf_text}
"""


# ---------------------------------------------------------------------------
# Core extraction function
# ---------------------------------------------------------------------------

def process_market_research_pdf(
    filepath: str,
    user_id: str,
    db: Session,
    document: DataBankDocument,
) -> Tuple[str, int, List[str]]:
    """
    Process a market research PDF upload end-to-end.

    1. Extract text from PDF via pdfplumber
    2. Send to Claude for extraction
    3. Parse response and create SalesComp + MarketSentimentSignal records
    4. Update document metadata

    Returns: (document_type, record_count, warnings)
    """
    warnings: List[str] = []
    document.document_type = "market_research"
    document.extraction_status = "processing"
    db.flush()

    try:
        # Phase 1: Extract text from PDF
        pdf_text = extract_text_from_pdf(filepath)

        if not pdf_text or len(pdf_text.strip()) < 100:
            document.extraction_status = "failed"
            document.extraction_data = json.dumps({
                "error": "Could not extract sufficient text from PDF"
            })
            db.commit()
            warnings.append("Could not extract sufficient text from PDF. The file may be scanned or corrupted.")
            return "market_research", 0, warnings

        # Phase 2: Call Claude API
        extraction_data = _call_claude_extraction(pdf_text)

        # Phase 3: Parse and store records
        comp_count = _store_comps(extraction_data.get("comps", []), document.id, user_id, db, warnings)
        signal_count = _store_signals(extraction_data.get("signals", []), document.id, user_id, db, warnings)

        # Phase 4: Update document metadata
        metadata = extraction_data.get("metadata", {})
        document.source_firm = metadata.get("source_firm")
        document.publication_date = metadata.get("publication_date")

        geographies = metadata.get("geographies_covered", [])
        if isinstance(geographies, list):
            document.geographies_covered = ", ".join(geographies)
        elif isinstance(geographies, str):
            document.geographies_covered = geographies

        document.signal_count = signal_count
        document.record_count = comp_count + signal_count
        document.extraction_status = "completed"
        document.extraction_data = json.dumps(extraction_data)

        db.commit()

        logger.info(
            "Market research extraction complete: file=%s comps=%d signals=%d source=%s",
            document.filename, comp_count, signal_count, document.source_firm,
        )

        return "market_research", comp_count + signal_count, warnings

    except Exception as e:
        logger.exception(f"Market research extraction failed for document {document.id}")
        db.rollback()
        document.extraction_status = "failed"
        document.extraction_data = json.dumps({"error": str(e), "warnings": warnings})
        db.commit()
        warnings.append(f"Extraction failed: {str(e)}")
        return "market_research", 0, warnings


# ---------------------------------------------------------------------------
# Claude API call
# ---------------------------------------------------------------------------

def _call_claude_extraction(pdf_text: str) -> dict:
    """Send PDF text to Claude API and return parsed extraction result."""
    # Check API key
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-api-key-here":
        raise Exception(
            "ANTHROPIC_API_KEY not configured. Please add your Claude API key to the .env file."
        )

    # Initialize client (same config as claude_extraction_service.py)
    client = anthropic.Anthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        base_url="https://api.anthropic.com",
        timeout=120.0,
    )

    # Truncate if needed (conservative against 200k context)
    max_text_length = 100000
    truncated_text = pdf_text[:max_text_length]
    if len(pdf_text) > max_text_length:
        truncated_text += "\n\n[Text truncated due to length...]"

    prompt = MARKET_RESEARCH_PROMPT.format(pdf_text=truncated_text)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=16384,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return parse_json_response(response_text)

    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse Claude API response as JSON: {str(e)}")
    except anthropic.APIError as e:
        raise Exception(f"Claude API error: {str(e)}")


# ---------------------------------------------------------------------------
# Record creation helpers
# ---------------------------------------------------------------------------

def _store_comps(
    comps: list,
    document_id: int,
    user_id: str,
    db: Session,
    warnings: List[str],
) -> int:
    """Create SalesComp records from extracted comp data. Returns count created."""
    if not comps or not isinstance(comps, list):
        return 0

    count = 0
    for raw in comps:
        if not isinstance(raw, dict):
            continue

        # Parse sale_date
        sale_date = None
        raw_date = raw.get("sale_date")
        if raw_date:
            for fmt in ("%Y-%m-%d", "%Y-%m"):
                try:
                    sale_date = datetime.strptime(raw_date, fmt)
                    break
                except (ValueError, TypeError):
                    pass

        # Normalize cap rate: if > 1, assume percentage and divide by 100
        cap_rate = raw.get("cap_rate")
        if cap_rate is not None:
            try:
                cap_rate = float(cap_rate)
                if cap_rate > 1:
                    cap_rate = cap_rate / 100.0
            except (ValueError, TypeError):
                cap_rate = None

        # Build address from components if address not directly provided
        address = raw.get("address")
        if not address:
            parts = [p for p in [raw.get("city"), raw.get("state")] if p]
            address = ", ".join(parts) if parts else None

        comp = SalesComp(
            document_id=document_id,
            user_id=user_id,
            property_name=raw.get("property_name"),
            metro=raw.get("metro"),
            submarket=raw.get("submarket"),
            state=raw.get("state"),
            address=address,
            property_type=raw.get("asset_class"),
            sale_date=sale_date,
            year_built=raw.get("year_built"),
            units=raw.get("units"),
            sale_price=raw.get("price_total"),
            price_per_unit=raw.get("price_per_unit"),
            cap_rate=cap_rate,
            buyer=raw.get("buyer"),
            seller=raw.get("seller"),
            notes=raw.get("notes"),
        )
        db.add(comp)
        count += 1

    if count > 0:
        db.flush()
        logger.info(f"Created {count} SalesComp records from market research")

    return count


def _store_signals(
    signals: list,
    document_id: int,
    user_id: str,
    db: Session,
    warnings: List[str],
) -> int:
    """Create MarketSentimentSignal records from extracted signal data. Returns count created."""
    if not signals or not isinstance(signals, list):
        return 0

    valid_signal_types = {
        "absorption", "supply_pipeline", "construction_starts", "rent_growth",
        "occupancy", "concessions", "employment", "population", "cap_rate_trend",
        "buyer_demand", "seller_motivation", "debt_market", "regulatory", "other",
    }
    valid_directions = {"positive", "negative", "neutral", "mixed"}
    valid_magnitudes = {"strong", "moderate", "slight"}

    count = 0
    for raw in signals:
        if not isinstance(raw, dict):
            continue

        # Validate required fields
        narrative = raw.get("narrative_summary")
        if not narrative:
            continue

        signal_type = raw.get("signal_type", "other")
        if signal_type not in valid_signal_types:
            signal_type = "other"

        direction = raw.get("direction", "neutral")
        if direction not in valid_directions:
            direction = "neutral"

        magnitude = raw.get("magnitude", "moderate")
        if magnitude not in valid_magnitudes:
            magnitude = "moderate"

        signal = MarketSentimentSignal(
            document_id=document_id,
            user_id=user_id,
            signal_type=signal_type,
            geography_source_label=raw.get("geography_source_label"),
            geography_metro=raw.get("geography_metro"),
            geography_submarket=raw.get("geography_submarket"),
            direction=direction,
            magnitude=magnitude,
            time_reference=raw.get("time_reference"),
            quantitative_value=raw.get("quantitative_value"),
            narrative_summary=narrative,
            verbatim_excerpt=raw.get("verbatim_excerpt"),
            confidence=raw.get("confidence", "medium"),
        )
        db.add(signal)
        count += 1

    if count > 0:
        db.flush()
        logger.info(f"Created {count} MarketSentimentSignal records from market research")

    return count
