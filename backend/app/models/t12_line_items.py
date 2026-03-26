"""
T12 Line Items model — stores individual line items from T12 Excel extraction
for user-driven categorization in the T12 Mapping UI.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, func

from app.database import Base


class T12LineItem(Base):
    __tablename__ = "t12_line_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)

    # Raw data from Excel extraction
    raw_label = Column(String, nullable=False)
    gl_code = Column(String, nullable=True)
    section = Column(String, nullable=False)              # "revenue" or "expense"
    subsection = Column(String, nullable=True)
    row_index = Column(Integer, nullable=False)
    is_subtotal = Column(Boolean, default=False)
    is_section_header = Column(Boolean, default=False)

    # Financial values
    monthly_values = Column(Text, nullable=True)          # JSON string: {"Jan": 1234.56, ...}
    annual_total = Column(Float, nullable=True)
    t1_value = Column(Float, nullable=True)
    t2_value = Column(Float, nullable=True)
    t3_value = Column(Float, nullable=True)

    # Categorization
    mapped_category = Column(String, nullable=True)
    auto_confidence = Column(Float, nullable=True)        # 0-1 confidence score
    user_confirmed = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
