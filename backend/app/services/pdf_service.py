"""
PDF processing service for extracting text from PDF documents
"""
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
    Extract all text content from a PDF file using pdfplumber.

    Args:
        file_path: Path to the PDF file

    Returns:
        Concatenated text from all pages

    Raises:
        Exception: If PDF cannot be opened or read
    """
    try:
        text_content = ""

        with pdfplumber.open(file_path) as pdf:
            # Extract text from each page
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()

                if page_text:
                    text_content += f"\n--- Page {page_num} ---\n"
                    text_content += page_text

        return text_content

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
