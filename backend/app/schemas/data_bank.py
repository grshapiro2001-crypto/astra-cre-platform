"""
Schemas for Data Bank document uploads and extraction results
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ==================== UPLOAD ====================

class DataBankUploadResponse(BaseModel):
    """Response after uploading and processing a Data Bank document"""
    document_id: int
    document_type: str
    extraction_status: str
    record_count: int
    warnings: List[str] = []
    filename: str
    signal_count: Optional[int] = None


# ==================== DOCUMENT ====================

class DataBankDocumentResponse(BaseModel):
    """Full document record"""
    id: int
    filename: str
    document_type: str
    extraction_status: str
    extraction_data: Optional[str] = None
    record_count: Optional[int] = None
    created_at: datetime
    # Market research metadata
    source_firm: Optional[str] = None
    publication_date: Optional[str] = None
    geographies_covered: Optional[str] = None
    signal_count: Optional[int] = None

    class Config:
        from_attributes = True


class DataBankDocumentListResponse(BaseModel):
    """List of documents"""
    documents: List[DataBankDocumentResponse]
    total: int
