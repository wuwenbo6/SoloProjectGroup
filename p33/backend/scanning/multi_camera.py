from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import uuid
import threading
from queue import Queue
from database import get_db
from models import ScanSession, PhotoArchive
from camera.driver import camera_manager

router = APIRouter(prefix="/api/scanning/multi")


class MultiScanConfig(BaseModel):
    device_id: str
    film_type: str = "Unknown"
    total_frames: int = 36
    output_directory: Optional[str] = None
    profile_id: Optional[int] = None
    performance_mode: str = "balanced"
    frame_skip: int = 0
    low_power_mode: bool = False


class ScanSessionResponse(BaseModel):
    id: int
    device_id: str
    device_name: str
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    total_frames: int
    processed_frames: int
    failed_frames: int
    film_type: Optional[str]

    class Config:
        orm_mode = True


class MultiCameraScanner:
    def __init__(self):
        self.active_sessions: Dict[str, dict] = {}
        self.session_threads: Dict[str, threading.Thread] = {}
        self.frame_queues: Dict[str, Queue] = {}
        self._lock = threading.Lock()

    def _simulate_scan_worker(self, session_id: str, config: MultiScanConfig, device_name: str):
        from database import SessionLocal
        db = SessionLocal()
        try:
            session = db.query(ScanSession).filter(ScanSession.id == int(session_id)).first()
            if not session:
                return

            for i in range(config.total_frames):
                with self._lock:
                    if session_id not in self.active_sessions or self.active_sessions[session_id].get("stopped"):
                        break

                if config.frame_skip > 0 and i % (config.frame_skip + 1) != 0:
                    continue

                try:
                    delay = {
                        "fast": 0.5,
                        "balanced": 1.0,
                        "high_quality": 2.0
                    }.get(config.performance_mode, 1.0)

                    if config.low_power_mode:
                        delay *= 1.5

                    import time
                    time.sleep(delay)

                    filename = f"{device_name.replace(' ', '_')}_frame_{i+1:04d}.tiff"
                    photo = PhotoArchive(
                        filename=filename,
                        original_path=f"{config.output_directory or './output'}/{filename}",
                        archived_path=f"{config.output_directory or './output'}/{filename}",
                        file_format="tiff",
                        camera_model=device_name,
                        film_type=config.film_type,
                        device_id=config.device_id,
                        scan_session_id=int(session_id)
                    )
                    db.add(photo)
                    db.commit()

                    session.processed_frames += 1
                    db.commit()

                except Exception as e:
                    session.failed_frames += 1
                    db.commit()
                    continue

            session.status = "completed"
            session.end_time = datetime.now()
            db.commit()

        finally:
            with self._lock:
                if session_id in self.active_sessions:
                    del self.active_sessions[session_id]
            db.close()

    def start_scan_session(self, db: Session, config: MultiScanConfig) -> ScanSession:
        if config.device_id not in camera_manager.connected_devices:
            raise HTTPException(status_code=400, detail="设备未连接")

        device = camera_manager.connected_devices[config.device_id]
        device_name = getattr(device, 'name', config.device_id)

        session = ScanSession(
            device_id=config.device_id,
            device_name=device_name,
            status="running",
            total_frames=config.total_frames,
            processed_frames=0,
            failed_frames=0,
            film_type=config.film_type,
            output_directory=config.output_directory,
            profile_id=config.profile_id
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        session_id = str(session.id)
        with self._lock:
            self.active_sessions[session_id] = {
                "config": config.dict(),
                "started": datetime.now(),
                "stopped": False
            }

        thread = threading.Thread(
            target=self._simulate_scan_worker,
            args=(session_id, config, device_name),
            daemon=True
        )
        self.session_threads[session_id] = thread
        thread.start()

        return session

    def stop_scan_session(self, db: Session, session_id: int) -> bool:
        session_id_str = str(session_id)
        with self._lock:
            if session_id_str in self.active_sessions:
                self.active_sessions[session_id_str]["stopped"] = True

        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if session:
            session.status = "stopped"
            session.end_time = datetime.now()
            db.commit()
            return True
        return False

    def get_all_active_sessions(self, db: Session) -> List[ScanSession]:
        return db.query(ScanSession).filter(ScanSession.status == "running").all()

    def get_session_detail(self, db: Session, session_id: int) -> Optional[ScanSession]:
        return db.query(ScanSession).filter(ScanSession.id == session_id).first()

    def get_session_photos(self, db: Session, session_id: int) -> List[PhotoArchive]:
        return db.query(PhotoArchive).filter(PhotoArchive.scan_session_id == session_id).all()

    def get_device_status(self) -> List[Dict[str, Any]]:
        status_list = []
        for device_id in camera_manager.connected_devices:
            device = camera_manager.connected_devices[device_id]
            active_session = None
            for sid, session_data in self.active_sessions.items():
                if session_data["config"]["device_id"] == device_id:
                    active_session = sid
                    break

            status_list.append({
                "device_id": device_id,
                "device_name": getattr(device, 'name', device_id),
                "is_scanning": active_session is not None,
                "active_session_id": active_session
            })
        return status_list

    def start_batch_scan(self, db: Session, configs: List[MultiScanConfig]) -> List[ScanSession]:
        sessions = []
        for config in configs:
            try:
                session = self.start_scan_session(db, config)
                sessions.append(session)
            except:
                continue
        return sessions

    def stop_all_sessions(self, db: Session) -> int:
        stopped_count = 0
        active_sessions = self.get_all_active_sessions(db)
        for session in active_sessions:
            if self.stop_scan_session(db, session.id):
                stopped_count += 1
        return stopped_count

    def get_session_statistics(self, db: Session, session_id: int) -> Dict[str, Any]:
        session = self.get_session_detail(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        photos = self.get_session_photos(db, session_id)
        total_size = sum(p.file_size or 0 for p in photos)

        elapsed = None
        if session.end_time:
            elapsed = (session.end_time - session.start_time).total_seconds()
        elif session.status == "running":
            elapsed = (datetime.now() - session.start_time).total_seconds()

        avg_time_per_frame = elapsed / session.processed_frames if elapsed and session.processed_frames else None
        estimated_remaining = None
        if avg_time_per_frame and session.total_frames > session.processed_frames:
            estimated_remaining = avg_time_per_frame * (session.total_frames - session.processed_frames)

        return {
            "session_id": session.id,
            "status": session.status,
            "total_frames": session.total_frames,
            "processed_frames": session.processed_frames,
            "failed_frames": session.failed_frames,
            "success_rate": session.processed_frames / session.total_frames if session.total_frames > 0 else 0,
            "photo_count": len(photos),
            "total_size_mb": total_size / (1024 * 1024),
            "elapsed_seconds": elapsed,
            "avg_time_per_frame": avg_time_per_frame,
            "estimated_remaining_seconds": estimated_remaining
        }


multi_scanner = MultiCameraScanner()


@router.post("/start", response_model=ScanSessionResponse)
async def start_multi_camera_scan(config: MultiScanConfig, db: Session = Depends(get_db)):
    return multi_scanner.start_scan_session(db, config)


@router.post("/stop/{session_id}")
async def stop_multi_camera_scan(session_id: int, db: Session = Depends(get_db)):
    success = multi_scanner.stop_scan_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"status": "success", "message": "扫描已停止"}


@router.get("/active", response_model=List[ScanSessionResponse])
async def list_active_sessions(db: Session = Depends(get_db)):
    return multi_scanner.get_all_active_sessions(db)


@router.get("/session/{session_id}")
async def get_scan_session_detail(session_id: int, db: Session = Depends(get_db)):
    session = multi_scanner.get_session_detail(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@router.get("/session/{session_id}/photos")
async def get_session_photos(session_id: int, db: Session = Depends(get_db)):
    photos = multi_scanner.get_session_photos(db, session_id)
    return {
        "count": len(photos),
        "photos": [
            {
                "id": p.id,
                "filename": p.filename,
                "film_type": p.film_type,
                "scan_date": p.scan_date
            }
            for p in photos
        ]
    }


@router.get("/devices/status")
async def get_devices_status():
    return {"devices": multi_scanner.get_device_status()}


@router.post("/batch/start")
async def start_batch_scan(configs: List[MultiScanConfig], db: Session = Depends(get_db)):
    sessions = multi_scanner.start_batch_scan(db, configs)
    return {
        "started_count": len(sessions),
        "sessions": [
            {
                "id": s.id,
                "device_id": s.device_id,
                "device_name": s.device_name
            }
            for s in sessions
        ]
    }


@router.post("/batch/stop")
async def stop_all_scans(db: Session = Depends(get_db)):
    stopped = multi_scanner.stop_all_sessions(db)
    return {"stopped_count": stopped}


@router.get("/session/{session_id}/statistics")
async def get_session_statistics(session_id: int, db: Session = Depends(get_db)):
    return multi_scanner.get_session_statistics(db, session_id)


@router.get("/history")
async def get_scan_history(skip: int = 0, limit: int = 50, status: Optional[str] = None,
                           db: Session = Depends(get_db)):
    query = db.query(ScanSession)
    if status:
        query = query.filter(ScanSession.status == status)
    sessions = query.order_by(ScanSession.start_time.desc()).offset(skip).limit(limit).all()
    return {
        "count": len(sessions),
        "sessions": sessions
    }
