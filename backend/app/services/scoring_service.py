"""
Scoring Service — Deal Score v2 three-layer architecture

Layer 1: Property Fundamentals (economic occupancy, opex ratio, supply pipeline)
Layer 2: Market Intelligence (cached market sentiment score)
Layer 3: Deal Comp Analysis (comp matching engine)
"""
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.models.scoring import UserScoringWeights
from app.models.property import Property
from app.models.data_bank import PipelineProject, SubmarketInventory
from app.services import comp_matching_service


# ==================== BENCHMARKS ====================

BENCHMARKS = {
    "economic_occupancy": {
        "min": 70.0,
        "low": 80.0,
        "mid": 88.0,
        "high": 93.0,
        "max": 97.0,
        "higher_is_better": True,
    },
    "opex_ratio": {
        "min": 30.0,
        "low": 38.0,
        "mid": 45.0,
        "high": 52.0,
        "max": 65.0,
        "higher_is_better": False,
    },
    "supply_pipeline_pressure": {
        "min": 0.0,
        "low": 2.0,
        "mid": 5.0,
        "high": 8.0,
        "max": 15.0,
        "higher_is_better": False,
    },
}

# ==================== SCORING PRESETS ====================

SCORING_PRESETS = {
    "value_add": {
        "economic_occupancy_weight": 25,
        "opex_ratio_weight": 40,
        "supply_pipeline_weight": 35,
        "layer1_weight": 25,
        "layer2_weight": 15,
        "layer3_weight": 60,
    },
    "cash_flow": {
        "economic_occupancy_weight": 45,
        "opex_ratio_weight": 30,
        "supply_pipeline_weight": 25,
        "layer1_weight": 40,
        "layer2_weight": 25,
        "layer3_weight": 35,
    },
    "core": {
        "economic_occupancy_weight": 40,
        "opex_ratio_weight": 25,
        "supply_pipeline_weight": 35,
        "layer1_weight": 35,
        "layer2_weight": 25,
        "layer3_weight": 40,
    },
    "opportunistic": {
        "economic_occupancy_weight": 20,
        "opex_ratio_weight": 35,
        "supply_pipeline_weight": 45,
        "layer1_weight": 20,
        "layer2_weight": 15,
        "layer3_weight": 65,
    },
}


# ==================== METRIC SCORING ====================

def calculate_metric_score(value: float, metric_name: str) -> float:
    """
    Score a single metric 0-100 using linear interpolation between benchmark ranges.

    Benchmark ranges map to scores:
      min → 0,  low → 25,  mid → 50,  high → 75,  max → 100

    For 'higher_is_better=False' metrics, the scale is inverted:
      min (best) → 100,  max (worst) → 0
    """
    if metric_name not in BENCHMARKS:
        return 50.0  # Unknown metric — neutral

    bench = BENCHMARKS[metric_name]
    mn, low, mid, high, mx = bench["min"], bench["low"], bench["mid"], bench["high"], bench["max"]
    higher_is_better = bench["higher_is_better"]

    # Define breakpoints and their score values
    breakpoints = [mn, low, mid, high, mx]
    scores = [0.0, 25.0, 50.0, 75.0, 100.0]

    if not higher_is_better:
        # Invert: min (best) = 100, max (worst) = 0
        scores = [100.0, 75.0, 50.0, 25.0, 0.0]

    # Clamp to range
    if value <= breakpoints[0]:
        return scores[0]
    if value >= breakpoints[-1]:
        return scores[-1]

    # Linear interpolation between adjacent breakpoints
    for i in range(len(breakpoints) - 1):
        if breakpoints[i] <= value <= breakpoints[i + 1]:
            t = (value - breakpoints[i]) / (breakpoints[i + 1] - breakpoints[i])
            return scores[i] + t * (scores[i + 1] - scores[i])

    return 50.0


# ==================== SUPPLY PIPELINE ====================

