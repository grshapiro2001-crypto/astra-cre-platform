"""
Property routes - Library feature endpoints

CRITICAL ARCHITECTURE:
- Save, List, Detail, Delete endpoints: NO LLM CALLS (database only)
- Reanalyze endpoint: ONLY endpoint that calls LLM after initial upload
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os
import re
import shutil

from app.database import get_db
from app.models.user import User
from app.models.property import Property, AnalysisLog, PropertyDocument, RentRollUnit, T12Financial
from app.api.deps import get_current_user
from pydantic import BaseModel
from app.schemas.property import (
    PropertyCreate,
    PropertyListItem,
    PropertyDetail,
    PropertyFilters,
    PropertyListResponse,
    FinancialPeriodData,
    ComparisonRequest,
    ComparisonResponse,
    PropertyDocumentResponse,
    RentRollSummaryResponse,
    T12SummaryResponse
)
from app.services import property_service
from app.services import excel_extraction_service

logger = logging.getLogger(__name__)

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

    logger.warning(
        "SAVE_PROPERTY_ROUTE received: unit_mix=%d, rent_comps=%d, "
        "renovation_cost_per_unit=%s",
        len(property_data.unit_mix) if property_data.unit_mix else 0,
        len(property_data.rent_comps) if property_data.rent_comps else 0,
        property_data.renovation_cost_per_unit,
    )

    # Save property
    property_obj = property_service.save_property(
        db,
        str(current_user.id),
        property_data
    )

    # Re-query with eager loading to ensure unit_mix/rent_comps relationships
    # are included in the response.  save_property() adds child objects to the
    # session individually (not via the relationship), so lazy-loading after
    # refresh may return stale/empty results depending on session state.
    property_obj = property_service.get_property(
        db,
        property_obj.id,
        str(current_user.id),
        update_view_date=False,
    )

    # Convert to response format
    return build_property_detail_response(property_obj, db)


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
            screening_verdict=p.screening_verdict,
            screening_score=p.screening_score,
            user_guidance_price=p.user_guidance_price,
            pipeline_stage=p.pipeline_stage,
            pipeline_notes=p.pipeline_notes,
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

    return build_property_detail_response(property_obj, db)


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

    return build_property_detail_response(property_obj, db)


# ==================== UPDATE PROPERTY PIPELINE STAGE (NO LLM) ====================

@router.patch("/{property_id}/stage", response_model=PropertyDetail)
def update_property_stage(
    property_id: int,
    stage: str,  # Query parameter: ?stage=under_review
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update property's pipeline stage for Kanban board (NO LLM CALLS)

    This endpoint:
    - Updates pipeline_stage column
    - Updates pipeline_updated_at timestamp
    - Validates stage is one of the valid values
    - Does NOT call LLM

    Valid stages: screening, under_review, loi, under_contract, closed, passed
    """
    # Validate stage
    valid_stages = ["screening", "under_review", "loi", "under_contract", "closed", "passed"]
    if stage not in valid_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage. Must be one of: {', '.join(valid_stages)}"
        )

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

    # Update stage
    property_obj.pipeline_stage = stage
    property_obj.pipeline_updated_at = datetime.now()

    db.commit()
    db.refresh(property_obj)

    return build_property_detail_response(property_obj, db)


# ==================== UPDATE PROPERTY PIPELINE NOTES (NO LLM) ====================

@router.patch("/{property_id}/notes", response_model=PropertyDetail)
def update_property_notes(
    property_id: int,
    notes: str,  # Query parameter: ?notes=Spoke%20with%20broker
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update property's pipeline notes (NO LLM CALLS)

    This endpoint:
    - Updates pipeline_notes column
    - Updates pipeline_updated_at timestamp
    - Does NOT call LLM
    """
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

    # Update notes
    property_obj.pipeline_notes = notes
    property_obj.pipeline_updated_at = datetime.now()

    db.commit()
    db.refresh(property_obj)

    return build_property_detail_response(property_obj, db)


# ==================== UPDATE GUIDANCE PRICE (NO LLM) ====================

class GuidancePriceUpdate(BaseModel):
    guidance_price: Optional[float] = None


@router.patch("/{property_id}/guidance-price", response_model=PropertyDetail)
def update_guidance_price(
    property_id: int,
    body: GuidancePriceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update property's user-entered guidance price (NO LLM CALLS)

    Body: { "guidance_price": 45000000 }  (or null to clear)
    Validates that guidance_price is a positive number or null.
    """
    # Validate: must be positive or null
    if body.guidance_price is not None and body.guidance_price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="guidance_price must be a positive number or null"
        )

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

    # Update guidance price
    property_obj.user_guidance_price = body.guidance_price

    db.commit()
    db.refresh(property_obj)

    return build_property_detail_response(property_obj, db)


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

        return build_property_detail_response(property_obj, db)

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


