from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import asyncio
import json
import os
import random
import math
from contextlib import asynccontextmanager

from app.database import get_db, engine, Base
from app import models, schemas, crud

Base.metadata.create_all(bind=engine)

DIAGNOSIS_INTERVAL = 300
AUTO_BACKUP_INTERVAL = 3600


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        async with self._lock:
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.active_connections.remove(conn)


manager = ConnectionManager()
simulation_task = None
heartbeat_task = None
diagnosis_task = None
backup_task = None

HEARTBEAT_TIMEOUT = 30
STORAGE_BASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "storage")
os.makedirs(STORAGE_BASE_PATH, exist_ok=True)
os.makedirs(os.path.join(STORAGE_BASE_PATH, "videos"), exist_ok=True)
os.makedirs(os.path.join(STORAGE_BASE_PATH, "logs"), exist_ok=True)


def get_video_storage_path(session_id: int, filename: str) -> str:
    session_folder = f"session_{session_id}_{datetime.now().strftime('%Y%m%d')}"
    full_path = os.path.join(STORAGE_BASE_PATH, "videos", session_folder)
    os.makedirs(full_path, exist_ok=True)
    return os.path.abspath(os.path.join(full_path, filename))


async def device_heartbeat_monitor(db: Session):
    while True:
        try:
            now = datetime.utcnow()
            devices = db.query(models.Device).filter(models.Device.is_connected == True).all()
            for device in devices:
                if device.last_heartbeat:
                    time_since_heartbeat = (now - device.last_heartbeat).total_seconds()
                    if time_since_heartbeat > HEARTBEAT_TIMEOUT:
                        device.is_connected = False
                        device.status = "offline"
                        crud.increment_device_failure(db, device.id)
                        alert = models.Alert(
                            device_id=device.id,
                            alert_type="设备断开",
                            severity="warning",
                            message=f"设备 {device.name} 心跳超时，已自动断开连接 (失败次数: {device.failure_count})",
                            created_at=now
                        )
                        db.add(alert)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Heartbeat monitor error: {e}")
        await asyncio.sleep(5)


async def auto_diagnosis_task(db: Session):
    while True:
        try:
            devices = db.query(models.Device).filter(models.Device.failure_count >= 3).all()
            for device in devices:
                latest_diagnosis = crud.get_latest_diagnosis(db, device.id)
                if latest_diagnosis and (datetime.utcnow() - latest_diagnosis.started_at).total_seconds() < DIAGNOSIS_INTERVAL:
                    continue
                
                await run_device_diagnosis(db, device.id, auto_restart=True)
        except Exception as e:
            print(f"Auto diagnosis error: {e}")
        await asyncio.sleep(60)


async def auto_backup_task(db: Session):
    while True:
        try:
            devices = crud.get_devices(db)
            for device in devices:
                params = crud.get_device_parameters(db, device.id)
                config_data = {
                    "device_info": {
                        "name": device.name,
                        "device_type": device.device_type,
                        "ip_address": device.ip_address,
                    },
                    "parameters": {p.key: p.value for p in params},
                    "backup_time": datetime.utcnow().isoformat()
                }
                
                backup = schemas.ConfigBackupCreate(
                    backup_name=f"自动备份_{device.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    device_id=device.id,
                    backup_type="auto",
                    description="系统自动定时备份",
                    is_auto_restore=True,
                    config_data=config_data
                )
                crud.create_config_backup(db, backup)
        except Exception as e:
            print(f"Auto backup error: {e}")
        await asyncio.sleep(AUTO_BACKUP_INTERVAL)


