"""
Excel Extraction Service — Rent Rolls and T-12 Operating Statements

This service parses Rent Roll and T-12 Excel files using openpyxl and extracts structured data.
Uses a hybrid approach: fuzzy keyword matching (Tier 1) with Claude AI fallback (Tier 2).
Uses direct parsing with intelligent header detection and fuzzy matching via rapidfuzz.
"""
import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet
from rapidfuzz import fuzz, process

from app.services.t12_taxonomy import T12_TAXONOMY, TAXONOMY_TO_SUMMARY_FIELD

logger = logging.getLogger(__name__)


# ==================== FUZZY MATCHING ENGINE ====================

def match_line_item(raw_label: str, taxonomy: dict, threshold: int = 70) -> Optional[str]:
    """
    Match a raw Excel line item label to a canonical taxonomy key.
    Returns the taxonomy key (e.g. 'gsr', 'noi') or None.

    Uses a 3-tier matching strategy:
    1. Exact abbreviation match
    2. Regex pattern match
    3. Fuzzy string match against all keywords
    """
    cleaned = raw_label.strip().lower()
    cleaned = re.sub(r'^[\d\-\.]+\s*', '', cleaned)  # Strip leading GL codes
    cleaned = re.sub(r'\s+', ' ', cleaned)

    if not cleaned or len(cleaned) < 2:
        return None

    # Skip lines that are clearly section headers or separators
    skip_patterns = [
        r'^[\-=_]+$',  # separator lines
        r'^page\s+\d+',
        r'^total\s*$',  # bare "Total" without context
    ]
    for sp in skip_patterns:
        if re.match(sp, cleaned):
            return None

    # 1. Exact abbreviation match
    for key, entry in taxonomy.items():
        if cleaned in [a.lower() for a in entry["abbreviations"]]:
            return key

    # 2. Regex pattern match
    for key, entry in taxonomy.items():
        for pattern in entry["patterns"]:
            if re.search(pattern, cleaned, re.IGNORECASE):
                return key

    # 3. Fuzzy string match against all keywords
    all_keywords = []
    for key, entry in taxonomy.items():
        for kw in entry["keywords"]:
            all_keywords.append((kw, key))

    keyword_strings = [kw for kw, _ in all_keywords]
    match = process.extractOne(cleaned, keyword_strings, scorer=fuzz.token_sort_ratio)
    if match and match[1] >= threshold:
        matched_keyword = match[0]
        for kw, key in all_keywords:
            if kw == matched_keyword:
                return key

    return None


def detect_t12_layout(worksheet) -> dict:
    """
    Scan the worksheet to detect:
    - Which row has month headers
    - Which column has line item labels
    - Which column has the annual total
    - Whether there are GL code columns
    """
    layout = {
        "header_row": None,
        "label_col": None,
        "total_col": None,
        "month_cols": [],
        "has_gl_codes": False,
        "data_start_row": None,
    }

    month_names = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ]
    total_keywords = [
        "total", "annual", "year", "ytd", "t-12", "t12",
        "trailing", "12 month", "12-month", "twelve month",
        "annualized", "combined",
    ]

    # Scan first 20 rows to find month headers
    for row_idx, row in enumerate(worksheet.iter_rows(max_row=20, values_only=False)):
        month_count = 0
        month_cols_found = []
        for cell in row:
            val = str(cell.value).strip().lower() if cell.value else ""
            # Check for month names or date objects
            if any(m in val for m in month_names):
                month_count += 1
                month_cols_found.append(cell.column - 1)
            elif hasattr(cell.value, 'month'):  # datetime object
                month_count += 1
                month_cols_found.append(cell.column - 1)

        if month_count >= 6:
            layout["header_row"] = row_idx
            layout["month_cols"] = month_cols_found
            layout["data_start_row"] = row_idx + 1

            # Find total column in same row
            for cell in row:
                val = str(cell.value).strip().lower() if cell.value else ""
                if any(tk in val for tk in total_keywords):
                    layout["total_col"] = cell.column - 1
            break

    # Detect label column: find the column with the most text strings
    # in rows after the header
    if layout["data_start_row"] is not None:
        col_text_counts = {}
        for row in worksheet.iter_rows(
            min_row=layout["data_start_row"] + 1,
            max_row=min(layout["data_start_row"] + 40, worksheet.max_row),
            values_only=False
        ):
            for cell in row:
                if cell.value and isinstance(cell.value, str) and len(cell.value.strip()) > 2:
                    col_idx = cell.column - 1
                    if col_idx not in layout["month_cols"] and col_idx != layout.get("total_col"):
                        col_text_counts[col_idx] = col_text_counts.get(col_idx, 0) + 1

        if col_text_counts:
            layout["label_col"] = max(col_text_counts, key=col_text_counts.get)
            if layout["label_col"] > 0:
                layout["has_gl_codes"] = True

    return layout


