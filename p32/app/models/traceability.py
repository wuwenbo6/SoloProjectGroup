from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
from sqlalchemy.sql import func
from app.core.database import BaseTraceability


class RawMaterial(BaseTraceability):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    origin_province = Column(String(50))
    origin_city = Column(String(50))
    origin_village = Column(String(100))
    longitude = Column(Float)
    latitude = Column(Float)
    harvest_date = Column(DateTime)
    collector = Column(String(100))
    description = Column(Text)
    craft_type = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)


class ProcessingStep(BaseTraceability):
    __tablename__ = "processing_steps"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True, nullable=False)
    step_order = Column(Integer, nullable=False)
    step_name = Column(String(100), nullable=False)
    operator = Column(String(100))
    operation_time = Column(DateTime)
    location = Column(String(200))
    equipment = Column(String(200))
    parameters = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TraceabilityChain(BaseTraceability):
    __tablename__ = "traceability_chains"

    id = Column(Integer, primary_key=True, index=True)
    trace_code = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(String(50), index=True, nullable=False)
    material_code = Column(String(50), nullable=False)
    current_stage = Column(String(50))
    status = Column(String(20), default="in_progress")
    meta_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OriginInfo(BaseTraceability):
    __tablename__ = "origin_info"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), index=True, nullable=False)
    land_type = Column(String(50))
    soil_composition = Column(Text)
    climate = Column(String(200))
    altitude = Column(Float)
    annual_rainfall = Column(Float)
    planting_method = Column(String(200))
    fertilizer_used = Column(Text)
    pest_control = Column(Text)
    certification = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
