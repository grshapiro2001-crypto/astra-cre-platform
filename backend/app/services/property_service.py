"""
Property service - Database operations ONLY (NO LLM CALLS)

CRITICAL: This service is for read/write operations to the database.
It does NOT call the LLM or re-analyze PDFs.
LLM calls are ONLY in claude_extraction_service.py
"""
import json
import logging
import os
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.models.property import Property, AnalysisLog
from app.models.deal_folder import DealFolder
from app.schemas.property import PropertyCreate, PropertyFilters, FinancialPeriodData
from app.services import bov_service

logger = logging.getLogger(__name__)


# ==================== SAVE PROPERTY ====================

def save_property(
    db: Session,
    user_id: str,
    property_data: PropertyCreate
) -> Property:
    """
    Save analyzed property to database (NO LLM CALLS)

    This function:
    - Validates folder exists and belongs to user
    - Saves property data to database
    - Converts financial data to JSON strings
    - Extracts NOI values for filtering/sorting
    - Updates folder document_count
    - Creates analysis log entry
    - Does NOT call LLM
    - Does NOT re-read PDF
    """
    # Phase 3A: Validate folder exists and belongs to user
    folder = db.query(DealFolder).filter(
        DealFolder.id == property_data.deal_folder_id,
        DealFolder.user_id == user_id  # Fixed: user_id is already a string (UUID)
    ).first()

    if not folder:
        raise ValueError(f"Folder {property_data.deal_folder_id} not found or access denied")

    # Create search text (lowercase for fast searching)
    search_parts = [
        property_data.deal_name or "",
        property_data.property_address or "",
        property_data.property_type or "",
        property_data.submarket or ""
    ]
    search_text = " ".join(search_parts).lower()

    # Convert financial periods to JSON and extract granular fields
    t12_json = None
    t3_json = None
    y1_json = None
    t12_noi = None
    t3_noi = None
    y1_noi = None

    # Extract granular T12 fields
    t12_granular = {}
    if property_data.t12_financials:
        t12_json = json.dumps(property_data.t12_financials.model_dump())
        t12_noi = property_data.t12_financials.noi
        t12_granular = {
            "t12_loss_to_lease": property_data.t12_financials.loss_to_lease,
            "t12_vacancy_rate_pct": property_data.t12_financials.vacancy_rate_pct,
            "t12_concessions": property_data.t12_financials.concessions,
            "t12_credit_loss": property_data.t12_financials.credit_loss,
            "t12_net_rental_income": property_data.t12_financials.net_rental_income,
            "t12_utility_reimbursements": property_data.t12_financials.utility_reimbursements,
            "t12_parking_storage_income": property_data.t12_financials.parking_storage_income,
            "t12_other_income": property_data.t12_financials.other_income,
            "t12_management_fee_pct": property_data.t12_financials.management_fee_pct,
            "t12_real_estate_taxes": property_data.t12_financials.real_estate_taxes,
            "t12_insurance": property_data.t12_financials.insurance_amount,
            "t12_replacement_reserves": property_data.t12_financials.replacement_reserves,
            "t12_net_cash_flow": property_data.t12_financials.net_cash_flow,
            "t12_expense_ratio_pct": property_data.t12_financials.expense_ratio_pct,
        }

    # Extract granular T3 fields
    t3_granular = {}
    if property_data.t3_financials:
        t3_json = json.dumps(property_data.t3_financials.model_dump())
        t3_noi = property_data.t3_financials.noi
        t3_granular = {
            "t3_loss_to_lease": property_data.t3_financials.loss_to_lease,
            "t3_vacancy_rate_pct": property_data.t3_financials.vacancy_rate_pct,
            "t3_concessions": property_data.t3_financials.concessions,
            "t3_credit_loss": property_data.t3_financials.credit_loss,
            "t3_net_rental_income": property_data.t3_financials.net_rental_income,
            "t3_utility_reimbursements": property_data.t3_financials.utility_reimbursements,
            "t3_parking_storage_income": property_data.t3_financials.parking_storage_income,
            "t3_other_income": property_data.t3_financials.other_income,
            "t3_management_fee_pct": property_data.t3_financials.management_fee_pct,
            "t3_real_estate_taxes": property_data.t3_financials.real_estate_taxes,
            "t3_insurance": property_data.t3_financials.insurance_amount,
            "t3_replacement_reserves": property_data.t3_financials.replacement_reserves,
            "t3_net_cash_flow": property_data.t3_financials.net_cash_flow,
            "t3_expense_ratio_pct": property_data.t3_financials.expense_ratio_pct,
        }

    # Extract granular Y1 fields
    y1_granular = {}
    if property_data.y1_financials:
        y1_json = json.dumps(property_data.y1_financials.model_dump())
        y1_noi = property_data.y1_financials.noi
        y1_granular = {
            "y1_loss_to_lease": property_data.y1_financials.loss_to_lease,
            "y1_vacancy_rate_pct": property_data.y1_financials.vacancy_rate_pct,
            "y1_concessions": property_data.y1_financials.concessions,
            "y1_credit_loss": property_data.y1_financials.credit_loss,
            "y1_net_rental_income": property_data.y1_financials.net_rental_income,
            "y1_utility_reimbursements": property_data.y1_financials.utility_reimbursements,
            "y1_parking_storage_income": property_data.y1_financials.parking_storage_income,
            "y1_other_income": property_data.y1_financials.other_income,
            "y1_management_fee_pct": property_data.y1_financials.management_fee_pct,
            "y1_real_estate_taxes": property_data.y1_financials.real_estate_taxes,
            "y1_insurance": property_data.y1_financials.insurance_amount,
            "y1_replacement_reserves": property_data.y1_financials.replacement_reserves,
            "y1_net_cash_flow": property_data.y1_financials.net_cash_flow,
            "y1_expense_ratio_pct": property_data.y1_financials.expense_ratio_pct,
        }

    # Create property
    property_obj = Property(
        user_id=user_id,
        deal_folder_id=property_data.deal_folder_id,  # Phase 3A
        document_subtype=property_data.document_subtype,  # Phase 3A
        deal_name=property_data.deal_name,
        uploaded_filename=property_data.uploaded_filename,
        document_type=property_data.document_type,
        property_address=property_data.property_address,
        property_type=property_data.property_type,
        submarket=property_data.submarket,
        metro=property_data.metro,
        year_built=property_data.year_built,
        total_units=property_data.total_units,
        total_residential_sf=property_data.total_residential_sf,
        average_market_rent=property_data.average_market_rent,
        average_inplace_rent=property_data.average_inplace_rent,
        # Renovation assumptions
        renovation_cost_per_unit=property_data.renovation_cost_per_unit,
        renovation_total_cost=property_data.renovation_total_cost,
        renovation_rent_premium=property_data.renovation_rent_premium,
        renovation_roi_pct=property_data.renovation_roi_pct,
        renovation_duration_years=property_data.renovation_duration_years,
        renovation_stabilized_revenue=property_data.renovation_stabilized_revenue,
        # Financials
        t12_financials_json=t12_json,
        t3_financials_json=t3_json,
        y1_financials_json=y1_json,
        t12_noi=t12_noi,
        t3_noi=t3_noi,
        y1_noi=y1_noi,
        # Granular financial fields
        **t12_granular,
        **t3_granular,
        **y1_granular,
        # Metadata
        raw_pdf_path=property_data.raw_pdf_path,
        analysis_date=datetime.now(),
        last_analyzed_at=datetime.now(),
        analysis_count=1,
        analysis_model=property_data.analysis_model,
        analysis_status="success",
        search_text=search_text
    )

    # Geocode the address if available
    if property_data.property_address:
        from app.services.geocoding_service import geocode_address
        coords = geocode_address(property_data.property_address)
        if coords:
            property_obj.latitude, property_obj.longitude = coords

    db.add(property_obj)
    db.flush()  # Get ID without committing

    # Phase 3A: Update folder document_count
    folder.document_count += 1

    # Phase 3A: Save BOV pricing tiers if this is a BOV document
    if property_data.bov_pricing_tiers:
        # Convert Pydantic models to dictionaries for service layer
        tiers_data = [tier.model_dump() for tier in property_data.bov_pricing_tiers]
        bov_service.save_bov_pricing_tiers(db, property_obj.id, tiers_data)

    # Save unit mix if provided
    unit_mix_count = len(property_data.unit_mix) if property_data.unit_mix else 0
    rent_comps_count = len(property_data.rent_comps) if property_data.rent_comps else 0
    logger.warning(
        "SAVE_PROPERTY id=%d: unit_mix=%d items, rent_comps=%d items, "
        "renovation_cost_per_unit=%s",
        property_obj.id, unit_mix_count, rent_comps_count,
        property_data.renovation_cost_per_unit,
    )

    if property_data.unit_mix:
        from app.models.property import PropertyUnitMix
        for idx, unit in enumerate(property_data.unit_mix):
            try:
                unit_obj = PropertyUnitMix(
                    property_id=property_obj.id,
                    floorplan_name=unit.floorplan_name,
                    unit_type=unit.unit_type,
                    bedroom_count=unit.bedroom_count,
                    bathroom_count=unit.bathroom_count,
                    num_units=unit.num_units,
                    unit_sf=unit.unit_sf,
                    in_place_rent=unit.in_place_rent,
                    proforma_rent=unit.proforma_rent,
                    proforma_rent_psf=unit.proforma_rent_psf,
                    renovation_premium=unit.renovation_premium
                )
                db.add(unit_obj)
            except Exception as e:
                logger.error("Failed to save unit_mix item %d: %s", idx, e)

    # Save rent comps if provided
    if property_data.rent_comps:
        from app.models.property import PropertyRentComp
        for idx, comp in enumerate(property_data.rent_comps):
            try:
                comp_obj = PropertyRentComp(
                    property_id=property_obj.id,
                    comp_name=comp.comp_name or "Unknown",
                    location=comp.location,
                    num_units=comp.num_units,
                    avg_unit_sf=comp.avg_unit_sf,
                    in_place_rent=comp.in_place_rent,
                    in_place_rent_psf=comp.in_place_rent_psf,
                    bedroom_type=comp.bedroom_type,
                    is_new_construction=comp.is_new_construction
                )
                db.add(comp_obj)
            except Exception as e:
                logger.error("Failed to save rent_comp item %d: %s", idx, e)

    # Save sales comps if provided
    if property_data.sales_comps:
        from app.models.property import PropertySalesComp
        for idx, sc in enumerate(property_data.sales_comps):
            try:
                sc_obj = PropertySalesComp(
                    property_id=property_obj.id,
                    property_name=sc.property_name,
                    location=sc.location,
                    year_built=sc.year_built,
                    units=sc.units,
                    avg_rent=sc.avg_rent,
                    sale_date=sc.sale_date,
                    sale_price=sc.sale_price,
                    price_per_unit=sc.price_per_unit,
                    cap_rate=sc.cap_rate,
                    cap_rate_qualifier=sc.cap_rate_qualifier,
                    buyer=sc.buyer,
                    seller=sc.seller,
                )
                db.add(sc_obj)
            except Exception as e:
                logger.error("Failed to save sales_comp item %d: %s", idx, e)

    # Log the analysis
    log = AnalysisLog(
        property_id=property_obj.id,
        user_id=user_id,
        action="initial_analysis",
        model=property_data.analysis_model,
        status="success"
    )
    db.add(log)

    # Auto-screen against user criteria
    from app.services.screening_service import screen_and_store
    screen_and_store(db, property_obj, user_id)

    db.commit()
    db.refresh(property_obj)

    return property_obj


