"""
Market Sentiment Scoring Service — Layer 2 score computation

Queries MarketSentimentSignal records for a property's geography,
applies geographic/recency/signal-type weighting, and computes
a composite -10 to +10 market sentiment score.
"""
import logging
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.data_bank import DataBankDocument
from app.models.market_sentiment import MarketSentimentSignal

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Signal type weights (spec §4.3)
# ---------------------------------------------------------------------------

SIGNAL_TYPE_WEIGHTS = {
    "supply_pipeline":      1.0,
    "construction_starts":  0.85,
    "absorption":           0.75,
    "rent_growth":          0.60,
    "concessions":          0.55,
    "buyer_demand":         0.50,
    "seller_motivation":    0.45,
    "cap_rate_trend":       0.40,
    "debt_market":          0.35,
    "employment":           0.30,
    "population":           0.25,
    "regulatory":           0.20,
    "occupancy":            0.15,
    "other":                0.15,
}

# Direction values
DIRECTION_VALUES = {
    "positive": 1.0,
    "negative": -1.0,
    "neutral": 0.0,
    "mixed": 0.0,
}

# Magnitude multipliers
MAGNITUDE_MULTIPLIERS = {
    "strong": 1.0,
    "moderate": 0.6,
    "slight": 0.3,
}


# ---------------------------------------------------------------------------
# Geographic matching (spec §4.2)
# ---------------------------------------------------------------------------

def _normalize_metro(metro: str) -> str:
    """Normalize metro name for matching: lowercase, strip common suffixes."""
    if not metro:
        return ""
    normalized = metro.lower().strip()
    # Strip common MSA suffixes
    for suffix in [", msa", " msa", ", ga", ", tx", ", fl", ", ca", ", nc",
                   ", az", ", co", ", tn", ", oh", ", va", ", wa", ", or",
                   ", il", ", ny", ", pa", ", ma", ", md", ", nj", ", mi",
                   ", mn", ", mo", ", wi", ", in", ", sc", ", al", ", la",
                   ", ok", ", ky", ", ct", ", ut", ", nv", ", nm", ", id"]:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)]
            break
    return normalized


def _metro_matches(signal_metro: str, property_metro: str) -> bool:
    """Check if a signal's metro matches the property's metro (substring match)."""
    if not signal_metro or not property_metro:
        return False
    s = _normalize_metro(signal_metro)
    p = _normalize_metro(property_metro)
    # Substring match in either direction
    return s in p or p in s


def _get_geo_weight(signal: MarketSentimentSignal, property_metro: str, property_submarket: Optional[str]) -> float:
    """
    Compute geographic weight for a signal based on match precision.

    Ring 1: Exact submarket match → 1.0
    Ring 2: Same metro, any submarket → 0.5
    Ring 3: No geography filter (national) → 0.15
    """
    # Ring 1: submarket match
    if (property_submarket and signal.geography_submarket
            and signal.geography_submarket.lower().strip() == property_submarket.lower().strip()):
        return 1.0

    # Ring 2: metro match
    if _metro_matches(signal.geography_metro or "", property_metro or ""):
        return 0.5

    # Ring 3: national / no geo match
    return 0.15


# ---------------------------------------------------------------------------
# Recency weighting (spec §4.4)
# ---------------------------------------------------------------------------

def _parse_publication_date(pub_date_str: Optional[str]) -> Optional[date]:
    """Parse publication_date string into a date object."""
    if not pub_date_str:
        return None

    # Try various formats: "2026-Q1", "2026-01", "2026", "Q1 2026"
    pub = pub_date_str.strip()

    # "YYYY-QN" format
    if "-Q" in pub.upper():
        parts = pub.upper().split("-Q")
        try:
            year = int(parts[0])
            quarter = int(parts[1])
            month = (quarter - 1) * 3 + 1
            return date(year, month, 1)
        except (ValueError, IndexError):
            pass

    # "QN YYYY" format
    if pub.upper().startswith("Q") and " " in pub:
        parts = pub.upper().split()
        try:
            quarter = int(parts[0][1:])
            year = int(parts[1])
            month = (quarter - 1) * 3 + 1
            return date(year, month, 1)
        except (ValueError, IndexError):
            pass

    # "YYYY-MM" format
    try:
        return datetime.strptime(pub, "%Y-%m").date()
    except ValueError:
        pass

    # "YYYY" format
    try:
        return date(int(pub), 1, 1)
    except ValueError:
        pass

    return None


def _recency_weight(publication_date: Optional[str], current_date: date) -> float:
    """
    Weight by document recency.

    < 3 months: 1.0
    3-6 months: 0.75
    6-12 months: 0.5
    12+ months: 0.25
    """
    parsed = _parse_publication_date(publication_date)
    if not parsed:
        return 0.5  # Unknown date — moderate weight

    days_old = (current_date - parsed).days
    months_old = days_old / 30.0

    if months_old < 3:
        return 1.0
    elif months_old < 6:
        return 0.75
    elif months_old < 12:
        return 0.5
    else:
        return 0.25


# ---------------------------------------------------------------------------
# Score computation (spec §4.5)
# ---------------------------------------------------------------------------

