"""
Data Bank models for uploaded Excel files, sales comps, pipeline projects, and submarket inventory
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class DataBankDocument(Base):
    """Tracks uploaded Excel files for the Data Bank"""
    __tablename__ = "data_bank_documents"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    document_type = Column(String(50), nullable=False)  # sales_comps, pipeline_tracker, underwriting_model
    extraction_status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed, failed
    extraction_data = Column(Text, nullable=True)  # JSON
    record_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<DataBankDocument(id={self.id}, type={self.document_type}, status={self.extraction_status})>"


class SalesComp(Base):
    """Extracted sales comp records from uploaded documents"""
    __tablename__ = "sales_comps"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    document_id = Column(Integer, ForeignKey("data_bank_documents.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Property identification
    property_name = Column(String(255), nullable=True)
    market = Column(String(255), nullable=True)
    metro = Column(String(255), nullable=True)
    submarket = Column(String(255), nullable=True)
    county = Column(String(255), nullable=True)
    state = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)

    # Property details
    property_type = Column(String(100), nullable=True)
    sale_date = Column(DateTime(timezone=True), nullable=True)
    year_built = Column(Integer, nullable=True)
    year_renovated = Column(Integer, nullable=True)
    units = Column(Integer, nullable=True)
    avg_unit_sf = Column(Float, nullable=True)

    # Financial data
    avg_eff_rent = Column(Float, nullable=True)
    sale_price = Column(Float, nullable=True)
    price_per_unit = Column(Float, nullable=True)
    price_per_sf = Column(Float, nullable=True)
    cap_rate = Column(Float, nullable=True)  # Stored as decimal, e.g. 0.055
    cap_rate_qualifier = Column(String(50), nullable=True)
    occupancy = Column(Float, nullable=True)

    # Transaction parties
    buyer = Column(String(255), nullable=True)
    seller = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<SalesComp(id={self.id}, property={self.property_name}, cap_rate={self.cap_rate})>"


class PipelineProject(Base):
    """Extracted pipeline/development project records"""
    __tablename__ = "pipeline_projects"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    document_id = Column(Integer, ForeignKey("data_bank_documents.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Project identification
    project_name = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    county = Column(String(255), nullable=True)
    metro = Column(String(255), nullable=True)
    submarket = Column(String(255), nullable=True)

    # Project details
    units = Column(Integer, nullable=True)
    status = Column(String(50), nullable=True)  # lease_up, under_construction, proposed
    developer = Column(String(255), nullable=True)
    delivery_quarter = Column(String(20), nullable=True)  # e.g. "Q2 2026"
    start_quarter = Column(String(20), nullable=True)
    property_type = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<PipelineProject(id={self.id}, name={self.project_name}, status={self.status})>"


class SubmarketInventory(Base):
    """User-input inventory denominators for supply pipeline calculations"""
    __tablename__ = "submarket_inventory"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    metro = Column(String(255), nullable=False)
    submarket = Column(String(255), nullable=False)
    total_units = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<SubmarketInventory(metro={self.metro}, submarket={self.submarket}, units={self.total_units})>"
