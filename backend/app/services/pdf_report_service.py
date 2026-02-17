"""
PDF Report Service - Generates professional dark-themed deal summary PDFs

Astra CRE branded 3-page Property Summary
NO LLM CALLS - Pure database read + PDF generation
"""
import io
import json
import math
import os
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session, joinedload
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.models.property import Property, PropertyUnitMix, PropertyRentComp


# ---------------------------------------------------------------------------
# Font Registration (Fix 1)
# ---------------------------------------------------------------------------
FONT_DIR = "/tmp/astra_fonts"
_fonts_registered = False

# Google Fonts direct download URLs (static TTF files)
_FONT_URLS = {
    "Syne-Bold": "https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_0KuT6kR47NCV5Z.ttf",
    "Syne-Regular": "https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_04uT6kR47NCV5Z.ttf",
    "InstrumentSans-Regular": "https://fonts.gstatic.com/s/instrumentsans/v4/pximypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr-yp2JGEJOH9npSTF-Qf1mS0v3_7Y.ttf",
    "InstrumentSans-Bold": "https://fonts.gstatic.com/s/instrumentsans/v4/pximypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr-yp2JGEJOH9npST3AQf1mS0v3_7Y.ttf",
    "JetBrainsMono-Regular": "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf",
    "JetBrainsMono-Bold": "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ-chw.ttf",
}

# Font family mapping: logical name -> (regular, bold)
FONT_DISPLAY = "Syne"          # Headers / display
FONT_BODY = "InstrumentSans"   # Labels / body text
FONT_MONO = "JetBrainsMono"    # Numbers / data

# Fallback mappings if custom fonts fail
_FONT_FALLBACKS = {
    "Syne-Bold": "Helvetica-Bold",
    "Syne-Regular": "Helvetica",
    "InstrumentSans-Regular": "Helvetica",
    "InstrumentSans-Bold": "Helvetica-Bold",
    "JetBrainsMono-Regular": "Helvetica",
    "JetBrainsMono-Bold": "Helvetica-Bold",
}

# Actual registered names (may be font name or Helvetica fallback)
_resolved_fonts: Dict[str, str] = {}


def _ensure_fonts():
    """Download and register Astra fonts. Falls back to Helvetica on failure."""
    global _fonts_registered, _resolved_fonts
    if _fonts_registered:
        return

    os.makedirs(FONT_DIR, exist_ok=True)

    for font_name, url in _FONT_URLS.items():
        ttf_path = os.path.join(FONT_DIR, font_name + ".ttf")
        try:
            if not os.path.exists(ttf_path):
                urllib.request.urlretrieve(url, ttf_path)
            pdfmetrics.registerFont(TTFont(font_name, ttf_path))
            _resolved_fonts[font_name] = font_name
        except Exception:
            _resolved_fonts[font_name] = _FONT_FALLBACKS[font_name]

    _fonts_registered = True


def _font(name: str) -> str:
    """Resolve a font name to the registered name (or Helvetica fallback)."""
    return _resolved_fonts.get(name, _FONT_FALLBACKS.get(name, "Helvetica"))


# ---------------------------------------------------------------------------
# Astra Dark Theme Palette
# ---------------------------------------------------------------------------
BG_DARK = colors.HexColor("#0D0D1A")
BG_CARD = colors.HexColor("#1A1A2E")
BG_MUTED = colors.HexColor("#252540")
BORDER = colors.HexColor("#333355")
TEXT_PRIMARY = colors.HexColor("#EEEEF2")
TEXT_MUTED = colors.HexColor("#9999AA")
TEXT_HEADING = colors.HexColor("#FFFFFF")
PURPLE_PRIMARY = colors.HexColor("#8B5CF6")
PURPLE_LIGHT = colors.HexColor("#A78BFA")
GREEN = colors.HexColor("#34D399")
GREEN_DARK = colors.HexColor("#059669")
RED = colors.HexColor("#F87171")
AMBER = colors.HexColor("#FBBF24")
TEAL_ACCENT = colors.HexColor("#2DD4BF")
CYAN_ACCENT = colors.HexColor("#22D3EE")

# Page dimensions
PAGE_W, PAGE_H = letter  # 612 x 792
MARGIN_L = 40
MARGIN_R = 40
MARGIN_T = 40
MARGIN_B = 40
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