async def run_device_diagnosis(db: Session, device_id: int, auto_restart: bool = False):
    device = crud.get_device(db, device_id)
    if not device:
        return None
    
    diagnosis = crud.create_device_diagnosis(db, schemas.DeviceDiagnosisCreate(
        device_id=device_id,
        diagnosis_type="auto" if auto_restart else "manual",
        is_auto_restart=auto_restart
    ))
    
    await asyncio.sleep(2)
    
    results = {
        "connectivity": {
            "status": "passed" if device.is_connected else "failed",
            "latency_ms": random.randint(5, 50) if device.is_connected else None,
            "packet_loss": random.uniform(0, 2) if device.is_connected else 100,
        },
        "hardware": {
            "temperature": random.uniform(35, 75),
            "cpu_usage": random.uniform(10, 80),
            "memory_usage": random.uniform(20, 70),
            "status": "passed",
        },
        "parameters": {
            "verified": random.randint(8, 15),
            "invalid": random.randint(0, 2),
            "status": "passed",
        },
        "network": {
            "bandwidth": f"{random.randint(900, 1000)} Mbps",
            "jitter": f"{random.uniform(0.1, 2):.2f} ms",
            "status": "passed",
        },
    }
    
    has_errors = False
    recommendations = []
    
    if results["connectivity"]["packet_loss"] > 5:
        has_errors = True
        recommendations.append("检测到网络丢包过高，建议检查网络连接")
    
    if results["hardware"]["temperature"] > 70:
        has_errors = True
        recommendations.append("设备温度偏高，建议检查散热系统")
    
    if results["parameters"]["invalid"] > 0:
        has_errors = True
        recommendations.append(f"发现 {results['parameters']['invalid']} 个无效参数，建议校验配置")
    
    if device.failure_count > 5:
        has_errors = True
        recommendations.append(f"设备累计失败 {device.failure_count} 次，建议深度检测")
    
    overall_status = "success" if not has_errors else "warning"
    
    if auto_restart and has_errors:
        device.is_connected = False
        device.status = "restarting"
        db.commit()
        
        await asyncio.sleep(3)
        
        device.is_connected = True
        device.status = "idle"
        device.failure_count = 0
        device.last_heartbeat = datetime.utcnow()
        db.commit()
        
        results["restart_performed"] = True
        recommendations.append("已执行自动重启恢复连接")
    else:
        results["restart_performed"] = False
    
    crud.update_diagnosis_result(
        db,
        diagnosis.id,
        "completed",
        results,
        "；".join(recommendations) if recommendations else "设备运行正常，未发现异常"
    )
    
    device.last_diagnosis = datetime.utcnow()
    db.commit()
    
    return diagnosis