def calculate_supply_pipeline_score(
    submarket: str, metro: str, user_id: str, db: Session
) -> dict:
    """
    Calculate supply pipeline pressure for a submarket.
    Queries PipelineProject records, weights by status, divides by inventory.
    """
    # Query pipeline projects matching this submarket.
    # Pipeline projects may store location in submarket or metro field,
    # so check both against the property's submarket value.
    from sqlalchemy import or_
    query = db.query(PipelineProject).filter(
        PipelineProject.user_id == user_id,
        or_(
            PipelineProject.submarket == submarket,
            PipelineProject.metro == submarket,
        ),
    )
    projects = query.all()

    # Weight by status
    status_weights = {
        "lease_up": 1.0,
        "under_construction": 0.8,
        "proposed": 0.3,
    }

    lease_up_units = 0
    uc_units = 0
    proposed_units = 0
    weighted_pipeline_units = 0.0

    for proj in projects:
        units = proj.units or 0
        weight = status_weights.get(proj.status, 0.5)
        weighted_pipeline_units += units * weight

        if proj.status == "lease_up":
            lease_up_units += units
        elif proj.status == "under_construction":
            uc_units += units
        elif proj.status == "proposed":
            proposed_units += units

    # Look up submarket inventory
    inventory = db.query(SubmarketInventory).filter(
        SubmarketInventory.user_id == user_id,
        SubmarketInventory.submarket == submarket,
    ).first()

    if not inventory or not inventory.total_units:
        # No inventory data — return neutral score with context
        return {
            "value": None,
            "raw_score": 50.0,
            "context": "No submarket inventory data — using default score",
            "breakdown": {
                "lease_up_units": lease_up_units,
                "under_construction_units": uc_units,
                "proposed_units": proposed_units,
                "weighted_pipeline_units": round(weighted_pipeline_units, 0),
                "total_inventory": None,
            },
        }

    # Pipeline pressure = weighted pipeline / total inventory × 100
    pipeline_pct = (weighted_pipeline_units / inventory.total_units) * 100.0
    raw_score = calculate_metric_score(pipeline_pct, "supply_pipeline_pressure")

    return {
        "value": round(pipeline_pct, 2),
        "raw_score": round(raw_score, 1),
        "context": f"{pipeline_pct:.1f}% of submarket inventory in pipeline",
        "breakdown": {
            "lease_up_units": lease_up_units,
            "under_construction_units": uc_units,
            "proposed_units": proposed_units,
            "weighted_pipeline_units": round(weighted_pipeline_units, 0),
            "total_inventory": inventory.total_units,
        },
    }


# ==================== DEAL SCORE CALCULATION ====================

