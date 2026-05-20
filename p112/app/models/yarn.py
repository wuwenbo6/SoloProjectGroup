from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func

from app.core.database import Base


class YarnDetection(Base):
    __tablename__ = "yarn_detections"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    file_path = Column(String(500))
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    
    hairiness_detected = Column(Boolean, default=False)
    hairiness_score = Column(Float, default=0.0)
    hairiness_details = Column(Text, nullable=True)
    
    breakage_detected = Column(Boolean, default=False)
    breakage_score = Column(Float, default=0.0)
    breakage_details = Column(Text, nullable=True)
    
    thickness_abnormal = Column(Boolean, default=False)
    thickness_mean = Column(Float, default=0.0)
    thickness_std = Column(Float, default=0.0)
    thickness_details = Column(Text, nullable=True)
    
    density = Column(Float, default=0.0)
    density_std = Column(Float, default=0.0)
    density_abnormal = Column(Boolean, default=False)
    density_details = Column(Text, nullable=True)
    
    overall_status = Column(String(50), default="pending")
    batch_id = Column(String(100), nullable=True, index=True)
    
    image_hash = Column(String(64), nullable=True, index=True)
    feature_vector = Column(Text, nullable=True)
    
    detected_at = Column(DateTime(timezone=True), onupdate=func.now())


class ModelVersion(Base):
    __tablename__ = "model_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), index=True)
    version = Column(String(50))
    file_path = Column(String(500))
    checksum = Column(String(64))
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
