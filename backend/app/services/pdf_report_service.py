"""
PDF Report Service - Generates professional deal summary PDFs

NO LLM CALLS - Pure database read + PDF generation
"""
import io
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak,
    KeepTogether,
)

from app.models.property import Property, PropertyUnitMix, PropertyRentComp


# ---------------------------------------------------------------------------
# Color scheme
# ---------------------------------------------------------------------------
PURPLE = colors.HexColor("#7c3aed")
PURPLE_LIGHT = colors.HexColor("#ede9fe")
GRAY_LIGHT = colors.HexColor("#f9fafb")
GRAY_BORDER = colors.HexColor("#e5e7eb")
WHITE = colors.white
BLACK = colors.HexColor("#111827")
GRAY_TEXT = colors.HexColor("#6b7280")


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------
def _fmt_currency(value, fallback="\u2014") -> str:
    """Format a numeric value as $X,XXX."""
    if value is None:
        return fallback
    try:
        v = float(value)
        if abs(v) >= 1_000_000:
            return f"${v:,.0f}"
        return f"${v:,.0f}"
    except (TypeError, ValueError):
        return fallback


def _fmt_number(value, decimals=0, fallback="\u2014") -> str:
    if value is None:
        return fallback
    try:
        v = float(value)
        if decimals == 0:
            return f"{v:,.0f}"
        return f"{v:,.{decimals}f}"
    except (TypeError, ValueError):
        return fallback


def _fmt_pct(value, fallback="\u2014") -> str:
    if value is None:
        return fallback
    try:
        return f"{float(value):.1f}%"
    except (TypeError, ValueError):
        return fallback


def _safe_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Style factory
# ---------------------------------------------------------------------------
def _build_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "PDFTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            textColor=WHITE,
            leading=22,
        ),
        "subtitle": ParagraphStyle(
            "PDFSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#c4b5fd"),
            leading=14,
        ),
        "section_header": ParagraphStyle(
            "SectionHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=PURPLE,
            leading=16,
            spaceBefore=4,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=BLACK,
            leading=13,
        ),
        "body_small": ParagraphStyle(
            "BodySmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=GRAY_TEXT,
            leading=11,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            textColor=GRAY_TEXT,
            alignment=TA_CENTER,
            leading=10,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=BLACK,
            leading=12,
        ),
        "cell_bold": ParagraphStyle(
            "CellBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=BLACK,
            leading=12,
        ),
        "cell_header": ParagraphStyle(
            "CellHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=WHITE,
            leading=12,
        ),
        "score_large": ParagraphStyle(
            "ScoreLarge",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=PURPLE,
            alignment=TA_CENTER,
            leading=26,
        ),
    }
    return styles


# ---------------------------------------------------------------------------
# Table helper
# ---------------------------------------------------------------------------
def _make_table(data: list, col_widths: list, header_row=True) -> Table:
    """Build a consistently styled table."""
    table = Table(data, colWidths=col_widths)
    style_commands = [
        # Global
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), BLACK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        # Bottom border on every row
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
    ]

    if header_row and len(data) > 0:
        style_commands += [
            ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ]

    # Alternating row backgrounds (skip header)
    start = 1 if header_row else 0
    for i in range(start, len(data)):
        if (i - start) % 2 == 1:
            style_commands.append(("BACKGROUND", (0, i), (-1, i), GRAY_LIGHT))

    table.setStyle(TableStyle(style_commands))
    return table


