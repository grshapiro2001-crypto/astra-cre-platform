"""Regression tests for _apply_rent_roll_summary_to_property guards.

Covers the production bug where re-uploading a rent roll to an existing
property (legacy handler at properties.py:upload_document_to_property)
overwrites populated total_units / rr_* fields with None when the normalizer
returns an empty or partial summary.
"""
import logging
from unittest.mock import MagicMock

from app.api.routes.properties import _apply_rent_roll_summary_to_property


def _seed_property(**overrides):
    """MagicMock stand-in for a Property row with populated rent-roll fields."""
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
    for k, v in overrides.items():
        setattr(p, k, v)
    return p


def test_empty_summary_zero_inserted_preserves_all_fields(caplog):
    """Case 1: empty summary + inserted=0 must NOT null any populated field."""
    p = _seed_property()
    with caplog.at_level(logging.WARNING, logger="app.api.routes.properties"):
        _apply_rent_roll_summary_to_property(p, {}, inserted=0, document_id=7)

    # Every populated field retained.
    assert p.total_units == 320
    assert p.rr_total_units == 320
    assert p.rr_occupied_units == 295
    assert p.rr_vacancy_count == 25
    assert p.rr_physical_occupancy_pct == 92.19
    assert p.rr_avg_market_rent == 2500.0
    assert p.rr_avg_in_place_rent == 2400.0
    assert p.rr_avg_sqft == 850.0
    assert p.rr_loss_to_lease_pct == 4.0
    assert p.average_inplace_rent == 2400.0
    assert p.average_market_rent == 2500.0

    # WARNING log emitted with required metadata.
    msgs = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any(
        "rr_reupload" in m
        and "property_id=42" in m
        and "field=total_units" in m
        and "inserted=0" in m
        and "document_id=7" in m
        for m in msgs
    )


def test_valid_summary_updates_all_fields(caplog):
    """Case 2: valid full summary + inserted>0 must update every field. No guard-blocked warnings."""
    p = _seed_property(total_units=100, rr_total_units=100)  # stale values
    summary = {
        "total_units": 320,
        "occupied_units": 300,
        "vacant_units": 20,
        "physical_occupancy_pct": 93.75,
        "avg_market_rent": 2600.0,
        "avg_in_place_rent": 2450.0,
        "avg_sqft": 860.0,
        "loss_to_lease_pct": 5.77,
    }
    with caplog.at_level(logging.WARNING, logger="app.api.routes.properties"):
        _apply_rent_roll_summary_to_property(p, summary, inserted=320, document_id=7)

    assert p.total_units == 320
    assert p.rr_total_units == 320
    assert p.rr_occupied_units == 300
    assert p.rr_vacancy_count == 20
    assert p.rr_physical_occupancy_pct == 93.75
    assert p.rr_avg_market_rent == 2600.0
    assert p.rr_avg_in_place_rent == 2450.0
    assert p.rr_avg_sqft == 860.0
    assert p.rr_loss_to_lease_pct == 5.77
    assert p.average_inplace_rent == 2450.0
    assert p.average_market_rent == 2600.0
    assert p.financial_data_source == "rent_roll_excel"

    # No blocked-write warnings for any field.
    warn_msgs = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert not any("rr_reupload: blocked" in m for m in warn_msgs)


def test_partial_summary_updates_truthy_preserves_falsy(caplog):
    """Case 3 (realistic failure mode): some fields populated, some None.

    Truthy fields update; falsy fields preserve existing values. Each blocked
    field gets its own WARNING log.
    """
    p = _seed_property()
    summary = {
        "total_units": 320,
        "occupied_units": 300,
        "vacant_units": 20,
        "physical_occupancy_pct": 93.75,
        "avg_market_rent": None,     # must NOT overwrite 2500.0
        "avg_in_place_rent": 2450.0,
        "avg_sqft": None,            # must NOT overwrite 850.0
        "loss_to_lease_pct": None,   # must NOT overwrite 4.0
    }
    with caplog.at_level(logging.WARNING, logger="app.api.routes.properties"):
        _apply_rent_roll_summary_to_property(p, summary, inserted=320, document_id=7)

    # Truthy incoming values → updated.
    assert p.total_units == 320
    assert p.rr_occupied_units == 300
    assert p.rr_vacancy_count == 20
    assert p.rr_physical_occupancy_pct == 93.75
    assert p.rr_avg_in_place_rent == 2450.0
    assert p.average_inplace_rent == 2450.0

    # Falsy incoming values → preserved.
    assert p.rr_avg_market_rent == 2500.0
    assert p.rr_avg_sqft == 850.0
    assert p.rr_loss_to_lease_pct == 4.0
    assert p.average_market_rent == 2500.0

    # WARNING emitted per blocked field (at least these four).
    blocked_msgs = [
        r.getMessage() for r in caplog.records
        if r.levelno == logging.WARNING and "rr_reupload: blocked" in r.getMessage()
    ]
    joined = "\n".join(blocked_msgs)
    assert "field=rr_avg_market_rent" in joined
    assert "field=rr_avg_sqft" in joined
    assert "field=rr_loss_to_lease_pct" in joined
    assert "field=average_market_rent" in joined
