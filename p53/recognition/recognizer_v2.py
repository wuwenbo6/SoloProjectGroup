from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import OrderedDict
import numpy as np
import weakref
import gc


@dataclass
class RecognitionResult:
    __slots__ = ['character', 'confidence', 'font_type', 'features_hash']
    character: str
    confidence: float
    font_type: str
    features_hash: int

    def to_dict(self) -> Dict:
        return {
            'character': self.character,
            'confidence': self.confidence,
            'font_type': self.font_type,
            'features_hash': self.features_hash
        }


class LRUCache:
    def __init__(self, capacity: int = 1000):
        self.cache = OrderedDict()
        self.capacity = capacity
        self.hits = 0
        self.misses = 0
        self._mutex = QMutex()

    def get(self, key: int) -> Optional[RecognitionResult]:
        locker = QMutexLocker(self._mutex)
        
        if key not in self.cache:
            self.misses += 1
            return None
            
        self.cache.move_to_end(key)
        self.hits += 1
        return self.cache[key]

    def put(self, key: int, value: RecognitionResult):
        locker = QMutexLocker(self._mutex)
        
        if key in self.cache:
            self.cache.move_to_end(key)
        else:
            self.cache[key] = value
            if len(self.cache) > self.capacity:
                self.cache.popitem(last=False)

    def clear(self):
        locker = QMutexLocker(self._mutex)
        self.cache.clear()
        gc.collect()

    def get_stats(self) -> Dict:
        locker = QMutexLocker(self._mutex)
        total = self.hits + self.misses
        hit_rate = self.hits / total if total > 0 else 0.0
        return {
            'size': len(self.cache),
            'capacity': self.capacity,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': hit_rate
        }


class LightweightRecognizer(QObject):
    recognition_completed = pyqtSignal(str, float, str)
    cache_cleaned = pyqtSignal(int)

    ASCII_FONT_MAPPING = {
        48: 'Courier',     # '0' - 标准打字机
        65: 'Typewriter',   # 'A' - 经典字体
        97: 'Mechanical',   # 'a' - 机械字体
        105: 'Electric',    # 'i' - 电动打字机
    }

    CONFIDENCE_BASE = {
        'Courier': 0.9,
        'Typewriter': 0.85,
        'Mechanical': 0.8,
        'Electric': 0.75,
        'Unknown': 0.6
    }

    def __init__(self, cache_size: int = 2000):
        super().__init__()
        self._cache = LRUCache(cache_size)
        self._mutex = QMutex()
        self._recognition_count = 0
        self._batch_mode = False
        self._batch_buffer = []
        self._font_profile_cache = weakref.WeakValueDictionary()

    def recognize_char_fast(self, char_code: int) -> RecognitionResult:
        locker = QMutexLocker(self._mutex)
        
        cache_key = char_code
        
        cached = self._cache.get(cache_key)
        if cached:
            return cached
            
        font_type = self._detect_font_fast(char_code)
        confidence = self.CONFIDENCE_BASE.get(font_type, 0.6)
        
        result = RecognitionResult(
            character=chr(char_code),
            confidence=confidence,
            font_type=font_type,
            features_hash=hash((char_code, font_type))
        )
        
        self._cache.put(cache_key, result)
        self._recognition_count += 1
        
        return result

    def recognize_batch(self, char_codes: List[int]) -> List[RecognitionResult]:
        results = []
        self._batch_mode = True
        
        for code in char_codes:
            result = self.recognize_char_fast(code)
            results.append(result)
            
        self._batch_mode = False
        self.recognition_completed.emit(
            f'batch_{len(results)}',
            sum(r.confidence for r in results) / len(results),
            'batch'
        )
        
        return results

    def _detect_font_fast(self, char_code: int) -> str:
        if char_code in self.ASCII_FONT_MAPPING:
            return self.ASCII_FONT_MAPPING[char_code]
            
        if 65 <= char_code <= 90:
            return 'Typewriter'
        elif 97 <= char_code <= 122:
            return 'Mechanical'
        elif 48 <= char_code <= 57:
            return 'Courier'
        else:
            return 'Unknown'

    def get_font_profile(self, font_name: str) -> Optional[Dict]:
        locker = QMutexLocker(self._mutex)
        
        if font_name in self._font_profile_cache:
            return self._font_profile_cache[font_name]
            
        profile = self._create_font_profile(font_name)
        self._font_profile_cache[font_name] = profile
        return profile

    def _create_font_profile(self, font_name: str) -> Dict:
        base_conf = self.CONFIDENCE_BASE.get(font_name, 0.6)
        return {
            'name': font_name,
            'base_confidence': base_conf,
            'stroke_width': 2.0 if font_name == 'Courier' else 2.5,
            'serif': font_name in ['Typewriter', 'Mechanical'],
            'typical_chars': 'ABC' if font_name == 'Typewriter' else 'abc'
        }

    def get_cache_stats(self) -> Dict:
        return self._cache.get_stats()

    def optimize_memory(self) -> int:
        self._cache.clear()
        collected = gc.collect()
        self.cache_cleaned.emit(collected)
        return collected

    def get_recognition_stats(self) -> Dict:
        locker = QMutexLocker(self._mutex)
        cache_stats = self._cache.get_stats()
        return {
            'total_recognitions': self._recognition_count,
            'cache_hits': cache_stats['hits'],
            'cache_misses': cache_stats['misses'],
            'cache_hit_rate': cache_stats['hit_rate'],
            'cache_size': cache_stats['size'],
            'memory_optimized': True
        }

    def reset(self):
        locker = QMutexLocker(self._mutex)
        self._cache.clear()
        self._recognition_count = 0
        self._font_profile_cache.clear()
        gc.collect()


