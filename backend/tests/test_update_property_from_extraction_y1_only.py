"""Sprint 1 regression: update_property_from_extraction must ignore t12/t3 keys
and tag financial_data_source for OM/BOV writes.

The function previously wrote `t12_*` and `t3_*` columns whenever the
extraction payload contained those keys — even when the source was an OM
PDF. Sprint 1 deletes those write branches; the function now writes only
Y1 from extraction payloads. Trailing financials come from the T12 Excel
upload path.

See docs/audits/extraction-methodology-audit.md.
"""
import pytest

from app.api.routes.properties import (
    update_property_from_extraction,
    _has_t12_excel_priority,
)


class _StubProperty:
    """Auto-defaulting stub for testing update_property_from_extraction.

    Any attribute not explicitly set returns None. Set attributes persist
    via normal setattr. Avoids MagicMock's attribute-write capture issues.
    """
    def __init__(self, **overrides):
        for k, v in overrides.items():
            setattr(self, k, v)

    def __getattr__(self, name):
        # Only called when normal lookup fails. Set attributes short-circuit.
        return None


def _t12_payload():
    """Adversarial T12 payload — should never be written from OM/BOV."""
    return {
        "noi": 999_999,
        "gsr": 999_999,
        "net_rental_income": 999_999,
        "period_label": "T-12 FY2024",
    }


def _t3_payload():
    """Adversarial T3 payload — should never be written from OM/BOV."""
    return {
        "noi": 888_888,
        "gsr": 888_888,
        "period_label": "T-3 FY2024",
    }


def _y1_payload():
    """Legitimate Y1 proforma payload."""
    return {
        "noi": 1_000_000,
        "loss_to_lease": 50_000,
        "vacancy_rate_pct": 5.0,
        "concessions": 10_000,
        "credit_loss": 2_000,
        "net_rental_income": 4_500_000,
        "utility_reimbursements": 100_000,
        "parking_storage_income": 25_000,
        "other_income": 15_000,
        "management_fee_pct": 3.0,
        "real_estate_taxes": 250_000,
        "insurance_amount": 75_000,
        "replacement_reserves": 30_000,
        "net_cash_flow": 970_000,
        "expense_ratio_pct": 45.0,
        "period_label": "Y1 Proforma",
    }


def test_t12_and_t3_keys_in_extraction_are_ignored_by_om_path():
    """If Claude (or a regression) returns t12/t3 alongside y1, the function
    must write only y1 — t12_* and t3_* columns must remain None."""
    stub = _StubProperty()
    extraction = {
        "financials_by_period": {
            "y1": _y1_payload(),
            "t12": _t12_payload(),
            "t3": _t3_payload(),
        },
        "document_type": "OM",
    }

    update_property_from_extraction(stub, extraction, db=None, document_type="OM")

    # Y1 wrote
    assert stub.y1_noi == 1_000_000
    assert stub.y1_loss_to_lease == 50_000
    assert stub.y1_financials_json is not None

    # T12 / T3 did NOT write — branches no longer exist
    assert stub.t12_noi is None
    assert stub.t12_financials_json is None
    assert stub.t12_net_rental_income is None
    assert stub.t3_noi is None
    assert stub.t3_financials_json is None


def test_om_extraction_sets_financial_data_source():
    """Item 5: OM writes must tag financial_data_source='om'."""
    stub = _StubProperty()
    extraction = {"financials_by_period": {"y1": _y1_payload()}}

    update_property_from_extraction(stub, extraction, db=None, document_type="OM")

    assert stub.financial_data_source == "om"
    assert stub.financial_data_updated_at is not None


def test_bov_extraction_sets_financial_data_source():
    """Item 5: BOV writes must tag financial_data_source='bov'."""
    stub = _StubProperty()
    extraction = {"financials_by_period": {"y1": _y1_payload()}}

    update_property_from_extraction(stub, extraction, db=None, document_type="BOV")

    assert stub.financial_data_source == "bov"
    assert stub.financial_data_updated_at is not None


def test_om_extraction_does_not_downgrade_t12_excel_provenance():
    """Item 5 + Item 6: if a property already has authoritative T12 Excel
    data, OM extraction must not overwrite the source tag."""
    stub = _StubProperty(financial_data_source="t12_excel")
    extraction = {"financials_by_period": {"y1": _y1_payload()}}

    update_property_from_extraction(stub, extraction, db=None, document_type="OM")

    # Y1 still wrote (Y1 is forward-looking; doesn't conflict with Excel T12)
    assert stub.y1_noi == 1_000_000
    # Provenance NOT downgraded
    assert stub.financial_data_source == "t12_excel"


def test_unknown_document_type_does_not_set_provenance():
    """Provenance is only tagged for OM/BOV. Other document types pass through."""
    stub = _StubProperty()
    extraction = {"financials_by_period": {"y1": _y1_payload()}}

    update_property_from_extraction(stub, extraction, db=None, document_type=None)

    assert stub.y1_noi == 1_000_000
    assert stub.financial_data_source is None


def test_has_t12_excel_priority_helper():
    """Sanity: the provenance guard helper recognises the t12_excel sentinel."""
    assert _has_t12_excel_priority(_StubProperty(financial_data_source="t12_excel")) is True
    assert _has_t12_excel_priority(_StubProperty(financial_data_source="om")) is False
    assert _has_t12_excel_priority(_StubProperty()) is False
