"""
UserScoringWeights model - stores per-user scoring weight preferences
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class UserScoringWeights(Base):
    """Per-user scoring weight configuration for deal scoring"""
    __tablename__ = "user_scoring_weights"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)

    # Weights must sum to 1.0
    weight_cap_rate = Column(Float, nullable=False, default=0.30)
    weight_economic_occupancy = Column(Float, nullable=False, default=0.25)
    weight_loss_to_lease = Column(Float, nullable=False, default=0.20)
    weight_opex_ratio = Column(Float, nullable=False, default=0.25)

    # Optional preset name (e.g., "balanced", "income_focused", "value_add", "stabilized")
    preset_name = Column(String(50), nullable=True, default="balanced")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
