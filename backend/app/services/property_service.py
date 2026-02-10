"""
Property service - Database operations ONLY (NO LLM CALLS)

CRITICAL: This service is for read/write operations to the database.
It does NOT call the LLM or re-analyze PDFs.
LLM calls are ONLY in claude_extraction_service.py
"""
import json
import os
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.models.property import Property, AnalysisLog
from app.models.deal_folder import DealFolder
from app.schemas.property import PropertyCreate, PropertyFilters, FinancialPeriodData
from app.services import bov_service


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

    # Convert financial periods to JSON
    t12_json = None
    t3_json = None
    y1_json = None
    t12_noi = None
    t3_noi = None
    y1_noi = None

    if property_data.t12_financials:
        t12_json = json.dumps(property_data.t12_financials.model_dump())
        t12_noi = property_data.t12_financials.noi

    if property_data.t3_financials:
        t3_json = json.dumps(property_data.t3_financials.model_dump())
        t3_noi = property_data.t3_financials.noi

    if property_data.y1_financials:
        y1_json = json.dumps(property_data.y1_financials.model_dump())
        y1_noi = property_data.y1_financials.noi

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
        year_built=property_data.year_built,
        total_units=property_data.total_units,
        total_residential_sf=property_data.total_residential_sf,
        average_market_rent=property_data.average_market_rent,
        average_inplace_rent=property_data.average_inplace_rent,
        t12_financials_json=t12_json,
        t3_financials_json=t3_json,
        y1_financials_json=y1_json,
        t12_noi=t12_noi,
        t3_noi=t3_noi,
        y1_noi=y1_noi,
        raw_pdf_path=property_data.raw_pdf_path,
        analysis_date=datetime.now(),
        last_analyzed_at=datetime.now(),
        analysis_count=1,
        analysis_model=property_data.analysis_model,
        analysis_status="success",
        search_text=search_text
    )

    db.add(property_obj)
    db.flush()  # Get ID without committing

    # Phase 3A: Update folder document_count
    folder.document_count += 1

    # Phase 3A: Save BOV pricing tiers if this is a BOV document
    if property_data.bov_pricing_tiers:
        # Convert Pydantic models to dictionaries for service layer
        tiers_data = [tier.model_dump() for tier in property_data.bov_pricing_tiers]
        bov_service.save_bov_pricing_tiers(db, property_obj.id, tiers_data)

    # Log the analysis
    log = AnalysisLog(
        property_id=property_obj.id,
        user_id=user_id,
        action="initial_analysis",
        model=property_data.analysis_model,
        status="success"
    )
    db.add(log)
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
