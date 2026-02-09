"""
Scoring schemas for request/response handling
"""
from pydantic import BaseModel, validator
from typing import Optional, List, Dict


# ==================== WEIGHTS ====================

class ScoringWeights(BaseModel):
    """User scoring weight configuration"""
    cap_rate: float = 0.30
    economic_occupancy: float = 0.25
    loss_to_lease: float = 0.20
    opex_ratio: float = 0.25
    preset_name: Optional[str] = None

    @validator("opex_ratio")
    def weights_must_sum_to_one(cls, v, values):
        total = (
            values.get("cap_rate", 0)
            + values.get("economic_occupancy", 0)
            + values.get("loss_to_lease", 0)
            + v
        )
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total:.4f}")
        return v


class ScoringWeightsResponse(BaseModel):
    """Response for weights endpoints"""
    cap_rate: float
    economic_occupancy: float
    loss_to_lease: float
    opex_ratio: float
    preset_name: Optional[str] = None


# ==================== PRESETS ====================

class PresetInfo(BaseModel):
    """Information about a weight preset"""
    name: str
    label: str
    description: str
    weights: ScoringWeightsResponse


class PresetsResponse(BaseModel):
    """Response for presets list endpoint"""
    presets: List[PresetInfo]


# ==================== APPLY PRESET ====================

class ApplyPresetRequest(BaseModel):
    """Request to apply a preset"""
    preset_name: str


# ==================== METRIC BREAKDOWN ====================

class MetricBreakdown(BaseModel):
    """Score breakdown for a single metric"""
    label: str
    raw_value: Optional[float] = None
    score: Optional[float] = None
    weight: float
    unit: str
    benchmark_ideal: float
    benchmark_worst: float


class MarketSentiment(BaseModel):
    """Market sentiment data (Phase 4 - AI populated)"""
    score: Optional[float] = None
    rationale: Optional[str] = None
    updated_at: Optional[str] = None


class DealScoreResponse(BaseModel):
    """Full deal score response for a single property"""
    property_id: int
    property_name: str
    deal_score: Optional[float] = None
    metrics: Dict[str, MetricBreakdown]
    weights_used: Dict[str, float]
    scored_count: int
    max_possible: int
    market_sentiment: MarketSentiment


# ==================== BATCH SCORING ====================

class BatchScoreRequest(BaseModel):
    """Request for batch scoring"""
    property_ids: List[int]

    @validator("property_ids")
    def validate_ids(cls, v):
        if len(v) == 0:
            raise ValueError("Must provide at least 1 property ID")
        if len(v) > 50:
            raise ValueError("Cannot score more than 50 properties at once")
        return v


class BatchScoreResponse(BaseModel):
    """Response for batch scoring"""
    scores: List[DealScoreResponse]