class CharacterPool:
    def __init__(self, pool_size: int = 1000):
        self._pool: OrderedDict = OrderedDict()
        self._pool_size = pool_size
        self._mutex = QMutex()
        self._reuse_count = 0

    def acquire(self, char: str, font: str) -> Optional[Dict]:
        locker = QMutexLocker(self._mutex)
        key = hash((char, font))
        
        if key in self._pool:
            self._pool.move_to_end(key)
            self._reuse_count += 1
            return self._pool[key].copy()
        return None

    def release(self, char_data: Dict):
        locker = QMutexLocker(self._mutex)
        key = hash((char_data.get('character', ''), char_data.get('font_type', '')))
        
        if key not in self._pool:
            self._pool[key] = char_data
            if len(self._pool) > self._pool_size:
                self._pool.popitem(last=False)

    def get_stats(self) -> Dict:
        locker = QMutexLocker(self._mutex)
        return {
            'pool_size': len(self._pool),
            'capacity': self._pool_size,
            'reuse_count': self._reuse_count
        }

    def clear(self):
        locker = QMutexLocker(self._mutex)
        self._pool.clear()
        gc.collect()


class MemoryMonitor(QObject):
    high_memory_warning = pyqtSignal(float)
    memory_suggestion = pyqtSignal(str)

    MEMORY_THRESHOLD_MB = 500.0
    CRITICAL_THRESHOLD_MB = 800.0

    def __init__(self):
        super().__init__()
        self._mutex = QMutex()

    def check_memory(self) -> float:
        try:
            import psutil
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb > self.CRITICAL_THRESHOLD_MB:
                self.high_memory_warning.emit(memory_mb)
                self.memory_suggestion.emit(
                    f"内存使用过高 ({memory_mb:.1f}MB)，建议执行强制垃圾回收"
                )
                self._emergency_cleanup()
            elif memory_mb > self.MEMORY_THRESHOLD_MB:
                self.memory_suggestion.emit(
                    f"内存使用超过阈值 ({memory_mb:.1f}MB)"
                )
                
            return memory_mb
        except ImportError:
            return 0.0

    def _emergency_cleanup(self):
        gc.collect(2)
        gc.collect()
        
    def get_detailed_stats(self) -> Dict:
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                'rss_mb': memory_info.rss / 1024 / 1024,
                'vms_mb': memory_info.vms / 1024 / 1024,
                'percent': process.memory_percent(),
                'gc_objects': len(gc.get_objects())
            }
        except ImportError:
            return {}
