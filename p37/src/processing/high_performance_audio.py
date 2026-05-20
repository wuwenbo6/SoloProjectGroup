import os
import gc
import time
import hashlib
import numpy as np
import soundfile as sf
import librosa
from typing import Tuple, Optional, List, Dict, Any, Iterator, Callable
from collections import OrderedDict
from functools import wraps
import warnings
import threading
import pickle
import zlib

try:
    import dask
    import dask.array as da
    from dask.distributed import Client, LocalCluster
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False
    warnings.warn("Dask未安装，将使用单线程处理")


class LRUCache:
    def __init__(self, max_size_mb: int = 1024):
        self.max_size = max_size_mb * 1024 * 1024
        self.current_size = 0
        self.cache = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key][0]
        return None

    def put(self, key: str, value: Any, size: Optional[int] = None):
        with self._lock:
            if size is None:
                if isinstance(value, np.ndarray):
                    size = value.nbytes
                elif isinstance(value, dict):
                    size = sum(v.nbytes for v in value.values() if isinstance(v, np.ndarray))
                else:
                    size = len(pickle.dumps(value))

            if key in self.cache:
                old_value, old_size = self.cache.pop(key)
                self.current_size -= old_size

            while self.current_size + size > self.max_size and self.cache:
                old_key, (old_value, old_size) = self.cache.popitem(last=False)
                self.current_size -= old_size
                del old_value
                gc.collect()

            if size <= self.max_size:
                self.cache[key] = (value, size)
                self.current_size += size

    def clear(self):
        with self._lock:
            self.cache.clear()
            self.current_size = 0
        gc.collect()

    def __len__(self) -> int:
        return len(self.cache)


class CompressedAudioCache:
    def __init__(self, max_size_mb: int = 2048, compression_level: int = 6):
        self.max_size = max_size_mb * 1024 * 1024
        self.current_size = 0
        self.cache: OrderedDict[str, Tuple[bytes, int, int]] = OrderedDict()
        self.compression_level = compression_level
        self._lock = threading.Lock()

    def _compress(self, data: np.ndarray) -> Tuple[bytes, tuple]:
        compressed = zlib.compress(data.tobytes(), level=self.compression_level)
        return compressed, data.shape

    def _decompress(self, compressed_data: bytes, shape: tuple) -> np.ndarray:
        decompressed = zlib.decompress(compressed_data)
        return np.frombuffer(decompressed, dtype=np.float32).reshape(shape)

    def get(self, key: str) -> Optional[np.ndarray]:
        with self._lock:
            if key in self.cache:
                compressed_data, sr, shape = self.cache[key]
                self.cache.move_to_end(key)
                return self._decompress(compressed_data, shape), sr
        return None

    def put(self, key: str, audio: np.ndarray, sr: int):
        with self._lock:
            if key in self.cache:
                old_data, old_sr, old_shape = self.cache.pop(key)
                self.current_size -= len(old_data)

            compressed_data, shape = self._compress(audio.astype(np.float32))
            data_size = len(compressed_data)

            while self.current_size + data_size > self.max_size and self.cache:
                old_key, (old_data, old_sr, old_shape) = self.cache.popitem(last=False)
                self.current_size -= len(old_data)

            if data_size <= self.max_size:
                self.cache[key] = (compressed_data, sr, shape)
                self.current_size += data_size

    def clear(self):
        with self._lock:
            self.cache.clear()
            self.current_size = 0
        gc.collect()


class MultiLevelCache:
    def __init__(self, memory_cache_size_mb: int = 1024, 
                 compressed_cache_size_mb: int = 2048,
                 disk_cache_dir: Optional[str] = None):
        self.memory_cache = LRUCache(max_size_mb=memory_cache_size_mb)
        self.compressed_cache = CompressedAudioCache(max_size_mb=compressed_cache_size_mb)
        self.disk_cache_dir = disk_cache_dir
        self.hit_counts = {'memory': 0, 'compressed': 0, 'disk': 0, 'miss': 0}

        if disk_cache_dir:
            os.makedirs(disk_cache_dir, exist_ok=True)

    def _get_disk_path(self, key: str) -> str:
        return os.path.join(self.disk_cache_dir, f"{key}.npy")

    def get(self, key: str) -> Optional[Tuple[np.ndarray, int]]:
        result = self.memory_cache.get(key)
        if result is not None:
            self.hit_counts['memory'] += 1
            return result

        result = self.compressed_cache.get(key)
        if result is not None:
            self.hit_counts['compressed'] += 1
            self.memory_cache.put(key, result[0], result[0].nbytes)
            return result

        if self.disk_cache_dir:
            disk_path = self._get_disk_path(key)
            if os.path.exists(disk_path):
                try:
                    data = np.load(disk_path, allow_pickle=True)
                    audio = data['audio']
                    sr = int(data['sr'])
                    self.hit_counts['disk'] += 1
                    self.compressed_cache.put(key, audio, sr)
                    self.memory_cache.put(key, audio, audio.nbytes)
                    return audio, sr
                except:
                    pass

        self.hit_counts['miss'] += 1
        return None

    def put(self, key: str, audio: np.ndarray, sr: int):
        self.memory_cache.put(key, audio, audio.nbytes)
        self.compressed_cache.put(key, audio, sr)

        if self.disk_cache_dir:
            try:
                disk_path = self._get_disk_path(key)
                np.savez_compressed(disk_path, audio=audio, sr=sr)
            except:
                pass

    def get_hit_rate(self) -> Dict[str, float]:
        total = sum(self.hit_counts.values())
        if total == 0:
            return {k: 0.0 for k in self.hit_counts}
        return {k: v / total for k, v in self.hit_counts.items()}

    def clear(self):
        self.memory_cache.clear()
        self.compressed_cache.clear()
        self.hit_counts = {k: 0 for k in self.hit_counts}


