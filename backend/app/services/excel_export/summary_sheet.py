"""Summary sheet — deal info + key metrics, all as cross-sheet formulas."""

from datetime import date

from app.schemas.underwriting import UWInputs, ScenarioResult

from .styles import put

SHEET = "Summary"


def build(wb, inputs: UWInputs, scenario: ScenarioResult, scenario_key: str,
          property_name: str, property_address: str,
          proforma_refs: dict, debt_refs: dict, cashflows_refs: dict) -> None:
    ws = wb.create_sheet(SHEET, 0)  # insert as first sheet
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 28
    ws.column_dimensions['B'].width = 26
    ws.column_dimensions['C'].width = 4
    ws.column_dimensions['D'].width = 28
    ws.column_dimensions['E'].width = 18

    put(ws, 1, 1, f"{property_name} — Underwriting Summary", style='title')
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=5)

    put(ws, 3, 1, "Deal Information", style='section')
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=2)
    deal_info = [
        ("Property Name", property_name),
        ("Address", property_address or ""),
        ("Total Units", inputs.total_units),
        ("Total Sq Ft", inputs.total_sf),
        ("Scenario", scenario_key.title()),
        ("Hold Period", f"{inputs.hold_period_years} years"),
        ("Exported", date.today().isoformat()),
    ]
    for i, (k, v) in enumerate(deal_info):
        put(ws, 4 + i, 1, k, style='label')
        put(ws, 4 + i, 2, v, style='label_bold')

    # Key Metrics column
    put(ws, 3, 4, "Key Metrics", style='section')
    ws.merge_cells(start_row=3, start_column=4, end_row=3, end_column=5)

    pf = proforma_refs["sheet"]
    rm = proforma_refs["row_map"]
    y1_noi = f"='{pf}'!B{rm['noi']}"
    y1_ti = f"='{pf}'!B{rm['total_income']}"
    y1_ds = debt_refs["ds_refs"][0] if debt_refs.get("ds_refs") else "0"

    metrics = [
        ("Purchase Price", "=PurchasePrice", 'money'),
        ("Loan Amount", "=LoanAmount", 'money'),
        ("Equity", "=Equity", 'money'),
        ("LTV", "=LoanAmount/PurchasePrice", 'percent'),
        ("Yr1 NOI", y1_noi, 'money'),
        ("Yr1 Total Income", y1_ti, 'money'),
        ("Going-In Cap Rate", f"={y1_noi.lstrip('=')}/PurchasePrice", 'percent_precise'),
        ("Terminal Cap Rate", "=TerminalCap", 'percent_precise'),
        ("Yr1 DSCR", f"={y1_noi.lstrip('=')}/{y1_ds}", 'multiple'),
        ("Levered IRR", f"={cashflows_refs['irr_cell']}", 'percent_precise'),
        ("Equity Multiple", f"={cashflows_refs['em_cell']}", 'multiple'),
        ("Avg Cash-on-Cash", f"={cashflows_refs['coc_cell']}", 'percent_precise'),
    ]
    for i, (lbl, formula, style) in enumerate(metrics):
        put(ws, 4 + i, 4, lbl, style='label')
        put(ws, 4 + i, 5, formula, style=style)

    ws.freeze_panes = 'A4'