def calculate_deal_score(
    property_data: dict,
    weights: UserScoringWeights,
    user_id: str,
    db: Session,
) -> dict:
    """
    Calculate the full three-layer Deal Score for a property.

    Layer 1: Property Fundamentals — economic occupancy, opex ratio, supply pipeline
    Layer 2: Market Intelligence — cached market sentiment
    Layer 3: Deal Comp Analysis — comp matching engine
    """
    warnings = []

    # ===== LAYER 1: Property Fundamentals =====
    layer1_metrics = {}

    # Economic occupancy
    econ_occ = property_data.get("economic_occupancy")
    if econ_occ is not None:
        econ_score = calculate_metric_score(econ_occ, "economic_occupancy")
        layer1_metrics["economic_occupancy"] = {
            "value": econ_occ,
            "raw_score": round(econ_score, 1),
            "weight": weights.economic_occupancy_weight,
            "weighted_score": round(econ_score * weights.economic_occupancy_weight / 100, 1),
            "context": f"Economic occupancy at {econ_occ:.1f}%",
        }
    else:
        layer1_metrics["economic_occupancy"] = {
            "value": None,
            "raw_score": None,
            "weight": weights.economic_occupancy_weight,
            "weighted_score": None,
            "context": "No economic occupancy data available",
        }
        warnings.append("Missing economic occupancy data")

    # OpEx ratio
    opex = property_data.get("opex_ratio")
    if opex is not None:
        opex_score = calculate_metric_score(opex, "opex_ratio")
        layer1_metrics["opex_ratio"] = {
            "value": opex,
            "raw_score": round(opex_score, 1),
            "weight": weights.opex_ratio_weight,
            "weighted_score": round(opex_score * weights.opex_ratio_weight / 100, 1),
            "context": f"OpEx ratio at {opex:.1f}%",
        }
    else:
        layer1_metrics["opex_ratio"] = {
            "value": None,
            "raw_score": None,
            "weight": weights.opex_ratio_weight,
            "weighted_score": None,
            "context": "No OpEx ratio data available",
        }
        warnings.append("Missing OpEx ratio data")

    # Supply pipeline
    submarket = property_data.get("submarket", "")
    metro = property_data.get("metro", "")
    if submarket:
        pipeline = calculate_supply_pipeline_score(submarket, metro, user_id, db)
        layer1_metrics["supply_pipeline"] = {
            "value": pipeline["value"],
            "raw_score": pipeline["raw_score"],
            "weight": weights.supply_pipeline_weight,
            "weighted_score": round(pipeline["raw_score"] * weights.supply_pipeline_weight / 100, 1),
            "context": pipeline["context"],
        }
    else:
        layer1_metrics["supply_pipeline"] = {
            "value": None,
            "raw_score": 50.0,
            "weight": weights.supply_pipeline_weight,
            "weighted_score": round(50.0 * weights.supply_pipeline_weight / 100, 1),
            "context": "No submarket specified — using default score",
        }

    # Calculate Layer 1 composite score
    l1_total_weight = 0
    l1_weighted_sum = 0.0
    for m in layer1_metrics.values():
        if m["raw_score"] is not None:
            l1_weighted_sum += m["raw_score"] * m["weight"]
            l1_total_weight += m["weight"]

    layer1_score = (l1_weighted_sum / l1_total_weight) if l1_total_weight > 0 else None

    # Lease-up detection: if economic_occupancy < 75%, apply 0.85× confidence discount
    if econ_occ is not None and econ_occ < 75.0 and layer1_score is not None:
        layer1_score *= 0.85
        warnings.append("Lease-up detected (occupancy < 75%) — Layer 1 confidence discounted by 15%")

    # ===== LAYER 2: Market Intelligence =====
    market_score_val = property_data.get("market_sentiment_score")
    layer2_metrics = {}

    if market_score_val is not None:
        # Convert -10 to +10 range to 0-100 scale
        l2_normalized = ((market_score_val + 10) / 20) * 100
        layer2_metrics["market_sentiment"] = {
            "value": market_score_val,
            "raw_score": round(l2_normalized, 1),
            "weight": 100,
            "weighted_score": round(l2_normalized, 1),
            "context": property_data.get("market_sentiment_rationale", ""),
        }
        layer2_score = l2_normalized
    else:
        layer2_metrics["market_sentiment"] = {
            "value": None,
            "raw_score": None,
            "weight": 100,
            "weighted_score": None,
            "context": "No market intelligence data — Phase 4",
        }
        layer2_score = None
        warnings.append("No market intelligence data available")

    # ===== LAYER 3: Deal Comp Analysis =====
    subject_for_comps = {
        "submarket": submarket,
        "county": property_data.get("county", ""),
        "property_type": property_data.get("property_type", ""),
        "year_built": property_data.get("year_built"),
        "total_units": property_data.get("total_units"),
        "cap_rate": property_data.get("cap_rate"),
        "price_per_unit": property_data.get("price_per_unit"),
    }

    layer3_result = comp_matching_service.calculate_layer3_score(subject_for_comps, user_id, db)
    layer3_score = layer3_result.get("score")

    layer3_metrics = {}
    for k, v in layer3_result.get("metrics", {}).items():
        layer3_metrics[k] = {
            "value": v.get("raw_score"),
            "raw_score": v.get("raw_score"),
            "weight": {"cap_rate": 35, "price_per_unit": 40, "vintage": 25}.get(k, 0),
            "weighted_score": None,
            "context": v.get("context", ""),
        }

    if not layer3_score:
        warnings.append("No comp data available for Layer 3 analysis")

    # ===== WEIGHT REDISTRIBUTION =====
    effective_l1_weight = weights.layer1_weight
    effective_l2_weight = weights.layer2_weight
    effective_l3_weight = weights.layer3_weight

    # If no comp data → redistribute Layer 3 weight to Layers 1+2
    if layer3_score is None:
        if layer2_score is not None:
            # Split Layer 3 weight proportionally between L1 and L2
            ratio_l1 = effective_l1_weight / (effective_l1_weight + effective_l2_weight) if (effective_l1_weight + effective_l2_weight) > 0 else 0.5
            effective_l1_weight += int(effective_l3_weight * ratio_l1)
            effective_l2_weight += effective_l3_weight - int(effective_l3_weight * ratio_l1)
        else:
            # Both L2 and L3 unavailable — all weight to L1
            effective_l1_weight += effective_l3_weight
        effective_l3_weight = 0
        warnings.append("Layer 3 weight redistributed (no comp data)")

    # If no market intel → redistribute Layer 2 weight to Layer 1
    if layer2_score is None:
        effective_l1_weight += effective_l2_weight
        effective_l2_weight = 0
        warnings.append("Layer 2 weight redistributed (no market intelligence)")

    # ===== TOTAL SCORE =====
    total_weight = 0
    total_weighted = 0.0

    if layer1_score is not None and effective_l1_weight > 0:
        total_weighted += layer1_score * effective_l1_weight
        total_weight += effective_l1_weight

    if layer2_score is not None and effective_l2_weight > 0:
        total_weighted += layer2_score * effective_l2_weight
        total_weight += effective_l2_weight

    if layer3_score is not None and effective_l3_weight > 0:
        total_weighted += layer3_score * effective_l3_weight
        total_weight += effective_l3_weight

    total_score = round(total_weighted / total_weight, 1) if total_weight > 0 else None

    # Determine confidence
    if layer3_score is not None and layer2_score is not None:
        confidence = "high"
    elif layer1_score is not None:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "total_score": total_score,
        "layer_scores": {
            "property_fundamentals": {
                "score": round(layer1_score, 1) if layer1_score is not None else None,
                "weight": effective_l1_weight,
                "weighted_contribution": round(layer1_score * effective_l1_weight / 100, 1) if layer1_score is not None and effective_l1_weight > 0 else None,
                "metrics": layer1_metrics,
            },
            "market_intelligence": {
                "score": round(layer2_score, 1) if layer2_score is not None else None,
                "weight": effective_l2_weight,
                "weighted_contribution": round(layer2_score * effective_l2_weight / 100, 1) if layer2_score is not None and effective_l2_weight > 0 else None,
                "metrics": layer2_metrics,
            },
            "deal_comp_analysis": {
                "score": round(layer3_score, 1) if layer3_score is not None else None,
                "weight": effective_l3_weight,
                "weighted_contribution": round(layer3_score * effective_l3_weight / 100, 1) if layer3_score is not None and effective_l3_weight > 0 else None,
                "metrics": layer3_metrics,
                "comps_used": layer3_result.get("comps_used", []),
            },
        },
        "confidence": confidence,
        "warnings": warnings,
    }


