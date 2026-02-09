"""
Scoring service - Deal score calculation (NO LLM CALLS)

Calculates a 0-100 deal score based on four financial metrics:
  1. Cap Rate (T12 NOI / implied value)
  2. Economic Occupancy ((GSR - vacancy - concessions - bad_debt) / GSR)
  3. Loss to Lease ((market_rent - inplace_rent) / market_rent)
  4. OpEx Ratio (total_opex / GSR)

Each metric is scored 0-100 against CRE benchmark ranges,
then combined using user-configurable weights.
"""
import json
from typing import Optional
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.scoring import UserScoringWeights


# ============================================================
# BENCHMARK RANGES
# ============================================================
# Each benchmark defines the "ideal" and "worst" values for scoring.
# Scores are linearly interpolated between these bounds, clamped to [0, 100].
#
# For "lower is better" metrics (cap_rate, opex_ratio, loss_to_lease):
#   score = 100 when value <= ideal, score = 0 when value >= worst
# For "higher is better" metrics (economic_occupancy):
#   score = 100 when value >= ideal, score = 0 when value <= worst

BENCHMARKS = {
    "cap_rate": {
        # Cap rate: lower means more expensive / lower risk
        # 4% = premium asset (score 100), 9% = distressed (score 0)
        "ideal": 4.0,
        "worst": 9.0,
        "direction": "lower_is_better",
        "label": "Cap Rate",
        "unit": "%",
    },
    "economic_occupancy": {
        # Economic occupancy: higher is better
        # 97% = excellent (score 100), 80% = weak (score 0)
        "ideal": 97.0,
        "worst": 80.0,
        "direction": "higher_is_better",
        "label": "Economic Occupancy",
        "unit": "%",
    },
    "loss_to_lease": {
        # Loss to lease: lower means rents are closer to market
        # 0% = fully at market (score 100), 15% = significant upside (score 0 for current ops quality)
        "ideal": 0.0,
        "worst": 15.0,
        "direction": "lower_is_better",
        "label": "Loss to Lease",
        "unit": "%",
    },
    "opex_ratio": {
        # OpEx ratio: lower is more efficient
        # 35% = excellent (score 100), 60% = poor (score 0)
        "ideal": 35.0,
        "worst": 60.0,
        "direction": "lower_is_better",
        "label": "OpEx Ratio",
        "unit": "%",
    },
}

# Default weights (must sum to 1.0)
DEFAULT_WEIGHTS = {
    "cap_rate": 0.30,
    "economic_occupancy": 0.25,
    "loss_to_lease": 0.20,
    "opex_ratio": 0.25,
}

# Preset weight configurations
WEIGHT_PRESETS = {
    "balanced": {
        "label": "Balanced",
        "description": "Equal emphasis across all metrics",
        "weights": {
            "cap_rate": 0.30,
            "economic_occupancy": 0.25,
            "loss_to_lease": 0.20,
            "opex_ratio": 0.25,
        },
    },
    "income_focused": {
        "label": "Income Focused",
        "description": "Prioritizes cap rate and occupancy for income-oriented investors",
        "weights": {
            "cap_rate": 0.40,
            "economic_occupancy": 0.30,
            "loss_to_lease": 0.10,
            "opex_ratio": 0.20,
        },
    },
    "value_add": {
        "label": "Value-Add",
        "description": "Emphasizes loss-to-lease upside and operational efficiency",
        "weights": {
            "cap_rate": 0.20,
            "economic_occupancy": 0.20,
            "loss_to_lease": 0.35,
            "opex_ratio": 0.25,
        },
    },
    "stabilized": {
        "label": "Stabilized",
        "description": "Focuses on occupancy and low opex for core/core-plus assets",
        "weights": {
            "cap_rate": 0.25,
            "economic_occupancy": 0.35,
            "loss_to_lease": 0.10,
            "opex_ratio": 0.30,
        },
    },
}


# ============================================================
# METRIC EXTRACTION
# ============================================================

def _parse_financials(json_str: Optional[str]) -> Optional[dict]:
    """Parse financial period JSON string to dict."""
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return None