# ==================== LIST PROPERTIES ====================

def list_properties(
    db: Session,
    user_id: str,
    filters: PropertyFilters
) -> tuple[List[Property], int]:
    """
    List properties with filters and sorting (NO LLM CALLS)

    Returns: (properties, total_count)
    """
    # Validate sort_by (prevent SQL injection)
    ALLOWED_SORT_COLUMNS = ["upload_date", "deal_name", "t3_noi", "y1_noi", "t12_noi"]
    sort_column = filters.sort_by if filters.sort_by in ALLOWED_SORT_COLUMNS else "upload_date"

    # Validate sort_direction
    sort_dir = filters.sort_direction.lower() if filters.sort_direction.lower() in ["asc", "desc"] else "desc"

    # Build query
    query = db.query(Property).filter(Property.user_id == user_id)

    # Apply filters
    if filters.search:
        search_term = f"%{filters.search.lower()}%"
        query = query.filter(Property.search_text.like(search_term))

    if filters.property_type:
        query = query.filter(Property.property_type == filters.property_type)

    if filters.upload_date_start:
        query = query.filter(Property.upload_date >= filters.upload_date_start)

    if filters.upload_date_end:
        query = query.filter(Property.upload_date <= filters.upload_date_end)

    if filters.noi_min is not None:
        query = query.filter(
            or_(
                Property.t3_noi >= filters.noi_min,
                Property.y1_noi >= filters.noi_min,
                Property.t12_noi >= filters.noi_min
            )
        )

    if filters.noi_max is not None:
        query = query.filter(
            or_(
                Property.t3_noi <= filters.noi_max,
                Property.y1_noi <= filters.noi_max,
                Property.t12_noi <= filters.noi_max
            )
        )

    # Get total count
    total = query.count()

    # Apply sorting
    sort_attr = getattr(Property, sort_column)
    if sort_dir == "asc":
        query = query.order_by(sort_attr.asc())
    else:
        query = query.order_by(sort_attr.desc())

    # Limit results
    properties = query.limit(100).all()

    return properties, total


