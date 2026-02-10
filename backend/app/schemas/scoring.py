"""
Schemas for Deal Score v2 three-layer scoring system
"""
from pydantic import BaseModel, validator
from typing import Optional, List, Dict
from datetime import datetime


# ==================== WEIGHTS ====================

class ScoringWeightsResponse(BaseModel):
    """Response for user scoring weights"""
    economic_occupancy_weight: int
    opex_ratio_weight: int
    supply_pipeline_weight: int
    layer1_weight: int
    layer2_weight: int
    layer3_weight: int
    preset_name: Optional[str] = None

    class Config:
        from_attributes = True


class ScoringWeightsUpdate(BaseModel):
    """Partial update for scoring weights — all fields optional"""
    economic_occupancy_weight: Optional[int] = None
    opex_ratio_weight: Optional[int] = None
    supply_pipeline_weight: Optional[int] = None
    layer1_weight: Optional[int] = None
    layer2_weight: Optional[int] = None
    layer3_weight: Optional[int] = None
    preset_name: Optional[str] = None


class PresetApplyRequest(BaseModel):
    """Request to apply a scoring preset"""
    preset_name: str


# ==================== SCORE RESULTS ====================

class MetricBreakdown(BaseModel):
    """Individual metric score breakdown"""
    value: Optional[float] = None
    raw_score: Optional[float] = None
    weight: int
    weighted_score: Optional[float] = None
    context: Optional[str] = None


class LayerResult(BaseModel):
    """Result for a single scoring layer"""
    score: Optional[float] = None
    weight: int
    weighted_contribution: Optional[float] = None
    metrics: Dict[str, MetricBreakdown] = {}


class DealScoreResponse(BaseModel):
    """Full deal score response"""
    total_score: Optional[float] = None
    layer_scores: Dict[str, LayerResult] = {}
    confidence: str = "medium"
    warnings: List[str] = []


class BatchScoreRequest(BaseModel):
    """Request to batch score multiple properties"""
    property_ids: List[int]


class BatchScoreResponse(BaseModel):
    """Response for batch scoring"""
    scores: Dict[int, DealScoreResponse] = {}


# ==================== SUBMARKET INVENTORY ====================

class SubmarketInventoryCreate(BaseModel):
    """Request to set submarket inventory"""
    metro: str
    submarket: str
    total_units: int

    @validator("total_units")
    def validate_total_units(cls, v):
        if v <= 0:
            raise ValueError("total_units must be positive")
        return v


class SubmarketInventoryResponse(BaseModel):
    """Response for submarket inventory"""
    id: int
    user_id: str
    metro: str
    submarket: str
    total_units: int
    updated_at: datetime

    class Config:
        from_attributes = True
