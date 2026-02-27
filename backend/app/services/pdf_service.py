"""
PDF processing service for extracting text from PDF documents
"""
import gc
from pathlib import Path
from typing import Dict, Any
import pdfplumber
from fastapi import HTTPException

from app.services.claude_extraction_service import extract_with_claude

async def process_pdf_upload(
    file_path: str,
    filename: str
) -> Dict[str, Any]:
    """
    Process uploaded PDF file by extracting text and sending to Claude for analysis.

    Args:
        file_path: Path to the saved PDF file
        filename: Original filename (often contains deal name)

    Returns:
        Dictionary containing extraction results from Claude API

    Raises:
        HTTPException: If PDF extraction or Claude processing fails
    """
    try:
        # Extract text from PDF
        pdf_text = extract_text_from_pdf(file_path)

        if not pdf_text or len(pdf_text.strip()) < 100:
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from PDF. The file may be scanned or corrupted."
            )

        # Send to Claude for intelligent extraction
        extraction_result = await extract_with_claude(pdf_text, filename)

        return extraction_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {str(e)}"
        )

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file using pdfplumber.

    Stops collecting once 120,000 characters have been accumulated — both
    callers already truncate to 100,000 chars before sending to Claude, so
    processing beyond 120k wastes memory without improving extraction quality.
    Early exit is especially important for image-heavy market-research PDFs
    (CBRE, JLL, W&D) where pdfminer parses every page's content stream even
    though only the first 20-30 pages contribute usable text.

    Explicit gc.collect() after closing the PDF reclaims pdfminer's internal
    parsed-object graph, which contains cyclic references that CPython's
    reference counter cannot free on its own, causing resident-set bloat
    between requests on Render's 512 MB free tier.

    Args:
        file_path: Path to the PDF file

    Returns:
        Concatenated text from pages (up to ~120,000 chars)

    Raises:
        Exception: If PDF cannot be opened or read
    """
    _CHAR_LIMIT = 120_000  # slightly above the 100k Claude truncation point
    try:
        text_parts = []
        total_chars = 0

        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"\n--- Page {page_num} ---\n")
                    text_parts.append(page_text)
                    total_chars += len(page_text)
                    # Stop early — more pages won't survive the 100k truncation
                    if total_chars >= _CHAR_LIMIT:
                        break

        # Force GC: pdfminer leaves cyclic-referenced objects that CPython's
        # reference counter cannot free automatically.
        gc.collect()

        return "".join(text_parts)

    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def get_pdf_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from PDF file.

    Args:
        file_path: Path to the PDF file

    Returns:
        Dictionary containing PDF metadata (page count, etc.)
    """
    try:
        with pdfplumber.open(file_path) as pdf:
            return {
                "page_count": len(pdf.pages),
                "metadata": pdf.metadata or {}
            }
    except Exception:
        return {"page_count": 0, "metadata": {}}
