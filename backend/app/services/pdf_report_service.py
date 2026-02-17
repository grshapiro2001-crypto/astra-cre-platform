"""
PDF Report Service - Generates professional dark-themed deal summary PDFs

Astra CRE branded 3-page Property Summary
NO LLM CALLS - Pure database read + PDF generation
"""
import io
import json
import math
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session, joinedload
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.models.property import Property, PropertyUnitMix, PropertyRentComp


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


def _page_header(c, prop_name, score=None):
    """Draw top header: purple accent bar, logo text, property name, score badge."""
    # Purple accent bar at very top
    c.setFillColor(PURPLE_PRIMARY)
    c.rect(0, PAGE_H - 4, PAGE_W, 4, fill=1, stroke=0)

    header_y = PAGE_H - 44

    # "Astra CRE" logo text
    c.setFillColor(PURPLE_LIGHT)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN_L, header_y, "Astra CRE")

    # Property name
    c.setFillColor(TEXT_HEADING)
    c.setFont("Helvetica-Bold", 12)
    name = prop_name or "Untitled Property"
    if len(name) > 55:
        name = name[:52] + "..."
    c.drawString(MARGIN_L + 110, header_y + 1, name)

    # Deal score circle badge (if screening_score exists)
    if score is not None:
        badge_x = PAGE_W - MARGIN_R - 20
        badge_y = header_y + 4
        badge_r = 14
        # Score color: green if >= 70, amber if >= 50, red otherwise
        if score >= 70:
            badge_color = GREEN
        elif score >= 50:
            badge_color = AMBER
        else:
            badge_color = RED
        c.setFillColor(badge_color)
        c.circle(badge_x, badge_y, badge_r, fill=1, stroke=0)
        c.setFillColor(BG_DARK)
        c.setFont("Helvetica-Bold", 11)
        score_str = str(score)
        tw = c.stringWidth(score_str, "Helvetica-Bold", 11)
        c.drawString(badge_x - tw / 2, badge_y - 4, score_str)

    # Thin divider line below header
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, header_y - 12, PAGE_W - MARGIN_R, header_y - 12)


def _page_footer(c, page_num, prop_name):
    """Draw bottom footer."""
    footer_y = MARGIN_B - 10
    date_str = datetime.now().strftime("%B %d, %Y")

    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_MUTED)
    left_text = "Generated by Astra CRE Platform " + EM_DASH + " " + date_str
    c.drawString(MARGIN_L, footer_y, left_text)

    name = prop_name or "Property"
    if len(name) > 40:
        name = name[:37] + "..."
    right_text = name + " " + EM_DASH + " Page " + str(page_num)
    tw = c.stringWidth(right_text, "Helvetica", 7)
    c.drawString(PAGE_W - MARGIN_R - tw, footer_y, right_text)

    # Thin line above footer
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, footer_y + 12, PAGE_W - MARGIN_R, footer_y + 12)


def _header_bar(c, y, text):
    """Section header with purple underline. Returns new y below."""
    c.setFont("Helvetica-Bold", 13)
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
    c.setFont("Helvetica", label_size)
    c.setFillColor(label_color)
    c.drawString(x, y, label)
    c.setFont("Helvetica-Bold", value_size)
    c.setFillColor(value_color)
    c.drawString(x, y - 15, str(value))


def _table_row(c, y, cols, widths, aligns=None, font="Helvetica", size=8,
               color=None, bg=None):
    """Draw a row of table cells at given y. Returns y for next row."""
    if color is None:
        color = TEXT_PRIMARY
    if aligns is None:
        aligns = ["left"] * len(cols)

    row_h = 20
    x = MARGIN_L

    if bg:
        c.setFillColor(bg)
        c.rect(MARGIN_L, y - row_h + 5, CONTENT_W, row_h, fill=1, stroke=0)

    c.setFont(font, size)
    c.setFillColor(color)

    for i, (col_text, w) in enumerate(zip(cols, widths)):
        text = str(col_text) if col_text is not None else EM_DASH
        # Truncate if too wide
        max_chars = int(w / (size * 0.5))
        if len(text) > max_chars and max_chars > 3:
            text = text[:max_chars - 2] + ".."
        align = aligns[i] if i < len(aligns) else "left"
        if align == "right":
            tw = c.stringWidth(text, font, size)
            c.drawString(x + w - tw - 4, y - 10, text)
        elif align == "center":
            tw = c.stringWidth(text, font, size)
            c.drawString(x + (w - tw) / 2, y - 10, text)
        else:
            c.drawString(x + 4, y - 10, text)
        x += w

    return y - row_h