# ==================== DOCUMENT CLASSIFICATION ====================

def classify_excel_document(filepath: str) -> str:
    """
    Classify an Excel file as 'rent_roll', 't12', or 'unknown'.

    Heuristics:
    - Rent Roll: Look for columns like "Unit", "SQFT", "Lease Start", "Lease End", "Market Rent", "Resident"
    - T-12: Look for monthly column headers (Jan/January, Feb/February, ...) and financial line items
    - Check sheet names too — "Rent Roll" in sheet name is a strong signal

    Returns: "rent_roll", "t12", or "unknown"
    """
    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    except Exception as e:
        logger.warning(f"Could not open workbook for classification: {e}")
        return "unknown"

    try:
        # Check sheet names
        sheet_names_lower = [s.lower() for s in wb.sheetnames]

        # Strong signals from sheet names
        for name in sheet_names_lower:
            if any(kw in name for kw in ["rent roll", "rentroll", "rr", "unit"]):
                wb.close()
                return "rent_roll"
            if any(kw in name for kw in ["t12", "t-12", "operating", "financials", "income", "statement"]):
                wb.close()
                return "t12"

        # Check first sheet headers
        ws = wb.worksheets[0] if wb.worksheets else None
        if ws is None:
            wb.close()
            return "unknown"

        # Collect first 15 rows of text
        headers_text = []
        for row in ws.iter_rows(min_row=1, max_row=15, values_only=True):
            for cell in row:
                if cell is not None:
                    headers_text.append(str(cell).lower().strip())

        header_blob = " ".join(headers_text)

        # Rent roll keywords
        rr_keywords = ["unit", "sqft", "sq ft", "lease start", "lease end", "market rent",
                       "resident", "tenant", "move in", "status", "occupied", "vacant", "charge"]
        rr_score = sum(1 for kw in rr_keywords if kw in header_blob)

        # T12 keywords
        t12_keywords = ["january", "february", "march", "april", "may", "june", "july", "august",
                        "september", "october", "november", "december", "jan", "feb", "mar", "apr",
                        "gross potential rent", "vacancy", "noi", "operating expenses", "revenue"]
        t12_score = sum(1 for kw in t12_keywords if kw in header_blob)

        wb.close()

        # Decision
        if rr_score >= 3:
            return "rent_roll"
        elif t12_score >= 3:
            return "t12"
        else:
            return "unknown"

    except Exception as e:
        logger.exception(f"Error classifying document: {e}")
        wb.close()
        return "unknown"


# ==================== DATE PARSING ====================

def parse_date_from_filename(filename: str) -> Optional[datetime]:
    """
    Try to extract a date from the filename.

    Common patterns:
    - "1160_Hammond_RR_1_28_26.xlsx" → 2026-01-28
    - "Property_RentRoll_2026-01-28.xlsx" → 2026-01-28
    - "RR_01282026.xlsx" → 2026-01-28
    - "T12_FY_2025.xlsx" → 2025-12-31 (end of fiscal year)
    - "1160_Hammond_FY_2025_T12.xlsx" → 2025-12-31

    Returns None if no date can be parsed.
    """
    if not filename:
        return None

    # Pattern 1: YYYY-MM-DD or YYYY_MM_DD
    match = re.search(r'(\d{4})[-_](\d{1,2})[-_](\d{1,2})', filename)
    if match:
        try:
            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            return datetime(year, month, day)
        except (ValueError, TypeError):
            pass

    # Pattern 2: MM_DD_YY or MM-DD-YY
    match = re.search(r'(\d{1,2})[-_](\d{1,2})[-_](\d{2})', filename)
    if match:
        try:
            month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            year = 2000 + year if year < 100 else year
            return datetime(year, month, day)
        except (ValueError, TypeError):
            pass

    # Pattern 3: MMDDYYYY or MMDDYY
    match = re.search(r'(\d{2})(\d{2})(\d{4})', filename)
    if match:
        try:
            month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            return datetime(year, month, day)
        except (ValueError, TypeError):
            pass

    match = re.search(r'(\d{2})(\d{2})(\d{2})', filename)
    if match:
        try:
            month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            year = 2000 + year if year < 100 else year
            return datetime(year, month, day)
        except (ValueError, TypeError):
            pass

    # Pattern 4: FY_YYYY or FY YYYY (fiscal year — use end of year)
    match = re.search(r'FY[_\s]?(\d{4})', filename, re.IGNORECASE)
    if match:
        try:
            year = int(match.group(1))
            return datetime(year, 12, 31)
        except (ValueError, TypeError):
            pass

    # Pattern 5: Just YYYY (assume end of year)
    match = re.search(r'\b(20\d{2})\b', filename)
    if match:
        try:
            year = int(match.group(1))
            return datetime(year, 12, 31)
        except (ValueError, TypeError):
            pass

    return None


