"""
Data Bank routes — inventory, comps, and pipeline queries

Endpoints for managing submarket inventory, querying sales comps, and pipeline projects.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.data_bank import SubmarketInventory, SalesComp, PipelineProject
from app.api.deps import get_current_user
from app.schemas.scoring import SubmarketInventoryCreate, SubmarketInventoryResponse

router = APIRouter(prefix="/data-bank", tags=["Data Bank"])


# ==================== INVENTORY ====================

@router.post("/inventory", response_model=SubmarketInventoryResponse, status_code=status.HTTP_201_CREATED)
def set_inventory(
    data: SubmarketInventoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Set submarket inventory (upsert by metro + submarket).
    Used as the denominator for supply pipeline pressure calculations.
    """
    user_id = str(current_user.id)

    # Upsert: check if exists
    existing = db.query(SubmarketInventory).filter(
        SubmarketInventory.user_id == user_id,
        SubmarketInventory.metro == data.metro,
        SubmarketInventory.submarket == data.submarket,
    ).first()

    if existing:
        existing.total_units = data.total_units
        db.commit()
        db.refresh(existing)
        return existing

    inventory = SubmarketInventory(
        user_id=user_id,
        metro=data.metro,
        submarket=data.submarket,
        total_units=data.total_units,
    )
    db.add(inventory)
    db.commit()
    db.refresh(inventory)
    return inventory


@router.get("/inventory", response_model=List[SubmarketInventoryResponse])
def list_inventory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all submarket inventory entries for the current user."""
    inventories = db.query(SubmarketInventory).filter(
        SubmarketInventory.user_id == str(current_user.id),
    ).all()
    return inventories


# ==================== SALES COMPS ====================

@router.get("/comps")
def query_comps(
    metro: Optional[str] = Query(None),
    submarket: Optional[str] = Query(None),
    min_units: Optional[int] = Query(None),
    property_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Query sales comps with optional filters.
    Returns comp records from the user's data bank.
    """
    query = db.query(SalesComp).filter(
        SalesComp.user_id == str(current_user.id),
    )

    if metro:
        query = query.filter(SalesComp.metro == metro)
    if submarket:
        query = query.filter(SalesComp.submarket == submarket)
    if min_units is not None:
        query = query.filter(SalesComp.units >= min_units)
    if property_type:
        query = query.filter(SalesComp.property_type == property_type)

    comps = query.all()

    return [
        {
            "id": c.id,
            "property_name": c.property_name,
            "market": c.market,
            "metro": c.metro,
            "submarket": c.submarket,
            "county": c.county,
            "state": c.state,
            "address": c.address,
            "property_type": c.property_type,
            "sale_date": c.sale_date.isoformat() if c.sale_date else None,
            "year_built": c.year_built,
            "year_renovated": c.year_renovated,
            "units": c.units,
            "avg_unit_sf": c.avg_unit_sf,
            "avg_eff_rent": c.avg_eff_rent,
            "sale_price": c.sale_price,
            "price_per_unit": c.price_per_unit,
            "price_per_sf": c.price_per_sf,
            "cap_rate": c.cap_rate,
            "cap_rate_qualifier": c.cap_rate_qualifier,
            "occupancy": c.occupancy,
            "buyer": c.buyer,
            "seller": c.seller,
            "notes": c.notes,
        }
        for c in comps
    ]


# ==================== PIPELINE ====================

@router.get("/pipeline")
def query_pipeline(
    submarket: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Query pipeline projects with optional filters.
    Returns pipeline records from the user's data bank.
    """
    query = db.query(PipelineProject).filter(
        PipelineProject.user_id == str(current_user.id),
    )

    if submarket:
        query = query.filter(PipelineProject.submarket == submarket)
    if status_filter:
        query = query.filter(PipelineProject.status == status_filter)

    projects = query.all()

    return [
        {
            "id": p.id,
            "project_name": p.project_name,
            "address": p.address,
            "county": p.county,
            "metro": p.metro,
            "submarket": p.submarket,
            "units": p.units,
            "status": p.status,
            "developer": p.developer,
            "delivery_quarter": p.delivery_quarter,
            "start_quarter": p.start_quarter,
            "property_type": p.property_type,
        }
        for p in projects
    ]