def compute_market_sentiment_score(
    property_metro: str,
    property_submarket: Optional[str],
    user_id: str,
    organization_id: Optional[int],
    db: Session,
) -> dict:
    """
    Query stored market sentiment signals and compute -10 to +10 score.

    Returns:
    {
        "score": int or None,       # -10 to +10
        "rationale": str or None,   # plain English explanation
        "signal_count": int,        # how many signals contributed
        "sources": list,            # source documents used
        "staleness_days": int       # days since most recent source document
    }
    """
    # Query all signals for this user (we filter geographically in Python
    # to support fuzzy metro matching)
    signals = db.query(MarketSentimentSignal).filter(
        MarketSentimentSignal.user_id == user_id,
    ).all()

    if not signals:
        return {
            "score": None,
            "rationale": None,
            "signal_count": 0,
            "sources": [],
            "staleness_days": 0,
        }

    # Get document publication dates for recency weighting
    doc_ids = {s.document_id for s in signals}
    docs = db.query(DataBankDocument).filter(
        DataBankDocument.id.in_(doc_ids),
    ).all()
    doc_map = {d.id: d for d in docs}

    today = date.today()
    weighted_votes = []
    non_neutral_count = 0
    source_docs = set()
    most_recent_date = None

    for signal in signals:
        # Geographic weighting
        geo_weight = _get_geo_weight(signal, property_metro, property_submarket)

        # Skip signals with no geographic relevance at all if property has metro
        # (Ring 3 still contributes a small weight for national signals)

        # Direction value
        direction_val = DIRECTION_VALUES.get(signal.direction, 0.0)

        # Signal type weight
        type_weight = SIGNAL_TYPE_WEIGHTS.get(signal.signal_type, 0.15)

        # Magnitude multiplier
        magnitude_mult = MAGNITUDE_MULTIPLIERS.get(signal.magnitude, 0.6)

        # Recency weight
        doc = doc_map.get(signal.document_id)
        pub_date = doc.publication_date if doc else None
        rec_weight = _recency_weight(pub_date, today)

        # Compute vote
        vote = direction_val * geo_weight * type_weight * rec_weight * magnitude_mult
        weighted_votes.append({
            "vote": vote,
            "signal": signal,
            "geo_weight": geo_weight,
            "type_weight": type_weight,
            "rec_weight": rec_weight,
            "magnitude_mult": magnitude_mult,
            "abs_weight": abs(geo_weight * type_weight * rec_weight * magnitude_mult),
        })

        if direction_val != 0.0:
            non_neutral_count += 1

        # Track sources
        if doc:
            source_docs.add(doc.id)
            parsed_date = _parse_publication_date(pub_date)
            if parsed_date and (most_recent_date is None or parsed_date > most_recent_date):
                most_recent_date = parsed_date

    if non_neutral_count == 0:
        return {
            "score": 0,
            "rationale": "All signals are neutral — no directional trend detected",
            "signal_count": len(signals),
            "sources": [doc_map[did].source_firm or doc_map[did].filename for did in source_docs if did in doc_map],
            "staleness_days": (today - most_recent_date).days if most_recent_date else 0,
        }

    # Sum weighted votes and normalize
    total_votes = sum(v["vote"] for v in weighted_votes)
    raw_score = total_votes / non_neutral_count

    # Scale to -10/+10 range and clamp
    score = round(raw_score * 10)
    score = max(-10, min(10, score))

    # Generate rationale
    rationale = _generate_rationale(
        weighted_votes, score, source_docs, doc_map, property_metro,
    )

    staleness_days = (today - most_recent_date).days if most_recent_date else 0

    return {
        "score": score,
        "rationale": rationale,
        "signal_count": len(signals),
        "sources": [doc_map[did].source_firm or doc_map[did].filename for did in source_docs if did in doc_map],
        "staleness_days": staleness_days,
    }


# ---------------------------------------------------------------------------
# Rationale generation (spec §4.6)
# ---------------------------------------------------------------------------

def _generate_rationale(
    weighted_votes: list,
    score: int,
    source_docs: set,
    doc_map: dict,
    property_metro: str,
) -> str:
    """Generate a human-readable rationale summarizing the scoring."""
    # Group by signal type and find top contributors
    type_votes = defaultdict(list)
    for wv in weighted_votes:
        if wv["vote"] != 0:
            type_votes[wv["signal"].signal_type].append(wv)

    # Sort types by total absolute impact
    type_impacts = []
    for stype, votes in type_votes.items():
        total_impact = sum(v["vote"] for v in votes)
        strongest = max(votes, key=lambda v: abs(v["vote"]))
        type_impacts.append({
            "type": stype,
            "total_impact": total_impact,
            "abs_impact": abs(total_impact),
            "strongest_signal": strongest["signal"],
        })

    type_impacts.sort(key=lambda x: x["abs_impact"], reverse=True)

    # Build rationale from top 3-4 signal types
    parts = []
    for ti in type_impacts[:4]:
        signal = ti["strongest_signal"]
        direction_word = "positive" if ti["total_impact"] > 0 else "negative"
        label = ti["type"].replace("_", " ").title()

        if signal.quantitative_value:
            parts.append(f"{label} ({signal.quantitative_value})")
        else:
            parts.append(f"{label} ({direction_word})")

    # Format metro name
    metro_label = property_metro or "Market"

    # Count sources
    source_names = []
    for did in source_docs:
        doc = doc_map.get(did)
        if doc:
            name = doc.source_firm or doc.filename
            if name not in source_names:
                source_names.append(name)

    sign = "+" if score > 0 else ""
    signals_summary = ", ".join(parts) if parts else "mixed signals"
    source_summary = f"Based on {len(source_docs)} document{'s' if len(source_docs) != 1 else ''}"
    if source_names:
        source_summary += f", most recent: {source_names[0]}"

    return f"{metro_label} ({sign}{score}): {signals_summary}. {source_summary}."
