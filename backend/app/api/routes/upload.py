"""
PDF upload and extraction endpoints
"""
import json
import logging
import os
import shutil
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pydantic import ValidationError

from app.database import get_db
from app.models.user import User
from app.models.property import Property, PropertyDocument, RentRollUnit, T12Financial
from app.models.t12_line_items import T12LineItem
from app.models.deal_folder import DealFolder
from app.api.deps import get_current_user
from app.api.routes.organizations import _get_user_org_id
from app.utils.file_handler import validate_pdf_file, save_uploaded_file
from app.services.pdf_service import process_pdf_upload
from app.services import excel_extraction_service
from app.services.extraction import rent_roll_normalizer
from app.schemas.rent_roll import (
    FutureLeaseRecord,
    IngestionSummary,
    RejectedRow,
    RentRollUnitCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/upload", tags=["Upload"])

@router.post("", status_code=status.HTTP_200_OK)
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload and analyze a PDF document (OM or BOV).

    This endpoint:
    1. Validates the file is a PDF and within size limits (25MB)
    2. Saves the file to disk
    3. Extracts text using pdfplumber
    4. Sends text to Claude API for intelligent extraction
    5. Returns structured property and financial data

    Returns:
        - success: Boolean indicating success
        - filename: Original filename
        - extraction_result: Structured data extracted by Claude
    """
    # Validate file type
    validate_pdf_file(file)

    # Read file contents
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read uploaded file: {str(e)}"
        )

    # Save file to disk
    try:
        file_path = save_uploaded_file(
            contents=contents,
            filename=file.filename or "unknown.pdf",
            user_id=str(current_user.id)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )

    # Process PDF and extract data with Claude
    try:
        extraction_result = await process_pdf_upload(
            file_path=file_path,
            filename=file.filename or "unknown.pdf"
        )

        return {
            "success": True,
            "filename": file.filename,
            "file_path": file_path,
            "extraction_result": extraction_result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document analysis failed: {str(e)}"
        )

@router.get("/health", status_code=status.HTTP_200_OK)
async def upload_health_check():
    """Health check endpoint for upload service"""
    return {"status": "healthy", "service": "upload"}


# ==================== EXCEL ANALYSIS UPLOAD ====================

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".csv"}

@router.post("/excel-analysis", status_code=status.HTTP_200_OK)
async def upload_excel_analysis(
    files: List[UploadFile] = File(...),
    property_name: str = Form(...),
    property_address: str = Form(...),
    total_units: Optional[int] = Form(None),
    submarket: Optional[str] = Form(None),
    metro: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Create a new property analysis from Excel files (T12 and/or Rent Roll).

    Accepts 1-2 Excel files, auto-classifies each as T12 or Rent Roll,
    extracts data using existing extraction pipeline, creates a new Property
    record + DealFolder, and returns the property ID for navigation.
    """
    # --- Validate files ---
    if len(files) < 1 or len(files) > 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload 1 or 2 Excel files (T12 and/or Rent Roll).",
        )

    for f in files:
        if not f.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXCEL_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXCEL_EXTENSIONS)}",
            )

    # --- Get org_id ---
    org_id = _get_user_org_id(db, str(current_user.id))

    # --- Create deal folder ---
    base_name = property_name
    folder_name = base_name
    counter = 2
    while True:
        existing = db.query(DealFolder).filter(
            DealFolder.user_id == current_user.id,
            DealFolder.folder_name == folder_name,
        ).first()
        if not existing:
            break
        folder_name = f"{base_name} ({counter})"
        counter += 1
        if counter > 100:
            raise HTTPException(status_code=400, detail=f"Too many folders with name '{base_name}'")

    folder = DealFolder(
        user_id=current_user.id,
        organization_id=org_id,
        folder_name=folder_name,
        property_address=property_address,
        submarket=submarket,
        total_units=total_units,
        status="active",
        document_count=0,
    )
    db.add(folder)
    db.flush()

    # --- Create property record ---
    property_obj = Property(
        user_id=str(current_user.id),
        deal_folder_id=folder.id,
        organization_id=org_id,
        deal_name=property_name,
        property_address=property_address,
        uploaded_filename=files[0].filename,
        document_type="EXCEL",
        property_type="Multifamily",
        submarket=submarket,
        metro=metro or "Atlanta",
        total_units=total_units,
        analysis_status="success",
        pipeline_stage="screening",
    )
    db.add(property_obj)
    db.flush()

    # --- Save files to disk and process ---
    uploads_dir = os.path.join("uploads", str(current_user.id), f"property_{property_obj.id}")
    os.makedirs(uploads_dir, exist_ok=True)

    documents_processed = []
    extracted_summary: Dict[str, Any] = {}
    ingestion_summaries: List[Dict[str, Any]] = []

    try:
        for upload_file in files:
            filename = upload_file.filename or "unknown.xlsx"
            file_ext = os.path.splitext(filename)[1].lower()
            file_path = os.path.join(uploads_dir, filename)

            # Save to disk
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(upload_file.file, buffer)

            file_type = "xlsx" if file_ext in {".xlsx", ".xlsm", ".csv"} else file_ext.lstrip(".")

            # Create PropertyDocument
            doc = PropertyDocument(
                property_id=property_obj.id,
                user_id=str(current_user.id),
                filename=filename,
                file_path=file_path,
                file_type=file_type,
                document_category="unknown",
                extraction_status="processing",
            )
            db.add(doc)
            db.flush()

            # Parse date from filename
            document_date = excel_extraction_service.parse_date_from_filename(filename)
            if document_date:
                doc.document_date = document_date

            # Classify
            doc_category = excel_extraction_service.classify_excel_document(file_path)
            doc.document_category = doc_category

            extraction_summary_text = ""

            if doc_category == "rent_roll":
                extraction_summary_text, rr_summary = _process_rent_roll(
                    db, property_obj, doc, file_path, document_date, extracted_summary
                )
                if rr_summary is not None:
                    ingestion_summaries.append({
                        "filename": filename,
                        "document_id": doc.id,
                        **rr_summary.model_dump(),
                    })
            elif doc_category == "t12":
                extraction_summary_text = _process_t12(
                    db, property_obj, doc, file_path, extracted_summary
                )
            else:
                extraction_summary_text = "Document type could not be determined"

            doc.extraction_status = "completed"
            doc.extraction_summary = extraction_summary_text
            doc.analyzed_at = datetime.utcnow()

            documents_processed.append({
                "filename": filename,
                "doc_category": doc_category,
                "extraction_status": "completed",
            })

        # Update folder document count
        folder.document_count = len(documents_processed)

        # If rent roll provided total_units, override user-provided value
        if property_obj.rr_total_units:
            property_obj.total_units = property_obj.rr_total_units

        # Build search text
        parts = [
            property_obj.deal_name or "",
            property_obj.property_address or "",
            property_obj.submarket or "",
            property_obj.metro or "",
        ]
        property_obj.search_text = " ".join(p.lower() for p in parts if p)

        db.commit()
        db.refresh(property_obj)

        # Build extracted_summary for response
        extracted_summary["t12_noi"] = float(property_obj.t12_noi) if property_obj.t12_noi else None
        extracted_summary["total_units"] = property_obj.total_units
        extracted_summary["avg_in_place_rent"] = float(property_obj.rr_avg_in_place_rent) if property_obj.rr_avg_in_place_rent else None
        extracted_summary["physical_occupancy"] = float(property_obj.rr_physical_occupancy_pct) if property_obj.rr_physical_occupancy_pct else None

        return {
            "success": True,
            "property_id": property_obj.id,
            "deal_folder_id": folder.id,
            "documents_processed": documents_processed,
            "extracted_summary": extracted_summary,
            "ingestion_summaries": ingestion_summaries,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error processing Excel analysis upload: %s", e)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel analysis failed: {str(e)}",
        )


