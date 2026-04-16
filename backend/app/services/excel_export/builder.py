"""Orchestrator — build the underwriting workbook and return bytes."""

from io import BytesIO

from openpyxl import Workbook

from app.schemas.underwriting import UWInputs, UWOutputs

from . import assumptions_sheet, cashflows_sheet, debt_sheet, proforma_sheet, summary_sheet


def build_underwriting_workbook(
    inputs: UWInputs,
    outputs: UWOutputs,
    scenario_key: str,
    property_name: str,
    property_address: str = "",
) -> bytes:
    """Build an Excel workbook from UW inputs/outputs for a given scenario.

    Returns xlsx file bytes. The workbook contains: Summary, Assumptions,
    Proforma, Debt, Cash Flows. All key metrics are Excel formulas that
    reference Assumptions named ranges so users can modify assumptions
    in Excel and have results recalculate.
    """
    if scenario_key not in outputs.scenarios:
        raise ValueError(f"Scenario '{scenario_key}' not in computed outputs")
    scenario = outputs.scenarios[scenario_key]

    wb = Workbook()
    # Remove the default sheet — we create named ones explicitly.
    default = wb.active
    wb.remove(default)

    # Order of creation is important: Assumptions must exist first so other
    # sheets can reference its named ranges and cells.
    assumptions_refs = assumptions_sheet.build(wb, inputs, scenario, scenario_key)
    debt_refs = debt_sheet.build(wb, inputs, scenario)
    proforma_refs = proforma_sheet.build(wb, inputs, scenario, scenario_key, assumptions_refs)
    cashflows_refs = cashflows_sheet.build(wb, inputs, scenario, proforma_refs, debt_refs)
    summary_sheet.build(
        wb, inputs, scenario, scenario_key,
        property_name, property_address,
        proforma_refs, debt_refs, cashflows_refs,
    )

    # Make Summary the active sheet shown on open.
    wb.active = 0

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