# ==================== GET PROPERTY DETAIL ====================

def get_property(
    db: Session,
    property_id: int,
    user_id: str,
    update_view_date: bool = True
) -> Optional[Property]:
    """
    Get property by ID (NO LLM CALLS)

    Optionally updates last_viewed_date.
    Returns None if not found or wrong user.
    """
    property_obj = db.query(Property).options(
        joinedload(Property.unit_mix),
        joinedload(Property.rent_comps),
    ).filter(
        Property.id == property_id,
        Property.user_id == user_id
    ).first()

    if property_obj and update_view_date:
        property_obj.last_viewed_date = datetime.now()
        db.commit()

    return property_obj


# ==================== DELETE PROPERTY ====================

def delete_property(
    db: Session,
    property_id: int,
    user_id: str
) -> bool:
    """
    Delete property and associated files (NO LLM CALLS)

    Returns True if deleted, False if not found/wrong user
    """
    property_obj = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == user_id
    ).first()

    if not property_obj:
        return False

    # Phase 3A: Decrement folder document_count if property was in a folder
    if property_obj.deal_folder_id:
        folder = db.query(DealFolder).filter(DealFolder.id == property_obj.deal_folder_id).first()
        if folder and folder.document_count > 0:
            folder.document_count -= 1

    # Phase 3A: Delete BOV pricing tiers if this is a BOV document
    if property_obj.document_type == "BOV" or property_obj.document_subtype == "BOV":
        bov_service.delete_bov_pricing_tiers(db, property_id)

    # Delete PDF file if it exists
    if property_obj.raw_pdf_path and os.path.exists(property_obj.raw_pdf_path):
        try:
            os.remove(property_obj.raw_pdf_path)
        except Exception as e:
            print(f"Failed to delete PDF file: {e}")

    # Delete analysis logs
    db.query(AnalysisLog).filter(AnalysisLog.property_id == property_id).delete()

    # Delete property
    db.delete(property_obj)
    db.commit()

    return True


# ==================== CHECK FOR DUPLICATES ====================

def check_duplicate(
    db: Session,
    user_id: str,
    deal_name: str,
    property_address: Optional[str]
) -> Optional[Property]:
    """
    Check if similar property already exists

    Returns existing property if found, None otherwise
    """
    query = db.query(Property).filter(
        Property.user_id == user_id,
        Property.deal_name == deal_name
    )

    if property_address:
        query = query.filter(Property.property_address == property_address)

    return query.first()


# ==================== PARSE FINANCIALS FROM JSON ====================

def parse_financial_period(json_str: Optional[str]) -> Optional[FinancialPeriodData]:
    """
    Parse financial period from JSON string

    Returns FinancialPeriodData or None
    """
    if not json_str:
        return None

    try:
        data = json.loads(json_str)
        return FinancialPeriodData(**data)
    except Exception:
        return None