def _tag_chip(c, x, y, text, bg_color, text_color=None):
    """Draw a small colored tag chip. Returns x + width."""
    if text_color is None:
        text_color = TEXT_HEADING
    c.setFont("Helvetica-Bold", 7)
    tw = c.stringWidth(text, "Helvetica-Bold", 7)
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
def _draw_page1(c, prop, fin_periods, bov_tiers_data):
    _page_bg(c)
    _page_header(c, prop.deal_name, prop.screening_score)
    _page_footer(c, 1, prop.deal_name)

    y = PAGE_H - 70  # Start below header

    # ---- Property Address Card ----
    card_h = 62
    _card_rect(c, MARGIN_L, y - card_h, CONTENT_W, card_h)

    # Address
    c.setFont("Helvetica-Bold", 12)
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
    c.setFont("Helvetica-Bold", 9)
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
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 12, dy, label)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(TEXT_PRIMARY)
        tw = c.stringWidth(str(val), "Helvetica-Bold", 9)
        c.drawString(MARGIN_L + card_half_w - tw - 12, dy, str(val))
        dy -= 19

    # Right card: Rent Analysis
    rx = MARGIN_L + card_half_w + 10
    _card_rect(c, rx, y - card_h2, card_half_w, card_h2)
    c.setFont("Helvetica-Bold", 9)
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
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(rx + 12, dy, label)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(val_color)
        tw = c.stringWidth(str(val), "Helvetica-Bold", 10)
        c.drawString(rx + card_half_w - tw - 12, dy, str(val))
        dy -= 22

    y -= (card_h2 + 12)

    # ---- Economic Occupancy Banner ----
    # GPR = GSR - |Loss to Lease|, Econ Occ = NRI / GPR
    # Try to get from financials
    econ_occ_pct = None
    econ_nri = None
    econ_gpr = None
    for period_key in ["T3", "T12", "Y1"]:
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

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 18, "Economic Occupancy")

    c.setFont("Helvetica", 7)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 32, "NRI / GPR (where GPR = GSR - |Loss to Lease|)")

    if econ_occ_pct is not None:
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(banner_border)
        pct_str = "{:.1f}%".format(econ_occ_pct)
        tw = c.stringWidth(pct_str, "Helvetica-Bold", 20)
        c.drawString(PAGE_W - MARGIN_R - tw - 12, y - 22, pct_str)

        if econ_nri is not None:
            c.setFont("Helvetica", 7)
            c.setFillColor(TEXT_MUTED)
            nri_str = "NRI: " + _fmt_currency(econ_nri)
            tw2 = c.stringWidth(nri_str, "Helvetica", 7)
            c.drawString(PAGE_W - MARGIN_R - tw2 - 12, y - 38, nri_str)
    else:
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(TEXT_MUTED)
        tw = c.stringWidth(EM_DASH, "Helvetica-Bold", 14)
        c.drawString(PAGE_W - MARGIN_R - tw - 12, y - 26, EM_DASH)

    y -= (banner_h + 14)

    # ---- Pricing Analysis Section ----
    y = _header_bar(c, y, "Pricing Analysis")

    # Pricing Guidance card
    guidance = _sf(prop.user_guidance_price)
    guide_h = 38
    _card_rect(c, MARGIN_L, y - guide_h, CONTENT_W, guide_h, border_color=PURPLE_PRIMARY)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 14, "Pricing Guidance")
    c.setFont("Helvetica-Bold", 14)
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
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_MUTED)
        c.drawString(mx + 8, y - 14, label)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(PURPLE_LIGHT)
        c.drawString(mx + 8, y - 34, str(val))
        mx += metric_box_w + 6

    y -= (metric_h + 14)

    # ---- BOV Pricing Tiers table ----
    if bov_tiers_data:
        y = _header_bar(c, y, "BOV Pricing Tiers")

        # Column headers
        bov_cols = ["Tier", "Price", "$/Unit", "$/SF", "Unlev IRR",
                    "Lev IRR", "Eq Mult", "Avg CoC"]
        bov_widths = [CONTENT_W * w for w in [0.17, 0.14, 0.12, 0.10, 0.12, 0.12, 0.11, 0.12]]
        bov_aligns = ["left", "right", "right", "right", "right", "right", "right", "right"]

        # Header row
        y = _table_row(c, y, bov_cols, bov_widths, bov_aligns,
                       font="Helvetica-Bold", size=7, color=TEXT_HEADING, bg=BG_MUTED)

        for i, tier in enumerate(bov_tiers_data):
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
                           size=7, color=TEXT_PRIMARY, bg=row_bg)