EM_DASH = "\u2014"


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------
def _sf(value) -> Optional[float]:
    """Safe float conversion."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _fmt_currency(value, fallback=None) -> str:
    if fallback is None:
        fallback = EM_DASH
    if value is None:
        return fallback
    try:
        v = float(value)
        if abs(v) >= 1_000_000:
            return "${:,.0f}".format(v)
        return "${:,.0f}".format(v)
    except (TypeError, ValueError):
        return fallback


def _fmt_currency_neg(value, fallback=None) -> str:
    """Format as -$X,XXX (absolute value with minus prefix)."""
    if fallback is None:
        fallback = EM_DASH
    if value is None:
        return fallback
    try:
        v = abs(float(value))
        return "-${:,.0f}".format(v)
    except (TypeError, ValueError):
        return fallback


def _fc_deduction(val):
    """Format a deduction value. Show dash for None or 0. (Fix 6)"""
    if val is None or val == 0 or abs(float(val) if val else 0) < 1:
        return EM_DASH
    return "-${:,.0f}".format(abs(float(val)))


def _fmt_number(value, decimals=0, fallback=None) -> str:
    if fallback is None:
        fallback = EM_DASH
    if value is None:
        return fallback
    try:
        v = float(value)
        if decimals == 0:
            return "{:,.0f}".format(v)
        fmt = "{:,." + str(decimals) + "f}"
        return fmt.format(v)
    except (TypeError, ValueError):
        return fallback


def _fmt_pct(value, fallback=None) -> str:
    if fallback is None:
        fallback = EM_DASH
    if value is None:
        return fallback
    try:
        return "{:.1f}%".format(float(value))
    except (TypeError, ValueError):
        return fallback


def _fmt_pct2(value, fallback=None) -> str:
    """Format percentage with 2 decimal places."""
    if fallback is None:
        fallback = EM_DASH
    if value is None:
        return fallback
    try:
        return "{:.2f}%".format(float(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_irr(value) -> Optional[float]:
    """Normalize IRR: if < 1, treat as decimal (0.0875 -> 8.75)."""
    if value is None:
        return None
    try:
        v = float(value)
        if abs(v) < 1:
            return v * 100
        return v
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Parse financials JSON
# ---------------------------------------------------------------------------
def _parse_financials(json_str) -> Optional[Dict[str, Any]]:
    if not json_str:
        return None
    if isinstance(json_str, dict):
        return json_str
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Unit mix bedroom type normalization (Fix 5)
# ---------------------------------------------------------------------------
def _normalize_bedroom_type(unit_type: Optional[str]) -> str:
    """Normalize unit_type to bedroom category: Studio, 1 BD, 2 BD, 3 BD."""
    if not unit_type:
        return "Other"
    ut = unit_type.strip().lower()
    if "studio" in ut or "stu" in ut:
        return "Studio"
    if re.search(r"3\s*b[de]", ut):
        return "3 BD"
    if re.search(r"2\s*b[de]", ut):
        return "2 BD"
    if re.search(r"1\s*b[de]", ut):
        return "1 BD"
    return "Other"


_BEDROOM_SORT = {"Studio": 0, "1 BD": 1, "2 BD": 2, "3 BD": 3, "Other": 4}


def _aggregate_unit_mix(unit_mix: list) -> List[Dict[str, Any]]:
    """Group unit mix rows by bedroom type with weighted averages."""
    groups: Dict[str, list] = defaultdict(list)
    for um in unit_mix:
        bed = _normalize_bedroom_type(um.unit_type)
        groups[bed].append(um)

    aggregated = []
    grand_units = 0
    grand_sf_w = 0
    grand_ip_w = 0
    grand_pf_w = 0
    grand_rpsf_w = 0

    for bed_type in sorted(groups.keys(), key=lambda k: _BEDROOM_SORT.get(k, 99)):
        entries = groups[bed_type]
        total_units = sum(_sf(e.num_units) or 0 for e in entries)
        if total_units == 0:
            continue

        w_sf = sum((_sf(e.unit_sf) or 0) * (_sf(e.num_units) or 0) for e in entries)
        w_ip = sum((_sf(e.in_place_rent) or 0) * (_sf(e.num_units) or 0) for e in entries)
        w_pf = sum((_sf(e.proforma_rent) or 0) * (_sf(e.num_units) or 0) for e in entries)

        avg_sf = w_sf / total_units if total_units else 0
        avg_ip = w_ip / total_units if total_units else 0
        avg_pf = w_pf / total_units if total_units else 0
        avg_rpsf = avg_pf / avg_sf if avg_sf > 0 else 0

        aggregated.append({
            "type": bed_type,
            "units": int(total_units),
            "avg_sf": round(avg_sf),
            "avg_ip": round(avg_ip),
            "avg_pf": round(avg_pf),
            "avg_rpsf": round(avg_rpsf, 2),
        })

        grand_units += total_units
        grand_sf_w += w_sf
        grand_ip_w += w_ip
        grand_pf_w += w_pf

    # Total row
    if grand_units > 0:
        g_sf = grand_sf_w / grand_units
        g_ip = grand_ip_w / grand_units
        g_pf = grand_pf_w / grand_units
        g_rpsf = g_pf / g_sf if g_sf > 0 else 0
        aggregated.append({
            "type": "Total",
            "units": int(grand_units),
            "avg_sf": round(g_sf),
            "avg_ip": round(g_ip),
            "avg_pf": round(g_pf),
            "avg_rpsf": round(g_rpsf, 2),
        })

    return aggregated


# ---------------------------------------------------------------------------
# Rent comp aggregation (Fix 4)
# ---------------------------------------------------------------------------
def _aggregate_rent_comps(rent_comps: list) -> List[Dict[str, Any]]:
    """Group rent comps by comp_name, return weighted averages."""
    comp_groups: Dict[str, list] = defaultdict(list)
    for rc in rent_comps:
        name = rc.comp_name or "Unknown"
        comp_groups[name].append(rc)

    aggregated = []
    for name, entries in comp_groups.items():
        total_units = sum(_sf(e.num_units) or 0 for e in entries)
        location = next((e.location for e in entries if e.location), None)

        if total_units > 0:
            weighted_rent = sum((_sf(e.in_place_rent) or 0) * (_sf(e.num_units) or 0) for e in entries)
            avg_rent = weighted_rent / total_units
            weighted_psf = sum((_sf(e.in_place_rent_psf) or 0) * (_sf(e.num_units) or 0) for e in entries)
            avg_psf = weighted_psf / total_units
        else:
            avg_rent = _sf(entries[0].in_place_rent) or 0
            avg_psf = _sf(entries[0].in_place_rent_psf) or 0

        aggregated.append({
            "name": name,
            "location": location,
            "units": int(total_units) if total_units else 0,
            "avg_rent": avg_rent,
            "avg_psf": avg_psf,
        })

    return aggregated


# ---------------------------------------------------------------------------
# Resolve screening score (Fix 3)
# ---------------------------------------------------------------------------
def _resolve_score(prop) -> Optional[int]:
    """Get actual screening score. Returns None if missing or 0."""
    score = prop.screening_score
    if score and score > 0:
        return int(score)

    # Fallback: check screening_details_json for a score field
    if prop.screening_details_json:
        try:
            details = json.loads(prop.screening_details_json) if isinstance(
                prop.screening_details_json, str) else prop.screening_details_json
            if isinstance(details, dict) and details.get("score"):
                s = int(details["score"])
                if s > 0:
                    return s
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    return None


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------
def _rounded_rect(c, x, y, w, h, r, fill=None, stroke=None, stroke_width=1):
    """Draw a rounded rectangle. (x, y) is bottom-left corner."""
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    p.close()
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_width)
    if fill and stroke:
        c.drawPath(p, fill=1, stroke=1)
    elif fill:
        c.drawPath(p, fill=1, stroke=0)
    elif stroke:
        c.drawPath(p, fill=0, stroke=1)


def _page_bg(c):
    """Fill entire page with dark background."""
    c.setFillColor(BG_DARK)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def _draw_logo(c, logo_x, logo_y):
    """Draw Astra prism/pyramid logo (Fix 2)."""
    logo_s = 18

    # Outer triangle (purple)
    c.setStrokeColor(PURPLE_LIGHT)
    c.setLineWidth(1.5)
    p = c.beginPath()
    p.moveTo(logo_x + logo_s / 2, logo_y + logo_s)   # top center
    p.lineTo(logo_x, logo_y)                           # bottom left
    p.lineTo(logo_x + logo_s, logo_y)                  # bottom right
    p.close()
    c.drawPath(p, fill=0, stroke=1)

    # Inner smaller triangle (cyan/teal accent)
    c.setStrokeColor(CYAN_ACCENT)
    c.setLineWidth(0.8)
    inner_s = logo_s * 0.55
    offset = (logo_s - inner_s) / 2
    p2 = c.beginPath()
    p2.moveTo(logo_x + logo_s / 2, logo_y + logo_s * 0.6)
    p2.lineTo(logo_x + offset, logo_y + offset * 0.3)
    p2.lineTo(logo_x + logo_s - offset, logo_y + offset * 0.3)
    p2.close()
    c.drawPath(p2, fill=0, stroke=1)


def _page_header(c, prop_name, score=None):
    """Draw top header: purple accent bar, logo, property name, score badge."""
    # Purple accent bar at very top
    c.setFillColor(PURPLE_PRIMARY)
    c.rect(0, PAGE_H - 4, PAGE_W, 4, fill=1, stroke=0)

    header_y = PAGE_H - 44

    # Draw prism logo (Fix 2)
    _draw_logo(c, MARGIN_L, header_y - 2)

    # "Astra" text in Syne-Bold
    c.setFillColor(PURPLE_LIGHT)
    c.setFont(_font("Syne-Bold"), 16)
    c.drawString(MARGIN_L + 24, header_y, "Astra")

    # "CRE" in lighter color
    astra_w = c.stringWidth("Astra", _font("Syne-Bold"), 16)
    c.setFillColor(TEXT_MUTED)
    c.setFont(_font("Syne-Bold"), 16)
    c.drawString(MARGIN_L + 24 + astra_w + 4, header_y, "CRE")

    # Property name
    logo_text_w = 24 + astra_w + 4 + c.stringWidth("CRE", _font("Syne-Bold"), 16) + 16
    c.setFillColor(TEXT_HEADING)
    c.setFont(_font("Syne-Bold"), 12)
    name = prop_name or "Untitled Property"
    if len(name) > 50:
        name = name[:47] + "..."
    c.drawString(MARGIN_L + logo_text_w, header_y + 1, name)

    # Deal score circle badge (Fix 3: only if score > 0)
    if score is not None and score > 0:
        badge_x = PAGE_W - MARGIN_R - 20
        badge_y = header_y + 4
        badge_r = 14
        if score >= 70:
            badge_color = GREEN
        elif score >= 50:
            badge_color = AMBER
        else:
            badge_color = RED
        c.setFillColor(badge_color)
        c.circle(badge_x, badge_y, badge_r, fill=1, stroke=0)
        c.setFillColor(BG_DARK)
        c.setFont(_font("JetBrainsMono-Bold"), 11)
        score_str = str(score)
        tw = c.stringWidth(score_str, _font("JetBrainsMono-Bold"), 11)
        c.drawString(badge_x - tw / 2, badge_y - 4, score_str)

    # Thin divider line below header
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, header_y - 12, PAGE_W - MARGIN_R, header_y - 12)


def _page_footer(c, page_num, prop_name):
    """Draw bottom footer."""
    footer_y = MARGIN_B - 10
    date_str = datetime.now().strftime("%B %d, %Y")

    c.setFont(_font("InstrumentSans-Regular"), 7)
    c.setFillColor(TEXT_MUTED)
    left_text = "Generated by Astra CRE Platform " + EM_DASH + " " + date_str
    c.drawString(MARGIN_L, footer_y, left_text)

    name = prop_name or "Property"
    if len(name) > 40:
        name = name[:37] + "..."
    right_text = name + " " + EM_DASH + " Page " + str(page_num)
    tw = c.stringWidth(right_text, _font("InstrumentSans-Regular"), 7)
    c.drawString(PAGE_W - MARGIN_R - tw, footer_y, right_text)

    # Thin line above footer
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, footer_y + 12, PAGE_W - MARGIN_R, footer_y + 12)


def _header_bar(c, y, text):
    """Section header with purple underline. Returns new y below."""
    c.setFont(_font("Syne-Bold"), 13)
    c.setFillColor(TEXT_HEADING)
    c.drawString(MARGIN_L, y, text)
    c.setStrokeColor(PURPLE_PRIMARY)
    c.setLineWidth(2)
    c.line(MARGIN_L, y - 5, PAGE_W - MARGIN_R, y - 5)
    return y - 22


def _label_value(c, x, y, label, value, label_color=None, value_color=None,
                 label_size=7, value_size=11):
    """Draw stacked label on top, value below. Returns width used."""
    if label_color is None:
        label_color = TEXT_MUTED
    if value_color is None:
        value_color = TEXT_PRIMARY
    c.setFont(_font("InstrumentSans-Regular"), label_size)
    c.setFillColor(label_color)
    c.drawString(x, y, label)
    c.setFont(_font("JetBrainsMono-Bold"), value_size)
    c.setFillColor(value_color)
    c.drawString(x, y - 15, str(value))


def _table_row(c, y, cols, widths, aligns=None, font=None, size=8,
               color=None, bg=None, mono_cols=None):
    """Draw a row of table cells at given y. Returns y for next row.

    mono_cols: set of column indices that should use JetBrains Mono (for numbers).
    """
    if font is None:
        font = _font("InstrumentSans-Regular")
    if color is None:
        color = TEXT_PRIMARY
    if aligns is None:
        aligns = ["left"] * len(cols)
    if mono_cols is None:
        mono_cols = set()

    row_h = 20
    x = MARGIN_L

    if bg:
        c.setFillColor(bg)
        c.rect(MARGIN_L, y - row_h + 5, CONTENT_W, row_h, fill=1, stroke=0)

    for i, (col_text, w) in enumerate(zip(cols, widths)):
        text = str(col_text) if col_text is not None else EM_DASH

        # Choose font for this column
        col_font = _font("JetBrainsMono-Regular") if i in mono_cols else font
        c.setFont(col_font, size)
        c.setFillColor(color)

        # Truncate if too wide
        max_chars = int(w / (size * 0.5))
        if len(text) > max_chars and max_chars > 3:
            text = text[:max_chars - 2] + ".."
        align = aligns[i] if i < len(aligns) else "left"
        if align == "right":
            tw = c.stringWidth(text, col_font, size)
            c.drawString(x + w - tw - 4, y - 10, text)
        elif align == "center":
            tw = c.stringWidth(text, col_font, size)
            c.drawString(x + (w - tw) / 2, y - 10, text)
        else:
            c.drawString(x + 4, y - 10, text)
        x += w

    return y - row_h


def _tag_chip(c, x, y, text, bg_color, text_color=None):
    """Draw a small colored tag chip. Returns x + width."""
    if text_color is None:
        text_color = TEXT_HEADING
    f = _font("InstrumentSans-Bold")
    c.setFont(f, 7)
    tw = c.stringWidth(text, f, 7)
    chip_w = tw + 12
    chip_h = 14
    _rounded_rect(c, x, y - 4, chip_w, chip_h, 3, fill=bg_color)
    c.setFillColor(text_color)
    c.drawString(x + 6, y, text)
    return x + chip_w + 6


def _card_rect(c, x, y, w, h, border_color=None):
    """Draw a card background with optional colored border."""
    _rounded_rect(c, x, y, w, h, 6, fill=BG_CARD)
    if border_color:
        _rounded_rect(c, x, y, w, h, 6, stroke=border_color, stroke_width=1.5)
    else:
        _rounded_rect(c, x, y, w, h, 6, stroke=BORDER, stroke_width=0.5)


# ---------------------------------------------------------------------------
# Page 1: Property Overview
# ---------------------------------------------------------------------------
def _draw_page1(c, prop, fin_periods, bov_tiers_data, score):
    _page_bg(c)
    _page_header(c, prop.deal_name, score)
    _page_footer(c, 1, prop.deal_name)

    y = PAGE_H - 70  # Start below header

    # ---- Property Address Card ----
    card_h = 62
    _card_rect(c, MARGIN_L, y - card_h, CONTENT_W, card_h)

    # Address
    c.setFont(_font("Syne-Bold"), 12)
    c.setFillColor(TEXT_HEADING)
    addr = prop.property_address or "Address not available"
    if len(addr) > 70:
        addr = addr[:67] + "..."
    c.drawString(MARGIN_L + 12, y - 18, addr)

    # Tag chips row
    chip_x = MARGIN_L + 12
    chip_y = y - 42

    if prop.submarket:
        chip_x = _tag_chip(c, chip_x, chip_y, prop.submarket, TEAL_ACCENT, BG_DARK)
    if prop.metro:
        chip_x = _tag_chip(c, chip_x, chip_y, prop.metro, PURPLE_PRIMARY, TEXT_HEADING)
    if prop.property_type:
        chip_x = _tag_chip(c, chip_x, chip_y, prop.property_type, BG_MUTED, TEXT_PRIMARY)

    y -= (card_h + 12)

    # ---- Property Details + Rent Analysis (side by side) ----
    card_half_w = (CONTENT_W - 10) / 2
    card_h2 = 110

    # Left card: Property Details
    _card_rect(c, MARGIN_L, y - card_h2, card_half_w, card_h2)
    c.setFont(_font("Syne-Bold"), 9)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(MARGIN_L + 12, y - 16, "Property Details")

    total_units = prop.total_units
    total_sf = prop.total_residential_sf
    year_built = prop.year_built
    avg_unit_sf = None
    if total_sf and total_units and total_units > 0:
        avg_unit_sf = round(total_sf / total_units)

    details_rows = [
        ("Units", _fmt_number(total_units)),
        ("Total SF", _fmt_number(total_sf)),
        ("Year Built", _fmt_number(year_built)),
        ("Avg Unit SF", _fmt_number(avg_unit_sf)),
    ]
    dy = y - 32
    for label, val in details_rows:
        c.setFont(_font("InstrumentSans-Regular"), 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 12, dy, label)
        c.setFont(_font("JetBrainsMono-Bold"), 9)
        c.setFillColor(TEXT_PRIMARY)
        tw = c.stringWidth(str(val), _font("JetBrainsMono-Bold"), 9)
        c.drawString(MARGIN_L + card_half_w - tw - 12, dy, str(val))
        dy -= 19

    # Right card: Rent Analysis
    rx = MARGIN_L + card_half_w + 10
    _card_rect(c, rx, y - card_h2, card_half_w, card_h2)
    c.setFont(_font("Syne-Bold"), 9)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(rx + 12, y - 16, "Rent Analysis")

    market_rent = _sf(prop.average_market_rent) or _sf(prop.rr_avg_market_rent)
    inplace_rent = _sf(prop.average_inplace_rent) or _sf(prop.rr_avg_in_place_rent)

    ltl_pct = None
    if market_rent and inplace_rent and market_rent > 0:
        ltl_pct = ((market_rent - inplace_rent) / market_rent) * 100

    # LTL color
    if ltl_pct is not None:
        if ltl_pct < 5:
            ltl_color = GREEN
        elif ltl_pct < 10:
            ltl_color = AMBER
        else:
            ltl_color = RED
    else:
        ltl_color = TEXT_MUTED

    rent_rows = [
        ("Market Rent", _fmt_currency(market_rent), AMBER),
        ("In-Place Rent", _fmt_currency(inplace_rent), TEXT_PRIMARY),
        ("Loss to Lease", _fmt_pct(ltl_pct), ltl_color),
    ]
    dy = y - 32
    for label, val, val_color in rent_rows:
        c.setFont(_font("InstrumentSans-Regular"), 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(rx + 12, dy, label)
        c.setFont(_font("JetBrainsMono-Bold"), 10)
        c.setFillColor(val_color)
        tw = c.stringWidth(str(val), _font("JetBrainsMono-Bold"), 10)
        c.drawString(rx + card_half_w - tw - 12, dy, str(val))
        dy -= 22

    y -= (card_h2 + 12)

    # ---- Economic Occupancy Banner (Fix 7: T12 first) ----
    econ_occ_pct = None
    econ_nri = None
    econ_gpr = None
    econ_period_label = None
    for period_key in ["T12", "T3", "Y1"]:  # T12 first (Fix 7)
        fin = fin_periods.get(period_key)
        if fin:
            gsr_val = _sf(fin.get("gsr"))
            ltl_val = _sf(fin.get("loss_to_lease"))
            nri_val = _sf(fin.get("net_rental_income"))
            if gsr_val and nri_val:
                gpr = gsr_val - abs(ltl_val or 0)
                if gpr > 0:
                    econ_occ_pct = (nri_val / gpr) * 100
                    econ_nri = nri_val
                    econ_gpr = gpr
                    econ_period_label = period_key
                    break

    banner_h = 50
    if econ_occ_pct is not None:
        if econ_occ_pct >= 92:
            banner_border = GREEN
        elif econ_occ_pct >= 85:
            banner_border = AMBER
        else:
            banner_border = RED
    else:
        banner_border = BORDER

    _card_rect(c, MARGIN_L, y - banner_h, CONTENT_W, banner_h, border_color=banner_border)

    # Label with period (Fix 7)
    econ_label = "Economic Occupancy"
    if econ_period_label:
        econ_label = "Economic Occupancy ({})".format(econ_period_label)
    c.setFont(_font("InstrumentSans-Bold"), 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 18, econ_label)

    c.setFont(_font("InstrumentSans-Regular"), 7)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 32, "NRI / GPR (where GPR = GSR - |Loss to Lease|)")

    if econ_occ_pct is not None:
        c.setFont(_font("JetBrainsMono-Bold"), 20)
        c.setFillColor(banner_border)
        pct_str = "{:.1f}%".format(econ_occ_pct)
        tw = c.stringWidth(pct_str, _font("JetBrainsMono-Bold"), 20)
        c.drawString(PAGE_W - MARGIN_R - tw - 12, y - 22, pct_str)

        if econ_nri is not None:
            c.setFont(_font("InstrumentSans-Regular"), 7)
            c.setFillColor(TEXT_MUTED)
            nri_str = "NRI: " + _fmt_currency(econ_nri)
            tw2 = c.stringWidth(nri_str, _font("InstrumentSans-Regular"), 7)
            c.drawString(PAGE_W - MARGIN_R - tw2 - 12, y - 38, nri_str)
    else:
        c.setFont(_font("JetBrainsMono-Bold"), 14)
        c.setFillColor(TEXT_MUTED)
        tw = c.stringWidth(EM_DASH, _font("JetBrainsMono-Bold"), 14)
        c.drawString(PAGE_W - MARGIN_R - tw - 12, y - 26, EM_DASH)

    y -= (banner_h + 14)

    # ---- Pricing Analysis Section ----
    y = _header_bar(c, y, "Pricing Analysis")

    # Pricing Guidance card
    guidance = _sf(prop.user_guidance_price)
    guide_h = 38
    _card_rect(c, MARGIN_L, y - guide_h, CONTENT_W, guide_h, border_color=PURPLE_PRIMARY)
    c.setFont(_font("InstrumentSans-Bold"), 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 14, "Pricing Guidance")
    c.setFont(_font("JetBrainsMono-Bold"), 14)
    if guidance:
        c.setFillColor(PURPLE_LIGHT)
        c.drawString(MARGIN_L + 12, y - 32, _fmt_currency(guidance))
    else:
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 12, y - 32, "Not Set")

    y -= (guide_h + 10)

    # Metric boxes row: Going-In Cap (T3), Y1 Cap Rate, $/Unit, $/SF
    t3_noi = _sf(prop.t3_noi)
    y1_noi = _sf(prop.y1_noi)

    going_in_cap = None
    if t3_noi and guidance and guidance > 0:
        going_in_cap = (t3_noi / guidance) * 100

    y1_cap = None
    if y1_noi and guidance and guidance > 0:
        y1_cap = (y1_noi / guidance) * 100

    per_unit = None
    if guidance and total_units and total_units > 0:
        per_unit = guidance / total_units

    per_sf = None
    if guidance and total_sf and total_sf > 0:
        per_sf = guidance / total_sf

    metric_box_w = (CONTENT_W - 18) / 4
    metric_h = 45
    metrics = [
        ("Going-In Cap (T3)", _fmt_pct2(going_in_cap)),
        ("Y1 Cap Rate", _fmt_pct2(y1_cap)),
        ("$/Unit", _fmt_currency(per_unit)),
        ("$/SF", _fmt_currency(per_sf)),
    ]
    mx = MARGIN_L
    for label, val in metrics:
        _card_rect(c, mx, y - metric_h, metric_box_w, metric_h)
        c.setFont(_font("InstrumentSans-Regular"), 7)
        c.setFillColor(TEXT_MUTED)
        c.drawString(mx + 8, y - 14, label)
        c.setFont(_font("JetBrainsMono-Bold"), 12)
        c.setFillColor(PURPLE_LIGHT)
        c.drawString(mx + 8, y - 34, str(val))
        mx += metric_box_w + 6

    y -= (metric_h + 14)

    # ---- BOV Pricing Tiers table (Fix 8: always show if available) ----
    if bov_tiers_data:
        y = _header_bar(c, y, "BOV Pricing Tiers")

        # Column headers
        bov_cols = ["Tier", "Price", "$/Unit", "$/SF", "Unlev IRR",
                    "Lev IRR", "Eq Mult", "Avg CoC"]
        bov_widths = [CONTENT_W * w for w in [0.17, 0.14, 0.12, 0.10, 0.12, 0.12, 0.11, 0.12]]
        bov_aligns = ["left", "right", "right", "right", "right", "right", "right", "right"]
        bov_mono = {1, 2, 3, 4, 5, 6, 7}  # all numeric columns

        # Header row
        y = _table_row(c, y, bov_cols, bov_widths, bov_aligns,
                       font=_font("InstrumentSans-Bold"), size=7,
                       color=TEXT_HEADING, bg=BG_MUTED)

        for i, tier in enumerate(bov_tiers_data):
            if y < MARGIN_B + 30:
                break
            rm = tier.get("return_metrics") or {}
            row_bg = BG_MUTED if i % 2 == 0 else None

            unlev = _normalize_irr(rm.get("unlevered_irr"))
            lev = _normalize_irr(rm.get("levered_irr"))

            row = [
                tier.get("tier_label") or tier.get("pricing_tier_id") or EM_DASH,
                _fmt_currency(tier.get("pricing")),
                _fmt_currency(tier.get("price_per_unit")),
                _fmt_currency(tier.get("price_per_sf")),
                _fmt_pct2(unlev),
                _fmt_pct2(lev),
                _fmt_number(_sf(rm.get("equity_multiple")), decimals=2),
                _fmt_pct2(_sf(rm.get("avg_cash_on_cash"))),
            ]
            y = _table_row(c, y, row, bov_widths, bov_aligns,
                           size=7, color=TEXT_PRIMARY, bg=row_bg,
                           mono_cols=bov_mono)
    else:
        # Fix 8: Fill empty space with Rent Analysis detail if no BOV tiers
        y = _header_bar(c, y, "Rent Analysis Detail")

        detail_h = 60
        _card_rect(c, MARGIN_L, y - detail_h, CONTENT_W, detail_h)

        c.setFont(_font("InstrumentSans-Regular"), 8)
        c.setFillColor(TEXT_MUTED)
        dy = y - 16
        if market_rent and inplace_rent:
            spread = market_rent - inplace_rent
            c.drawString(MARGIN_L + 12, dy,
                         "Market Rent: {} | In-Place Rent: {} | Spread: {}".format(
                             _fmt_currency(market_rent),
                             _fmt_currency(inplace_rent),
                             _fmt_currency(spread)))
            dy -= 16
        if ltl_pct is not None:
            c.drawString(MARGIN_L + 12, dy,
                         "Loss to Lease: {} — {}".format(
                             _fmt_pct(ltl_pct),
                             "Minimal" if ltl_pct < 5 else "Moderate" if ltl_pct < 10 else "Significant"))
            dy -= 16
        if total_units:
            c.drawString(MARGIN_L + 12, dy,
                         "Total Units: {} | Year Built: {}".format(
                             _fmt_number(total_units),
                             _fmt_number(year_built) if year_built else EM_DASH))


# ---------------------------------------------------------------------------
# Page 2: Operating Financials
# ---------------------------------------------------------------------------
def _draw_page2(c, prop, fin_periods, score):
    _page_bg(c)
    _page_header(c, prop.deal_name, score)
    _page_footer(c, 2, prop.deal_name)

    y = PAGE_H - 70

    y = _header_bar(c, y, "Operating Financials")

    # Determine available periods (in order: T3, T12, Y1)
    period_order = []
    for key in ["T3", "T12", "Y1"]:
        if key in fin_periods:
            period_order.append(key)

    if not period_order:
        c.setFont(_font("InstrumentSans-Regular"), 10)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 12, y - 20, "No financial data available.")
        return

    num_periods = len(period_order)

    # Column layout: label + period columns
    label_w = CONTENT_W * 0.34
    period_w = (CONTENT_W - label_w) / max(num_periods, 1)
    col_widths = [label_w] + [period_w] * num_periods
    col_aligns = ["left"] + ["right"] * num_periods
    numeric_cols = set(range(1, num_periods + 1))

    # Period headers
    header_cols = [""] + [p + " Pro Forma" if p == "Y1" else p + " Actuals" for p in period_order]
    y = _table_row(c, y, header_cols, col_widths, col_aligns,
                   font=_font("InstrumentSans-Bold"), size=8,
                   color=TEXT_HEADING, bg=BG_MUTED)

    # Helper to get a fin value across periods
    def _fin_vals(key):
        return [fin_periods[p].get(key) for p in period_order]

    def _any_has_data(key):
        return any(_sf(fin_periods[p].get(key)) is not None for p in period_order)

    # ---- Revenue Section ----
    c.setFont(_font("Syne-Bold"), 8)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(MARGIN_L + 4, y - 12, "REVENUE")
    y -= 18

    # GSR
    gsr_vals = _fin_vals("gsr")
    row = ["Gross Scheduled Rent (GSR)"] + [_fmt_currency(v) for v in gsr_vals]
    y = _table_row(c, y, row, col_widths, col_aligns, size=8,
                   color=TEXT_PRIMARY, mono_cols=numeric_cols)

    # Deduction rows (indented, red) — Fix 6: use _fc_deduction
    deduction_items = [
        ("loss_to_lease", "Loss to Lease"),
        ("vacancy", "Vacancy"),
        ("concessions", "Concessions"),
        ("bad_debt", "Bad Debt"),
        ("credit_loss", "Credit Loss / Bad Debt"),
    ]

    # Only show bad_debt or credit_loss, not both (they may be the same)
    shown_bad_debt = False
    for key, label in deduction_items:
        if key == "credit_loss" and shown_bad_debt:
            continue
        if key == "bad_debt":
            if not _any_has_data("bad_debt"):
                continue
            shown_bad_debt = True
        if key == "credit_loss" and not _any_has_data("credit_loss"):
            continue

        vals = _fin_vals(key)
        if not any(_sf(v) is not None for v in vals):
            continue
        row_data = ["   " + label] + [_fc_deduction(v) for v in vals]
        y = _table_row(c, y, row_data, col_widths, col_aligns, size=8,
                       color=RED, mono_cols=numeric_cols)

    # Non-Revenue Units (only if data) — Fix 6
    if _any_has_data("non_revenue_units"):
        vals = _fin_vals("non_revenue_units")
        row_data = ["   Non-Revenue Units"] + [_fc_deduction(v) for v in vals]
        y = _table_row(c, y, row_data, col_widths, col_aligns, size=8,
                       color=RED, mono_cols=numeric_cols)

    # Divider
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, y - 2, PAGE_W - MARGIN_R, y - 2)
    y -= 6

    # Net Rental Income (bold)
    nri_vals = _fin_vals("net_rental_income")
    row = ["Net Rental Income"] + [_fmt_currency(v) for v in nri_vals]
    y = _table_row(c, y, row, col_widths, col_aligns,
                   font=_font("InstrumentSans-Bold"), size=9,
                   color=TEXT_HEADING, bg=BG_MUTED, mono_cols=numeric_cols)

    y -= 8

    # ---- Expenses Section ----
    c.setFont(_font("Syne-Bold"), 8)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(MARGIN_L + 4, y - 12, "EXPENSES")
    y -= 18

    # Total Operating Expenses — Fix 6
    opex_vals = _fin_vals("total_opex")
    row = ["Total Operating Expenses"] + [_fc_deduction(v) for v in opex_vals]
    y = _table_row(c, y, row, col_widths, col_aligns, size=8,
                   color=RED, mono_cols=numeric_cols)

    # Real Estate Taxes (indented) — Fix 6
    if _any_has_data("real_estate_taxes"):
        vals = _fin_vals("real_estate_taxes")
        row = ["   Real Estate Taxes"] + [_fc_deduction(v) for v in vals]
        y = _table_row(c, y, row, col_widths, col_aligns, size=8,
                       color=RED, mono_cols=numeric_cols)

    # Insurance (indented) — Fix 6
    if _any_has_data("insurance"):
        vals = _fin_vals("insurance")
        row = ["   Insurance"] + [_fc_deduction(v) for v in vals]
        y = _table_row(c, y, row, col_widths, col_aligns, size=8,
                       color=RED, mono_cols=numeric_cols)

    y -= 4

    # ---- NOI ----
    # Purple divider above NOI
    c.setStrokeColor(PURPLE_PRIMARY)
    c.setLineWidth(2)
    c.line(MARGIN_L, y - 2, PAGE_W - MARGIN_R, y - 2)
    y -= 8

    noi_vals = _fin_vals("noi")
    noi_h = 44
    _card_rect(c, MARGIN_L, y - noi_h, CONTENT_W, noi_h)

    c.setFont(_font("InstrumentSans-Bold"), 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 14, "Net Operating Income (NOI)")

    # Show NOI values across periods
    px = MARGIN_L + label_w
    for i, p in enumerate(period_order):
        noi_val = _sf(noi_vals[i])
        c.setFont(_font("JetBrainsMono-Bold"), 14)
        c.setFillColor(GREEN)
        noi_str = _fmt_currency(noi_val)
        tw = c.stringWidth(noi_str, _font("JetBrainsMono-Bold"), 14)
        cell_center = px + period_w / 2
        c.drawString(cell_center - tw / 2, y - 16, noi_str)

        # $/unit below
        if noi_val and prop.total_units and prop.total_units > 0:
            per_u = noi_val / prop.total_units
            c.setFont(_font("JetBrainsMono-Regular"), 7)
            c.setFillColor(TEXT_MUTED)
            pu_str = _fmt_currency(per_u) + "/unit"
            tw2 = c.stringWidth(pu_str, _font("JetBrainsMono-Regular"), 7)
            c.drawString(cell_center - tw2 / 2, y - 32, pu_str)

        # Period label
        c.setFont(_font("InstrumentSans-Regular"), 7)
        c.setFillColor(TEXT_MUTED)
        tw3 = c.stringWidth(p, _font("InstrumentSans-Regular"), 7)
        c.drawString(cell_center - tw3 / 2, y - 42, p)

        px += period_w

    y -= (noi_h + 14)

    # ---- OpEx Ratio Bar ----
    y = _header_bar(c, y, "OpEx Ratio")
    bar_h = 52

    for i, p in enumerate(period_order):
        fin = fin_periods[p]
        gsr_val = _sf(fin.get("gsr"))
        ltl_val = _sf(fin.get("loss_to_lease"))
        opex_val = _sf(fin.get("total_opex"))

        if gsr_val and opex_val:
            gpr = gsr_val - abs(ltl_val or 0)
            if gpr > 0:
                ratio = (abs(opex_val) / gpr) * 100
            else:
                ratio = None
        else:
            ratio = None

        bar_w = CONTENT_W / max(num_periods, 1) - 8
        bx = MARGIN_L + i * (bar_w + 8)
        _card_rect(c, bx, y - bar_h, bar_w, bar_h)

        c.setFont(_font("InstrumentSans-Bold"), 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(bx + 8, y - 14, p)

        if ratio is not None:
            # Draw bar background
            bar_inner_w = bar_w - 16
            bar_inner_h = 10
            bar_x = bx + 8
            bar_y = y - 34

            _rounded_rect(c, bar_x, bar_y, bar_inner_w, bar_inner_h, 3, fill=BG_MUTED)

            # Fill portion
            fill_w = min(ratio / 100, 1.0) * bar_inner_w
            if ratio < 40:
                bar_color = GREEN
            elif ratio < 55:
                bar_color = AMBER
            else:
                bar_color = RED
            if fill_w > 0:
                _rounded_rect(c, bar_x, bar_y, fill_w, bar_inner_h, 3, fill=bar_color)

            # Percentage text
            c.setFont(_font("JetBrainsMono-Bold"), 11)
            c.setFillColor(TEXT_HEADING)
            ratio_str = "{:.1f}%".format(ratio)
            tw = c.stringWidth(ratio_str, _font("JetBrainsMono-Bold"), 11)
            c.drawString(bx + bar_w - tw - 8, y - 14, ratio_str)

            # Dollar amount
            c.setFont(_font("JetBrainsMono-Regular"), 7)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 8, y - 48, _fmt_currency(abs(opex_val)) + " of " + _fmt_currency(gpr) + " GPR")
        else:
            c.setFont(_font("JetBrainsMono-Bold"), 11)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 8, y - 30, EM_DASH)


# ---------------------------------------------------------------------------
# Page 3: Rent Roll + Unit Mix + Rent Comps
# ---------------------------------------------------------------------------
def _draw_page3(c, prop, unit_mix, rent_comps, score):
    _page_bg(c)
    _page_header(c, prop.deal_name, score)
    _page_footer(c, 3, prop.deal_name)

    y = PAGE_H - 70

    # ---- Rent Roll Summary ----
    y = _header_bar(c, y, "Rent Roll Summary")

    # "As of" date in top right
    if prop.rr_as_of_date:
        c.setFont(_font("InstrumentSans-Regular"), 7)
        c.setFillColor(TEXT_MUTED)
        try:
            as_of_str = "As of " + prop.rr_as_of_date.strftime("%B %d, %Y")
        except Exception:
            as_of_str = "As of " + str(prop.rr_as_of_date)
        tw = c.stringWidth(as_of_str, _font("InstrumentSans-Regular"), 7)
        c.drawString(PAGE_W - MARGIN_R - tw, y + 20, as_of_str)

    # Grid of 6 stat boxes (3 per row)
    box_w = (CONTENT_W - 12) / 3
    box_h = 48
    row1_stats = [
        ("Total Units", _fmt_number(prop.rr_total_units), TEXT_PRIMARY),
        ("Occupied", _fmt_number(prop.rr_occupied_units), GREEN),
        ("Vacant", _fmt_number(prop.rr_vacancy_count), RED),
    ]

    # Physical occupancy color
    phys_occ = _sf(prop.rr_physical_occupancy_pct)
    phys_occ_color = GREEN if phys_occ and phys_occ >= 90 else (AMBER if phys_occ and phys_occ >= 80 else RED)

    avg_mkt_rent = _sf(prop.rr_avg_market_rent) or _sf(prop.average_market_rent)
    avg_ip_rent = _sf(prop.rr_avg_in_place_rent) or _sf(prop.average_inplace_rent)

    row2_stats = [
        ("Physical Occupancy", _fmt_pct(phys_occ), phys_occ_color if phys_occ else TEXT_MUTED),
        ("Avg Market Rent", _fmt_currency(avg_mkt_rent), AMBER),
        ("Avg In-Place Rent", _fmt_currency(avg_ip_rent), TEXT_PRIMARY),
    ]

    for row_idx, stats in enumerate([row1_stats, row2_stats]):
        for i, (label, val, val_color) in enumerate(stats):
            bx = MARGIN_L + i * (box_w + 6)
            by = y - box_h - row_idx * (box_h + 6)
            _card_rect(c, bx, by, box_w, box_h)

            c.setFont(_font("InstrumentSans-Regular"), 7)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 10, by + box_h - 14, label)

            c.setFont(_font("JetBrainsMono-Bold"), 14)
            c.setFillColor(val_color)
            c.drawString(bx + 10, by + 10, str(val))

    y -= (box_h * 2 + 6 + 18)

    # ---- Unit Mix Summary Table (Fix 5: aggregated by bedroom type) ----
    if unit_mix:
        y = _header_bar(c, y, "Unit Mix")

        agg = _aggregate_unit_mix(unit_mix)

        um_cols = ["Type", "Units", "Avg SF", "Avg In-Place", "Avg Proforma", "Avg Rent/SF"]
        um_widths = [CONTENT_W * w for w in [0.18, 0.12, 0.14, 0.19, 0.19, 0.18]]
        um_aligns = ["left", "right", "right", "right", "right", "right"]
        um_mono = {1, 2, 3, 4, 5}

        y = _table_row(c, y, um_cols, um_widths, um_aligns,
                       font=_font("InstrumentSans-Bold"), size=7,
                       color=TEXT_HEADING, bg=BG_MUTED)

        for i, row_data in enumerate(agg):
            is_total = row_data["type"] == "Total"
            row_bg = BG_MUTED if is_total else (BG_MUTED if i % 2 == 0 else None)
            row_font = _font("InstrumentSans-Bold") if is_total else None
            row_color = TEXT_HEADING if is_total else TEXT_PRIMARY

            row = [
                row_data["type"],
                _fmt_number(row_data["units"]),
                _fmt_number(row_data["avg_sf"]),
                _fmt_currency(row_data["avg_ip"]),
                _fmt_currency(row_data["avg_pf"]),
                "${:.2f}".format(row_data["avg_rpsf"]) if row_data["avg_rpsf"] else EM_DASH,
            ]
            y = _table_row(c, y, row, um_widths, um_aligns,
                           font=row_font, size=7, color=row_color,
                           bg=row_bg, mono_cols=um_mono)

        y -= 4

        # Compact full floorplan detail (6pt, limited rows)
        c.setFont(_font("InstrumentSans-Regular"), 6)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 4, y - 8, "Floorplan Detail")
        y -= 14

        detail_cols = ["Floorplan", "Type", "Units", "SF", "In-Place", "Proforma", "Rent/SF"]
        detail_widths = [CONTENT_W * w for w in [0.13, 0.16, 0.09, 0.09, 0.17, 0.17, 0.12]]
        detail_aligns = ["left", "left", "right", "right", "right", "right", "right"]
        detail_mono = {2, 3, 4, 5, 6}

        max_detail_rows = 18
        displayed = 0
        for i, um in enumerate(unit_mix):
            if displayed >= max_detail_rows:
                remaining = len(unit_mix) - max_detail_rows
                if remaining > 0:
                    c.setFont(_font("InstrumentSans-Regular"), 6)
                    c.setFillColor(TEXT_MUTED)
                    more_text = "... and {} more floorplans".format(remaining)
                    c.drawString(MARGIN_L + 4, y - 8, more_text)
                    y -= 12
                break

            if y < MARGIN_B + 60:
                remaining = len(unit_mix) - displayed
                if remaining > 0:
                    c.setFont(_font("InstrumentSans-Regular"), 6)
                    c.setFillColor(TEXT_MUTED)
                    more_text = "... and {} more floorplans".format(remaining)
                    c.drawString(MARGIN_L + 4, y - 8, more_text)
                    y -= 12
                break

            # Calculate rent/sf
            rent_per_sf = None
            proforma = _sf(um.proforma_rent)
            sf = _sf(um.unit_sf)
            if proforma and sf and sf > 0:
                rent_per_sf = proforma / sf

            row = [
                um.floorplan_name or EM_DASH,
                um.unit_type or EM_DASH,
                _fmt_number(um.num_units),
                _fmt_number(um.unit_sf),
                _fmt_currency(um.in_place_rent),
                _fmt_currency(um.proforma_rent),
                "${:.2f}".format(rent_per_sf) if rent_per_sf else EM_DASH,
            ]
            # Use smaller row height for compact view
            row_bg = BG_MUTED if i % 2 == 0 else None
            y = _table_row(c, y, row, detail_widths, detail_aligns,
                           size=6, color=TEXT_MUTED, bg=row_bg,
                           mono_cols=detail_mono)
            displayed += 1

        y -= 12

    # ---- Rent Comps Table (Fix 4: aggregated) ----
    if rent_comps:
        # Check if we have enough space
        if y < MARGIN_B + 80:
            return

        y = _header_bar(c, y, "Rent Comps")

        agg_comps = _aggregate_rent_comps(rent_comps)

        rc_cols = ["Comp Name", "Location", "Units", "Avg Rent", "Rent/SF"]
        rc_widths = [CONTENT_W * w for w in [0.30, 0.22, 0.13, 0.18, 0.17]]
        rc_aligns = ["left", "left", "right", "right", "right"]
        rc_mono = {2, 3, 4}

        y = _table_row(c, y, rc_cols, rc_widths, rc_aligns,
                       font=_font("InstrumentSans-Bold"), size=7,
                       color=TEXT_HEADING, bg=BG_MUTED)

        # Limit rows to fit remaining space
        available_rows = max(int((y - MARGIN_B - 20) / 20), 1)

        for i, comp in enumerate(agg_comps):
            if i >= available_rows:
                remaining = len(agg_comps) - available_rows
                if remaining > 0:
                    c.setFont(_font("InstrumentSans-Regular"), 7)
                    c.setFillColor(TEXT_MUTED)
                    more_text = "... and {} more comps".format(remaining)
                    c.drawString(MARGIN_L + 4, y - 12, more_text)
                break

            row_bg = BG_MUTED if i % 2 == 0 else None

            rent_psf_str = EM_DASH
            if comp["avg_psf"] and comp["avg_psf"] > 0:
                rent_psf_str = "${:.2f}".format(comp["avg_psf"])

            row = [
                comp["name"],
                comp["location"] or EM_DASH,
                _fmt_number(comp["units"]),
                _fmt_currency(comp["avg_rent"]),
                rent_psf_str,
            ]
            y = _table_row(c, y, row, rc_widths, rc_aligns,
                           size=7, color=TEXT_PRIMARY, bg=row_bg,
                           mono_cols=rc_mono)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_deal_summary(property_id: int, db: Session) -> bytes:
    """
    Generate a 3-page professional dark-themed PDF summary for a property.

    Returns the PDF file as bytes.
    Raises ValueError if property not found.
    """
    # Ensure Astra fonts are registered (Fix 1)
    _ensure_fonts()

    prop = db.query(Property).options(
        joinedload(Property.unit_mix),
        joinedload(Property.rent_comps)
    ).filter(Property.id == property_id).first()

    if not prop:
        raise ValueError("Property " + str(property_id) + " not found")

    unit_mix = prop.unit_mix or []
    rent_comps = prop.rent_comps or []

    # Parse financial JSON
    fin_periods = {}
    for key, json_field in [("T3", prop.t3_financials_json),
                            ("T12", prop.t12_financials_json),
                            ("Y1", prop.y1_financials_json)]:
        parsed = _parse_financials(json_field)
        if parsed:
            fin_periods[key] = parsed

    # Get BOV pricing tiers
    from app.services import bov_service
    bov_tiers_data = bov_service.get_bov_pricing_tiers(db, property_id)

    # Resolve screening score (Fix 3)
    score = _resolve_score(prop)

    # Build PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    # Page 1: Property Overview
    _draw_page1(c, prop, fin_periods, bov_tiers_data, score)
    c.showPage()

    # Page 2: Operating Financials
    _draw_page2(c, prop, fin_periods, score)
    c.showPage()

    # Page 3: Rent Roll + Unit Mix + Rent Comps
    _draw_page3(c, prop, unit_mix, rent_comps, score)
    c.showPage()

    c.save()
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
