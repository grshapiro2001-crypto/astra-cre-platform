"""
File handling utilities for PDF uploads
"""
import uuid
from pathlib import Path
from typing import BinaryIO
from fastapi import UploadFile, HTTPException

# Maximum file size: 25MB
MAX_FILE_SIZE = 25 * 1024 * 1024

def validate_pdf_file(file: UploadFile) -> None:
    """
    Validate that the uploaded file is a PDF and within size limits.

    Args:
        file: The uploaded file to validate

    Raises:
        HTTPException: If validation fails
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed. Please upload a .pdf file."
        )

def save_uploaded_file(
    contents: bytes,
    filename: str,
    user_id: str,
    upload_dir: str = "backend/uploads"
) -> str:
    """
    Save uploaded file to disk with a unique filename.

    Args:
        contents: File contents as bytes
        filename: Original filename
        user_id: ID of the user uploading the file
        upload_dir: Directory to save files to

    Returns:
        Path to the saved file

    Raises:
        HTTPException: If file size exceeds limit or save fails
    """
    # Check file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is 25MB. Your file is {len(contents) / 1024 / 1024:.2f}MB"
        )

    # Generate unique filename
    unique_id = str(uuid.uuid4())
    # Sanitize original filename to avoid path traversal
    safe_filename = Path(filename).name
    unique_filename = f"{unique_id}_{safe_filename}"

    # Create upload directory if it doesn't exist
    upload_path = Path(upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)

    # Save file
    file_path = upload_path / unique_filename
    try:
        file_path.write_bytes(contents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )

    return str(file_path)

def get_file_size_mb(file_path: str) -> float:
    """
    Get file size in megabytes.

    Args:
        file_path: Path to the file

    Returns:
        File size in MB
    """
    return Path(file_path).stat().st_size / 1024 / 1024
