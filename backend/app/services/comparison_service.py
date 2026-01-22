"""
Property Comparison Service
NO LLM - Pure database operations
Phase 3B
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.deal_folder import BOVPricingTier, BOVCapRate
from app.services.property_service import parse_financial_period


def get_comparison_data(
    db: Session,
    property_ids: List[int],
    user_id: str
) -> Dict:
    """
    Fetch and prepare comparison data for multiple properties
    NO LLM - Pure database query
    """
    # 1. Fetch properties (with ownership check)
    properties = db.query(Property).filter(
        Property.id.in_(property_ids),
        Property.user_id == user_id
    ).all()

    if len(properties) != len(property_ids):
        raise ValueError("Some properties not found or don't belong to user")

    # 2. Build comparison data for each property
    comparison_items = []
    for prop in properties:
        item = build_comparison_item(db, prop)
        comparison_items.append(item)

    # 3. Identify best values
    best_values = identify_best_values(comparison_items)

    return {
        "properties": comparison_items,
        "best_values": best_values
    }


def build_comparison_item(db: Session, prop: Property) -> Dict:
    """Build comparison data for a single property"""

    # Parse financials (returns Pydantic models, convert to dicts)
    t12_model = parse_financial_period(prop.t12_financials_json)
    y1_model = parse_financial_period(prop.y1_financials_json)

    # Convert Pydantic models to dicts for easier access
    t12 = t12_model.dict() if t12_model else None
    y1 = y1_model.dict() if y1_model else None

    # Get market tier BOV data (if BOV document)
    market_tier = None
    if prop.document_type == "BOV" or prop.document_subtype == "BOV":
        market_tier = db.query(BOVPricingTier).filter(
            BOVPricingTier.property_id == prop.id,
            BOVPricingTier.tier_type == "market_assumption"
        ).first()

    # Build pricing data
    pricing = build_pricing_data(prop, market_tier)

    # Build cap rates
    cap_rates = build_cap_rates(db, t12, y1, market_tier)

    # Build BOV returns (only for BOVs)
    bov_returns = build_bov_returns(market_tier) if market_tier else None

    # Build financials
    financials = build_financials(t12, y1)

    # Build operations
    operations = build_operations(t12, prop.total_units)

    return {
        "id": prop.id,
        "property_name": prop.deal_name,
        "document_type": prop.document_type,
        "property_type": prop.property_type,
        "property_address": prop.property_address,
        "submarket": prop.submarket,
        "total_units": prop.total_units,
        "total_sf": prop.total_residential_sf,
        "year_built": prop.year_built,
        "pricing": pricing,
        "cap_rates": cap_rates,
        "bov_returns": bov_returns,
        "financials": financials,
        "operations": operations
    }


def build_pricing_data(prop: Property, market_tier: Optional[BOVPricingTier]) -> Dict:
    """Extract pricing from BOV market tier or property fields"""
    if market_tier:
        return {
            "price": market_tier.pricing,
            "price_per_unit": market_tier.price_per_unit,
            "price_per_sf": float(market_tier.price_per_sf) if market_tier.price_per_sf else None
        }
    return {
        "price": None,
        "price_per_unit": None,
        "price_per_sf": None
    }


def build_cap_rates(
    db: Session,
    t12: Optional[Dict],
    y1: Optional[Dict],
    market_tier: Optional[BOVPricingTier]
) -> Dict:
    """Extract cap rates from BOV tier or calculate from financials"""
    going_in = None
    stabilized = None

    if market_tier:
        # Get cap rates from BOV tier
        cap_rates = db.query(BOVCapRate).filter(
            BOVCapRate.pricing_tier_id == market_tier.id
        ).all()

        for cr in cap_rates:
            cap_type_lower = cr.cap_rate_type.lower() if cr.cap_rate_type else ""
            if any(term in cap_type_lower for term in ["trailing", "t12", "t-12"]):
                going_in = float(cr.cap_rate_value) if cr.cap_rate_value else None
            elif any(term in cap_type_lower for term in ["stabilized", "y1", "proforma"]):
                stabilized = float(cr.cap_rate_value) if cr.cap_rate_value else None

    return {
        "going_in": going_in,
        "stabilized": stabilized
    }


def build_bov_returns(market_tier: BOVPricingTier) -> Dict:
    """Extract return metrics from BOV market tier"""
    return {
        "tier_name": market_tier.tier_label or "Market Assumptions",
        "levered_irr": float(market_tier.levered_irr) if market_tier.levered_irr else None,
        "unlevered_irr": float(market_tier.unlevered_irr) if market_tier.unlevered_irr else None,
        "equity_multiple": float(market_tier.equity_multiple) if market_tier.equity_multiple else None
    }


def build_financials(t12: Optional[Dict], y1: Optional[Dict]) -> Dict:
    """Calculate financial metrics"""
    t12_noi = t12.get("noi") if t12 else None
    y1_noi = y1.get("noi") if y1 else None

    # Calculate NOI growth %
    noi_growth_pct = None
    if t12_noi and y1_noi and t12_noi > 0:
        noi_growth_pct = round(((y1_noi - t12_noi) / t12_noi) * 100, 1)

    return {
        "t12_noi": int(t12_noi) if t12_noi else None,
        "y1_noi": int(y1_noi) if y1_noi else None,
        "noi_growth_pct": noi_growth_pct
    }


def build_operations(t12: Optional[Dict], total_units: Optional[int]) -> Dict:
    """Calculate operational metrics"""
    opex_ratio = t12.get("opex_ratio") if t12 else None

    # Calculate OpEx per unit
    opex_per_unit = None
    if t12 and total_units:
        t12_opex = t12.get("total_opex")
        if t12_opex:
            opex_per_unit = int(t12_opex / total_units)

    return {
        "opex_ratio": opex_ratio,
        "opex_per_unit": opex_per_unit
    }


def identify_best_values(comparison_items: List[Dict]) -> Dict:
    """Identify best values across all properties for highlighting"""
    best = {}

    # Helper to find min/max with property ID
    def find_best(metric_path: str, is_higher_better: bool):
        values = []
        for item in comparison_items:
            # Navigate nested dict path like "pricing.price_per_unit"
            val = item
            for key in metric_path.split('.'):
                val = val.get(key) if isinstance(val, dict) else None
                if val is None:
                    break
            if val is not None:
                values.append((item["id"], val))

        if values:
            if is_higher_better:
                return max(values, key=lambda x: x[1])[0]
            else:
                return min(values, key=lambda x: x[1])[0]
        return None

    # Price metrics (lower is better)
    best["best_price_per_unit"] = find_best("pricing.price_per_unit", False)
    best["best_price_per_sf"] = find_best("pricing.price_per_sf", False)

    # Cap rates (higher is better)
    best["best_going_in_cap"] = find_best("cap_rates.going_in", True)
    best["best_stabilized_cap"] = find_best("cap_rates.stabilized", True)

    # Returns (higher is better)
    best["best_levered_irr"] = find_best("bov_returns.levered_irr", True)
    best["best_unlevered_irr"] = find_best("bov_returns.unlevered_irr", True)
    best["best_equity_multiple"] = find_best("bov_returns.equity_multiple", True)

    # NOI growth (higher is better)
    best["best_noi_growth"] = find_best("financials.noi_growth_pct", True)

    # OpEx (lower is better)
    best["lowest_opex_ratio"] = find_best("operations.opex_ratio", False)
    best["lowest_opex_per_unit"] = find_best("operations.opex_per_unit", False)

    return best
