from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from database import Base
import datetime


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    fiber_type_ratio = Column(String)
    strength = Column(Float)
    strength_level = Column(String, index=True)
    impurity_count = Column(Integer)
    impurity_details = Column(Text)
    impurity_source = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    batch_id = Column(String, index=True, nullable=True)


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, index=True)
    strength_thresholds = Column(String)
    impurity_classifier = Column(String)
    fiber_color_ranges = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Integer, default=0)
    description = Column(String)
