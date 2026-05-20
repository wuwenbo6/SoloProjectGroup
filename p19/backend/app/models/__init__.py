from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from ..core.database import Base
import uuid


class UserRole(str, PyEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    ANNOTATOR = "annotator"
    REVIEWER = "reviewer"
    RESEARCHER = "researcher"


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    REJECTED = "rejected"
    COMPLETED = "completed"


class AnnotationStatus(str, PyEnum):
    UNANNOTATED = "unannotated"
    ANNOTATING = "annotating"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(Enum(UserRole), default=UserRole.ANNOTATOR)
    region = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assigned_tasks = relationship("AnnotationTask", back_populates="annotator", foreign_keys="AnnotationTask.annotator_id")
    annotations = relationship("Annotation", back_populates="annotator")
    reviewed_annotations = relationship("Annotation", back_populates="reviewer", foreign_keys="Annotation.reviewer_id")


class DialectCategory(Base):
    __tablename__ = "dialect_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(20), unique=True, index=True)
    parent_id = Column(Integer, ForeignKey("dialect_categories.id"))
    region = Column(String(100), index=True)
    description = Column(Text)
    feature_vector = Column(Text)
    sample_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("DialectCategory", remote_side=[id])
    children = relationship("DialectCategory")
    audio_samples = relationship("AudioSample", back_populates="dialect_category")


class StorageTier(str, PyEnum):
    HOT = "hot"
    COLD = "cold"
    ARCHIVE = "archive"


class ClusterStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AudioSample(Base):
    __tablename__ = "audio_samples"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    duration = Column(Float)
    sample_rate = Column(Integer)
    channels = Column(Integer)
    format = Column(String(20))

    collector_name = Column(String(100))
    collection_location = Column(String(200))
    collection_date = Column(DateTime(timezone=True))
    speaker_age = Column(Integer)
    speaker_gender = Column(String(10))
    speaker_education = Column(String(50))

    dialect_category_id = Column(Integer, ForeignKey("dialect_categories.id"))
    dialect_confidence = Column(Float, default=0.0)
    feature_vector = Column(Text)
    cluster_id = Column(Integer, ForeignKey("feature_clusters.id"))

    standard_pronunciation_path = Column(String(500))
    standard_pronunciation_text = Column(Text)
    standard_pronunciation_source = Column(String(100))
    pronunciation_similarity_score = Column(Float, default=0.0)

    is_segmented = Column(Boolean, default=False)
    parent_id = Column(Integer, ForeignKey("audio_samples.id"))
    start_time = Column(Float)
    end_time = Column(Float)

    annotation_status = Column(Enum(AnnotationStatus), default=AnnotationStatus.UNANNOTATED)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    storage_tier = Column(Enum(StorageTier), default=StorageTier.HOT)
    storage_path = Column(String(500))
    access_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True))
    last_migrated_at = Column(DateTime(timezone=True))

    quality_score = Column(Float)
    quality_comment = Column(Text)
    quality_checked = Column(Boolean, default=False)
    checked_by = Column(Integer, ForeignKey("users.id"))
    checked_at = Column(DateTime(timezone=True))

    cluster_status = Column(Enum(ClusterStatus), default=ClusterStatus.PENDING)
    cluster_task_id = Column(String(100))

    dialect_category = relationship("DialectCategory", back_populates="audio_samples")
    parent = relationship("AudioSample", remote_side=[id])
    children = relationship("AudioSample")
    annotations = relationship("Annotation", back_populates="audio_sample")
    tasks = relationship("AnnotationTask", back_populates="audio_sample")
    cluster = relationship("FeatureCluster")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    audio_sample_id = Column(Integer, ForeignKey("audio_samples.id"), nullable=False)
    annotator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"))

    text = Column(Text, nullable=False)
    phonetic_transcription = Column(Text)
    notes = Column(Text)

    quality_score = Column(Float)
    is_accepted = Column(Boolean)
    reviewer_comments = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    submitted_at = Column(DateTime(timezone=True))
    reviewed_at = Column(DateTime(timezone=True))

    audio_sample = relationship("AudioSample", back_populates="annotations")
    annotator = relationship("User", back_populates="annotations", foreign_keys=[annotator_id])
    reviewer = relationship("User", back_populates="reviewed_annotations", foreign_keys=[reviewer_id])


class AnnotationTask(Base):
    __tablename__ = "annotation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    region = Column(String(100), index=True)

    audio_sample_id = Column(Integer, ForeignKey("audio_samples.id"), nullable=False)
    annotator_id = Column(Integer, ForeignKey("users.id"))
    assigned_by_id = Column(Integer, ForeignKey("users.id"))

    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    priority = Column(Integer, default=1)
    deadline = Column(DateTime(timezone=True))

    progress = Column(Float, default=0.0)

    assigned_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    audio_sample = relationship("AudioSample", back_populates="tasks")
    annotator = relationship("User", back_populates="assigned_tasks", foreign_keys=[annotator_id])


class FeatureCluster(Base):
    __tablename__ = "feature_clusters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    centroid = Column(Text, nullable=False)
    sample_count = Column(Integer, default=0)
    dialect_category_id = Column(Integer, ForeignKey("dialect_categories.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
