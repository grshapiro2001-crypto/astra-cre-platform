"""Pure aggregator for rent_roll_units row dicts.

Mirrors the inline aggregation in upload.py:_process_rent_roll
(_update_aggregates closure at upload.py:435-452 plus the summary
computation at upload.py:488-512) so every caller — the legacy upload
handler and the admin recompute endpoint — produces the same summary
shape from the same data.
"""

from typing import Any, Dict, List, Optional


def compute_aggregates_from_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute a rent-roll summary dict from a list of row dicts.

    Each input row is expected to expose: is_occupied (bool or None),
    sqft, market_rent, in_place_rent (all Optional numerics).

    Returns a dict with the keys consumed by
    _apply_rent_roll_summary_to_property: total_units, occupied_units,
    vacant_units, physical_occupancy_pct, avg_market_rent,
    avg_in_place_rent, avg_sqft, loss_to_lease_pct.
    """
    total = len(rows)
    if total == 0:
        return {
            "total_units": 0,
            "occupied_units": 0,
            "vacant_units": 0,
            "physical_occupancy_pct": None,
            "avg_market_rent": None,
            "avg_in_place_rent": None,
            "avg_sqft": None,
            "loss_to_lease_pct": None,
        }

    occupied = 0
    vacant = 0
    sqft_sum = 0.0
    sqft_n = 0
    market_sum = 0.0
    market_n = 0
    in_place_sum = 0.0
    in_place_n = 0

    for row in rows:
        is_occ = row.get("is_occupied")
        if is_occ is True:
            occupied += 1
        elif is_occ is False:
            vacant += 1
        if row.get("sqft"):
            sqft_sum += row["sqft"]
            sqft_n += 1
        if row.get("market_rent"):
            market_sum += row["market_rent"]
            market_n += 1
        if row.get("in_place_rent"):
            in_place_sum += row["in_place_rent"]
            in_place_n += 1

    physical_occupancy_pct: Optional[float] = (
        round(100.0 * occupied / total, 2) if (occupied + vacant) else None
    )
    avg_market_rent = round(market_sum / market_n, 2) if market_n else None
    avg_in_place_rent = round(in_place_sum / in_place_n, 2) if in_place_n else None
    avg_sqft = round(sqft_sum / sqft_n, 1) if sqft_n else None

    loss_to_lease_pct: Optional[float] = None
    if avg_market_rent and avg_in_place_rent and avg_market_rent > 0:
        loss_to_lease_pct = round(
            100.0 * (avg_market_rent - avg_in_place_rent) / avg_market_rent, 2
        )

    return {
        "total_units": total,
        "occupied_units": occupied,
        "vacant_units": vacant,
        "physical_occupancy_pct": physical_occupancy_pct,
        "avg_market_rent": avg_market_rent,
        "avg_in_place_rent": avg_in_place_rent,
        "avg_sqft": avg_sqft,
        "loss_to_lease_pct": loss_to_lease_pct,
    }
