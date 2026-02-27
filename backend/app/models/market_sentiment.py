"""
Market Sentiment Signal model for extracted market research intelligence
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class MarketSentimentSignal(Base):
    """Individual sentiment signal extracted from a market research PDF"""
    __tablename__ = "market_sentiment_signals"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    document_id = Column(Integer, ForeignKey("data_bank_documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)

    # Signal classification
    # Valid values: absorption, supply_pipeline, construction_starts, rent_growth,
    # occupancy, concessions, employment, population, cap_rate_trend,
    # buyer_demand, seller_motivation, debt_market, regulatory, other
    signal_type = Column(String(100), nullable=False)

    # Geography
    geography_source_label = Column(String(255), nullable=True)  # exact label from document
    geography_metro = Column(String(255), nullable=True, index=True)  # normalized MSA name
    geography_submarket = Column(String(255), nullable=True)  # normalized submarket if available

    # Signal strength
    direction = Column(String(20), nullable=False)   # positive, negative, neutral, mixed
    magnitude = Column(String(20), nullable=False)    # strong, moderate, slight

    # Data
    time_reference = Column(String(100), nullable=True)       # "Q4 2025", "YTD 2025", "trailing 12 months"
    quantitative_value = Column(String(255), nullable=True)   # "20,732 units", "-35% YoY", "4.5% cap"
    narrative_summary = Column(Text, nullable=False)           # one sentence plain-English summary
    verbatim_excerpt = Column(String(500), nullable=True)     # short source quote for attribution (< 50 words)

    confidence = Column(String(20), default="medium")  # high, medium, low

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
