"""
Deal Folder CRUD endpoints - Phase 3A
NO LLM CALLS - Pure database operations only
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.deal_folder import DealFolder
from app.models.property import Property
from app.schemas.deal_folder import (
    DealFolderCreate,
    DealFolderUpdate,
    DealFolderResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/deal-folders", tags=["Deal Folders"])


@router.post("/", response_model=DealFolderResponse, status_code=status.HTTP_201_CREATED)
def create_deal_folder(
    folder_data: DealFolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new deal folder
    NO LLM - Pure database insert

    If folder with same name exists, automatically appends (2), (3), etc.
    """
    # Check if folder with same name already exists for this user
    base_name = folder_data.folder_name
    folder_name = base_name
    counter = 2

    while True:
        existing = db.query(DealFolder).filter(
            DealFolder.user_id == current_user.id,
            DealFolder.folder_name == folder_name
        ).first()

        if not existing:
            break  # Name is available

        # Name exists, try with counter
        folder_name = f"{base_name} ({counter})"
        counter += 1

        # Safety limit to prevent infinite loop
        if counter > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Too many folders with name '{base_name}'"
            )

    # Create new folder with available name
    new_folder = DealFolder(
        user_id=current_user.id,
        folder_name=folder_name,  # Use the available name (may have number appended)
        property_type=folder_data.property_type,
        property_address=folder_data.property_address,
        submarket=folder_data.submarket,
        total_units=folder_data.total_units,
        total_sf=folder_data.total_sf,
        status=folder_data.status,
        notes=folder_data.notes,
        document_count=0  # Initialize to 0
    )

    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    return new_folder


@router.get("/", response_model=List[DealFolderResponse])
def list_deal_folders(
    status_filter: str = None,  # 'active', 'archived'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all deal folders for current user
    NO LLM - Pure database query
    """
    query = db.query(DealFolder).filter(DealFolder.user_id == current_user.id)

    if status_filter:
        query = query.filter(DealFolder.status == status_filter)

    folders = query.order_by(DealFolder.last_updated.desc()).all()
    return folders


@router.get("/{folder_id}", response_model=DealFolderResponse)
def get_deal_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get deal folder by ID
    NO LLM - Pure database query
    """
    folder = db.query(DealFolder).filter(
        DealFolder.id == folder_id,
        DealFolder.user_id == current_user.id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder {folder_id} not found"
        )

    return folder


@router.patch("/{folder_id}", response_model=DealFolderResponse)
def update_deal_folder(
    folder_id: int,
    folder_update: DealFolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update deal folder
    NO LLM - Pure database update
    """
    folder = db.query(DealFolder).filter(
        DealFolder.id == folder_id,
        DealFolder.user_id == current_user.id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder {folder_id} not found"
        )

    # Update only provided fields
    update_data = folder_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(folder, field, value)

    db.commit()
    db.refresh(folder)

    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal_folder(
    folder_id: int,
    delete_contents: str = None,  # Query param: ?delete_contents=true
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete deal folder
    NO LLM - Pure database delete

    Query Parameters:
    - delete_contents: If "true", deletes all properties in folder.
                       If not provided or "false", orphans properties (sets deal_folder_id to NULL).
    """
    folder = db.query(DealFolder).filter(
        DealFolder.id == folder_id,
        DealFolder.user_id == current_user.id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder {folder_id} not found"
        )

    # Check if we should delete properties or orphan them
    should_delete_contents = delete_contents and delete_contents.lower() == "true"

    if should_delete_contents:
        # Delete all properties in folder (cascade delete)
        properties = db.query(Property).filter(
            Property.deal_folder_id == folder_id,
            Property.user_id == current_user.id  # Safety: ensure user owns these properties
        ).all()

        for prop in properties:
            db.delete(prop)
    else:
        # Orphan properties (set deal_folder_id to NULL)
        db.query(Property).filter(
            Property.deal_folder_id == folder_id,
            Property.user_id == current_user.id  # Safety: ensure user owns these properties
        ).update({"deal_folder_id": None})

    # Delete the folder
    db.delete(folder)
    db.commit()

    return None


@router.get("/{folder_id}/properties", response_model=List[dict])
def get_folder_properties(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all properties in a folder
    NO LLM - Pure database query
    Returns lightweight property list for folder view
    """
    # Verify folder exists and user owns it
    folder = db.query(DealFolder).filter(
        DealFolder.id == folder_id,
        DealFolder.user_id == current_user.id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder {folder_id} not found"
        )

    # Get all properties in folder
    properties = db.query(Property).filter(
        Property.deal_folder_id == folder_id,
        Property.user_id == current_user.id
    ).order_by(Property.upload_date.desc()).all()

    # Return lightweight response
    return [
        {
            "id": prop.id,
            "deal_name": prop.deal_name,
            "document_type": prop.document_type,
            "document_subtype": prop.document_subtype,
            "property_type": prop.property_type,
            "property_address": prop.property_address,
            "upload_date": prop.upload_date,
            "t12_noi": prop.t12_noi,
            "y1_noi": prop.y1_noi,
        }
        for prop in properties
    ]