async def simulate_transcription_progress(db: Session):
    global simulation_task
    quality_update_counter = 0
    last_quality_update = {}
    
    while simulation_task:
        try:
            sessions = db.query(models.TranscriptionSession).filter(
                models.TranscriptionSession.status == "running"
            ).all()
            
            for session in sessions:
                if session.progress < 100:
                    progress_increment = random.uniform(0.3, 0.6)
                    session.progress = min(100, session.progress + progress_increment)
                    session.current_frame = int(session.progress / 100 * session.total_frames)
                    session.updated_at = datetime.utcnow()
                    
                    if session.id not in last_quality_update:
                        last_quality_update[session.id] = 0
                    
                    quality_update_counter += 1
                    if quality_update_counter - last_quality_update[session.id] >= 3:
                        noise = random.uniform(-0.2, 0.2)
                        progress_factor = session.progress / 100
                        psnr_base = 40.0 + progress_factor * 6.0
                        psnr = max(35.0, min(48.0, psnr_base + noise))
                        
                        ssim_base = 0.92 + progress_factor * 0.07
                        ssim = max(0.85, min(0.995, ssim_base + noise * 0.01))
                        
                        bitrate_base = 40000000 + int(progress_factor * 15000000)
                        bitrate = bitrate_base + random.randint(-2000000, 2000000)
                        
                        quality = models.QualityParameter(
                            session_id=session.id,
                            resolution="4096x3112",
                            bitrate=bitrate,
                            fps=24.0,
                            codec="ProRes 4444",
                            color_depth=12,
                            psnr=psnr,
                            ssim=ssim,
                            measured_at=datetime.utcnow()
                        )
                        db.add(quality)
                        last_quality_update[session.id] = quality_update_counter
                        
                        if psnr < 36.0:
                            existing_alert = db.query(models.Alert).filter(
                                models.Alert.session_id == session.id,
                                models.Alert.alert_type == "画质异常",
                                models.Alert.is_resolved == False
                            ).first()
                            if not existing_alert:
                                alert = models.Alert(
                                    session_id=session.id,
                                    alert_type="画质异常",
                                    severity="warning",
                                    message=f"PSNR过低: {psnr:.2f}dB，建议检查胶片扫描设备",
                                    created_at=datetime.utcnow()
                                )
                                db.add(alert)
                
                if session.progress >= 100 and session.status == "running":
                    session.status = "completed"
                    session.end_time = datetime.utcnow()
                    
                    video_filename = f"transcription_{session.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mov"
                    video_path = get_video_storage_path(session.id, video_filename)
                    
                    video_file = models.VideoFile(
                        session_id=session.id,
                        filename=video_filename,
                        file_path=video_path,
                        file_size=random.randint(1000000000, 5000000000),
                        duration=7200.0,
                        format="ProRes 4444",
                        created_at=datetime.utcnow()
                    )
                    db.add(video_file)
            
            devices = db.query(models.Device).all()
            for device in devices:
                if device.is_connected:
                    device.last_heartbeat = datetime.utcnow()
            
            db.commit()
            
            try:
                await manager.broadcast(json.dumps({
                    "type": "update",
                    "timestamp": datetime.utcnow().isoformat()
                }))
            except Exception:
                pass
                
        except Exception as e:
            db.rollback()
            print(f"Simulation error: {e}")
        
        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global heartbeat_task, diagnosis_task, backup_task
    db = next(get_db())
    
    if db.query(models.Device).count() == 0:
        device1 = models.Device(
            name="胶片放映机 A1",
            device_type="projector",
            ip_address="192.168.1.101",
            status="idle",
            is_connected=True,
            last_heartbeat=datetime.utcnow()
        )
        device2 = models.Device(
            name="胶片扫描仪 S2",
            device_type="scanner",
            ip_address="192.168.1.102",
            status="idle",
            is_connected=True,
            last_heartbeat=datetime.utcnow()
        )
        db.add(device1)
        db.add(device2)
        
        params1 = [
            models.DeviceParameter(device_id=1, key="film_type", value="35mm"),
            models.DeviceParameter(device_id=1, key="lamp_brightness", value="85"),
            models.DeviceParameter(device_id=1, key="scan_speed", value="24fps"),
            models.DeviceParameter(device_id=1, key="resolution", value="4K"),
        ]
        params2 = [
            models.DeviceParameter(device_id=2, key="film_type", value="16mm"),
            models.DeviceParameter(device_id=2, key="lamp_brightness", value="75"),
            models.DeviceParameter(device_id=2, key="scan_speed", value="30fps"),
        ]
        db.add_all(params1 + params2)
        db.commit()
    
    if heartbeat_task is None:
        heartbeat_task = asyncio.create_task(device_heartbeat_monitor(db))
    if diagnosis_task is None:
        diagnosis_task = asyncio.create_task(auto_diagnosis_task(db))
    if backup_task is None:
        backup_task = asyncio.create_task(auto_backup_task(db))
    
    yield
    
    if heartbeat_task:
        heartbeat_task.cancel()
    if diagnosis_task:
        diagnosis_task.cancel()
    if backup_task:
        backup_task.cancel()


