"""
Saved Comparison CRUD service
NO LLM CALLS - Pure database operations only
BUG-006 fix: Save Comparison feature now writes to database
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.saved_comparison import SavedComparison
from app.schemas.saved_comparison import SavedComparisonCreate, SavedComparisonUpdate


def create_saved_comparison(
    db: Session,
    user_id: str,
    org_id: Optional[int],
    data: SavedComparisonCreate,
) -> SavedComparison:
    """Create a new saved comparison."""
    comparison = SavedComparison(
        user_id=user_id,
        organization_id=org_id,
        name=data.name,
        property_ids=data.property_ids,
        subject_property_id=data.subject_property_id,
        tags=data.tags,
        notes=data.notes,
        preset_key=data.preset_key,
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)
    return comparison


def list_saved_comparisons(
    db: Session,
    user_id: str,
    org_id: Optional[int],
) -> List[SavedComparison]:
    """List saved comparisons visible to the user (own + org-shared)."""
    if org_id:
        query = db.query(SavedComparison).filter(
            or_(
                SavedComparison.user_id == user_id,
                SavedComparison.organization_id == org_id,
            )
        )
    else:
        query = db.query(SavedComparison).filter(SavedComparison.user_id == user_id)

    return query.order_by(SavedComparison.updated_at.desc()).all()


def get_saved_comparison(
    db: Session,
    comparison_id: int,
    user_id: str,
    org_id: Optional[int],
) -> Optional[SavedComparison]:
    """Get a single saved comparison by ID (with org scoping)."""
    if org_id:
        return db.query(SavedComparison).filter(
            SavedComparison.id == comparison_id,
            or_(
                SavedComparison.user_id == user_id,
                SavedComparison.organization_id == org_id,
            ),
        ).first()
    else:
        return db.query(SavedComparison).filter(
            SavedComparison.id == comparison_id,
            SavedComparison.user_id == user_id,
        ).first()


def update_saved_comparison(
    db: Session,
    comparison_id: int,
    user_id: str,
    org_id: Optional[int],
    data: SavedComparisonUpdate,
) -> Optional[SavedComparison]:
    """Update a saved comparison. Only the owner can update."""
    comparison = db.query(SavedComparison).filter(
        SavedComparison.id == comparison_id,
        SavedComparison.user_id == user_id,
    ).first()

    if not comparison:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(comparison, field, value)

    db.commit()
    db.refresh(comparison)
    return comparison


def delete_saved_comparison(
    db: Session,
    comparison_id: int,
    user_id: str,
    org_id: Optional[int],
) -> bool:
    """Delete a saved comparison. Only the owner can delete."""
    comparison = db.query(SavedComparison).filter(
        SavedComparison.id == comparison_id,
        SavedComparison.user_id == user_id,
    ).first()

    if not comparison:
        return False

    db.delete(comparison)
    db.commit()
    return True
