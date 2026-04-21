"""PMS-agnostic rent roll normalizer.

Takes raw tabular data from any rent roll export (RealPage, Yardi, Entrata, etc.)
and returns a `NormalizationResult` with clean rows ready for
`bulk_insert_mappings` into `rent_roll_units`.

Designed to run without pandas — the Render backend is memory-constrained
(256 MB) and openpyxl already returns native Python row iterables.

Pipeline:
    1. Header detection  -- score each of the first N rows against known signal
       tokens, pick the highest scorer (must exceed min_score).
    2. Column aliasing   -- normalize header strings and match against
       COLUMN_ALIASES to build `column_mapping`.
    3. Row filtering     -- drop section banners (e.g. "Current/Notice/Vacant
       Residents"), totals, subtotals, and blank rows with a recorded reason.
    4. Coercion          -- parse dates, strip currency formatting, derive
       `is_occupied` from `status`, truncate strings to column maxes with
       warnings.

The result is PURE DATA — no DB writes. The caller Pydantic-validates each
row and inserts with savepoint fallbacks.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)


# ─── Section taxonomy ────────────────────────────────────────────────────────

class RentRollSection(str, Enum):
    """The logical section a row belongs to in a rent roll export.

    PMS exports (RealPage, Yardi, Entrata) group rows into sections separated
    by banner rows. The authoritative unit list lives under
    `CURRENT_NOTICE_VACANT`; rows under `FUTURE_APPLICANTS` are pre-leases on
    units that already exist in the current section — NOT additional physical
    units, and must be excluded from unit counts / occupancy math.
    """

    CURRENT_NOTICE_VACANT = "current_notice_vacant"
    FUTURE_APPLICANTS = "future_applicants"
    SUMMARY = "summary"
    UNKNOWN = "unknown"


# Ordered most-specific-first. Each entry: (predicate(lower_stripped_str), section).
# `future` must be checked before the bare `applicant` / `resident` rules since
# "Future Residents/Applicants" would otherwise misroute to CURRENT.
_BANNER_MATCHERS: tuple[tuple[Any, RentRollSection], ...] = (
    (lambda s: "future" in s and ("resident" in s or "applicant" in s),
     RentRollSection.FUTURE_APPLICANTS),
    (lambda s: "applicant" in s,
     RentRollSection.FUTURE_APPLICANTS),
    (lambda s: any(k in s for k in (
        "summary", "totals:", "total non rev", "total vacant",
        "charge code", "grand total", "summary of charges",
    )), RentRollSection.SUMMARY),
    (lambda s: "resident" in s and "/" in s and "applicant" not in s,
     RentRollSection.CURRENT_NOTICE_VACANT),
    (lambda s: "current" in s and (
        "notice" in s or "vacant" in s or "resident" in s
    ), RentRollSection.CURRENT_NOTICE_VACANT),
)


def classify_banner(cell_value: Any) -> Optional[RentRollSection]:
    """Return the section a banner cell introduces, or None if not a banner.

    Only non-empty strings are considered banners. Numbers, dates, None all
    return None.
    """
    if not isinstance(cell_value, str):
        return None
    s = cell_value.strip().lower()
    if not s:
        return None
    for matcher, section in _BANNER_MATCHERS:
        if matcher(s):
            return section
    return None


def classify_banner_row(cells: Iterable[Any]) -> Optional[RentRollSection]:
    """Scan a row of cells and return the banner classification, or None.

    Only rows with a single non-empty cell are treated as banners. Real
    banner rows in RealPage/Yardi exports are always lone-cell rows spanning
    the table; requiring this avoids misclassifying a legitimate unit row
    where e.g. `unit_number="APPLICANT-A1"` or `resident_name="Summer Applegate"`.
    """
    cells_list = list(cells)
    non_empty = [c for c in cells_list if not _is_blank(c)]
    if len(non_empty) != 1:
        return None
    return classify_banner(non_empty[0])


# ─── Header detection ────────────────────────────────────────────────────────

STRONG_SIGNALS = (
    "unit", "apt", "resident", "tenant", "market rent", "lease", "sqft",
    "sq ft", "floor plan", "move in", "move-in",
)
WEAK_SIGNALS = (
    "rent", "status", "occupancy", "bed", "bath",
)
STRONG_POINTS = 3
WEAK_POINTS = 1
MIN_HEADER_SCORE = 6
HEADER_SCAN_ROWS = 20


# ─── Column aliasing ─────────────────────────────────────────────────────────

COLUMN_ALIASES: dict[str, list[str]] = {
    "unit_number": [
        "unit", "unit #", "unit number", "apt", "apt #", "apt number",
        "unit no", "bldg-unit", "unit id", "apartment", "apartment #",
    ],
    "unit_type": [
        "unit type", "floor plan", "floorplan", "plan", "type", "unit style",
        "bed/bath", "floor plan code",
    ],
    "sqft": [
        "sqft", "sq ft", "square feet", "size", "sf", "unit sqft", "sq. ft.",
    ],
    "resident_name": [
        "resident", "tenant", "resident name", "tenant name", "name",
        "occupant", "primary resident",
    ],
    "status": [
        "status", "unit status", "occupancy", "occ", "lease status",
    ],
    "market_rent": [
        "market rent", "market", "asking rent", "gpr", "scheduled rent",
        "gross potential",
    ],
    "in_place_rent": [
        "in place rent", "actual rent", "current rent", "lease rent",
        "charged rent", "rent", "effective rent",
    ],
    "move_in_date": [
        "move in", "move-in", "move in date", "movein", "occupied date",
    ],
    "lease_start": [
        "lease start", "lease from", "lease begin", "start date",
        "lease start date",
    ],
    "lease_end": [
        "lease end", "lease to", "lease expiration", "expiration",
        "end date", "lease expires", "lease end date",
    ],
}


# ─── Row filtering ───────────────────────────────────────────────────────────

SECTION_HEADER_PATTERNS = (
    "current", "notice", "vacant", "resident",
    "future", "applicant", "model", "down", "admin", "employee",
    "total", "subtotal", "summary", "average", "avg", "count",
    "grand total", "report", "property", "building",
)


# ─── Column max lengths (must match the SQLAlchemy model) ────────────────────

COLUMN_MAX_LENGTHS: dict[str, int] = {
    "unit_number": 50,
    "unit_type": 50,
    "status": 100,
    "resident_name": 255,
}


# ─── Occupancy derivation ────────────────────────────────────────────────────

OCCUPIED_STATUSES = ("occupied", "current", "notice")
VACANT_STATUSES = ("vacant", "down", "model", "admin", "employee")


# ─── Result dataclass ────────────────────────────────────────────────────────

@dataclass
class FutureLease:
    """A pre-lease row captured from the Future Residents/Applicants section.

    These are incoming residents who've signed a lease but haven't moved in.
    The `unit_number` almost always duplicates an existing Current-section
    unit — this is the same physical unit, just with a future move-in.
    Captured so downstream analytics (rollover, notice-to-commit cycle time)
    can use them, but NEVER added to the physical unit count.
    """

    unit_number: Optional[str] = None
    resident_name: Optional[str] = None
    market_rent: Optional[float] = None
    lease_start: Optional[datetime] = None
    lease_end: Optional[datetime] = None
    raw_row: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizationResult:
    units: list[dict[str, Any]] = field(default_factory=list)
    future_leases: list[FutureLease] = field(default_factory=list)
    sections_detected: dict[str, int] = field(default_factory=dict)
    skipped_rows: list[dict[str, Any]] = field(default_factory=list)
    unmapped_columns: list[str] = field(default_factory=list)
    column_mapping: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    header_row_index: int = -1
    total_rows_scanned: int = 0
    error: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

_WHITESPACE_RE = re.compile(r"\s+")
_TRAILING_PUNCT_RE = re.compile(r"[:;,.\-]+$")


def _normalize_header(name: Any) -> str:
    if name is None:
        return ""
    s = str(name).strip().lower()
    s = _WHITESPACE_RE.sub(" ", s)
    s = _TRAILING_PUNCT_RE.sub("", s)
    return s


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    s = str(value).strip()
    return s == "" or s.lower() in {"n/a", "na", "-", "--", "none", "null"}


def _score_header_row(row: Iterable[Any]) -> int:
    score = 0
    for cell in row:
        header = _normalize_header(cell)
        if not header:
            continue
        if any(tok in header for tok in STRONG_SIGNALS):
            score += STRONG_POINTS
        elif any(tok in header for tok in WEAK_SIGNALS):
            score += WEAK_POINTS
    return score


def detect_header_row(
    rows: list[list[Any]], max_scan: int = HEADER_SCAN_ROWS
) -> int:
    """Return the 0-indexed row number of the best header candidate, or -1."""
    best_idx = -1
    best_score = 0
    for i, row in enumerate(rows[:max_scan]):
        score = _score_header_row(row)
        if score > best_score:
            best_score = score
            best_idx = i
    if best_score < MIN_HEADER_SCORE:
        return -1
    return best_idx


def build_column_mapping(
    headers: list[Any],
) -> tuple[dict[str, str], dict[int, str], list[str]]:
    """Match normalized headers against COLUMN_ALIASES.

    Returns:
        internal_to_original:   {"unit_number": "Apt #", ...}
        col_index_to_internal:  {3: "unit_number", ...}
        unmapped_columns:       list of original headers we didn't recognize
    """
    internal_to_original: dict[str, str] = {}
    col_index_to_internal: dict[int, str] = {}
    unmapped: list[str] = []

    for idx, raw in enumerate(headers):
        norm = _normalize_header(raw)
        if not norm:
            continue
        original = str(raw).strip()
        matched: Optional[str] = None
        # exact alias match first
        for internal, aliases in COLUMN_ALIASES.items():
            if internal in internal_to_original:
                continue
            if norm in {a.lower() for a in aliases}:
                matched = internal
                break
        # substring fallback (e.g. "Unit #" matching "unit")
        if matched is None:
            for internal, aliases in COLUMN_ALIASES.items():
                if internal in internal_to_original:
                    continue
                for alias in aliases:
                    if alias.lower() == norm:
                        matched = internal
                        break
                    # prefer exact > starts-with > contains
                    if matched is None and norm.startswith(alias.lower() + " "):
                        matched = internal
                if matched:
                    break
        if matched:
            internal_to_original[matched] = original
            col_index_to_internal[idx] = matched
        else:
            unmapped.append(original)

    return internal_to_original, col_index_to_internal, unmapped


# ─── Coercion ────────────────────────────────────────────────────────────────

_CURRENCY_STRIP_RE = re.compile(r"[\$,\s]")


def coerce_currency(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if _is_blank(s):
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    s = _CURRENCY_STRIP_RE.sub("", s)
    if s == "" or s == "-":
        return None
    try:
        val = float(s)
    except ValueError:
        return None
    return -val if negative else val


def coerce_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, float):
        return int(value)
    s = str(value).strip()
    if _is_blank(s):
        return None
    s = _CURRENCY_STRIP_RE.sub("", s)
    try:
        return int(float(s))
    except ValueError:
        return None


_DATE_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%m-%d-%Y",
    "%m-%d-%y",
    "%d-%b-%Y",
    "%d-%b-%y",
    "%Y/%m/%d",
)


def coerce_date(value: Any) -> Optional[datetime]:
    """Parse dates defensively. Excel serial ints, common US formats, ISO."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    # Excel serial date (int or float) — 1900-based
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            # Excel serial 60 is the phantom 1900-02-29; anything reasonable
            # for rent roll dates is > 25000 (1968-07-26).
            if 10000 < float(value) < 80000:
                from datetime import timedelta
                # Excel's 1900 bug: treat 1899-12-30 as epoch.
                epoch = datetime(1899, 12, 30)
                return epoch + timedelta(days=float(value))
        except (OverflowError, ValueError):
            return None
        return None
    s = str(value).strip()
    if _is_blank(s):
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def derive_is_occupied(status: Any) -> Optional[bool]:
    if status is None:
        return None
    s = str(status).strip().lower()
    if not s:
        return None
    if any(tok in s for tok in OCCUPIED_STATUSES):
        return True
    if any(tok in s for tok in VACANT_STATUSES):
        return False
    return None