# ---------------------------------------------------------------------------
# Page 2: Operating Financials
# ---------------------------------------------------------------------------
def _draw_page2(c, prop, fin_periods):
    _page_bg(c)
    _page_header(c, prop.deal_name, prop.screening_score)
    _page_footer(c, 2, prop.deal_name)

    y = PAGE_H - 70

    y = _header_bar(c, y, "Operating Financials")

    # Determine available periods (in order: T3, T12, Y1)
    period_order = []
    for key in ["T3", "T12", "Y1"]:
        if key in fin_periods:
            period_order.append(key)

    if not period_order:
        c.setFont("Helvetica", 10)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN_L + 12, y - 20, "No financial data available.")
        return

    num_periods = len(period_order)

    # Column layout: label + period columns
    label_w = CONTENT_W * 0.34
    period_w = (CONTENT_W - label_w) / max(num_periods, 1)
    col_widths = [label_w] + [period_w] * num_periods
    col_aligns = ["left"] + ["right"] * num_periods

    # Period headers
    header_cols = [""] + [p + " Pro Forma" if p == "Y1" else p + " Actuals" for p in period_order]
    y = _table_row(c, y, header_cols, col_widths, col_aligns,
                   font="Helvetica-Bold", size=8, color=TEXT_HEADING, bg=BG_MUTED)

    # Helper to get a fin value across periods
    def _fin_vals(key):
        return [fin_periods[p].get(key) for p in period_order]

    def _any_has_data(key):
        return any(_sf(fin_periods[p].get(key)) is not None for p in period_order)

    # ---- Revenue Section ----
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(MARGIN_L + 4, y - 12, "REVENUE")
    y -= 18

    # GSR
    gsr_vals = _fin_vals("gsr")
    row = ["Gross Scheduled Rent (GSR)"] + [_fmt_currency(v) for v in gsr_vals]
    y = _table_row(c, y, row, col_widths, col_aligns, size=8, color=TEXT_PRIMARY)

    # Deduction rows (indented, red)
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
        row_data = ["   " + label] + [_fmt_currency_neg(v) for v in vals]
        y = _table_row(c, y, row_data, col_widths, col_aligns, size=8, color=RED)

    # Non-Revenue Units (only if data)
    if _any_has_data("non_revenue_units"):
        vals = _fin_vals("non_revenue_units")
        row_data = ["   Non-Revenue Units"] + [_fmt_currency_neg(v) for v in vals]
        y = _table_row(c, y, row_data, col_widths, col_aligns, size=8, color=RED)

    # Divider
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_L, y - 2, PAGE_W - MARGIN_R, y - 2)
    y -= 6

    # Net Rental Income (bold)
    nri_vals = _fin_vals("net_rental_income")
    row = ["Net Rental Income"] + [_fmt_currency(v) for v in nri_vals]
    y = _table_row(c, y, row, col_widths, col_aligns,
                   font="Helvetica-Bold", size=9, color=TEXT_HEADING, bg=BG_MUTED)

    y -= 8

    # ---- Expenses Section ----
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(PURPLE_LIGHT)
    c.drawString(MARGIN_L + 4, y - 12, "EXPENSES")
    y -= 18

    # Total Operating Expenses
    opex_vals = _fin_vals("total_opex")
    row = ["Total Operating Expenses"] + [_fmt_currency_neg(v) for v in opex_vals]
    y = _table_row(c, y, row, col_widths, col_aligns, size=8, color=RED)

    # Real Estate Taxes (indented)
    if _any_has_data("real_estate_taxes"):
        vals = _fin_vals("real_estate_taxes")
        row = ["   Real Estate Taxes"] + [_fmt_currency_neg(v) for v in vals]
        y = _table_row(c, y, row, col_widths, col_aligns, size=8, color=RED)

    # Insurance (indented)
    if _any_has_data("insurance"):
        vals = _fin_vals("insurance")
        row = ["   Insurance"] + [_fmt_currency_neg(v) for v in vals]
        y = _table_row(c, y, row, col_widths, col_aligns, size=8, color=RED)

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

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(MARGIN_L + 12, y - 14, "Net Operating Income (NOI)")

    # Show NOI values across periods
    px = MARGIN_L + label_w
    for i, p in enumerate(period_order):
        noi_val = _sf(noi_vals[i])
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(GREEN)
        noi_str = _fmt_currency(noi_val)
        tw = c.stringWidth(noi_str, "Helvetica-Bold", 14)
        cell_center = px + period_w / 2
        c.drawString(cell_center - tw / 2, y - 16, noi_str)

        # $/unit below
        if noi_val and prop.total_units and prop.total_units > 0:
            per_u = noi_val / prop.total_units
            c.setFont("Helvetica", 7)
            c.setFillColor(TEXT_MUTED)
            pu_str = _fmt_currency(per_u) + "/unit"
            tw2 = c.stringWidth(pu_str, "Helvetica", 7)
            c.drawString(cell_center - tw2 / 2, y - 32, pu_str)

        # Period label
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_MUTED)
        tw3 = c.stringWidth(p, "Helvetica", 7)
        c.drawString(cell_center - tw3 / 2, y - 42, p)

        px += period_w

    y -= (noi_h + 14)

    # ---- OpEx Ratio Bar ----
    # OpEx Ratio = total_opex / GPR * 100 where GPR = GSR - |loss_to_lease|
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

        c.setFont("Helvetica-Bold", 8)
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
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(TEXT_HEADING)
            ratio_str = "{:.1f}%".format(ratio)
            tw = c.stringWidth(ratio_str, "Helvetica-Bold", 11)
            c.drawString(bx + bar_w - tw - 8, y - 14, ratio_str)

            # Dollar amount
            c.setFont("Helvetica", 7)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 8, y - 48, _fmt_currency(abs(opex_val)) + " of " + _fmt_currency(gpr) + " GPR")
        else:
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 8, y - 30, EM_DASH)


