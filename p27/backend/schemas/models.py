from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class Entity(BaseModel):
    type: str
    value: str
    confidence: float
    bbox: Optional[List[float]] = None


class OCRResult(BaseModel):
    text: str
    words: List[Dict]
    page_num: int
    width: int
    height: int


class DocumentUploadResponse(BaseModel):
    success: bool
    document_id: str
    filename: str
    entities: List[Entity]
    message: str


class QueryRequest(BaseModel):
    query: str = Field(..., description="用户问题")
    document_id: Optional[str] = Field(None, description="指定文档ID，不指定则搜索全部")


class Source(BaseModel):
    document_id: str
    filename: str
    content: str
    page_num: int
    score: float


class QueryResponse(BaseModel):
    success: bool
    answer: str
    sources: List[Source]


class DocumentInfo(BaseModel):
    document_id: str
    filename: str
    upload_time: datetime
    entities: List[Entity]
    page_count: int


class ParagraphDiff(BaseModel):
    change_type: str
    content: Optional[str] = None
    content_html: Optional[str] = None
    original_content: Optional[str] = None
    revised_content: Optional[str] = None
    original_index: Optional[int] = None
    revised_index: Optional[int] = None


class EntityChange(BaseModel):
    type: str
    change_type: str
    value: Optional[str] = None
    original_value: Optional[str] = None
    revised_value: Optional[str] = None
    bbox: Optional[List[float]] = None
    original_bbox: Optional[List[float]] = None
    revised_bbox: Optional[List[float]] = None


class EntityDiffSummary(BaseModel):
    total_original: int
    total_revised: int
    added: int
    deleted: int
    modified: int
    unchanged: int


class EntityDiffs(BaseModel):
    summary: EntityDiffSummary
    by_type: Dict[str, Any]
    changes: List[EntityChange]


class DocumentReference(BaseModel):
    id: str
    filename: str
    page_count: int


class DocumentDiffResponse(BaseModel):
    success: bool
    original_document: DocumentReference
    revised_document: DocumentReference
    similarity_score: float
    total_changes: int
    paragraph_diffs: List[ParagraphDiff]
    entity_diffs: EntityDiffs
    comparison_time: str


class VersionUploadRequest(BaseModel):
    original_document_id: str = Field(..., description="原始文档ID")


class DiffStatisticsResponse(BaseModel):
    success: bool
    statistics: Dict[str, Any]


class DiffExportRequest(BaseModel):
    original_document_id: str
    revised_document_id: str
    format: str = "json"


class EntityFeedbackRequest(BaseModel):
    document_id: str
    original_entity: Optional[dict] = None
    corrected_entity: Optional[dict] = None
    feedback_type: str
    comment: Optional[str] = None
    page_num: Optional[int] = 0


class FeedbackStatsResponse(BaseModel):
    total_feedbacks: int
    pending_review: int
    used_for_training: int
    by_type: dict


class TrainingJobResponse(BaseModel):
    job_id: str
    status: str
    sample_count: int
    started_at: str
    estimated_completion: Optional[str] = None
