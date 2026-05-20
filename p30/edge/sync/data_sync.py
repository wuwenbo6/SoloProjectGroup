#!/usr/bin/env python3
"""
后端数据同步协议优化模块
实现数据压缩、增量同步、批量传输，降低网络传输损耗
"""

import time
import zlib
import gzip
import bz2
import lzma
import hashlib
import json
import threading
from typing import Dict, List, Optional, Any, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import logging
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CompressionAlgorithm(Enum):
    """压缩算法类型"""
    NONE = "none"
    ZLIB = "zlib"
    GZIP = "gzip"
    BZ2 = "bz2"
    LZMA = "lzma"
    SNAPPY = "snappy"
    LZ4 = "lz4"


class SyncMode(Enum):
    """同步模式"""
    FULL_SYNC = "full_sync"
    INCREMENTAL = "incremental"
    DELTA = "delta"
    BATCH = "batch"


class SyncPriority(Enum):
    """同步优先级"""
    CRITICAL = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3


@dataclass
class SyncStats:
    """同步统计信息"""
    total_data_sent: int = 0
    total_data_received: int = 0
    compressed_data_sent: int = 0
    compression_ratio: float = 0.0
    sync_count: int = 0
    failed_syncs: int = 0
    avg_latency_ms: float = 0.0
    bandwidth_saved: int = 0
    sync_modes_used: Dict[str, int] = field(default_factory=dict)


@dataclass
class SyncRecord:
    """同步记录"""
    record_id: str
    data_type: str
    timestamp: float
    checksum: str
    version: int
    data_size: int
    compressed: bool = False
    compression_algo: str = "none"


class DataCompressor:
    """数据压缩器 - 支持多种压缩算法"""
    
    def __init__(self, default_algo: CompressionAlgorithm = CompressionAlgorithm.ZLIB):
        self.default_algo = default_algo
        self._compression_stats: Dict[str, Dict] = {}
        self._lock = threading.Lock()
    
    def compress(self, data: bytes,
                algo: Optional[CompressionAlgorithm] = None,
                level: int = 6) -> Tuple[bytes, Dict]:
        """压缩数据"""
        if algo is None:
            algo = self.default_algo
        
        original_size = len(data)
        start_time = time.time()
        
        try:
            if algo == CompressionAlgorithm.NONE:
                compressed = data
            elif algo == CompressionAlgorithm.ZLIB:
                compressed = zlib.compress(data, level=level)
            elif algo == CompressionAlgorithm.GZIP:
                compressed = gzip.compress(data, compresslevel=level)
            elif algo == CompressionAlgorithm.BZ2:
                compressed = bz2.compress(data, compresslevel=min(level, 9))
            elif algo == CompressionAlgorithm.LZMA:
                compressed = lzma.compress(data)
            elif algo == CompressionAlgorithm.SNAPPY:
                compressed = data
            elif algo == CompressionAlgorithm.LZ4:
                compressed = data
            else:
                compressed = data
        
        except Exception as e:
            logger.warning(f"Compression failed: {e}, falling back to none")
            compressed = data
            algo = CompressionAlgorithm.NONE
        
        compression_time = (time.time() - start_time) * 1000
        compressed_size = len(compressed)
        ratio = original_size / max(compressed_size, 1) if original_size > 0 else 1.0
        
        stats = {
            'original_size': original_size,
            'compressed_size': compressed_size,
            'compression_ratio': ratio,
            'compression_time_ms': compression_time,
            'algorithm': algo.value,
        }
        
        with self._lock:
            if algo.value not in self._compression_stats:
                self._compression_stats[algo.value] = {
                    'total_original': 0,
                    'total_compressed': 0,
                    'count': 0,
                }
            self._compression_stats[algo.value]['total_original'] += original_size
            self._compression_stats[algo.value]['total_compressed'] += compressed_size
            self._compression_stats[algo.value]['count'] += 1
        
        return compressed, stats
    
    def decompress(self, compressed_data: bytes,
                  algo: CompressionAlgorithm) -> bytes:
        """解压缩数据"""
        try:
            if algo == CompressionAlgorithm.NONE:
                return compressed_data
            elif algo == CompressionAlgorithm.ZLIB:
                return zlib.decompress(compressed_data)
            elif algo == CompressionAlgorithm.GZIP:
                return gzip.decompress(compressed_data)
            elif algo == CompressionAlgorithm.BZ2:
                return bz2.decompress(compressed_data)
            elif algo == CompressionAlgorithm.LZMA:
                return lzma.decompress(compressed_data)
            else:
                return compressed_data
        except Exception as e:
            logger.error(f"Decompression failed: {e}")
            return compressed_data
    
    def select_optimal_algo(self, data: bytes,
                           latency_budget_ms: float = 100.0) -> CompressionAlgorithm:
        """选择最优压缩算法"""
        data_size = len(data)
        
        if data_size < 1024:
            return CompressionAlgorithm.NONE
        
        if data_size < 10 * 1024:
            return CompressionAlgorithm.ZLIB
        elif data_size < 100 * 1024:
            return CompressionAlgorithm.GZIP
        else:
            return CompressionAlgorithm.LZMA
    
    def get_stats(self) -> Dict:
        """获取压缩统计"""
        with self._lock:
            return dict(self._compression_stats)


