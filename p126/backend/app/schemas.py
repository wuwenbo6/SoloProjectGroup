from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class StainInfo(BaseModel):
    id: str
    type: str
    confidence: float
    area: float
    location: Dict[str, int]
    severity: str

class DamagePrediction(BaseModel):
    damage_type: str
    probability: float
    expected_time: Optional[str] = None
    severity: str

class UploadResponse(BaseModel):
    success: bool
    file_id: str
    filename: str
    file_path: str

class DetectionResponse(BaseModel):
    file_id: str
    stains: List[StainInfo]
    total_stains: int
    processing_time: float

class ClassificationResponse(BaseModel):
    file_id: str
    paper_type: str
    confidence: float
    sub_type: Optional[str] = None
    properties: Dict[str, Any]

class PredictionResponse(BaseModel):
    file_id: str
    predictions: List[DamagePrediction]
    overall_health: float
    risk_level: str

class BatchItemResult(BaseModel):
    file_id: str
    filename: str
    detection: Optional[DetectionResponse] = None
    classification: Optional[ClassificationResponse] = None
    prediction: Optional[PredictionResponse] = None
    status: str
    error: Optional[str] = None

class BatchResponse(BaseModel):
    batch_id: str
    total: int
    completed: int
    failed: int
    results: List[BatchItemResult]
    processing_time: float

class TrendPoint(BaseModel):
    month: int
    health_score: float
    damage_area: float
    risk_level: str

class WeatheringTrendResponse(BaseModel):
    file_id: str
    current_health: float
    trend_points: List[TrendPoint]
    prediction_months: int
    recommendations: List[str]
    critical_points: List[Dict[str, Any]]
    processing_time: float

class ComparisonMetrics(BaseModel):
    stain_count_change: int
    stain_area_change: float
    health_score_change: float
    brightness_change: float
    texture_change: float
    new_stains: List[StainInfo]
    resolved_stains: List[StainInfo]

class MultiPeriodCompareResponse(BaseModel):
    comparison_id: str
    earlier_file_id: str
    later_file_id: str
    time_diff_days: Optional[int] = None
    metrics: ComparisonMetrics
    overall_assessment: str
    change_rate: Dict[str, float]
    processing_time: float

class RepairItem(BaseModel):
    repair_type: str
    quantity: float
    unit: str
    priority: str
    estimated_cost: float
    estimated_time: str
    description: str

class RepairEstimateResponse(BaseModel):
    file_id: str
    total_estimated_cost: float
    total_estimated_time: str
    repair_items: List[RepairItem]
    material_list: List[Dict[str, Any]]
    priority_summary: Dict[str, int]
    processing_time: float

class SliceAnalysis(BaseModel):
    slice_id: str
    row: int
    col: int
    bounds: Dict[str, int]
    stain_count: int
    total_stain_area: float
    avg_brightness: float
    texture_score: float
    local_health: float
    dominant_stain_type: Optional[str] = None
    risk_level: str

class ModelSliceResponse(BaseModel):
    file_id: str
    grid_size: Dict[str, int]
    slices: List[SliceAnalysis]
    heatmap_data: List[List[float]]
    high_risk_areas: List[Dict[str, Any]]
    overall_summary: Dict[str, Any]
    processing_time: float