app = FastAPI(title="胶片转录监控操作台 API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "胶片转录监控操作台 API v1.1"}


@app.get("/api/devices", response_model=List[schemas.Device])
def read_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    devices = crud.get_devices(db, skip=skip, limit=limit)
    return devices


@app.get("/api/devices/{device_id}", response_model=schemas.Device)
def read_device(device_id: int, db: Session = Depends(get_db)):
    db_device = crud.get_device(db, device_id=device_id)
    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return db_device


@app.post("/api/devices", response_model=schemas.Device)
def create_device(device: schemas.DeviceCreate, db: Session = Depends(get_db)):
    return crud.create_device(db=db, device=device)


@app.put("/api/devices/{device_id}/connect")
def connect_device(device_id: int, db: Session = Depends(get_db)):
    return crud.update_device_status(db=db, device_id=device_id, status="idle", is_connected=True)


@app.put("/api/devices/{device_id}/disconnect")
def disconnect_device(device_id: int, db: Session = Depends(get_db)):
    device = crud.get_device(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    running_sessions = db.query(models.TranscriptionSession).filter(
        models.TranscriptionSession.device_id == device_id,
        models.TranscriptionSession.status == "running"
    ).all()
    for session in running_sessions:
        session.status = "stopped"
        session.end_time = datetime.utcnow()
    db.commit()
    return crud.update_device_status(db=db, device_id=device_id, status="offline", is_connected=False)


@app.put("/api/devices/{device_id}/heartbeat")
def device_heartbeat(device_id: int, db: Session = Depends(get_db)):
    device = crud.get_device(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.last_heartbeat = datetime.utcnow()
    if not device.is_connected:
        device.is_connected = True
        device.status = "idle"
    db.commit()
    db.refresh(device)
    return {"status": "ok", "device": device}


@app.get("/api/devices/{device_id}/parameters", response_model=List[schemas.DeviceParameter])
def read_device_parameters(device_id: int, db: Session = Depends(get_db)):
    return crud.get_device_parameters(db=db, device_id=device_id)


@app.post("/api/devices/{device_id}/parameters", response_model=schemas.DeviceParameter)
def create_device_parameter(device_id: int, param: schemas.DeviceParameterBase, db: Session = Depends(get_db)):
    existing = db.query(models.DeviceParameter).filter(
        models.DeviceParameter.device_id == device_id,
        models.DeviceParameter.key == param.key
    ).first()
    if existing:
        existing.value = param.value
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    param_create = schemas.DeviceParameterCreate(device_id=device_id, **param.dict())
    return crud.create_device_parameter(db=db, param=param_create)


@app.post("/api/devices/{device_id}/diagnose", response_model=schemas.DeviceDiagnosis)
async def diagnose_device(device_id: int, is_auto_restart: bool = False, db: Session = Depends(get_db)):
    device = crud.get_device(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    diagnosis = await run_device_diagnosis(db, device_id, auto_restart=is_auto_restart)
    return diagnosis


@app.get("/api/devices/{device_id}/diagnoses", response_model=List[schemas.DeviceDiagnosis])
def get_device_diagnoses(device_id: int, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud.get_device_diagnoses(db, device_id=device_id, skip=skip, limit=limit)


@app.get("/api/diagnoses/{diagnosis_id}", response_model=schemas.DeviceDiagnosis)
def get_diagnosis(diagnosis_id: int, db: Session = Depends(get_db)):
    diagnosis = crud.get_device_diagnosis(db, diagnosis_id)
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return diagnosis


@app.get("/api/sessions", response_model=List[schemas.TranscriptionSession])
def read_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = crud.get_transcription_sessions(db, skip=skip, limit=limit)
    return sessions


@app.get("/api/sessions/{session_id}", response_model=schemas.TranscriptionSession)
def read_session(session_id: int, db: Session = Depends(get_db)):
    db_session = crud.get_transcription_session(db, session_id=session_id)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


@app.post("/api/sessions", response_model=schemas.TranscriptionSession)
def create_session(session: schemas.TranscriptionSessionCreate, db: Session = Depends(get_db)):
    return crud.create_transcription_session(db=db, session=session)


@app.patch("/api/sessions/{session_id}", response_model=schemas.TranscriptionSession)
def update_session(session_id: int, session_update: schemas.TranscriptionSessionUpdate, db: Session = Depends(get_db)):
    return crud.update_transcription_session(db=db, session_id=session_id, session_update=session_update)


@app.get("/api/sessions/{session_id}/enhancement", response_model=schemas.QualityEnhancement)
def get_enhancement_config(session_id: int, db: Session = Depends(get_db)):
    enhancement = crud.get_quality_enhancement(db, session_id)
    if not enhancement:
        raise HTTPException(status_code=404, detail="Enhancement config not found")
    return enhancement


@app.put("/api/sessions/{session_id}/enhancement", response_model=schemas.QualityEnhancement)
def update_enhancement_config(session_id: int, enhancement: schemas.QualityEnhancementBase, db: Session = Depends(get_db)):
    updated = crud.update_quality_enhancement(db, session_id, enhancement)
    if not updated:
        raise HTTPException(status_code=404, detail="Enhancement config not found")
    return updated


@app.get("/api/sessions/{session_id}/preview", response_model=schemas.PreviewFrameData)
def get_preview_frame(session_id: int, frame_number: Optional[int] = None, db: Session = Depends(get_db)):
    session = crud.get_transcription_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    enhancement = crud.get_quality_enhancement(db, session_id)
    frame = frame_number or session.current_frame or random.randint(0, 1000)
    
    base_psnr = 38.0 + random.uniform(-2, 4)
    base_ssim = 0.90 + random.uniform(-0.05, 0.08)
    
    sharpening_factor = 1 + (enhancement.sharpening or 0) * 0.05
    denoising_factor = 1 + (enhancement.denoising or 0) * 0.03
    contrast_factor = 1 + (enhancement.contrast - 1) * 0.1
    
    enhanced_psnr = min(48.0, base_psnr * sharpening_factor * denoising_factor * contrast_factor)
    enhanced_ssim = min(0.995, base_ssim * sharpening_factor * contrast_factor)
    
    improvement = ((enhanced_psnr - base_psnr) / base_psnr + (enhanced_ssim - base_ssim) / base_ssim) * 50
    
    return schemas.PreviewFrameData(
        frame_number=frame,
        original_quality={"psnr": base_psnr, "ssim": base_ssim},
        enhanced_quality={"psnr": enhanced_psnr, "ssim": enhanced_ssim},
        improvement=improvement
    )


@app.post("/api/transcription/start")
async def start_transcription(control: schemas.TranscriptionControl, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global simulation_task
    if control.session_id is None:
        device = db.query(models.Device).filter(models.Device.is_connected == True).first()
        if not device:
            raise HTTPException(status_code=400, detail="No connected device available")
        session = models.TranscriptionSession(
            device_id=device.id,
            session_name=f"转录任务 {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            status="running",
            total_frames=172800,
            current_frame=0,
            progress=0.0,
            start_time=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        enhancement = models.QualityEnhancement(session_id=session.id)
        db.add(enhancement)
        db.commit()
    else:
        session = crud.start_transcription_session(db=db, session_id=control.session_id)
    
    if simulation_task is None or simulation_task.done():
        simulation_task = asyncio.create_task(simulate_transcription_progress(db))
    
    return {"status": "started", "session_id": session.id}


@app.post("/api/transcription/stop")
async def stop_transcription(control: schemas.TranscriptionControl, db: Session = Depends(get_db)):
    global simulation_task
    if control.session_id:
        crud.stop_transcription_session(db=db, session_id=control.session_id)
    
    running_sessions = db.query(models.TranscriptionSession).filter(models.TranscriptionSession.status == "running").count()
    if running_sessions <= 1:
        simulation_task = None
    
    return {"status": "stopped"}


@app.post("/api/transcription/pause")
async def pause_transcription(control: schemas.TranscriptionControl, db: Session = Depends(get_db)):
    if control.session_id:
        session = crud.get_transcription_session(db, session_id=control.session_id)
        if session:
            session.status = "paused"
            db.commit()
    return {"status": "paused"}


@app.post("/api/transcription/resume")
async def resume_transcription(control: schemas.TranscriptionControl, db: Session = Depends(get_db)):
    global simulation_task
    if control.session_id:
        session = crud.get_transcription_session(db, session_id=control.session_id)
        if session and session.status == "paused":
            session.status = "running"
            db.commit()
    
    if simulation_task is None or simulation_task.done():
        simulation_task = asyncio.create_task(simulate_transcription_progress(db))
    
    return {"status": "resumed"}


@app.get("/api/backups", response_model=List[schemas.ConfigBackup])
def list_backups(device_id: Optional[int] = None, skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_config_backups(db, device_id=device_id, skip=skip, limit=limit)


@app.post("/api/backups", response_model=schemas.ConfigBackup)
def create_backup(backup: schemas.ConfigBackupCreate, db: Session = Depends(get_db)):
    return crud.create_config_backup(db, backup)


@app.get("/api/backups/{backup_id}", response_model=schemas.ConfigBackup)
def get_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = crud.get_config_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    return backup


@app.delete("/api/backups/{backup_id}")
def delete_backup(backup_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_config_backup(db, backup_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"status": "deleted", "backup_id": backup_id}


@app.post("/api/backups/{backup_id}/restore")
def restore_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = crud.get_config_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    if backup.device_id:
        device = crud.get_device(db, backup.device_id)
        if device:
            config_data = backup.config_data
            if "device_info" in config_data:
                info = config_data["device_info"]
                device.name = info.get("name", device.name)
                device.ip_address = info.get("ip_address", device.ip_address)
            
            if "parameters" in config_data:
                for key, value in config_data["parameters"].items():
                    existing = db.query(models.DeviceParameter).filter(
                        models.DeviceParameter.device_id == backup.device_id,
                        models.DeviceParameter.key == key
                    ).first()
                    if existing:
                        existing.value = str(value)
                        existing.updated_at = datetime.utcnow()
                    else:
                        param = models.DeviceParameter(
                            device_id=backup.device_id,
                            key=key,
                            value=str(value)
                        )
                        db.add(param)
            db.commit()
    
    return {"status": "restored", "backup_id": backup_id}


@app.get("/api/alerts", response_model=List[schemas.Alert])
def read_alerts(is_resolved: bool = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_alerts(db=db, is_resolved=is_resolved, skip=skip, limit=limit)


@app.post("/api/alerts", response_model=schemas.Alert)
def create_alert(alert: schemas.AlertCreate, db: Session = Depends(get_db)):
    return crud.create_alert(db=db, alert=alert)


@app.put("/api/alerts/{alert_id}/resolve", response_model=schemas.Alert)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    return crud.resolve_alert(db=db, alert_id=alert_id)


@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    total_devices = db.query(models.Device).count()
    connected_devices = db.query(models.Device).filter(models.Device.is_connected == True).count()
    running_sessions = db.query(models.TranscriptionSession).filter(models.TranscriptionSession.status == "running").count()
    active_alerts = db.query(models.Alert).filter(models.Alert.is_resolved == False).count()
    total_backups = db.query(models.ConfigBackup).count()
    
    return {
        "total_devices": total_devices,
        "connected_devices": connected_devices,
        "running_sessions": running_sessions,
        "active_alerts": active_alerts,
        "total_backups": total_backups
    }


@app.get("/api/storage/path")
def get_storage_path():
    return {
        "base_path": os.path.abspath(STORAGE_BASE_PATH),
        "video_path": os.path.abspath(os.path.join(STORAGE_BASE_PATH, "videos")),
        "log_path": os.path.abspath(os.path.join(STORAGE_BASE_PATH, "logs"))
    }


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
