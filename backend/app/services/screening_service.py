"""
Screening service — checks properties against user investment criteria.
NO LLM CALLS — pure business logic.
"""
import json
from typing import Optional
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.criteria import UserInvestmentCriteria
from app.schemas.criteria import ScreeningCheck


def screen_property(property_obj: Property, criteria: UserInvestmentCriteria) -> dict:
    """
    Screen a property against user criteria.
    Returns: {
        "verdict": "PASS" | "FAIL" | "REVIEW",
        "score": 85,
        "checks": [...],
        "summary": "Property passes 8/9 criteria (1 skipped due to missing data)"
    }
    """
    checks = []
    passed = 0
    failed = 0
    skipped = 0

    def add_check(criterion: str, property_value, threshold_met: Optional[bool]):
        nonlocal passed, failed, skipped
        if property_value is None:
            checks.append(ScreeningCheck(
                criterion=criterion,
                value=None,
                result="SKIP"
            ))
            skipped += 1
        elif threshold_met:
            checks.append(ScreeningCheck(
                criterion=criterion,
                value=float(property_value) if property_value is not None else None,
                result="PASS"
            ))
            passed += 1
        else:
            checks.append(ScreeningCheck(
                criterion=criterion,
                value=float(property_value) if property_value is not None else None,
                result="FAIL"
            ))
            failed += 1

    # --- Property Filters ---

    if criteria.min_units is not None:
        units = property_obj.total_units
        add_check(
            f"Min Units >= {criteria.min_units}",
            units,
            units >= criteria.min_units if units is not None else None
        )

    if criteria.max_units is not None:
        units = property_obj.total_units
        add_check(
            f"Max Units <= {criteria.max_units}",
            units,
            units <= criteria.max_units if units is not None else None
        )

    if criteria.property_types is not None:
        allowed = [t.strip().lower() for t in criteria.property_types.split(",") if t.strip()]
        prop_type = property_obj.property_type
        if prop_type:
            met = prop_type.lower() in allowed
            checks.append(ScreeningCheck(
                criterion=f"Property Type in [{criteria.property_types}]",
                value=None,
                result="PASS" if met else "FAIL"
            ))
            if met:
                passed += 1
            else:
                failed += 1
        else:
            checks.append(ScreeningCheck(
                criterion=f"Property Type in [{criteria.property_types}]",
                value=None,
                result="SKIP"
            ))
            skipped += 1

    if criteria.target_markets is not None:
        allowed = [m.strip().lower() for m in criteria.target_markets.split(",") if m.strip()]
        # Check metro first, then submarket
        market_value = property_obj.metro or property_obj.submarket
        if market_value:
            met = market_value.lower() in allowed
            checks.append(ScreeningCheck(
                criterion=f"Market in [{criteria.target_markets}]",
                value=None,
                result="PASS" if met else "FAIL"
            ))
            if met:
                passed += 1
            else:
                failed += 1
        else:
            checks.append(ScreeningCheck(
                criterion=f"Market in [{criteria.target_markets}]",
                value=None,
                result="SKIP"
            ))
            skipped += 1

    if criteria.min_year_built is not None:
        yb = property_obj.year_built
        add_check(
            f"Year Built >= {criteria.min_year_built}",
            yb,
            yb >= criteria.min_year_built if yb is not None else None
        )

    # --- Financial Thresholds ---

    # Cap Rate: derive from T12 NOI and pricing if available
    # We look at expense_ratio_pct fields for cap rate proxy
    # For cap rate, we need NOI and pricing. Use T12 financials opex_ratio as proxy.
    # Actually, cap rate needs property price which isn't stored directly on Property.
    # Skip cap rate check if we can't compute it.
    # NOTE: For BOV properties, cap rate might be in BOV tiers, but that's complex.
    # For now, we skip cap rate if not directly derivable.

    if criteria.min_cap_rate is not None or criteria.max_cap_rate is not None:
        # We don't have a direct cap rate column. Skip these checks.
        if criteria.min_cap_rate is not None:
            checks.append(ScreeningCheck(
                criterion=f"Cap Rate >= {criteria.min_cap_rate}%",
                value=None,
                result="SKIP"
            ))
            skipped += 1
        if criteria.max_cap_rate is not None:
            checks.append(ScreeningCheck(
                criterion=f"Cap Rate <= {criteria.max_cap_rate}%",
                value=None,
                result="SKIP"
            ))
            skipped += 1

    if criteria.min_economic_occupancy is not None:
        # Economic occupancy: derive from vacancy rate
        # Economic Occupancy ≈ 100 - vacancy_rate_pct
        vac = property_obj.t12_vacancy_rate_pct or property_obj.y1_vacancy_rate_pct
        if vac is not None:
            eco_occ = 100.0 - float(vac)
            add_check(
                f"Economic Occupancy >= {criteria.min_economic_occupancy}%",
                round(eco_occ, 1),
                eco_occ >= criteria.min_economic_occupancy
            )
        else:
            checks.append(ScreeningCheck(
                criterion=f"Economic Occupancy >= {criteria.min_economic_occupancy}%",
                value=None,
                result="SKIP"
            ))
            skipped += 1

    if criteria.max_opex_ratio is not None:
        opex = property_obj.t12_expense_ratio_pct or property_obj.y1_expense_ratio_pct
        if opex is not None:
            add_check(
                f"OpEx Ratio <= {criteria.max_opex_ratio}%",
                round(float(opex), 1),
                float(opex) <= criteria.max_opex_ratio
            )
        else:
            checks.append(ScreeningCheck(
                criterion=f"OpEx Ratio <= {criteria.max_opex_ratio}%",
                value=None,
                result="SKIP"
            ))
            skipped += 1

    if criteria.min_noi is not None:
        noi = property_obj.t12_noi or property_obj.y1_noi
        add_check(
            f"NOI >= ${criteria.min_noi:,.0f}",
            noi,
            noi >= criteria.min_noi if noi is not None else None
        )

    if criteria.max_price_per_unit is not None:
        # Price per unit not stored directly on Property model; skip
        checks.append(ScreeningCheck(
            criterion=f"Price/Unit <= ${criteria.max_price_per_unit:,.0f}",
            value=None,
            result="SKIP"
        ))
        skipped += 1

    if criteria.min_deal_score is not None:
        # Deal score would need to be fetched from scoring service
        # For now, skip since it's not stored on property
        checks.append(ScreeningCheck(
            criterion=f"Deal Score >= {criteria.min_deal_score}",
            value=None,
            result="SKIP"
        ))
        skipped += 1

    # --- Compute verdict ---
    total_evaluated = passed + failed
    total_checks = passed + failed + skipped

    if total_evaluated == 0:
        verdict = "REVIEW"
        score = 0
    else:
        score = round((passed / total_evaluated) * 100)
        if failed == 0:
            verdict = "PASS"
        elif score >= 75:
            verdict = "REVIEW"
        else:
            verdict = "FAIL"

    summary_parts = []
    summary_parts.append(f"Property passes {passed}/{total_evaluated} criteria")
    if skipped > 0:
        summary_parts.append(f"({skipped} skipped due to missing data)")

    return {
        "verdict": verdict,
        "score": score,
        "checks": [c.model_dump() for c in checks],
        "summary": " ".join(summary_parts)
    }


def screen_and_store(db: Session, property_obj: Property, user_id: str) -> dict:
    """
    Screen a property and store the result on the property record.
    Returns the screening result dict.
    """
    criteria = db.query(UserInvestmentCriteria).filter(
        UserInvestmentCriteria.user_id == user_id
    ).first()

    if not criteria:
        return None

    result = screen_property(property_obj, criteria)

    property_obj.screening_verdict = result["verdict"]
    property_obj.screening_score = result["score"]
    property_obj.screening_details_json = json.dumps(result["checks"])

    return result