class ChunkedAudioProcessor:
    def __init__(self, sample_rate: int = 22050, mono: bool = True,
                 chunk_duration: float = 30.0, overlap_duration: float = 1.0,
                 use_dask: bool = True, num_workers: Optional[int] = None,
                 enable_cache: bool = True, cache_size_mb: int = 2048,
                 disk_cache_dir: Optional[str] = None):
        self.sample_rate = sample_rate
        self.mono = mono
        self.chunk_duration = chunk_duration
        self.overlap_duration = overlap_duration
        self.use_dask = use_dask and DASK_AVAILABLE
        self.num_workers = num_workers or (os.cpu_count() or 4)
        
        self.cache = MultiLevelCache(
            memory_cache_size_mb=cache_size_mb // 3,
            compressed_cache_size_mb=cache_size_mb // 2,
            disk_cache_dir=disk_cache_dir
        ) if enable_cache else None

        self.dask_client = None
        if self.use_dask:
            self._init_dask_client()

        self._processing_stats = {
            'total_chunks': 0,
            'total_time': 0.0,
            'cache_hits': 0
        }

    def _init_dask_client(self):
        try:
            cluster = LocalCluster(
                n_workers=self.num_workers,
                threads_per_worker=1,
                memory_limit='4GB'
            )
            self.dask_client = Client(cluster)
        except Exception as e:
            warnings.warn(f"Dask客户端初始化失败，使用单线程处理: {e}")
            self.use_dask = False

    def _get_file_hash(self, file_path: str) -> str:
        stat = os.stat(file_path)
        hash_input = f"{file_path}_{stat.st_size}_{stat.st_mtime}_{self.sample_rate}_{self.mono}"
        return hashlib.md5(hash_input.encode()).hexdigest()

    def _process_chunk(self, chunk: np.ndarray, orig_sr: int, 
                       chunk_idx: int) -> Dict[str, Any]:
        start_time = time.time()

        if self.mono and len(chunk.shape) > 1:
            chunk = np.mean(chunk, axis=1).astype(np.float32)

        if orig_sr != self.sample_rate:
            chunk = librosa.resample(chunk, orig_sr=orig_sr, target_sr=self.sample_rate, res_type='kaiser_fast')

        rms = np.sqrt(np.mean(chunk ** 2))
        zcr = np.mean(librosa.feature.zero_crossing_rate(chunk)[0])
        spec_cent = np.mean(librosa.feature.spectral_centroid(y=chunk, sr=self.sample_rate)[0])

        processing_time = time.time() - start_time

        return {
            'audio': chunk,
            'chunk_idx': chunk_idx,
            'rms': float(rms),
            'zcr': float(zcr),
            'spectral_centroid': float(spec_cent),
            'processing_time': processing_time
        }

    def load_audio_streaming(self, file_path: str, offset: float = 0.0,
                              duration: Optional[float] = None) -> Tuple[np.ndarray, int]:
        cache_key = self._get_file_hash(file_path) if self.cache else None

        if self.cache and offset == 0.0 and duration is None:
            cached = self.cache.get(cache_key)
            if cached is not None:
                return cached

        with sf.SoundFile(file_path, 'r') as sf_file:
            orig_sr = sf_file.samplerate
            start_sample = int(offset * orig_sr)

            if start_sample > 0:
                sf_file.seek(start_sample)

            if duration is not None:
                n_samples = int(duration * orig_sr)
                y = sf_file.read(n_samples, dtype='float32')
            else:
                y = sf_file.read(dtype='float32')

        if self.mono and len(y.shape) > 1:
            y = np.mean(y, axis=1).astype(np.float32)

        if orig_sr != self.sample_rate:
            y = librosa.resample(y, orig_sr=orig_sr, target_sr=self.sample_rate, res_type='kaiser_fast')

        if self.cache and offset == 0.0 and duration is None:
            self.cache.put(cache_key, y, self.sample_rate)

        return y, self.sample_rate

    def load_and_process_chunks(self, file_path: str, 
                                  feature_extractor: Optional[Callable] = None) -> Iterator[Dict[str, Any]]:
        cache_key = self._get_file_hash(file_path) if self.cache else None

        with sf.SoundFile(file_path, 'r') as sf_file:
            orig_sr = sf_file.samplerate
            chunk_samples = int(self.chunk_duration * orig_sr)
            overlap_samples = int(self.overlap_duration * orig_sr)

            chunk_idx = 0
            while True:
                chunk = sf_file.read(chunk_samples + overlap_samples, dtype='float32')
                if len(chunk) == 0:
                    break

                result = self._process_chunk(chunk, orig_sr, chunk_idx)

                if feature_extractor is not None:
                    try:
                        features = feature_extractor(result['audio'], self.sample_rate)
                        result['features'] = features
                    except Exception as e:
                        warnings.warn(f"块 {chunk_idx} 特征提取失败: {e}")

                self._processing_stats['total_chunks'] += 1
                self._processing_stats['total_time'] += result['processing_time']

                yield result

                chunk_idx += 1

                del chunk
                if chunk_idx % 10 == 0:
                    gc.collect()

    def process_chunks_parallel(self, file_path: str,
                                 feature_extractor: Optional[Callable] = None) -> List[Dict[str, Any]]:
        if not self.use_dask or not DASK_AVAILABLE:
            return list(self.load_and_process_chunks(file_path, feature_extractor))

        chunks_info = []
        with sf.SoundFile(file_path, 'r') as sf_file:
            orig_sr = sf_file.samplerate
            total_samples = len(sf_file)
            chunk_samples = int(self.chunk_duration * orig_sr)

            for i in range(0, total_samples, chunk_samples):
                chunks_info.append({
                    'file_path': file_path,
                    'start_sample': i,
                    'num_samples': min(chunk_samples, total_samples - i),
                    'chunk_idx': i // chunk_samples,
                    'orig_sr': orig_sr
                })

        def process_chunk_info(chunk_info: Dict) -> Dict[str, Any]:
            import soundfile as sf_local
            import librosa as librosa_local

            with sf_local.SoundFile(chunk_info['file_path'], 'r') as sf_file:
                sf_file.seek(chunk_info['start_sample'])
                chunk = sf_file.read(chunk_info['num_samples'], dtype='float32')

            orig_sr = chunk_info['orig_sr']

            if len(chunk.shape) > 1:
                chunk = np.mean(chunk, axis=1).astype(np.float32)

            if orig_sr != self.sample_rate:
                chunk = librosa_local.resample(chunk, orig_sr=orig_sr, target_sr=self.sample_rate, res_type='kaiser_fast')

            return {
                'audio': chunk,
                'chunk_idx': chunk_info['chunk_idx']
            }

        delayed_chunks = [dask.delayed(process_chunk_info)(ci) for ci in chunks_info]
        results = dask.compute(*delayed_chunks)

        if feature_extractor is not None:
            for r in results:
                try:
                    r['features'] = feature_extractor(r['audio'], self.sample_rate)
                except:
                    pass

        return list(results)

    def batch_extract_features(self, file_paths: List[str],
                                feature_extractor: Callable,
                                use_parallel: bool = True) -> Dict[str, Any]:
        results = {}

        if use_parallel and self.use_dask and DASK_AVAILABLE:
            def process_file(path: str) -> Tuple[str, Dict]:
                chunks = self.process_chunks_parallel(path, None)
                all_features = []
                for chunk in chunks:
                    try:
                        feat = feature_extractor(chunk['audio'], self.sample_rate)
                        all_features.append(feat)
                    except:
                        pass
                return path, self._aggregate_features(all_features)

            delayed_results = [dask.delayed(process_file)(fp) for fp in file_paths]
            computed_results = dask.compute(*delayed_results)
            for path, features in computed_results:
                results[path] = features
        else:
            for path in file_paths:
                all_features = []
                for chunk in self.load_and_process_chunks(path, None):
                    try:
                        feat = feature_extractor(chunk['audio'], self.sample_rate)
                        all_features.append(feat)
                    except:
                        pass
                results[path] = self._aggregate_features(all_features)

        return results

    def _aggregate_features(self, features_list: List[Dict]) -> Dict[str, Any]:
        if not features_list:
            return {}

        aggregated = {}
        first_feat = features_list[0]

        for key in first_feat.keys():
            if isinstance(first_feat[key], (int, float, np.number)):
                values = [f[key] for f in features_list if key in f]
                if values:
                    aggregated[f'{key}_mean'] = float(np.mean(values))
                    aggregated[f'{key}_std'] = float(np.std(values))
                    aggregated[f'{key}_max'] = float(np.max(values))
                    aggregated[f'{key}_min'] = float(np.min(values))

        aggregated['num_chunks'] = len(features_list)
        return aggregated

    def get_cache_stats(self) -> Dict[str, Any]:
        stats = {
            'processing_stats': self._processing_stats.copy()
        }
        if self.cache:
            stats['hit_rates'] = self.cache.get_hit_rate()
            stats['memory_cache_size'] = self.cache.memory_cache.current_size
            stats['compressed_cache_size'] = self.cache.compressed_cache.current_size
        return stats

    def clear_cache(self):
        if self.cache:
            self.cache.clear()
        gc.collect()

    def close(self):
        if self.dask_client:
            self.dask_client.close()
        self.clear_cache()