def extract_metrics(prop: Property) -> dict:
    """
    Extract the four scoring metrics from a Property record.

    Returns a dict with keys: cap_rate, economic_occupancy, loss_to_lease, opex_ratio.
    Values are floats (percentages) or None if data is insufficient.
    """
    t12 = _parse_financials(prop.t12_financials_json)

    result = {
        "cap_rate": None,
        "economic_occupancy": None,
        "loss_to_lease": None,
        "opex_ratio": None,
    }

    if t12:
        gsr = t12.get("gsr")
        vacancy = t12.get("vacancy") or 0
        concessions = t12.get("concessions") or 0
        bad_debt = t12.get("bad_debt") or 0
        total_opex = t12.get("total_opex")
        noi = t12.get("noi")

        # Economic Occupancy = (GSR - vacancy - concessions - bad_debt) / GSR * 100
        if gsr and gsr > 0:
            effective_income = gsr - vacancy - concessions - bad_debt
            result["economic_occupancy"] = round((effective_income / gsr) * 100, 2)

        # OpEx Ratio = total_opex / GSR * 100
        if gsr and gsr > 0 and total_opex is not None:
            result["opex_ratio"] = round((total_opex / gsr) * 100, 2)

        # Cap Rate: use T12 NOI / implied value
        # Since we may not have a purchase price, try to derive from BOV pricing
        # or use NOI-based proxy. For now, if we have opex_ratio from the extraction
        # service, use that. We can also check the extracted opex_ratio field.
        if noi and noi > 0 and prop.total_units and prop.total_units > 0:
            # Use a market-implied value based on average price per unit
            # This is a rough proxy; real cap rate needs actual pricing.
            # We'll mark cap_rate as None if no pricing data is available.
            pass

    # Loss to Lease = (market_rent - inplace_rent) / market_rent * 100
    if prop.average_market_rent and prop.average_inplace_rent and prop.average_market_rent > 0:
        ltl = (prop.average_market_rent - prop.average_inplace_rent) / prop.average_market_rent * 100
        result["loss_to_lease"] = round(max(ltl, 0), 2)  # Clamp to >= 0

    # Cap rate from BOV pricing tiers (if available)
    result["cap_rate"] = _extract_cap_rate(prop)

    return result


def _extract_cap_rate(prop: Property) -> Optional[float]:
    """
    Try to extract cap rate from BOV pricing tiers or compute from T12 NOI + pricing.
    Returns cap rate as a percentage (e.g. 5.25) or None.
    """
    from app.models.deal_folder import BOVPricingTier, BOVCapRate

    # First, try to get from the property's T12 NOI and any BOV pricing tier
    # We need a database session for this, so we'll use the object's session
    session = Session.object_session(prop)
    if not session:
        return None

    # Check BOV pricing tiers for cap rates
    tiers = session.query(BOVPricingTier).filter(
        BOVPricingTier.property_id == prop.id
    ).all()

    for tier in tiers:
        cap_rates = session.query(BOVCapRate).filter(
            BOVCapRate.pricing_tier_id == tier.id
        ).all()
        for cr in cap_rates:
            if cr.cap_rate_value and cr.cap_rate_type in ("trailing", "going_in", "t12"):
                return float(cr.cap_rate_value)

    # Fallback: if we have T12 NOI and a pricing tier with a total price, compute it
    if prop.t12_noi and prop.t12_noi > 0:
        for tier in tiers:
            if tier.pricing and tier.pricing > 0:
                cap_rate = (prop.t12_noi / tier.pricing) * 100
                return round(cap_rate, 2)

    return None


# ============================================================
# SCORE CALCULATION
# ============================================================

def calculate_metric_score(value: Optional[float], metric_name: str) -> Optional[float]:
    """
    Score a single metric 0-100 based on benchmark ranges.

    Args:
        value: The metric value (percentage), or None if unavailable.
        metric_name: One of "cap_rate", "economic_occupancy", "loss_to_lease", "opex_ratio".

    Returns:
        Score 0-100, or None if value is None.
    """
    if value is None:
        return None

    benchmark = BENCHMARKS.get(metric_name)
    if not benchmark:
        return None

    ideal = benchmark["ideal"]
    worst = benchmark["worst"]
    direction = benchmark["direction"]

    if direction == "lower_is_better":
        # Lower value = higher score
        if value <= ideal:
            return 100.0
        if value >= worst:
            return 0.0
        score = (worst - value) / (worst - ideal) * 100
    else:
        # Higher value = higher score
        if value >= ideal:
            return 100.0
        if value <= worst:
            return 0.0
        score = (value - worst) / (ideal - worst) * 100

    return round(max(0.0, min(100.0, score)), 1)