# ---------------------------------------------------------------------------
# Parse financials JSON
# ---------------------------------------------------------------------------
def _parse_financials(json_str: Optional[str]) -> Optional[Dict[str, Any]]:
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_deal_summary(property_id: int, db: Session) -> bytes:
    """
    Generate a 2-page professional PDF summary for a property.

    Returns the PDF file as bytes.
    Raises ValueError if property not found.
    """
    prop: Optional[Property] = (
        db.query(Property)
        .filter(Property.id == property_id)
        .first()
    )
    if not prop:
        raise ValueError(f"Property {property_id} not found")

    # Eagerly load relationships
    unit_mix: List[PropertyUnitMix] = prop.unit_mix or []
    rent_comps: List[PropertyRentComp] = prop.rent_comps or []

    # Parse financial JSON
    fin_periods = {}
    for key, json_field in [("Y1", prop.y1_financials_json), ("T12", prop.t12_financials_json), ("T3", prop.t3_financials_json)]:
        parsed = _parse_financials(json_field)
        if parsed:
            fin_periods[key] = parsed

    styles = _build_styles()
    now = datetime.now()
    date_str = now.strftime("%B %d, %Y")
    timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    elements = []
    usable_width = letter[0] - 1.2 * inch  # total page - margins

    # ==================================================================
    # PAGE 1 - Property Overview
    # ==================================================================

    # --- Header banner ---
    header_data = [[
        Paragraph("INVESTMENT SUMMARY", styles["title"]),
    ]]
    header_table = Table(header_data, colWidths=[usable_width])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("ROUNDEDCORNERS", [6, 6, 0, 0]),
    ]))
    elements.append(header_table)

    # Sub-header with property name + date
    sub_data = [[
        Paragraph(prop.deal_name or "Untitled Property", styles["subtitle"]),
        Paragraph(f"Generated: {date_str}", styles["subtitle"]),
    ]]
    sub_table = Table(sub_data, colWidths=[usable_width * 0.65, usable_width * 0.35])
    sub_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#6d28d9")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("ROUNDEDCORNERS", [0, 0, 6, 6]),
    ]))
    elements.append(sub_table)
    elements.append(Spacer(1, 14))

    # --- Property Snapshot table ---
    elements.append(Paragraph("Property Snapshot", styles["section_header"]))

    total_sf = prop.total_residential_sf
    total_units = prop.total_units
    avg_unit_sf = None
    if total_sf and total_units and total_units > 0:
        avg_unit_sf = round(total_sf / total_units)

    snapshot_rows = [
        ["Address", prop.property_address or "\u2014"],
        ["Metro / Submarket", f"{prop.metro or '\u2014'} / {prop.submarket or '\u2014'}"],
        ["Property Type", prop.property_type or "\u2014"],
        ["Units", _fmt_number(total_units)],
        ["Year Built", _fmt_number(prop.year_built)],
        ["Total SF", _fmt_number(total_sf)],
        ["Avg Unit SF", _fmt_number(avg_unit_sf)],
    ]
    snapshot_data = [["Metric", "Value"]] + snapshot_rows
    snapshot_table = _make_table(snapshot_data, [usable_width * 0.4, usable_width * 0.6])
    elements.append(snapshot_table)
    elements.append(Spacer(1, 12))

    # --- Pricing section (BOV tier or basic) ---
    pricing_shown = False

    # Check for BOV pricing tiers
    from app.models.deal_folder import BOVPricingTier, BOVCapRate
    bov_tiers = (
        db.query(BOVPricingTier)
        .filter(BOVPricingTier.property_id == property_id)
        .all()
    )

    if bov_tiers:
        elements.append(Paragraph("Pricing & Returns", styles["section_header"]))
        pricing_rows = [["Tier", "Guidance Price", "Price/Unit", "Price/SF", "Cap Rate"]]
        for tier in bov_tiers:
            # Get first cap rate for this tier
            cap_rate_val = "\u2014"
            tier_caps = (
                db.query(BOVCapRate)
                .filter(BOVCapRate.pricing_tier_id == tier.id)
                .all()
            )
            for cr in tier_caps:
                if cr.cap_rate_value is not None:
                    cap_rate_val = _fmt_pct(cr.cap_rate_value)
                    break

            pricing_rows.append([
                tier.tier_label or tier.pricing_tier_id or "\u2014",
                _fmt_currency(tier.pricing),
                _fmt_currency(tier.price_per_unit),
                f"${_fmt_number(tier.price_per_sf, decimals=2)}" if tier.price_per_sf else "\u2014",
                cap_rate_val,
            ])
        pricing_table = _make_table(pricing_rows, [
            usable_width * 0.2,
            usable_width * 0.22,
            usable_width * 0.2,
            usable_width * 0.18,
            usable_width * 0.2,
        ])
        elements.append(pricing_table)
        elements.append(Spacer(1, 12))
        pricing_shown = True

    if not pricing_shown:
        # Show simple pricing from first Y1 or T12 if we have NOI and some price info
        # We don't have explicit pricing fields on non-BOV, so skip if no BOV tiers
        pass

    # --- Financial Summary Table ---
    if fin_periods:
        elements.append(Paragraph("Financial Summary", styles["section_header"]))

        fin_header = ["Line Item"] + list(fin_periods.keys())
        col_count = len(fin_header)
        label_width = usable_width * 0.35
        data_col_width = (usable_width - label_width) / max(col_count - 1, 1)

        def _fin_row(label: str, key: str, fmt_func=_fmt_currency):
            row = [label]
            for period_label in fin_periods:
                val = fin_periods[period_label].get(key)
                row.append(fmt_func(val))
            return row

        fin_rows = [fin_header]
        fin_rows.append(_fin_row("Gross Scheduled Rent", "gsr"))
        fin_rows.append(_fin_row("Vacancy", "vacancy"))
        fin_rows.append(_fin_row("Bad Debt / Credit Loss", "credit_loss"))
        fin_rows.append(_fin_row("Effective Gross Income", "net_rental_income"))
        fin_rows.append(_fin_row("Operating Expenses", "total_opex"))
        fin_rows.append(_fin_row("Net Operating Income", "noi"))
        fin_rows.append(_fin_row("OpEx Ratio", "expense_ratio_pct", _fmt_pct))

        # Economic occupancy: derive from vacancy_rate_pct if available
        econ_occ_row = ["Economic Occupancy"]
        for period_label in fin_periods:
            vac_pct = fin_periods[period_label].get("vacancy_rate_pct")
            if vac_pct is not None:
                econ_occ_row.append(_fmt_pct(100.0 - float(vac_pct)))
            else:
                econ_occ_row.append("\u2014")
        fin_rows.append(econ_occ_row)

        col_widths = [label_width] + [data_col_width] * (col_count - 1)
        fin_table = _make_table(fin_rows, col_widths)

        # Bold the NOI row
        noi_row_idx = 6  # 0=header, 1=GSR, 2=Vacancy, 3=BadDebt, 4=EGI, 5=OpEx, 6=NOI
        fin_table.setStyle(TableStyle([
            ("FONTNAME", (0, noi_row_idx), (-1, noi_row_idx), "Helvetica-Bold"),
            ("BACKGROUND", (0, noi_row_idx), (-1, noi_row_idx), PURPLE_LIGHT),
        ]))
        elements.append(fin_table)
        elements.append(Spacer(1, 12))

    # --- Deal Score ---
    # We don't query scoring service here to avoid complexity;
    # just show market sentiment if available
    if prop.market_sentiment_score is not None:
        elements.append(Paragraph("Market Sentiment", styles["section_header"]))
        score_text = f"Score: {prop.market_sentiment_score} / 10"
        if prop.market_sentiment_rationale:
            score_text += f"  \u2014  {prop.market_sentiment_rationale}"
        elements.append(Paragraph(score_text, styles["body"]))
        elements.append(Spacer(1, 12))

    # ==================================================================
    # PAGE 2 - Market Context
    # ==================================================================
    elements.append(PageBreak())

    # Re-add a smaller header for page 2
    p2_header_data = [[
        Paragraph("MARKET CONTEXT", styles["title"]),
        Paragraph(prop.deal_name or "", styles["subtitle"]),
    ]]
    p2_header = Table(p2_header_data, colWidths=[usable_width * 0.5, usable_width * 0.5])
    p2_header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    elements.append(p2_header)
    elements.append(Spacer(1, 14))

    # --- Unit Mix Summary ---
    if unit_mix:
        elements.append(Paragraph("Unit Mix Summary", styles["section_header"]))

        # Group by bedroom_count
        bedroom_groups: Dict[int, Dict] = {}
        for u in unit_mix:
            bd = u.bedroom_count if u.bedroom_count is not None else -1
            if bd not in bedroom_groups:
                bedroom_groups[bd] = {"units": 0, "total_sf": 0, "total_rent": 0, "rent_count": 0}
            grp = bedroom_groups[bd]
            num = u.num_units or 0
            grp["units"] += num
            if u.unit_sf and num:
                grp["total_sf"] += u.unit_sf * num
            if u.in_place_rent is not None and num:
                grp["total_rent"] += float(u.in_place_rent) * num
                grp["rent_count"] += num

        um_rows = [["Bedroom Type", "Total Units", "Avg SF", "Avg Rent"]]
        for bd in sorted(bedroom_groups.keys()):
            grp = bedroom_groups[bd]
            label = "Studio" if bd == 0 else f"{bd} BR" if bd > 0 else "Unknown"
            avg_sf = round(grp["total_sf"] / grp["units"]) if grp["units"] > 0 and grp["total_sf"] > 0 else None
            avg_rent = round(grp["total_rent"] / grp["rent_count"]) if grp["rent_count"] > 0 else None
            um_rows.append([
                label,
                _fmt_number(grp["units"]),
                _fmt_number(avg_sf),
                _fmt_currency(avg_rent),
            ])

        um_table = _make_table(um_rows, [
            usable_width * 0.25,
            usable_width * 0.25,
            usable_width * 0.25,
            usable_width * 0.25,
        ])
        elements.append(um_table)
        elements.append(Spacer(1, 12))

    # --- Rent Comps ---
    if rent_comps:
        elements.append(Paragraph("Rent Comparables", styles["section_header"]))

        rc_rows = [["Comp Name", "Location", "Units", "Avg Rent", "Rent/SF"]]
        for c in rent_comps:
            rc_rows.append([
                c.comp_name or "\u2014",
                c.location or "\u2014",
                _fmt_number(c.num_units),
                _fmt_currency(c.in_place_rent),
                f"${_fmt_number(c.in_place_rent_psf, decimals=2)}" if c.in_place_rent_psf else "\u2014",
            ])

        rc_table = _make_table(rc_rows, [
            usable_width * 0.28,
            usable_width * 0.22,
            usable_width * 0.15,
            usable_width * 0.18,
            usable_width * 0.17,
        ])
        elements.append(rc_table)
        elements.append(Spacer(1, 12))

    # --- Renovation Assumptions ---
    reno_cost = _safe_float(prop.renovation_cost_per_unit)
    reno_total = _safe_float(prop.renovation_total_cost)
    reno_premium = _safe_float(prop.renovation_rent_premium)
    reno_roi = _safe_float(prop.renovation_roi_pct)

    if any(v is not None for v in [reno_cost, reno_total, reno_premium, reno_roi]):
        elements.append(Paragraph("Renovation Assumptions", styles["section_header"]))

        reno_rows = [["Metric", "Value"]]
        if reno_cost is not None:
            reno_rows.append(["Cost / Unit", _fmt_currency(reno_cost)])
        if reno_total is not None:
            reno_rows.append(["Total Cost", _fmt_currency(reno_total)])
        if reno_premium is not None:
            reno_rows.append(["Rent Premium", _fmt_currency(reno_premium)])
        if reno_roi is not None:
            reno_rows.append(["ROI", _fmt_pct(reno_roi)])

        reno_table = _make_table(reno_rows, [usable_width * 0.5, usable_width * 0.5])
        elements.append(reno_table)
        elements.append(Spacer(1, 12))

    # --- Footer ---
    elements.append(Spacer(1, 20))
    footer_text = f"Generated by Astra CRE Platform  \u00B7  {timestamp_str}"
    elements.append(Paragraph(footer_text, styles["footer"]))

    # Build PDF
    doc.build(elements)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