# ==================== RENT ROLL EXTRACTION ====================

def extract_rent_roll(filepath: str) -> Dict[str, Any]:
    """
    Parse a rent roll Excel file and return structured data.

    The extraction must handle the common rent roll format where:
    - Each unit has a primary row with: unit number, unit type, sqft, status, resident, lease dates, market rent
    - Below each unit row are charge detail rows (Rent, Internet, Parking, Valet Trash, etc.)
    - A "Charge Total" row aggregates all charges for that unit
    - A summary row at the bottom has property totals

    Returns:
    {
        "document_date": "2026-01-28",
        "property_name": "1160 Hammond",
        "units": [...],
        "summary": {...}
    }
    """
    try:
        wb = openpyxl.load_workbook(filepath, read_only=False, data_only=True)
        ws = wb.worksheets[0]  # Assume first sheet

        # Step 1: Extract document date from first 5 rows
        document_date = _extract_document_date_from_sheet(ws)

        # Step 2: Extract property name from first 5 rows
        property_name = _extract_property_name_from_sheet(ws)

        # Step 3: Find header row
        header_row_num, headers = _find_rent_roll_header(ws)
        if header_row_num == 0:
            logger.warning("Could not find rent roll header row")
            wb.close()
            return {
                "document_date": None,
                "property_name": property_name,
                "units": [],
                "summary": {}
            }

        # Step 4: Parse units
        units = _parse_rent_roll_units(ws, header_row_num, headers)

        # Step 5: Calculate summary
        summary = _calculate_rent_roll_summary(units)

        wb.close()

        return {
            "document_date": document_date.isoformat() if document_date else None,
            "property_name": property_name,
            "units": units,
            "summary": summary
        }

    except Exception as e:
        logger.exception(f"Error extracting rent roll: {e}")
        return {
            "document_date": None,
            "property_name": None,
            "units": [],
            "summary": {},
            "error": str(e)
        }


def _extract_document_date_from_sheet(ws: Worksheet) -> Optional[datetime]:
    """Look for a date in the first 5 rows"""
    for row_idx in range(1, 6):
        for cell in ws[row_idx]:
            if cell.value is None:
                continue

            # Check if cell contains a datetime object
            if isinstance(cell.value, datetime):
                return cell.value

            # Try to parse as date string
            cell_str = str(cell.value).strip()
            # Common patterns
            for fmt in ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y", "%B %d, %Y"]:
                try:
                    return datetime.strptime(cell_str, fmt)
                except (ValueError, TypeError):
                    continue

    return None


def _extract_property_name_from_sheet(ws: Worksheet) -> Optional[str]:
    """Extract property name from first 5 rows"""
    for row_idx in range(1, 6):
        for cell in ws[row_idx]:
            if cell.value is None:
                continue

            cell_str = str(cell.value).strip()
            # Property names are usually in larger text in the first few rows
            # Look for patterns like "1160 Hammond" or "Property Name"
            if len(cell_str) > 5 and len(cell_str) < 100:
                # Skip if it looks like a date or number
                if not re.match(r'^\d+[/\-]\d+', cell_str) and not cell_str.lower() in ["unit", "status", "resident"]:
                    return cell_str

    return None


def _find_rent_roll_header(ws: Worksheet, max_scan: int = 15) -> Tuple[int, Dict[int, str]]:
    """
    Find the header row in a rent roll.
    Returns (row_number, {col_index: header_name})
    """
    keywords = ["unit", "sqft", "sq ft", "sf", "status", "rent", "resident", "tenant",
                "lease", "move in", "market", "type", "bldg"]

    best_row = 0
    best_headers = {}
    best_score = 0

    for row_idx in range(1, max_scan + 1):
        row = ws[row_idx]
        headers_dict = {}
        score = 0

        for col_idx, cell in enumerate(row, start=1):
            if cell.value is not None:
                header = str(cell.value).strip()
                headers_dict[col_idx] = header

                # Score this header
                header_lower = header.lower()
                if any(kw in header_lower for kw in keywords):
                    score += 1

        if score > best_score and len(headers_dict) >= 4:  # At least 4 columns
            best_score = score
            best_row = row_idx
            best_headers = headers_dict

    return best_row, best_headers