class ChecksumGenerator:
    """校验和生成器"""
    
    @staticmethod
    def generate_md5(data: bytes) -> str:
        return hashlib.md5(data).hexdigest()
    
    @staticmethod
    def generate_sha1(data: bytes) -> str:
        return hashlib.sha1(data).hexdigest()
    
    @staticmethod
    def generate_sha256(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()
    
    @staticmethod
    def fast_checksum(data: bytes) -> str:
        return hashlib.md5(data).hexdigest()[:16]


class DeltaEncoder:
    """增量编码器 - 基于版本差异编码"""
    
    def __init__(self):
        self._version_history: Dict[str, List[Dict]] = {}
        self._base_versions: Dict[str, bytes] = {}
    
    def compute_delta(self, record_id: str, new_data: bytes) -> Optional[bytes]:
        """计算增量差异"""
        if record_id not in self._base_versions:
            self._base_versions[record_id] = new_data
            return None
        
        base_data = self._base_versions[record_id]
        
        if new_data == base_data:
            return b''
        
        delta = self._simple_delta(base_data, new_data)
        
        self._base_versions[record_id] = new_data
        
        return delta
    
    def _simple_delta(self, base: bytes, new: bytes) -> bytes:
        """简单增量编码"""
        import struct
        
        changes = []
        min_len = min(len(base), len(new))
        
        i = 0
        while i < min_len:
            if base[i] != new[i]:
                start = i
                while i < min_len and base[i] != new[i]:
                    i += 1
                changes.append((start, new[start:i]))
            i += 1
        
        if len(new) > min_len:
            changes.append((min_len, new[min_len:]))
        
        delta_data = []
        for pos, data in changes:
            delta_data.append(struct.pack('!I', pos))
            delta_data.append(struct.pack('!I', len(data)))
            delta_data.append(data)
        
        return b''.join(delta_data)
    
    def apply_delta(self, base: bytes, delta: bytes) -> bytes:
        """应用增量"""
        if not delta:
            return base
        
        import struct
        
        result = bytearray(base)
        offset = 0
        
        while offset < len(delta):
            pos = struct.unpack('!I', delta[offset:offset + 4])[0]
            offset += 4
            
            length = struct.unpack('!I', delta[offset:offset + 4])[0]
            offset += 4
            
            data = delta[offset:offset + length]
            offset += length
            
            if pos >= len(result):
                result.extend(data)
            else:
                result[pos:pos + length] = data
        
        return bytes(result)


class IncrementalSyncManager:
    """增量同步管理器"""
    
    def __init__(self):
        self._sync_records: Dict[str, SyncRecord] = {}
        self._version_counters: Dict[str, int] = {}
        self._delta_encoder = DeltaEncoder()
        self._checksum_gen = ChecksumGenerator()
        self._lock = threading.Lock()
    
    def needs_sync(self, record_id: str, data: bytes) -> bool:
        """检查是否需要同步"""
        with self._lock:
            if record_id not in self._sync_records:
                return True
            
            current_checksum = self._checksum_gen.fast_checksum(data)
            return self._sync_records[record_id].checksum != current_checksum
    
    def prepare_sync(self, record_id: str, data: bytes,
                    data_type: str = "general") -> Dict:
        """准备同步数据包"""
        with self._lock:
            current_version = self._version_counters.get(record_id, 0)
            current_checksum = self._checksum_gen.fast_checksum(data)
            
            if record_id in self._sync_records:
                sync_mode = SyncMode.INCREMENTAL
                delta = self._delta_encoder.compute_delta(record_id, data)
                
                if delta is None or len(delta) == 0:
                    sync_mode = SyncMode.INCREMENTAL
                    sync_data = delta if delta else data
                else:
                    sync_data = data
                    sync_mode = SyncMode.FULL_SYNC
            else:
                sync_mode = SyncMode.FULL_SYNC
                sync_data = data
            
            new_version = current_version + 1
            
            record = SyncRecord(
                record_id=record_id,
                data_type=data_type,
                timestamp=time.time(),
                checksum=current_checksum,
                version=new_version,
                data_size=len(sync_data),
            )
            
            self._sync_records[record_id] = record
            self._version_counters[record_id] = new_version
            
            return {
                'record_id': record_id,
                'version': new_version,
                'checksum': current_checksum,
                'data': sync_data,
                'sync_mode': sync_mode.value,
                'data_type': data_type,
                'timestamp': record.timestamp,
            }


class BatchAggregator:
    """批量聚合器"""
    
    def __init__(self, max_batch_size: int = 1024 * 1024,
                 max_wait_time: float = 1.0,
                 max_items: int = 100):
        self.max_batch_size = max_batch_size
        self.max_wait_time = max_wait_time
        self.max_items = max_items
        
        self._batch_queue: List[Dict] = []
        self._batch_size = 0
        self._batch_start = time.time()
        self._lock = threading.Lock()
        self._callback: Optional[Callable] = None
    
    def add_item(self, item: Dict) -> bool:
        """添加项目到批处理"""
        with self._lock:
            item_size = len(item.get('data', b'')) if isinstance(item.get('data'), bytes) else len(json.dumps(item))
            
            if (self._batch_size + item_size > self.max_batch_size or
                len(self._batch_queue) >= self.max_items):
                return False
            
            self._batch_queue.append(item)
            self._batch_size += item_size
            
            return True
    
    def should_flush(self) -> bool:
        """检查是否应该刷新"""
        with self._lock:
            if not self._batch_queue:
                return False
            
            elapsed = time.time() - self._batch_start
            return (elapsed >= self.max_wait_time or
                    self._batch_size >= self.max_batch_size * 0.8 or
                    len(self._batch_queue) >= self.max_items)
    
    def flush(self) -> List[Dict]:
        """刷新当前批次"""
        with self._lock:
            batch = list(self._batch_queue)
            self._batch_queue.clear()
            self._batch_size = 0
            self._batch_start = time.time()
            return batch
    
    def get_current_stats(self) -> Dict:
        """获取当前统计"""
        with self._lock:
            return {
                'queue_size': len(self._batch_queue),
                'total_bytes': self._batch_size,
                'wait_time': time.time() - self._batch_start,
            }


class SyncProtocol(ABC):
    """同步协议抽象基类"""
    
    @abstractmethod
    def send(self, data: Dict) -> bool:
        pass
    
    @abstractmethod
    def receive(self) -> Optional[Dict]:
        pass


class OptimizedSyncProtocol(SyncProtocol):
    """优化的同步协议"""
    
    def __init__(self, compression_algo: CompressionAlgorithm = CompressionAlgorithm.ZLIB):
        self.compressor = DataCompressor(compression_algo)
        self.incremental_manager = IncrementalSyncManager()
        self.batch_aggregator = BatchAggregator()
        self.checksum_gen = ChecksumGenerator()
        
        self.stats = SyncStats()
        self._latency_samples: deque = deque(maxlen=100)
        self._lock = threading.Lock()
        
        self._flush_thread: Optional[threading.Thread] = None
        self._running = False
    
    def start(self):
        """启动同步协议"""
        self._running = True
        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()
        logger.info("Optimized sync protocol started")
    
    def stop(self):
        """停止同步协议"""
        self._running = False
        if self._flush_thread:
            self._flush_thread.join(timeout=2.0)
    
    def queue_sync(self, record_id: str, data: Any,
                   data_type: str = "general",
                   priority: SyncPriority = SyncPriority.MEDIUM,
                   callback: Optional[Callable] = None) -> bool:
        """排队同步请求"""
        if isinstance(data, bytes):
            data_bytes = data
        else:
            data_bytes = json.dumps(data).encode('utf-8')
        
        if not self.incremental_manager.needs_sync(record_id, data_bytes):
            return False
        
        sync_packet = self.incremental_manager.prepare_sync(record_id, data_bytes, data_type)
        sync_packet['priority'] = priority.value
        sync_packet['callback'] = callback
        
        return self.batch_aggregator.add_item(sync_packet)
    
    def _flush_loop(self):
        """刷新循环"""
        while self._running:
            if self.batch_aggregator.should_flush():
                self._sync_batch()
            time.sleep(0.1)
    
    def _sync_batch(self) -> bool:
        """同步批次"""
        batch = self.batch_aggregator.flush()
        if not batch:
            return False
        
        start_time = time.time()
        
        processed_batch = []
        for item in batch:
            processed_item = {}
            for k, v in item.items():
                if isinstance(v, bytes):
                    processed_item[k] = v.decode('utf-8', errors='replace')
                else:
                    processed_item[k] = v
            processed_batch.append(processed_item)
        
        batch_data = json.dumps({
            'items': processed_batch,
            'batch_size': len(processed_batch),
            'timestamp': time.time(),
        }).encode('utf-8')
        
        algo = self.compressor.select_optimal_algo(batch_data)
        compressed_data, comp_stats = self.compressor.compress(batch_data, algo)
        
        success = self._send_to_backend(compressed_data, {
            'compression': algo.value,
            'batch_size': len(batch),
            'original_size': comp_stats['original_size'],
            'compressed_size': comp_stats['compressed_size'],
        })
        
        latency = (time.time() - start_time) * 1000
        
        with self._lock:
            self.stats.total_data_sent += comp_stats['original_size']
            self.stats.compressed_data_sent += comp_stats['compressed_size']
            self.stats.bandwidth_saved += (comp_stats['original_size'] - comp_stats['compressed_size'])
            self.stats.sync_count += 1
            if not success:
                self.stats.failed_syncs += 1
            self._latency_samples.append(latency)
            
            sync_mode = batch[0].get('sync_mode', 'unknown')
            self.stats.sync_modes_used[sync_mode] = self.stats.sync_modes_used.get(sync_mode, 0) + 1
        
        return success
    
    def _send_to_backend(self, data: bytes, metadata: Dict) -> bool:
        """发送到后端"""
        logger.debug(f"Sending {len(data)} bytes to backend, meta: {metadata}")
        return True
    
    def send(self, data: Dict) -> bool:
        """发送数据"""
        record_id = data.get('record_id', f'record_{time.time()}')
        return self.queue_sync(record_id, data)
    
    def receive(self) -> Optional[Dict]:
        """接收数据"""
        return None
    
    def force_sync(self):
        """强制同步"""
        self._sync_batch()
    
    def get_stats(self) -> SyncStats:
        """获取同步统计"""
        with self._lock:
            if self._latency_samples:
                self.stats.avg_latency_ms = sum(self._latency_samples) / len(self._latency_samples)
            
            if self.stats.total_data_sent > 0:
                self.stats.compression_ratio = (
                    self.stats.total_data_sent / max(self.stats.compressed_data_sent, 1)
                )
            
            return SyncStats(
                total_data_sent=self.stats.total_data_sent,
                total_data_received=self.stats.total_data_received,
                compressed_data_sent=self.stats.compressed_data_sent,
                compression_ratio=self.stats.compression_ratio,
                sync_count=self.stats.sync_count,
                failed_syncs=self.stats.failed_syncs,
                avg_latency_ms=self.stats.avg_latency_ms,
                bandwidth_saved=self.stats.bandwidth_saved,
                sync_modes_used=dict(self.stats.sync_modes_used),
            )


class AdaptiveCompressionManager:
    """自适应压缩管理器"""
    
    def __init__(self):
        self._bandwidth_history: deque = deque(maxlen=50)
        self._latency_history: deque = deque(maxlen=50)
        self._current_algo = CompressionAlgorithm.ZLIB
        self._algo_performance: Dict[str, Dict] = {}
    
    def update_metrics(self, bandwidth_bps: float, latency_ms: float):
        """更新网络指标"""
        self._bandwidth_history.append(bandwidth_bps)
        self._latency_history.append(latency_ms)
    
    def get_optimal_algo(self) -> CompressionAlgorithm:
        """获取最优算法"""
        if not self._bandwidth_history or not self._latency_history:
            return CompressionAlgorithm.ZLIB
        
        avg_bandwidth = sum(self._bandwidth_history) / len(self._bandwidth_history)
        avg_latency = sum(self._latency_history) / len(self._latency_history)
        
        if avg_bandwidth > 100 * 1024 * 1024:
            return CompressionAlgorithm.NONE
        elif avg_bandwidth > 10 * 1024 * 1024:
            return CompressionAlgorithm.ZLIB
        elif avg_latency < 50:
            return CompressionAlgorithm.GZIP
        else:
            return CompressionAlgorithm.LZMA
    
    def record_algo_performance(self, algo: str, ratio: float, time_ms: float):
        """记录算法性能"""
        if algo not in self._algo_performance:
            self._algo_performance[algo] = {'ratios': [], 'times': []}
        
        self._algo_performance[algo]['ratios'].append(ratio)
        self._algo_performance[algo]['times'].append(time_ms)


class BandwidthEstimator:
    """带宽估计器"""
    
    def __init__(self):
        self._transfer_samples: List[Tuple[int, float]] = []
        self._window_size = 10
    
    def record_transfer(self, bytes_transferred: int, time_seconds: float):
        """记录传输"""
        if time_seconds > 0:
            self._transfer_samples.append((bytes_transferred, time_seconds))
            if len(self._transfer_samples) > self._window_size:
                self._transfer_samples.pop(0)
    
    def estimate_bandwidth_bps(self) -> float:
        """估计带宽"""
        if not self._transfer_samples:
            return 0.0
        
        total_bytes = sum(s[0] for s in self._transfer_samples)
        total_time = sum(s[1] for s in self._transfer_samples)
        
        return (total_bytes * 8) / max(total_time, 0.001)
