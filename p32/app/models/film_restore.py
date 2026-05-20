from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import BaseBatch
import json


class FilmCamera(BaseBatch):
    __tablename__ = "film_cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(100), unique=True, index=True, nullable=False)
    camera_name = Column(String(200), nullable=False)
    camera_model = Column(String(100))
    camera_type = Column(String(50))
    status = Column(String(50), default="offline")
    connection_time = Column(DateTime)
    last_heartbeat = Column(DateTime)
    ip_address = Column(String(50))
    firmware_version = Column(String(100))
    config = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PhotoArchive(BaseBatch):
    __tablename__ = "photo_archives"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(String(100), unique=True, index=True, nullable=False)
    original_filename = Column(String(500))
    file_path = Column(String(1000))
    file_size = Column(Float)
    file_format = Column(String(20))
    resolution_width = Column(Integer)
    resolution_height = Column(Integer)
    dpi = Column(Integer)
    color_space = Column(String(50))
    camera_id = Column(String(100))
    film_type = Column(String(100))
    film_iso = Column(Integer)
    shutter_speed = Column(String(50))
    aperture = Column(String(20))
    capture_date = Column(DateTime)
    capture_location = Column(String(500))
    photographer = Column(String(200))
    description = Column(Text)
    tags = Column(JSON)
    status = Column(String(50), default="pending")
    is_restored = Column(Boolean, default=False)
    is_transcribed = Column(Boolean, default=False)
    created_by = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PhotoTag(BaseBatch):
    __tablename__ = "photo_tags"

    id = Column(Integer, primary_key=True, index=True)
    tag_id = Column(String(100), unique=True, index=True, nullable=False)
    tag_name = Column(String(200), nullable=False)
    tag_category = Column(String(100))
    tag_color = Column(String(20))
    description = Column(Text)
    photo_count = Column(Integer, default=0)
    is_auto = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class RestoreHistory(BaseBatch):
    __tablename__ = "restore_histories"

    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(String(100), unique=True, index=True, nullable=False)
    photo_id = Column(String(100), index=True, nullable=False)
    restore_type = Column(String(100))
    restore_version = Column(String(50))
    parameters = Column(JSON)
    original_file_path = Column(String(1000))
    restored_file_path = Column(String(1000))
    thumbnail_path = Column(String(1000))
    quality_score = Column(Float)
    processing_time = Column(Float)
    status = Column(String(50), default="completed")
    error_message = Column(Text)
    restored_by = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TranscriptionParams(BaseBatch):
    __tablename__ = "transcription_params"

    id = Column(Integer, primary_key=True, index=True)
    params_id = Column(String(100), unique=True, index=True, nullable=False)
    camera_id = Column(String(100), index=True)
    params_name = Column(String(200))
    brightness = Column(Float, default=0.0)
    contrast = Column(Float, default=1.0)
    saturation = Column(Float, default=1.0)
    sharpness = Column(Float, default=1.0)
    denoise_level = Column(Float, default=0.0)
    color_correction = Column(Boolean, default=True)
    white_balance_temp = Column(Integer, default=5500)
    white_balance_tint = Column(Integer, default=0)
    exposure_compensation = Column(Float, default=0.0)
    gamma = Column(Float, default=1.0)
    curve_adjustment = Column(JSON)
    custom_filters = Column(JSON)
    is_default = Column(Boolean, default=False)
    is_synced = Column(Boolean, default=True)
    sync_version = Column(Integer, default=1)
    last_sync_time = Column(DateTime)
    created_by = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TranscriptionTask(BaseBatch):
    __tablename__ = "transcription_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    camera_id = Column(String(100), index=True, nullable=False)
    photo_id = Column(String(100), index=True)
    params_id = Column(String(100))
    task_type = Column(String(50), default="transcription")
    priority = Column(Integer, default=5)
    status = Column(String(50), default="pending")
    progress = Column(Integer, default=0)
    total_frames = Column(Integer, default=1)
    current_frame = Column(Integer, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    estimated_time = Column(Float)
    processing_speed = Column(Float)
    error_message = Column(Text)
    output_path = Column(String(1000))
    task_metadata = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SyncBackupLog(BaseBatch):
    __tablename__ = "sync_backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    sync_id = Column(String(100), unique=True, index=True, nullable=False)
    sync_type = Column(String(50))
    camera_id = Column(String(100))
    params_id = Column(String(100))
    version = Column(Integer)
    sync_direction = Column(String(20))
    status = Column(String(50), default="pending")
    data_size = Column(Float)
    error_message = Column(Text)
    sync_start_time = Column(DateTime)
    sync_end_time = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