# ==================== WEIGHT CRUD ====================

def get_user_weights(user_id: str, db: Session) -> UserScoringWeights:
    """Get user's scoring weights, creating defaults if none exist."""
    weights = db.query(UserScoringWeights).filter(
        UserScoringWeights.user_id == user_id
    ).first()

    if not weights:
        weights = UserScoringWeights(user_id=user_id)
        db.add(weights)
        db.commit()
        db.refresh(weights)

    return weights


def update_user_weights(user_id: str, weights_dict: dict, db: Session) -> UserScoringWeights:
    """Update user's scoring weights with provided values."""
    weights = get_user_weights(user_id, db)

    for key, value in weights_dict.items():
        if hasattr(weights, key) and value is not None:
            setattr(weights, key, value)

    # Clear preset if custom weights are set
    if "preset_name" not in weights_dict:
        weights.preset_name = None

    db.commit()
    db.refresh(weights)
    return weights


def apply_preset(user_id: str, preset_name: str, db: Session) -> UserScoringWeights:
    """Apply a scoring preset to user's weights."""
    if preset_name not in SCORING_PRESETS:
        raise ValueError(f"Unknown preset: {preset_name}")

    preset = SCORING_PRESETS[preset_name]
    weights = get_user_weights(user_id, db)

    for key, value in preset.items():
        setattr(weights, key, value)

    weights.preset_name = preset_name
    db.commit()
    db.refresh(weights)
    return weights


