"""
Data Bank routes — inventory, comps, pipeline queries, and file uploads

Endpoints for managing submarket inventory, querying sales comps, pipeline projects,
and uploading/extracting data from Excel spreadsheets and market research PDFs.
"""
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.data_bank import DataBankDocument, SubmarketInventory, SalesComp, PipelineProject
from app.models.market_sentiment import MarketSentimentSignal
from app.api.deps import get_current_user
from app.schemas.scoring import SubmarketInventoryCreate, SubmarketInventoryResponse
from app.schemas.data_bank import (
    DataBankUploadResponse,
    DataBankDocumentResponse,
    DataBankDocumentListResponse,
)
from app.services.data_bank_extraction_service import process_data_bank_upload
from app.services.market_research_extraction_service import process_market_research_pdf

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Background task helper for PDF extraction
# ---------------------------------------------------------------------------

def _run_pdf_extraction_background(document_id: int, filepath: str, user_id: str) -> None:
    """
    Background task: opens its own DB session and runs PDF extraction.
    Called after the HTTP response has already been sent (202).
    """
    db = SessionLocal()
    try:
        document = db.query(DataBankDocument).filter(DataBankDocument.id == document_id).first()
        if not document:
            logger.error("Background PDF task: document %d not found", document_id)
            return
        process_market_research_pdf(filepath=filepath, user_id=user_id, db=db, document=document)
    except Exception:
        logger.exception("Background PDF extraction crashed for document %d", document_id)
        # process_market_research_pdf already handles its own errors; this catch
        # is belt-and-suspenders in case something fails before even entering it.
        try:
            db.rollback()
            doc = db.query(DataBankDocument).filter(DataBankDocument.id == document_id).first()
            if doc and doc.extraction_status == "processing":
                doc.extraction_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

router = APIRouter(prefix="/data-bank", tags=["Data Bank"])

# Allowed file extensions
ALLOWED_EXTENSIONS = {".xlsx", ".xlsm", ".csv", ".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


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


# ==================== DOCUMENT UPLOAD ====================

@router.post("/upload", response_model=DataBankUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_data_bank_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a file to the Data Bank.

    Supports Excel (.xlsx, .xlsm, .csv) and PDF (.pdf) files:
    - Excel files: extracted synchronously (fast — no Claude API call)
    - PDF files: returns immediately with extraction_status="processing"; extraction
      runs in a background task. Poll GET /data-bank/document/{id}/status until
      extraction_status is "completed" or "failed".
    """
    user_id = str(current_user.id)

    # Validate filename and extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file contents
    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Save file to disk
    upload_dir = Path("uploads/data_bank")
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4()}_{Path(file.filename).name}"
    file_path = upload_dir / unique_filename
    file_path.write_bytes(contents)
    # Free the in-memory bytes buffer immediately — the PDF is now on disk and
    # the background extraction task reads from disk, not from this variable.
    # Keeping it alive until function return wastes 10-50 MB on Render's 512 MB tier.
    del contents

    # Create document record
    document = DataBankDocument(
        user_id=user_id,
        filename=file.filename,
        file_path=str(file_path),
        document_type="unknown",
        extraction_status="processing",
    )
    db.add(document)
    db.flush()  # Get the document ID

    if ext == ".pdf":
        # PDFs are market research in Data Bank context.
        # Extraction is offloaded to a background task so the HTTP response
        # returns immediately — avoids timeouts on large reports.
        document.document_type = "market_research"
        db.commit()
        db.refresh(document)

        background_tasks.add_task(
            _run_pdf_extraction_background,
            document_id=document.id,
            filepath=str(file_path),
            user_id=user_id,
        )

        return DataBankUploadResponse(
            document_id=document.id,
            document_type="market_research",
            extraction_status="processing",
            record_count=0,
            warnings=[],
            filename=file.filename,
            signal_count=None,
        )

    # Excel/CSV: extract synchronously (no Claude API call — fast)
    try:
        doc_type, record_count, warnings = process_data_bank_upload(
            filepath=str(file_path),
            user_id=user_id,
            db=db,
            document=document,
        )
    except Exception as e:
        logger.exception(f"Upload processing failed for {file.filename}")
        document.extraction_status = "failed"
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}",
        )

    return DataBankUploadResponse(
        document_id=document.id,
        document_type=doc_type,
        extraction_status=document.extraction_status,
        record_count=record_count,
        warnings=warnings,
        filename=file.filename,
        signal_count=document.signal_count,
    )


# ==================== DOCUMENT LIST / DETAIL / STATUS / DELETE ====================

@router.get("/documents", response_model=DataBankDocumentListResponse)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all Data Bank documents for the current user."""
    documents = (
        db.query(DataBankDocument)
        .filter(DataBankDocument.user_id == str(current_user.id))
        .order_by(DataBankDocument.created_at.desc())
        .all()
    )
    return DataBankDocumentListResponse(
        documents=documents,
        total=len(documents),
    )


@router.get("/document/{document_id}/status")
def get_document_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight polling endpoint for PDF extraction status.
    Returns just the fields the frontend needs to know if processing is done.
    """
    document = (
        db.query(DataBankDocument)
        .filter(
            DataBankDocument.id == document_id,
            DataBankDocument.user_id == str(current_user.id),
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": document.id,
        "extraction_status": document.extraction_status,
        "document_type": document.document_type,
        "record_count": document.record_count,
        "signal_count": document.signal_count,
        "source_firm": document.source_firm,
    }


@router.get("/document/{document_id}", response_model=DataBankDocumentResponse)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single Data Bank document with full extraction data."""
    document = (
        db.query(DataBankDocument)
        .filter(
            DataBankDocument.id == document_id,
            DataBankDocument.user_id == str(current_user.id),
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a Data Bank document and all associated extracted records
    (SalesComp and PipelineProject rows linked to this document).
    """
    user_id = str(current_user.id)

    document = (
        db.query(DataBankDocument)
        .filter(
            DataBankDocument.id == document_id,
            DataBankDocument.user_id == user_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete associated records
    db.query(SalesComp).filter(SalesComp.document_id == document_id).delete()
    db.query(PipelineProject).filter(PipelineProject.document_id == document_id).delete()
    db.query(MarketSentimentSignal).filter(MarketSentimentSignal.document_id == document_id).delete()

    # Delete the file from disk
    file_path = Path(document.file_path)
    if file_path.exists():
        file_path.unlink()

    # Delete document record
    db.delete(document)
    db.commit()

    return None
