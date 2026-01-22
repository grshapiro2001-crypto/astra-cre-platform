"""
PDF upload and extraction endpoints
"""
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, status
from typing import Dict, Any
from app.models.user import User
from app.api.deps import get_current_user
from app.utils.file_handler import validate_pdf_file, save_uploaded_file
from app.services.pdf_service import process_pdf_upload

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