def truncate_string(
    value: Any,
    max_length: int,
    field_name: str,
    row_context: str,
    warnings: list[str],
) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    if len(s) > max_length:
        warnings.append(
            f"{field_name} truncated on {row_context}: "
            f"original length {len(s)} -> {max_length}"
        )
        return s[:max_length]
    return s


# ─── Junk-row filter ─────────────────────────────────────────────────────────

_CHARGE_CODE_SHAPE_RE = re.compile(r"^[a-z]{2,6}$")


def _looks_like_charge_code(unit: dict[str, Any]) -> bool:
    """True if the row is shaped like a charge-code summary entry.

    The RealPage "Summary of Charges by Charge Code" block emits rows whose
    col-A value is a short lowercase token (`aprk`, `atra`, `mtm`, `con`,
    `arnt`, `astg`, `rrins`, `prnt`, ...) and whose other unit-defining
    fields (unit_type, sqft, resident_name, market_rent) are all blank.
    Real unit numbers are numeric / digit-bearing (`101`, `A-2`, `B-304`).
    """
    unit_num_str = str(unit.get("unit_number", "")).strip()
    if not _CHARGE_CODE_SHAPE_RE.match(unit_num_str.lower()):
        return False
    if unit_num_str != unit_num_str.lower():
        return False
    other_unit_fields = ("unit_type", "sqft", "resident_name", "market_rent")
    return all(_is_blank(unit.get(f)) for f in other_unit_fields)


