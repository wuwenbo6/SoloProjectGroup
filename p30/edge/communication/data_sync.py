import time
import json
import sqlite3
import threading
import requests
from typing import List, Dict, Callable, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from collections import deque


class SyncStatus(Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    ERROR = "error"
    RETRYING = "retrying"


@dataclass
class SyncResult:
    data_synced: int
    results_synced: int
    model_updated: bool
    timestamp: float
    error: Optional[str] = None


class RetryQueue:
    def __init__(self, db_path: str = "retry_queue.db", max_retries: int = 5):
        self.max_retries = max_retries
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS retry_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    retries INTEGER DEFAULT 0,
                    last_retry REAL,
                    next_retry REAL,
                    created_at REAL
                )
            ''')
            conn.commit()
            conn.close()

    def add(self, item_type: str, payload: Dict):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            now = time.time()
            cursor.execute('''
                INSERT INTO retry_items (item_type, payload, created_at, next_retry)
                VALUES (?, ?, ?, ?)
            ''', (item_type, json.dumps(payload), now, now + 5))
            conn.commit()
            conn.close()

    def get_due(self, limit: int = 50) -> List[Dict]:
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            now = time.time()
            cursor.execute('''
                SELECT id, item_type, payload, retries FROM retry_items
                WHERE next_retry <= ? AND retries < ?
                ORDER BY next_retry ASC LIMIT ?
            ''', (now, self.max_retries, limit))
            
            items = []
            for row in cursor.fetchall():
                items.append({
                    'id': row[0],
                    'item_type': row[1],
                    'payload': json.loads(row[2]),
                    'retries': row[3]
                })
            conn.close()
            return items

    def mark_success(self, item_ids: List[int]):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            for item_id in item_ids:
                cursor.execute('DELETE FROM retry_items WHERE id = ?', (item_id,))
            conn.commit()
            conn.close()

    def mark_failed(self, item_id: int, retries: int):
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            now = time.time()
            delay = min(5 * (2 ** retries), 300)
            cursor.execute('''
                UPDATE retry_items 
                SET retries = ?, last_retry = ?, next_retry = ?
                WHERE id = ?
            ''', (retries + 1, now, now + delay, item_id))
            conn.commit()
            conn.close()

    def get_stats(self) -> Dict:
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM retry_items')
            total = cursor.fetchone()[0]
            conn.close()
            return {'pending_retries': total, 'max_retries': self.max_retries}


class DataSynchronizer:
    def __init__(self, backend_url: str, edge_id: str, storage):
        self.backend_url = backend_url.rstrip('/')
        self.edge_id = edge_id
        self.storage = storage
        self.sync_interval = 30
        self.retry_queue = RetryQueue()
        self._running = False
        self._sync_thread = None
        self._status = SyncStatus.IDLE
        self._callbacks: List[Callable] = []
        self._session = requests.Session()
        self._session.headers.update({'Edge-ID': edge_id})
        self._session.headers.update({'Content-Type': 'application/json'})
        adapter = requests.adapters.HTTPAdapter(
            max_retries=requests.adapters.Retry(
                total=3,
                backoff_factor=1,
                status_forcelist=[500, 502, 503, 504]
            )
        )
        self._session.mount('http://', adapter)
        self._session.mount('https://', adapter)

    def start(self):
        self._running = True
        self._sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self._sync_thread.start()

    def stop(self):
        self._running = False
        if self._sync_thread:
            self._sync_thread.join()

    def _sync_loop(self):
        while self._running:
            try:
                self._status = SyncStatus.SYNCING
                result = self.sync()
                self._status = SyncStatus.IDLE
                self._notify_callbacks(result)
            except Exception as e:
                self._status = SyncStatus.ERROR
                print(f"Sync error: {e}")
            
            time.sleep(self.sync_interval)

    def sync(self) -> SyncResult:
        self._process_retries()
        data_count = self._sync_collected_data()
        results_count = self._sync_inference_results()
        model_updated = self._check_model_update()
        
        return SyncResult(
            data_synced=data_count,
            results_synced=results_count,
            model_updated=model_updated,
            timestamp=time.time()
        )

    def _sync_collected_data(self) -> int:
        unsynced = self.storage.get_unsynced_data(limit=50)
        if not unsynced:
            return 0
        
        data_list = []
        for item in unsynced:
            data = self.storage.load_data(item.data_path)
            if data is not None:
                data_list.append({
                    "data_id": item.data_id,
                    "device_id": item.device_id,
                    "data_type": item.data_type,
                    "timestamp": item.timestamp,
                    "metadata": item.metadata
                })
        
        if not data_list:
            return 0
        
        synced_ids = []
        for batch in self._chunk_list(data_list, 10):
            try:
                response = self._session.post(
                    f"{self.backend_url}/api/v1/data/batch",
                    json={
                        "edge_id": self.edge_id,
                        "data": batch
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    synced_ids.extend([item["data_id"] for item in batch])
                else:
                    for item in batch:
                        self.retry_queue.add('data', item)
            except requests.exceptions.RequestException as e:
                print(f"Data sync network error: {e}")
                for item in batch:
                    self.retry_queue.add('data', item)
            except Exception as e:
                print(f"Data sync error: {e}")
                for item in batch:
                    self.retry_queue.add('data', item)
        
        if synced_ids:
            self.storage.mark_data_synced(synced_ids)
        
        return len(synced_ids)

    def _sync_inference_results(self) -> int:
        unsynced = self.storage.get_unsynced_results(limit=50)
        if not unsynced:
            return 0
        
        results_list = []
        for item in unsynced:
            results_list.append({
                "result_id": item.result_id,
                "data_id": item.data_id,
                "device_id": item.device_id,
                "pest_type": item.pest_type,
                "confidence": item.confidence,
                "model_type": item.model_type,
                "timestamp": item.timestamp,
                "metadata": item.metadata
            })
        
        synced_ids = []
        for batch in self._chunk_list(results_list, 10):
            try:
                response = self._session.post(
                    f"{self.backend_url}/api/v1/results/batch",
                    json={
                        "edge_id": self.edge_id,
                        "results": batch
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    synced_ids.extend([item["result_id"] for item in batch])
                else:
                    for item in batch:
                        self.retry_queue.add('result', item)
            except requests.exceptions.RequestException as e:
                print(f"Results sync network error: {e}")
                for item in batch:
                    self.retry_queue.add('result', item)
            except Exception as e:
                print(f"Results sync error: {e}")
                for item in batch:
                    self.retry_queue.add('result', item)
        
        if synced_ids:
            self.storage.mark_results_synced(synced_ids)
        
        return len(synced_ids)

    def _process_retries(self):
        items = self.retry_queue.get_due(limit=30)
        if not items:
            return
        
        data_items = [item for item in items if item['item_type'] == 'data']
        result_items = [item for item in items if item['item_type'] == 'result']
        
        success_ids = []
        
        if data_items:
            data_batch = [item['payload'] for item in data_items]
            try:
                response = self._session.post(
                    f"{self.backend_url}/api/v1/data/batch",
                    json={"edge_id": self.edge_id, "data": data_batch},
                    timeout=15
                )
                if response.status_code == 200:
                    success_ids.extend([item['id'] for item in data_items])
                else:
                    for item in data_items:
                        self.retry_queue.mark_failed(item['id'], item['retries'])
            except Exception as e:
                print(f"Retry data sync error: {e}")
                for item in data_items:
                    self.retry_queue.mark_failed(item['id'], item['retries'])
        
        if result_items:
            result_batch = [item['payload'] for item in result_items]
            try:
                response = self._session.post(
                    f"{self.backend_url}/api/v1/results/batch",
                    json={"edge_id": self.edge_id, "results": result_batch},
                    timeout=15
                )
                if response.status_code == 200:
                    success_ids.extend([item['id'] for item in result_items])
                else:
                    for item in result_items:
                        self.retry_queue.mark_failed(item['id'], item['retries'])
            except Exception as e:
                print(f"Retry result sync error: {e}")
                for item in result_items:
                    self.retry_queue.mark_failed(item['id'], item['retries'])
        
        if success_ids:
            self.retry_queue.mark_success(success_ids)

    def _check_model_update(self) -> bool:
        try:
            response = self._session.get(
                f"{self.backend_url}/api/v1/models/latest",
                params={"edge_id": self.edge_id},
                timeout=10
            )
            
            if response.status_code == 200:
                model_info = response.json()
                return self._download_and_update_model(model_info)
        except Exception as e:
            print(f"Model check error: {e}")
        
        return False

    def _download_and_update_model(self, model_info: Dict) -> bool:
        try:
            model_url = model_info.get("download_url")
            if not model_url:
                return False
            
            response = self._session.get(model_url, timeout=60)
            if response.status_code == 200:
                return True
        except Exception as e:
            print(f"Model download error: {e}")
        
        return False

    def send_alert(self, alert_type: str, severity: str, message: str, metadata: Dict = None):
        for attempt in range(3):
            try:
                self._session.post(
                    f"{self.backend_url}/api/v1/alerts",
                    json={
                        "edge_id": self.edge_id,
                        "alert_type": alert_type,
                        "severity": severity,
                        "message": message,
                        "timestamp": time.time(),
                        "metadata": metadata or {}
                    },
                    timeout=10
                )
                return
            except Exception as e:
                if attempt == 2:
                    print(f"Alert send failed after 3 attempts: {e}")
                time.sleep(2 ** attempt)

    def get_status(self) -> SyncStatus:
        return self._status

    def get_retry_stats(self) -> Dict:
        return self.retry_queue.get_stats()

    def add_callback(self, callback: Callable):
        self._callbacks.append(callback)

    def _notify_callbacks(self, result: SyncResult):
        for callback in self._callbacks:
            try:
                callback(result)
            except Exception as e:
                print(f"Sync callback error: {e}")

    @staticmethod
    def _chunk_list(lst: List, chunk_size: int) -> List[List]:
        return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]
