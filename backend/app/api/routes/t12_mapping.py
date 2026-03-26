"""
T12 Mapping API routes — CRUD for line items and category mapping.
"""
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.t12_line_items import T12LineItem
from app.models.underwriting import UnderwritingModel
from app.schemas.t12_mapping import (
    T12LineItemOut,
    T12LineItemsResponse,
    CategoryUpdateRequest,
    BulkUpdateItem,
    BulkUpdateRequest,
    ApplyMappingResponse,
    CategoryTotal,
    REVENUE_CATEGORIES,
    EXPENSE_CATEGORIES,
    SPECIAL_CATEGORIES,
    ALL_CATEGORIES,
    CATEGORY_TO_FIELD,
    CATEGORY_TO_UW_FIELD,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/t12-mapping", tags=["T12 Mapping"])


def _serialize_line_item(item: T12LineItem) -> T12LineItemOut:
    """Convert DB model to Pydantic schema, parsing JSON monthly_values."""
    monthly = None
    if item.monthly_values:
        try:
            monthly = json.loads(item.monthly_values)
        except (json.JSONDecodeError, TypeError):
            monthly = None

    return T12LineItemOut(
        id=item.id,
        property_id=item.property_id,
        raw_label=item.raw_label,
        gl_code=item.gl_code,
        section=item.section,
        subsection=item.subsection,
        row_index=item.row_index,
        is_subtotal=item.is_subtotal or False,
        is_section_header=item.is_section_header or False,
        monthly_values=monthly,
        annual_total=item.annual_total,
        t1_value=item.t1_value,
        t2_value=item.t2_value,
        t3_value=item.t3_value,
        mapped_category=item.mapped_category,
        auto_confidence=item.auto_confidence,
        user_confirmed=item.user_confirmed or False,
    )


@router.get("/properties/{property_id}/t12-line-items", response_model=T12LineItemsResponse)
def get_t12_line_items(property_id: int, db: Session = Depends(get_db)):
    """Get all T12 line items for a property, ordered by row_index."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    items = (
        db.query(T12LineItem)
        .filter(T12LineItem.property_id == property_id)
        .order_by(T12LineItem.row_index)
        .all()
    )

    return T12LineItemsResponse(
        items=[_serialize_line_item(item) for item in items],
        categories={
            "revenue": REVENUE_CATEGORIES + ["Exclude"],
            "expense": EXPENSE_CATEGORIES + ["Exclude"],
        },
    )


@router.put("/properties/{property_id}/t12-line-items/{item_id}/category")
def update_line_item_category(
    property_id: int,
    item_id: int,
    body: CategoryUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update a single line item's mapped category."""
    item = (
        db.query(T12LineItem)
        .filter(T12LineItem.id == item_id, T12LineItem.property_id == property_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    if body.mapped_category not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {body.mapped_category}")

    item.mapped_category = body.mapped_category
    item.user_confirmed = True
    db.commit()

    return {"status": "ok", "id": item.id, "mapped_category": item.mapped_category}


@router.post("/properties/{property_id}/t12-line-items/bulk-update")
def bulk_update_categories(
    property_id: int,
    body: BulkUpdateRequest,
    db: Session = Depends(get_db),
):
    """Bulk update mapped categories for multiple line items."""
    item_ids = [u.id for u in body.updates]
    items = (
        db.query(T12LineItem)
        .filter(T12LineItem.property_id == property_id, T12LineItem.id.in_(item_ids))
        .all()
    )
    item_map = {item.id: item for item in items}

    updated = 0
    for update in body.updates:
        item = item_map.get(update.id)
        if item and update.mapped_category in ALL_CATEGORIES:
            item.mapped_category = update.mapped_category
            item.user_confirmed = True
            updated += 1

    db.commit()
    return {"status": "ok", "updated": updated}


@router.post("/properties/{property_id}/t12-line-items/apply-mapping", response_model=ApplyMappingResponse)
def apply_mapping(property_id: int, db: Session = Depends(get_db)):
    """
    Aggregate categorized line items and update the property's T12 financials
    and underwriting model expense seeds.
    """
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    total_units = prop.total_units or 1

    # Get all mappable line items
    items = (
        db.query(T12LineItem)
        .filter(
            T12LineItem.property_id == property_id,
            T12LineItem.is_subtotal == False,  # noqa: E712
            T12LineItem.is_section_header == False,  # noqa: E712
            T12LineItem.mapped_category.isnot(None),
            T12LineItem.mapped_category != "Exclude",
            T12LineItem.mapped_category != "TOTAL",
        )
        .all()
    )

    # Aggregate by category
    category_totals = {}
    for item in items:
        cat = item.mapped_category
        if cat not in category_totals:
            category_totals[cat] = {"annual": 0.0, "t3": 0.0, "item_count": 0, "monthly": {}}
        category_totals[cat]["annual"] += (item.annual_total or 0)
        category_totals[cat]["t3"] += (item.t3_value or 0)
        category_totals[cat]["item_count"] += 1

        if item.monthly_values:
            try:
                mv = json.loads(item.monthly_values) if isinstance(item.monthly_values, str) else item.monthly_values
                for month, val in mv.items():
                    category_totals[cat]["monthly"][month] = (
                        category_totals[cat]["monthly"].get(month, 0) + (val or 0)
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    # Build response with per-unit values
    response_totals = {}
    total_revenue = 0.0
    total_expenses = 0.0

    for cat, totals in category_totals.items():
        per_unit = totals["annual"] / total_units if total_units > 0 else 0
        response_totals[cat] = CategoryTotal(
            annual=totals["annual"],
            t3=totals["t3"],
            item_count=totals["item_count"],
            per_unit=round(per_unit, 2),
        )
        if cat in REVENUE_CATEGORIES:
            total_revenue += totals["annual"]
        elif cat in EXPENSE_CATEGORIES:
            total_expenses += totals["annual"]

    noi = total_revenue - total_expenses

    # Update t12_financials_json
    existing_fin = {}
    if prop.t12_financials_json:
        try:
            existing_fin = json.loads(prop.t12_financials_json)
        except (json.JSONDecodeError, TypeError):
            pass

    for cat, totals in category_totals.items():
        field = CATEGORY_TO_FIELD.get(cat)
        if field:
            existing_fin[field] = totals["annual"]

    existing_fin["total_opex"] = total_expenses
    existing_fin["noi"] = noi
    if total_revenue > 0:
        existing_fin["opex_ratio"] = round(total_expenses / total_revenue * 100, 2)

    prop.t12_financials_json = json.dumps(existing_fin)

    # Update denormalized fields
    prop.t12_noi = noi
    prop.t12_total_expenses = total_expenses
    prop.t12_revenue = total_revenue
    prop.t12_gsr = category_totals.get("Scheduled Market Rent", {}).get("annual") or prop.t12_gsr

    # Update UW model expense seeds if one exists
    updated_uw_fields = {}
    uw_model = (
        db.query(UnderwritingModel)
        .filter(UnderwritingModel.property_id == property_id, UnderwritingModel.is_active == True)  # noqa: E712
        .first()
    )
    if uw_model and uw_model.inputs_json:
        try:
            inputs = json.loads(uw_model.inputs_json)

            # Update per-unit expense fields
            for cat, uw_field in CATEGORY_TO_UW_FIELD.items():
                if cat in category_totals:
                    per_unit = category_totals[cat]["annual"] / total_units
                    inputs[uw_field] = round(per_unit, 2)
                    updated_uw_fields[uw_field] = round(per_unit, 2)

            # Update trailing_t12 with mapped values
            if inputs.get("trailing_t12") and isinstance(inputs["trailing_t12"], dict):
                for cat, totals in category_totals.items():
                    field = CATEGORY_TO_FIELD.get(cat)
                    if field:
                        inputs["trailing_t12"][field] = totals["annual"]
                inputs["trailing_t12"]["total_opex"] = total_expenses
                inputs["trailing_t12"]["noi"] = noi

            # Update management fee if MGMT category exists
            if "MGMT" in category_totals and total_revenue > 0:
                mgmt_pct = category_totals["MGMT"]["annual"] / total_revenue
                inputs["mgmt_fee_pct"] = round(mgmt_pct, 4)
                updated_uw_fields["mgmt_fee_pct"] = round(mgmt_pct, 4)

            # Update tax amount if Property Taxes category exists
            if "Property Taxes" in category_totals:
                inputs["current_tax_amount"] = category_totals["Property Taxes"]["annual"]
                updated_uw_fields["current_tax_amount"] = category_totals["Property Taxes"]["annual"]

            # Update payroll — store total as a reference but don't overwrite itemized payroll
            if "Payroll" in category_totals:
                updated_uw_fields["payroll_total"] = category_totals["Payroll"]["annual"]

            uw_model.inputs_json = json.dumps(inputs)
        except Exception as e:
            logger.warning("Failed to update UW model inputs from mapping: %s", e)

    db.commit()

    return ApplyMappingResponse(
        category_totals=response_totals,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        noi=noi,
        updated_uw_fields=updated_uw_fields if updated_uw_fields else None,
    )