def _extract_property_data(prop: Property, db: Optional[Session] = None) -> dict:
    """Extract scoring-relevant data from a Property model instance."""
    from app.models.deal_folder import BOVPricingTier, BOVCapRate

    data = {
        "property_type": prop.property_type,
        "submarket": prop.submarket,
        "county": "",
        "year_built": prop.year_built,
        "total_units": prop.total_units,
        "market_sentiment_score": prop.market_sentiment_score,
        "market_sentiment_rationale": prop.market_sentiment_rationale,
    }

    # Parse financials for economic occupancy and opex ratio
    # Try T12 first, then Y1, then direct property columns
    for financials_json in [prop.t12_financials_json, prop.y1_financials_json]:
        if financials_json and "economic_occupancy" not in data:
            try:
                fin = json.loads(financials_json) if isinstance(financials_json, str) else financials_json
                gsr = fin.get("gsr")
                if gsr and gsr > 0:
                    vacancy = fin.get("vacancy") or 0
                    concessions = fin.get("concessions") or 0
                    bad_debt = fin.get("bad_debt") or 0
                    egi = gsr - vacancy - concessions - bad_debt
                    data["economic_occupancy"] = (egi / gsr) * 100
            except (json.JSONDecodeError, TypeError):
                pass

    for financials_json in [prop.t12_financials_json, prop.y1_financials_json]:
        if financials_json and "opex_ratio" not in data:
            try:
                fin = json.loads(financials_json) if isinstance(financials_json, str) else financials_json
                opex_ratio = fin.get("opex_ratio")
                if opex_ratio is not None:
                    data["opex_ratio"] = opex_ratio
                else:
                    gsr = fin.get("gsr")
                    if gsr and gsr > 0 and fin.get("total_opex"):
                        data["opex_ratio"] = (fin["total_opex"] / gsr) * 100
            except (json.JSONDecodeError, TypeError):
                pass

    # Fallback to direct property columns for expense ratio
    if "opex_ratio" not in data:
        for attr in ["t12_expense_ratio_pct", "y1_expense_ratio_pct"]:
            val = getattr(prop, attr, None)
            if val is not None:
                data["opex_ratio"] = float(val)
                break

    # Extract cap_rate and price_per_unit from BOV pricing tiers if available
    if db is not None:
        try:
            tier = db.query(BOVPricingTier).filter(
                BOVPricingTier.property_id == prop.id,
            ).first()

            if tier:
                if tier.price_per_unit:
                    data["price_per_unit"] = float(tier.price_per_unit)

                # Get first available cap rate for this tier
                cap = db.query(BOVCapRate).filter(
                    BOVCapRate.pricing_tier_id == tier.id,
                ).first()
                if cap and cap.cap_rate_value:
                    # BOV cap rates stored as percentage (4.75) → convert to decimal (0.0475)
                    data["cap_rate"] = float(cap.cap_rate_value) / 100.0
        except Exception:
            pass

    return data
