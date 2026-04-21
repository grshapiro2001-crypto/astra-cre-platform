"""Tests for the rent roll aggregator helper.

Covers the Sixty 11th regression where 332 rows landed in rent_roll_units
but the summary dict feeding _apply_rent_roll_summary_to_property was
zeros/Nones. The aggregator is now the single source of truth for the
legacy upload handler (and, in a follow-up commit, the admin recompute
endpoint).
"""
import pytest

from app.services.rent_roll_aggregates import compute_aggregates_from_rows


# ---------------------------------------------------------------------------
# Pure aggregator tests
# ---------------------------------------------------------------------------


def test_compute_aggregates_mixed_occupancy():
    """5 occupied + 3 vacant, known rents/sqft → all 8 keys have expected values."""
    rows = [
        {"is_occupied": True, "sqft": 900, "market_rent": 2000.0, "in_place_rent": 1900.0, "status": "Current"},
        {"is_occupied": True, "sqft": 900, "market_rent": 2000.0, "in_place_rent": 1900.0, "status": "Current"},
        {"is_occupied": True, "sqft": 1000, "market_rent": 2200.0, "in_place_rent": 2100.0, "status": "Current"},
        {"is_occupied": True, "sqft": 1000, "market_rent": 2200.0, "in_place_rent": 2100.0, "status": "Current"},
        {"is_occupied": True, "sqft": 1100, "market_rent": 2400.0, "in_place_rent": 2300.0, "status": "Current"},
        {"is_occupied": False, "sqft": 900, "market_rent": 2000.0, "in_place_rent": None, "status": "Vacant"},
        {"is_occupied": False, "sqft": 1000, "market_rent": 2200.0, "in_place_rent": None, "status": "Vacant"},
        {"is_occupied": False, "sqft": 1100, "market_rent": 2400.0, "in_place_rent": None, "status": "Vacant"},
    ]

    s = compute_aggregates_from_rows(rows)

    assert s["total_units"] == 8
    assert s["occupied_units"] == 5
    assert s["vacant_units"] == 3
    assert s["physical_occupancy_pct"] == 62.5
    # Market avg across all 8 rows with market_rent > 0
    assert s["avg_market_rent"] == pytest.approx(2175.0, rel=1e-3)
    # In-place avg across 5 occupied rows with in_place_rent > 0
    assert s["avg_in_place_rent"] == pytest.approx(2060.0, rel=1e-3)
    assert s["avg_sqft"] == pytest.approx(987.5, rel=1e-3)
    # loss_to_lease = (2175 - 2060) / 2175 * 100 ≈ 5.29
    assert s["loss_to_lease_pct"] == pytest.approx(5.29, abs=0.01)


def test_compute_aggregates_all_vacant_no_inplace_no_crash():
    """All rows vacant with no in_place_rent → avg_in_place_rent is None, no ZeroDivision."""
    rows = [
        {"is_occupied": False, "sqft": 900, "market_rent": 2000.0, "in_place_rent": None, "status": "Vacant"},
        {"is_occupied": False, "sqft": 950, "market_rent": 2100.0, "in_place_rent": 0, "status": "Vacant"},
    ]

    s = compute_aggregates_from_rows(rows)

    assert s["total_units"] == 2
    assert s["occupied_units"] == 0
    assert s["vacant_units"] == 2
    assert s["physical_occupancy_pct"] == 0.0
    assert s["avg_market_rent"] == pytest.approx(2050.0, rel=1e-3)
    assert s["avg_in_place_rent"] is None
    assert s["avg_sqft"] == pytest.approx(925.0, rel=1e-3)
    assert s["loss_to_lease_pct"] is None


def test_compute_aggregates_empty_rows():
    """Empty input → zeros/Nones, no crash."""
    s = compute_aggregates_from_rows([])
    assert s == {
        "total_units": 0,
        "occupied_units": 0,
        "vacant_units": 0,
        "physical_occupancy_pct": None,
        "avg_market_rent": None,
        "avg_in_place_rent": None,
        "avg_sqft": None,
        "loss_to_lease_pct": None,
    }


def test_compute_aggregates_tristate_is_occupied():
    """is_occupied: True counts as occupied, False as vacant, None ignored."""
    rows = [
        {"is_occupied": True, "sqft": 900, "market_rent": 2000.0, "in_place_rent": 1900.0},
        {"is_occupied": False, "sqft": 900, "market_rent": 2000.0, "in_place_rent": None},
        {"is_occupied": None, "sqft": 900, "market_rent": 2000.0, "in_place_rent": 1800.0},
    ]

    s = compute_aggregates_from_rows(rows)

    assert s["total_units"] == 3
    assert s["occupied_units"] == 1
    assert s["vacant_units"] == 1
    # Denominator is total_units (3), matches upload.py:494
    assert s["physical_occupancy_pct"] == pytest.approx(33.33, abs=0.01)


def test_compute_aggregates_missing_keys_default_to_none():
    """Rows missing some keys (e.g., no market_rent column) don't crash."""
    rows = [
        {"is_occupied": True},  # no sqft, no rents
        {"is_occupied": True, "market_rent": 1500.0},
    ]

    s = compute_aggregates_from_rows(rows)

    assert s["total_units"] == 2
    assert s["occupied_units"] == 2
    assert s["avg_market_rent"] == pytest.approx(1500.0, rel=1e-3)
    assert s["avg_sqft"] is None
    assert s["avg_in_place_rent"] is None


def test_compute_aggregates_332_rows_matches_prod_shape():
    """Sixty 11th regression canary: 332 rows with mixed occupancy returns
    non-zero total_units and non-None averages — i.e. the exact signal the
    A1 guard was blocking in prod.
    """
    rows = []
    for i in range(332):
        is_occ = i % 10 != 0  # ~90% occupied
        rows.append({
            "is_occupied": is_occ,
            "sqft": 900 + (i % 5) * 50,
            "market_rent": 2000.0 + (i % 7) * 25,
            "in_place_rent": 1950.0 if is_occ else None,
            "status": "Current" if is_occ else "Vacant",
        })

    s = compute_aggregates_from_rows(rows)

    assert s["total_units"] == 332
    assert s["occupied_units"] > 0
    assert s["vacant_units"] > 0
    assert s["physical_occupancy_pct"] is not None and s["physical_occupancy_pct"] > 0
    assert s["avg_market_rent"] is not None and s["avg_market_rent"] > 0
    assert s["avg_in_place_rent"] is not None and s["avg_in_place_rent"] > 0
    assert s["avg_sqft"] is not None and s["avg_sqft"] > 0