def is_junk_row(unit: dict[str, Any]) -> tuple[bool, str]:
    """Returns (is_junk, reason)."""
    unit_num = unit.get("unit_number")

    if _is_blank(unit_num):
        return True, "no unit_number"

    unit_num_str = str(unit_num).strip().lower()
    if any(p in unit_num_str for p in SECTION_HEADER_PATTERNS):
        return True, f"unit_number looks like section header: {unit_num_str!r}"

    resident = str(unit.get("resident_name") or "").lower()
    if "/" in resident and any(p in resident for p in SECTION_HEADER_PATTERNS):
        return True, f"resident_name is section banner: {resident!r}"

    if _looks_like_charge_code(unit):
        return True, f"charge_code_shaped row (unit_number={unit_num_str!r})"

    key_fields = ("unit_number", "resident_name", "market_rent", "in_place_rent")
    if all(_is_blank(unit.get(f)) for f in key_fields):
        return True, "all key fields blank"

    return False, ""


# ─── Entry points ────────────────────────────────────────────────────────────

def normalize_rows(rows: list[list[Any]]) -> NormalizationResult:
    """Full pipeline: detect header, alias columns, filter junk, coerce.

    `rows` is a list of rows; each row is a list of cell values in column order.
    """
    result = NormalizationResult(total_rows_scanned=len(rows))

    if not rows:
        result.error = "empty input: no rows"
        return result

    header_idx = detect_header_row(rows)
    result.header_row_index = header_idx
    if header_idx < 0:
        result.error = (
            "could not identify header row — no row scored above "
            f"{MIN_HEADER_SCORE}. "
            "Check that the file contains columns like 'Unit', 'Resident', "
            "'Market Rent', 'Lease Start'."
        )
        return result

    header_row = rows[header_idx]
    internal_to_original, col_to_internal, unmapped = build_column_mapping(
        list(header_row)
    )
    result.column_mapping = internal_to_original
    result.unmapped_columns = unmapped

    logger.info(
        "Rent roll header detected at row %d; mapping=%s; unmapped=%s",
        header_idx, internal_to_original, unmapped,
    )

    data_rows = rows[header_idx + 1:]
    current_section = RentRollSection.UNKNOWN
    for offset, raw_row in enumerate(data_rows):
        row_index = header_idx + 1 + offset
        raw_dict: dict[str, Any] = {}
        for col_idx, internal in col_to_internal.items():
            if col_idx < len(raw_row):
                raw_dict[internal] = raw_row[col_idx]

        banner = classify_banner_row(raw_row)
        if banner is not None:
            current_section = banner
            result.skipped_rows.append({
                "row_index": row_index,
                "reason": f"section header banner: {banner.value}",
                "raw": raw_dict,
            })
            continue

        _dispatch_row(result, raw_dict, row_index, current_section)

    _finalize_section_warnings(result)
    return result