def calculate_deal_score(
    prop: Property,
    weights: Optional[dict] = None,
) -> dict:
    """
    Calculate the full deal score for a property.

    Args:
        prop: Property ORM object with financials loaded.
        weights: Dict of metric_name -> weight (must sum to ~1.0).
                 If None, uses DEFAULT_WEIGHTS.

    Returns:
        Dict with:
            - deal_score: float 0-100 (weighted average of available metrics)
            - metrics: dict of metric breakdowns
            - weights_used: the weights applied
            - scored_count: how many metrics had data
            - max_possible: how many metrics exist (4)
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS.copy()

    # Extract raw metric values from the property
    raw_metrics = extract_metrics(prop)

    # Score each metric
    breakdown = {}
    weighted_sum = 0.0
    weight_sum = 0.0

    for metric_name, benchmark_info in BENCHMARKS.items():
        raw_value = raw_metrics.get(metric_name)
        score = calculate_metric_score(raw_value, metric_name)
        weight = weights.get(metric_name, 0.0)

        breakdown[metric_name] = {
            "label": benchmark_info["label"],
            "raw_value": raw_value,
            "score": score,
            "weight": weight,
            "unit": benchmark_info["unit"],
            "benchmark_ideal": benchmark_info["ideal"],
            "benchmark_worst": benchmark_info["worst"],
        }

        if score is not None:
            weighted_sum += score * weight
            weight_sum += weight

    # Compute final deal score (re-normalize if some metrics are missing)
    if weight_sum > 0:
        deal_score = round(weighted_sum / weight_sum, 1)
    else:
        deal_score = None

    scored_count = sum(1 for m in breakdown.values() if m["score"] is not None)

    return {
        "deal_score": deal_score,
        "metrics": breakdown,
        "weights_used": weights,
        "scored_count": scored_count,
        "max_possible": len(BENCHMARKS),
        "market_sentiment": {
            "score": prop.market_sentiment_score,
            "rationale": prop.market_sentiment_rationale,
            "updated_at": str(prop.market_sentiment_updated_at) if prop.market_sentiment_updated_at else None,
        },
    }


# ============================================================
# USER WEIGHTS HELPERS
# ============================================================

def get_user_weights(db: Session, user_id: str) -> dict:
    """Get user's scoring weights, creating defaults if none exist."""
    record = db.query(UserScoringWeights).filter(
        UserScoringWeights.user_id == user_id
    ).first()

    if not record:
        return {
            "cap_rate": DEFAULT_WEIGHTS["cap_rate"],
            "economic_occupancy": DEFAULT_WEIGHTS["economic_occupancy"],
            "loss_to_lease": DEFAULT_WEIGHTS["loss_to_lease"],
            "opex_ratio": DEFAULT_WEIGHTS["opex_ratio"],
            "preset_name": "balanced",
        }

    return {
        "cap_rate": record.weight_cap_rate,
        "economic_occupancy": record.weight_economic_occupancy,
        "loss_to_lease": record.weight_loss_to_lease,
        "opex_ratio": record.weight_opex_ratio,
        "preset_name": record.preset_name,
    }


def save_user_weights(db: Session, user_id: str, weights: dict, preset_name: Optional[str] = None) -> dict:
    """Save user's scoring weights (upsert)."""
    record = db.query(UserScoringWeights).filter(
        UserScoringWeights.user_id == user_id
    ).first()

    if not record:
        record = UserScoringWeights(user_id=user_id)
        db.add(record)

    record.weight_cap_rate = weights["cap_rate"]
    record.weight_economic_occupancy = weights["economic_occupancy"]
    record.weight_loss_to_lease = weights["loss_to_lease"]
    record.weight_opex_ratio = weights["opex_ratio"]
    record.preset_name = preset_name or "custom"

    db.commit()
    db.refresh(record)

    return {
        "cap_rate": record.weight_cap_rate,
        "economic_occupancy": record.weight_economic_occupancy,
        "loss_to_lease": record.weight_loss_to_lease,
        "opex_ratio": record.weight_opex_ratio,
        "preset_name": record.preset_name,
    }
