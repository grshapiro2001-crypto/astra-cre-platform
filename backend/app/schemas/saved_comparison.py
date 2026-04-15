"""
Pydantic schemas for Saved Comparisons
BUG-006 fix: Save Comparison feature now writes to database
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, validator


class SavedComparisonCreate(BaseModel):
    """Schema for creating a saved comparison"""
    name: str
    property_ids: List[int]
    subject_property_id: Optional[int] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    preset_key: Optional[str] = None

    @validator("property_ids")
    def validate_property_ids(cls, v):
        if len(v) < 2:
            raise ValueError("At least 2 property IDs are required for a comparison")
        if len(v) > 10:
            raise ValueError("A comparison can include at most 10 properties")
        return v

    @validator("subject_property_id")
    def validate_subject_in_property_ids(cls, v, values):
        if v is not None and "property_ids" in values and v not in values["property_ids"]:
            raise ValueError("subject_property_id must be one of the property_ids")
        return v


class SavedComparisonUpdate(BaseModel):
    """Schema for updating a saved comparison (all fields optional)"""
    name: Optional[str] = None
    property_ids: Optional[List[int]] = None
    subject_property_id: Optional[int] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    preset_key: Optional[str] = None

    @validator("property_ids")
    def validate_property_ids(cls, v):
        if v is not None:
            if len(v) < 2:
                raise ValueError("At least 2 property IDs are required for a comparison")
            if len(v) > 10:
                raise ValueError("A comparison can include at most 10 properties")
        return v

    @validator("subject_property_id")
    def validate_subject_in_property_ids(cls, v, values):
        if v is not None and "property_ids" in values and values["property_ids"] is not None:
            if v not in values["property_ids"]:
                raise ValueError("subject_property_id must be one of the property_ids")
        return v


class SavedComparisonResponse(BaseModel):
    """Schema for saved comparison response"""
    id: int
    user_id: str
    organization_id: Optional[int] = None
    name: str
    property_ids: List[int]
    subject_property_id: Optional[int] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    preset_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
