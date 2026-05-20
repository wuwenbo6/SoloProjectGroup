from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class DeviceBase(BaseModel):
    name: str
    device_type: str
    ip_address: Optional[str] = None


class DeviceCreate(DeviceBase):
    pass


class Device(DeviceBase):
    id: int
    status: str
    is_connected: bool
    last_heartbeat: Optional[datetime]
    failure_count: int
    last_diagnosis: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class DeviceParameterBase(BaseModel):
    key: str
    value: Optional[str] = None
    data_type: str = "string"


class DeviceParameterCreate(DeviceParameterBase):
    device_id: int


class DeviceParameter(DeviceParameterBase):
    id: int
    device_id: int
    updated_at: datetime

    class Config:
        orm_mode = True


class QualityParameterBase(BaseModel):
    resolution: Optional[str] = None
    bitrate: Optional[int] = None
    fps: Optional[float] = None
    codec: Optional[str] = None
    color_depth: Optional[int] = None
    psnr: Optional[float] = None
    ssim: Optional[float] = None


class QualityParameterCreate(QualityParameterBase):
    session_id: int


class QualityParameter(QualityParameterBase):
    id: int
    session_id: int
    measured_at: datetime

    class Config:
        orm_mode = True


class QualityEnhancementBase(BaseModel):
    sharpening: Optional[float] = 0.0
    denoising: Optional[float] = 0.0
    contrast: Optional[float] = 1.0
    brightness: Optional[float] = 0.0
    saturation: Optional[float] = 1.0
    color_correction: Optional[bool] = False
    edge_enhancement: Optional[float] = 0.0
    is_preview_enabled: Optional[bool] = False
    preview_frame: Optional[int] = 0


class QualityEnhancementCreate(QualityEnhancementBase):
    session_id: int


class QualityEnhancement(QualityEnhancementBase):
    id: int
    session_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class VideoFileBase(BaseModel):
    filename: str
    file_path: str
    file_size: Optional[int] = None
    duration: Optional[float] = None
    format: Optional[str] = None


class VideoFileCreate(VideoFileBase):
    session_id: int


class VideoFile(VideoFileBase):
    id: int
    session_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class TranscriptionSessionBase(BaseModel):
    device_id: int
    session_name: Optional[str] = None


class TranscriptionSessionCreate(TranscriptionSessionBase):
    pass


class TranscriptionSessionUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[float] = None
    current_frame: Optional[int] = None
    total_frames: Optional[int] = None
    error_message: Optional[str] = None


class TranscriptionSession(TranscriptionSessionBase):
    id: int
    status: str
    progress: float
    current_frame: int
    total_frames: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    video_file: Optional[VideoFile] = None
    quality_params: List[QualityParameter] = []
    enhancement_config: Optional[QualityEnhancement] = None

    class Config:
        orm_mode = True


class AlertBase(BaseModel):
    alert_type: str
    severity: str = "warning"
    message: Optional[str] = None


class AlertCreate(AlertBase):
    session_id: Optional[int] = None
    device_id: Optional[int] = None


class Alert(AlertBase):
    id: int
    session_id: Optional[int]
    device_id: Optional[int]
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        orm_mode = True


class ConfigBackupBase(BaseModel):
    backup_name: str
    device_id: Optional[int] = None
    backup_type: str = "manual"
    description: Optional[str] = None
    is_auto_restore: Optional[bool] = False


class ConfigBackupCreate(ConfigBackupBase):
    config_data: Dict[str, Any]


class ConfigBackup(ConfigBackupBase):
    id: int
    config_data: Dict[str, Any]
    created_at: datetime

    class Config:
        orm_mode = True


class DeviceDiagnosisBase(BaseModel):
    device_id: int
    diagnosis_type: str = "full"
    is_auto_restart: Optional[bool] = False


class DeviceDiagnosisCreate(DeviceDiagnosisBase):
    pass


class DeviceDiagnosis(DeviceDiagnosisBase):
    id: int
    status: str
    results: Optional[Dict[str, Any]]
    recommendations: Optional[str]
    restarted_at: Optional[datetime]
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        orm_mode = True


class TranscriptionControl(BaseModel):
    action: str
    session_id: Optional[int] = None


class RealTimeData(BaseModel):
    timestamp: datetime
    device_status: dict
    transcription_progress: dict
    quality_metrics: dict
    alerts: List[Alert]


class PreviewFrameData(BaseModel):
    frame_number: int
    original_quality: Dict[str, float]
    enhanced_quality: Dict[str, float]
    improvement: float
