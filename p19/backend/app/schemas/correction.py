from pydantic import BaseModel
from typing import List, Optional
from enum import Enum


class CorrectionType(str, Enum):
    TEXT = "text"
    PHONETIC = "phonetic"
    DIALECT_CATEGORY = "dialect_category"
    QUALITY_SCORE = "quality_score"
    ALL = "all"


class BatchCorrectionItem(BaseModel):
    annotation_id: int
    text: Optional[str] = None
    phonetic_transcription: Optional[str] = None
    dialect_category_id: Optional[int] = None
    quality_score: Optional[float] = None


class BatchCorrectionRequest(BaseModel):
    corrections: List[BatchCorrectionItem]
    correction_type: CorrectionType = CorrectionType.ALL
    reviewer_comment: Optional[str] = None


class CorrectionRule(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    search_pattern: str
    replace_pattern: str
    dialect_category_id: Optional[int] = None
    is_active: bool = True


class ApplyRuleRequest(BaseModel):
    rule_ids: List[int]
    annotation_ids: Optional[List[int]] = None
    dialect_category_id: Optional[int] = None
