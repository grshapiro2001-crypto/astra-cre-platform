import json
from typing import Generator
from datetime import datetime, timedelta

from anthropic import Anthropic
from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import Session

from app.config import settings
from app.models.property import Property, RentRollUnit
from app.services.scoring_service import calculate_deal_score, _extract_property_data, get_user_weights

client = Anthropic(
    api_key=settings.ANTHROPIC_API_KEY,
    base_url="https://api.anthropic.com",
)

SYSTEM_PROMPT = """You are the Talisman AI analyst — an expert multifamily commercial real estate investment analyst embedded in the Talisman IO platform. You are also a fully capable AI assistant that can answer ANY question.

DEAL DATA: You have tools to query the user's property data, financials, rent rolls, and deal scores. Use them to answer deal-specific questions precisely.

GENERAL KNOWLEDGE: For market data, interest rates, news, general knowledge, or anything outside the user's deal data, use web search. You have full access to the web.

COMBINED QUERIES: When a question bridges both (e.g., "how does my cap rate compare to current market cap rates?"), use both your deal tools AND web search.

CRE CONVENTIONS:
- Always specify financial period (T12, T3, or Y1) when discussing financials
- Format currency with $ and commas, percentages with 1-2 decimal places
- NOI = Net Operating Income = Total Revenue - Total Operating Expenses
- Cap Rate = NOI / Purchase Price
- Loss to Lease = (Market Rent - In-Place Rent) / Market Rent
- DSCR = Debt Service Coverage Ratio
- GSR = Gross Scheduled Rent, EGI = Effective Gross Income
- OpEx Ratio = Total Operating Expenses / GSR

When presenting comparisons across properties, use clean markdown tables. Be concise and data-driven. Never fabricate metrics — if data is missing, say so."""

TALISMAN_TOOLS = [
    {
        "name": "search_properties",
        "description": "Search the user's properties by name, address, or submarket. Use this first to find a property when the user refers to it by name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term — property name, address fragment, or submarket name"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_property_details",
        "description": "Get full details for a specific property including address, units, year built, occupancy, rents, NOI, scores, and all available metrics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {
                    "type": "integer",
                    "description": "The property ID (get this from search_properties first)"
                }
            },
            "required": ["property_id"]
        }
    },
    {
        "name": "get_financials",
        "description": "Get detailed financial data for a property for a specific period. Returns line-item revenue and expense breakdown.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {
                    "type": "integer",
                    "description": "The property ID"
                },
                "period": {
                    "type": "string",
                    "enum": ["t12", "t3", "y1"],
                    "description": "Financial period: t12 (trailing 12 months), t3 (trailing 3 months annualized), y1 (year 1 proforma)"
                }
            },
            "required": ["property_id", "period"]
        }
    },
    {
        "name": "get_rent_roll",
        "description": "Get unit-level rent roll data for a property. Can filter by occupancy status, rent range, or lease expiration.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {
                    "type": "integer",
                    "description": "The property ID"
                },
                "status_filter": {
                    "type": "string",
                    "enum": ["all", "occupied", "vacant"],
                    "description": "Filter by occupancy status. Default: all"
                },
                "expiring_within_days": {
                    "type": "integer",
                    "description": "Only return units with leases expiring within this many days from today"
                }
            },
            "required": ["property_id"]
        }
    },
    {
        "name": "get_deal_score",
        "description": "Get the deal score (0-100) and component breakdown for a property.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {
                    "type": "integer",
                    "description": "The property ID"
                }
            },
            "required": ["property_id"]
        }
    },
    {
        "name": "list_all_properties",
        "description": "List all properties in the user's account with summary metrics. Use this for portfolio-wide questions or when the user wants to compare across deals.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sort_by": {
                    "type": "string",
                    "enum": ["deal_name", "total_units", "average_inplace_rent", "average_market_rent", "t12_noi", "physical_occupancy", "loss_to_lease_pct", "score", "year_built"],
                    "description": "Field to sort by. Default: deal_name"
                },
                "sort_order": {
                    "type": "string",
                    "enum": ["asc", "desc"],
                    "description": "Sort direction. Default: desc"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of results. Default: 20"
                }
            },
            "required": []
        }
    },
    {
        "name": "compare_properties",
        "description": "Compare specific metrics across 2 or more properties side by side.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "List of property IDs to compare"
                },
                "metrics": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["total_units", "year_built", "average_inplace_rent", "average_market_rent", "physical_occupancy", "loss_to_lease_pct", "t12_noi", "t3_noi", "y1_noi", "total_revenue", "total_expenses", "expense_ratio", "score"]
                    },
                    "description": "Which metrics to include in the comparison"
                }
            },
            "required": ["property_ids", "metrics"]
        }
    }
]

