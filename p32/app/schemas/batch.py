from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MaterialBatchBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: Optional[str] = Field(None, max_length=100)
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    shelf_life_days: Optional[int] = Field(365, ge=1)
    quantity: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=30)
    warehouse: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    producer: Optional[str] = Field(None, max_length=100)
    supervisor: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("produced", max_length=20)
    grade: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None


class MaterialBatchCreate(MaterialBatchBase):
    batch_id: str = Field(..., max_length=50)


class MaterialBatchUpdate(BaseModel):
    material_code: Optional[str] = Field(None, max_length=50)
    material_name: Optional[str] = Field(None, max_length=100)
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    shelf_life_days: Optional[int] = Field(None, ge=1)
    quantity: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=30)
    warehouse: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    producer: Optional[str] = Field(None, max_length=100)
    supervisor: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=20)
    grade: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    warning_status: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class MaterialBatchResponse(MaterialBatchBase):
    id: int
    batch_id: str
    trace_code: Optional[str] = None
    warning_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class ExpiryWarningResponse(BaseModel):
    batch_id: str
    material_code: str
    material_name: str
    production_date: Optional[datetime]
    expiry_date: Optional[datetime]
    days_until_expiry: int
    warning_level: str
    quantity: Optional[float]
    unit: Optional[str]
    warehouse: Optional[str]


class BatchEventBase(BaseModel):
    batch_id: str = Field(..., max_length=50)
    event_type: str = Field(..., max_length=50)
    event_title: str = Field(..., max_length=200)
    event_description: Optional[str] = None
    operator: Optional[str] = Field(None, max_length=100)
    event_time: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    metadata: Optional[str] = None


class BatchEventCreate(BatchEventBase):
    pass


class BatchEventResponse(BatchEventBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryRecordBase(BaseModel):
    batch_id: str = Field(..., max_length=50)
    record_type: str = Field(..., max_length=20)
    quantity: float
    unit: Optional[str] = Field(None, max_length=30)
    warehouse: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    operator: Optional[str] = Field(None, max_length=100)
    related_order: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = None
    record_time: Optional[datetime] = None


class InventoryRecordCreate(InventoryRecordBase):
    pass


class InventoryRecordResponse(InventoryRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TraceCodeCreate(BaseModel):
    batch_id: str = Field(..., max_length=50)
    code_type: Optional[str] = Field("qrcode", max_length=30)
    generated_by: Optional[str] = Field(None, max_length=100)


class TraceCodeVerify(BaseModel):
    trace_code: str = Field(..., max_length=100)


class TraceCodeResponse(BaseModel):
    trace_code: str
    batch_id: str
    code_type: str
    generated_at: datetime
    is_used: bool
    used_at: Optional[datetime] = None
    query_count: int
    status: str

    class Config:
        from_attributes = True


class TraceCodeFullResponse(BaseModel):
    trace_code: str
    valid: bool
    batch_info: Optional[MaterialBatchResponse] = None
    material_info: Optional[dict] = None
    quality_info: Optional[dict] = None
    processing_steps: Optional[List[dict]] = None
    query_count: int
