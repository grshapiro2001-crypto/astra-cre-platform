"""
BOV service - Database operations for BOV pricing tiers (NO LLM CALLS)

CRITICAL: This service is for read/write operations to the database.
It does NOT call the LLM or re-analyze PDFs.
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.deal_folder import BOVPricingTier, BOVCapRate


def save_bov_pricing_tiers(
    db: Session,
    property_id: int,
    bov_tiers: List[Dict[str, Any]]
) -> List[BOVPricingTier]:
    """
    Save BOV pricing tiers and associated cap rates to database (NO LLM CALLS)

    This function:
    - Creates BOVPricingTier records for each tier
    - Creates BOVCapRate records for each cap rate within each tier
    - Links everything together with foreign keys
    - Does NOT call LLM
    - Does NOT re-read PDF

    Args:
        db: Database session
        property_id: Property ID to link tiers to
        bov_tiers: List of tier dictionaries from Claude extraction

    Returns:
        List of created BOVPricingTier objects
    """
    created_tiers = []

    for tier_data in bov_tiers:
        # Extract loan assumptions
        loan_assumptions = tier_data.get('loan_assumptions') or {}

        # Extract return metrics
        return_metrics = tier_data.get('return_metrics') or {}

        # Extract terminal assumptions
        terminal_assumptions = tier_data.get('terminal_assumptions') or {}

        # Create pricing tier
        tier = BOVPricingTier(
            property_id=property_id,
            pricing_tier_id=tier_data.get('pricing_tier_id'),
            tier_label=tier_data.get('tier_label'),
            tier_type=tier_data.get('tier_type'),

            # Pricing fields
            pricing=tier_data.get('pricing'),
            price_per_unit=tier_data.get('price_per_unit'),
            price_per_sf=tier_data.get('price_per_sf'),

            # Loan assumptions
            leverage=loan_assumptions.get('leverage'),
            loan_amount=loan_assumptions.get('loan_amount'),
            interest_rate=loan_assumptions.get('interest_rate'),
            io_period_months=loan_assumptions.get('io_period_months'),
            amortization_years=loan_assumptions.get('amortization_years'),

            # Return metrics
            unlevered_irr=return_metrics.get('unlevered_irr'),
            levered_irr=return_metrics.get('levered_irr'),
            equity_multiple=return_metrics.get('equity_multiple'),
            avg_cash_on_cash=return_metrics.get('avg_cash_on_cash'),

            # Terminal assumptions
            terminal_cap_rate=terminal_assumptions.get('terminal_cap_rate'),
            hold_period_years=terminal_assumptions.get('hold_period_years')
        )

        db.add(tier)
        db.flush()  # Get ID without committing

        # Create cap rates for this tier
        cap_rates = tier_data.get('cap_rates') or []
        for cap_rate_data in cap_rates:
            cap_rate = BOVCapRate(
                pricing_tier_id=tier.id,
                cap_rate_type=cap_rate_data.get('cap_rate_type'),
                cap_rate_value=cap_rate_data.get('cap_rate_value'),
                noi_basis=cap_rate_data.get('noi_basis'),
                qualifier=cap_rate_data.get('qualifier')
            )
            db.add(cap_rate)

        created_tiers.append(tier)

    db.commit()
    return created_tiers


def get_bov_pricing_tiers(
    db: Session,
    property_id: int
) -> List[Dict[str, Any]]:
    """
    Get all BOV pricing tiers and cap rates for a property (NO LLM CALLS)

    Args:
        db: Database session
        property_id: Property ID

    Returns:
        List of tier dictionaries with nested cap rates
    """
    tiers = db.query(BOVPricingTier).filter(
        BOVPricingTier.property_id == property_id
    ).all()

    result = []
    for tier in tiers:
        # Get cap rates for this tier
        cap_rates = db.query(BOVCapRate).filter(
            BOVCapRate.pricing_tier_id == tier.id
        ).all()

        tier_dict = {
            'id': tier.id,
            'pricing_tier_id': tier.pricing_tier_id,
            'tier_label': tier.tier_label,
            'tier_type': tier.tier_type,

            # Pricing
            'pricing': tier.pricing,
            'price_per_unit': tier.price_per_unit,
            'price_per_sf': tier.price_per_sf,

            # Loan assumptions
            'loan_assumptions': {
                'leverage': tier.leverage,
                'loan_amount': tier.loan_amount,
                'interest_rate': tier.interest_rate,
                'io_period_months': tier.io_period_months,
                'amortization_years': tier.amortization_years
            },

            # Return metrics
            'return_metrics': {
                'unlevered_irr': tier.unlevered_irr,
                'levered_irr': tier.levered_irr,
                'equity_multiple': tier.equity_multiple,
                'avg_cash_on_cash': tier.avg_cash_on_cash
            },

            # Terminal assumptions
            'terminal_assumptions': {
                'terminal_cap_rate': tier.terminal_cap_rate,
                'hold_period_years': tier.hold_period_years
            },

            # Cap rates
            'cap_rates': [
                {
                    'cap_rate_type': cr.cap_rate_type,
                    'cap_rate_value': cr.cap_rate_value,
                    'noi_basis': cr.noi_basis,
                    'qualifier': cr.qualifier
                }
                for cr in cap_rates
            ]
        }

        result.append(tier_dict)

    return result


def delete_bov_pricing_tiers(
    db: Session,
    property_id: int
) -> bool:
    """
    Delete all BOV pricing tiers for a property (NO LLM CALLS)

    Cap rates are cascade deleted automatically.

    Args:
        db: Database session
        property_id: Property ID

    Returns:
        True if tiers were deleted
    """
    db.query(BOVPricingTier).filter(
        BOVPricingTier.property_id == property_id
    ).delete()

    db.commit()
    return True
