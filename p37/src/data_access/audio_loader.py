import os
import librosa
import soundfile as sf
import numpy as np
from typing import Tuple, Optional, List, Dict, Any, Iterator, Callable
import warnings
import gc
import hashlib
from functools import lru_cache
from scipy.spatial.distance import cosine
from scipy.signal import correlate
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import time


class AudioCache:
    def __init__(self, max_size_mb: int = 1024, ttl_seconds: int = 3600):
        self.max_size = max_size_mb * 1024 * 1024
        self.current_size = 0
        self.cache: Dict[str, Tuple[np.ndarray, int, float]] = {}
        self.access_order: List[str] = []
        self.ttl = ttl_seconds
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Tuple[np.ndarray, int]]:
        with self._lock:
            if key in self.cache:
                audio, sr, timestamp = self.cache[key]
                if time.time() - timestamp < self.ttl:
                    self.access_order.remove(key)
                    self.access_order.append(key)
                    return (audio, sr)
                else:
                    self._remove(key)
        return None

    def put(self, key: str, audio: np.ndarray, sr: int):
        with self._lock:
            if key in self.cache:
                self._remove(key)

            audio_bytes = audio.nbytes
            while self.current_size + audio_bytes > self.max_size and self.access_order:
                old_key = self.access_order.pop(0)
                self._remove(old_key)

            if audio_bytes <= self.max_size:
                self.cache[key] = (audio.copy(), sr, time.time())
                self.current_size += audio_bytes
                self.access_order.append(key)

    def _remove(self, key: str):
        if key in self.cache:
            old_audio, _, _ = self.cache.pop(key)
            self.current_size -= old_audio.nbytes
            if key in self.access_order:
                self.access_order.remove(key)

    def clear(self):
        with self._lock:
            self.cache.clear()
            self.access_order.clear()
            self.current_size = 0
        gc.collect()

    def clean_expired(self):
        current_time = time.time()
        expired_keys = [
            k for k, (_, _, ts) in self.cache.items()
            if current_time - ts > self.ttl
        ]
        for k in expired_keys:
            self._remove(k)


class AudioSegment:
    def __init__(self, audio: np.ndarray, sr: int, start_time: float, end_time: float):
        self.audio = audio
        self.sr = sr
        self.start_time = start_time
        self.end_time = end_time
        self.duration = end_time - start_time


