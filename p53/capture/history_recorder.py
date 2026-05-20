from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import deque
import json
import os


class CaptureRecord:
    def __init__(self, char: str, device_id: str, timestamp: str = None,
                 font_type: str = "unknown", confidence: float = 0.0):
        self.char = char
        self.device_id = device_id
        self.timestamp = timestamp or datetime.now().isoformat()
        self.font_type = font_type
        self.confidence = confidence
        self.id = hash(f"{char}{device_id}{self.timestamp}")
        
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "char": self.char,
            "device_id": self.device_id,
            "timestamp": self.timestamp,
            "font_type": self.font_type,
            "confidence": self.confidence
        }


class SessionStats:
    def __init__(self):
        self.total_chars = 0
        self.corrected_chars = 0
        self.unique_chars = set()
        self.start_time = None
        self.end_time = None
        self.char_frequency = {}
        
    def add_char(self, char: str, is_corrected: bool = False):
        self.total_chars += 1
        if is_corrected:
            self.corrected_chars += 1
        self.unique_chars.add(char)
        self.char_frequency[char] = self.char_frequency.get(char, 0) + 1
        
    def to_dict(self) -> Dict:
        return {
            "total_chars": self.total_chars,
            "corrected_chars": self.corrected_chars,
            "unique_count": len(self.unique_chars),
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.start_time and self.end_time else 0,
            "char_frequency": dict(sorted(self.char_frequency.items(), key=lambda x: x[1], reverse=True)[:20])
        }


class HistoryRecorder(QObject):
    record_added = pyqtSignal(dict)
    session_updated = pyqtSignal(dict)
    history_cleared = pyqtSignal()
    
    def __init__(self, storage_path: str = None):
        super().__init__()
        self.mutex = QMutex()
        self.current_session: Optional[Dict] = None
        self.session_history: deque = deque(maxlen=100)
        self.realtime_buffer: deque = deque(maxlen=1000)
        self.session_stats = SessionStats()
        
        if storage_path is None:
            home = os.path.expanduser("~")
            storage_path = os.path.join(home, ".typewriter_digitizer", "history")
        
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
    def start_session(self, session_name: str = None, device_id: str = "default") -> str:
        locker = QMutexLocker(self.mutex)
        
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.current_session = {
            "session_id": session_id,
            "session_name": session_name or f"采集会话 {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "device_id": device_id,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
            "records": [],
            "is_active": True
        }
        
        self.session_stats = SessionStats()
        self.session_stats.start_time = datetime.now()
        
        return session_id
        
    def end_session(self) -> Optional[Dict]:
        locker = QMutexLocker(self.mutex)
        
        if not self.current_session or not self.current_session.get("is_active"):
            return None
            
        self.current_session["is_active"] = False
        self.current_session["end_time"] = datetime.now().isoformat()
        self.session_stats.end_time = datetime.now()
        
        session_data = self.current_session.copy()
        session_data["stats"] = self.session_stats.to_dict()
        
        self.session_history.append(session_data)
        self._save_session_to_disk(session_data)
        
        self.current_session = None
        self.session_updated.emit(session_data)
        
        return session_data
        
    def record_character(self, char_data: Dict, device_id: str = "default") -> bool:
        locker = QMutexLocker(self.mutex)
        
        if not self.current_session or not self.current_session.get("is_active"):
            return False
            
        record = CaptureRecord(
            char=char_data.get("character", ""),
            device_id=device_id,
            font_type=char_data.get("font_type", "unknown"),
            confidence=char_data.get("confidence", 0.0)
        )
        
        self.current_session["records"].append(record.to_dict())
        self.realtime_buffer.append(record.to_dict())
        self.session_stats.add_char(
            record.char,
            char_data.get("is_corrected", False)
        )
        
        self.record_added.emit(record.to_dict())
        
        return True
        
    def get_recent_records(self, count: int = 100) -> List[Dict]:
        locker = QMutexLocker(self.mutex)
        recent = list(self.realtime_buffer)[-count:]
        return recent
        
    def get_session_history(self, limit: int = 50) -> List[Dict]:
        locker = QMutexLocker(self.mutex)
        return list(self.session_history)[-limit:]
        
    def get_current_session_stats(self) -> Dict:
        locker = QMutexLocker(self.mutex)
        if not self.current_session:
            return {}
            
        stats = self.session_stats.to_dict()
        stats["session_name"] = self.current_session["session_name"]
        stats["device_id"] = self.current_session["device_id"]
        stats["is_active"] = True
        
        return stats
        
    def get_session_by_id(self, session_id: str) -> Optional[Dict]:
        locker = QMutexLocker(self.mutex)
        
        if self.current_session and self.current_session["session_id"] == session_id:
            return self.current_session.copy()
            
        for session in self.session_history:
            if session["session_id"] == session_id:
                return session
                
        return self._load_session_from_disk(session_id)
        
    def export_session(self, session_id: str, output_path: str) -> bool:
        session = self.get_session_by_id(session_id)
        if not session:
            return False
            
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(session, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"导出会话失败: {e}")
            return False
            
    def get_daily_statistics(self, days: int = 7) -> Dict:
        locker = QMutexLocker(self.mutex)
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        daily_stats = {}
        total_chars = 0
        total_sessions = 0
        
        for session in self.session_history:
            try:
                session_date = datetime.fromisoformat(session["start_time"]).date()
                if start_date.date() <= session_date <= end_date.date():
                    date_key = session_date.isoformat()
                    if date_key not in daily_stats:
                        daily_stats[date_key] = {
                            "chars": 0,
                            "sessions": 0,
                            "devices": set()
                        }
                    
                    stats = session.get("stats", {})
                    daily_stats[date_key]["chars"] += stats.get("total_chars", 0)
                    daily_stats[date_key]["sessions"] += 1
                    daily_stats[date_key]["devices"].add(session.get("device_id", "unknown"))
                    total_chars += stats.get("total_chars", 0)
                    total_sessions += 1
            except:
                continue
                
        for date_key in daily_stats:
            daily_stats[date_key]["devices"] = len(daily_stats[date_key]["devices"])
            
        return {
            "period_days": days,
            "total_characters": total_chars,
            "total_sessions": total_sessions,
            "daily_stats": dict(sorted(daily_stats.items())),
            "avg_chars_per_session": total_chars / total_sessions if total_sessions > 0 else 0
        }
        
    def clear_history(self):
        locker = QMutexLocker(self.mutex)
        self.session_history.clear()
        self.realtime_buffer.clear()
        self.history_cleared.emit()
        
    def _save_session_to_disk(self, session: Dict):
        try:
            session_id = session["session_id"]
            file_path = os.path.join(self.storage_path, f"{session_id}.json")
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(session, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存会话失败: {e}")
            
    def _load_session_from_disk(self, session_id: str) -> Optional[Dict]:
        try:
            file_path = os.path.join(self.storage_path, f"{session_id}.json")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"加载会话失败: {e}")
        return None
