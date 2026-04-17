"""Pydantic schemas for rent roll ingestion.

These mirror the `rent_roll_units` DB schema exactly. Lengths match the
widened columns from migration k9f3g1h5i7j8.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class RentRollUnitCreate(BaseModel):
    """Validated payload ready for bulk_insert_mappings into rent_roll_units."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    property_id: int
    document_id: int

    unit_number: Optional[str] = Field(default=None, max_length=50)
    unit_type: Optional[str] = Field(default=None, max_length=50)
    sqft: Optional[int] = None

    status: Optional[str] = Field(default=None, max_length=100)
    is_occupied: Optional[bool] = None
    resident_name: Optional[str] = Field(default=None, max_length=255)

    move_in_date: Optional[datetime] = None
    lease_start: Optional[datetime] = None
    lease_end: Optional[datetime] = None

    market_rent: Optional[float] = None
    in_place_rent: Optional[float] = None
    charge_details: Optional[dict[str, Any]] = None


class RejectedRow(BaseModel):
    row_index: Optional[int] = None
    reason: str
    raw: dict[str, Any] = Field(default_factory=dict)


class IngestionSummary(BaseModel):
    """Structured result surfaced to the API client after rent roll ingest."""

    units_ingested: int = 0
    units_rejected: int = 0
    rejected_rows: list[RejectedRow] = Field(default_factory=list)
    unmapped_columns: list[str] = Field(default_factory=list)
    column_mapping: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    header_row_detected_at: int = -1
    total_rows_scanned: int = 0
    error: Optional[str] = None