# ==================== EXPORT SUMMARY PDF (NO LLM) ====================

@router.get("/{property_id}/summary-pdf")
def export_summary_pdf(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download a professional PDF summary for a property (NO LLM CALLS)

    Returns a 2-page PDF brief with property overview and market context.
    """
    from app.services.pdf_report_service import generate_deal_summary

    # Verify property exists and belongs to user
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

    try:
        pdf_bytes = generate_deal_summary(property_id, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(e)}"
        )

    # Sanitize filename
    safe_name = re.sub(r'[^\w\s\-]', '', property_obj.deal_name or "Property")
    safe_name = safe_name.strip().replace(" ", "_") or "Property"
    filename = f"{safe_name}_Summary.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ==================== HELPER FUNCTIONS ====================

def build_property_detail_response(property_obj: Property, db: Session) -> PropertyDetail:
    """Convert Property model to PropertyDetail response.

    Args:
        property_obj: The Property ORM model
        db: The existing database session (avoids creating orphaned sessions)
    """
    # Import bov_service here to avoid circular imports
    from app.services import bov_service
    from app.schemas.property import UnitMixItem, RentCompItem

    # Get BOV pricing tiers if this is a BOV document
    bov_tiers = None
    if property_obj.document_type == "BOV" or property_obj.document_subtype == "BOV":
        bov_tiers_data = bov_service.get_bov_pricing_tiers(db, property_obj.id)
        if bov_tiers_data:
            # Convert to Pydantic models
            from app.schemas.property import BOVPricingTierData
            bov_tiers = [BOVPricingTierData(**tier) for tier in bov_tiers_data]

    # Build unit_mix and rent_comps from relationships
    # Use try/except per-item so one bad record doesn't kill the whole response
    unit_mix_items = []
    if hasattr(property_obj, 'unit_mix') and property_obj.unit_mix:
        for u in property_obj.unit_mix:
            try:
                unit_mix_items.append(UnitMixItem.model_validate(u))
            except Exception as e:
                logger.error("Failed to validate unit_mix item id=%s: %s", getattr(u, 'id', '?'), e)

    rent_comp_items = []
    if hasattr(property_obj, 'rent_comps') and property_obj.rent_comps:
        for c in property_obj.rent_comps:
            try:
                rent_comp_items.append(RentCompItem.model_validate(c))
            except Exception as e:
                logger.error("Failed to validate rent_comp item id=%s: %s", getattr(c, 'id', '?'), e)

    logger.warning(
        "BUILD_RESPONSE id=%d: unit_mix=%d (raw=%d), rent_comps=%d (raw=%d), "
        "renovation_cost_per_unit=%s",
        property_obj.id, len(unit_mix_items),
        len(property_obj.unit_mix) if hasattr(property_obj, 'unit_mix') and property_obj.unit_mix else 0,
        len(rent_comp_items),
        len(property_obj.rent_comps) if hasattr(property_obj, 'rent_comps') and property_obj.rent_comps else 0,
        property_obj.renovation_cost_per_unit,
    )

    # Build documents list
    document_items = []
    if hasattr(property_obj, 'documents') and property_obj.documents:
        for d in property_obj.documents:
            try:
                document_items.append(PropertyDocumentResponse.model_validate(d))
            except Exception as e:
                logger.error("Failed to validate document item id=%s: %s", getattr(d, 'id', '?'), e)

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
        analysis_status=property_obj.analysis_status,
        screening_verdict=property_obj.screening_verdict,
        screening_score=property_obj.screening_score,
        screening_details_json=property_obj.screening_details_json,
        user_guidance_price=property_obj.user_guidance_price,
        pipeline_stage=property_obj.pipeline_stage,
        pipeline_notes=property_obj.pipeline_notes,
        pipeline_updated_at=property_obj.pipeline_updated_at,
        documents=document_items,  # Phase 1: Excel Integration
        rr_total_units=property_obj.rr_total_units,
        rr_occupied_units=property_obj.rr_occupied_units,
        rr_vacancy_count=property_obj.rr_vacancy_count,
        rr_physical_occupancy_pct=property_obj.rr_physical_occupancy_pct,
        rr_avg_market_rent=property_obj.rr_avg_market_rent,
        rr_avg_in_place_rent=property_obj.rr_avg_in_place_rent,
        rr_avg_sqft=property_obj.rr_avg_sqft,
        rr_loss_to_lease_pct=property_obj.rr_loss_to_lease_pct,
        rr_as_of_date=property_obj.rr_as_of_date,
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


# ==================== UPLOAD DOCUMENT TO PROPERTY (Phase 1: Excel Integration) ====================

@router.post("/{property_id}/upload-document", response_model=PropertyDetail)
async def upload_document_to_property(
    property_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an Excel document (Rent Roll or T-12) to an existing property.

    This endpoint:
    1. Validates file type (Excel: .xlsx, .xlsm, .csv, or PDF: .pdf)
    2. Saves the file to uploads directory
    3. Creates PropertyDocument record
    4. Classifies the document (rent_roll, t12, om, bov, other)
    5. For Excel files: extracts data and updates property record
    6. For PDFs: marks for future processing
    7. Returns updated property with new document

    Phase 1: Rent Rolls and T-12 Operating Statements
    """
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

    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )

    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = [".xlsx", ".xlsm", ".csv", ".pdf"]

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Determine file type
    if file_ext in [".xlsx", ".xlsm", ".csv"]:
        file_type = "xlsx"
    else:
        file_type = "pdf"

    # Create uploads directory for this property if it doesn't exist
    uploads_dir = os.path.join("uploads", str(current_user.id), f"property_{property_id}")
    os.makedirs(uploads_dir, exist_ok=True)

    # Save file
    file_path = os.path.join(uploads_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Create PropertyDocument record
    doc = PropertyDocument(
        property_id=property_id,
        user_id=str(current_user.id),
        filename=file.filename,
        file_path=file_path,
        file_type=file_type,
        document_category="unknown",  # Will be updated below
        extraction_status="processing"
    )
    db.add(doc)
    db.flush()  # Get doc.id

    # Parse date from filename
    document_date = excel_extraction_service.parse_date_from_filename(file.filename)
    if document_date:
        doc.document_date = document_date

    # Process based on file type
    extraction_summary = ""
    try:
        if file_type == "xlsx":
            # Classify Excel document
            doc_category = excel_extraction_service.classify_excel_document(file_path)
            doc.document_category = doc_category

            if doc_category == "rent_roll":
                # Extract rent roll
                extraction = excel_extraction_service.extract_rent_roll(file_path)

                if extraction.get("error"):
                    doc.extraction_status = "failed"
                    doc.extraction_summary = f"Extraction failed: {extraction['error']}"
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Rent roll extraction failed: {extraction['error']}"
                    )

                # Use extracted date if available
                if extraction.get("document_date") and not document_date:
                    try:
                        doc.document_date = datetime.fromisoformat(extraction["document_date"])
                    except (ValueError, TypeError):
                        pass

                # Save unit-level data
                for unit in extraction.get("units", []):
                    rr_unit = RentRollUnit(
                        property_id=property_id,
                        document_id=doc.id,
                        unit_number=unit.get("unit_number"),
                        unit_type=unit.get("unit_type"),
                        sqft=unit.get("sqft"),
                        status=unit.get("status"),
                        is_occupied=unit.get("is_occupied", True),
                        resident_name=unit.get("resident_name"),
                        move_in_date=unit.get("move_in_date"),
                        lease_start=unit.get("lease_start"),
                        lease_end=unit.get("lease_end"),
                        market_rent=unit.get("market_rent"),
                        in_place_rent=unit.get("in_place_rent"),
                        charge_details=unit.get("charge_details")
                    )
                    db.add(rr_unit)

                # Check if this is the most recent rent roll
                summary = extraction.get("summary", {})
                existing_rr_date = property_obj.rr_as_of_date
                is_most_recent = True

                if existing_rr_date and doc.document_date:
                    is_most_recent = doc.document_date >= existing_rr_date

                # Update property summary fields if this is the most recent
                if is_most_recent and summary:
                    property_obj.rr_total_units = summary.get("total_units")
                    property_obj.rr_occupied_units = summary.get("occupied_units")
                    property_obj.rr_vacancy_count = summary.get("vacant_units")
                    property_obj.rr_physical_occupancy_pct = summary.get("physical_occupancy_pct")
                    property_obj.rr_avg_market_rent = summary.get("avg_market_rent")
                    property_obj.rr_avg_in_place_rent = summary.get("avg_in_place_rent")
                    property_obj.rr_avg_sqft = summary.get("avg_sqft")
                    property_obj.rr_loss_to_lease_pct = summary.get("loss_to_lease_pct")
                    property_obj.rr_as_of_date = doc.document_date

                    # Also override these existing property fields (Excel > OM)
                    property_obj.total_units = summary.get("total_units")
                    property_obj.average_in_place_rent = summary.get("avg_in_place_rent")
                    property_obj.average_market_rent = summary.get("avg_market_rent")
                    property_obj.financial_data_source = "rent_roll_excel"
                    property_obj.financial_data_updated_at = datetime.utcnow()

                extraction_summary = f"Extracted {len(extraction.get('units', []))} units. " + \
                                    f"Occupancy: {summary.get('physical_occupancy_pct')}%"

            elif doc_category == "t12":
                # Extract T-12
                extraction = excel_extraction_service.extract_t12(file_path)

                if extraction.get("error"):
                    doc.extraction_status = "failed"
                    doc.extraction_summary = f"Extraction failed: {extraction['error']}"
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"T-12 extraction failed: {extraction['error']}"
                    )

                # Save T-12 financial data
                summary = extraction.get("summary", {})
                monthly = extraction.get("monthly", {})
                line_items = extraction.get("line_items", {})

                t12 = T12Financial(
                    property_id=property_id,
                    document_id=doc.id,
                    fiscal_year=extraction.get("fiscal_year"),
                    gross_potential_rent=summary.get("gross_potential_rent"),
                    loss_to_lease=summary.get("loss_to_lease"),
                    concessions=summary.get("concessions"),
                    vacancy_loss=summary.get("vacancy_loss"),
                    bad_debt=summary.get("bad_debt"),
                    net_rental_income=summary.get("net_rental_income"),
                    other_income=summary.get("other_income"),
                    total_revenue=summary.get("total_revenue"),
                    payroll=summary.get("payroll"),
                    utilities=summary.get("utilities"),
                    repairs_maintenance=summary.get("repairs_maintenance"),
                    turnover=summary.get("turnover"),
                    contract_services=summary.get("contract_services"),
                    marketing=summary.get("marketing"),
                    administrative=summary.get("administrative"),
                    management_fee=summary.get("management_fee"),
                    controllable_expenses=summary.get("controllable_expenses"),
                    real_estate_taxes=summary.get("real_estate_taxes"),
                    insurance=summary.get("insurance"),
                    non_controllable_expenses=summary.get("non_controllable_expenses"),
                    total_operating_expenses=summary.get("total_operating_expenses"),
                    net_operating_income=summary.get("net_operating_income"),
                    monthly_noi=monthly.get("noi"),
                    monthly_revenue=monthly.get("revenue"),
                    monthly_expenses=monthly.get("expenses"),
                    line_items=line_items
                )
                db.add(t12)

                # Update property T12 fields
                property_obj.t12_noi = summary.get("net_operating_income")
                property_obj.t12_revenue = summary.get("total_revenue")
                property_obj.t12_total_expenses = summary.get("total_operating_expenses")
                property_obj.t12_expense_ratio_pct = extraction.get("expense_ratio_pct")
                property_obj.t12_gsr = summary.get("gross_potential_rent")
                property_obj.t12_loss_to_lease = summary.get("loss_to_lease")
                property_obj.t12_concessions = summary.get("concessions")
                property_obj.t12_vacancy_rate_pct = (abs(summary.get("vacancy_loss", 0)) / summary.get("gross_potential_rent", 1) * 100) if summary.get("gross_potential_rent") else None
                property_obj.t12_credit_loss = summary.get("bad_debt")
                property_obj.t12_net_rental_income = summary.get("net_rental_income")
                property_obj.t12_real_estate_taxes = summary.get("real_estate_taxes")
                property_obj.t12_insurance = summary.get("insurance")
                property_obj.t12_management_fee_pct = (summary.get("management_fee", 0) / summary.get("total_revenue", 1) * 100) if summary.get("total_revenue") else None

                property_obj.financial_data_source = "t12_excel"
                property_obj.financial_data_updated_at = datetime.utcnow()

                extraction_summary = f"T-12 FY{extraction.get('fiscal_year')}. NOI: ${summary.get('net_operating_income', 0):,.0f}"

            else:
                # Unknown Excel document type
                doc.extraction_status = "completed"
                doc.extraction_summary = "Document uploaded but type could not be determined"
                extraction_summary = "Unknown document type"

        else:
            # PDF file
            doc.document_category = "other"
            doc.extraction_status = "completed"
            doc.extraction_summary = "PDF uploaded — extraction not yet implemented"
            extraction_summary = "PDF uploaded"

        # Mark document as completed
        doc.extraction_status = "completed"
        doc.extraction_summary = extraction_summary
        doc.analyzed_at = datetime.utcnow()

        db.commit()
        db.refresh(property_obj)

        # Return updated property detail
        return build_property_detail_response(property_obj, db)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing document upload: {e}")
        doc.extraction_status = "failed"
        doc.extraction_summary = f"Error: {str(e)}"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {str(e)}"
        )


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
