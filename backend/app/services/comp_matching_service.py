"""
Comp Matching Service — Layer 3 of Deal Score v2

Implements relevance-based comp selection and cap rate / price / vintage scoring
against a user's uploaded sales comp data bank.
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.data_bank import SalesComp


# ==================== PROPERTY TYPE GROUPS ====================

TYPE_GROUPS = {
    "garden": ["Garden", "garden", "Low-Rise", "low-rise"],
    "midrise": ["Mid-Rise", "mid-rise", "Midrise", "midrise"],
    "highrise": ["High-Rise", "high-rise", "Highrise", "highrise", "Tower", "tower"],
    "wrap": ["Wrap", "wrap", "Podium", "podium"],
    "townhome": ["Townhome", "townhome", "Townhouse", "townhouse"],
    "senior": ["Senior", "senior", "Age-Restricted", "age-restricted", "55+"],
    "student": ["Student", "student"],
}

# Groups that are considered adjacent
ADJACENT_GROUPS = {
    "garden": ["wrap", "townhome"],
    "midrise": ["wrap", "highrise"],
    "highrise": ["midrise"],
    "wrap": ["garden", "midrise"],
    "townhome": ["garden"],
    "senior": [],
    "student": [],
}

# Vintage brackets (year ranges)
VINTAGE_BRACKETS = [
    (2020, 9999),   # 0: New construction
    (2010, 2019),   # 1: Recent
    (2000, 2009),   # 2: 2000s
    (1990, 1999),   # 3: 1990s
    (1980, 1989),   # 4: 1980s
    (0, 1979),      # 5: Pre-1980
]


def _get_type_group(property_type: Optional[str]) -> Optional[str]:
    """Determine which type group a property belongs to."""
    if not property_type:
        return None
    for group, types in TYPE_GROUPS.items():
        if property_type in types:
            return group
    # Fuzzy fallback: check if property_type contains group name
    pt_lower = property_type.lower() if property_type else ""
    for group in TYPE_GROUPS:
        if group in pt_lower:
            return group
    return None


def _get_vintage_bracket(year: Optional[int]) -> Optional[int]:
    """Get the vintage bracket index for a given year."""
    if not year:
        return None
    for idx, (low, high) in enumerate(VINTAGE_BRACKETS):
        if low <= year <= high:
            return idx
    return len(VINTAGE_BRACKETS) - 1


def _geo_score(subject: dict, comp: SalesComp) -> float:
    """Geographic proximity score.

    Comp location lives in comp.market (and sometimes comp.submarket).
    Subject location comes from Property.submarket.
    Since metro is often null on comps, we compare subject submarket against
    comp.market and comp.submarket, then fall back to county and metro.
    All comps from the same user are assumed same metro → baseline 0.50.
    """
    s_sub = (subject.get("submarket") or "").strip().lower()
    s_county = (subject.get("county") or "").strip().lower()
    s_metro = (subject.get("metro") or "").strip().lower()

    # Comp may store its location in market, submarket, or both
    c_market = (comp.market or "").strip().lower()
    c_sub = (comp.submarket or "").strip().lower()
    c_county = (comp.county or "").strip().lower()
    c_metro = (comp.metro or "").strip().lower()

    # Exact submarket match: subject submarket == comp market or comp submarket
    if s_sub and (
        (c_market and s_sub == c_market)
        or (c_sub and s_sub == c_sub)
    ):
        return 1.0

    # Partial submarket match: one contains the other
    # e.g. subject="South Atlanta" and comp market="Atlanta" or vice-versa
    if s_sub and c_market and (s_sub in c_market or c_market in s_sub):
        return 0.90
    if s_sub and c_sub and (s_sub in c_sub or c_sub in s_sub):
        return 0.90

    # County match
    if s_county and c_county and s_county == c_county:
        return 0.85

    # Metro match (explicit metro fields)
    if s_metro and (
        (c_metro and s_metro == c_metro)
        or (c_market and s_metro in c_market)
    ):
        return 0.70

    # Same user's comps with no better match — assume same metro area
    return 0.50


def _type_score(subject: dict, comp: SalesComp) -> float:
    """Property type match score."""
    s_type = subject.get("property_type")
    c_type = comp.property_type

    if not s_type or not c_type:
        return 0.5  # Unknown — neutral

    s_group = _get_type_group(s_type)
    c_group = _get_type_group(c_type)

    if s_type == c_type:
        return 1.0
    if s_group and c_group and s_group == c_group:
        return 0.8
    if s_group and c_group and c_group in ADJACENT_GROUPS.get(s_group, []):
        return 0.5
    return 0.2


def _vintage_score(subject: dict, comp: SalesComp) -> float:
    """Vintage/age match score with renovation adjustment."""
    s_year = subject.get("year_built")
    # Renovation adjustment: prefer renovation year if within 10 years of subject
    c_year = comp.year_built
    if comp.year_renovated and s_year:
        if abs(comp.year_renovated - s_year) < abs((c_year or 0) - s_year):
            c_year = comp.year_renovated

    s_bracket = _get_vintage_bracket(s_year)
    c_bracket = _get_vintage_bracket(c_year)

    if s_bracket is None or c_bracket is None:
        return 0.5  # Unknown — neutral

    diff = abs(s_bracket - c_bracket)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.7
    if diff == 2:
        return 0.4
    return 0.15


def _size_score(subject: dict, comp: SalesComp) -> float:
    """Unit count proximity score."""
    s_units = subject.get("total_units")
    c_units = comp.units

    if not s_units or not c_units or s_units == 0:
        return 0.5  # Unknown — neutral

    ratio = c_units / s_units
    pct_diff = abs(ratio - 1.0)

    if pct_diff <= 0.25:
        return 1.0
    if pct_diff <= 0.50:
        return 0.75
    if pct_diff <= 0.75:
        return 0.5
    return 0.25


def calculate_relevance(subject: dict, comp: SalesComp) -> float:
    """
    Calculate overall relevance score (0-1) for a comp relative to the subject.
    Product of: geo × type × vintage × size
    """
    geo = _geo_score(subject, comp)
    typ = _type_score(subject, comp)
    vin = _vintage_score(subject, comp)
    siz = _size_score(subject, comp)
    return geo * typ * vin * siz


def select_comps(
    subject: dict,
    all_comps: List[SalesComp],
    min_comps: int = 3,
    target: int = 8,
    max_comps: int = 15,
) -> List[dict]:
    """
    Select and rank comps by relevance.
    Returns list of dicts with comp data + relevance score.

    Uses progressive threshold relaxation to ensure we return at least
    ``min_comps`` results when enough comps exist in the data bank.
    """
    scored = []
    for comp in all_comps:
        rel = calculate_relevance(subject, comp)
        scored.append({"comp": comp, "relevance": rel})

    # Sort by relevance descending (always — used for all threshold tiers)
    scored.sort(key=lambda x: x["relevance"], reverse=True)

    # Progressive threshold relaxation
    for threshold in (0.25, 0.10, 0.03):
        filtered = [s for s in scored if s["relevance"] > threshold]
        if len(filtered) >= min_comps:
            return filtered[:max_comps]

    # Last resort: take top min_comps regardless of threshold
    if len(scored) >= min_comps:
        return scored[:max_comps]

    return scored


def score_cap_rate_vs_comps(subject_cap: float, comps: List[dict]) -> dict:
    """
    Score subject cap rate vs relevance-weighted comp average.
    +100bps wider → 90+, ±25bps → 40-55, -100bps tighter → 10
    """
    total_weight = 0.0
    weighted_sum = 0.0

    for c in comps:
        comp = c["comp"]
        if comp.cap_rate is not None and comp.cap_rate > 0:
            weighted_sum += comp.cap_rate * c["relevance"]
            total_weight += c["relevance"]

    if total_weight == 0:
        return {
            "raw_score": None,
            "spread_bps": None,
            "weighted_avg_cap": None,
            "context": "No comps with cap rate data",
        }

    weighted_avg_cap = weighted_sum / total_weight
    spread_bps = (subject_cap - weighted_avg_cap) * 10000  # Convert to basis points

    # Score: +100bps → 90, 0bps → 50, -100bps → 10
    # Linear interpolation: score = 50 + (spread_bps / 100) * 40, clamped 0-100
    raw_score = 50.0 + (spread_bps / 100.0) * 40.0
    raw_score = max(0.0, min(100.0, raw_score))

    if spread_bps > 25:
        context = f"Cap rate {spread_bps:.0f}bps wider than comps — favorable entry"
    elif spread_bps < -25:
        context = f"Cap rate {abs(spread_bps):.0f}bps tighter than comps — premium pricing"
    else:
        context = f"Cap rate in line with comps (±{abs(spread_bps):.0f}bps)"

    return {
        "raw_score": round(raw_score, 1),
        "spread_bps": round(spread_bps, 1),
        "weighted_avg_cap": round(weighted_avg_cap, 4),
        "context": context,
    }


def score_price_per_unit_vs_comps(subject_ppu: float, comps: List[dict]) -> dict:
    """
    Score subject $/unit vs relevance-weighted comp average.
    -20% below → 90+, ±5% → 40-55, +20% above → 0-10
    """
    total_weight = 0.0
    weighted_sum = 0.0

    for c in comps:
        comp = c["comp"]
        if comp.price_per_unit is not None and comp.price_per_unit > 0:
            weighted_sum += comp.price_per_unit * c["relevance"]
            total_weight += c["relevance"]

    if total_weight == 0:
        return {
            "raw_score": None,
            "pct_diff": None,
            "weighted_avg_ppu": None,
            "context": "No comps with price per unit data",
        }

    weighted_avg_ppu = weighted_sum / total_weight
    pct_diff = (subject_ppu - weighted_avg_ppu) / weighted_avg_ppu

    # Score: -20% below → 90, 0% → 50, +20% above → 10
    # Inverted: lower price = better deal
    raw_score = 50.0 - (pct_diff / 0.20) * 40.0
    raw_score = max(0.0, min(100.0, raw_score))

    if pct_diff < -0.05:
        context = f"Price {abs(pct_diff)*100:.1f}% below comp average — potential value"
    elif pct_diff > 0.05:
        context = f"Price {pct_diff*100:.1f}% above comp average — premium"
    else:
        context = f"Price in line with comps (±{abs(pct_diff)*100:.1f}%)"

    return {
        "raw_score": round(raw_score, 1),
        "pct_diff": round(pct_diff, 4),
        "weighted_avg_ppu": round(weighted_avg_ppu, 0),
        "context": context,
    }


def score_vintage_adjustment(subject_vintage: int, comps: List[dict]) -> dict:
    """
    Score vintage comparison: newer than comps = better.
    +5 years newer → 80, same → 50, -5 years older → 20 (6 pts per year)
    """
    years = []
    for c in comps:
        comp = c["comp"]
        yr = comp.year_renovated if comp.year_renovated else comp.year_built
        if yr:
            years.append(yr)

    if not years:
        return {
            "raw_score": None,
            "years_diff": None,
            "comp_median_vintage": None,
            "context": "No comps with vintage data",
        }

    years.sort()
    mid = len(years) // 2
    comp_median_vintage = years[mid] if len(years) % 2 == 1 else (years[mid - 1] + years[mid]) // 2

    years_diff = subject_vintage - comp_median_vintage

    # 6 points per year, centered at 50
    raw_score = 50.0 + years_diff * 6.0
    raw_score = max(0.0, min(100.0, raw_score))

    if years_diff > 0:
        context = f"Subject is {years_diff} years newer than comp median"
    elif years_diff < 0:
        context = f"Subject is {abs(years_diff)} years older than comp median"
    else:
        context = "Subject vintage matches comp median"

    return {
        "raw_score": round(raw_score, 1),
        "years_diff": years_diff,
        "comp_median_vintage": comp_median_vintage,
        "context": context,
    }


def calculate_layer3_score(subject: dict, user_id: str, db: Session) -> dict:
    """
    Full Layer 3 calculation: query comps, select, score sub-metrics.

    Sub-metric weights: cap_rate=35%, price_per_unit=40%, vintage=25%
    """
    # Pre-filter by metro when available for better relevance, but include
    # comps without metro too since many have metro=None.
    subject_metro = (subject.get("metro") or "").strip().lower()
    subject_submarket = (subject.get("submarket") or "").strip().lower()

    if subject_metro:
        # Prefer comps in the same metro, but also include comps where metro
        # or market column contains the metro name, plus comps with no metro.
        from sqlalchemy import or_, func as sa_func
        all_comps = db.query(SalesComp).filter(
            SalesComp.user_id == user_id,
            or_(
                sa_func.lower(SalesComp.metro) == subject_metro,
                sa_func.lower(SalesComp.market).contains(subject_metro),
                SalesComp.metro.is_(None),
            )
        ).all()
    elif subject_submarket:
        # Fallback: match on submarket → market column
        from sqlalchemy import or_, func as sa_func
        all_comps = db.query(SalesComp).filter(
            SalesComp.user_id == user_id,
            or_(
                sa_func.lower(SalesComp.market) == subject_submarket,
                sa_func.lower(SalesComp.market).contains(subject_submarket),
                sa_func.lower(SalesComp.submarket) == subject_submarket,
                SalesComp.market.is_(None),
            )
        ).all()
    else:
        # No geographic info — query all comps and let scoring handle it
        all_comps = db.query(SalesComp).filter(SalesComp.user_id == user_id).all()

    if not all_comps:
        return {
            "score": None,
            "confidence": "low",
            "context": "No sales comps in data bank for this market",
            "comps_used": [],
            "metrics": {},
        }

    # Select comps
    selected = select_comps(subject, all_comps)

    if len(selected) < 3:
        return {
            "score": None,
            "confidence": "low",
            "context": f"Only {len(selected)} comps found — minimum 3 required",
            "comps_used": [],
            "metrics": {},
        }

    # Count comps with cap rate data
    comps_with_cap = [c for c in selected if c["comp"].cap_rate is not None and c["comp"].cap_rate > 0]

    # Sub-metric scores
    metrics = {}

    # Cap rate scoring
    subject_cap = subject.get("cap_rate")
    if subject_cap and len(comps_with_cap) >= 3:
        cap_result = score_cap_rate_vs_comps(subject_cap, selected)
        metrics["cap_rate"] = cap_result
    else:
        metrics["cap_rate"] = {
            "raw_score": None,
            "context": "Insufficient cap rate data" if not subject_cap else "Fewer than 3 comps with cap rate",
        }

    # Price per unit scoring
    subject_ppu = subject.get("price_per_unit")
    if subject_ppu:
        ppu_result = score_price_per_unit_vs_comps(subject_ppu, selected)
        metrics["price_per_unit"] = ppu_result
    else:
        metrics["price_per_unit"] = {
            "raw_score": None,
            "context": "No subject price per unit data",
        }

    # Vintage scoring
    subject_vintage = subject.get("year_built")
    if subject_vintage:
        vintage_result = score_vintage_adjustment(subject_vintage, selected)
        metrics["vintage"] = vintage_result
    else:
        metrics["vintage"] = {
            "raw_score": None,
            "context": "No subject vintage data",
        }

    # Weighted composite: cap_rate=35%, price_per_unit=40%, vintage=25%
    sub_weights = {"cap_rate": 35, "price_per_unit": 40, "vintage": 25}
    total_weight = 0
    weighted_sum = 0.0

    for metric_name, weight in sub_weights.items():
        score = metrics.get(metric_name, {}).get("raw_score")
        if score is not None:
            weighted_sum += score * weight
            total_weight += weight

    if total_weight > 0:
        composite_score = weighted_sum / total_weight
        confidence = "high" if total_weight >= 80 else "medium" if total_weight >= 50 else "low"
    else:
        composite_score = None
        confidence = "low"

    # Build comps_used list
    comps_used = []
    for c in selected[:15]:
        comp = c["comp"]
        comps_used.append({
            "id": comp.id,
            "property_name": comp.property_name,
            "submarket": comp.submarket or comp.market,
            "cap_rate": comp.cap_rate,
            "price_per_unit": comp.price_per_unit,
            "sale_price": comp.sale_price,
            "year_built": comp.year_built,
            "units": comp.units,
            "relevance": round(c["relevance"], 3),
        })

    return {
        "score": round(composite_score, 1) if composite_score is not None else None,
        "confidence": confidence,
        "context": f"Based on {len(selected)} comparable sales",
        "comps_used": comps_used,
        "metrics": metrics,
    }
