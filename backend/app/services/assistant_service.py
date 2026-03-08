import json
import anthropic
from sqlalchemy.orm import Session

from sqlalchemy import or_

from app.config import settings
from app.models.property import Property, RentRollUnit

client = anthropic.Anthropic(
    api_key=settings.ANTHROPIC_API_KEY,
    base_url="https://api.anthropic.com",
)

SYSTEM_PROMPT_TEMPLATE = """You are ASTRA AI, an expert commercial real estate (CRE) investment analyst. You have access to the user's deal data below.

Rules:
- Always reference specific numbers from the data when answering.
- Never fabricate metrics — if data is missing, say so.
- Format financials with $ and %, using commas for thousands.
- Be concise and data-driven.

Capabilities:
- Drill into unit-level rent roll data (when available for a single property).
- Perform underwriting math: cap rate pricing, NOI calculations, per-unit metrics, rent growth projections.
- Compare deals across the portfolio.
- Explain CRE concepts clearly.
- When computing derived metrics (e.g. purchase price at a given cap rate), show the formula and inputs.
- For unit-level queries, present results as clean tables or ranked lists.

--- DEAL DATA ---
{deal_context}
--- END DEAL DATA ---"""


def _parse_json_field(value):
    """Parse a JSON string field, returning the parsed dict/list or None."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def build_deal_context(db: Session, org_id: int, property_id=None, deal_folder_id=None) -> str:
    query = db.query(Property).filter(
        or_(Property.organization_id == org_id, Property.organization_id.is_(None))
    )

    if property_id is not None:
        query = query.filter(Property.id == property_id)
    elif deal_folder_id is not None:
        query = query.filter(Property.deal_folder_id == deal_folder_id)

    properties = query.all()

    if not properties:
        return "No properties found."

    is_single = property_id is not None and len(properties) == 1

    if is_single:
        scope = "1 property — FULL DATA including rent roll"
    else:
        scope = f"{len(properties)} properties — summary level"

    result_parts = [f"Scope: {scope}\n"]

    for prop in properties:
        data = {
            "id": prop.id,
            "deal_name": prop.deal_name,
            "property_address": prop.property_address,
            "property_type": prop.property_type,
            "submarket": prop.submarket,
            "year_built": prop.year_built,
            "total_units": prop.total_units,
            "total_residential_sf": prop.total_residential_sf,
            "average_market_rent": prop.average_market_rent,
            "average_inplace_rent": prop.average_inplace_rent,
            "document_type": prop.document_type,
            "t12_noi": prop.t12_noi,
            "t3_noi": prop.t3_noi,
            "y1_noi": prop.y1_noi,
            "t12_financials": _parse_json_field(prop.t12_financials_json),
            "t3_financials": _parse_json_field(prop.t3_financials_json),
            "y1_financials": _parse_json_field(prop.y1_financials_json),
        }

        if is_single:
            # Include rent roll summary fields
            data["rr_total_units"] = prop.rr_total_units
            data["rr_occupied_units"] = prop.rr_occupied_units
            data["rr_vacancy_count"] = prop.rr_vacancy_count
            data["rr_physical_occupancy_pct"] = prop.rr_physical_occupancy_pct
            data["rr_avg_market_rent"] = prop.rr_avg_market_rent
            data["rr_avg_in_place_rent"] = prop.rr_avg_in_place_rent
            data["rr_avg_sqft"] = prop.rr_avg_sqft
            data["rr_loss_to_lease_pct"] = prop.rr_loss_to_lease_pct

            # Query unit-level rent roll data, deduplicated by unit_number (newest first)
            units = (
                db.query(RentRollUnit)
                .filter(RentRollUnit.property_id == prop.id)
                .order_by(RentRollUnit.id.desc())
                .all()
            )
            seen = set()
            deduped_units = []
            for unit in units:
                key = unit.unit_number
                if key in seen:
                    continue
                seen.add(key)
                deduped_units.append({
                    "unit_number": unit.unit_number,
                    "unit_type": unit.unit_type,
                    "sqft": unit.sqft,
                    "status": unit.status,
                    "is_occupied": unit.is_occupied,
                    "market_rent": unit.market_rent,
                    "in_place_rent": unit.in_place_rent,
                    "lease_start": str(unit.lease_start) if unit.lease_start else None,
                    "lease_end": str(unit.lease_end) if unit.lease_end else None,
                    "charge_details": unit.charge_details,
                })
            # Sort by unit_number for consistent ordering
            deduped_units.sort(key=lambda u: u["unit_number"] or "")
            data["rent_roll_units"] = deduped_units

        result_parts.append(json.dumps(data, indent=2, default=str))

    return "\n\n".join(result_parts)


def stream_chat_response(message, conversation_history, db, org_id, property_id=None, deal_folder_id=None):
    deal_context = build_deal_context(db, org_id, property_id=property_id, deal_folder_id=deal_folder_id)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(deal_context=deal_context)

    messages = []
    for msg in conversation_history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": message})

    with client.messages.stream(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
