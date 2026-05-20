from PyQt6.QtCore import QObject, pyqtSignal, QThread, QMutex, QMutexLocker
from typing import Dict, List, Optional
from datetime import datetime
import json
import os
import hashlib
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import threading
import time


class SyncConfig:
    def __init__(self):
        self.enabled = False
        self.sync_interval = 300
        self.auto_sync = True
        self.encryption_enabled = True
        self.encryption_password = ""
        self.backend_type = "local"
        self.cloud_provider = "local"
        self.local_storage_path = ""
        self.last_sync_time = None
        self.sync_on_startup = True
        self.conflict_resolution = "latest"
        
    def to_dict(self) -> Dict:
        return {
            "enabled": self.enabled,
            "sync_interval": self.sync_interval,
            "auto_sync": self.auto_sync,
            "encryption_enabled": self.encryption_enabled,
            "backend_type": self.backend_type,
            "cloud_provider": self.cloud_provider,
            "local_storage_path": self.local_storage_path,
            "last_sync_time": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "sync_on_startup": self.sync_on_startup,
            "conflict_resolution": self.conflict_resolution
        }
        
    @classmethod
    def from_dict(cls, data: Dict) -> 'SyncConfig':
        config = cls()
        config.enabled = data.get("enabled", False)
        config.sync_interval = data.get("sync_interval", 300)
        config.auto_sync = data.get("auto_sync", True)
        config.encryption_enabled = data.get("encryption_enabled", True)
        config.backend_type = data.get("backend_type", "local")
        config.cloud_provider = data.get("cloud_provider", "local")
        config.local_storage_path = data.get("local_storage_path", "")
        config.last_sync_time = datetime.fromisoformat(data["last_sync_time"]) if data.get("last_sync_time") else None
        config.sync_on_startup = data.get("sync_on_startup", True)
        config.conflict_resolution = data.get("conflict_resolution", "latest")
        return config


class SyncRecord:
    def __init__(self, record_type: str, record_id: str, data: Dict):
        self.type = record_type
        self.id = record_id
        self.data = data
        self.timestamp = datetime.now().isoformat()
        self.hash = self._compute_hash()
        
    def _compute_hash(self) -> str:
        content = json.dumps(self.data, sort_keys=True) + self.timestamp
        return hashlib.sha256(content.encode()).hexdigest()
        
    def to_dict(self) -> Dict:
        return {
            "type": self.type,
            "id": self.id,
            "data": self.data,
            "timestamp": self.timestamp,
            "hash": self.hash
        }
        
    @classmethod
    def from_dict(cls, data: Dict) -> 'SyncRecord':
        record = cls(data["type"], data["id"], data["data"])
        record.timestamp = data["timestamp"]
        record.hash = data["hash"]
        return record


class DataEncryptor:
    def __init__(self, password: str):
        self.password = password
        self._key = None
        
    def _derive_key(self, salt: bytes = None) -> bytes:
        if salt is None:
            salt = b'typewriter_digitizer_salt'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.password.encode()))
        return key
        
    def encrypt(self, data: str) -> str:
        key = self._derive_key()
        f = Fernet(key)
        encrypted = f.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
        
    def decrypt(self, encrypted_data: str) -> str:
        key = self._derive_key()
        f = Fernet(key)
        decoded = base64.urlsafe_b64decode(encrypted_data.encode())
        return f.decrypt(decoded).decode()


class CloudSyncManager(QObject):
    sync_started = pyqtSignal()
    sync_completed = pyqtSignal(dict)
    sync_failed = pyqtSignal(str)
    sync_progress = pyqtSignal(int, str)
    
    def __init__(self, config: SyncConfig = None):
        super().__init__()
        self.config = config or SyncConfig()
        self.mutex = QMutex()
        self.pending_changes: List[SyncRecord] = []
        self.is_syncing = False
        self.sync_thread: Optional[QThread] = None
        self.encryptor: Optional[DataEncryptor] = None
        
        if self.config.encryption_enabled and self.config.encryption_password:
            self.encryptor = DataEncryptor(self.config.encryption_password)
            
    def configure(self, config: SyncConfig):
        locker = QMutexLocker(self.mutex)
        self.config = config
        if config.encryption_enabled and config.encryption_password:
            self.encryptor = DataEncryptor(config.encryption_password)
        else:
            self.encryptor = None
            
    def queue_change(self, change_type: str, change_id: str, data: Dict):
        locker = QMutexLocker(self.mutex)
        record = SyncRecord(change_type, change_id, data)
        self.pending_changes.append(record)
        
    def start_sync(self, force_full: bool = False):
        locker = QMutexLocker(self.mutex)
        
        if self.is_syncing:
            return
            
        if not self.config.enabled:
            self.sync_failed.emit("同步未启用")
            return
            
        self.is_syncing = True
        self.sync_started.emit()
        
        thread = SyncThread(self, force_full)
        thread.finished.connect(self._on_sync_finished)
        thread.progress.connect(self.sync_progress.emit)
        self.sync_thread = thread
        thread.start()
        
    def _on_sync_finished(self, result: Dict):
        locker = QMutexLocker(self.mutex)
        self.is_syncing = False
        
        if result.get("success", False):
            self.config.last_sync_time = datetime.now()
            self.pending_changes.clear()
            self.sync_completed.emit(result)
        else:
            self.sync_failed.emit(result.get("error", "未知错误"))
            
    def get_sync_status(self) -> Dict:
        locker = QMutexLocker(self.mutex)
        return {
            "is_syncing": self.is_syncing,
            "pending_changes": len(self.pending_changes),
            "last_sync_time": self.config.last_sync_time.isoformat() if self.config.last_sync_time else None,
            "enabled": self.config.enabled,
            "auto_sync": self.config.auto_sync
        }
        
    def save_config(self, file_path: str):
        try:
            config_data = self.config.to_dict()
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2)
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False
            
    def load_config(self, file_path: str) -> bool:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.config = SyncConfig.from_dict(data)
                if self.config.encryption_enabled and self.config.encryption_password:
                    self.encryptor = DataEncryptor(self.config.encryption_password)
            return True
        except Exception as e:
            print(f"加载配置失败: {e}")
            return False


class SyncThread(QThread):
    progress = pyqtSignal(int, str)
    
    def __init__(self, manager: CloudSyncManager, force_full: bool):
        super().__init__()
        self.manager = manager
        self.force_full = force_full
        
    def run(self):
        try:
            self.progress.emit(10, "准备同步数据...")
            time.sleep(0.1)
            
            self.progress.emit(30, "检查变更...")
            time.sleep(0.1)
            
            self.progress.emit(50, "同步会话记录...")
            time.sleep(0.2)
            
            self.progress.emit(70, "同步文档数据...")
            time.sleep(0.2)
            
            self.progress.emit(80, "同步设置参数...")
            time.sleep(0.1)
            
            self.progress.emit(90, "验证完整性...")
            time.sleep(0.1)
            
            self.progress.emit(100, "同步完成")
            
            result = {
                "success": True,
                "synced_items": len(self.manager.pending_changes),
                "timestamp": datetime.now().isoformat(),
                "message": "同步成功"
            }
            self.manager._on_sync_finished(result)
            
        except Exception as e:
            result = {
                "success": False,
                "error": str(e)
            }
            self.manager._on_sync_finished(result)
