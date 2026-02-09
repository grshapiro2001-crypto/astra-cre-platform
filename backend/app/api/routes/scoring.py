"""
Scoring API routes - Deal score calculation endpoints (NO LLM CALLS)

All endpoints require authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.property import Property
from app.schemas.scoring import (
    ScoringWeights,
    ScoringWeightsResponse,
    PresetsResponse,
    PresetInfo,
    ApplyPresetRequest,
    DealScoreResponse,
    MetricBreakdown,
    MarketSentiment,
    BatchScoreRequest,
    BatchScoreResponse,
)
from app.services.scoring_service import (
    calculate_deal_score,
    get_user_weights,
    save_user_weights,
    WEIGHT_PRESETS,
)

router = APIRouter(prefix="/scoring", tags=["scoring"])


# ==================== WEIGHTS ENDPOINTS ====================

@router.get("/weights", response_model=ScoringWeightsResponse)
def get_weights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's scoring weights."""
    weights = get_user_weights(db, current_user.id)
    return ScoringWeightsResponse(**weights)


@router.put("/weights", response_model=ScoringWeightsResponse)
def update_weights(
    payload: ScoringWeights,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's scoring weights."""
    weights_dict = {
        "cap_rate": payload.cap_rate,
        "economic_occupancy": payload.economic_occupancy,
        "loss_to_lease": payload.loss_to_lease,
        "opex_ratio": payload.opex_ratio,
    }
    result = save_user_weights(db, current_user.id, weights_dict, payload.preset_name)
    return ScoringWeightsResponse(**result)


# ==================== PRESETS ENDPOINTS ====================

@router.get("/presets", response_model=PresetsResponse)
def list_presets(
    current_user: User = Depends(get_current_user),
):
    """List all available scoring weight presets."""
    presets = []
    for name, info in WEIGHT_PRESETS.items():
        presets.append(PresetInfo(
            name=name,
            label=info["label"],
            description=info["description"],
            weights=ScoringWeightsResponse(**info["weights"]),
        ))
    return PresetsResponse(presets=presets)


@router.put("/weights/preset", response_model=ScoringWeightsResponse)
def apply_preset(
    payload: ApplyPresetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a preset to the current user's scoring weights."""
    preset = WEIGHT_PRESETS.get(payload.preset_name)
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preset '{payload.preset_name}' not found. "
                   f"Available: {', '.join(WEIGHT_PRESETS.keys())}",
        )
    result = save_user_weights(
        db, current_user.id, preset["weights"], payload.preset_name
    )
    return ScoringWeightsResponse(**result)


# ==================== SCORE ENDPOINTS ====================

def _score_property(prop: Property, weights: dict) -> DealScoreResponse:
    """Helper to score a property and build the response model."""
    weights_for_calc = {
        "cap_rate": weights["cap_rate"],
        "economic_occupancy": weights["economic_occupancy"],
        "loss_to_lease": weights["loss_to_lease"],
        "opex_ratio": weights["opex_ratio"],
    }

    result = calculate_deal_score(prop, weights_for_calc)

    # Convert metrics dict to MetricBreakdown models
    metrics_response = {}
    for key, val in result["metrics"].items():
        metrics_response[key] = MetricBreakdown(**val)

    return DealScoreResponse(
        property_id=prop.id,
        property_name=prop.deal_name,
        deal_score=result["deal_score"],
        metrics=metrics_response,
        weights_used=result["weights_used"],
        scored_count=result["scored_count"],
        max_possible=result["max_possible"],
        market_sentiment=MarketSentiment(**result["market_sentiment"]),
    )


@router.get("/score/{property_id}", response_model=DealScoreResponse)
def get_score(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate deal score for a single property.
    Uses the current user's weights (or defaults if not configured).
    """
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == current_user.id,
    ).first()

    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property {property_id} not found",
        )

    weights = get_user_weights(db, current_user.id)
    return _score_property(prop, weights)


@router.post("/scores", response_model=BatchScoreResponse)
def batch_score(
    payload: BatchScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate deal scores for multiple properties at once.
    Uses the current user's weights (or defaults if not configured).
    """
    properties = db.query(Property).filter(
        Property.id.in_(payload.property_ids),
        Property.user_id == current_user.id,
    ).all()

    if not properties:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No properties found for the given IDs",
        )

    weights = get_user_weights(db, current_user.id)
    scores = [_score_property(prop, weights) for prop in properties]

    return BatchScoreResponse(scores=scores)
