"""
Scoring routes — Deal Score v2 three-layer architecture

Endpoints for scoring weights CRUD, presets, single/batch scoring.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.property import Property
from app.api.deps import get_current_user
from app.schemas.scoring import (
    ScoringWeightsResponse,
    ScoringWeightsUpdate,
    PresetApplyRequest,
    DealScoreResponse,
    BatchScoreRequest,
    BatchScoreResponse,
)
from app.services import scoring_service

router = APIRouter(prefix="/scoring", tags=["Scoring"])


# ==================== WEIGHTS ====================

@router.get("/weights", response_model=ScoringWeightsResponse)
def get_weights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's scoring weights (creates defaults if none exist)."""
    weights = scoring_service.get_user_weights(str(current_user.id), db)
    return ScoringWeightsResponse.model_validate(weights)


@router.put("/weights", response_model=ScoringWeightsResponse)
def update_weights(
    update: ScoringWeightsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update user's scoring weights.
    Validates that Layer 1 metric weights sum to 100 and layer weights sum to 100.
    """
    update_dict = update.model_dump(exclude_unset=True)

    # Get current weights for validation
    current = scoring_service.get_user_weights(str(current_user.id), db)

    # Merge updates with current values for validation
    metric_weights = {
        "economic_occupancy_weight": update_dict.get("economic_occupancy_weight", current.economic_occupancy_weight),
        "opex_ratio_weight": update_dict.get("opex_ratio_weight", current.opex_ratio_weight),
        "supply_pipeline_weight": update_dict.get("supply_pipeline_weight", current.supply_pipeline_weight),
    }

    layer_weights = {
        "layer1_weight": update_dict.get("layer1_weight", current.layer1_weight),
        "layer2_weight": update_dict.get("layer2_weight", current.layer2_weight),
        "layer3_weight": update_dict.get("layer3_weight", current.layer3_weight),
    }

    # Validate sums
    metric_sum = sum(metric_weights.values())
    if metric_sum != 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Layer 1 metric weights must sum to 100 (got {metric_sum})",
        )

    layer_sum = sum(layer_weights.values())
    if layer_sum != 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Layer weights must sum to 100 (got {layer_sum})",
        )

    weights = scoring_service.update_user_weights(str(current_user.id), update_dict, db)
    return ScoringWeightsResponse.model_validate(weights)


# ==================== PRESETS ====================

@router.get("/presets")
def list_presets():
    """List all available scoring presets with their weight values."""
    return scoring_service.SCORING_PRESETS


@router.put("/weights/preset", response_model=ScoringWeightsResponse)
def apply_preset(
    request: PresetApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply a scoring preset by name."""
    try:
        weights = scoring_service.apply_preset(str(current_user.id), request.preset_name, db)
        return ScoringWeightsResponse.model_validate(weights)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ==================== SCORING ====================

@router.get("/score/{property_id}")
def score_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score a single property using the user's current weights."""
    # Get property
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == str(current_user.id),
    ).first()

    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found",
        )

    # Get weights
    weights = scoring_service.get_user_weights(str(current_user.id), db)

    # Extract property data
    property_data = scoring_service._extract_property_data(prop)

    # Calculate score
    result = scoring_service.calculate_deal_score(property_data, weights, str(current_user.id), db)
    return result


@router.post("/scores")
def batch_score_properties(
    request: BatchScoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batch score multiple properties."""
    user_id = str(current_user.id)
    weights = scoring_service.get_user_weights(user_id, db)

    results = {}
    for pid in request.property_ids:
        prop = db.query(Property).filter(
            Property.id == pid,
            Property.user_id == user_id,
        ).first()

        if not prop:
            results[pid] = {
                "total_score": None,
                "layer_scores": {},
                "confidence": "low",
                "warnings": [f"Property {pid} not found"],
            }
            continue

        property_data = scoring_service._extract_property_data(prop)
        result = scoring_service.calculate_deal_score(property_data, weights, user_id, db)
        results[pid] = result

    return {"scores": results}
