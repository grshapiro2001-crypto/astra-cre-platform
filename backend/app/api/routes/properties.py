"""
Property routes - Library feature endpoints

CRITICAL ARCHITECTURE:
- Save, List, Detail, Delete endpoints: NO LLM CALLS (database only)
- Reanalyze endpoint: ONLY endpoint that calls LLM after initial upload
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import os

from app.database import get_db
from app.models.user import User
from app.models.property import Property, AnalysisLog
from app.api.deps import get_current_user
from app.schemas.property import (
    PropertyCreate,
    PropertyListItem,
    PropertyDetail,
    PropertyFilters,
    PropertyListResponse,
    FinancialPeriodData,
    ComparisonRequest,
    ComparisonResponse
)
from app.services import property_service

# LLM service is ONLY imported in reanalyze endpoint
# This prevents accidental LLM calls in read-only operations

router = APIRouter(prefix="/properties", tags=["Properties"])


# ==================== SAVE PROPERTY (NO LLM) ====================

@router.post("", status_code=status.HTTP_201_CREATED, response_model=PropertyDetail)
def save_property_to_library(
    property_data: PropertyCreate,
    force: bool = False,  # Query param: ?force=true to skip duplicate check
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save analyzed property to library (NO LLM CALLS)

    This endpoint:
    - Saves property data from frontend
    - Stores financials as JSON
    - Creates analysis log
    - Does NOT call LLM
    - Does NOT re-read PDF

    Query Parameters:
    - force: If true, skips duplicate check and saves anyway (for "Keep Both" scenario)
    """
    # Check for duplicates (unless force=true)
    if not force:
        existing = property_service.check_duplicate(
            db,
            str(current_user.id),
            property_data.deal_name,
            property_data.property_address
        )

        if existing:
            # Return 409 with details about existing property
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": f"A similar property already exists in library",
                    "existing_property": {
                        "id": existing.id,
                        "deal_name": existing.deal_name,
                        "property_address": existing.property_address,
                        "upload_date": existing.upload_date.isoformat() if existing.upload_date else None,
                        "deal_folder_id": existing.deal_folder_id,
                        "document_type": existing.document_type,
                        "t12_noi": existing.t12_noi,
                        "y1_noi": existing.y1_noi
                    }
                }
            )

    # Save property
    property_obj = property_service.save_property(
        db,
        str(current_user.id),
        property_data
    )

    # Convert to response format
    return build_property_detail_response(property_obj)


# ==================== LIST PROPERTIES (NO LLM) ====================

