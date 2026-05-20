from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    original_path = Column(String(255), nullable=False)
    repaired_path = Column(String(255), nullable=True)
    thumbnail_path = Column(String(255), nullable=True)
    title = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    is_public = Column(Boolean, default=False)
    share_token = Column(String(50), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
