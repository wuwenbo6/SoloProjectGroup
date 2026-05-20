from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import asyncio
from typing import List, Dict, Optional
import json
import threading
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'typewriter_monitor.db'}"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True)
    name = Column(String)
    status = Column(String, default="offline")
    is_connected = Column(Boolean, default=False)
    last_heartbeat = Column(DateTime)
    connection_attempts = Column(Integer, default=0)
    config = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class CharacterData(Base):
    __tablename__ = "character_data"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    session_id = Column(String, index=True)
    character = Column(String)
    confidence = Column(Float)
    corrected_char = Column(String)
    is_corrected = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

class CollectionRecord(Base):
    __tablename__ = "collection_records"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    session_id = Column(String, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    total_characters = Column(Integer, default=0)
    corrected_count = Column(Integer, default=0)
    accuracy = Column(Float, default=0.0)
    status = Column(String)
    error_message = Column(Text)
    storage_path = Column(String)

class ConfigBackup(Base):
    __tablename__ = "config_backups"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    version = Column(Integer, default=1)
    config_name = Column(String, default="default")
    config_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, default="system")
    is_active = Column(Boolean, default=False)

class DeviceDiagnostic(Base):
    __tablename__ = "device_diagnostics"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    diagnostic_type = Column(String)
    status = Column(String)
    message = Column(Text)
    details = Column(Text)
    resolution = Column(Text)
    auto_restart = Column(Boolean, default=False)
    restart_success = Column(Boolean)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Typewriter Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = threading.Lock()
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._broadcast_task: Optional[asyncio.Task] = None
        self._device_ws_map: Dict[str, WebSocket] = {}
    
    async def start(self):
        if self._broadcast_task is None:
            self._broadcast_task = asyncio.create_task(self._process_queue())
    
    async def _process_queue(self):
        while True:
            try:
                message = await self._message_queue.get()
                await self._do_broadcast(message)
                self._message_queue.task_done()
            except Exception as e:
                print(f"Broadcast error: {e}")
                await asyncio.sleep(0.1)
    
    async def connect(self, websocket: WebSocket, device_id: str = None):
        await websocket.accept()
        with self._lock:
            self.active_connections.append(websocket)
            if device_id:
                self._device_ws_map[device_id] = websocket
        await self.start()
    
    def disconnect(self, websocket: WebSocket, device_id: str = None):
        with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
            if device_id and device_id in self._device_ws_map:
                del self._device_ws_map[device_id]
    
    async def broadcast(self, message: Dict):
        await self._message_queue.put(message)
    
    async def _do_broadcast(self, message: Dict):
        disconnected = []
        with self._lock:
            connections = list(self.active_connections)
        
        for connection in connections:
            try:
                await asyncio.wait_for(connection.send_json(message), timeout=1.0)
            except asyncio.TimeoutError:
                disconnected.append(connection)
            except Exception as e:
                disconnected.append(connection)
        
        for conn in disconnected:
            with self._lock:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)
    
    async def send_to_device(self, device_id: str, message: Dict):
        with self._lock:
            ws = self._device_ws_map.get(device_id)
        if ws:
            try:
                await asyncio.wait_for(ws.send_json(message), timeout=0.5)
                return True
            except:
                pass
        return False

manager = ConnectionManager()
device_sessions: Dict[str, dict] = {}
device_session_lock = threading.Lock()

