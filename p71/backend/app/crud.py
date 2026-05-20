from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas


def get_device(db: Session, device_id: int):
    return db.query(models.Device).filter(models.Device.id == device_id).first()


def get_devices(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Device).offset(skip).limit(limit).all()


def create_device(db: Session, device: schemas.DeviceCreate):
    db_device = models.Device(**device.dict())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device


def update_device_status(db: Session, device_id: int, status: str, is_connected: bool):
    db_device = get_device(db, device_id)
    if db_device:
        db_device.status = status
        db_device.is_connected = is_connected
        db_device.last_heartbeat = datetime.utcnow()
        db.commit()
        db.refresh(db_device)
    return db_device


def increment_device_failure(db: Session, device_id: int):
    db_device = get_device(db, device_id)
    if db_device:
        db_device.failure_count += 1
        db.commit()
        db.refresh(db_device)
    return db_device


def reset_device_failure(db: Session, device_id: int):
    db_device = get_device(db, device_id)
    if db_device:
        db_device.failure_count = 0
        db.commit()
        db.refresh(db_device)
    return db_device


def delete_device(db: Session, device_id: int):
    db_device = get_device(db, device_id)
    if db_device:
        db.delete(db_device)
        db.commit()
    return db_device


def get_device_parameters(db: Session, device_id: int):
    return db.query(models.DeviceParameter).filter(models.DeviceParameter.device_id == device_id).all()


def create_device_parameter(db: Session, param: schemas.DeviceParameterCreate):
    db_param = models.DeviceParameter(**param.dict())
    db.add(db_param)
    db.commit()
    db.refresh(db_param)
    return db_param


def get_transcription_session(db: Session, session_id: int):
    return db.query(models.TranscriptionSession).filter(models.TranscriptionSession.id == session_id).first()


def get_transcription_sessions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TranscriptionSession).order_by(models.TranscriptionSession.created_at.desc()).offset(skip).limit(limit).all()


def create_transcription_session(db: Session, session: schemas.TranscriptionSessionCreate):
    db_session = models.TranscriptionSession(**session.dict())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    enhancement = models.QualityEnhancement(session_id=db_session.id)
    db.add(enhancement)
    db.commit()
    return db_session


def update_transcription_session(db: Session, session_id: int, session_update: schemas.TranscriptionSessionUpdate):
    db_session = get_transcription_session(db, session_id)
    if db_session:
        update_data = session_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_session, key, value)
        db.commit()
        db.refresh(db_session)
    return db_session


def start_transcription_session(db: Session, session_id: int):
    db_session = get_transcription_session(db, session_id)
    if db_session:
        db_session.status = "running"
        db_session.start_time = datetime.utcnow()
        db.commit()
        db.refresh(db_session)
    return db_session


def stop_transcription_session(db: Session, session_id: int):
    db_session = get_transcription_session(db, session_id)
    if db_session:
        db_session.status = "stopped"
        db_session.end_time = datetime.utcnow()
        db.commit()
        db.refresh(db_session)
    return db_session


def create_quality_parameter(db: Session, quality: schemas.QualityParameterCreate):
    db_quality = models.QualityParameter(**quality.dict())
    db.add(db_quality)
    db.commit()
    db.refresh(db_quality)
    return db_quality


def get_latest_quality_parameter(db: Session, session_id: int):
    return db.query(models.QualityParameter).filter(models.QualityParameter.session_id == session_id).order_by(models.QualityParameter.measured_at.desc()).first()


def get_quality_enhancement(db: Session, session_id: int):
    return db.query(models.QualityEnhancement).filter(models.QualityEnhancement.session_id == session_id).first()


def update_quality_enhancement(db: Session, session_id: int, enhancement_data: schemas.QualityEnhancementBase):
    db_enhancement = get_quality_enhancement(db, session_id)
    if db_enhancement:
        update_data = enhancement_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_enhancement, key, value)
        db_enhancement.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_enhancement)
        return db_enhancement
    return None


def create_video_file(db: Session, video: schemas.VideoFileCreate):
    db_video = models.VideoFile(**video.dict())
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video


def create_alert(db: Session, alert: schemas.AlertCreate):
    db_alert = models.Alert(**alert.dict())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


def get_alerts(db: Session, is_resolved: bool = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Alert)
    if is_resolved is not None:
        query = query.filter(models.Alert.is_resolved == is_resolved)
    return query.order_by(models.Alert.created_at.desc()).offset(skip).limit(limit).all()


def resolve_alert(db: Session, alert_id: int):
    db_alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if db_alert:
        db_alert.is_resolved = True
        db_alert.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(db_alert)
    return db_alert


def create_config_backup(db: Session, backup: schemas.ConfigBackupCreate):
    db_backup = models.ConfigBackup(**backup.dict())
    db.add(db_backup)
    db.commit()
    db.refresh(db_backup)
    return db_backup


def get_config_backups(db: Session, device_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ConfigBackup)
    if device_id:
        query = query.filter(models.ConfigBackup.device_id == device_id)
    return query.order_by(models.ConfigBackup.created_at.desc()).offset(skip).limit(limit).all()


def get_config_backup(db: Session, backup_id: int):
    return db.query(models.ConfigBackup).filter(models.ConfigBackup.id == backup_id).first()


def delete_config_backup(db: Session, backup_id: int):
    db_backup = get_config_backup(db, backup_id)
    if db_backup:
        db.delete(db_backup)
        db.commit()
    return db_backup


def create_device_diagnosis(db: Session, diagnosis: schemas.DeviceDiagnosisCreate):
    db_diagnosis = models.DeviceDiagnosis(**diagnosis.dict())
    db.add(db_diagnosis)
    db.commit()
    db.refresh(db_diagnosis)
    return db_diagnosis


def get_device_diagnosis(db: Session, diagnosis_id: int):
    return db.query(models.DeviceDiagnosis).filter(models.DeviceDiagnosis.id == diagnosis_id).first()


def get_device_diagnoses(db: Session, device_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.DeviceDiagnosis)
    if device_id:
        query = query.filter(models.DeviceDiagnosis.device_id == device_id)
    return query.order_by(models.DeviceDiagnosis.started_at.desc()).offset(skip).limit(limit).all()


def update_diagnosis_result(db: Session, diagnosis_id: int, status: str, results: dict, recommendations: str = None):
    db_diagnosis = get_device_diagnosis(db, diagnosis_id)
    if db_diagnosis:
        db_diagnosis.status = status
        db_diagnosis.results = results
        db_diagnosis.recommendations = recommendations
        if status == "completed":
            db_diagnosis.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(db_diagnosis)
    return db_diagnosis


def get_latest_diagnosis(db: Session, device_id: int):
    return db.query(models.DeviceDiagnosis).filter(
        models.DeviceDiagnosis.device_id == device_id
    ).order_by(models.DeviceDiagnosis.started_at.desc()).first()