class MemoryOptimizedSpectrogram:
    @staticmethod
    def compute_spectrogram_in_chunks(y: np.ndarray, sr: int, n_fft: int = 2048,
                                       hop_length: int = 512, chunk_frames: int = 1000) -> np.ndarray:
        n_frames = (len(y) - n_fft) // hop_length + 1
        n_chunks = (n_frames + chunk_frames - 1) // chunk_frames

        spec_chunks = []

        for i in range(n_chunks):
            start_frame = i * chunk_frames
            start_sample = start_frame * hop_length
            end_sample = min(len(y), start_sample + chunk_frames * hop_length + n_fft)

            chunk = y[start_sample:end_sample]
            if len(chunk) < n_fft:
                break

            D = librosa.stft(chunk, n_fft=n_fft, hop_length=hop_length)
            spec_chunks.append(D)
            del D, chunk

            if i % 5 == 0:
                gc.collect()

        full_spec = np.concatenate(spec_chunks, axis=1)
        del spec_chunks
        gc.collect()

        return full_spec

    @staticmethod
    def downsample_spectrogram(spec: np.ndarray, max_height: int = 512,
                                max_width: int = 2000) -> np.ndarray:
        if spec.shape[0] > max_height:
            step = spec.shape[0] // max_height
            spec = spec[::step, :]

        if spec.shape[1] > max_width:
            step = spec.shape[1] // max_width
            spec = spec[:, ::step]

        return spec

    @staticmethod
    def compute_mel_spectrogram_optimized(y: np.ndarray, sr: int, n_mels: int = 128,
                                           chunk_duration: float = 10.0) -> np.ndarray:
        chunk_samples = int(chunk_duration * sr)
        mel_chunks = []

        for i in range(0, len(y), chunk_samples):
            chunk = y[i:i + chunk_samples]
            if len(chunk) < 100:
                continue

            mel_spec = librosa.feature.melspectrogram(
                y=chunk, sr=sr, n_mels=n_mels,
                n_fft=min(2048, len(chunk)),
                hop_length=512
            )
            mel_chunks.append(mel_spec)
            del mel_spec, chunk

            if len(mel_chunks) % 5 == 0:
                gc.collect()

        if not mel_chunks:
            return np.array([])

        result = np.concatenate(mel_chunks, axis=1)
        del mel_chunks
        gc.collect()

        return result


