"""Underwriting Excel export endpoint.

GET /underwriting/{property_id}/export?scenario=premium
→ formula-driven xlsx with Summary, Assumptions, Proforma, Debt, Cash Flows.
"""

import logging
import re
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.underwriting import UnderwritingModel
from app.schemas.underwriting import UWInputs
from app.services.excel_export import build_underwriting_workbook
from app.services.underwriting_engine import UnderwritingEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/underwriting", tags=["underwriting"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_") or "Property"


@router.get("/{property_id}/export")
def export_underwriting(
    property_id: int,
    scenario: str = "premium",
    db: Session = Depends(get_db),
):
    if scenario not in ("premium", "market"):
        raise HTTPException(status_code=400, detail="scenario must be 'premium' or 'market'")

    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    model = (
        db.query(UnderwritingModel)
        .filter(
            UnderwritingModel.property_id == property_id,
            UnderwritingModel.is_active == True,
        )
        .first()
    )
    if not model:
        raise HTTPException(status_code=404, detail="No saved underwriting model for this property")

    inputs = UWInputs.model_validate_json(model.inputs_json)
    outputs = UnderwritingEngine(inputs).compute()

    if scenario not in outputs.scenarios:
        raise HTTPException(
            status_code=422,
            detail=f"Scenario '{scenario}' could not be computed from current inputs",
        )

    xlsx_bytes = build_underwriting_workbook(
        inputs=inputs,
        outputs=outputs,
        scenario_key=scenario,
        property_name=prop.deal_name or "Property",
        property_address=prop.property_address or "",
    )

    filename = f"{_safe_filename(prop.deal_name or 'Property')}_Underwriting_{scenario}_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
