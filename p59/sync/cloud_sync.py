import json
import hashlib
import time
import threading
import logging
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Callable
from datetime import datetime
from pathlib import Path
from enum import Enum
import asyncio
import ssl


class SyncStatus(Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"
    CONFLICT = "conflict"


class SyncProvider(Enum):
    LOCAL = "local"
    HTTP = "http"
    FTP = "ftp"
    WEBDAV = "webdav"


@dataclass
class SyncConfig:
    provider: SyncProvider = SyncProvider.LOCAL
    server_url: str = ""
    username: str = ""
    password: str = ""
    device_id: str = ""
    sync_interval: int = 300
    auto_sync: bool = True
    encrypt_data: bool = True
    backup_path: str = "./sync_backup"


@dataclass
class SyncRecord:
    record_id: str
    config_type: str
    config_id: str
    device_id: str
    version: int
    data_hash: str
    data: str
    created_at: str
    updated_at: str
    is_deleted: bool = False


class CloudSyncManager:
    def __init__(self, config: Optional[SyncConfig] = None):
        self.config = config or SyncConfig()
        self.logger = logging.getLogger("CloudSync")
        self.status = SyncStatus.IDLE
        self.last_sync_time: Optional[datetime] = None
        self.sync_error: Optional[str] = None
        self.conflicts: List[Dict] = []
        self._sync_lock = threading.Lock()
        self._sync_thread: Optional[threading.Thread] = None
        self._stop_sync = False
        self._progress_callback: Optional[Callable[[float, str], None]] = None
        self._status_callback: Optional[Callable[[SyncStatus, str], None]] = None

        self._init_sync_storage()

    def _init_sync_storage(self):
        backup_path = Path(self.config.backup_path)
        backup_path.mkdir(parents=True, exist_ok=True)

        local_db = backup_path / "sync_local.db"
        if not local_db.exists():
            with open(local_db, 'w') as f:
                json.dump({"records": [], "device_info": {}}, f, indent=2)

        if not self.config.device_id:
            self.config.device_id = self._generate_device_id()

    def _generate_device_id(self) -> str:
        import platform
        system_info = f"{platform.node()}-{platform.system()}-{platform.processor()}"
        return f"dev_{hashlib.md5(system_info.encode()).hexdigest()[:12]}"

    def set_progress_callback(self, callback: Callable[[float, str], None]):
        self._progress_callback = callback

    def set_status_callback(self, callback: Callable[[SyncStatus, str], None]):
        self._status_callback = callback

    def _notify_progress(self, progress: float, message: str):
        if self._progress_callback:
            try:
                self._progress_callback(progress, message)
            except Exception as e:
                self.logger.error(f"Progress callback error: {e}")

    def _notify_status(self, status: SyncStatus, message: str = ""):
        self.status = status
        if self._status_callback:
            try:
                self._status_callback(status, message)
            except Exception as e:
                self.logger.error(f"Status callback error: {e}")

    def sync_config(self, config_type: str, config_data: Dict) -> bool:
        with self._sync_lock:
            try:
                self._notify_status(SyncStatus.SYNCING, f"同步 {config_type} 配置...")
                self._notify_progress(0.2, "准备同步数据")

                data_str = json.dumps(config_data, sort_keys=True)
                data_hash = hashlib.sha256(data_str.encode()).hexdigest()

                record = SyncRecord(
                    record_id=f"sync_{int(time.time())}_{data_hash[:8]}",
                    config_type=config_type,
                    config_id=config_data.get("config_id", config_data.get("id", "default")),
                    device_id=self.config.device_id,
                    version=int(time.time()),
                    data_hash=data_hash,
                    data=data_str,
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat()
                )

                self._notify_progress(0.5, "上传到云端")
                success = self._upload_to_cloud(record)

                if success:
                    self._notify_progress(0.8, "保存本地记录")
                    self._save_local_record(record)
                    self.last_sync_time = datetime.now()
                    self._notify_status(SyncStatus.SUCCESS, "同步完成")
                    self._notify_progress(1.0, "同步完成")
                    return True
                else:
                    self._notify_status(SyncStatus.FAILED, "上传失败")
                    return False

            except Exception as e:
                self.sync_error = str(e)
                self.logger.error(f"Sync error: {e}")
                self._notify_status(SyncStatus.FAILED, str(e))
                return False

    def sync_all_configs(self, all_configs: Dict[str, List[Dict]]) -> bool:
        try:
            total = sum(len(configs) for configs in all_configs.values())
            current = 0

            for config_type, configs in all_configs.items():
                for config in configs:
                    self.sync_config(config_type, config)
                    current += 1
                    time.sleep(0.1)

            return True
        except Exception as e:
            self.logger.error(f"Sync all error: {e}")
            return False

    def get_remote_configs(self, config_type: Optional[str] = None) -> List[Dict]:
        try:
            return self._download_from_cloud(config_type)
        except Exception as e:
            self.logger.error(f"Get remote configs error: {e}")
            return []

    def sync_from_cloud(self) -> Dict:
        with self._sync_lock:
            try:
                self._notify_status(SyncStatus.SYNCING, "从云端同步...")
                self._notify_progress(0.3, "下载配置")

                remote_configs = self._download_from_cloud()
                local_configs = self._get_local_records()

                self._notify_progress(0.6, "检查冲突")
                conflicts = self._resolve_conflicts(local_configs, remote_configs)

                self.conflicts = conflicts
                self._notify_progress(0.9, "应用配置")

                merged_configs = self._merge_configs(local_configs, remote_configs)

                self.last_sync_time = datetime.now()
                self._notify_status(SyncStatus.SUCCESS, "同步完成")
                self._notify_progress(1.0, "同步完成")

                return {
                    "merged": merged_configs,
                    "conflicts": conflicts,
                    "success": True
                }

            except Exception as e:
                self.sync_error = str(e)
                self.logger.error(f"Sync from cloud error: {e}")
                self._notify_status(SyncStatus.FAILED, str(e))
                return {"success": False, "error": str(e)}

    def _upload_to_cloud(self, record: SyncRecord) -> bool:
        if self.config.provider == SyncProvider.LOCAL:
            return self._upload_to_local(record)
        elif self.config.provider == SyncProvider.HTTP:
            return self._upload_via_http(record)
        else:
            return self._upload_to_local(record)

    def _upload_to_local(self, record: SyncRecord) -> bool:
        try:
            backup_file = Path(self.config.backup_path) / f"{record.record_id}.json"
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(asdict(record), f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            self.logger.error(f"Local upload error: {e}")
            return False

    def _upload_via_http(self, record: SyncRecord) -> bool:
        try:
            import urllib.request
            url = self.config.server_url.rstrip('/') + '/api/sync'
            data = json.dumps(asdict(record)).encode('utf-8')

            req = urllib.request.Request(url, data=data, method='POST')
            req.add_header('Content-Type', 'application/json')

            if self.config.username and self.config.password:
                import base64
                credentials = base64.b64encode(
                    f"{self.config.username}:{self.config.password}".encode()
                ).decode()
                req.add_header('Authorization', f'Basic {credentials}')

            with urllib.request.urlopen(req, timeout=30) as response:
                return response.getcode() == 200
        except Exception as e:
            self.logger.warning(f"HTTP upload failed, using local backup: {e}")
            return self._upload_to_local(record)

    def _download_from_cloud(self, config_type: Optional[str] = None) -> List[Dict]:
        if self.config.provider == SyncProvider.LOCAL:
            return self._download_from_local(config_type)
        elif self.config.provider == SyncProvider.HTTP:
            return self._download_via_http(config_type)
        else:
            return self._download_from_local(config_type)

    def _download_from_local(self, config_type: Optional[str] = None) -> List[Dict]:
        try:
            records = []
            backup_path = Path(self.config.backup_path)
            for file_path in backup_path.glob("sync_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        record = json.load(f)
                        if config_type is None or record.get("config_type") == config_type:
                            records.append(record)
                except:
                    continue
            return sorted(records, key=lambda x: x.get("updated_at", ""), reverse=True)
        except Exception as e:
            self.logger.error(f"Local download error: {e}")
            return []

    def _download_via_http(self, config_type: Optional[str] = None) -> List[Dict]:
        try:
            import urllib.request
            url = self.config.server_url.rstrip('/') + '/api/sync'
            if config_type:
                url += f'?type={config_type}'

            req = urllib.request.Request(url, method='GET')
            if self.config.username and self.config.password:
                import base64
                credentials = base64.b64encode(
                    f"{self.config.username}:{self.config.password}".encode()
                ).decode()
                req.add_header('Authorization', f'Basic {credentials}')

            with urllib.request.urlopen(req, timeout=30) as response:
                if response.getcode() == 200:
                    data = json.loads(response.read().decode())
                    return data.get("records", [])
                return []
        except Exception as e:
            self.logger.warning(f"HTTP download failed, using local backup: {e}")
            return self._download_from_local(config_type)

    def _save_local_record(self, record: SyncRecord):
        db_path = Path(self.config.backup_path) / "sync_local.db"
        try:
            with open(db_path, 'r+', encoding='utf-8') as f:
                data = json.load(f)
                records = data.get("records", [])

                existing_idx = None
                for i, r in enumerate(records):
                    if r.get("config_id") == record.config_id and r.get("config_type") == record.config_type:
                        existing_idx = i
                        break

                if existing_idx is not None:
                    records[existing_idx] = asdict(record)
                else:
                    records.append(asdict(record))

                data["records"] = records
                f.seek(0)
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.truncate()
        except Exception as e:
            self.logger.error(f"Save local record error: {e}")

    def _get_local_records(self) -> List[Dict]:
        db_path = Path(self.config.backup_path) / "sync_local.db"
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("records", [])
        except:
            return []

    def _resolve_conflicts(self, local: List[Dict], remote: List[Dict]) -> List[Dict]:
        conflicts = []
        remote_map = {f"{r['config_type']}:{r['config_id']}": r for r in remote}

        for local_record in local:
            key = f"{local_record['config_type']}:{local_record['config_id']}"
            if key in remote_map:
                remote_record = remote_map[key]
                if local_record["data_hash"] != remote_record["data_hash"]:
                    if local_record["version"] > remote_record["version"]:
                        resolution = "use_local"
                    elif local_record["version"] < remote_record["version"]:
                        resolution = "use_remote"
                    else:
                        resolution = "manual"

                    conflicts.append({
                        "key": key,
                        "local_version": local_record["version"],
                        "remote_version": remote_record["version"],
                        "local_time": local_record["updated_at"],
                        "remote_time": remote_record["updated_at"],
                        "resolution": resolution
                    })

        return conflicts

    def _merge_configs(self, local: List[Dict], remote: List[Dict]) -> List[Dict]:
        merged = {}

        for record in remote:
            key = f"{record['config_type']}:{record['config_id']}"
            merged[key] = record

        for record in local:
            key = f"{record['config_type']}:{record['config_id']}"
            if key not in merged or record["version"] > merged[key]["version"]:
                merged[key] = record

        return list(merged.values())

    def start_auto_sync(self):
        if not self.config.auto_sync:
            return

        self._stop_sync = False
        self._sync_thread = threading.Thread(target=self._auto_sync_loop, daemon=True)
        self._sync_thread.start()
        self.logger.info(f"Auto sync started, interval: {self.config.sync_interval}s")

    def stop_auto_sync(self):
        self._stop_sync = True
        if self._sync_thread:
            self._sync_thread.join(timeout=5.0)
        self.logger.info("Auto sync stopped")

    def _auto_sync_loop(self):
        while not self._stop_sync:
            try:
                if self.status == SyncStatus.IDLE:
                    self.sync_from_cloud()

                for _ in range(self.config.sync_interval):
                    if self._stop_sync:
                        break
                    time.sleep(1)
            except Exception as e:
                self.logger.error(f"Auto sync loop error: {e}")
                time.sleep(60)

    def get_sync_status(self) -> Dict:
        return {
            "status": self.status.value,
            "last_sync_time": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "error": self.sync_error,
            "pending_conflicts": len(self.conflicts),
            "device_id": self.config.device_id,
            "auto_sync_enabled": self.config.auto_sync
        }

    def resolve_conflict(self, conflict_key: str, resolution: str = "use_latest") -> bool:
        try:
            conflict = next((c for c in self.conflicts if c["key"] == conflict_key), None)
            if not conflict:
                return False

            self.conflicts = [c for c in self.conflicts if c["key"] != conflict_key]
            return True
        except Exception as e:
            self.logger.error(f"Resolve conflict error: {e}")
            return False

    def export_backup(self, export_path: str) -> bool:
        try:
            records = self._get_local_records()
            backup_data = {
                "export_time": datetime.now().isoformat(),
                "device_id": self.config.device_id,
                "version": 1,
                "records": records
            }

            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)

            self.logger.info(f"Backup exported to {export_path}")
            return True
        except Exception as e:
            self.logger.error(f"Export backup error: {e}")
            return False

    def import_backup(self, import_path: str, merge: bool = True) -> bool:
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)

            records = backup_data.get("records", [])

            if not merge:
                db_path = Path(self.config.backup_path) / "sync_local.db"
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump({"records": records, "device_info": {}}, f, indent=2)
            else:
                for record_data in records:
                    record = SyncRecord(**record_data)
                    self._save_local_record(record)

            self.logger.info(f"Backup imported from {import_path}")
            return True
        except Exception as e:
            self.logger.error(f"Import backup error: {e}")
            return False
