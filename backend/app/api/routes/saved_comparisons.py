"""
Saved Comparison CRUD endpoints
NO LLM CALLS - Pure database operations only
BUG-006 fix: Save Comparison feature now writes to database
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.saved_comparison import (
    SavedComparisonCreate,
    SavedComparisonUpdate,
    SavedComparisonResponse,
)
from app.api.deps import get_current_user
from app.api.routes.organizations import _get_user_org_id
from app.services.saved_comparison_service import (
    create_saved_comparison,
    list_saved_comparisons,
    get_saved_comparison,
    update_saved_comparison,
    delete_saved_comparison,
)

router = APIRouter(prefix="/saved-comparisons", tags=["Saved Comparisons"])


@router.post("", response_model=SavedComparisonResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SavedComparisonResponse, status_code=status.HTTP_201_CREATED)
def create_comparison(
    data: SavedComparisonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save a new property comparison.
    NO LLM - Pure database insert.

    Handles both /saved-comparisons and /saved-comparisons/ to prevent trailing slash issues.
    """
    org_id = _get_user_org_id(db, str(current_user.id))
    comparison = create_saved_comparison(db, str(current_user.id), org_id, data)
    return comparison


@router.get("", response_model=List[SavedComparisonResponse])
@router.get("/", response_model=List[SavedComparisonResponse])
def list_comparisons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all saved comparisons for the current user (own + org-shared).
    NO LLM - Pure database query.

    Handles both /saved-comparisons and /saved-comparisons/ to prevent trailing slash issues.
    """
    org_id = _get_user_org_id(db, str(current_user.id))
    return list_saved_comparisons(db, str(current_user.id), org_id)


@router.get("/{comparison_id}", response_model=SavedComparisonResponse)
def get_comparison(
    comparison_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single saved comparison by ID.
    NO LLM - Pure database query.
    """
    org_id = _get_user_org_id(db, str(current_user.id))
    comparison = get_saved_comparison(db, comparison_id, str(current_user.id), org_id)

    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved comparison {comparison_id} not found",
        )

    return comparison


@router.patch("/{comparison_id}", response_model=SavedComparisonResponse)
def update_comparison(
    comparison_id: int,
    data: SavedComparisonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a saved comparison. Only the owner can update.
    NO LLM - Pure database update.
    """
    comparison = update_saved_comparison(
        db, comparison_id, str(current_user.id), None, data,
    )

    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved comparison {comparison_id} not found",
        )

    return comparison


@router.delete("/{comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comparison(
    comparison_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a saved comparison. Only the owner can delete.
    NO LLM - Pure database delete.
    """
    deleted = delete_saved_comparison(
        db, comparison_id, str(current_user.id), None,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved comparison {comparison_id} not found",
        )

    return None