def _parse_rent_roll_units(ws: Worksheet, header_row: int, headers: Dict[int, str]) -> List[Dict[str, Any]]:
    """
    Parse unit rows from rent roll.

    Each unit has:
    - A primary row with unit info
    - Optional charge detail rows below it
    - A "Charge Total" row (or the primary row itself has the total)
    """
    # Map headers to column indices
    col_map = _map_rent_roll_columns(headers)

    units = []
    current_unit = None
    charge_details = {}

    for row_idx in range(header_row + 1, ws.max_row + 1):
        row = ws[row_idx]

        # Get first column value (usually unit number or charge name)
        first_col = _get_cell_value(row, 1)
        if first_col is None or str(first_col).strip() == "":
            continue

        first_col_str = str(first_col).strip()

        # Check if this is a summary row (skip it)
        if any(kw in first_col_str.lower() for kw in ["total", "summary", "grand total", "property"]):
            break

        # Check if this is a charge detail row
        if first_col_str.lower() in ["rent", "amenity rent", "internet", "parking", "parking fee",
                                     "package concierge", "valet trash", "trash", "pet rent", "garage",
                                     "storage", "utility", "water", "sewer", "cable", "admin fee"]:
            # This is a charge detail row
            charge_name = first_col_str
            charge_amount = _get_numeric_value(row, col_map.get("in_place_rent", col_map.get("rent", 0)))
            if charge_amount:
                charge_details[charge_name] = charge_amount
            continue

        # Check if this is a "Charge Total" row
        if "charge total" in first_col_str.lower() or "total charges" in first_col_str.lower():
            if current_unit is not None:
                # Set the in_place_rent to the charge total
                total = _get_numeric_value(row, col_map.get("in_place_rent", col_map.get("rent", 0)))
                if total:
                    current_unit["in_place_rent"] = total
                current_unit["charge_details"] = charge_details.copy()
                charge_details = {}
            continue

        # Otherwise, this is a new unit row
        # Save previous unit if exists
        if current_unit is not None:
            # If we have charge details but no explicit total, sum them
            if charge_details and current_unit.get("in_place_rent") == 0:
                current_unit["in_place_rent"] = sum(charge_details.values())
            current_unit["charge_details"] = charge_details.copy()
            units.append(current_unit)
            charge_details = {}

        # Parse new unit
        current_unit = _parse_unit_row(row, col_map)

    # Don't forget the last unit
    if current_unit is not None:
        if charge_details and current_unit.get("in_place_rent") == 0:
            current_unit["in_place_rent"] = sum(charge_details.values())
        current_unit["charge_details"] = charge_details.copy()
        units.append(current_unit)

    return units


def _map_rent_roll_columns(headers: Dict[int, str]) -> Dict[str, int]:
    """Map standardized field names to column indices"""
    col_map = {}

    for col_idx, header in headers.items():
        header_lower = header.lower().strip()

        # Unit identification
        if any(kw in header_lower for kw in ["bldg-unit", "unit", "unit #", "unit number", "apt", "apartment"]):
            if "unit" not in col_map:  # Prefer first match
                col_map["unit"] = col_idx

        # Unit type
        if "type" in header_lower and "property" not in header_lower:
            col_map["unit_type"] = col_idx

        # Square footage
        if any(kw in header_lower for kw in ["sqft", "sq ft", "sf", "square"]):
            col_map["sqft"] = col_idx

        # Status
        if "status" in header_lower:
            col_map["status"] = col_idx

        # Resident
        if any(kw in header_lower for kw in ["resident", "tenant", "name"]):
            if "resident" not in col_map:
                col_map["resident"] = col_idx

        # Move in date
        if "move in" in header_lower:
            col_map["move_in"] = col_idx

        # Lease dates
        if "lease" in header_lower:
            if "start" in header_lower or "from" in header_lower:
                col_map["lease_start"] = col_idx
            elif "end" in header_lower or "to" in header_lower or "expire" in header_lower:
                col_map["lease_end"] = col_idx

        # Rents
        if "market" in header_lower and "rent" in header_lower:
            col_map["market_rent"] = col_idx
        elif any(kw in header_lower for kw in ["in place", "in-place", "current rent", "actual rent", "charge", "rent"]):
            if "in_place_rent" not in col_map:
                col_map["in_place_rent"] = col_idx

    return col_map


def _parse_unit_row(row, col_map: Dict[str, int]) -> Dict[str, Any]:
    """Parse a single unit row"""
    unit = {
        "unit_number": _get_cell_value(row, col_map.get("unit", 1)),
        "unit_type": _get_cell_value(row, col_map.get("unit_type")),
        "sqft": _get_numeric_value(row, col_map.get("sqft")),
        "status": _get_cell_value(row, col_map.get("status")),
        "is_occupied": True,  # Will be determined below
        "resident_name": _get_cell_value(row, col_map.get("resident")),
        "move_in_date": _get_date_value(row, col_map.get("move_in")),
        "lease_start": _get_date_value(row, col_map.get("lease_start")),
        "lease_end": _get_date_value(row, col_map.get("lease_end")),
        "market_rent": _get_numeric_value(row, col_map.get("market_rent")),
        "in_place_rent": _get_numeric_value(row, col_map.get("in_place_rent")) or 0,
        "charge_details": {}
    }

    # Determine occupancy from status
    status_lower = str(unit["status"]).lower() if unit["status"] else ""
    if any(kw in status_lower for kw in ["vacant", "unrented", "model", "employee"]):
        unit["is_occupied"] = False

    return unit