WEB_SEARCH_TOOL = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 5,
}


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


# Mapping from compare_properties metric names to actual Property model fields
_METRIC_FIELD_MAP = {
    "total_units": "total_units",
    "year_built": "year_built",
    "average_inplace_rent": "average_inplace_rent",
    "average_market_rent": "average_market_rent",
    "physical_occupancy": "rr_physical_occupancy_pct",
    "loss_to_lease_pct": "rr_loss_to_lease_pct",
    "t12_noi": "t12_noi",
    "t3_noi": "t3_noi",
    "y1_noi": "y1_noi",
    "total_revenue": "t12_revenue",
    "total_expenses": "t12_total_expenses",
    "expense_ratio": "t12_expense_ratio_pct",
}

# Mapping for list_all_properties sort fields
_SORT_FIELD_MAP = {
    "deal_name": "deal_name",
    "total_units": "total_units",
    "average_inplace_rent": "average_inplace_rent",
    "average_market_rent": "average_market_rent",
    "t12_noi": "t12_noi",
    "physical_occupancy": "rr_physical_occupancy_pct",
    "loss_to_lease_pct": "rr_loss_to_lease_pct",
    "year_built": "year_built",
    # "score" handled specially since it's computed dynamically
}


def execute_tool(tool_name: str, tool_input: dict, db: Session, org_id: int, user_id: str) -> str:
    """Route tool calls to the appropriate handler. Returns JSON string."""
    handlers = {
        "search_properties": _search_properties,
        "get_property_details": _get_property_details,
        "get_financials": _get_financials,
        "get_rent_roll": _get_rent_roll,
        "get_deal_score": _get_deal_score,
        "list_all_properties": _list_all_properties,
        "compare_properties": _compare_properties,
    }
    handler = handlers.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = handler(db, org_id, user_id, tool_input)
        return json.dumps(result, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _get_org_property(db: Session, org_id: int, property_id: int):
    """Load a property by ID, verifying it belongs to the user's org."""
    return db.query(Property).filter(
        Property.id == property_id,
        or_(Property.organization_id == org_id, Property.organization_id.is_(None)),
    ).first()


def _search_properties(db: Session, org_id: int, user_id: str, tool_input: dict) -> list:
    query_str = tool_input["query"]
    search_term = f"%{query_str}%"
    props = db.query(Property).filter(
        or_(Property.organization_id == org_id, Property.organization_id.is_(None)),
        or_(
            Property.deal_name.ilike(search_term),
            Property.property_address.ilike(search_term),
            Property.submarket.ilike(search_term),
        ),
    ).all()
    return [
        {
            "id": p.id,
            "deal_name": p.deal_name,
            "address": p.property_address,
            "total_units": p.total_units,
            "submarket": p.submarket,
        }
        for p in props
    ]


def _get_property_details(db: Session, org_id: int, user_id: str, tool_input: dict) -> dict:
    prop = _get_org_property(db, org_id, tool_input["property_id"])
    if not prop:
        return {"error": "Property not found or access denied"}
    return {
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
        "t12_noi": prop.t12_noi,
        "t3_noi": prop.t3_noi,
        "y1_noi": prop.y1_noi,
        "physical_occupancy": prop.rr_physical_occupancy_pct,
        "loss_to_lease_pct": prop.rr_loss_to_lease_pct,
        "document_type": prop.document_type,
        "document_subtype": prop.document_subtype,
        "upload_date": prop.upload_date,
        "analysis_status": prop.analysis_status,
        "rent_roll_date": prop.rr_as_of_date,
        "expense_ratio": prop.t12_expense_ratio_pct,
        "total_revenue": prop.t12_revenue,
        "total_expenses": prop.t12_total_expenses,
        "screening_verdict": prop.screening_verdict,
        "screening_score": prop.screening_score,
        "pipeline_stage": prop.pipeline_stage,
    }


def _get_financials(db: Session, org_id: int, user_id: str, tool_input: dict) -> dict:
    prop = _get_org_property(db, org_id, tool_input["property_id"])
    if not prop:
        return {"error": "Property not found or access denied"}
    period = tool_input["period"]
    field_map = {
        "t12": ("t12_financials_json", "t12_noi"),
        "t3": ("t3_financials_json", "t3_noi"),
        "y1": ("y1_financials_json", "y1_noi"),
    }
    json_field, noi_field = field_map[period]
    financials = _parse_json_field(getattr(prop, json_field))
    noi = getattr(prop, noi_field)
    return {
        "property_id": prop.id,
        "deal_name": prop.deal_name,
        "period": period,
        "noi": noi,
        "financials": financials,
    }


def _get_rent_roll(db: Session, org_id: int, user_id: str, tool_input: dict) -> dict:
    prop = _get_org_property(db, org_id, tool_input["property_id"])
    if not prop:
        return {"error": "Property not found or access denied"}

    units_query = db.query(RentRollUnit).filter(
        RentRollUnit.property_id == prop.id,
    ).order_by(RentRollUnit.id.desc())

    units = units_query.all()

    # Deduplicate by unit_number (keep newest)
    seen = set()
    deduped = []
    for unit in units:
        key = unit.unit_number
        if key in seen:
            continue
        seen.add(key)
        deduped.append(unit)

    # Apply filters
    status_filter = tool_input.get("status_filter", "all")
    if status_filter == "occupied":
        deduped = [u for u in deduped if u.is_occupied]
    elif status_filter == "vacant":
        deduped = [u for u in deduped if not u.is_occupied]

    expiring_days = tool_input.get("expiring_within_days")
    if expiring_days is not None:
        cutoff = datetime.now() + timedelta(days=expiring_days)
        deduped = [u for u in deduped if u.lease_end and u.lease_end <= cutoff]

    # Sort by unit number
    deduped.sort(key=lambda u: u.unit_number or "")

    # Summary stats
    total = len(deduped)
    occupied = sum(1 for u in deduped if u.is_occupied)
    vacant = total - occupied
    in_place_rents = [u.in_place_rent for u in deduped if u.in_place_rent is not None]
    market_rents = [u.market_rent for u in deduped if u.market_rent is not None]

    unit_list = [
        {
            "unit_number": u.unit_number,
            "unit_type": u.unit_type,
            "sqft": u.sqft,
            "status": u.status,
            "is_occupied": u.is_occupied,
            "market_rent": u.market_rent,
            "in_place_rent": u.in_place_rent,
            "lease_start": u.lease_start,
            "lease_end": u.lease_end,
            "charge_details": u.charge_details,
        }
        for u in deduped
    ]

    return {
        "property_id": prop.id,
        "deal_name": prop.deal_name,
        "summary": {
            "total_units": total,
            "occupied": occupied,
            "vacant": vacant,
            "avg_in_place_rent": round(sum(in_place_rents) / len(in_place_rents), 2) if in_place_rents else None,
            "avg_market_rent": round(sum(market_rents) / len(market_rents), 2) if market_rents else None,
        },
        "units": unit_list,
    }


def _get_deal_score(db: Session, org_id: int, user_id: str, tool_input: dict) -> dict:
    prop = _get_org_property(db, org_id, tool_input["property_id"])
    if not prop:
        return {"error": "Property not found or access denied"}
    try:
        property_data = _extract_property_data(prop, db)
        weights = get_user_weights(user_id, db)
        score_result = calculate_deal_score(property_data, weights, user_id, db)
        return {
            "property_id": prop.id,
            "deal_name": prop.deal_name,
            "score": score_result,
        }
    except Exception as e:
        return {"error": f"Could not compute deal score: {e}"}


def _list_all_properties(db: Session, org_id: int, user_id: str, tool_input: dict) -> list:
    sort_by = tool_input.get("sort_by", "deal_name")
    sort_order = tool_input.get("sort_order", "desc")
    limit = tool_input.get("limit", 20)

    query = db.query(Property).filter(
        or_(Property.organization_id == org_id, Property.organization_id.is_(None)),
    )

    # Apply sort (skip "score" — it's computed dynamically)
    model_field = _SORT_FIELD_MAP.get(sort_by)
    if model_field:
        col = getattr(Property, model_field)
        query = query.order_by(desc(col) if sort_order == "desc" else asc(col))
    else:
        query = query.order_by(desc(Property.deal_name))

    props = query.limit(limit).all()

    return [
        {
            "id": p.id,
            "deal_name": p.deal_name,
            "property_address": p.property_address,
            "submarket": p.submarket,
            "total_units": p.total_units,
            "year_built": p.year_built,
            "average_inplace_rent": p.average_inplace_rent,
            "average_market_rent": p.average_market_rent,
            "physical_occupancy": p.rr_physical_occupancy_pct,
            "loss_to_lease_pct": p.rr_loss_to_lease_pct,
            "t12_noi": p.t12_noi,
            "t3_noi": p.t3_noi,
            "y1_noi": p.y1_noi,
            "pipeline_stage": p.pipeline_stage,
        }
        for p in props
    ]


def _compare_properties(db: Session, org_id: int, user_id: str, tool_input: dict) -> dict:
    property_ids = tool_input["property_ids"]
    metrics = tool_input["metrics"]

    props = db.query(Property).filter(
        Property.id.in_(property_ids),
        or_(Property.organization_id == org_id, Property.organization_id.is_(None)),
    ).all()

    if not props:
        return {"error": "No matching properties found"}

    comparison = {}
    for prop in props:
        prop_data = {"id": prop.id, "deal_name": prop.deal_name}
        for metric in metrics:
            if metric == "score":
                # Compute score dynamically
                try:
                    pd = _extract_property_data(prop, db)
                    weights = get_user_weights(user_id, db)
                    result = calculate_deal_score(pd, weights, user_id, db)
                    prop_data["score"] = result.get("total_score")
                except Exception:
                    prop_data["score"] = None
            else:
                model_field = _METRIC_FIELD_MAP.get(metric, metric)
                val = getattr(prop, model_field, None)
                # Convert Decimal types to float for JSON serialization
                if val is not None and hasattr(val, '__float__'):
                    val = float(val)
                prop_data[metric] = val
        comparison[prop.id] = prop_data

    return comparison


def chat_with_tools(
    message: str,
    conversation_history: list[dict],
    db: Session,
    org_id: int,
    property_id: int | None = None,
    user_id: str | None = None,
) -> Generator[str, None, None]:
    """
    Agentic chat loop with tool use + web search.
    Yields text chunks for SSE streaming.
    """
    # Build messages from history
    messages = []
    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # If scoped to a property, prepend context hint
    if property_id:
        prop = db.query(Property).filter(
            Property.id == property_id,
            or_(Property.organization_id == org_id, Property.organization_id.is_(None)),
        ).first()
        if prop:
            context_hint = f"[The user is currently viewing: {prop.deal_name} (ID: {prop.id}, {prop.property_address}). If they ask about 'this property' or 'this deal', they mean this one.]"
            message = f"{context_hint}\n\n{message}"

    messages.append({"role": "user", "content": message})

    # Combine custom tools + web search
    all_tools = TALISMAN_TOOLS + [WEB_SEARCH_TOOL]

    MAX_TOOL_ROUNDS = 10  # Safety limit

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            messages=messages,
            tools=all_tools,
        )

        # Check if Claude wants to use tools
        if response.stop_reason == "tool_use":
            # Append Claude's response (with tool_use blocks) to messages
            messages.append({"role": "assistant", "content": response.content})

            # Process each tool call
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = execute_tool(
                        block.name, block.input, db, org_id, user_id or "",
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            # Add tool results to messages
            messages.append({"role": "user", "content": tool_results})
            continue  # Loop back for Claude to process results

        # Final response — yield text in small chunks for smooth streaming
        for block in response.content:
            if hasattr(block, 'text'):
                text = block.text
                # Chunk by words to avoid breaking mid-word
                words = text.split(' ')
                chunk = ''
                for word in words:
                    chunk += (' ' if chunk else '') + word
                    # Yield every ~4-6 words for smooth rendering
                    if len(chunk) >= 30:
                        yield chunk
                        chunk = ''
                if chunk:  # Yield remaining text
                    yield chunk
        break
    else:
        yield "I hit the maximum number of tool calls. Please try a simpler question."
