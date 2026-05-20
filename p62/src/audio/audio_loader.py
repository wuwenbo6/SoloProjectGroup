import os
import gc
import librosa
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union, Iterator
import subprocess
import tempfile


class AudioLoader:
    SUPPORTED_FORMATS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.amr']
    CONVERTIBLE_FORMATS = ['.aac', '.wma', '.amr', '.opus']
    OPERA_TYPES = ['祁剧', '潮剧', '京剧', '豫剧', '越剧', '黄梅戏', '昆曲', '粤剧']
    
    LARGE_FILE_THRESHOLD = 100 * 1024 * 1024  # 100MB
    CHUNK_DURATION = 30  # seconds

    def __init__(self, sample_rate: int = 22050, enable_streaming: bool = True, 
                 auto_convert: bool = True, temp_dir: Optional[str] = None):
        self.sample_rate = sample_rate
        self.enable_streaming = enable_streaming
        self.auto_convert = auto_convert
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.audio_data = {}
        self.metadata = pd.DataFrame()
        self._chunk_cache = {}

    def load_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        file_size = os.path.getsize(file_path)
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in self.CONVERTIBLE_FORMATS and self.auto_convert:
            file_path = self._convert_to_wav(file_path)
        
        if self.enable_streaming and file_size > self.LARGE_FILE_THRESHOLD:
            return self._load_audio_streaming(file_path)
        
        y, sr = librosa.load(file_path, sr=self.sample_rate)
        return y, sr

    def _convert_to_wav(self, input_path: str) -> str:
        input_path_obj = Path(input_path)
        output_path = Path(self.temp_dir) / f"{input_path_obj.stem}_converted.wav"
        
        try:
            import soundfile as sf
            y, sr = librosa.load(input_path, sr=self.sample_rate)
            sf.write(str(output_path), y, sr)
            return str(output_path)
        except Exception as e:
            try:
                cmd = [
                    'ffmpeg', '-i', input_path,
                    '-ar', str(self.sample_rate),
                    '-ac', '1',
                    '-y', str(output_path)
                ]
                subprocess.run(cmd, check=True, capture_output=True)
                return str(output_path)
            except Exception as e2:
                raise RuntimeError(f"音频格式转换失败: {e}, {e2}")

    def _load_audio_streaming(self, file_path: str) -> Tuple[np.ndarray, int]:
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.wav':
            return self._load_wav_streaming(file_path)
        
        y_total = []
        duration = librosa.get_duration(filename=file_path)
        n_chunks = int(np.ceil(duration / self.CHUNK_DURATION))
        
        for i in range(n_chunks):
            offset = i * self.CHUNK_DURATION
            duration_chunk = min(self.CHUNK_DURATION, duration - offset)
            
            y_chunk, sr = librosa.load(
                file_path,
                sr=self.sample_rate,
                offset=offset,
                duration=duration_chunk
            )
            y_total.append(y_chunk)
            
            del y_chunk
            gc.collect()
        
        y = np.concatenate(y_total)
        return y, self.sample_rate

    def _load_wav_streaming(self, file_path: str) -> Tuple[np.ndarray, int]:
        import soundfile as sf
        
        with sf.SoundFile(file_path) as f:
            sr = f.samplerate
            
            if sr != self.sample_rate:
                y, _ = librosa.load(file_path, sr=self.sample_rate)
                return y, self.sample_rate
            
            y_total = []
            chunk_size = int(self.CHUNK_DURATION * sr)
            
            while True:
                y_chunk = f.read(chunk_size)
                if len(y_chunk) == 0:
                    break
                y_total.append(y_chunk)
                
                del y_chunk
                gc.collect()
            
            if f.channels > 1:
                y = np.mean(np.concatenate(y_total), axis=1)
            else:
                y = np.concatenate(y_total)
            
            return y, sr

    def load_audio_chunks(self, file_path: str, chunk_duration: int = 30) -> Iterator[Tuple[np.ndarray, int, float]]:
        duration = librosa.get_duration(filename=file_path)
        n_chunks = int(np.ceil(duration / chunk_duration))
        
        for i in range(n_chunks):
            offset = i * chunk_duration
            duration_chunk = min(chunk_duration, duration - offset)
            
            y_chunk, sr = librosa.load(
                file_path,
                sr=self.sample_rate,
                offset=offset,
                duration=duration_chunk
            )
            
            yield y_chunk, sr, offset

    def load_directory(self, directory: str, opera_type: Optional[str] = None) -> Dict[str, Dict]:
        directory_path = Path(directory)
        results = {}

        for file_path in directory_path.rglob('*'):
            if file_path.suffix.lower() in self.SUPPORTED_FORMATS:
                try:
                    y, sr = self.load_audio(str(file_path))
                    file_info = {
                        'audio': y,
                        'sample_rate': sr,
                        'duration': len(y) / sr,
                        'file_path': str(file_path),
                        'file_name': file_path.name,
                        'opera_type': opera_type or self._detect_opera_type(file_path.name),
                        'inheritor': self._extract_inheritor(file_path.name),
                        'year': self._extract_year(file_path.name)
                    }
                    results[str(file_path)] = file_info
                    self.audio_data[str(file_path)] = file_info
                except Exception as e:
                    print(f"Error loading {file_path}: {e}")

        self._update_metadata()
        return results

    def _detect_opera_type(self, filename: str) -> str:
        filename_lower = filename.lower()
        for opera in self.OPERA_TYPES:
            if opera in filename or opera.lower() in filename_lower:
                return opera
        return '未知'

    def _extract_inheritor(self, filename: str) -> str:
        import re
        patterns = [
            r'传人[：:]\s*([^_\-.]+)',
            r'演唱[：:]\s*([^_\-.]+)',
            r'_([^_]+)_传人',
            r'([A-Za-z\u4e00-\u9fa5]+)-\d{4}'
        ]
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                return match.group(1).strip()
        return '未知'

    def _extract_year(self, filename: str) -> Optional[int]:
        import re
        match = re.search(r'(19|20)\d{2}', filename)
        if match:
            return int(match.group())
        return None

    def _update_metadata(self):
        self.metadata = pd.DataFrame([
            {
                'file_path': k,
                'file_name': v['file_name'],
                'opera_type': v['opera_type'],
                'inheritor': v['inheritor'],
                'year': v['year'],
                'duration': v['duration'],
                'sample_rate': v['sample_rate']
            }
            for k, v in self.audio_data.items()
        ])

    def get_audio_by_opera(self, opera_type: str) -> Dict[str, Dict]:
        return {k: v for k, v in self.audio_data.items() if v['opera_type'] == opera_type}

    def get_audio_by_inheritor(self, inheritor: str) -> Dict[str, Dict]:
        return {k: v for k, v in self.audio_data.items() if v['inheritor'] == inheritor}

    def filter_by_year_range(self, start_year: int, end_year: int) -> pd.DataFrame:
        return self.metadata[
            (self.metadata['year'] >= start_year) &
            (self.metadata['year'] <= end_year)
        ].dropna(subset=['year'])

    def get_opera_types(self) -> List[str]:
        return self.metadata['opera_type'].unique().tolist()

    def get_inheritors(self) -> List[str]:
        return self.metadata['inheritor'].unique().tolist()

    def extract_segment(self, audio: np.ndarray, sr: int, 
                        start_time: float, end_time: float) -> Tuple[np.ndarray, int]:
        start_idx = int(start_time * sr)
        end_idx = int(end_time * sr)
        
        start_idx = max(0, start_idx)
        end_idx = min(len(audio), end_idx)
        
        if start_idx >= end_idx:
            raise ValueError("无效的时间范围")
        
        return audio[start_idx:end_idx], sr

    def extract_segment_from_file(self, file_path: str, 
                                 start_time: float, end_time: float) -> Tuple[np.ndarray, int]:
        y, sr = self.load_audio(file_path)
        return self.extract_segment(y, sr, start_time, end_time)

    def compare_segments(self, segment1: Tuple[np.ndarray, int], 
                        segment2: Tuple[np.ndarray, int]) -> Dict[str, float]:
        y1, sr1 = segment1
        y2, sr2 = segment2
        
        if sr1 != sr2:
            y2 = librosa.resample(y2, orig_sr=sr2, target_sr=sr1)
        
        min_len = min(len(y1), len(y2))
        y1 = y1[:min_len]
        y2 = y2[:min_len]
        
        correlation = np.correlate(y1, y2)[0] / (np.linalg.norm(y1) * np.linalg.norm(y2))
        
        energy_diff = abs(np.sum(y1**2) - np.sum(y2**2))
        
        zcr1 = np.mean(librosa.feature.zero_crossing_rate(y1)[0])
        zcr2 = np.mean(librosa.feature.zero_crossing_rate(y2)[0])
        zcr_diff = abs(zcr1 - zcr2)
        
        mfcc1 = librosa.feature.mfcc(y=y1, sr=sr1, n_mfcc=13)
        mfcc2 = librosa.feature.mfcc(y=y2, sr=sr1, n_mfcc=13)
        mfcc_cosine = np.mean([
            np.dot(m1, m2) / (np.linalg.norm(m1) * np.linalg.norm(m2))
            for m1, m2 in zip(mfcc1.T, mfcc2.T)
        ])
        
        return {
            'waveform_correlation': float(correlation),
            'energy_difference': float(energy_diff),
            'zcr_difference': float(zcr_diff),
            'mfcc_similarity': float(mfcc_cosine),
            'duration_ratio': float(len(y1) / len(y2) if len(y2) > 0 else 0)
        }

    def save_segment(self, y_segment: np.ndarray, sr: int, output_path: str):
        import soundfile as sf
        sf.write(output_path, y_segment, sr)

    def generate_sample_data(self, n_samples: int = 10, save_dir: Optional[str] = None) -> Dict[str, Dict]:
        import uuid
        samples = {}
        
        opera_styles = ['祁剧高腔', '祁剧弹腔', '祁剧昆腔', 
                       '潮剧正字戏', '潮剧白字戏', '潮剧西秦戏',
                       '京剧老生', '京剧青衣', '京剧花脸']
        
        for i in range(n_samples):
            duration = np.random.uniform(30, 120)
            t = np.linspace(0, duration, int(self.sample_rate * duration))
            
            base_freq = np.random.uniform(200, 800)
            y = np.sin(2 * np.pi * base_freq * t)
            y += 0.3 * np.sin(2 * np.pi * base_freq * 2 * t)
            y += 0.1 * np.sin(2 * np.pi * base_freq * 3 * t)
            y += 0.05 * np.random.randn(len(y))
            
            opera_type = np.random.choice(['祁剧', '潮剧', '京剧'])
            
            if opera_type == '祁剧':
                style = np.random.choice(['祁剧高腔', '祁剧弹腔', '祁剧昆腔'])
            elif opera_type == '潮剧':
                style = np.random.choice(['潮剧正字戏', '潮剧白字戏', '潮剧西秦戏'])
            else:
                style = np.random.choice(['京剧老生', '京剧青衣', '京剧花脸'])
            
            inheritor = np.random.choice(['张三', '李四', '王五', '赵六'])
            year = np.random.randint(1980, 2025)
            
            file_name = f"{opera_type}_{style}_{inheritor}_{year}_{uuid.uuid4().hex[:8]}.wav"
            
            samples[file_name] = {
                'audio': y,
                'sample_rate': self.sample_rate,
                'duration': duration,
                'file_name': file_name,
                'opera_type': opera_type,
                'opera_style': style,
                'inheritor': inheritor,
                'year': year
            }
            
            if save_dir:
                save_path = Path(save_dir) / file_name
                import soundfile as sf
                sf.write(str(save_path), y, self.sample_rate)
        
        return samples