def _dispatch_row(
    result: NormalizationResult,
    raw_dict: dict[str, Any],
    row_index: int,
    section: RentRollSection,
) -> None:
    """Coerce a data row and route it by section.

    Section policy:
      - CURRENT_NOTICE_VACANT: accept unless the content-level `is_junk_row`
        check rejects it.
      - FUTURE_APPLICANTS: capture as a FutureLease (if it has a unit_number);
        never add to `units`. This is what keeps pre-leases out of unit counts.
      - SUMMARY: skip entirely.
      - UNKNOWN: fall back to content-level junk filtering. Preserves
        backward-compat with files that don't use standard banner language.
    """
    coerced = _coerce_unit(raw_dict, result.warnings, row_index)

    if section == RentRollSection.SUMMARY:
        result.skipped_rows.append({
            "row_index": row_index,
            "reason": "summary_section",
            "raw": raw_dict,
        })
        _bump_section(result, section)
        return

    if section == RentRollSection.FUTURE_APPLICANTS:
        if _is_blank(coerced.get("unit_number")):
            result.skipped_rows.append({
                "row_index": row_index,
                "reason": "future_applicants_section_blank_row",
                "raw": raw_dict,
            })
        else:
            result.future_leases.append(FutureLease(
                unit_number=coerced.get("unit_number"),
                resident_name=coerced.get("resident_name"),
                market_rent=coerced.get("market_rent"),
                lease_start=coerced.get("lease_start"),
                lease_end=coerced.get("lease_end"),
                raw_row=dict(raw_dict),
            ))
            result.skipped_rows.append({
                "row_index": row_index,
                "reason": "future_resident_pre_lease",
                "raw": raw_dict,
            })
        _bump_section(result, section)
        return

    # CURRENT_NOTICE_VACANT and UNKNOWN share the content-level junk gate.
    junk, reason = is_junk_row(coerced)
    if junk:
        result.skipped_rows.append({
            "row_index": row_index,
            "reason": reason,
            "raw": raw_dict,
        })
        _bump_section(result, section)
        return

    result.units.append(coerced)
    _bump_section(result, section)


