from sqlalchemy import Boolean, Column, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

# Admin emails — hardcoded for demo phase
ADMIN_EMAILS = ['griffinshapiro11182001@gmail.com', 'grshap2001@gmail.com']


class User(Base):
    __tablename__ = "users"

    # Use String for UUID to support both SQLite and PostgreSQL
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    # Demo approval gate: pending → active → suspended
    account_status = Column(String(20), nullable=False, default="pending")
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    org_memberships = relationship("OrganizationMember", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
