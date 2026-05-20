import sqlite3
import json
import time
import threading
import shutil
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass
from pathlib import Path
from enum import Enum
import numpy as np


class CacheWarningLevel(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    FULL = "full"


@dataclass
class CacheStatus:
    total_records: int
    unsynced_records: int
    data_size_bytes: int
    usage_ratio: float
    warning_level: CacheWarningLevel
    last_cleanup: float
    oldest_unsynced: Optional[float]
    newest_unsynced: Optional[float]


@dataclass
class StoredData:
    data_id: str
    device_id: str
    data_type: str
    timestamp: float
    data_path: str
    synced: bool
    metadata: str


@dataclass
class StoredResult:
    result_id: str
    data_id: str
    device_id: str
    pest_type: str
    confidence: float
    model_type: str
    timestamp: float
    synced: bool
    metadata: str


class CacheWarningCallback:
    def __init__(self):
        self._callbacks: List[Callable[[CacheStatus, str], None]] = []
        self._last_level = CacheWarningLevel.NORMAL
    
    def add_callback(self, callback: Callable[[CacheStatus, str], None]):
        self._callbacks.append(callback)
    
    def notify(self, status: CacheStatus, message: str):
        if status.warning_level != self._last_level:
            self._last_level = status.warning_level
            for cb in self._callbacks:
                try:
                    cb(status, message)
                except Exception as e:
                    print(f"Cache callback error: {e}")


class LocalStorage:
    def __init__(self, db_path: str = "pest_monitor.db", data_dir: str = "data",
                 max_records: int = 50000, max_data_size_gb: float = 10.0,
                 warning_threshold: float = 0.7, critical_threshold: float = 0.9):
        self.db_path = db_path
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.max_records = max_records
        self.max_data_size = int(max_data_size_gb * 1024 * 1024 * 1024)
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self._lock = threading.Lock()
        self._warning_callbacks = CacheWarningCallback()
        self._init_db()
        self._last_cleanup = time.time()

    def _init_db(self):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS collected_data (
                    data_id TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    data_type TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    data_path TEXT NOT NULL,
                    synced INTEGER DEFAULT 0,
                    metadata TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS inference_results (
                    result_id TEXT PRIMARY KEY,
                    data_id TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    pest_type TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    model_type TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    synced INTEGER DEFAULT 0,
                    metadata TEXT,
                    FOREIGN KEY (data_id) REFERENCES collected_data (data_id)
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_synced_data ON collected_data(synced)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_synced_results ON inference_results(synced)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_timestamp_data ON collected_data(timestamp)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_timestamp_results ON inference_results(timestamp)
            ''')
            
            conn.commit()
            conn.close()

    def store_data(self, device_id: str, data: np.ndarray, metadata: Dict = None) -> str:
        import uuid
        data_id = str(uuid.uuid4())
        timestamp = time.time()
        data_type = metadata.get('type', 'image') if metadata else 'image'
        success = self.save_collected_data(
            data_id, device_id, data_type, timestamp, data, metadata
        )
        return data_id if success else None

    def save_collected_data(self, data_id: str, device_id: str, data_type: str,
                           timestamp: float, data: np.ndarray, metadata: Dict = None) -> bool:
        try:
            data_path = self._save_numpy_data(data_id, data_type, data)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT OR REPLACE INTO collected_data 
                    (data_id, device_id, data_type, timestamp, data_path, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (data_id, device_id, data_type, timestamp, data_path,
                      json.dumps(metadata) if metadata else None))
                
                conn.commit()
                conn.close()
            return True
        except Exception as e:
            print(f"Save data error: {e}")
            return False

    def _save_numpy_data(self, data_id: str, data_type: str, data: np.ndarray) -> str:
        date_str = time.strftime("%Y%m%d")
        type_dir = self.data_dir / date_str / data_type
        type_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = type_dir / f"{data_id}.npy"
        np.save(str(file_path), data)
        return str(file_path)

    def save_inference_result(self, result_id: str, data_id: str, device_id: str,
                             pest_type: str, confidence: float, model_type: str,
                             timestamp: float, metadata: Dict = None) -> bool:
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT OR REPLACE INTO inference_results 
                    (result_id, data_id, device_id, pest_type, confidence, model_type, 
                     timestamp, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (result_id, data_id, device_id, pest_type, confidence, model_type,
                      timestamp, json.dumps(metadata) if metadata else None))
                
                conn.commit()
                conn.close()
            return True
        except Exception as e:
            print(f"Save result error: {e}")
            return False

    def get_unsynced_data(self, limit: int = 100) -> List[StoredData]:
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM collected_data WHERE synced = 0 ORDER BY timestamp LIMIT ?
            ''', (limit,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [StoredData(**dict(row)) for row in rows]

    def get_unsynced_results(self, limit: int = 100) -> List[StoredResult]:
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM inference_results WHERE synced = 0 ORDER BY timestamp LIMIT ?
            ''', (limit,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [StoredResult(**dict(row)) for row in rows]

    def mark_data_synced(self, data_ids: List[str]):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for data_id in data_ids:
                cursor.execute('''
                    UPDATE collected_data SET synced = 1 WHERE data_id = ?
                ''', (data_id,))
            
            conn.commit()
            conn.close()

    def mark_results_synced(self, result_ids: List[str]):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for result_id in result_ids:
                cursor.execute('''
                    UPDATE inference_results SET synced = 1 WHERE result_id = ?
                ''', (result_id,))
            
            conn.commit()
            conn.close()

    def load_data(self, data_path: str) -> Optional[np.ndarray]:
        try:
            return np.load(data_path)
        except:
            return None

    def get_recent_results(self, hours: float = 24) -> List[StoredResult]:
        cutoff = time.time() - hours * 3600
        
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM inference_results WHERE timestamp >= ? ORDER BY timestamp DESC
            ''', (cutoff,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [StoredResult(**dict(row)) for row in rows]

    def cleanup_old_data(self, days: int = 7):
        cutoff = time.time() - days * 24 * 3600
        
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT data_path FROM collected_data WHERE timestamp < ?', (cutoff,))
            rows = cursor.fetchall()
            
            for row in rows:
                try:
                    Path(row[0]).unlink(missing_ok=True)
                except:
                    pass
            
            cursor.execute('DELETE FROM collected_data WHERE timestamp < ?', (cutoff,))
            cursor.execute('DELETE FROM inference_results WHERE timestamp < ?', (cutoff,))
            
            conn.commit()
            conn.close()

    def get_storage_stats(self) -> Dict:
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) FROM collected_data')
            total_data = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM collected_data WHERE synced = 0')
            unsynced_data = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM inference_results')
            total_results = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM inference_results WHERE synced = 0')
            unsynced_results = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "total_data": total_data,
                "unsynced_data": unsynced_data,
                "total_results": total_results,
                "unsynced_results": unsynced_results,
            }

    def calculate_data_size(self) -> int:
        try:
            total_size = 0
            for path in self.data_dir.rglob('*'):
                if path.is_file():
                    total_size += path.stat().st_size
            
            db_size = Path(self.db_path).stat().st_size if Path(self.db_path).exists() else 0
            return total_size + db_size
        except Exception as e:
            print(f"Error calculating data size: {e}")
            return 0

    def get_cache_status(self) -> CacheStatus:
        stats = self.get_storage_stats()
        total_records = stats['total_data'] + stats['total_results']
        unsynced_records = stats['unsynced_data'] + stats['unsynced_results']
        data_size = self.calculate_data_size()
        
        usage_ratio = max(
            total_records / self.max_records,
            data_size / self.max_data_size
        )
        
        if usage_ratio >= 1.0:
            warning_level = CacheWarningLevel.FULL
        elif usage_ratio >= self.critical_threshold:
            warning_level = CacheWarningLevel.CRITICAL
        elif usage_ratio >= self.warning_threshold:
            warning_level = CacheWarningLevel.WARNING
        else:
            warning_level = CacheWarningLevel.NORMAL
        
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT MIN(timestamp), MAX(timestamp) 
                FROM (
                    SELECT timestamp FROM collected_data WHERE synced = 0
                    UNION ALL
                    SELECT timestamp FROM inference_results WHERE synced = 0
                )
            ''')
            row = cursor.fetchone()
            oldest_unsynced = row[0] if row else None
            newest_unsynced = row[1] if row else None
            
            conn.close()
        
        return CacheStatus(
            total_records=total_records,
            unsynced_records=unsynced_records,
            data_size_bytes=data_size,
            usage_ratio=usage_ratio,
            warning_level=warning_level,
            last_cleanup=self._last_cleanup,
            oldest_unsynced=oldest_unsynced,
            newest_unsynced=newest_unsynced,
        )

    def add_cache_warning_callback(self, callback: Callable[[CacheStatus, str], None]):
        self._warning_callbacks.add_callback(callback)

    def check_cache_warnings(self) -> CacheStatus:
        status = self.get_cache_status()
        
        messages = {
            CacheWarningLevel.WARNING: f"缓存使用率达到 {status.usage_ratio:.1%}，请及时同步",
            CacheWarningLevel.CRITICAL: f"缓存使用率达到 {status.usage_ratio:.1%}，同步紧迫！",
            CacheWarningLevel.FULL: f"缓存已满！最新数据可能丢失！请立即同步！",
        }
        
        if status.warning_level in messages:
            self._warning_callbacks.notify(status, messages[status.warning_level])
        
        return status

    def auto_cleanup(self, min_keep_days: int = 1) -> int:
        cleanup_days = max(min_keep_days, int(7 - 7 * self.get_cache_status().usage_ratio))
        
        cutoff = time.time() - cleanup_days * 24 * 3600
        
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) FROM collected_data WHERE timestamp < ? AND synced = 1', (cutoff,))
            data_to_delete = cursor.fetchone()[0]
            
            cursor.execute('SELECT data_path FROM collected_data WHERE timestamp < ? AND synced = 1', (cutoff,))
            rows = cursor.fetchall()
            
            for row in rows:
                try:
                    Path(row[0]).unlink(missing_ok=True)
                except:
                    pass
            
            cursor.execute('DELETE FROM collected_data WHERE timestamp < ? AND synced = 1', (cutoff,))
            cursor.execute('DELETE FROM inference_results WHERE timestamp < ? AND synced = 1', (cutoff,))
            
            conn.commit()
            conn.close()
        
        self._last_cleanup = time.time()
        return data_to_delete

    def force_cleanup_for_space(self, target_ratio: float = 0.5) -> int:
        deleted = 0
        
        while self.get_cache_status().usage_ratio > target_ratio:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT data_path FROM collected_data 
                    WHERE synced = 1 ORDER BY timestamp ASC LIMIT 100
                ''')
                rows = cursor.fetchall()
                
                if not rows:
                    conn.close()
                    break
                
                data_ids = []
                for row in rows:
                    try:
                        Path(row[0]).unlink(missing_ok=True)
                        deleted += 1
                    except:
                        pass
                
                cursor.execute('''
                    DELETE FROM collected_data 
                    WHERE data_path IN ({})
                '''.format(','.join('?' for _ in rows)), [r[0] for r in rows])
                
                conn.commit()
                conn.close()
        
        self._last_cleanup = time.time()
        return deleted

    def get_storage_limits(self) -> Dict:
        return {
            "max_records": self.max_records,
            "max_data_size_bytes": self.max_data_size,
            "warning_threshold": self.warning_threshold,
            "critical_threshold": self.critical_threshold,
        }