def _bump_section(result: NormalizationResult, section: RentRollSection) -> None:
    result.sections_detected[section.value] = (
        result.sections_detected.get(section.value, 0) + 1
    )


def _finalize_section_warnings(result: NormalizationResult) -> None:
    """Emit a warning if any units were accepted before a section banner was seen.

    Signals that either the file lacks standard banner language (harmless) or
    header detection picked up the wrong row (worth investigating).
    """
    unknown_count = result.sections_detected.get(
        RentRollSection.UNKNOWN.value, 0
    )
    if unknown_count > 0 and result.sections_detected.get(
        RentRollSection.CURRENT_NOTICE_VACANT.value, 0
    ) == 0:
        result.warnings.append(
            f"{unknown_count} rows ingested before any section banner was seen "
            "— header/banner detection may be off."
        )


def normalize_units(
    units: list[dict[str, Any]],
    column_mapping: Optional[dict[str, str]] = None,
) -> NormalizationResult:
    """Partial pipeline: no header detection, operates on already-extracted dicts.

    Used to wrap the legacy openpyxl-based extractor
    (`excel_extraction_service.extract_rent_roll`) so this PR doesn't have to
    rewrite the Excel parser. The rows already have internal field names, so
    this only does junk filtering, coercion, and truncation.
    """
    result = NormalizationResult(
        total_rows_scanned=len(units),
        column_mapping=column_mapping or {},
        header_row_index=-1 if column_mapping is None else 0,
    )

    current_section = RentRollSection.UNKNOWN
    for i, raw in enumerate(units):
        # Banner rows arrive as unit dicts with the banner text in
        # unit_number or resident_name. Require no numeric data to be present
        # — a real unit row always has rent or sqft and should never be
        # reclassified as a banner even if the text happens to match.
        banner = (
            classify_banner(raw.get("unit_number"))
            or classify_banner(raw.get("resident_name"))
        )
        if banner is not None and _is_banner_shaped_dict(raw):
            current_section = banner
            result.skipped_rows.append({
                "row_index": i,
                "reason": f"section header banner: {banner.value}",
                "raw": raw,
            })
            continue

        _dispatch_row(result, raw, i, current_section)

    _finalize_section_warnings(result)
    return result


