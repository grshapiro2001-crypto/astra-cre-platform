"""
Excel Extraction Service — Rent Rolls and T-12 Operating Statements

This service parses Rent Roll and T-12 Excel files using openpyxl and extracts structured data.
It does NOT use Claude API for extraction — the data is already structured in tabular form.
Uses direct parsing with intelligent header detection.
"""
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

logger = logging.getLogger(__name__)


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

        # Step 3: Extract property name
        property_name = _extract_property_name_from_sheet(ws)

        # Step 4: Parse all line items
        line_items = _parse_t12_line_items(ws, month_row, month_cols, total_col)

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

            cell_str = str(cell.value).lower().strip()

            # Check for month names or abbreviations
            for i, month_name in enumerate(month_names):
                if month_name in cell_str or month_abbr[i] in cell_str:
                    month_cols[month_abbr[i].capitalize()] = col_idx
                    break

        # If we found at least 6 months, this is probably the header row
        if len(month_cols) >= 6:
            # Try to find fiscal year in the row above
            if row_idx > 1:
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

            return row_idx, month_cols, fiscal_year

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
                          total_col: Optional[int]) -> Dict[str, Dict[str, Any]]:
    """
    Parse all line items from T-12 with monthly values.
    Returns: {"Line Item Name": {"Jan": 123, "Feb": 456, ..., "Total": 7890}}
    """
    line_items = {}

    for row_idx in range(month_row + 1, ws.max_row + 1):
        row = ws[row_idx]

        # Get line item name (column A)
        item_name_cell = row[0]
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
    """Extract key summary values from line items"""
    summary = {}

    # Define mappings from line item names to summary fields
    mappings = {
        "gross_potential_rent": ["gross potential rent", "gpr", "gross rent"],
        "loss_to_lease": ["loss to lease", "gain loss to lease", "ltl"],
        "concessions": ["concession", "concessions"],
        "vacancy_loss": ["vacancy", "vacancy loss"],
        "bad_debt": ["bad debt", "credit loss"],
        "net_rental_income": ["net rental income", "nri"],
        "other_income": ["other income"],
        "total_revenue": ["total revenue", "gross revenue", "effective gross income"],
        "payroll": ["payroll"],
        "utilities": ["utilities"],
        "repairs_maintenance": ["repairs & maintenance", "repairs and maintenance", "r&m", "repair"],
        "turnover": ["turnover", "make ready"],
        "contract_services": ["contract services", "contracts"],
        "marketing": ["marketing", "advertising"],
        "administrative": ["administrative", "general & administrative", "g&a"],
        "management_fee": ["management fee"],
        "controllable_expenses": ["controllable"],
        "real_estate_taxes": ["real estate taxes", "property taxes", "taxes"],
        "insurance": ["insurance"],
        "non_controllable_expenses": ["non controllable", "non-controllable"],
        "total_operating_expenses": ["operating expenses", "total opex", "total expenses"],
        "net_operating_income": ["net operating income", "noi"]
    }

    # Match line items to summary fields
    for field, keywords in mappings.items():
        for item_name, values in line_items.items():
            item_lower = item_name.lower()
            # Check if any keyword matches
            if any(kw in item_lower for kw in keywords):
                # Skip false positives: lines containing "excl" or "net potential" that happen to match
                skip_words = ["excl ", "excluding", "net potential", "after "]
                if any(sw in item_lower for sw in skip_words):
                    continue
                # Prefer exact or close matches
                if values.get("Total") is not None:
                    summary[field] = values["Total"]
                    break

    return summary


def _extract_t12_monthly(line_items: Dict[str, Dict[str, Any]], month_cols: Dict[str, int]) -> Dict[str, Dict[str, float]]:
    """Extract monthly data for NOI, Revenue, and Expenses"""
    monthly = {
        "noi": {},
        "revenue": {},
        "expenses": {}
    }

    # Find NOI, Revenue, and Expenses line items
    for item_name, values in line_items.items():
        item_lower = item_name.lower()

        if "net operating income" in item_lower or item_lower == "noi":
            for month in month_cols.keys():
                if month in values:
                    monthly["noi"][month] = values[month]

        if "total revenue" in item_lower or "gross revenue" in item_lower or "effective gross income" in item_lower:
            for month in month_cols.keys():
                if month in values:
                    monthly["revenue"][month] = values[month]

        if "operating expenses" in item_lower or "total opex" in item_lower:
            for month in month_cols.keys():
                if month in values:
                    monthly["expenses"][month] = values[month]

    return monthly