class DeviceDiagnosticManager:
    def __init__(self):
        self.diagnostic_rules = {
            "heartbeat_failure": self._check_heartbeat,
            "high_error_rate": self._check_error_rate,
            "low_confidence": self._check_confidence,
            "connection_unstable": self._check_connection_stability,
        }
    
    async def run_full_diagnostic(self, device_id: str, db) -> dict:
        results = {}
        for rule_name, rule_func in self.diagnostic_rules.items():
            try:
                result = await rule_func(device_id, db)
                results[rule_name] = result
            except Exception as e:
                results[rule_name] = {"status": "error", "message": str(e)}
        return results
    
    async def _check_heartbeat(self, device_id: str, db) -> dict:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            return {"status": "error", "message": "Device not found"}
        
        if not device.last_heartbeat:
            return {"status": "critical", "message": "从未收到心跳", "resolution": "尝试重启设备连接"}
        
        diff = (datetime.utcnow() - device.last_heartbeat).total_seconds()
        
        if diff > 60:
            return {"status": "critical", "message": f"心跳超时 {int(diff)} 秒", "resolution": "自动重启连接"}
        elif diff > 30:
            return {"status": "warning", "message": f"心跳延迟 {int(diff)} 秒", "resolution": "检查网络连接"}
        
        return {"status": "healthy", "message": "心跳正常"}
    
    async def _check_error_rate(self, device_id: str, db) -> dict:
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_records = db.query(CollectionRecord).filter(
            CollectionRecord.device_id == device_id,
            CollectionRecord.start_time >= one_hour_ago
        ).all()
        
        if not recent_records:
            return {"status": "unknown", "message": "暂无采集数据"}
        
        total_chars = sum(r.total_characters for r in recent_records)
        total_corrected = sum(r.corrected_count for r in recent_records)
        
        if total_chars == 0:
            return {"status": "unknown", "message": "暂无字符数据"}
        
        error_rate = total_corrected / total_chars
        
        if error_rate > 0.2:
            return {"status": "critical", "message": f"错误率过高: {error_rate:.1%}", "resolution": "校准识别器参数"}
        elif error_rate > 0.1:
            return {"status": "warning", "message": f"错误率偏高: {error_rate:.1%}", "resolution": "检查设备状态"}
        
        return {"status": "healthy", "message": f"错误率正常: {error_rate:.1%}"}
    
    async def _check_confidence(self, device_id: str, db) -> dict:
        recent_chars = db.query(CharacterData).filter(
            CharacterData.device_id == device_id
        ).order_by(CharacterData.timestamp.desc()).limit(100).all()
        
        if not recent_chars:
            return {"status": "unknown", "message": "暂无识别数据"}
        
        avg_confidence = sum(c.confidence for c in recent_chars) / len(recent_chars)
        
        if avg_confidence < 0.5:
            return {"status": "critical", "message": f"平均置信度过低: {avg_confidence:.1%}", "resolution": "检查摄像头/传感器"}
        elif avg_confidence < 0.7:
            return {"status": "warning", "message": f"平均置信度偏低: {avg_confidence:.1%}", "resolution": "调整采样参数"}
        
        return {"status": "healthy", "message": f"平均置信度正常: {avg_confidence:.1%}"}
    
    async def _check_connection_stability(self, device_id: str, db) -> dict:
        one_day_ago = datetime.utcnow() - timedelta(days=1)
        diagnostics = db.query(DeviceDiagnostic).filter(
            DeviceDiagnostic.device_id == device_id,
            DeviceDiagnostic.diagnostic_type == "heartbeat_failure",
            DeviceDiagnostic.timestamp >= one_day_ago
        ).count()
        
        if diagnostics >= 10:
            return {"status": "critical", "message": f"24小时内断连 {diagnostics} 次", "resolution": "硬件故障排查"}
        elif diagnostics >= 5:
            return {"status": "warning", "message": f"24小时内断连 {diagnostics} 次", "resolution": "检查网络稳定性"}
        
        return {"status": "healthy", "message": "连接状态稳定"}
    
    async def try_auto_restart(self, device_id: str, db) -> dict:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            return {"success": False, "message": "设备不存在"}
        
        original_status = device.status
        
        device.is_connected = False
        device.status = "restarting"
        device.connection_attempts = 0
        db.commit()
        
        await manager.broadcast({
            "type": "device_restarting",
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        await asyncio.sleep(2)
        
        device.is_connected = True
        device.status = "online"
        device.last_heartbeat = datetime.utcnow()
        db.commit()
        
        await manager.broadcast({
            "type": "device_restarted",
            "device_id": device_id,
            "previous_status": original_status,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {"success": True, "message": "设备重启成功"}

diagnostic_manager = DeviceDiagnosticManager()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from pydantic import BaseModel
from fastapi import Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

class DeviceCreate(BaseModel):
    device_id: str
    name: str

class DeviceConfig(BaseModel):
    sample_rate: int = 100
    confidence_threshold: float = 0.8
    auto_save: bool = True

class CharacterDataInput(BaseModel):
    device_id: str
    character: str
    confidence: float
    session_id: str = None

class AlertInput(BaseModel):
    device_id: str
    alert_type: str
    message: str

@app.get("/")
async def root():
    return {"message": "Typewriter Monitor API"}

@app.get("/api/devices")
async def get_devices(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    return [
        {
            "id": d.id,
            "device_id": d.device_id,
            "name": d.name,
            "status": d.status,
            "is_connected": d.is_connected,
            "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
            "config": json.loads(d.config) if d.config else None,
            "created_at": d.created_at.isoformat()
        }
        for d in devices
    ]

@app.post("/api/devices")
async def register_device(device: DeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(Device).filter(Device.device_id == device.device_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device already registered")
    
    default_config = json.dumps({
        "sample_rate": 100,
        "confidence_threshold": 0.8,
        "auto_save": True
    })
    db_device = Device(device_id=device.device_id, name=device.name, config=default_config)
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return {"message": "Device registered successfully", "device_id": device.device_id}

@app.get("/api/devices/{device_id}")
async def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return {
        "id": device.id,
        "device_id": device.device_id,
        "name": device.name,
        "status": device.status,
        "is_connected": device.is_connected,
        "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
        "config": json.loads(device.config) if device.config else None,
        "created_at": device.created_at.isoformat()
    }

@app.put("/api/devices/{device_id}/config")
async def update_device_config(device_id: str, config: DeviceConfig, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.config = json.dumps(config.dict())
    db.commit()
    await manager.broadcast({
        "type": "config_updated",
        "device_id": device_id,
        "config": config.dict()
    })
    return {"message": "Config updated", "config": config.dict()}

@app.post("/api/devices/{device_id}/connect")
async def connect_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.is_connected = True
    device.status = "online"
    device.last_heartbeat = datetime.utcnow()
    device.connection_attempts = 0
    db.commit()
    
    await manager.broadcast({
        "type": "device_status",
        "device_id": device_id,
        "status": "online",
        "is_connected": True
    })
    return {"message": "Device connected", "heartbeat_interval": 30}

@app.post("/api/devices/{device_id}/disconnect")
async def disconnect_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    with device_session_lock:
        if device_id in device_sessions:
            del device_sessions[device_id]
    
    device.is_connected = False
    device.status = "offline"
    db.commit()
    
    await manager.broadcast({
        "type": "device_status",
        "device_id": device_id,
        "status": "offline",
        "is_connected": False
    })
    return {"message": "Device disconnected"}

class CharacterCorrector:
    def __init__(self):
        self.keyboard_map = {
            'q': ['w', 'a', '1'],
            'w': ['q', 'e', 's', 'a'],
            'e': ['w', 'r', 'd', 's'],
            'r': ['e', 't', 'f', 'd'],
            't': ['r', 'y', 'g', 'f'],
            'y': ['t', 'u', 'h', 'g'],
            'u': ['y', 'i', 'j', 'h'],
            'i': ['u', 'o', 'k', 'j'],
            'o': ['i', 'p', 'l', 'k'],
            'p': ['o', 'l'],
            'a': ['q', 'w', 's', 'z'],
            's': ['a', 'w', 'e', 'd', 'x', 'z'],
            'd': ['s', 'e', 'r', 'f', 'c', 'x'],
            'f': ['d', 'r', 't', 'g', 'v', 'c'],
            'g': ['f', 't', 'y', 'h', 'b', 'v'],
            'h': ['g', 'y', 'u', 'j', 'n', 'b'],
            'j': ['h', 'u', 'i', 'k', 'm', 'n'],
            'k': ['j', 'i', 'o', 'l', 'm'],
            'l': ['k', 'o', 'p'],
            'z': ['a', 's', 'x'],
            'x': ['z', 's', 'd', 'c'],
            'c': ['x', 'd', 'f', 'v'],
            'v': ['c', 'f', 'g', 'b'],
            'b': ['v', 'g', 'h', 'n'],
            'n': ['b', 'h', 'j', 'm'],
            'm': ['n', 'j', 'k'],
        }
        self.confidence_threshold = 0.7
    
    def correct_character(self, char: str, confidence: float, context: List[str] = None) -> tuple:
        if confidence >= self.confidence_threshold:
            return char, False
        
        lower_char = char.lower()
        
        if context and len(context) >= 2:
            context_str = ''.join(context[-3:]).lower()
            corrections = self._get_context_corrections(context_str, lower_char)
            if corrections:
                return corrections[0], True
        
        if lower_char in self.keyboard_map and confidence >= 0.3:
            return self.keyboard_map[lower_char][0], True
        
        return char, False
    
    def _get_context_corrections(self, context: str, char: str) -> List[str]:
        common_sequences = {
            'th': ['t', 'h'],
            'he': ['h', 'e'],
            'in': ['i', 'n'],
            'er': ['e', 'r'],
            'an': ['a', 'n'],
            're': ['r', 'e'],
            'es': ['e', 's'],
            'on': ['o', 'n'],
            'st': ['s', 't'],
            'ed': ['e', 'd'],
        }
        
        if len(context) >= 1:
            last_char = context[-1]
            for seq, chars in common_sequences.items():
                if seq[0] == last_char and char in chars[1:] or chars[1] in self.keyboard_map.get(char, []):
                    return [chars[1]]
        
        return []

corrector = CharacterCorrector()

@app.post("/api/collect/start")
async def start_collection(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.is_connected:
        raise HTTPException(status_code=400, detail="Device not connected")
    
    session_id = str(uuid.uuid4())
    
    session_path = DATA_DIR / "sessions" / session_id
    session_path.mkdir(parents=True, exist_ok=True)
    
    record = CollectionRecord(
        device_id=device_id,
        session_id=session_id,
        start_time=datetime.utcnow(),
        status="collecting",
        storage_path=str(session_path)
    )
    db.add(record)
    device.status = "collecting"
    db.commit()
    
    with device_session_lock:
        device_sessions[device_id] = {
            "session_id": session_id,
            "start_time": datetime.utcnow(),
            "char_count": 0,
            "corrected_count": 0,
            "context": [],
            "storage_path": str(session_path)
        }
    
    await manager.broadcast({
        "type": "collection_started",
        "device_id": device_id,
        "session_id": session_id
    })
    return {"message": "Collection started", "session_id": session_id, "storage_path": str(session_path)}

@app.post("/api/collect/stop")
async def stop_collection(device_id: str, db: Session = Depends(get_db)):
    with device_session_lock:
        if device_id not in device_sessions:
            raise HTTPException(status_code=400, detail="No active collection")
        
        session = device_sessions.pop(device_id)
    
    record = db.query(CollectionRecord).filter(
        CollectionRecord.session_id == session["session_id"]
    ).first()
    
    if record:
        record.end_time = datetime.utcnow()
        record.total_characters = session["char_count"]
        record.corrected_count = session["corrected_count"]
        record.accuracy = (session["char_count"] - session["corrected_count"]) / session["char_count"] if session["char_count"] > 0 else 1.0
        record.status = "completed"
    
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if device:
        device.status = "online"
    
    db.commit()
    
    await manager.broadcast({
        "type": "collection_stopped",
        "device_id": device_id,
        "session_id": session["session_id"],
        "total_characters": session["char_count"],
        "corrected_count": session["corrected_count"],
        "accuracy": (session["char_count"] - session["corrected_count"]) / session["char_count"] if session["char_count"] > 0 else 1.0
    })
    return {
        "message": "Collection stopped",
        "total_characters": session["char_count"],
        "corrected_count": session["corrected_count"],
        "accuracy": (session["char_count"] - session["corrected_count"]) / session["char_count"] if session["char_count"] > 0 else 1.0
    }

@app.post("/api/collect/character")
async def collect_character(data: CharacterDataInput, db: Session = Depends(get_db)):
    session_id = data.session_id
    context = []
    
    with device_session_lock:
        if not session_id and data.device_id in device_sessions:
            session_id = device_sessions[data.device_id]["session_id"]
            context = device_sessions[data.device_id].get("context", [])
    
    corrected_char, is_corrected = corrector.correct_character(
        data.character, 
        data.confidence,
        context
    )
    
    char_record = CharacterData(
        device_id=data.device_id,
        character=data.character,
        confidence=data.confidence,
        corrected_char=corrected_char,
        is_corrected=is_corrected,
        session_id=session_id
    )
    db.add(char_record)
    
    with device_session_lock:
        if data.device_id in device_sessions:
            device_sessions[data.device_id]["char_count"] += 1
            device_sessions[data.device_id]["context"].append(corrected_char)
            if is_corrected:
                device_sessions[data.device_id]["corrected_count"] += 1
            
            record = db.query(CollectionRecord).filter(
                CollectionRecord.session_id == session_id
            ).first()
            if record:
                record.total_characters = device_sessions[data.device_id]["char_count"]
                record.corrected_count = device_sessions[data.device_id]["corrected_count"]
    
    db.commit()
    
    await manager.broadcast({
        "type": "character_collected",
        "device_id": data.device_id,
        "character": corrected_char,
        "original_character": data.character,
        "confidence": data.confidence,
        "is_corrected": is_corrected,
        "timestamp": datetime.utcnow().isoformat(),
        "session_id": session_id
    })
    return {
        "message": "Character collected",
        "character": corrected_char,
        "original_character": data.character,
        "is_corrected": is_corrected
    }

@app.post("/api/alerts")
async def send_alert(alert: AlertInput):
    await manager.broadcast({
        "type": "alert",
        "device_id": alert.device_id,
        "alert_type": alert.alert_type,
        "message": alert.message,
        "timestamp": datetime.utcnow().isoformat()
    })
    return {"message": "Alert sent"}

class ConfigBackupInput(BaseModel):
    config_name: str = "default"

@app.get("/api/config/backups")
async def get_config_backups(device_id: str = None, db: Session = Depends(get_db)):
    query = db.query(ConfigBackup)
    if device_id:
        query = query.filter(ConfigBackup.device_id == device_id)
    backups = query.order_by(ConfigBackup.created_at.desc()).limit(20).all()
    return [
        {
            "id": b.id,
            "device_id": b.device_id,
            "version": b.version,
            "config_name": b.config_name,
            "config_data": json.loads(b.config_data) if b.config_data else None,
            "created_at": b.created_at.isoformat(),
            "created_by": b.created_by,
            "is_active": b.is_active
        }
        for b in backups
    ]

@app.post("/api/config/backup")
async def create_config_backup(device_id: str, backup: ConfigBackupInput = None, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    last_backup = db.query(ConfigBackup).filter(
        ConfigBackup.device_id == device_id
    ).order_by(ConfigBackup.version.desc()).first()
    version = last_backup.version + 1 if last_backup else 1
    
    db.query(ConfigBackup).filter(ConfigBackup.device_id == device_id).update({"is_active": False})
    
    new_backup = ConfigBackup(
        device_id=device_id,
        version=version,
        config_name=backup.config_name if backup else f"v{version}",
        config_data=device.config,
        is_active=True,
        created_by="user"
    )
    db.add(new_backup)
    db.commit()
    
    return {
        "message": "Config backup created",
        "version": version,
        "config_name": new_backup.config_name
    }

@app.post("/api/config/restore/{backup_id}")
async def restore_config_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = db.query(ConfigBackup).filter(ConfigBackup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    device = db.query(Device).filter(Device.device_id == backup.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.config = backup.config_data
    
    db.query(ConfigBackup).filter(ConfigBackup.device_id == backup.device_id).update({"is_active": False})
    backup.is_active = True
    db.commit()
    
    await manager.broadcast({
        "type": "config_restored",
        "device_id": backup.device_id,
        "backup_id": backup_id,
        "version": backup.version
    })
    
    return {"message": "Config restored successfully"}

@app.delete("/api/config/backup/{backup_id}")
async def delete_config_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = db.query(ConfigBackup).filter(ConfigBackup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    db.delete(backup)
    db.commit()
    return {"message": "Backup deleted"}

@app.get("/api/diagnostics/{device_id}")
async def get_device_diagnostics(device_id: str, db: Session = Depends(get_db)):
    results = await diagnostic_manager.run_full_diagnostic(device_id, db)
    
    diagnostics = db.query(DeviceDiagnostic).filter(
        DeviceDiagnostic.device_id == device_id
    ).order_by(DeviceDiagnostic.timestamp.desc()).limit(10).all()
    
    return {
        "current_status": results,
        "overall_health": "healthy" if all(r.get("status") in ["healthy", "unknown"] for r in results.values()) else "warning" if any(r.get("status") == "warning" for r in results.values()) else "critical",
        "history": [
            {
                "id": d.id,
                "type": d.diagnostic_type,
                "status": d.status,
                "message": d.message,
                "resolution": d.resolution,
                "auto_restart": d.auto_restart,
                "timestamp": d.timestamp.isoformat()
            }
            for d in diagnostics
        ]
    }

@app.post("/api/diagnostics/{device_id}/restart")
async def restart_device(device_id: str, auto_restart: bool = True, db: Session = Depends(get_db)):
    result = await diagnostic_manager.try_auto_restart(device_id, db)
    
    diagnostic = DeviceDiagnostic(
        device_id=device_id,
        diagnostic_type="manual_restart",
        status="success" if result["success"] else "failed",
        message=result["message"],
        auto_restart=auto_restart,
        restart_success=result["success"]
    )
    db.add(diagnostic)
    db.commit()
    
    return result

@app.get("/api/diagnostics/overview")
async def get_diagnostics_overview(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    overview = []
    
    for device in devices:
        results = await diagnostic_manager.run_full_diagnostic(device.device_id, db)
        health_status = "healthy"
        if any(r.get("status") == "critical" for r in results.values()):
            health_status = "critical"
        elif any(r.get("status") == "warning" for r in results.values()):
            health_status = "warning"
        
        overview.append({
            "device_id": device.device_id,
            "name": device.name,
            "status": device.status,
            "is_connected": device.is_connected,
            "health_status": health_status,
            "checks": results
        })
    
    return overview

@app.get("/api/records")
async def get_records(device_id: str = None, db: Session = Depends(get_db)):
    query = db.query(CollectionRecord)
    if device_id:
        query = query.filter(CollectionRecord.device_id == device_id)
    records = query.order_by(CollectionRecord.start_time.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "device_id": r.device_id,
            "session_id": r.session_id,
            "start_time": r.start_time.isoformat() if r.start_time else None,
            "end_time": r.end_time.isoformat() if r.end_time else None,
            "total_characters": r.total_characters,
            "corrected_count": r.corrected_count,
            "accuracy": r.accuracy,
            "status": r.status,
            "storage_path": r.storage_path,
            "error_message": r.error_message
        }
        for r in records
    ]

@app.get("/api/characters/{session_id}")
async def get_session_characters(session_id: str, db: Session = Depends(get_db)):
    chars = db.query(CharacterData).filter(
        CharacterData.session_id == session_id
    ).order_by(CharacterData.timestamp).all()
    return [
        {
            "id": c.id,
            "character": c.corrected_char if c.is_corrected else c.character,
            "original_character": c.character,
            "confidence": c.confidence,
            "is_corrected": c.is_corrected,
            "timestamp": c.timestamp.isoformat()
        }
        for c in chars
    ]

@app.post("/api/devices/{device_id}/heartbeat")
async def device_heartbeat(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.last_heartbeat = datetime.utcnow()
    device.connection_attempts = 0
    
    if not device.is_connected:
        device.is_connected = True
        if device.status == "offline":
            device.status = "online"
        await manager.broadcast({
            "type": "device_status",
            "device_id": device_id,
            "status": device.status,
            "is_connected": True
        })
    
    db.commit()
    return {"message": "Heartbeat received", "server_time": datetime.utcnow().isoformat()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    device_id = None
    try:
        await websocket.accept()
        
        initial_data = await websocket.receive_json()
        if isinstance(initial_data, dict) and initial_data.get("type") == "device_connect":
            device_id = initial_data.get("device_id")
        
        await manager.connect(websocket, device_id)
        
        if device_id:
            await manager.broadcast({
                "type": "device_connected",
                "device_id": device_id,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                try:
                    message = json.loads(data)
                    if message.get("type") == "pong":
                        continue
                except:
                    pass
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue
    except WebSocketDisconnect:
        manager.disconnect(websocket, device_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, device_id)

async def check_device_status():
    while True:
        await asyncio.sleep(15)
        db = SessionLocal()
        try:
            devices = db.query(Device).filter(Device.is_connected == True).all()
            now = datetime.utcnow()
            for device in devices:
                if device.last_heartbeat:
                    diff = (now - device.last_heartbeat).total_seconds()
                    if diff > 45:
                        device.connection_attempts += 1
                        if device.connection_attempts >= 3:
                            device.is_connected = False
                            device.status = "offline"
                            
                            with device_session_lock:
                                if device.device_id in device_sessions:
                                    session = device_sessions.pop(device.device_id)
                                    record = db.query(CollectionRecord).filter(
                                        CollectionRecord.session_id == session["session_id"]
                                    ).first()
                                    if record:
                                        record.end_time = now
                                        record.total_characters = session["char_count"]
                                        record.corrected_count = session["corrected_count"]
                                        record.accuracy = (session["char_count"] - session["corrected_count"]) / session["char_count"] if session["char_count"] > 0 else 1.0
                                        record.status = "interrupted"
                                        record.error_message = "Connection timeout"
                            
                            await manager.broadcast({
                                "type": "alert",
                                "device_id": device.device_id,
                                "alert_type": "timeout",
                                "message": f"设备 {device.name} 连接超时，已自动断开",
                                "timestamp": now.isoformat()
                            })
                        else:
                            await manager.broadcast({
                                "type": "alert",
                                "device_id": device.device_id,
                                "alert_type": "warning",
                                "message": f"设备 {device.name} 心跳延迟 ({diff:.0f}秒)，尝试 {device.connection_attempts}/3",
                                "timestamp": now.isoformat()
                            })
            db.commit()
        except Exception as e:
            print(f"Device status check error: {e}")
        finally:
            db.close()

@app.on_event("startup")
async def startup_event():
    await manager.start()
    asyncio.create_task(check_device_status())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)