_RENT_ROLL_CHUNK_SIZE = 100


def _process_rent_roll(
    db: Session,
    property_obj: Property,
    doc: PropertyDocument,
    file_path: str,
    document_date: Optional[datetime],
    extracted_summary: Dict[str, Any],
) -> tuple[str, Optional[IngestionSummary]]:
    """Parse, normalize, validate, and insert a rent roll with per-row resilience.

    Returns a (human-readable summary text, structured IngestionSummary) tuple.
    Only raises HTTPException for fatal errors (extractor failure, missing
    header). A bad individual row never crashes the batch — it's recorded in
    `rejected_rows`.
    """
    extraction = excel_extraction_service.extract_rent_roll(file_path)

    if extraction.get("error"):
        doc.extraction_status = "failed"
        doc.extraction_summary = f"Extraction failed: {extraction['error']}"
        raise HTTPException(
            status_code=500,
            detail=f"Rent roll extraction failed: {extraction['error']}",
        )

    if extraction.get("document_date") and not document_date:
        try:
            doc.document_date = datetime.fromisoformat(extraction["document_date"])
        except (ValueError, TypeError):
            pass

    # Fill in_place_rent from charge_details before normalization so the base
    # rent heuristic runs on the richest data.
    raw_units = extraction.get("units", []) or []
    for unit in raw_units:
        cd = unit.get("charge_details") or {}
        ipr = unit.get("in_place_rent") or 0
        if cd and not ipr:
            base = excel_extraction_service.find_base_rent(cd)
            unit["in_place_rent"] = base if base > 0 else sum(cd.values())

    # Junk filter + per-field coercion (truncation, date parsing, etc.)
    column_mapping = extraction.get("column_mapping") or {}
    norm = rent_roll_normalizer.normalize_units(raw_units, column_mapping)

    future_lease_records = [
        FutureLeaseRecord(
            unit_number=fl.unit_number,
            resident_name=fl.resident_name,
            market_rent=fl.market_rent,
            lease_start=fl.lease_start,
            lease_end=fl.lease_end,
            raw_row=dict(fl.raw_row),
        )
        for fl in norm.future_leases
    ]

    ingestion = IngestionSummary(
        units_rejected=len(norm.skipped_rows),
        rejected_rows=[
            RejectedRow(
                row_index=s.get("row_index"),
                reason=s.get("reason", ""),
                raw={k: v for k, v in (s.get("raw") or {}).items()},
            )
            for s in norm.skipped_rows
        ],
        unmapped_columns=list(norm.unmapped_columns),
        column_mapping=dict(norm.column_mapping),
        warnings=list(norm.warnings),
        header_row_detected_at=norm.header_row_index,
        total_rows_scanned=norm.total_rows_scanned,
        error=norm.error,
        future_leases_detected=len(future_lease_records),
        future_leases=future_lease_records,
        sections_detected=dict(norm.sections_detected),
    )

    # Persist future leases on the document row (JSONB). model_dump(mode="json")
    # serializes datetime fields to ISO strings for clean JSONB storage.
    doc.future_leases = [fl.model_dump(mode="json") for fl in future_lease_records]

    # Pydantic-validate each row against the final DB schema constraints.
    clean_rows: list[dict[str, Any]] = []
    for i, raw in enumerate(norm.units):
        payload = {
            "property_id": property_obj.id,
            "document_id": doc.id,
            **raw,
        }
        try:
            validated = RentRollUnitCreate(**payload).model_dump()
            clean_rows.append(validated)
        except ValidationError as exc:
            ingestion.rejected_rows.append(
                RejectedRow(
                    row_index=i,
                    reason=f"pydantic validation: {exc.errors()[0].get('msg', str(exc))}",
                    raw=raw,
                )
            )
            ingestion.units_rejected += 1

    inserted = 0
    occupied = 0
    vacant = 0
    sqft_sum = 0
    sqft_n = 0
    market_sum = 0.0
    market_n = 0
    in_place_sum = 0.0
    in_place_n = 0

    def _update_aggregates(row: dict[str, Any]) -> None:
        nonlocal inserted, occupied, vacant, sqft_sum, sqft_n
        nonlocal market_sum, market_n, in_place_sum, in_place_n
        inserted += 1
        is_occ = row.get("is_occupied")
        if is_occ is True:
            occupied += 1
        elif is_occ is False:
            vacant += 1
        if row.get("sqft"):
            sqft_sum += row["sqft"]
            sqft_n += 1
        if row.get("market_rent"):
            market_sum += row["market_rent"]
            market_n += 1
        if row.get("in_place_rent"):
            in_place_sum += row["in_place_rent"]
            in_place_n += 1

    # Chunked insert with savepoint fallback — a bad row isolates to itself.
    for start in range(0, len(clean_rows), _RENT_ROLL_CHUNK_SIZE):
        chunk = clean_rows[start:start + _RENT_ROLL_CHUNK_SIZE]
        savepoint = db.begin_nested()
        try:
            db.bulk_insert_mappings(RentRollUnit, chunk)
            savepoint.commit()
            for row in chunk:
                _update_aggregates(row)
        except Exception as chunk_err:
            savepoint.rollback()
            logger.warning(
                "Rent roll chunk %d-%d bulk insert failed (%s); falling back to per-row",
                start, start + len(chunk), chunk_err,
            )
            for row in chunk:
                sp = db.begin_nested()
                try:
                    db.add(RentRollUnit(**row))
                    sp.commit()
                    _update_aggregates(row)
                except Exception as row_err:
                    sp.rollback()
                    ingestion.rejected_rows.append(
                        RejectedRow(
                            row_index=None,
                            reason=f"db insert failed: {row_err}",
                            raw=row,
                        )
                    )
                    ingestion.units_rejected += 1

    ingestion.units_ingested = inserted

    # Prefer the RealPage "Summary Groups" block as the authoritative
    # source for totals / occupied / vacant / occupancy% and for
    # market-rent & sqft averages whenever it's present — the numbers
    # match what the PMS UI reports and survive cases where per-row
    # parsing is unreliable. In-place rent is not carried in the block
    # so it always comes from row-level data. Row-level disagreement
    # still logs a warning so we can spot drift.
    rp_summary = extraction.get("realpage_summary") or {}
    rp_total = rp_summary.get("total_units")
    rp_occupied = rp_summary.get("occupied_units")
    rp_vacant = rp_summary.get("vacant_units")
    rp_occupancy_pct = rp_summary.get("physical_occupancy_pct")
    rp_total_market = rp_summary.get("total_market_rent")
    rp_total_sqft = rp_summary.get("total_sqft")

    def _disagrees(row_val: float, pms_val: Optional[float], tol_pct: float = 1.0) -> bool:
        if pms_val is None or pms_val == 0:
            return False
        return abs(row_val - pms_val) / pms_val * 100.0 > tol_pct

    use_pms_aggregates = bool(rp_total and rp_total > 0)
    if use_pms_aggregates and (
        _disagrees(inserted, rp_total)
        or _disagrees(occupied, rp_occupied)
        or _disagrees(vacant, rp_vacant)
    ):
        logger.warning(
            "Rent roll aggregate mismatch: row-level (inserted=%s, occupied=%s, vacant=%s) "
            "vs PMS Summary Groups (total=%s, occupied=%s, vacant=%s). Using PMS values.",
            inserted, occupied, vacant, rp_total, rp_occupied, rp_vacant,
        )
        ingestion.warnings.append(
            f"Row-level aggregates (inserted={inserted}, occupied={occupied}, vacant={vacant}) "
            f"diverged from RealPage Summary Groups (total={rp_total}, occupied={rp_occupied}, "
            f"vacant={rp_vacant}) by >1%. Using PMS values for property aggregates."
        )

    property_obj.rr_total_units = rp_total if use_pms_aggregates else inserted
    property_obj.rr_occupied_units = rp_occupied if use_pms_aggregates else occupied
    property_obj.rr_vacancy_count = rp_vacant if use_pms_aggregates else vacant

    if use_pms_aggregates and rp_occupancy_pct is not None:
        property_obj.rr_physical_occupancy_pct = round(float(rp_occupancy_pct), 2)
    elif use_pms_aggregates and rp_total:
        property_obj.rr_physical_occupancy_pct = round(
            100.0 * (rp_occupied or 0) / rp_total, 2
        )
    elif inserted:
        property_obj.rr_physical_occupancy_pct = round(
            100.0 * occupied / inserted, 2
        ) if (occupied + vacant) else None

    if use_pms_aggregates and rp_total_market and rp_total:
        property_obj.rr_avg_market_rent = round(rp_total_market / rp_total, 2)
    else:
        property_obj.rr_avg_market_rent = (
            round(market_sum / market_n, 2) if market_n else None
        )
    # in-place rent is not in the Summary Groups block; always row-level.
    property_obj.rr_avg_in_place_rent = (
        round(in_place_sum / in_place_n, 2) if in_place_n else None
    )
    if use_pms_aggregates and rp_total_sqft and rp_total:
        property_obj.rr_avg_sqft = round(rp_total_sqft / rp_total, 1)
    else:
        property_obj.rr_avg_sqft = (
            round(sqft_sum / sqft_n, 1) if sqft_n else None
        )
    if property_obj.rr_avg_market_rent and property_obj.rr_avg_in_place_rent:
        mkt = property_obj.rr_avg_market_rent
        ipr = property_obj.rr_avg_in_place_rent
        if mkt > 0:
            property_obj.rr_loss_to_lease_pct = round(
                100.0 * (mkt - ipr) / mkt, 2
            )
    property_obj.rr_as_of_date = doc.document_date

    property_obj.total_units = (
        property_obj.rr_total_units or inserted or property_obj.total_units
    )
    property_obj.average_inplace_rent = property_obj.rr_avg_in_place_rent
    property_obj.average_market_rent = property_obj.rr_avg_market_rent
    property_obj.financial_data_source = "rent_roll_excel"
    property_obj.financial_data_updated_at = datetime.utcnow()

    pct = property_obj.rr_physical_occupancy_pct
    text = (
        f"Ingested {inserted} units ({ingestion.units_rejected} rejected). "
        f"Occupancy: {pct}%" if pct is not None
        else f"Ingested {inserted} units ({ingestion.units_rejected} rejected)."
    )
    return text, ingestion


