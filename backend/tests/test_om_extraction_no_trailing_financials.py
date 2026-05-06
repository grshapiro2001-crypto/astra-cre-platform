"""Sprint 1 regression: OM extraction must not produce T12/T3 financials.

The OM Claude prompt was previously instructing the model to extract T12,
T-12, TTM, Trailing-12, T3, and T-3 trailing financial data alongside the
Y1 proforma. Sprint 1 narrows OM ownership to Y1 proforma only — trailing
financials come from the T12 Excel upload, not the OM PDF.

See docs/audits/extraction-methodology-audit.md.
"""
from app.services.claude_extraction_service import OM_EXTRACTION_PROMPT


def test_om_prompt_contains_y1_only_directive():
    """The OM prompt must contain the explicit Y1-only directive."""
    assert "FINANCIAL EXTRACTION (Y1 PROFORMA ONLY)" in OM_EXTRACTION_PROMPT
    assert "DO NOT extract T12" in OM_EXTRACTION_PROMPT


def test_om_prompt_does_not_request_trailing_financial_extraction():
    """The pre-Sprint-1 directive header must be gone."""
    # Affirmative-only negative: the new directive itself contains the strings
    # "T-12", "TTM", "Trailing 12 Months", "T3", "T-3" (inside the "DO NOT
    # extract..." sentence). The directive HEADER is the only safe negative.
    assert "EXTRACT ALL FINANCIAL PERIODS" not in OM_EXTRACTION_PROMPT


def test_om_return_schema_does_not_contain_t12_or_t3_keys():
    """The JSON return-schema example must not list `t12` or `t3` as keys."""
    # The schema is a docstring JSON-object example; the keys appear quoted.
    assert '"t12":' not in OM_EXTRACTION_PROMPT
    assert '"t3":' not in OM_EXTRACTION_PROMPT


def test_om_return_schema_still_contains_y1():
    """Sanity: Y1 must remain extractable from the OM."""
    assert '"y1":' in OM_EXTRACTION_PROMPT