class PrefetchLoader:
    def __init__(self, processor: ChunkedAudioProcessor, prefetch_size: int = 3):
        self.processor = processor
        self.prefetch_size = prefetch_size
        self.prefetch_queue: OrderedDict[str, Tuple[np.ndarray, int]] = OrderedDict()
        self._lock = threading.Lock()
        self._prefetch_thread: Optional[threading.Thread] = None

    def preload_files(self, file_paths: List[str]):
        with self._lock:
            for path in file_paths[:self.prefetch_size]:
                if path not in self.prefetch_queue:
                    try:
                        audio, sr = self.processor.load_audio_streaming(path)
                        self.prefetch_queue[path] = (audio, sr)
                    except:
                        pass

    def get_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        with self._lock:
            if file_path in self.prefetch_queue:
                return self.prefetch_queue.pop(file_path)

        return self.processor.load_audio_streaming(file_path)

    def clear(self):
        with self._lock:
            self.prefetch_queue.clear()
        gc.collect()


def monitor_memory(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        import psutil
        process = psutil.Process()
        start_memory = process.memory_info().rss / 1024 / 1024

        result = func(*args, **kwargs)

        end_memory = process.memory_info().rss / 1024 / 1024
        peak_memory = process.memory_info().rss / 1024 / 1024

        print(f"内存使用 - 开始: {start_memory:.1f} MB, 结束: {end_memory:.1f} MB, 峰值: {peak_memory:.1f} MB")

        return result
    return wrapper
