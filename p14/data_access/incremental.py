import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime, timedelta
import threading
import time
import hashlib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IncrementalDataManager:
    def __init__(self):
        self.data: Optional[pd.DataFrame] = None
        self.last_updated: Optional[datetime] = None
        self.tracking_column: Optional[str] = None
        self.last_tracking_value: Any = None
        self.data_source_config: Dict[str, Any] = {}
        self.scheduler_running: bool = False
        self.scheduler_thread: Optional[threading.Thread] = None
        self.update_callbacks: List[Callable] = []
        self.data_hash: str = ""
        self.update_history: List[Dict[str, Any]] = []

    def initialize_data(self, data: pd.DataFrame, tracking_column: str = None):
        self.data = data.copy()
        self.tracking_column = tracking_column
        
        if tracking_column and tracking_column in data.columns:
            self.last_tracking_value = data[tracking_column].max()
        else:
            self._compute_data_hash()
        
        self.last_updated = datetime.now()
        self._record_history("initial_load", len(data))

    def _compute_data_hash(self):
        if self.data is not None:
            self.data_hash = hashlib.md5(pd.util.hash_pandas_object(self.data).values).hexdigest()

    def _record_history(self, operation: str, rows_added: int = 0, 
                        rows_updated: int = 0, rows_removed: int = 0):
        self.update_history.append({
            "timestamp": datetime.now(),
            "operation": operation,
            "rows_added": rows_added,
            "rows_updated": rows_updated,
            "rows_removed": rows_removed,
            "total_rows": len(self.data) if self.data is not None else 0
        })

    def load_incremental_csv(self, file_path: str, tracking_column: str = None,
                             **kwargs) -> Dict[str, Any]:
        new_data = pd.read_csv(file_path, **kwargs)
        
        if self.data is None:
            self.initialize_data(new_data, tracking_column)
            return {
                "status": "initialized",
                "rows_loaded": len(new_data),
                "total_rows": len(self.data)
            }
        
        return self._merge_incremental_data(new_data, tracking_column)

    def load_incremental_api(self, url: str, tracking_column: str = None,
                             method: str = "GET", params: Dict = None,
                             data_key: str = None, **kwargs) -> Dict[str, Any]:
        import requests
        
        if method.upper() == "GET":
            response = requests.get(url, params=params)
        else:
            response = requests.post(url, json=params)
        
        response.raise_for_status()
        json_data = response.json()
        
        if data_key and data_key in json_data:
            json_data = json_data[data_key]
        
        new_data = pd.DataFrame(json_data) if isinstance(json_data, list) else pd.DataFrame([json_data])
        
        if self.data is None:
            self.initialize_data(new_data, tracking_column)
            return {
                "status": "initialized",
                "rows_loaded": len(new_data),
                "total_rows": len(self.data)
            }
        
        return self._merge_incremental_data(new_data, tracking_column)

    def _merge_incremental_data(self, new_data: pd.DataFrame, 
                                 tracking_column: str = None) -> Dict[str, Any]:
        tracking_col = tracking_column or self.tracking_column
        
        if tracking_col and tracking_col in new_data.columns and tracking_col in self.data.columns:
            new_rows = new_data[new_data[tracking_col] > self.last_tracking_value]
            
            if len(new_rows) > 0:
                self.data = pd.concat([self.data, new_rows], ignore_index=True)
                self.last_tracking_value = new_rows[tracking_col].max()
                self.last_updated = datetime.now()
                self._record_history("incremental_update", rows_added=len(new_rows))
                
                return {
                    "status": "updated",
                    "rows_added": len(new_rows),
                    "new_last_value": self.last_tracking_value,
                    "total_rows": len(self.data)
                }
            else:
                return {
                    "status": "no_changes",
                    "rows_added": 0,
                    "total_rows": len(self.data)
                }
        else:
            old_hash = self.data_hash
            combined = pd.concat([self.data, new_data]).drop_duplicates(keep='last')
            new_rows_count = len(combined) - len(self.data)
            
            if new_rows_count != 0:
                self.data = combined.reset_index(drop=True)
                self._compute_data_hash()
                self.last_updated = datetime.now()
                self._record_history("full_merge", rows_added=new_rows_count)
                
                return {
                    "status": "merged",
                    "rows_added": new_rows_count,
                    "hash_changed": old_hash != self.data_hash,
                    "total_rows": len(self.data)
                }
            else:
                return {
                    "status": "no_changes",
                    "rows_added": 0,
                    "total_rows": len(self.data)
                }

    def start_scheduled_updates(self, interval_minutes: int, 
                                 data_source: str,
                                 **source_kwargs):
        if self.scheduler_running:
            logger.warning("定时更新已在运行中")
            return
        
        self.data_source_config = {
            "source": data_source,
            "kwargs": source_kwargs
        }
        
        self.scheduler_running = True
        self.scheduler_thread = threading.Thread(
            target=self._scheduler_worker,
            args=(interval_minutes,),
            daemon=True
        )
        self.scheduler_thread.start()
        logger.info(f"定时更新已启动，间隔 {interval_minutes} 分钟")

    def stop_scheduled_updates(self):
        self.scheduler_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=10)
            self.scheduler_thread = None
        logger.info("定时更新已停止")

    def _scheduler_worker(self, interval_minutes: int):
        while self.scheduler_running:
            try:
                config = self.data_source_config
                source = config.get("source")
                kwargs = config.get("kwargs", {})
                
                result = None
                if source == "csv" and "file_path" in kwargs:
                    result = self.load_incremental_csv(kwargs["file_path"], **kwargs)
                elif source == "api" and "url" in kwargs:
                    result = self.load_incremental_api(kwargs["url"], **kwargs)
                
                if result and result.get("status") != "no_changes":
                    logger.info(f"数据已更新: {result}")
                    self._notify_callbacks(result)
                
            except Exception as e:
                logger.error(f"定时更新失败: {str(e)}")
            
            for _ in range(interval_minutes * 60):
                if not self.scheduler_running:
                    break
                time.sleep(1)

    def register_update_callback(self, callback: Callable):
        self.update_callbacks.append(callback)

    def _notify_callbacks(self, update_result: Dict[str, Any]):
        for callback in self.update_callbacks:
            try:
                callback(update_result)
            except Exception as e:
                logger.error(f"回调执行失败: {str(e)}")

    def get_update_status(self) -> Dict[str, Any]:
        return {
            "last_updated": self.last_updated,
            "total_rows": len(self.data) if self.data is not None else 0,
            "tracking_column": self.tracking_column,
            "last_tracking_value": self.last_tracking_value,
            "scheduler_running": self.scheduler_running,
            "update_count": len(self.update_history),
            "update_history": self.update_history[-10:]
        }

    def get_data(self) -> Optional[pd.DataFrame]:
        return self.data.copy() if self.data is not None else None
