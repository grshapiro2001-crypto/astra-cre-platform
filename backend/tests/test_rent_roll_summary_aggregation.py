"""Tests for the rent roll aggregator helper and the admin recompute endpoint.

Covers the Sixty 11th regression where 332 rows landed in rent_roll_units
but the summary dict feeding _apply_rent_roll_summary_to_property was
zeros/Nones. The aggregator is now the single source of truth for both the
legacy upload handler and the admin recompute endpoint.
"""
import logging
from unittest.mock import MagicMock

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


# ---------------------------------------------------------------------------
# Recompute endpoint tests (unit-level, MagicMock for DB)
# ---------------------------------------------------------------------------


def _mock_unit(is_occupied, sqft, market_rent, in_place_rent, status="Current"):
    u = MagicMock()
    u.is_occupied = is_occupied
    u.sqft = sqft
    u.market_rent = market_rent
    u.in_place_rent = in_place_rent
    u.status = status
    return u


def _mock_db_with_rows_and_property(property_obj, rows):
    """Build a MagicMock db that returns property_obj on the Property query and
    rows on the RentRollUnit query.
    """
    from app.models.property import Property, RentRollUnit

    db = MagicMock()

    def _query(model):
        q = MagicMock()
        q.filter = MagicMock(return_value=q)
        if model is Property:
            q.first = MagicMock(return_value=property_obj)
            q.all = MagicMock(return_value=[property_obj])
        elif model is RentRollUnit:
            q.first = MagicMock(return_value=rows[0] if rows else None)
            q.all = MagicMock(return_value=rows)
        else:
            q.first = MagicMock(return_value=None)
            q.all = MagicMock(return_value=[])
        return q

    db.query = MagicMock(side_effect=_query)
    return db


def _seed_property_nulled():
    """Property row that's been nulled by a pre-A1 upload — the Sixty 11th state."""
    p = MagicMock()
    p.id = 10
    p.total_units = 0
    p.rr_total_units = None
    p.rr_occupied_units = None
    p.rr_vacancy_count = None
    p.rr_physical_occupancy_pct = None
    p.rr_avg_market_rent = None
    p.rr_avg_in_place_rent = None
    p.rr_avg_sqft = None
    p.rr_loss_to_lease_pct = None
    p.average_inplace_rent = None
    p.average_market_rent = None
    return p


def test_recompute_endpoint_404_when_property_missing():
    """Property not found → HTTPException 404."""
    from fastapi import HTTPException

    from app.api.routes.properties import recompute_rent_roll_aggregates

    db = MagicMock()
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.first = MagicMock(return_value=None)
    db.query = MagicMock(return_value=q)

    admin = MagicMock(id=99)

    with pytest.raises(HTTPException) as exc:
        recompute_rent_roll_aggregates(property_id=999, db=db, admin=admin)
    assert exc.value.status_code == 404


def test_recompute_endpoint_fixes_nulled_property(caplog):
    """Nulled Property + 332 rent_roll_units → after.total_units=332, all rr_* populated.

    This is the Sixty 11th backfill scenario. Confirms the endpoint writes
    through the A1 guard and lifts the null-overwrite block.
    """
    from app.api.routes.properties import recompute_rent_roll_aggregates

    property_obj = _seed_property_nulled()
    rows = [
        _mock_unit(is_occupied=True, sqft=900, market_rent=2000.0, in_place_rent=1900.0)
        for _ in range(300)
    ] + [
        _mock_unit(is_occupied=False, sqft=900, market_rent=2000.0, in_place_rent=None, status="Vacant")
        for _ in range(32)
    ]

    db = _mock_db_with_rows_and_property(property_obj, rows)
    admin = MagicMock(id=99)

    result = recompute_rent_roll_aggregates(property_id=10, db=db, admin=admin)

    assert result["property_id"] == 10
    assert result["row_count"] == 332
    assert "before" in result and "after" in result

    # A1 guard let the writes through because summary was truthy.
    assert property_obj.total_units == 332
    assert property_obj.rr_total_units == 332
    assert property_obj.rr_occupied_units == 300
    assert property_obj.rr_vacancy_count == 32
    assert property_obj.rr_physical_occupancy_pct == pytest.approx(90.36, abs=0.05)
    assert property_obj.rr_avg_market_rent == pytest.approx(2000.0, rel=1e-3)
    assert property_obj.rr_avg_in_place_rent == pytest.approx(1900.0, rel=1e-3)

    db.commit.assert_called_once()


def test_recompute_endpoint_empty_rent_roll_does_not_null_fields(caplog):
    """No rent_roll_units rows → A1 guard blocks every write; populated
    property fields are preserved. Prevents the endpoint from being used as
    a null-everything footgun.
    """
    from app.api.routes.properties import recompute_rent_roll_aggregates

    # Seed a fully-populated property.
    p = MagicMock()
    p.id = 42
    p.total_units = 320
    p.rr_total_units = 320
    p.rr_occupied_units = 295
    p.rr_vacancy_count = 25
    p.rr_physical_occupancy_pct = 92.19
    p.rr_avg_market_rent = 2500.0
    p.rr_avg_in_place_rent = 2400.0
    p.rr_avg_sqft = 850.0
    p.rr_loss_to_lease_pct = 4.0
    p.average_inplace_rent = 2400.0
    p.average_market_rent = 2500.0

    db = _mock_db_with_rows_and_property(p, rows=[])
    admin = MagicMock(id=99)

    with caplog.at_level(logging.WARNING, logger="app.api.routes.properties"):
        result = recompute_rent_roll_aggregates(property_id=42, db=db, admin=admin)

    assert result["row_count"] == 0
    # Nothing was overwritten (A1 guard at work).
    assert p.total_units == 320
    assert p.rr_total_units == 320
    assert p.rr_occupied_units == 295
    assert p.rr_avg_market_rent == 2500.0


def test_recompute_endpoint_before_after_diff_shape():
    """Response has the 11 canonical fields in both before and after."""
    from app.api.routes.properties import _RECOMPUTE_FIELDS, recompute_rent_roll_aggregates

    p = _seed_property_nulled()
    rows = [_mock_unit(True, 900, 2000.0, 1900.0)]
    db = _mock_db_with_rows_and_property(p, rows)
    admin = MagicMock(id=99)

    result = recompute_rent_roll_aggregates(property_id=10, db=db, admin=admin)

    for field in _RECOMPUTE_FIELDS:
        assert field in result["before"]
        assert field in result["after"]