# ---------------------------------------------------------------------------
# Page 3: Rent Roll + Unit Mix + Rent Comps
# ---------------------------------------------------------------------------
def _draw_page3(c, prop, unit_mix, rent_comps):
    _page_bg(c)
    _page_header(c, prop.deal_name, prop.screening_score)
    _page_footer(c, 3, prop.deal_name)

    y = PAGE_H - 70

    # ---- Rent Roll Summary ----
    y = _header_bar(c, y, "Rent Roll Summary")

    # "As of" date in top right
    if prop.rr_as_of_date:
        c.setFont("Helvetica", 7)
        c.setFillColor(TEXT_MUTED)
        try:
            as_of_str = "As of " + prop.rr_as_of_date.strftime("%B %d, %Y")
        except Exception:
            as_of_str = "As of " + str(prop.rr_as_of_date)
        tw = c.stringWidth(as_of_str, "Helvetica", 7)
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

            c.setFont("Helvetica", 7)
            c.setFillColor(TEXT_MUTED)
            c.drawString(bx + 10, by + box_h - 14, label)

            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(val_color)
            c.drawString(bx + 10, by + 10, str(val))

    y -= (box_h * 2 + 6 + 18)

    # ---- Unit Mix Table ----
    if unit_mix:
        y = _header_bar(c, y, "Unit Mix")

        um_cols = ["Floorplan", "Type", "Units", "SF", "In-Place Rent",
                   "Proforma Rent", "Rent/SF"]
        um_widths = [CONTENT_W * w for w in [0.13, 0.16, 0.09, 0.09, 0.17, 0.17, 0.12]]
        um_aligns = ["left", "left", "right", "right", "right", "right", "right"]

        y = _table_row(c, y, um_cols, um_widths, um_aligns,
                       font="Helvetica-Bold", size=7, color=TEXT_HEADING, bg=BG_MUTED)

        max_rows = 18
        displayed = 0
        for i, um in enumerate(unit_mix):
            if displayed >= max_rows:
                remaining = len(unit_mix) - max_rows
                c.setFont("Helvetica", 7)
                c.setFillColor(TEXT_MUTED)
                more_text = "... and " + str(remaining) + " more floorplans"
                c.drawString(MARGIN_L + 4, y - 12, more_text)
                y -= 16
                break

            row_bg = BG_MUTED if i % 2 == 0 else None

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
                "$" + _fmt_number(rent_per_sf, decimals=2) if rent_per_sf else EM_DASH,
            ]
            y = _table_row(c, y, row, um_widths, um_aligns,
                           size=7, color=TEXT_PRIMARY, bg=row_bg)
            displayed += 1

        y -= 12

    # ---- Rent Comps Table ----
    if rent_comps:
        # Check if we have enough space (at least ~100pt for header + a few rows)
        if y < MARGIN_B + 80:
            return  # Not enough space

        y = _header_bar(c, y, "Rent Comps")

        rc_cols = ["Comp Name", "Location", "Units", "Avg Rent", "Rent/SF"]
        rc_widths = [CONTENT_W * w for w in [0.30, 0.22, 0.13, 0.18, 0.17]]
        rc_aligns = ["left", "left", "right", "right", "right"]

        y = _table_row(c, y, rc_cols, rc_widths, rc_aligns,
                       font="Helvetica-Bold", size=7, color=TEXT_HEADING, bg=BG_MUTED)

        # Limit rows to fit remaining space
        available_rows = max(int((y - MARGIN_B - 20) / 20), 1)

        for i, rc in enumerate(rent_comps):
            if i >= available_rows:
                remaining = len(rent_comps) - available_rows
                if remaining > 0:
                    c.setFont("Helvetica", 7)
                    c.setFillColor(TEXT_MUTED)
                    more_text = "... and " + str(remaining) + " more comps"
                    c.drawString(MARGIN_L + 4, y - 12, more_text)
                break

            row_bg = BG_MUTED if i % 2 == 0 else None

            rent_psf_str = EM_DASH
            if rc.in_place_rent_psf:
                rent_psf_str = "$" + _fmt_number(rc.in_place_rent_psf, decimals=2)

            row = [
                rc.comp_name or EM_DASH,
                rc.location or EM_DASH,
                _fmt_number(rc.num_units),
                _fmt_currency(rc.in_place_rent),
                rent_psf_str,
            ]
            y = _table_row(c, y, row, rc_widths, rc_aligns,
                           size=7, color=TEXT_PRIMARY, bg=row_bg)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_deal_summary(property_id: int, db: Session) -> bytes:
    """
    Generate a 3-page professional dark-themed PDF summary for a property.

    Returns the PDF file as bytes.
    Raises ValueError if property not found.
    """
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

    # Build PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    # Page 1: Property Overview
    _draw_page1(c, prop, fin_periods, bov_tiers_data)
    c.showPage()

    # Page 2: Operating Financials
    _draw_page2(c, prop, fin_periods)
    c.showPage()

    # Page 3: Rent Roll + Unit Mix + Rent Comps
    _draw_page3(c, prop, unit_mix, rent_comps)
    c.showPage()

    c.save()
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
