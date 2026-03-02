"""
Stacking layout endpoints — save/retrieve 3D building layout and rent roll units.
Phase 1: Manual layout entry. Phase 2: Satellite auto-generation.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.database import get_db
from app.models.property import Property, RentRollUnit
from app.models.user import User
from app.api.deps import get_current_user
from app.services import property_service
from app.services.stacking_extraction_service import extract_stacking_layout

logger = logging.getLogger(__name__)

router = APIRouter()


class StackingLayoutRequest(BaseModel):
    layout: dict


class StackingLayoutResponse(BaseModel):
    property_id: int
    stacking_layout_json: Optional[str] = None


class RentRollUnitResponse(BaseModel):
    id: int
    unit_number: Optional[str] = None
    unit_type: Optional[str] = None
    sqft: Optional[int] = None
    status: Optional[str] = None
    is_occupied: Optional[bool] = None
    market_rent: Optional[float] = None
    in_place_rent: Optional[float] = None
    lease_start: Optional[str] = None
    lease_end: Optional[str] = None
    charge_details: Optional[Any] = None

    class Config:
        from_attributes = True


@router.patch("/properties/{property_id}/stacking-layout")
def save_stacking_layout(
    property_id: int,
    body: StackingLayoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StackingLayoutResponse:
    """Save or update the stacking layout for a property."""
    property_obj = property_service.get_property(
        db, property_id, current_user.id, update_view_date=False,
        org_id=getattr(current_user, 'organization_id', None),
    )
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    property_obj.stacking_layout_json = json.dumps(body.layout)
    db.commit()
    db.refresh(property_obj)

    logger.info("Saved stacking layout for property %d", property_id)

    return StackingLayoutResponse(
        property_id=property_obj.id,
        stacking_layout_json=property_obj.stacking_layout_json,
    )


@router.post("/properties/{property_id}/extract-stacking")
async def extract_stacking_from_satellite(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract building layout from satellite imagery via Claude Vision.

    Returns layout JSON for the user to review and confirm — does NOT save it.
    The user must call PATCH /stacking-layout to persist after reviewing.
    """
    property_obj = property_service.get_property(
        db, property_id, current_user.id, update_view_date=False,
        org_id=getattr(current_user, 'organization_id', None),
    )
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    address = property_obj.property_address
    if not address or not address.strip():
        raise HTTPException(
            status_code=400,
            detail="This property has no address on file. Enter an address or use manual entry.",
        )

    # Build property context for Claude Vision
    property_context = {
        "property_name": property_obj.deal_name,
        "total_units": property_obj.rr_total_units or property_obj.total_units,
        "total_sf": property_obj.total_residential_sf,
        "avg_unit_sf": property_obj.rr_avg_sqft,
        "year_built": property_obj.year_built,
        "occupied_units": property_obj.rr_occupied_units,
    }

    # Optionally get unit type mix from rent roll
    rent_roll_units = db.query(RentRollUnit).filter(
        RentRollUnit.property_id == property_id
    ).all()
    if rent_roll_units:
        type_counts: dict[str, int] = {}
        for unit in rent_roll_units:
            utype = unit.unit_type or "Unknown"
            type_counts[utype] = type_counts.get(utype, 0) + 1
        property_context["unit_mix"] = ", ".join(
            f"{count}x {utype}" for utype, count in sorted(type_counts.items())
        )

    try:
        layout = await extract_stacking_layout(address.strip(), property_context=property_context)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error("Satellite extraction failed for property %d: %s", property_id, e)
        raise HTTPException(
            status_code=502,
            detail=f"Could not analyze satellite imagery: {e}",
        )

    return {
        "property_id": property_id,
        "source": "satellite",
        "confidence": layout.get("confidence", "low"),
        "confidence_reason": layout.get("confidence_reason", ""),
        "layout": {
            "buildings": layout.get("buildings", []),
            "amenities": layout.get("amenities", []),
            "total_units": layout.get("total_units", 0),
        },
    }


@router.get("/properties/{property_id}/rent-roll-units")
def get_rent_roll_units(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RentRollUnitResponse]:
    """Get all rent roll units for a property (used by 3D stacking viewer)."""
    property_obj = property_service.get_property(
        db, property_id, current_user.id, update_view_date=False,
        org_id=getattr(current_user, 'organization_id', None),
    )
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    units = db.query(RentRollUnit).filter(
        RentRollUnit.property_id == property_id
    ).order_by(RentRollUnit.unit_number).all()

    results = []
    for u in units:
        results.append(RentRollUnitResponse(
            id=u.id,
            unit_number=u.unit_number,
            unit_type=u.unit_type,
            sqft=u.sqft,
            status=u.status,
            is_occupied=u.is_occupied,
            market_rent=u.market_rent,
            in_place_rent=u.in_place_rent,
            lease_start=u.lease_start.isoformat() if u.lease_start else None,
            lease_end=u.lease_end.isoformat() if u.lease_end else None,
            charge_details=u.charge_details,
        ))

    return results
