from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from ..models import UserRole, TaskStatus, AnnotationStatus


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: UserRole = UserRole.ANNOTATOR
    region: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    exp: Optional[datetime] = None


class DialectCategoryBase(BaseModel):
    name: str
    code: str
    parent_id: Optional[int] = None
    region: Optional[str] = None
    description: Optional[str] = None


class DialectCategoryCreate(DialectCategoryBase):
    pass


class DialectCategoryResponse(DialectCategoryBase):
    id: int
    sample_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class AudioSampleBase(BaseModel):
    collector_name: Optional[str] = None
    collection_location: Optional[str] = None
    collection_date: Optional[datetime] = None
    speaker_age: Optional[int] = None
    speaker_gender: Optional[str] = None
    speaker_education: Optional[str] = None
    dialect_category_id: Optional[int] = None


class AudioSampleCreate(AudioSampleBase):
    pass


class AudioSampleResponse(AudioSampleBase):
    id: int
    uuid: str
    original_filename: str
    file_size: Optional[int]
    duration: Optional[float]
    sample_rate: Optional[int]
    format: Optional[str]
    is_segmented: bool
    start_time: Optional[float]
    end_time: Optional[float]
    annotation_status: AnnotationStatus
    dialect_confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class AudioSegmentRequest(BaseModel):
    audio_sample_id: int
    start_time: float
    end_time: float


class AnnotationBase(BaseModel):
    text: str
    phonetic_transcription: Optional[str] = None
    notes: Optional[str] = None


class AnnotationCreate(AnnotationBase):
    audio_sample_id: int


class AnnotationUpdate(BaseModel):
    text: Optional[str] = None
    phonetic_transcription: Optional[str] = None
    notes: Optional[str] = None


class AnnotationResponse(AnnotationBase):
    id: int
    audio_sample_id: int
    annotator_id: int
    reviewer_id: Optional[int]
    quality_score: Optional[float]
    is_accepted: Optional[bool]
    reviewer_comments: Optional[str]
    created_at: datetime
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnnotationReview(BaseModel):
    is_accepted: bool
    reviewer_comments: Optional[str] = None
    quality_score: Optional[float] = None


class AnnotationTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    region: Optional[str] = None
    priority: int = 1
    deadline: Optional[datetime] = None


class AnnotationTaskCreate(AnnotationTaskBase):
    audio_sample_id: int


class AnnotationTaskResponse(AnnotationTaskBase):
    id: int
    audio_sample_id: int
    annotator_id: Optional[int]
    status: TaskStatus
    progress: float
    assigned_at: Optional[datetime]
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskClaimRequest(BaseModel):
    task_id: int


class TaskReleaseRequest(BaseModel):
    task_id: int


class FeatureClusterResponse(BaseModel):
    id: int
    name: Optional[str]
    sample_count: int
    dialect_category_id: Optional[int]

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total_samples: int
    annotated_samples: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    total_users: int
    dialect_categories: int

    class Config:
        from_attributes = True