def _get_cell_value(row, col_idx: Optional[int]) -> Optional[str]:
    """Get cell value as string"""
    if col_idx is None or col_idx < 1 or col_idx > len(row):
        return None
    cell = row[col_idx - 1]  # row is 0-indexed
    if cell.value is None:
        return None
    return str(cell.value).strip()


def _get_numeric_value(row, col_idx: Optional[int]) -> Optional[float]:
    """Get cell value as number"""
    if col_idx is None or col_idx < 1 or col_idx > len(row):
        return None
    cell = row[col_idx - 1]
    if cell.value is None:
        return None

    # Try direct conversion
    try:
        return float(cell.value)
    except (ValueError, TypeError):
        pass

    # Try parsing string
    try:
        val_str = str(cell.value).replace(",", "").replace("$", "").strip()
        return float(val_str)
    except (ValueError, TypeError):
        return None


def _get_date_value(row, col_idx: Optional[int]) -> Optional[datetime]:
    """Get cell value as datetime"""
    if col_idx is None or col_idx < 1 or col_idx > len(row):
        return None
    cell = row[col_idx - 1]
    if cell.value is None:
        return None

    # If already datetime
    if isinstance(cell.value, datetime):
        return cell.value

    # Try parsing common date formats
    val_str = str(cell.value).strip()
    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y"]:
        try:
            return datetime.strptime(val_str, fmt)
        except (ValueError, TypeError):
            continue

    return None