class AudioLoader:
    SUPPORTED_FORMATS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', 
                          '.au', '.raw', '.amr', '.opus', '.wv', '.spx']
    FORMAT_ALIASES = {'.wave': '.wav', '.mp4': '.m4a'}
    MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024
    CHUNK_SIZE_SECONDS = 30
    DEFAULT_WORKERS = 4

    def __init__(self, sample_rate: int = 22050, mono: bool = True, 
                 max_memory_mb: int = 1024, use_streaming: bool = True,
                 enable_fallback: bool = True, enable_cache: bool = True,
                 cache_size_mb: int = 512, use_parallel: bool = True,
                 max_workers: int = 4, preload_size: int = 10):
        self.sample_rate = sample_rate
        self.mono = mono
        self.max_memory_mb = max_memory_mb
        self.use_streaming = use_streaming
        self.enable_fallback = enable_fallback
        self.enable_cache = enable_cache
        self.use_parallel = use_parallel
        self.max_workers = max_workers
        self.cache = AudioCache(max_size_mb=cache_size_mb)
        self._preload_queue: List[str] = []
        self._preload_thread: Optional[threading.Thread] = None
        self._preload_lock = threading.Lock()
        self._fast_resample = True

    def _get_file_hash(self, file_path: str) -> str:
        stat = os.stat(file_path)
        hash_input = f"{file_path}_{stat.st_size}_{stat.st_mtime}_{self.sample_rate}_{self.mono}"
        return hashlib.md5(hash_input.encode()).hexdigest()

    def _normalize_extension(self, file_ext: str) -> str:
        file_ext = file_ext.lower()
        return self.FORMAT_ALIASES.get(file_ext, file_ext)

    def _check_file_size(self, file_path: str) -> Tuple[bool, int]:
        file_size = os.path.getsize(file_path)
        if file_size > self.MAX_FILE_SIZE:
            return False, file_size
        return True, file_size

    def _estimate_memory(self, duration: float, sr: int) -> float:
        samples = duration * sr
        memory_mb = (samples * 4) / (1024 * 1024)
        return memory_mb

    def load_audio(self, file_path: str, stream: Optional[bool] = None,
                   offset: float = 0.0, duration: Optional[float] = None) -> Tuple[np.ndarray, int]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"音频文件不存在: {file_path}")

        if self.enable_cache and offset == 0.0 and duration is None:
            cache_key = self._get_file_hash(file_path)
            cached = self.cache.get(cache_key)
            if cached is not None:
                return cached

        file_ext = os.path.splitext(file_path)[1].lower()
        file_ext = self._normalize_extension(file_ext)

        if file_ext not in self.SUPPORTED_FORMATS:
            warnings.warn(f"格式 {file_ext} 不在支持列表，尝试加载...")

        try:
            size_ok, file_size = self._check_file_size(file_path)
            if not size_ok:
                warnings.warn(f"文件较大 ({file_size / (1024*1024):.1f} MB)，将使用流式加载")

            use_stream = stream if stream is not None else self.use_streaming

            if use_stream or file_size > 100 * 1024 * 1024:
                try:
                    result = self._load_streaming(file_path, offset, duration)
                except Exception as e:
                    if self.enable_fallback:
                        warnings.warn(f"流式加载失败，尝试标准加载: {e}")
                        result = self._load_standard(file_path, offset, duration)
                    else:
                        raise
            else:
                result = self._load_standard(file_path, offset, duration)

            if self.enable_cache and offset == 0.0 and duration is None:
                cache_key = self._get_file_hash(file_path)
                self.cache.put(cache_key, result[0], result[1])

            return result
        except Exception as e:
            if self.enable_fallback:
                warnings.warn(f"主要加载方法失败，尝试librosa后备方案: {e}")
                return self._load_librosa_fallback(file_path, offset, duration)
            else:
                raise

    def _load_standard(self, file_path: str, offset: float = 0.0, 
                       duration: Optional[float] = None) -> Tuple[np.ndarray, int]:
        try:
            with sf.SoundFile(file_path, 'r') as sf_file:
                sr = sf_file.samplerate
                start_sample = int(offset * sr)

                if start_sample > 0:
                    sf_file.seek(start_sample)

                if duration is not None:
                    n_samples = int(duration * sr)
                    y = sf_file.read(n_samples, dtype='float32')
                else:
                    y = sf_file.read(dtype='float32')

                if self.mono and len(y.shape) > 1:
                    y = np.mean(y, axis=1)

                if sr != self.sample_rate:
                    y = librosa.resample(y, orig_sr=sr, target_sr=self.sample_rate, res_type='kaiser_fast')
                    sr = self.sample_rate

                return y, sr
        except Exception as e:
            warnings.warn(f"SoundFile加载失败，尝试librosa: {e}")
            return self._load_librosa_fallback(file_path, offset, duration)

    def _load_streaming(self, file_path: str, offset: float = 0.0,
                         duration: Optional[float] = None) -> Tuple[np.ndarray, int]:
        try:
            with sf.SoundFile(file_path, 'r') as sf_file:
                sr = sf_file.samplerate
                total_duration = len(sf_file) / sr

                estimated_memory = self._estimate_memory(
                    duration if duration else total_duration, 
                    self.sample_rate
                )
                if estimated_memory > self.max_memory_mb:
                    warnings.warn(f"预计内存使用 {estimated_memory:.1f} MB，可能超出限制")

                if offset > 0 or duration is not None:
                    start_sample = int(offset * sr)
                    sf_file.seek(start_sample)
                    if duration is not None:
                        y = sf_file.read(int(duration * sr), dtype='float32')
                    else:
                        y = sf_file.read(dtype='float32')
                else:
                    if sr != self.sample_rate:
                        y = self._load_and_resample_streaming(sf_file, sr)
                    else:
                        y = sf_file.read(dtype='float32')
                        if self.mono and len(y.shape) > 1:
                            y = np.mean(y, axis=1)

                return y, self.sample_rate
        except Exception as e:
            raise RuntimeError(f"流式加载失败: {str(e)}")

    def _fast_resample_chunk(self, chunk: np.ndarray, orig_sr: int) -> np.ndarray:
        if orig_sr == self.sample_rate:
            return chunk

        ratio = self.sample_rate / orig_sr
        if ratio == 1.0:
            return chunk

        if self._fast_resample and abs(ratio - round(ratio)) < 0.01:
            n_out = int(len(chunk) * ratio)
            indices = np.linspace(0, len(chunk) - 1, n_out, dtype=np.int32)
            return chunk[indices]
        else:
            return librosa.resample(chunk, orig_sr=orig_sr, target_sr=self.sample_rate, res_type='kaiser_fast')

    def _load_and_resample_streaming(self, sf_file, orig_sr: int) -> np.ndarray:
        chunk_size = int(self.CHUNK_SIZE_SECONDS * orig_sr)
        resampled_chunks = []

        while True:
            chunk = sf_file.read(chunk_size, dtype='float32')
            if len(chunk) == 0:
                break

            if self.mono and len(chunk.shape) > 1:
                chunk = np.mean(chunk, axis=1)

            if orig_sr != self.sample_rate:
                chunk = self._fast_resample_chunk(chunk, orig_sr)

            resampled_chunks.append(chunk)

            del chunk

        result = np.concatenate(resampled_chunks)
        gc.collect()
        return result

    def preload_files(self, file_paths: List[str]):
        with self._preload_lock:
            self._preload_queue.extend(file_paths)
        
        if self._preload_thread is None or not self._preload_thread.is_alive():
            self._preload_thread = threading.Thread(target=self._preload_worker, daemon=True)
            self._preload_thread.start()

    def _preload_worker(self):
        while True:
            with self._preload_lock:
                if not self._preload_queue:
                    break
                file_path = self._preload_queue.pop(0)
            
            try:
                cache_key = self._get_file_hash(file_path)
                if self.cache.get(cache_key) is None:
                    y, sr = self._load_standard(file_path)
                    self.cache.put(cache_key, y, sr)
            except:
                pass
            time.sleep(0.01)

    def batch_load_parallel(self, file_paths: List[str], 
                            progress_callback: Optional[Callable[[int, int], None]] = None) -> List[Dict]:
        results = []
        total = len(file_paths)
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_path = {
                executor.submit(self._load_and_extract_info, path): path 
                for path in file_paths
            }
            
            for i, future in enumerate(as_completed(future_to_path)):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    path = future_to_path[future]
                    warnings.warn(f"加载失败 {path}: {e}")
                
                if progress_callback:
                    progress_callback(i + 1, total)
        
        return results

    def _load_and_extract_info(self, file_path: str) -> Dict:
        info = self.get_audio_info(file_path)
        y, sr = self.load_audio(file_path)
        info['audio_loaded'] = True
        info['sample_count'] = len(y)
        return info

    def _load_librosa_fallback(self, file_path: str, offset: float = 0.0,
                                duration: Optional[float] = None) -> Tuple[np.ndarray, int]:
        try:
            y, sr = librosa.load(
                file_path,
                sr=self.sample_rate,
                mono=self.mono,
                res_type='kaiser_fast',
                offset=offset,
                duration=duration
            )
            return y, sr
        except Exception as e1:
            warnings.warn(f"Librosa标准加载失败，尝试较慢的重采样: {e1}")
            try:
                y, sr = librosa.load(
                    file_path,
                    sr=self.sample_rate,
                    mono=self.mono,
                    res_type='kaiser_best',
                    offset=offset,
                    duration=duration
                )
                return y, sr
            except Exception as e2:
                raise RuntimeError(f"所有加载方法均失败: 1) {e1}, 2) {e2}")

    def load_audio_chunks(self, file_path: str, chunk_duration: float = 30.0) -> Iterator[Tuple[np.ndarray, int]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"音频文件不存在: {file_path}")

        try:
            with sf.SoundFile(file_path, 'r') as sf_file:
                orig_sr = sf_file.samplerate
                chunk_samples = int(chunk_duration * orig_sr)

                while True:
                    chunk = sf_file.read(chunk_samples, dtype='float32')
                    if len(chunk) == 0:
                        break

                    if self.mono and len(chunk.shape) > 1:
                        chunk = np.mean(chunk, axis=1)

                    if orig_sr != self.sample_rate:
                        chunk = librosa.resample(chunk, orig_sr=orig_sr, target_sr=self.sample_rate, res_type='kaiser_fast')

                    yield chunk, self.sample_rate

                    del chunk
                    gc.collect()
        except Exception as e:
            warnings.warn(f"流式分块失败，尝试全量加载后分块: {e}")
            y, sr = self.load_audio(file_path)
            chunk_samples = int(chunk_duration * sr)
            for i in range(0, len(y), chunk_samples):
                yield y[i:i + chunk_samples], sr

    def extract_segment(self, file_path: str, start_time: float, 
                        duration: float) -> AudioSegment:
        y, sr = self.load_audio(file_path, offset=start_time, duration=duration)
        return AudioSegment(y, sr, start_time, start_time + duration)

    def extract_segments(self, file_path: str, segment_duration: float = 5.0,
                          overlap: float = 0.0) -> List[AudioSegment]:
        audio_info = self.get_audio_info(file_path)
        total_duration = audio_info['duration']

        segments = []
        hop = segment_duration * (1 - overlap)
        for start in np.arange(0, total_duration - segment_duration + 1, hop):
            segment = self.extract_segment(file_path, start, segment_duration)
            segments.append(segment)

        return segments

    def save_segment(self, segment: AudioSegment, output_path: str):
        sf.write(output_path, segment.audio, segment.sr)

    def compare_segments(self, seg1: AudioSegment, seg2: AudioSegment, 
                          method: str = 'cosine') -> Dict[str, Any]:
        min_len = min(len(seg1.audio), len(seg2.audio))
        a1 = seg1.audio[:min_len]
        a2 = seg2.audio[:min_len]

        result = {}

        if method == 'cosine' or method == 'all':
            result['cosine_similarity'] = 1 - cosine(a1, a2)

        if method == 'correlation' or method == 'all':
            result['correlation'] = np.corrcoef(a1, a2)[0, 1]

        if method == 'xcorr' or method == 'all':
            max_lag = int(0.1 * seg1.sr)
            xcorr = correlate(a1, a2, mode='same')
            peak_idx = np.argmax(xcorr)
            result['max_correlation'] = xcorr[peak_idx]
            result['time_offset_ms'] = (peak_idx - len(a1) // 2) / seg1.sr * 1000

        if method == 'energy' or method == 'all':
            result['energy_diff'] = np.sum(a1 ** 2) - np.sum(a2 ** 2)
            result['energy_ratio'] = np.sum(a1 ** 2) / (np.sum(a2 ** 2) + 1e-10)

        return result

    def find_similar_segments(self, target_segment: AudioSegment, 
                               search_segments: List[AudioSegment],
                               threshold: float = 0.7, top_k: int = 5) -> List[Tuple[int, float]]:
        similarities = []
        for i, seg in enumerate(search_segments):
            comp = self.compare_segments(target_segment, seg, method='cosine')
            sim = comp['cosine_similarity']
            if sim >= threshold:
                similarities.append((i, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    def save_audio(self, y: np.ndarray, output_path: str, sr: Optional[int] = None):
        if sr is None:
            sr = self.sample_rate

        try:
            sf.write(output_path, y, sr, format='WAV', subtype='FLOAT')
        except Exception as e:
            warnings.warn(f"SoundFile保存失败，尝试备用格式: {e}")
            sf.write(output_path, y, sr)

    def get_audio_info(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"音频文件不存在: {file_path}")

        try:
            with sf.SoundFile(file_path, 'r') as sf_file:
                duration = len(sf_file) / sf_file.samplerate
                return {
                    'file_path': file_path,
                    'sample_rate': sf_file.samplerate,
                    'channels': sf_file.channels,
                    'duration': duration,
                    'num_samples': len(sf_file),
                    'file_size': os.path.getsize(file_path),
                    'format': sf_file.format,
                    'subtype': sf_file.subtype,
                    'estimated_memory_mb': self._estimate_memory(duration, self.sample_rate)
                }
        except Exception as e:
            try:
                duration = librosa.get_duration(path=file_path)
                sr = self.sample_rate
                return {
                    'file_path': file_path,
                    'sample_rate': sr,
                    'channels': 1,
                    'duration': duration,
                    'num_samples': int(duration * sr),
                    'file_size': os.path.getsize(file_path),
                    'format': os.path.splitext(file_path)[1].lower(),
                    'subtype': 'unknown',
                    'estimated_memory_mb': self._estimate_memory(duration, sr)
                }
            except Exception as e2:
                raise RuntimeError(f"无法获取音频信息: {e}, {e2}")

    def batch_load(self, directory: str, skip_large_files: bool = True) -> List[Dict]:
        audio_data = []
        for root, _, files in os.walk(directory):
            for file in files:
                file_ext = os.path.splitext(file)[1].lower()
                file_ext = self._normalize_extension(file_ext)

                if file_ext in self.SUPPORTED_FORMATS:
                    file_path = os.path.join(root, file)
                    try:
                        info = self.get_audio_info(file_path)
                        if skip_large_files and info['estimated_memory_mb'] > self.max_memory_mb:
                            print(f"跳过大文件: {file_path} ({info['estimated_memory_mb']:.1f} MB)")
                            continue
                        audio_data.append(info)
                    except Exception as e:
                        print(f"加载文件失败 {file_path}: {e}")
        return audio_data

    def resample_audio(self, y: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        return librosa.resample(y, orig_sr=orig_sr, target_sr=target_sr, res_type='kaiser_fast')

    def trim_silence(self, y: np.ndarray, top_db: int = 20, ref: float = np.max) -> Tuple[np.ndarray, np.ndarray]:
        try:
            return librosa.effects.trim(y, top_db=top_db, ref=ref)
        except Exception as e:
            warnings.warn(f"静音切除失败: {e}")
            return y, np.array([0, len(y)])

    def split_audio(self, y: np.ndarray, segment_duration: float = 5.0) -> List[np.ndarray]:
        segment_samples = int(segment_duration * self.sample_rate)
        segments = []
        for i in range(0, len(y), segment_samples):
            segment = y[i:i + segment_samples]
            if len(segment) >= segment_samples // 2:
                segments.append(segment)
        return segments

    def extract_features_in_chunks(self, file_path: str, feature_extractor, 
                                    chunk_duration: float = 30.0, 
                                    aggregate: bool = True) -> Dict[str, Any]:
        all_features = []
        chunk_times = []

        for i, (chunk, sr) in enumerate(self.load_audio_chunks(file_path, chunk_duration)):
            try:
                features = feature_extractor.extract_all_features(chunk, sr)
                all_features.append(features)
                chunk_times.append(i * chunk_duration)
            except Exception as e:
                warnings.warn(f"块 {i} 特征提取失败: {e}")
                continue

        if not all_features:
            raise RuntimeError("无法从任何音频块提取特征")

        if aggregate:
            return self._aggregate_chunk_features(all_features, chunk_times)
        else:
            return {'chunks': all_features, 'chunk_times': chunk_times}

    def _aggregate_chunk_features(self, chunk_features: List[Dict], times: List[float]) -> Dict[str, Any]:
        numeric_keys = [k for k in chunk_features[0].keys() 
                        if isinstance(chunk_features[0][k], (int, float, np.number))]

        aggregated = {}
        for key in numeric_keys:
            values = [f[key] for f in chunk_features]
            aggregated[f'{key}_mean'] = float(np.mean(values))
            aggregated[f'{key}_std'] = float(np.std(values))
            aggregated[f'{key}_max'] = float(np.max(values))
            aggregated[f'{key}_min'] = float(np.min(values))

        aggregated['num_chunks'] = len(chunk_features)
        aggregated['duration_seconds'] = times[-1] + (times[1] - times[0] if len(times) > 1 else 0)

        return aggregated

    def validate_audio_file(self, file_path: str) -> Tuple[bool, str]:
        if not os.path.exists(file_path):
            return False, "文件不存在"

        file_ext = os.path.splitext(file_path)[1].lower()
        file_ext = self._normalize_extension(file_ext)

        if file_ext not in self.SUPPORTED_FORMATS:
            warnings.warn(f"格式 {file_ext} 不在官方支持列表，尝试验证...")

        try:
            info = self.get_audio_info(file_path)
            if info['duration'] <= 0:
                return False, "音频时长无效"
            if info['sample_rate'] <= 0:
                return False, "采样率无效"
            return True, "验证成功"
        except Exception as e:
            return False, f"验证失败: {str(e)}"

    def clear_cache(self):
        self.cache.clear()
        gc.collect()
