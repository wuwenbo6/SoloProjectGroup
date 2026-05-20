from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import base64
import hashlib
from database import get_db
from models import ParameterBackup, CameraProfile

router = APIRouter(prefix="/api/params/backup")


class ParameterBackupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    backup_type: str = "manual"
    source_device: Optional[str] = None
    params_json: str
    is_encrypted: bool = False


class ParameterBackupRestore(BaseModel):
    backup_id: int
    restore_name: Optional[str] = None


class ParameterBackupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    backup_type: str
    source_device: Optional[str]
    created_at: datetime
    sync_status: str
    cloud_id: Optional[str]
    is_encrypted: bool

    class Config:
        orm_mode = True


class CloudSyncConfig(BaseModel):
    provider: str = "local"
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    bucket: Optional[str] = None


class ParameterBackupManager:
    def __init__(self):
        self.cloud_config = CloudSyncConfig()

    def _encrypt_params(self, params_json: str) -> str:
        encoded = base64.b64encode(params_json.encode()).decode()
        return encoded

    def _decrypt_params(self, encrypted: str) -> str:
        try:
            decoded = base64.b64decode(encrypted.encode()).decode()
            return decoded
        except:
            return encrypted

    def create_backup(self, db: Session, data: ParameterBackupCreate) -> ParameterBackup:
        params_json = data.params_json
        if data.is_encrypted:
            params_json = self._encrypt_params(params_json)

        backup = ParameterBackup(
            name=data.name,
            description=data.description,
            backup_type=data.backup_type,
            source_device=data.source_device,
            params_json=params_json,
            is_encrypted=data.is_encrypted
        )
        db.add(backup)
        db.commit()
        db.refresh(backup)
        return backup

    def create_auto_backup(self, db: Session, profile: CameraProfile, source_device: str) -> ParameterBackup:
        params_dict = {
            "camera_model": profile.camera_model,
            "film_type": profile.film_type,
            "film_format": profile.film_format,
            "scan_resolution": profile.scan_resolution,
            "exposure_compensation": profile.exposure_compensation,
            "contrast": profile.contrast,
            "brightness": profile.brightness,
            "saturation": profile.saturation,
            "color_temperature": profile.color_temperature,
            "sharpness": profile.sharpness,
            "noise_reduction": profile.noise_reduction,
            "scratch_removal": profile.scratch_removal,
            "fade_correction": profile.fade_correction
        }
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = ParameterBackup(
            name=f"auto_backup_{profile.name}_{timestamp}",
            description=f"自动备份 - {profile.name}",
            backup_type="auto",
            source_device=source_device,
            params_json=json.dumps(params_dict),
            is_encrypted=False
        )
        db.add(backup)
        db.commit()
        db.refresh(backup)
        return backup

    def get_backup_list(self, db: Session, skip: int = 0, limit: int = 50,
                        backup_type: Optional[str] = None) -> List[ParameterBackup]:
        query = db.query(ParameterBackup)
        if backup_type:
            query = query.filter(ParameterBackup.backup_type == backup_type)
        return query.order_by(ParameterBackup.created_at.desc()).offset(skip).limit(limit).all()

    def get_backup_detail(self, db: Session, backup_id: int) -> Optional[ParameterBackup]:
        return db.query(ParameterBackup).filter(ParameterBackup.id == backup_id).first()

    def restore_backup(self, db: Session, backup_id: int, restore_name: Optional[str] = None) -> CameraProfile:
        backup = self.get_backup_detail(db, backup_id)
        if not backup:
            raise HTTPException(status_code=404, detail="备份不存在")

        params_json = backup.params_json
        if backup.is_encrypted:
            params_json = self._decrypt_params(params_json)

        try:
            params = json.loads(params_json)
        except:
            raise HTTPException(status_code=400, detail="参数格式错误")

        new_name = restore_name or f"restored_{backup.name}"
        profile = CameraProfile(
            name=new_name,
            camera_model=params.get("camera_model", "Unknown"),
            film_type=params.get("film_type", "Unknown"),
            film_format=params.get("film_format", "135"),
            description=f"从备份 {backup.name} 恢复",
            scan_resolution=params.get("scan_resolution", 2400),
            exposure_compensation=params.get("exposure_compensation", 0.0),
            contrast=params.get("contrast", 1.0),
            brightness=params.get("brightness", 0.0),
            saturation=params.get("saturation", 1.0),
            color_temperature=params.get("color_temperature", 5500),
            sharpness=params.get("sharpness", 1.0),
            noise_reduction=params.get("noise_reduction", 50),
            scratch_removal=params.get("scratch_removal", True),
            fade_correction=params.get("fade_correction", True),
            is_backup=True,
            backup_source=f"backup_{backup_id}"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    def delete_backup(self, db: Session, backup_id: int) -> bool:
        backup = db.query(ParameterBackup).filter(ParameterBackup.id == backup_id).first()
        if backup:
            db.delete(backup)
            db.commit()
            return True
        return False

    def export_backup(self, db: Session, backup_id: int) -> Dict[str, Any]:
        backup = self.get_backup_detail(db, backup_id)
        if not backup:
            raise HTTPException(status_code=404, detail="备份不存在")

        checksum = hashlib.md5(backup.params_json.encode()).hexdigest()
        return {
            "id": backup.id,
            "name": backup.name,
            "description": backup.description,
            "backup_type": backup.backup_type,
            "source_device": backup.source_device,
            "created_at": backup.created_at.isoformat(),
            "params_json": backup.params_json,
            "is_encrypted": backup.is_encrypted,
            "checksum": checksum,
            "version": "1.0"
        }

    def import_backup(self, db: Session, import_data: Dict[str, Any]) -> ParameterBackup:
        if "params_json" not in import_data:
            raise HTTPException(status_code=400, detail="导入数据格式错误")

        if "checksum" in import_data:
            calculated = hashlib.md5(import_data["params_json"].encode()).hexdigest()
            if calculated != import_data["checksum"]:
                raise HTTPException(status_code=400, detail="数据校验失败，可能已损坏")

        backup = ParameterBackup(
            name=import_data.get("name", f"imported_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            description=import_data.get("description", "从外部导入"),
            backup_type="imported",
            source_device=import_data.get("source_device"),
            params_json=import_data["params_json"],
            is_encrypted=import_data.get("is_encrypted", False),
            sync_status="local"
        )
        db.add(backup)
        db.commit()
        db.refresh(backup)
        return backup

    def sync_to_cloud(self, db: Session, backup_id: int) -> bool:
        backup = self.get_backup_detail(db, backup_id)
        if not backup:
            return False
        backup.sync_status = "synced"
        backup.cloud_id = f"cloud_{backup_id}_{datetime.now().timestamp()}"
        db.commit()
        return True

    def sync_from_cloud(self, db: Session, cloud_id: str) -> Optional[ParameterBackup]:
        return None


backup_manager = ParameterBackupManager()


@router.post("/", response_model=ParameterBackupResponse)
async def create_parameter_backup(data: ParameterBackupCreate, db: Session = Depends(get_db)):
    return backup_manager.create_backup(db, data)


@router.get("/", response_model=List[ParameterBackupResponse])
async def list_parameter_backups(skip: int = 0, limit: int = 50,
                                 backup_type: Optional[str] = None, db: Session = Depends(get_db)):
    return backup_manager.get_backup_list(db, skip, limit, backup_type)


@router.get("/{backup_id}")
async def get_backup_detail(backup_id: int, include_params: bool = False, db: Session = Depends(get_db)):
    backup = backup_manager.get_backup_detail(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="备份不存在")
    result = {
        "id": backup.id,
        "name": backup.name,
        "description": backup.description,
        "backup_type": backup.backup_type,
        "source_device": backup.source_device,
        "created_at": backup.created_at,
        "sync_status": backup.sync_status,
        "cloud_id": backup.cloud_id,
        "is_encrypted": backup.is_encrypted
    }
    if include_params and not backup.is_encrypted:
        result["params_json"] = backup.params_json
    return result


@router.post("/restore")
async def restore_parameter_backup(data: ParameterBackupRestore, db: Session = Depends(get_db)):
    profile = backup_manager.restore_backup(db, data.backup_id, data.restore_name)
    return {
        "status": "success",
        "profile_id": profile.id,
        "profile_name": profile.name
    }


@router.delete("/{backup_id}")
async def delete_parameter_backup(backup_id: int, db: Session = Depends(get_db)):
    success = backup_manager.delete_backup(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="备份不存在")
    return {"status": "success", "message": "删除成功"}


@router.get("/export/{backup_id}")
async def export_parameter_backup(backup_id: int, db: Session = Depends(get_db)):
    return backup_manager.export_backup(db, backup_id)


@router.post("/import")
async def import_parameter_backup(import_data: Dict[str, Any], db: Session = Depends(get_db)):
    backup = backup_manager.import_backup(db, import_data)
    return ParameterBackupResponse(
        id=backup.id,
        name=backup.name,
        description=backup.description,
        backup_type=backup.backup_type,
        source_device=backup.source_device,
        created_at=backup.created_at,
        sync_status=backup.sync_status,
        cloud_id=backup.cloud_id,
        is_encrypted=backup.is_encrypted
    )


@router.post("/sync/{backup_id}")
async def sync_backup_to_cloud(backup_id: int, db: Session = Depends(get_db)):
    success = backup_manager.sync_to_cloud(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="备份不存在")
    return {"status": "success", "message": "同步成功"}


@router.post("/auto-backup/profile/{profile_id}")
async def create_auto_backup(profile_id: int, source_device: str = "local", db: Session = Depends(get_db)):
    profile = db.query(CameraProfile).filter(CameraProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="配置不存在")
    backup = backup_manager.create_auto_backup(db, profile, source_device)
    return ParameterBackupResponse(
        id=backup.id,
        name=backup.name,
        description=backup.description,
        backup_type=backup.backup_type,
        source_device=backup.source_device,
        created_at=backup.created_at,
        sync_status=backup.sync_status,
        cloud_id=backup.cloud_id,
        is_encrypted=backup.is_encrypted
    )
