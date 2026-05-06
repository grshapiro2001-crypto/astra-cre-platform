"""Sprint 1 regression: BOV extraction must not produce T12/T3 financials.

Mirror of the OM regression test for the BOV prompt. BOV ownership over
trailing financials was deliberately removed in Sprint 1 — broker-of-value
forward guidance lives in Y1; trailing financials come from the T12 Excel
upload.

See docs/audits/extraction-methodology-audit.md.
"""
from app.services.claude_extraction_service import BOV_EXTRACTION_PROMPT


def test_bov_prompt_contains_y1_only_directive():
    """The BOV prompt must contain the explicit Y1-only directive."""
    assert "FINANCIAL EXTRACTION (Y1 PROFORMA ONLY)" in BOV_EXTRACTION_PROMPT
    assert "DO NOT extract T12" in BOV_EXTRACTION_PROMPT


def test_bov_prompt_does_not_request_each_period_extraction():
    """The pre-Sprint-1 'FOR EACH PERIOD (T3, T12, Y1)' directive header is gone."""
    assert "FINANCIAL EXTRACTION FOR EACH PERIOD" not in BOV_EXTRACTION_PROMPT
    # The pre-Sprint-1 priorities also enumerated T3/T12/Y1 explicitly.
    assert "ALL financial periods (T3, T12, AND Y1" not in BOV_EXTRACTION_PROMPT


def test_bov_return_schema_does_not_contain_t12_or_t3_keys():
    """BOV JSON return-schema example must not list `t12` or `t3` as keys."""
    assert '"t12":' not in BOV_EXTRACTION_PROMPT
    assert '"t3":' not in BOV_EXTRACTION_PROMPT


def test_bov_return_schema_still_contains_y1():
    """Sanity: Y1 must remain extractable from the BOV."""
    assert '"y1":' in BOV_EXTRACTION_PROMPT


def test_bov_cap_rate_qualifier_metadata_preserved():
    """Cap rate *qualifiers* may still reference T3/T12 — they're valuation
    metadata (broker pricing methodology), not raw financial extraction."""
    # The pricing-tier cap_rates structure references T3/T12 as rate_type
    # values. Sprint 1 only stripped raw financial extraction, not valuation
    # metadata.
    assert '"rate_type"' in BOV_EXTRACTION_PROMPT
