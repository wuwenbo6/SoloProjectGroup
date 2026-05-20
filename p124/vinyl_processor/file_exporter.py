import numpy as np
import soundfile as sf
import os
import json
import csv
import gc
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


class FileExporter:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.supported_formats = ['wav', 'flac', 'aiff', 'ogg']
        self._block_size = int(10 * sample_rate)  # 10秒为一个块
        self._progress_callback = None

    def export_audio(self, audio: np.ndarray, file_path: str, 
                     format: str = 'wav', bit_depth: str = 'PCM_16',
                     show_progress: bool = True) -> bool:
        try:
            format = format.lower()
            if format not in self.supported_formats:
                raise ValueError(f"不支持的格式: {format}")
            
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            subtype_map = {
                'PCM_16': 'PCM_16',
                'PCM_24': 'PCM_24',
                'PCM_32': 'PCM_32',
                'FLOAT': 'FLOAT'
            }
            subtype = subtype_map.get(bit_depth, 'PCM_16')
            
            total_samples = len(audio)
            
            if total_samples > self._block_size * 2:
                return self._export_blockwise(audio, file_path, format, subtype, show_progress)
            else:
                sf.write(file_path, audio, self.sample_rate, 
                        format=format.upper(), 
                        subtype=subtype)
            
            if show_progress:
                file_size = os.path.getsize(file_path) / (1024 * 1024)
                duration = len(audio) / self.sample_rate
                print(f"音频已导出: {file_path} ({duration:.1f}秒, {file_size:.1f}MB)")
            return True
        except Exception as e:
            print(f"导出失败: {e}")
            return False
    
    def _export_blockwise(self, audio: np.ndarray, file_path: str,
                          format: str, subtype: str, show_progress: bool) -> bool:
        try:
            total_samples = len(audio)
            num_blocks = (total_samples + self._block_size - 1) // self._block_size
            
            if show_progress:
                duration = total_samples / self.sample_rate
                print(f"开始分块导出: {duration:.1f}秒, {num_blocks}个块")
            
            channels = audio.shape[1] if audio.ndim == 2 else 1
            
            with sf.SoundFile(file_path, 'w', samplerate=self.sample_rate,
                            channels=channels, format=format.upper(), subtype=subtype) as f:
                for i in range(0, total_samples, self._block_size):
                    end = min(i + self._block_size, total_samples)
                    block = audio[i:end]
                    f.write(block)
                    
                    if show_progress and (i // self._block_size) % 5 == 0:
                        progress = (end / total_samples) * 100
                        print(f"  导出进度: {progress:.0f}%")
            
            if show_progress:
                file_size = os.path.getsize(file_path) / (1024 * 1024)
                print(f"音频已导出: {file_path} ({file_size:.1f}MB)")
            
            gc.collect()
            return True
        except Exception as e:
            print(f"分块导出失败: {e}")
            return False

    def export_batch(self, segments: List[Tuple[np.ndarray, float, float]],
                     output_dir: str, base_name: str = 'track',
                     format: str = 'wav', bit_depth: str = 'PCM_16',
                     show_progress: bool = True) -> List[str]:
        os.makedirs(output_dir, exist_ok=True)
        
        exported_files = []
        total_segments = len(segments)
        
        if show_progress and total_segments > 0:
            total_duration = sum((end - start) for _, start, end in segments)
            print(f"开始批量导出: {total_segments}个曲目, 总时长: {total_duration/60:.1f}分钟")
        
        for i, (audio, start, end) in enumerate(segments):
            if show_progress:
                print(f"\n导出曲目 {i + 1}/{total_segments}:")
            
            file_name = f"{base_name}_{i + 1:02d}.{format}"
            file_path = os.path.join(output_dir, file_name)
            
            if self.export_audio(audio, file_path, format, bit_depth, show_progress=False):
                exported_files.append(file_path)
            
            if (i + 1) % 5 == 0:
                gc.collect()
        
        if show_progress:
            print(f"\n批量导出完成: {len(exported_files)}/{total_segments}个文件成功导出")
        
        return exported_files

    def export_metadata(self, segments: List[Tuple[np.ndarray, float, float]],
                        file_path: str, format: str = 'json',
                        additional_info: Optional[Dict] = None) -> bool:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            metadata = {
                'export_time': datetime.now().isoformat(),
                'sample_rate': self.sample_rate,
                'num_tracks': len(segments),
                'tracks': []
            }
            
            if additional_info:
                metadata.update(additional_info)
            
            for i, (audio, start, end) in enumerate(segments):
                duration = end - start
                peak_level = float(np.max(np.abs(audio)))
                
                if audio.ndim == 2:
                    mono = np.mean(audio, axis=1)
                else:
                    mono = audio
                
                rms_level = float(np.sqrt(np.mean(mono**2)))
                
                track_info = {
                    'track_number': i + 1,
                    'start_time': start,
                    'end_time': end,
                    'duration': duration,
                    'samples': len(audio),
                    'peak_level': peak_level,
                    'rms_level': rms_level
                }
                metadata['tracks'].append(track_info)
            
            if format.lower() == 'json':
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)
            elif format.lower() == 'csv':
                with open(file_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=metadata['tracks'][0].keys())
                    writer.writeheader()
                    writer.writerows(metadata['tracks'])
            
            print(f"元数据已导出: {file_path}")
            return True
        except Exception as e:
            print(f"元数据导出失败: {e}")
            return False

    def normalize_audio(self, audio: np.ndarray, target_peak: float = 0.9) -> np.ndarray:
        current_peak = np.max(np.abs(audio))
        if current_peak > 0:
            gain = target_peak / current_peak
            normalized = audio * gain
            return normalized
        return audio

    def apply_fade(self, audio: np.ndarray, fade_in: float = 0.1, 
                   fade_out: float = 0.5) -> np.ndarray:
        fade_in_samples = int(fade_in * self.sample_rate)
        fade_out_samples = int(fade_out * self.sample_rate)
        
        if audio.ndim == 2:
            processed = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                processed[:, channel] = self._apply_fade_mono(
                    audio[:, channel], fade_in_samples, fade_out_samples
                )
            return processed
        else:
            return self._apply_fade_mono(audio, fade_in_samples, fade_out_samples)

    def _apply_fade_mono(self, audio: np.ndarray, fade_in_samples: int, 
                         fade_out_samples: int) -> np.ndarray:
        processed = audio.copy()
        
        if fade_in_samples > 0 and fade_in_samples < len(processed):
            fade_in_curve = np.linspace(0, 1, fade_in_samples)
            processed[:fade_in_samples] *= fade_in_curve
        
        if fade_out_samples > 0 and fade_out_samples < len(processed):
            fade_out_curve = np.linspace(1, 0, fade_out_samples)
            processed[-fade_out_samples:] *= fade_out_curve
        
        return processed

    def apply_limiter(self, audio: np.ndarray, threshold: float = 0.9, 
                      release_time: float = 0.1) -> np.ndarray:
        release_samples = int(release_time * self.sample_rate)
        
        if audio.ndim == 2:
            limited = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                limited[:, channel] = self._limiter_mono(
                    audio[:, channel], threshold, release_samples
                )
            return limited
        else:
            return self._limiter_mono(audio, threshold, release_samples)

    def _limiter_mono(self, audio: np.ndarray, threshold: float, 
                      release_samples: int) -> np.ndarray:
        abs_audio = np.abs(audio)
        gain_reduction = np.maximum(abs_audio - threshold, 0) / (abs_audio + 1e-8)
        gain_reduction = 1 - gain_reduction
        
        release_curve = np.exp(-np.arange(release_samples) / release_samples)
        smoothed_gain = np.convolve(gain_reduction, release_curve, mode='same')
        smoothed_gain = smoothed_gain / np.max(smoothed_gain)
        
        return audio * smoothed_gain

    def export_with_processing(self, audio: np.ndarray, file_path: str,
                               normalize: bool = True, fade: bool = True,
                               limit: bool = False, show_progress: bool = True,
                               **kwargs) -> bool:
        try:
            if len(audio) > self._block_size * 10:
                return self._export_with_processing_blockwise(
                    audio, file_path, normalize, fade, limit, show_progress, **kwargs
                )
            
            processed = audio.copy()
            
            if normalize:
                processed = self.normalize_audio(processed, kwargs.get('target_peak', 0.9))
            
            if fade:
                processed = self.apply_fade(
                    processed, 
                    kwargs.get('fade_in', 0.1), 
                    kwargs.get('fade_out', 0.5)
                )
            
            if limit:
                processed = self.apply_limiter(
                    processed,
                    kwargs.get('threshold', 0.9),
                    kwargs.get('release_time', 0.1)
                )
            
            result = self.export_audio(
                processed, 
                file_path, 
                kwargs.get('format', 'wav'),
                kwargs.get('bit_depth', 'PCM_16'),
                show_progress
            )
            
            del processed
            gc.collect()
            return result
        except Exception as e:
            print(f"导出处理失败: {e}")
            return False
    
    def _export_with_processing_blockwise(self, audio: np.ndarray, file_path: str,
                                          normalize: bool, fade: bool, limit: bool,
                                          show_progress: bool, **kwargs) -> bool:
        try:
            format = kwargs.get('format', 'wav')
            bit_depth = kwargs.get('bit_depth', 'PCM_16')
            target_peak = kwargs.get('target_peak', 0.9)
            fade_in = kwargs.get('fade_in', 0.1)
            fade_out = kwargs.get('fade_out', 0.5)
            threshold = kwargs.get('threshold', 0.9)
            release_time = kwargs.get('release_time', 0.1)
            
            total_samples = len(audio)
            fade_in_samples = int(fade_in * self.sample_rate)
            fade_out_samples = int(fade_out * self.sample_rate)
            
            if normalize:
                if audio.ndim == 2:
                    peak = np.max(np.abs(audio))
                else:
                    peak = np.max(np.abs(audio))
                gain = target_peak / peak if peak > 0 else 1.0
            else:
                gain = 1.0
            
            subtype_map = {'PCM_16': 'PCM_16', 'PCM_24': 'PCM_24', 
                           'PCM_32': 'PCM_32', 'FLOAT': 'FLOAT'}
            subtype = subtype_map.get(bit_depth, 'PCM_16')
            channels = audio.shape[1] if audio.ndim == 2 else 1
            
            if show_progress:
                duration = total_samples / self.sample_rate
                print(f"开始分块处理导出: {duration:.1f}秒")
            
            with sf.SoundFile(file_path, 'w', samplerate=self.sample_rate,
                            channels=channels, format=format.upper(), subtype=subtype) as f:
                block_overlap = int(self.sample_rate * 0.1)
                
                for i in range(0, total_samples, self._block_size):
                    start = max(0, i - block_overlap)
                    end = min(total_samples, i + self._block_size + block_overlap)
                    block = audio[start:end].copy()
                    
                    if normalize and gain != 1.0:
                        block = block * gain
                    
                    if fade and i == 0 and fade_in_samples > 0:
                        fade_len = min(fade_in_samples, len(block))
                        fade_curve = np.linspace(0, 1, fade_len)
                        if block.ndim == 2:
                            block[:fade_len] *= fade_curve[:, np.newaxis]
                        else:
                            block[:fade_len] *= fade_curve
                    
                    if fade and end >= total_samples - 1 and fade_out_samples > 0:
                        fade_start = max(0, len(block) - fade_out_samples)
                        fade_len = len(block) - fade_start
                        fade_curve = np.linspace(1, 0, fade_len)
                        if block.ndim == 2:
                            block[fade_start:] *= fade_curve[:, np.newaxis]
                        else:
                            block[fade_start:] *= fade_curve
                    
                    if limit:
                        block = self.apply_limiter(block, threshold, release_time)
                    
                    write_start = i - start
                    write_end = min(i + self._block_size - start, len(block))
                    if write_end > write_start:
                        f.write(block[write_start:write_end])
                    
                    if show_progress and (i // self._block_size) % 5 == 0:
                        progress = min(100, (end / total_samples) * 100)
                        print(f"  处理进度: {progress:.0f}%")
                    
                    del block
            
            if show_progress:
                file_size = os.path.getsize(file_path) / (1024 * 1024)
                print(f"导出完成: {file_path} ({file_size:.1f}MB)")
            
            gc.collect()
            return True
        except Exception as e:
            print(f"分块处理导出失败: {e}")
            return False

    def create_m3u_playlist(self, audio_files: List[str], playlist_path: str,
                            base_path: Optional[str] = None) -> bool:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(playlist_path)), exist_ok=True)
            
            with open(playlist_path, 'w', encoding='utf-8') as f:
                f.write('#EXTM3U\n')
                
                for i, audio_file in enumerate(audio_files):
                    if base_path:
                        rel_path = os.path.relpath(audio_file, base_path)
                    else:
                        rel_path = os.path.basename(audio_file)
                    
                    try:
                        info = sf.info(audio_file)
                        duration = int(info.duration)
                    except:
                        duration = -1
                    
                    f.write(f'#EXTINF:{duration},Track {i+1}\n')
                    f.write(f'{rel_path}\n')
            
            print(f"播放列表已创建: {playlist_path}")
            return True
        except Exception as e:
            print(f"创建播放列表失败: {e}")
            return False

    def export_report(self, processing_info: Dict, file_path: str) -> bool:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            report = {
                'report_time': datetime.now().isoformat(),
                'processing_info': processing_info
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            print(f"处理报告已导出: {file_path}")
            return True
        except Exception as e:
            print(f"导出报告失败: {e}")
            return False
