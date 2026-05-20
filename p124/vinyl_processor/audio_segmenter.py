import numpy as np
import librosa
from scipy import signal
from typing import List, Tuple, Optional, Dict
import matplotlib.pyplot as plt


class AudioSegmenter:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate

    def detect_silence(self, audio: np.ndarray, threshold: float = 0.01, 
                       min_silence_duration: float = 0.5) -> List[Tuple[float, float]]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        frame_size = int(self.sample_rate * 0.01)
        hop_length = int(self.sample_rate * 0.005)
        
        rms = librosa.feature.rms(
            y=mono_audio,
            frame_length=frame_size,
            hop_length=hop_length
        )[0]
        
        silent_frames = rms < threshold
        min_silent_frames = int(min_silence_duration / (hop_length / self.sample_rate))
        
        silence_regions = []
        in_silence = False
        silence_start = 0
        
        for i in range(len(silent_frames)):
            if silent_frames[i] and not in_silence:
                in_silence = True
                silence_start = i
            elif not silent_frames[i] and in_silence:
                if i - silence_start >= min_silent_frames:
                    start_time = silence_start * hop_length / self.sample_rate
                    end_time = i * hop_length / self.sample_rate
                    silence_regions.append((start_time, end_time))
                in_silence = False
        
        if in_silence and len(silent_frames) - silence_start >= min_silent_frames:
            start_time = silence_start * hop_length / self.sample_rate
            end_time = len(silent_frames) * hop_length / self.sample_rate
            silence_regions.append((start_time, end_time))
        
        return silence_regions

    def split_by_silence(self, audio: np.ndarray, threshold: float = 0.01,
                         min_silence_duration: float = 0.5, 
                         min_segment_duration: float = 10.0) -> List[Tuple[np.ndarray, float, float]]:
        print("开始按静音分段...")
        
        silence_regions = self.detect_silence(audio, threshold, min_silence_duration)
        
        if not silence_regions:
            print("  - 未检测到足够长的静音，返回完整音频")
            return [(audio, 0.0, len(audio) / self.sample_rate)]
        
        segments = []
        prev_end = 0.0
        
        for start, end in silence_regions:
            segment_start = prev_end
            segment_end = start
            
            if segment_end - segment_start >= min_segment_duration:
                start_sample = int(segment_start * self.sample_rate)
                end_sample = int(segment_end * self.sample_rate)
                segment = audio[start_sample:end_sample]
                segments.append((segment, segment_start, segment_end))
            
            prev_end = end
        
        total_duration = len(audio) / self.sample_rate
        if total_duration - prev_end >= min_segment_duration:
            start_sample = int(prev_end * self.sample_rate)
            segment = audio[start_sample:]
            segments.append((segment, prev_end, total_duration))
        
        print(f"  - 检测到 {len(segments)} 个曲目段")
        return segments

    def detect_track_boundaries(self, audio: np.ndarray, method: str = 'energy',
                                **kwargs) -> List[float]:
        if method == 'energy':
            return self._detect_by_energy(audio, **kwargs)
        elif method == 'spectral':
            return self._detect_by_spectral(audio, **kwargs)
        elif method == 'combined':
            return self._detect_combined(audio, **kwargs)
        else:
            raise ValueError(f"未知的检测方法: {method}")

    def _detect_by_energy(self, audio: np.ndarray, smooth_window: float = 2.0,
                          threshold: float = 0.3) -> List[float]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        frame_size = int(self.sample_rate * 0.1)
        hop_length = int(self.sample_rate * 0.05)
        
        energy = np.array([
            np.sum(mono_audio[i:i+frame_size]**2)
            for i in range(0, len(mono_audio) - frame_size, hop_length)
        ])
        
        energy = energy / np.max(energy)
        
        window_size = int(smooth_window / (hop_length / self.sample_rate))
        if window_size > 1:
            energy = np.convolve(energy, np.hanning(window_size), mode='same') / window_size
        
        gradient = np.gradient(energy)
        
        peaks, _ = signal.find_peaks(-gradient, height=threshold)
        
        boundaries = [p * hop_length / self.sample_rate for p in peaks]
        
        return sorted(boundaries)

    def _detect_by_spectral(self, audio: np.ndarray, threshold: float = 0.5) -> List[float]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        hop_length = int(self.sample_rate * 0.1)
        
        mfcc = librosa.feature.mfcc(
            y=mono_audio,
            sr=self.sample_rate,
            n_mfcc=13,
            hop_length=hop_length
        )
        
        similarity = np.zeros(mfcc.shape[1] - 1)
        for i in range(len(similarity)):
            similarity[i] = np.corrcoef(mfcc[:, i], mfcc[:, i+1])[0, 1]
        
        changes = 1 - similarity
        peaks, _ = signal.find_peaks(changes, height=threshold, distance=10)
        
        boundaries = [p * hop_length / self.sample_rate for p in peaks]
        
        return sorted(boundaries)

    def _detect_combined(self, audio: np.ndarray) -> List[float]:
        energy_boundaries = self._detect_by_energy(audio)
        spectral_boundaries = self._detect_by_spectral(audio)
        
        all_boundaries = sorted(energy_boundaries + spectral_boundaries)
        
        merged = []
        for b in all_boundaries:
            if not merged or b - merged[-1] > 3.0:
                merged.append(b)
        
        return merged

    def split_audio(self, audio: np.ndarray, boundaries: List[float],
                    min_duration: float = 10.0) -> List[Tuple[np.ndarray, float, float]]:
        segments = []
        
        boundaries = sorted([0.0] + boundaries + [len(audio) / self.sample_rate])
        
        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            
            if end - start >= min_duration:
                start_sample = int(start * self.sample_rate)
                end_sample = int(end * self.sample_rate)
                segment = audio[start_sample:end_sample]
                segments.append((segment, start, end))
        
        print(f"  - 分割为 {len(segments)} 个有效曲目段")
        return segments

    def auto_segment(self, audio: np.ndarray, method: str = 'combined',
                     min_duration: float = 10.0) -> List[Tuple[np.ndarray, float, float]]:
        print("开始自动分段...")
        
        boundaries = self.detect_track_boundaries(audio, method=method)
        segments = self.split_audio(audio, boundaries, min_duration)
        
        return segments

    def manual_segment(self, audio: np.ndarray, split_points: List[float]) -> List[np.ndarray]:
        segments = []
        prev_point = 0.0
        
        for point in sorted(split_points):
            if point > prev_point and point <= len(audio) / self.sample_rate:
                start_sample = int(prev_point * self.sample_rate)
                end_sample = int(point * self.sample_rate)
                segments.append(audio[start_sample:end_sample])
                prev_point = point
        
        if prev_point < len(audio) / self.sample_rate:
            start_sample = int(prev_point * self.sample_rate)
            segments.append(audio[start_sample:])
        
        return segments

    def merge_short_segments(self, segments: List[Tuple[np.ndarray, float, float]],
                             min_duration: float = 15.0,
                             max_gap: float = 5.0) -> List[Tuple[np.ndarray, float, float]]:
        if len(segments) < 2:
            return segments
        
        merged = []
        current_audio, current_start, current_end = segments[0]
        
        for i in range(1, len(segments)):
            next_audio, next_start, next_end = segments[i]
            
            current_duration = current_end - current_start
            gap = next_start - current_end
            
            if current_duration < min_duration and gap < max_gap:
                current_audio = np.concatenate([current_audio, next_audio])
                current_end = next_end
            else:
                merged.append((current_audio, current_start, current_end))
                current_audio, current_start, current_end = segments[i]
        
        merged.append((current_audio, current_start, current_end))
        
        print(f"  - 合并后剩余 {len(merged)} 个曲目段")
        return merged

    def plot_segmentation(self, audio: np.ndarray, boundaries: List[float],
                          output_path: Optional[str] = None):
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        time_axis = np.linspace(0, len(mono_audio) / self.sample_rate, len(mono_audio))
        
        plt.figure(figsize=(14, 6))
        plt.plot(time_axis, mono_audio, alpha=0.7)
        
        for boundary in boundaries:
            plt.axvline(x=boundary, color='r', linestyle='--', alpha=0.7, linewidth=2)
        
        plt.title('音频分段')
        plt.xlabel('时间 (秒)')
        plt.ylabel('振幅')
        plt.grid(True, alpha=0.3)
        
        if output_path:
            plt.savefig(output_path, dpi=150)
            plt.close()
            print(f"分段图已保存到: {output_path}")
        else:
            plt.show()

    def get_segment_info(self, segments: List[Tuple[np.ndarray, float, float]]) -> List[Dict]:
        info_list = []
        
        for i, (audio, start, end) in enumerate(segments):
            duration = end - start
            
            if audio.ndim == 2:
                mono = np.mean(audio, axis=1)
            else:
                mono = audio
            
            rms = np.sqrt(np.mean(mono**2))
            peak = np.max(np.abs(mono))
            
            tempo, _ = librosa.beat.beat_track(y=mono, sr=self.sample_rate)
            
            info = {
                'index': i,
                'start_time': start,
                'end_time': end,
                'duration': duration,
                'samples': len(audio),
                'rms_level': rms,
                'peak_level': peak,
                'tempo_bpm': float(tempo)
            }
            info_list.append(info)
        
        return info_list
