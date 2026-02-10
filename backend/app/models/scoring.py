"""
Scoring models for Deal Score v2 three-layer architecture
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class UserScoringWeights(Base):
    """User-configurable scoring weights for the three-layer Deal Score system"""
    __tablename__ = "user_scoring_weights"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)

    # Layer 1 metric weights (must sum to 100)
    economic_occupancy_weight = Column(Integer, default=35, nullable=False)
    opex_ratio_weight = Column(Integer, default=30, nullable=False)
    supply_pipeline_weight = Column(Integer, default=35, nullable=False)

    # Layer weights (must sum to 100)
    layer1_weight = Column(Integer, default=30, nullable=False)  # Property Fundamentals
    layer2_weight = Column(Integer, default=20, nullable=False)  # Market Intelligence
    layer3_weight = Column(Integer, default=50, nullable=False)  # Deal Comp Analysis

    # Preset tracking
    preset_name = Column(String(50), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<UserScoringWeights(user_id={self.user_id}, preset={self.preset_name})>"
