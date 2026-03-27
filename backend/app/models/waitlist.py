from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class WaitlistEntry(Base):
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    source = Column(String(100), nullable=True, default="landing_page")
    signed_up_at = Column(DateTime(timezone=True), server_default=func.now())