def _is_banner_shaped_dict(raw: dict[str, Any]) -> bool:
    """True if the row dict looks like a banner (no numeric rent/sqft data).

    The upstream openpyxl extractor initializes `in_place_rent` to 0 on
    every emitted dict; treat 0 as blank so the Future Residents banner
    still qualifies.
    """
    def _blank_or_zero(v: Any) -> bool:
        if _is_blank(v):
            return True
        return isinstance(v, (int, float)) and not isinstance(v, bool) and v == 0

    return all(
        _blank_or_zero(raw.get(f))
        for f in ("market_rent", "in_place_rent", "sqft")
    )


def _coerce_unit(
    raw: dict[str, Any], warnings: list[str], row_index: int
) -> dict[str, Any]:
    """Apply per-field coercion to a raw row dict keyed by internal field names."""
    unit_number_raw = raw.get("unit_number")
    row_context = f"row {row_index} (unit={unit_number_raw!r})"

    out: dict[str, Any] = {}
    out["unit_number"] = truncate_string(
        raw.get("unit_number"),
        COLUMN_MAX_LENGTHS["unit_number"],
        "unit_number", row_context, warnings,
    )
    out["unit_type"] = truncate_string(
        raw.get("unit_type"),
        COLUMN_MAX_LENGTHS["unit_type"],
        "unit_type", row_context, warnings,
    )
    out["sqft"] = coerce_int(raw.get("sqft"))

    status_val = truncate_string(
        raw.get("status"),
        COLUMN_MAX_LENGTHS["status"],
        "status", row_context, warnings,
    )
    out["status"] = status_val

    # Prefer explicit is_occupied if the raw row already has it; otherwise derive.
    if "is_occupied" in raw and raw["is_occupied"] is not None:
        out["is_occupied"] = bool(raw["is_occupied"])
    else:
        out["is_occupied"] = derive_is_occupied(status_val)

    out["resident_name"] = truncate_string(
        raw.get("resident_name"),
        COLUMN_MAX_LENGTHS["resident_name"],
        "resident_name", row_context, warnings,
    )

    out["move_in_date"] = coerce_date(raw.get("move_in_date"))
    out["lease_start"] = coerce_date(raw.get("lease_start"))
    out["lease_end"] = coerce_date(raw.get("lease_end"))

    out["market_rent"] = coerce_currency(raw.get("market_rent"))
    out["in_place_rent"] = coerce_currency(raw.get("in_place_rent"))

    charge_details = raw.get("charge_details")
    if isinstance(charge_details, dict):
        out["charge_details"] = charge_details
    else:
        out["charge_details"] = None

    return out
