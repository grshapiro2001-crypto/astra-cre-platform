"""
Underwriting Engine API routes.

POST /underwriting/compute — stateless computation
POST /underwriting/save — persist inputs for a property
GET  /underwriting/{property_id} — load saved inputs + compute outputs
POST /underwriting/v2/integrated — compute proforma + v2 modules together
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.underwriting import UnderwritingModel
from app.schemas.underwriting import UWInputs, UWOutputs, SaveRequest, SaveResponse, LoadResponse
from app.services.underwriting_engine import UnderwritingEngine
from underwriting.v2.integration import run_integrated_underwriting
from underwriting.v2.schemas.integrated_result import (
    IntegratedUnderwritingInput,
    IntegratedUnderwritingResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/underwriting", tags=["underwriting"])


@router.post("/compute", response_model=UWOutputs)
def compute_underwriting(inputs: UWInputs):
    """Stateless computation endpoint. Takes complete inputs, returns complete outputs."""
    engine = UnderwritingEngine(inputs)
    return engine.compute()


@router.post("/v2/integrated", response_model=IntegratedUnderwritingResult)
def compute_integrated_underwriting(payload: IntegratedUnderwritingInput):
    """Stateless integrated computation: multifamily proforma composed
    with the v2 renovation / retail / tax-abatement modules.

    Auth-parity with ``/compute`` — unauthenticated today. Mirrors the
    existing underwriting endpoint pattern.
    """
    return run_integrated_underwriting(
        deal=payload.deal,
        renovation=payload.renovation,
        retail=payload.retail,
        tax_abatement=payload.tax_abatement,
    )


@router.post("/save", response_model=SaveResponse)
def save_underwriting(request: SaveRequest, db: Session = Depends(get_db)):
    """Save underwriting inputs for a property. Overwrites the active model."""
    # Deactivate any existing active model
    db.query(UnderwritingModel).filter(
        UnderwritingModel.property_id == request.property_id,
        UnderwritingModel.is_active == True,
    ).update({"is_active": False})

    # Create new active model
    model = UnderwritingModel(
        property_id=request.property_id,
        inputs_json=request.inputs.model_dump_json(),
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    return SaveResponse(
        model_id=model.id,
        saved_at=model.created_at.isoformat() if model.created_at else datetime.utcnow().isoformat(),
    )


@router.get("/{property_id}", response_model=LoadResponse)
def load_underwriting(property_id: int, db: Session = Depends(get_db)):
    """Load saved underwriting model for a property and compute outputs."""
    model = (
        db.query(UnderwritingModel)
        .filter(
            UnderwritingModel.property_id == property_id,
            UnderwritingModel.is_active == True,
        )
        .first()
    )

    if not model:
        raise HTTPException(status_code=404, detail="No saved underwriting model found")

    inputs = UWInputs.model_validate_json(model.inputs_json)
    engine = UnderwritingEngine(inputs)
    outputs = engine.compute()

    return LoadResponse(
        model_id=model.id,
        inputs=inputs,
        outputs=outputs,
    )
