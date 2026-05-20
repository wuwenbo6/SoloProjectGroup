from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any


class RepairRecordBase(BaseModel):
    photo_id: int
    repair_type: str
    parameters: Optional[Dict[str, Any]] = None


class RepairRecordCreate(RepairRecordBase):
    pass


class RepairRecordUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[float] = None
    error_message: Optional[str] = None


class RepairRecord(RepairRecordBase):
    id: int
    user_id: int
    status: str
    progress: float
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
