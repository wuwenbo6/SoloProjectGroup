from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
from sqlalchemy.sql import func
from app.core.database import BaseBatch


class MaterialBatch(BaseBatch):
    __tablename__ = "material_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, index=True, nullable=False)
    material_code = Column(String(50), index=True, nullable=False)
    material_name = Column(String(100))
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    shelf_life_days = Column(Integer, default=365)
    quantity = Column(Float)
    unit = Column(String(30))
    warehouse = Column(String(100))
    location = Column(String(200))
    producer = Column(String(100))
    supervisor = Column(String(100))
    status = Column(String(20), default="produced")
    grade = Column(String(20))
    trace_code = Column(String(100))
    description = Column(Text)
    warning_status = Column(String(20), default="normal")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)


class BatchEvent(BaseBatch):
    __tablename__ = "batch_events"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    event_title = Column(String(200))
    event_description = Column(Text)
    operator = Column(String(100))
    event_time = Column(DateTime)
    location = Column(String(200))
    meta_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryRecord(BaseBatch):
    __tablename__ = "inventory_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True, nullable=False)
    record_type = Column(String(20), nullable=False)
    quantity = Column(Float)
    unit = Column(String(30))
    warehouse = Column(String(100))
    location = Column(String(200))
    operator = Column(String(100))
    related_order = Column(String(100))
    remarks = Column(Text)
    record_time = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TraceCode(BaseBatch):
    __tablename__ = "trace_codes"

    id = Column(Integer, primary_key=True, index=True)
    trace_code = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(String(50), index=True, nullable=False)
    code_type = Column(String(30), default="qrcode")
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String(100))
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime)
    query_count = Column(Integer, default=0)
    last_query_at = Column(DateTime)
    status = Column(String(20), default="active")
    meta_data = Column(Text)
