from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class SegyFileBase(BaseModel):
    filename: str
    description: Optional[str] = None


class SegyFileCreate(SegyFileBase):
    pass


class SegyFileResponse(SegyFileBase):
    id: int
    file_path: str
    file_size: int
    sample_count: int
    trace_count: int
    inline_count: int
    crossline_count: int
    sample_interval: float
    min_amplitude: float
    max_amplitude: float
    mean_amplitude: float
    std_amplitude: float
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AnnotationBase(BaseModel):
    annotation_type: str
    inline_start: Optional[int] = None
    inline_end: Optional[int] = None
    crossline_start: Optional[int] = None
    crossline_end: Optional[int] = None
    time_start: Optional[float] = None
    time_end: Optional[float] = None
    label: str
    description: Optional[str] = None


class AnnotationCreate(AnnotationBase):
    segy_file_id: int


class AnnotationResponse(AnnotationBase):
    id: int
    segy_file_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileInfoResponse(BaseModel):
    file: SegyFileResponse
    inlines: List[int]
    crosslines: List[int]


class HistogramResponse(BaseModel):
    histogram: List[int]
    bin_edges: List[float]
    min_amplitude: float
    max_amplitude: float
    bin_count: int
