from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict


class YarnDetectionBase(BaseModel):
    filename: str
    batch_id: Optional[str] = None


class YarnDetectionCreate(YarnDetectionBase):
    file_path: str


class HairinessResult(BaseModel):
    detected: bool
    score: float
    details: Optional[str] = None


class BreakageResult(BaseModel):
    detected: bool
    score: float
    details: Optional[str] = None


class ThicknessResult(BaseModel):
    abnormal: bool
    mean: float
    std: float
    details: Optional[str] = None


class DensityResult(BaseModel):
    abnormal: bool
    density: float
    density_std: float
    details: Optional[str] = None


class DetectionResult(BaseModel):
    hairiness: HairinessResult
    breakage: BreakageResult
    thickness: ThicknessResult
    density: DensityResult
    overall_status: str


class YarnDetectionResponse(YarnDetectionBase):
    id: int
    upload_time: datetime
    hairiness_detected: bool
    hairiness_score: float
    hairiness_details: Optional[str]
    breakage_detected: bool
    breakage_score: float
    breakage_details: Optional[str]
    thickness_abnormal: bool
    thickness_mean: float
    thickness_std: float
    thickness_details: Optional[str]
    density: float
    density_std: float
    density_abnormal: bool
    density_details: Optional[str]
    overall_status: str
    image_hash: Optional[str]
    detected_at: Optional[datetime]

    class Config:
        from_attributes = True


class BatchAnalysisResult(BaseModel):
    batch_id: str
    total_count: int
    hairiness_count: int
    breakage_count: int
    thickness_abnormal_count: int
    density_abnormal_count: int
    abnormal_count: int
    normal_count: int
    error_count: int
    average_density: float
    average_thickness: float
    average_hairiness: float
    details: List[YarnDetectionResponse]


class BatchCompareRequest(BaseModel):
    batch_ids: List[str]


class BatchStatistics(BaseModel):
    batch_id: str
    total_count: int
    normal_count: int
    abnormal_count: int
    abnormal_rate: float
    hairiness_rate: float
    breakage_rate: float
    thickness_abnormal_rate: float
    density_abnormal_rate: float
    avg_density: float
    avg_thickness: float
    avg_hairiness_score: float
    avg_breakage_score: float
    first_upload_time: Optional[datetime]
    last_upload_time: Optional[datetime]


class BatchCompareResponse(BaseModel):
    batches: List[BatchStatistics]
    compare_summary: Dict[str, float]


class HistoryQuery(BaseModel):
    page: int = 1
    page_size: int = 20
    batch_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None


class HistoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[YarnDetectionResponse]


class SimilarImage(BaseModel):
    detection_id: int
    filename: str
    batch_id: Optional[str]
    similarity: float
    upload_time: datetime
    has_hairiness: bool
    has_breakage: bool
    has_thickness_abnormal: bool
    has_density_abnormal: bool


class DefectTraceRequest(BaseModel):
    detection_id: int
    top_k: int = 5


class DefectTraceResponse(BaseModel):
    target_detection: YarnDetectionResponse
    similar_defects: List[SimilarImage]
    defect_pattern_analysis: Dict[str, any]


class DensityStatisticsResponse(BaseModel):
    total_samples: int
    avg_density: float
    min_density: float
    max_density: float
    density_std: float
    density_distribution: Dict[str, int]
    abnormal_count: int
    abnormal_rate: float
    batch_density_avg: Optional[Dict[str, float]] = None


class ModelVersionBase(BaseModel):
    model_name: str
    version: str
    description: Optional[str] = None


class ModelVersionResponse(ModelVersionBase):
    id: int
    file_path: str
    checksum: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ModelUpdateRequest(BaseModel):
    model_name: str
    version: str
    description: Optional[str] = None
    auto_activate: bool = True


class ModelUpdateResponse(BaseModel):
    success: bool
    message: str
    version: Optional[str] = None
    previous_version: Optional[str] = None


class ModelStatusResponse(BaseModel):
    current_version: str
    available_versions: List[ModelVersionResponse]
    last_update: Optional[datetime]
    update_available: bool