def _calculate_rent_roll_summary(units: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate summary statistics for rent roll"""
    if not units:
        return {}

    # Filter out non-revenue units (model, employee)
    revenue_units = [u for u in units if u.get("status") and
                     not any(kw in str(u["status"]).lower() for kw in ["model", "employee"])]

    total_units = len(revenue_units)
    occupied_units = sum(1 for u in revenue_units if u.get("is_occupied"))
    vacant_units = total_units - occupied_units

    # Calculate averages (only for occupied units with data)
    market_rents = [u["market_rent"] for u in revenue_units if u.get("market_rent")]
    in_place_rents = [u["in_place_rent"] for u in revenue_units if u.get("is_occupied") and u.get("in_place_rent")]
    sqfts = [u["sqft"] for u in revenue_units if u.get("sqft")]

    avg_market_rent = sum(market_rents) / len(market_rents) if market_rents else None
    avg_in_place_rent = sum(in_place_rents) / len(in_place_rents) if in_place_rents else None
    avg_sqft = sum(sqfts) / len(sqfts) if sqfts else None

    # Physical occupancy
    physical_occupancy_pct = (occupied_units / total_units * 100) if total_units > 0 else 0

    # Loss to lease
    loss_to_lease_pct = None
    if avg_market_rent and avg_in_place_rent and avg_market_rent > 0:
        loss_to_lease_pct = ((avg_market_rent - avg_in_place_rent) / avg_market_rent) * 100

    return {
        "total_units": total_units,
        "occupied_units": occupied_units,
        "vacant_units": vacant_units,
        "physical_occupancy_pct": round(physical_occupancy_pct, 2) if physical_occupancy_pct else None,
        "avg_market_rent": round(avg_market_rent, 2) if avg_market_rent else None,
        "avg_in_place_rent": round(avg_in_place_rent, 2) if avg_in_place_rent else None,
        "avg_sqft": round(avg_sqft, 2) if avg_sqft else None,
        "loss_to_lease_pct": round(loss_to_lease_pct, 2) if loss_to_lease_pct else None
    }


# ==================== T-12 EXTRACTION ====================

def extract_t12(filepath: str) -> Dict[str, Any]:
    """
    Parse a T-12 operating statement Excel file and return structured data.

    Returns:
    {
        "fiscal_year": 2025,
        "property_name": "1160 Hammond",
        "summary": {...},
        "monthly": {...},
        "line_items": {...}
    }
    """
    try:
        wb = openpyxl.load_workbook(filepath, read_only=False, data_only=True)
        ws = wb.worksheets[0]

        # Step 1: Find month header row and year
        month_row, month_cols, fiscal_year = _find_t12_month_headers(ws)
        if month_row == 0:
            logger.warning("Could not find T-12 month headers")
            wb.close()
            return {
                "fiscal_year": None,
                "property_name": None,
                "summary": {},
                "monthly": {},
                "line_items": {}
            }

        # Step 2: Find "Total Year" column
        total_col = _find_total_year_column(ws, month_row)

        # Step 2b: Detect layout — find the label column adaptively
        layout = detect_t12_layout(ws)
        label_col = layout.get("label_col")
        if label_col is not None:
            logger.info("T12 layout detection: label_col=%d, has_gl_codes=%s",
                        label_col, layout.get("has_gl_codes"))

        # Step 3: Extract property name
        property_name = _extract_property_name_from_sheet(ws)

        # Step 4: Parse all line items (using detected label column)
        line_items = _parse_t12_line_items(ws, month_row, month_cols, total_col,
                                           label_col=label_col)

        # Step 5: Extract summary values
        summary = _extract_t12_summary(line_items, total_col)

        # Step 6: Extract monthly data for key metrics
        monthly = _extract_t12_monthly(line_items, month_cols)

        # Calculate ratios
        if summary.get("total_revenue") and summary.get("total_revenue") > 0:
            summary["expense_ratio_pct"] = round((summary.get("total_operating_expenses", 0) / summary["total_revenue"]) * 100, 2)
            summary["noi_margin_pct"] = round((summary.get("net_operating_income", 0) / summary["total_revenue"]) * 100, 2)

        wb.close()

        return {
            "fiscal_year": fiscal_year,
            "property_name": property_name,
            "summary": summary,
            "monthly": monthly,
            "line_items": line_items,
            "expense_ratio_pct": summary.get("expense_ratio_pct"),
            "noi_margin_pct": summary.get("noi_margin_pct")
        }

    except Exception as e:
        logger.exception(f"Error extracting T-12: {e}")
        return {
            "fiscal_year": None,
            "property_name": None,
            "summary": {},
            "monthly": {},
            "line_items": {},
            "error": str(e)
        }


def _find_t12_month_headers(ws: Worksheet, max_scan: int = 20) -> Tuple[int, Dict[str, int], Optional[int]]:
    """
    Find the row with month headers (Jan, Feb, ...).
    Returns (row_number, {month_name: col_index}, fiscal_year)

    Handles month headers as:
    - Text strings: "Jan", "January", "Jan-25", "Jan 2025"
    - Date values: datetime(2025, 1, 1) (common in Yardi/RealPage exports)
    - Numeric month references: "1/2025", "01/25"
    """
    month_names = ["january", "february", "march", "april", "may", "june",
                   "july", "august", "september", "october", "november", "december"]
    month_abbr = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

    for row_idx in range(1, max_scan + 1):
        row = ws[row_idx]
        month_cols = {}
        fiscal_year = None

        # Check if this row contains month names
        for col_idx, cell in enumerate(row, start=1):
            if cell.value is None:
                continue

            matched = False

            # Handle datetime objects (Excel date values for month headers)
            if isinstance(cell.value, datetime):
                month_idx = cell.value.month - 1  # 0-indexed
                month_cols[month_abbr[month_idx].capitalize()] = col_idx
                # Track fiscal year from the date values
                if fiscal_year is None or cell.value.year > fiscal_year:
                    fiscal_year = cell.value.year
                matched = True

            if not matched:
                cell_str = str(cell.value).lower().strip()

                # Check for month names or abbreviations
                for i, month_name in enumerate(month_names):
                    if month_name in cell_str or month_abbr[i] in cell_str:
                        month_cols[month_abbr[i].capitalize()] = col_idx
                        # Try to extract year from the same cell (e.g., "Jan-25", "Jan 2025")
                        year_match = re.search(r'(20\d{2})', cell_str)
                        if year_match:
                            fiscal_year = int(year_match.group(1))
                        elif re.search(r'[\-/](\d{2})$', cell_str):
                            # Handle 2-digit year like "Jan-25"
                            yr2 = re.search(r'[\-/](\d{2})$', cell_str)
                            if yr2:
                                yr = int(yr2.group(1))
                                fiscal_year = 2000 + yr if yr < 100 else yr
                        break

        # If we found at least 6 months, this is probably the header row
        if len(month_cols) >= 6:
            # Try to find fiscal year from the row above (if not already found from dates)
            if fiscal_year is None and row_idx > 1:
                prev_row = ws[row_idx - 1]
                for cell in prev_row:
                    if cell.value and isinstance(cell.value, (int, float)):
                        year = int(cell.value)
                        if 2000 <= year <= 2100:
                            fiscal_year = year
                            break
                    elif cell.value:
                        # Try parsing year from string
                        match = re.search(r'(20\d{2})', str(cell.value))
                        if match:
                            fiscal_year = int(match.group(1))
                            break

            logger.info("T12 month headers found at row %d with %d months, fiscal_year=%s",
                        row_idx, len(month_cols), fiscal_year)
            return row_idx, month_cols, fiscal_year

    logger.warning("T12 month headers NOT found after scanning %d rows", max_scan)
    return 0, {}, None


def _find_total_year_column(ws: Worksheet, month_row: int) -> Optional[int]:
    """Find the 'Total Year' or 'Annual' column"""
    row = ws[month_row]

    for col_idx, cell in enumerate(row, start=1):
        if cell.value is None:
            continue

        cell_str = str(cell.value).lower().strip()
        if any(kw in cell_str for kw in ["total", "annual", "year", "ytd"]):
            return col_idx

    # If not found, assume it's the last column with data
    max_col = 0
    for col_idx, cell in enumerate(row, start=1):
        if cell.value is not None:
            max_col = col_idx

    return max_col if max_col > 0 else None


def _parse_t12_line_items(ws: Worksheet, month_row: int, month_cols: Dict[str, int],
                          total_col: Optional[int],
                          label_col: Optional[int] = None) -> Dict[str, Dict[str, Any]]:
    """
    Parse all line items from T-12 with monthly values.
    Returns: {"Line Item Name": {"Jan": 123, "Feb": 456, ..., "Total": 7890}}

    label_col: 0-indexed column for line item labels (auto-detected or column A fallback)
    """
    line_items = {}
    label_col_idx = label_col if label_col is not None else 0

    for row_idx in range(month_row + 1, ws.max_row + 1):
        row = ws[row_idx]

        # Get line item name from detected label column
        if label_col_idx >= len(row):
            continue
        item_name_cell = row[label_col_idx]
        if item_name_cell.value is None:
            continue

        item_name = str(item_name_cell.value).strip()

        # Skip empty or separator rows
        if not item_name or len(item_name) < 2:
            continue

        # Strip GL codes (like "403011") from the beginning
        item_name = re.sub(r'^\d{5,}\s*', '', item_name).strip()

        # Get monthly values
        monthly_values = {}
        for month_abbr, col_idx in month_cols.items():
            value = _get_numeric_value(row, col_idx)
            if value is not None:
                monthly_values[month_abbr] = value

        # Get total
        total_value = None
        if total_col:
            total_value = _get_numeric_value(row, total_col)

        # Store line item
        if monthly_values or total_value is not None:
            line_items[item_name] = {
                **monthly_values,
                "Total": total_value
            }

    return line_items


def _extract_t12_summary(line_items: Dict[str, Dict[str, Any]], total_col: Optional[int]) -> Dict[str, Any]:
    """
    Extract key summary values from line items using fuzzy matching.

    Uses the T12 taxonomy and match_line_item() for robust matching
    against real-world line item label variations.
    """
    summary = {}

    # Skip words — lines containing these are likely false positives
    skip_words = ["excl ", "excluding", "net potential", "after "]

    # Match each line item using fuzzy matching
    for item_name, values in line_items.items():
        item_lower = item_name.lower()

        # Skip false positives
        if any(sw in item_lower for sw in skip_words):
            continue

        # Use fuzzy matching to find the canonical taxonomy key
        taxonomy_key = match_line_item(item_name, T12_TAXONOMY)
        if taxonomy_key is None:
            continue

        # Map taxonomy key to summary field name
        summary_field = TAXONOMY_TO_SUMMARY_FIELD.get(taxonomy_key)
        if summary_field is None:
            continue

        # Only set if not already set (first match wins — more specific items
        # appear earlier in spreadsheets)
        if summary_field not in summary and values.get("Total") is not None:
            summary[summary_field] = values["Total"]
            logger.debug("Fuzzy matched '%s' → %s = %s", item_name, summary_field, values["Total"])

    # Fallback: if NOI is missing, calculate from total_revenue - total_operating_expenses
    if summary.get("net_operating_income") is None:
        rev = summary.get("total_revenue")
        exp = summary.get("total_operating_expenses")
        if rev is not None and exp is not None:
            summary["net_operating_income"] = rev - abs(exp)
            logger.info("T12 NOI computed as fallback: revenue(%s) - expenses(%s) = %s",
                        rev, exp, summary["net_operating_income"])

    # Fallback: if total_revenue is missing but GPR and other components exist
    if summary.get("total_revenue") is None and summary.get("gross_potential_rent") is not None:
        gpr = summary["gross_potential_rent"]
        deductions = sum(abs(summary.get(k, 0) or 0) for k in [
            "loss_to_lease", "vacancy_loss", "concessions", "bad_debt"
        ])
        other = summary.get("other_income", 0) or 0
        summary["total_revenue"] = gpr - deductions + other
        logger.info("T12 total_revenue computed as fallback: GPR(%s) - deductions(%s) + other(%s) = %s",
                     gpr, deductions, other, summary["total_revenue"])

    logger.info("T12 summary extraction (fuzzy): %s", {k: v for k, v in summary.items() if v is not None})
    return summary


def _extract_t12_monthly(line_items: Dict[str, Dict[str, Any]], month_cols: Dict[str, int]) -> Dict[str, Dict[str, float]]:
    """Extract monthly data for NOI, Revenue, and Expenses using fuzzy matching"""
    monthly = {
        "noi": {},
        "revenue": {},
        "expenses": {}
    }

    # Map taxonomy keys to monthly dict keys
    monthly_targets = {
        "noi": "noi",
        "egi": "revenue",
        "total_opex": "expenses",
    }

    # Find NOI, Revenue, and Expenses line items via fuzzy matching
    for item_name, values in line_items.items():
        taxonomy_key = match_line_item(item_name, T12_TAXONOMY)
        if taxonomy_key not in monthly_targets:
            continue

        target = monthly_targets[taxonomy_key]
        if monthly[target]:
            continue  # Already found this one

        for month in month_cols.keys():
            if month in values:
                monthly[target][month] = values[month]

    logger.info("T12 monthly extraction: noi=%d months, revenue=%d months, expenses=%d months",
                len(monthly["noi"]), len(monthly["revenue"]), len(monthly["expenses"]))
    return monthly


# ==================== TIER 2: CLAUDE AI FALLBACK ====================

def _worksheet_to_text(filepath: str) -> str:
    """Convert all sheets to a text representation for Claude."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    output = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        output.append(f"\n=== Sheet: {sheet_name} ===\n")
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) if c is not None else "" for c in row]
            if any(c.strip() for c in cells):
                output.append("\t".join(cells))
    wb.close()
    return "\n".join(output[:500])  # Cap at 500 lines to manage token cost