def _process_t12(
    db: Session,
    property_obj: Property,
    doc: PropertyDocument,
    file_path: str,
    extracted_summary: Dict[str, Any],
) -> str:
    """Process a T12 file and update property record. Returns extraction summary text."""
    extraction = excel_extraction_service.extract_t12(file_path)

    if extraction.get("error"):
        doc.extraction_status = "failed"
        doc.extraction_summary = f"Extraction failed: {extraction['error']}"
        raise HTTPException(
            status_code=500,
            detail=f"T-12 extraction failed: {extraction['error']}",
        )

    summary = extraction.get("summary", {})
    monthly = extraction.get("monthly", {})
    line_items = extraction.get("line_items", {})

    # Create T12Financial record
    t12 = T12Financial(
        property_id=property_obj.id,
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
        line_items=line_items,
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
    property_obj.t12_vacancy_rate_pct = (
        abs(summary.get("vacancy_loss", 0)) / summary.get("gross_potential_rent", 1) * 100
    ) if summary.get("gross_potential_rent") else None
    property_obj.t12_credit_loss = summary.get("bad_debt")
    property_obj.t12_net_rental_income = summary.get("net_rental_income")
    property_obj.t12_real_estate_taxes = summary.get("real_estate_taxes")
    property_obj.t12_insurance = summary.get("insurance")
    property_obj.t12_management_fee_pct = (
        summary.get("management_fee", 0) / summary.get("total_revenue", 1) * 100
    ) if summary.get("total_revenue") else None

    # Set financial_data_source (may be overridden if rent roll is also uploaded,
    # but t12_excel takes precedence — see main handler)
    property_obj.financial_data_source = "t12_excel"
    property_obj.financial_data_updated_at = datetime.utcnow()

    # Build t12_financials_json
    t12_fin = {
        "period_label": ("T-12 FY" + str(extraction["fiscal_year"])) if extraction.get("fiscal_year") is not None else "T-12",
        "gsr": summary.get("gross_potential_rent"),
        "vacancy": abs(summary.get("vacancy_loss", 0)) if summary.get("vacancy_loss") else None,
        "concessions": summary.get("concessions"),
        "bad_debt": summary.get("bad_debt"),
        "non_revenue_units": summary.get("non_revenue_units"),
        "total_opex": summary.get("total_operating_expenses"),
        "noi": summary.get("net_operating_income"),
        "opex_ratio": extraction.get("expense_ratio_pct"),
        "loss_to_lease": summary.get("loss_to_lease"),
        "vacancy_rate_pct": property_obj.t12_vacancy_rate_pct,
        "credit_loss": summary.get("bad_debt"),
        "net_rental_income": summary.get("net_rental_income"),
        "real_estate_taxes": summary.get("real_estate_taxes"),
        "insurance_amount": summary.get("insurance"),
        "management_fee_pct": property_obj.t12_management_fee_pct,
        "utilities": summary.get("utilities"),
        "repairs_maintenance": summary.get("repairs_maintenance"),
        "turnover": summary.get("turnover"),
        "contract_services": summary.get("contract_services"),
        "marketing": summary.get("marketing"),
        "administrative": summary.get("administrative"),
        "payroll": summary.get("payroll"),
        "management_fee_amount": summary.get("management_fee"),
    }
    property_obj.t12_financials_json = json.dumps(t12_fin)
    logger.info("T12 financials JSON built: noi=%s, gsr=%s, total_opex=%s",
                t12_fin.get("noi"), t12_fin.get("gsr"), t12_fin.get("total_opex"))

    # Calculate T3 from monthly data (last 3 months annualized)
    t3_calculated = False
    if monthly.get("noi") and monthly.get("revenue") and monthly.get("expenses"):
        month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        noi_monthly = monthly["noi"]
        rev_monthly = monthly["revenue"]

        # Get last 3 months that have data
        last_3 = []
        for m in reversed(month_order):
            if m in noi_monthly and noi_monthly[m] is not None:
                last_3.append(m)
                if len(last_3) == 3:
                    break

        if len(last_3) == 3:
            t3_rev_sum = sum(rev_monthly.get(m, 0) or 0 for m in last_3)
            t12_total_exp = summary.get("total_operating_expenses", 0) or 0

            # T3 NOI = T3 Revenue (annualized) - T12 Expenses
            t3_rev_annual = t3_rev_sum * 4
            t3_noi_annual = t3_rev_annual - t12_total_exp

            property_obj.t3_noi = t3_noi_annual

            t3_gsr = (property_obj.t12_gsr / 12 * 3 * 4) if property_obj.t12_gsr else t3_rev_annual
            t3_opex_ratio = (t12_total_exp / t3_rev_annual * 100) if t3_rev_annual > 0 else None

            # Extract T3 granular line items from T-12 line_items
            t3_line_items = {}
            if line_items:
                li = line_items if isinstance(line_items, dict) else (json.loads(line_items) if isinstance(line_items, str) else {})

                def t3_annualize(item_name):
                    for name, vals in li.items():
                        if isinstance(vals, dict) and name.lower() == item_name.lower():
                            s = sum((vals.get(m, 0) or 0) for m in last_3)
                            return s * 4
                    for name, vals in li.items():
                        if isinstance(vals, dict) and item_name.lower() in name.lower():
                            skip = ["excl ", "excluding", "net potential", "after "]
                            if any(sw in name.lower() for sw in skip):
                                continue
                            s = sum((vals.get(m, 0) or 0) for m in last_3)
                            return s * 4
                    return None

                t3_line_items["gsr"] = t3_annualize("Gross Potential Rent") or t3_annualize("Residential Income")
                t3_line_items["loss_to_lease"] = t3_annualize("Gain Loss to Lease") or t3_annualize("Gain / Loss To Lease")
                t3_line_items["vacancy"] = t3_annualize("Vacancy Loss")
                t3_line_items["concessions"] = t3_annualize("Concessions")
                t3_line_items["non_revenue_units"] = t3_annualize("Non Revenue Units")
                t3_line_items["bad_debt"] = t3_annualize("Bad debt")
                t3_line_items["net_rental_income"] = t3_annualize("Net Rental Income")
                t3_line_items["real_estate_taxes"] = t3_annualize("Real Estate Taxes")
                t3_line_items["insurance"] = t3_annualize("Insurance")
                t3_line_items["management_fee"] = t3_annualize("Management Fee")

            t3_gsr_actual = t3_line_items.get("gsr") or t3_gsr
            t3_fin = {
                "period_label": "Trailing 3 Month (Annualized) - " + ", ".join(reversed(last_3)),
                "gsr": t3_gsr_actual,
                "vacancy": t3_line_items.get("vacancy"),
                "concessions": t3_line_items.get("concessions"),
                "bad_debt": t3_line_items.get("bad_debt"),
                "non_revenue_units": t3_line_items.get("non_revenue_units"),
                "total_opex": t12_total_exp,
                "noi": t3_noi_annual,
                "opex_ratio": t3_opex_ratio,
                "loss_to_lease": t3_line_items.get("loss_to_lease"),
                "vacancy_rate_pct": property_obj.t12_vacancy_rate_pct,
                "credit_loss": t3_line_items.get("bad_debt"),
                "net_rental_income": t3_line_items.get("net_rental_income") or t3_rev_annual,
                "real_estate_taxes": t3_line_items.get("real_estate_taxes"),
                "insurance_amount": t3_line_items.get("insurance"),
                "management_fee_pct": None,
            }
            property_obj.t3_financials_json = json.dumps(t3_fin)
            property_obj.t3_expense_ratio_pct = t3_opex_ratio
            t3_calculated = True

    fy_label = ("T-12 FY" + str(extraction["fiscal_year"])) if extraction.get("fiscal_year") is not None else "T-12"
    noi_val = summary.get("net_operating_income", 0) or 0

    # Save detailed T12 line items for the T12 Mapper
    try:
        detailed = excel_extraction_service.extract_t12_detailed(file_path)
        detailed_items = detailed.get("detailed_items", [])
        if detailed_items:
            for item_data in detailed_items:
                mv = item_data.get("monthly_values")
                line_item = T12LineItem(
                    property_id=property_obj.id,
                    raw_label=item_data["raw_label"],
                    gl_code=item_data.get("gl_code"),
                    section=item_data["section"],
                    subsection=item_data.get("subsection"),
                    row_index=item_data["row_index"],
                    is_subtotal=item_data.get("is_subtotal", False),
                    is_section_header=item_data.get("is_section_header", False),
                    monthly_values=json.dumps(mv) if mv else None,
                    annual_total=item_data.get("annual_total"),
                    t1_value=item_data.get("t1_value"),
                    t2_value=item_data.get("t2_value"),
                    t3_value=item_data.get("t3_value"),
                    mapped_category=item_data.get("mapped_category"),
                    auto_confidence=item_data.get("auto_confidence"),
                    user_confirmed=False,
                )
                db.add(line_item)
            logger.info("Saved %d T12 line items for property %s", len(detailed_items), property_obj.id)
    except Exception as e:
        logger.warning("Failed to save T12 line items: %s", e)

    if t3_calculated:
        return f"{fy_label}. NOI: ${noi_val:,.0f}. T3 NOI: ${t3_noi_annual:,.0f}"
    return f"{fy_label}. NOI: ${noi_val:,.0f}"
