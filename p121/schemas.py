from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class FiberRatio(BaseModel):
    cotton: float
    polyester: float
    wool: float
    silk: float
    other: float


class ImpurityDetail(BaseModel):
    type: str
    count: int
    area: float


class AnalysisResult(BaseModel):
    fiber_ratio: FiberRatio
    strength: float
    impurity_count: int
    impurity_details: List[ImpurityDetail]


class AnalysisRecordResponse(BaseModel):
    id: int
    filename: str
    fiber_type_ratio: Any
    strength: float
    impurity_count: int
    created_at: datetime
    batch_id: Optional[str] = None

    class Config:
        orm_mode = True


class BatchAnalysisResponse(BaseModel):
    batch_id: str
    total_files: int
    total_errors: int
    errors: List[str]
    results: List[AnalysisRecordResponse]


class HistoryQuery(BaseModel):
    skip: int = 0
    limit: int = 50
    batch_id: Optional[str] = None
