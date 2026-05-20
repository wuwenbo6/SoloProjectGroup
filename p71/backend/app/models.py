from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False)
    ip_address = Column(String(50))
    status = Column(String(20), default="offline")
    is_connected = Column(Boolean, default=False)
    last_heartbeat = Column(DateTime)
    failure_count = Column(Integer, default=0)
    last_diagnosis = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parameters = relationship("DeviceParameter", back_populates="device")
    transcription_sessions = relationship("TranscriptionSession", back_populates="device")
    diagnosis_records = relationship("DeviceDiagnosis", back_populates="device")


class DeviceParameter(Base):
    __tablename__ = "device_parameters"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    key = Column(String(100), nullable=False)
    value = Column(String(500))
    data_type = Column(String(20), default="string")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="parameters")


class TranscriptionSession(Base):
    __tablename__ = "transcription_sessions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    session_name = Column(String(200))
    status = Column(String(20), default="idle")
    progress = Column(Float, default=0.0)
    current_frame = Column(Integer, default=0)
    total_frames = Column(Integer, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="transcription_sessions")
    video_file = relationship("VideoFile", back_populates="session", uselist=False)
    quality_params = relationship("QualityParameter", back_populates="session")
    enhancement_config = relationship("QualityEnhancement", back_populates="session", uselist=False)


class QualityParameter(Base):
    __tablename__ = "quality_parameters"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("transcription_sessions.id"))
    resolution = Column(String(20))
    bitrate = Column(Integer)
    fps = Column(Float)
    codec = Column(String(50))
    color_depth = Column(Integer)
    psnr = Column(Float)
    ssim = Column(Float)
    measured_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("TranscriptionSession", back_populates="quality_params")


class QualityEnhancement(Base):
    __tablename__ = "quality_enhancements"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("transcription_sessions.id"))
    sharpening = Column(Float, default=0.0)
    denoising = Column(Float, default=0.0)
    contrast = Column(Float, default=1.0)
    brightness = Column(Float, default=0.0)
    saturation = Column(Float, default=1.0)
    color_correction = Column(Boolean, default=False)
    edge_enhancement = Column(Float, default=0.0)
    is_preview_enabled = Column(Boolean, default=False)
    preview_frame = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("TranscriptionSession", back_populates="enhancement_config")


class VideoFile(Base):
    __tablename__ = "video_files"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("transcription_sessions.id"))
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer)
    duration = Column(Float)
    format = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("TranscriptionSession", back_populates="video_file")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("transcription_sessions.id"))
    device_id = Column(Integer, ForeignKey("devices.id"))
    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="warning")
    message = Column(Text)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)


class ConfigBackup(Base):
    __tablename__ = "config_backups"

    id = Column(Integer, primary_key=True, index=True)
    backup_name = Column(String(200), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"))
    config_data = Column(JSON, nullable=False)
    backup_type = Column(String(50), default="manual")
    description = Column(String(500))
    is_auto_restore = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceDiagnosis(Base):
    __tablename__ = "device_diagnosis"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    diagnosis_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")
    results = Column(JSON)
    recommendations = Column(Text)
    is_auto_restart = Column(Boolean, default=False)
    restarted_at = Column(DateTime)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    device = relationship("Device", back_populates="diagnosis_records")
