from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


photo_tag_association = Table(
    'photo_tag_association',
    Base.metadata,
    Column('photo_id', Integer, ForeignKey('photo_archives.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    color = Column(String(7), default="#3b82f6")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    photo_count = Column(Integer, default=0)

    photos = relationship("PhotoArchive", secondary=photo_tag_association, back_populates="tag_objects")


class CameraProfile(Base):
    __tablename__ = "camera_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    camera_model = Column(String(100), nullable=False)
    film_type = Column(String(50), nullable=False)
    film_format = Column(String(20), default="135")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    scan_resolution = Column(Integer, default=2400)
    exposure_compensation = Column(Float, default=0.0)
    contrast = Column(Float, default=1.0)
    brightness = Column(Float, default=0.0)
    saturation = Column(Float, default=1.0)
    color_temperature = Column(Integer, default=5500)
    sharpness = Column(Float, default=1.0)
    noise_reduction = Column(Integer, default=50)
    scratch_removal = Column(Boolean, default=True)
    fade_correction = Column(Boolean, default=True)

    is_backup = Column(Boolean, default=False)
    backup_source = Column(String(50), nullable=True)


class PhotoArchive(Base):
    __tablename__ = "photo_archives"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)
    archived_path = Column(String(500), nullable=False)
    file_format = Column(String(10), default="tiff")
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)

    camera_model = Column(String(100))
    film_type = Column(String(50))
    scan_date = Column(DateTime(timezone=True), server_default=func.now())
    tags = Column(String(500))
    notes = Column(Text, nullable=True)

    has_restoration = Column(Boolean, default=False)
    restoration_params = Column(Text, nullable=True)
    profile_id = Column(Integer, nullable=True)

    device_id = Column(String(100), nullable=True)
    scan_session_id = Column(Integer, nullable=True)

    tag_objects = relationship("Tag", secondary=photo_tag_association, back_populates="photos")
    restoration_history = relationship("RestorationHistory", back_populates="photo", cascade="all, delete-orphan")


class RestorationHistory(Base):
    __tablename__ = "restoration_history"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey('photo_archives.id'), nullable=False)
    operation_type = Column(String(50), nullable=False)
    params_json = Column(Text, nullable=True)
    before_image_path = Column(String(500), nullable=True)
    after_image_path = Column(String(500), nullable=True)
    processing_time_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    operator = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    photo = relationship("PhotoArchive", back_populates="restoration_history")


class ParameterBackup(Base):
    __tablename__ = "parameter_backups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    backup_type = Column(String(20), default="manual")
    source_device = Column(String(100), nullable=True)
    params_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sync_status = Column(String(20), default="local")
    cloud_id = Column(String(100), nullable=True)
    is_encrypted = Column(Boolean, default=False)


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=False)
    device_name = Column(String(200), nullable=False)
    status = Column(String(20), default="running")
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    total_frames = Column(Integer, default=0)
    processed_frames = Column(Integer, default=0)
    failed_frames = Column(Integer, default=0)
    film_type = Column(String(50), nullable=True)
    output_directory = Column(String(500), nullable=True)
    profile_id = Column(Integer, nullable=True)
    error_log = Column(Text, nullable=True)
