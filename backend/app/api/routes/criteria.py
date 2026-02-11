"""
Investment criteria and screening routes

Endpoints:
- GET  /criteria            — get user's criteria (create default if none)
- PUT  /criteria            — update criteria
- GET  /properties/{id}/screening — screen a specific property
- GET  /screening/summary   — screen ALL properties, sorted by score
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.property import Property
from app.models.criteria import UserInvestmentCriteria
from app.api.deps import get_current_user
from app.schemas.criteria import (
    InvestmentCriteriaUpdate,
    InvestmentCriteriaResponse,
    ScreeningResult,
    ScreeningCheck,
    ScreeningSummaryItem,
)
from app.services.screening_service import screen_property

router = APIRouter(tags=["Criteria & Screening"])


# ==================== GET CRITERIA ====================

@router.get("/criteria", response_model=InvestmentCriteriaResponse)
def get_criteria(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the user's investment criteria. Creates a default set if none exist."""
    criteria = db.query(UserInvestmentCriteria).filter(
        UserInvestmentCriteria.user_id == str(current_user.id)
    ).first()

    if not criteria:
        criteria = UserInvestmentCriteria(
            user_id=str(current_user.id),
            criteria_name="Default Criteria",
        )
        db.add(criteria)
        db.commit()
        db.refresh(criteria)

    return criteria


# ==================== UPDATE CRITERIA ====================

@router.put("/criteria", response_model=InvestmentCriteriaResponse)
def update_criteria(
    criteria_data: InvestmentCriteriaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update (or create) the user's investment criteria."""
    criteria = db.query(UserInvestmentCriteria).filter(
        UserInvestmentCriteria.user_id == str(current_user.id)
    ).first()

    if not criteria:
        criteria = UserInvestmentCriteria(
            user_id=str(current_user.id),
        )
        db.add(criteria)

    # Update all fields from the request
    update_data = criteria_data.model_dump(exclude_unset=False)
    for key, value in update_data.items():
        setattr(criteria, key, value)

    db.commit()
    db.refresh(criteria)

    # Re-screen all properties with new criteria
    _rescreen_all_properties(db, str(current_user.id), criteria)

    return criteria


# ==================== SCREEN SINGLE PROPERTY ====================

@router.get("/properties/{property_id}/screening", response_model=ScreeningResult)
def screen_single_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Screen a specific property against the user's criteria."""
    property_obj = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == str(current_user.id),
    ).first()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found",
        )

    criteria = db.query(UserInvestmentCriteria).filter(
        UserInvestmentCriteria.user_id == str(current_user.id)
    ).first()

    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No investment criteria set. Configure criteria in Settings first.",
        )

    result = screen_property(property_obj, criteria)

    # Store result on property
    property_obj.screening_verdict = result["verdict"]
    property_obj.screening_score = result["score"]
    property_obj.screening_details_json = json.dumps(result["checks"])
    db.commit()

    return ScreeningResult(
        property_id=property_obj.id,
        property_name=property_obj.deal_name,
        verdict=result["verdict"],
        score=result["score"],
        checks=[ScreeningCheck(**c) for c in result["checks"]],
        summary=result["summary"],
    )


# ==================== SCREENING SUMMARY (ALL PROPERTIES) ====================

@router.get("/screening/summary", response_model=List[ScreeningSummaryItem])
def screening_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Screen ALL user properties and return results sorted by score."""
    criteria = db.query(UserInvestmentCriteria).filter(
        UserInvestmentCriteria.user_id == str(current_user.id)
    ).first()

    if not criteria:
        return []

    properties = db.query(Property).filter(
        Property.user_id == str(current_user.id)
    ).all()

    results = []
    for prop in properties:
        result = screen_property(prop, criteria)

        # Update stored screening data
        prop.screening_verdict = result["verdict"]
        prop.screening_score = result["score"]
        prop.screening_details_json = json.dumps(result["checks"])

        results.append(ScreeningSummaryItem(
            property_id=prop.id,
            property_name=prop.deal_name,
            verdict=result["verdict"],
            score=result["score"],
            summary=result["summary"],
        ))

    db.commit()

    # Sort by score descending
    results.sort(key=lambda r: r.score, reverse=True)

    return results


# ==================== HELPER ====================

def _rescreen_all_properties(db: Session, user_id: str, criteria: UserInvestmentCriteria):
    """Re-screen all properties when criteria change."""
    properties = db.query(Property).filter(
        Property.user_id == user_id
    ).all()

    for prop in properties:
        result = screen_property(prop, criteria)
        prop.screening_verdict = result["verdict"]
        prop.screening_score = result["score"]
        prop.screening_details_json = json.dumps(result["checks"])

    db.commit()
