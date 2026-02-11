"""
UserInvestmentCriteria model for deal screening
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class UserInvestmentCriteria(Base):
    """Stores user-defined investment criteria for automatic deal screening"""
    __tablename__ = "user_investment_criteria"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    criteria_name = Column(String, default="Default Criteria")

    # Property Filters
    min_units = Column(Integer, nullable=True)
    max_units = Column(Integer, nullable=True)
    property_types = Column(String, nullable=True)  # comma-separated: "Multifamily,Mixed-Use"
    target_markets = Column(String, nullable=True)  # comma-separated: "Atlanta,Dallas,Charlotte"
    min_year_built = Column(Integer, nullable=True)

    # Financial Thresholds
    min_cap_rate = Column(Float, nullable=True)
    max_cap_rate = Column(Float, nullable=True)
    min_economic_occupancy = Column(Float, nullable=True)
    max_opex_ratio = Column(Float, nullable=True)
    min_noi = Column(Float, nullable=True)
    max_price_per_unit = Column(Float, nullable=True)

    # Deal Score
    min_deal_score = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