async def extract_t12_with_ai_fallback(filepath: str) -> dict:
    """
    Try fuzzy matching first, fall back to Claude if it fails.
    Tier 1: Fuzzy keyword matching (fast, no API cost)
    Tier 2: Claude AI extraction (handles truly unusual formats)
    """
    # Tier 1: Fuzzy matching
    result = extract_t12(filepath)

    # Check if extraction actually produced data
    summary = result.get("summary", {})
    key_fields = ['gross_potential_rent', 'net_operating_income',
                  'total_operating_expenses', 'total_revenue']
    populated = sum(1 for f in key_fields if summary.get(f) not in [None, 0, 0.0])

    if populated >= 2:
        logger.info("T12 fuzzy extraction succeeded: %d/4 key fields populated", populated)
        return result

    logger.warning("T12 fuzzy extraction weak (%d/4 fields). Falling back to Claude AI.", populated)

    # Tier 2: Send to Claude
    try:
        import anthropic

        sheet_text = _worksheet_to_text(filepath)

        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            system="You are a CRE financial data extraction expert. Extract T12 trailing 12-month financial data from this spreadsheet content. Return ONLY valid JSON.",
            messages=[{
                "role": "user",
                "content": f"""Extract the T12 (trailing 12 months) financial summary from this spreadsheet data.

Return JSON with these fields (use null if not found, use annual/total figures not monthly):
{{
  "gross_potential_rent": <gross scheduled/potential rent, annual>,
  "vacancy_loss": <vacancy loss, annual, as positive number>,
  "concessions": <concessions, annual>,
  "bad_debt": <bad debt/credit loss, annual>,
  "other_income": <other/ancillary income, annual>,
  "total_revenue": <effective gross income, annual>,
  "total_operating_expenses": <total operating expenses, annual>,
  "net_operating_income": <net operating income, annual>,
  "real_estate_taxes": <real estate taxes, annual>,
  "insurance": <insurance, annual>,
  "management_fee": <management fee, annual>,
  "repairs_maintenance": <repairs & maintenance, annual>,
  "utilities": <utilities, annual>,
  "payroll": <payroll/salaries, annual>,
  "fiscal_year": <the year of the T12 period, e.g. 2025>,
  "period_end_month": <last month of the trailing period, e.g. "December">
}}

Spreadsheet content:
{sheet_text}"""
            }],
        )

        # Parse Claude's JSON response
        ai_text = response.content[0].text
        # Strip markdown code fences if present
        ai_text = re.sub(r'^```(?:json)?\s*', '', ai_text.strip())
        ai_text = re.sub(r'\s*```$', '', ai_text.strip())

        ai_result = json.loads(ai_text)
        logger.info("Claude AI T12 extraction succeeded: NOI=%s", ai_result.get('net_operating_income'))

        # Merge AI results into the standard result structure
        result["summary"] = ai_result
        if ai_result.get("fiscal_year"):
            result["fiscal_year"] = ai_result["fiscal_year"]

        return result

    except Exception as e:
        logger.error("Claude AI T12 extraction failed: %s", e)
        return result  # Return the weak Tier 1 result as last resort