@router.get("", response_model=PropertyListResponse)
def list_properties(
    search: str = None,
    property_type: str = None,
    sort_by: str = "upload_date",
    sort_direction: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List user's properties with filters and sorting (NO LLM CALLS)

    This endpoint:
    - Returns list of properties from database
    - Supports search, filter, sort
    - Does NOT call LLM
    - Does NOT access PDF files
    """
    filters = PropertyFilters(
        search=search,
        property_type=property_type,
        sort_by=sort_by,
        sort_direction=sort_direction
    )

    properties, total = property_service.list_properties(
        db,
        str(current_user.id),
        filters
    )

    # Convert to response format
    property_list = [
        PropertyListItem(
            id=p.id,
            deal_name=p.deal_name,
            property_type=p.property_type,
            property_address=p.property_address,
            submarket=p.submarket,
            upload_date=p.upload_date,
            t3_noi=p.t3_noi,
            y1_noi=p.y1_noi,
            t12_noi=p.t12_noi,
            document_type=p.document_type,
            total_units=p.total_units,
            deal_folder_id=p.deal_folder_id,
            document_subtype=p.document_subtype,
        )
        for p in properties
    ]

    return PropertyListResponse(
        properties=property_list,
        total=total
    )


# ==================== GET PROPERTY DETAIL (NO LLM) ====================

@router.get("/{property_id}", response_model=PropertyDetail)
def get_property_detail(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get property detail by ID (NO LLM CALLS)

    This endpoint:
    - Returns property data from database
    - Parses JSON financials for display
    - Updates last_viewed_date
    - Does NOT call LLM
    - Does NOT re-read PDF
    """
    property_obj = property_service.get_property(
        db,
        property_id,
        str(current_user.id),
        update_view_date=True
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    return build_property_detail_response(property_obj)


# ==================== UPDATE PROPERTY FOLDER (NO LLM) ====================

@router.patch("/{property_id}/folder", response_model=PropertyDetail)
def update_property_folder(
    property_id: int,
    folder_id: int,  # Query parameter: ?folder_id=123
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update property's folder assignment (NO LLM CALLS)

    This endpoint:
    - Moves property to a different folder
    - Updates document_count for both old and new folders
    - Does NOT call LLM
    - Does NOT re-read PDF

    Use this to:
    - Assign orphaned properties (deal_folder_id = NULL) to folders
    - Move properties between folders
    - Fix folder associations
    """
    from app.models.deal_folder import DealFolder

    # Get property
    property_obj = property_service.get_property(
        db,
        property_id,
        str(current_user.id),
        update_view_date=False
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Verify new folder exists and belongs to user
    new_folder = db.query(DealFolder).filter(
        DealFolder.id == folder_id,
        DealFolder.user_id == str(current_user.id)
    ).first()

    if not new_folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder {folder_id} not found"
        )

    # Update document counts
    old_folder_id = property_obj.deal_folder_id

    if old_folder_id:
        # Decrement old folder count
        old_folder = db.query(DealFolder).filter(DealFolder.id == old_folder_id).first()
        if old_folder and old_folder.document_count > 0:
            old_folder.document_count -= 1

    # Increment new folder count
    new_folder.document_count += 1

    # Update property
    property_obj.deal_folder_id = folder_id

    db.commit()
    db.refresh(property_obj)

    return build_property_detail_response(property_obj)


# ==================== DELETE PROPERTY (NO LLM) ====================

@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete property and associated PDF (NO LLM CALLS)

    This endpoint:
    - Deletes property from database
    - Deletes PDF file
    - Deletes analysis logs
    - Does NOT call LLM
    """
    success = property_service.delete_property(
        db,
        property_id,
        str(current_user.id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    return None


# ==================== RE-ANALYZE PROPERTY (USES LLM) ====================

@router.post("/{property_id}/reanalyze", response_model=PropertyDetail)
async def reanalyze_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Re-analyze property PDF using LLM (EXPLICIT LLM CALL)

    This is the ONLY endpoint (besides initial upload) that calls the LLM.

    This endpoint:
    - Loads PDF from disk
    - Calls Claude API to re-extract data
    - Updates property with new data
    - Increments analysis_count
    - Logs the re-analysis
    """
    # Import LLM service HERE (not at top) to make it explicit
    from app.services.pdf_service import process_pdf_upload
    from app.config import settings

    # Get property
    property_obj = property_service.get_property(
        db,
        property_id,
        str(current_user.id),
        update_view_date=False
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Throttle check (prevent too frequent re-analysis)
    if property_obj.last_analyzed_at:
        time_since_last = datetime.now() - property_obj.last_analyzed_at
        if time_since_last.total_seconds() < 300:  # 5 minutes
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Property was recently analyzed. Please wait a few minutes."
            )

    # Check if PDF exists
    if not property_obj.raw_pdf_path or not os.path.exists(property_obj.raw_pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found. Cannot re-analyze."
        )

    # Call LLM to re-analyze (THIS IS THE ONLY LLM CALL IN LIBRARY FEATURE)
    try:
        extraction_result = await process_pdf_upload(
            file_path=property_obj.raw_pdf_path,
            filename=property_obj.uploaded_filename or "unknown.pdf"
        )

        # Update property with new data
        update_property_from_extraction(property_obj, extraction_result, db=db)
        property_obj.analysis_count += 1
        property_obj.last_analyzed_at = datetime.now()
        property_obj.analysis_status = "success"
        property_obj.analysis_model = settings.ANTHROPIC_API_KEY[:20]  # Truncate for privacy

        # Log the re-analysis
        log = AnalysisLog(
            property_id=property_obj.id,
            user_id=str(current_user.id),
            action="reanalyze",
            model=property_obj.analysis_model,
            status="success"
        )
        db.add(log)
        db.commit()
        db.refresh(property_obj)

        return build_property_detail_response(property_obj)

    except Exception as e:
        # Log failure
        log = AnalysisLog(
            property_id=property_obj.id,
            user_id=str(current_user.id),
            action="reanalyze",
            model=property_obj.analysis_model,
            status="failed",
            error_message=str(e)
        )
        db.add(log)
        property_obj.analysis_status = "failed"
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Re-analysis failed: {str(e)}"
        )


# ==================== HELPER FUNCTIONS ====================

def build_property_detail_response(property_obj: Property) -> PropertyDetail:
    """Convert Property model to PropertyDetail response"""
    # Import bov_service here to avoid circular imports
    from app.services import bov_service
    from app.database import get_db
    from app.schemas.property import UnitMixItem, RentCompItem

    # Get BOV pricing tiers if this is a BOV document
    bov_tiers = None
    if property_obj.document_type == "BOV" or property_obj.document_subtype == "BOV":
        db = next(get_db())
        bov_tiers_data = bov_service.get_bov_pricing_tiers(db, property_obj.id)
        if bov_tiers_data:
            # Convert to Pydantic models
            from app.schemas.property import BOVPricingTierData
            bov_tiers = [BOVPricingTierData(**tier) for tier in bov_tiers_data]

    # Build unit_mix and rent_comps from relationships
    unit_mix_items = []
    if hasattr(property_obj, 'unit_mix') and property_obj.unit_mix:
        unit_mix_items = [UnitMixItem.model_validate(u) for u in property_obj.unit_mix]

    rent_comp_items = []
    if hasattr(property_obj, 'rent_comps') and property_obj.rent_comps:
        rent_comp_items = [RentCompItem.model_validate(c) for c in property_obj.rent_comps]

    return PropertyDetail(
        id=property_obj.id,
        deal_name=property_obj.deal_name,
        uploaded_filename=property_obj.uploaded_filename,
        upload_date=property_obj.upload_date,
        document_type=property_obj.document_type,
        deal_folder_id=property_obj.deal_folder_id,  # Phase 3A
        document_subtype=property_obj.document_subtype,  # Phase 3A
        property_address=property_obj.property_address,
        property_type=property_obj.property_type,
        submarket=property_obj.submarket,
        metro=property_obj.metro,
        year_built=property_obj.year_built,
        total_units=property_obj.total_units,
        total_residential_sf=property_obj.total_residential_sf,
        average_market_rent=property_obj.average_market_rent,
        average_inplace_rent=property_obj.average_inplace_rent,
        renovation_cost_per_unit=float(property_obj.renovation_cost_per_unit) if property_obj.renovation_cost_per_unit else None,
        renovation_total_cost=float(property_obj.renovation_total_cost) if property_obj.renovation_total_cost else None,
        renovation_rent_premium=float(property_obj.renovation_rent_premium) if property_obj.renovation_rent_premium else None,
        renovation_roi_pct=property_obj.renovation_roi_pct,
        renovation_duration_years=property_obj.renovation_duration_years,
        renovation_stabilized_revenue=float(property_obj.renovation_stabilized_revenue) if property_obj.renovation_stabilized_revenue else None,
        t12_financials=property_service.parse_financial_period(property_obj.t12_financials_json),
        t3_financials=property_service.parse_financial_period(property_obj.t3_financials_json),
        y1_financials=property_service.parse_financial_period(property_obj.y1_financials_json),
        bov_pricing_tiers=bov_tiers,  # Phase 3A
        unit_mix=unit_mix_items,
        rent_comps=rent_comp_items,
        analysis_date=property_obj.analysis_date,
        last_viewed_date=property_obj.last_viewed_date,
        analysis_count=property_obj.analysis_count,
        last_analyzed_at=property_obj.last_analyzed_at,
        analysis_model=property_obj.analysis_model,
        analysis_status=property_obj.analysis_status
    )


def update_property_from_extraction(property_obj: Property, extraction_result: dict, db: Session = None):
    """Update property with new extraction data"""
    import json
    from app.models.property import PropertyUnitMix, PropertyRentComp

    # Update property info
    if "property_info" in extraction_result:
        info = extraction_result["property_info"]
        property_obj.property_address = info.get("property_address")
        property_obj.property_type = info.get("property_type")
        property_obj.submarket = info.get("submarket")
        property_obj.metro = info.get("metro")
        property_obj.year_built = info.get("year_built")
        property_obj.total_units = info.get("total_units")
        property_obj.total_residential_sf = info.get("total_sf")

    # Update average rents
    if "average_rents" in extraction_result:
        rents = extraction_result["average_rents"]
        property_obj.average_market_rent = rents.get("market_rent")
        property_obj.average_inplace_rent = rents.get("in_place_rent")

    # Update renovation assumptions
    if "renovation" in extraction_result:
        reno = extraction_result["renovation"]
        property_obj.renovation_cost_per_unit = reno.get("renovation_cost_per_unit")
        property_obj.renovation_total_cost = reno.get("renovation_total_cost")
        property_obj.renovation_rent_premium = reno.get("renovation_rent_premium")
        property_obj.renovation_roi_pct = reno.get("renovation_roi_pct")
        property_obj.renovation_duration_years = reno.get("renovation_duration_years")
        property_obj.renovation_stabilized_revenue = reno.get("renovation_stabilized_revenue")

    # Update financials
    if "financials_by_period" in extraction_result:
        periods = extraction_result["financials_by_period"]

        if periods.get("t12"):
            property_obj.t12_financials_json = json.dumps(periods["t12"])
            property_obj.t12_noi = periods["t12"].get("noi")
            # Granular T12 fields
            property_obj.t12_loss_to_lease = periods["t12"].get("loss_to_lease")
            property_obj.t12_vacancy_rate_pct = periods["t12"].get("vacancy_rate_pct")
            property_obj.t12_concessions = periods["t12"].get("concessions")
            property_obj.t12_credit_loss = periods["t12"].get("credit_loss")
            property_obj.t12_net_rental_income = periods["t12"].get("net_rental_income")
            property_obj.t12_utility_reimbursements = periods["t12"].get("utility_reimbursements")
            property_obj.t12_parking_storage_income = periods["t12"].get("parking_storage_income")
            property_obj.t12_other_income = periods["t12"].get("other_income")
            property_obj.t12_management_fee_pct = periods["t12"].get("management_fee_pct")
            property_obj.t12_real_estate_taxes = periods["t12"].get("real_estate_taxes")
            property_obj.t12_insurance = periods["t12"].get("insurance_amount")
            property_obj.t12_replacement_reserves = periods["t12"].get("replacement_reserves")
            property_obj.t12_net_cash_flow = periods["t12"].get("net_cash_flow")
            property_obj.t12_expense_ratio_pct = periods["t12"].get("expense_ratio_pct")

        if periods.get("t3"):
            property_obj.t3_financials_json = json.dumps(periods["t3"])
            property_obj.t3_noi = periods["t3"].get("noi")
            # Granular T3 fields
            property_obj.t3_loss_to_lease = periods["t3"].get("loss_to_lease")
            property_obj.t3_vacancy_rate_pct = periods["t3"].get("vacancy_rate_pct")
            property_obj.t3_concessions = periods["t3"].get("concessions")
            property_obj.t3_credit_loss = periods["t3"].get("credit_loss")
            property_obj.t3_net_rental_income = periods["t3"].get("net_rental_income")
            property_obj.t3_utility_reimbursements = periods["t3"].get("utility_reimbursements")
            property_obj.t3_parking_storage_income = periods["t3"].get("parking_storage_income")
            property_obj.t3_other_income = periods["t3"].get("other_income")
            property_obj.t3_management_fee_pct = periods["t3"].get("management_fee_pct")
            property_obj.t3_real_estate_taxes = periods["t3"].get("real_estate_taxes")
            property_obj.t3_insurance = periods["t3"].get("insurance_amount")
            property_obj.t3_replacement_reserves = periods["t3"].get("replacement_reserves")
            property_obj.t3_net_cash_flow = periods["t3"].get("net_cash_flow")
            property_obj.t3_expense_ratio_pct = periods["t3"].get("expense_ratio_pct")

        if periods.get("y1"):
            property_obj.y1_financials_json = json.dumps(periods["y1"])
            property_obj.y1_noi = periods["y1"].get("noi")
            # Granular Y1 fields
            property_obj.y1_loss_to_lease = periods["y1"].get("loss_to_lease")
            property_obj.y1_vacancy_rate_pct = periods["y1"].get("vacancy_rate_pct")
            property_obj.y1_concessions = periods["y1"].get("concessions")
            property_obj.y1_credit_loss = periods["y1"].get("credit_loss")
            property_obj.y1_net_rental_income = periods["y1"].get("net_rental_income")
            property_obj.y1_utility_reimbursements = periods["y1"].get("utility_reimbursements")
            property_obj.y1_parking_storage_income = periods["y1"].get("parking_storage_income")
            property_obj.y1_other_income = periods["y1"].get("other_income")
            property_obj.y1_management_fee_pct = periods["y1"].get("management_fee_pct")
            property_obj.y1_real_estate_taxes = periods["y1"].get("real_estate_taxes")
            property_obj.y1_insurance = periods["y1"].get("insurance_amount")
            property_obj.y1_replacement_reserves = periods["y1"].get("replacement_reserves")
            property_obj.y1_net_cash_flow = periods["y1"].get("net_cash_flow")
            property_obj.y1_expense_ratio_pct = periods["y1"].get("expense_ratio_pct")

    # Update search text
    search_parts = [
        property_obj.deal_name or "",
        property_obj.property_address or "",
        property_obj.property_type or "",
        property_obj.submarket or ""
    ]
    property_obj.search_text = " ".join(search_parts).lower()

    # Update unit mix and rent comps (requires db session)
    if db is not None:
        if extraction_result.get("unit_mix"):
            db.query(PropertyUnitMix).filter(PropertyUnitMix.property_id == property_obj.id).delete()
            for unit in extraction_result["unit_mix"]:
                db.add(PropertyUnitMix(
                    property_id=property_obj.id,
                    floorplan_name=unit.get("floorplan_name"),
                    unit_type=unit.get("unit_type"),
                    bedroom_count=unit.get("bedroom_count"),
                    bathroom_count=unit.get("bathroom_count"),
                    num_units=unit.get("num_units"),
                    unit_sf=unit.get("unit_sf"),
                    in_place_rent=unit.get("in_place_rent"),
                    proforma_rent=unit.get("proforma_rent"),
                    proforma_rent_psf=unit.get("proforma_rent_psf"),
                    renovation_premium=unit.get("renovation_premium"),
                ))

        if extraction_result.get("rent_comps"):
            db.query(PropertyRentComp).filter(PropertyRentComp.property_id == property_obj.id).delete()
            for comp in extraction_result["rent_comps"]:
                db.add(PropertyRentComp(
                    property_id=property_obj.id,
                    comp_name=comp.get("comp_name"),
                    location=comp.get("location"),
                    num_units=comp.get("num_units"),
                    avg_unit_sf=comp.get("avg_unit_sf"),
                    in_place_rent=comp.get("in_place_rent"),
                    in_place_rent_psf=comp.get("in_place_rent_psf"),
                    bedroom_type=comp.get("bedroom_type"),
                    is_new_construction=comp.get("is_new_construction", False),
                ))


# ==================== COMPARISON ENDPOINT (Phase 3B) ====================

@router.post("/compare", response_model=ComparisonResponse)
def compare_properties(
    request: ComparisonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compare multiple properties side-by-side
    NO LLM - Pure database query
    Phase 3B
    
    Request body:
    {
        "property_ids": [1, 2, 3, 4, 5]  // 2-5 properties
    }
    """
    from app.services.comparison_service import get_comparison_data

    try:
        comparison_data = get_comparison_data(
            db,
            request.property_ids,
            str(current_user.id)
        )
        return comparison_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")
