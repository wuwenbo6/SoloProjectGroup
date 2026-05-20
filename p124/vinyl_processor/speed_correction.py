import numpy as np
import librosa
from scipy import signal
from scipy.signal import resample, resample_poly
from scipy.ndimage import median_filter, uniform_filter1d
from typing import Tuple, Optional
import warnings
warnings.filterwarnings('ignore')
import matplotlib.pyplot as plt


class SpeedCorrector:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.standard_pitch = 440.0
        self._speed_ratio_history = []

    def detect_speed_deviation(self, audio: np.ndarray, reference_freq: Optional[float] = None) -> float:
        try:
            if audio.ndim == 2:
                mono_audio = np.mean(audio, axis=1)
            else:
                mono_audio = audio
            
            if reference_freq is None:
                reference_freq = self.standard_pitch
            
            hop_length = int(self.sample_rate * 0.05)
            f0, voiced_flag, _ = librosa.pyin(
                mono_audio,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=self.sample_rate,
                hop_length=hop_length,
                frame_length=int(self.sample_rate * 0.1)
            )
            
            voiced_f0 = f0[voiced_flag]
            if len(voiced_f0) == 0:
                return 1.0
            
            q1 = np.percentile(voiced_f0, 25)
            q3 = np.percentile(voiced_f0, 75)
            iqr = q3 - q1
            valid_f0 = voiced_f0[(voiced_f0 >= q1 - 1.5 * iqr) & (voiced_f0 <= q3 + 1.5 * iqr)]
            
            if len(valid_f0) == 0:
                valid_f0 = voiced_f0
            
            median_f0 = np.median(valid_f0)
            speed_ratio = median_f0 / reference_freq
            
            speed_ratio = np.clip(speed_ratio, 0.8, 1.2)
            
            return speed_ratio
        except Exception as e:
            print(f"    转速检测失败: {str(e)[:50]}")
            return 1.0

    def correct_speed(self, audio: np.ndarray, speed_ratio: float) -> np.ndarray:
        if abs(speed_ratio - 1.0) < 0.001:
            return audio
        
        if audio.ndim == 2:
            corrected_audio = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                corrected_audio[:, channel] = self._correct_channel(audio[:, channel], speed_ratio)
            return corrected_audio
        else:
            return self._correct_channel(audio, speed_ratio)

    def _correct_channel(self, audio: np.ndarray, speed_ratio: float) -> np.ndarray:
        try:
            new_length = int(len(audio) / speed_ratio)
            if abs(speed_ratio - 1.0) < 0.05:
                try:
                    up = int(1 / speed_ratio * 100)
                    down = 100
                    gcd = np.gcd(up, down)
                    if gcd > 0:
                        up //= gcd
                        down //= gcd
                        if up * down < 10000:
                            return resample_poly(audio, up, down)
                except:
                    pass
            corrected = resample(audio, new_length)
            return corrected
        except Exception as e:
            print(f"    通道校正失败: {str(e)[:50]}")
            return audio

    def auto_correct(self, audio: np.ndarray, reference_freq: Optional[float] = None,
                     correct_wow_flutter: bool = True) -> Tuple[np.ndarray, float]:
        print("开始自动转速校正...")
        
        speed_ratio = self.detect_speed_deviation(audio, reference_freq)
        
        if abs(speed_ratio - 1.0) < 0.001:
            print("  - 平均转速正常")
            base_audio = audio
        else:
            print(f"  - 检测到平均转速偏差: {(speed_ratio - 1) * 100:.2f}%")
            base_audio = self.correct_speed(audio, speed_ratio)
            print(f"  - 已应用平均转速校正")
        
        if correct_wow_flutter:
            corrected_audio = self.correct_wow_flutter(base_audio)
            if corrected_audio is not base_audio:
                return corrected_audio, speed_ratio
        
        return base_audio, speed_ratio

    def correct_by_tempo(self, audio: np.ndarray, target_bpm: float = 120.0) -> Tuple[np.ndarray, float]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        tempo, _ = librosa.beat.beat_track(y=mono_audio, sr=self.sample_rate)
        current_bpm = float(tempo)
        
        if abs(current_bpm - target_bpm) < 0.5:
            print(f"  - 速度正常 ({current_bpm:.1f} BPM)，无需校正")
            return audio, 1.0
        
        speed_ratio = current_bpm / target_bpm
        print(f"  - 当前速度: {current_bpm:.1f} BPM，目标: {target_bpm:.1f} BPM")
        
        corrected_audio = self.correct_speed(audio, speed_ratio)
        print(f"  - 已应用速度校正，比例: {speed_ratio:.4f}")
        
        return corrected_audio, speed_ratio

    def detect_wow_flutter(self, audio: np.ndarray, window_size: float = 0.5) -> Tuple[np.ndarray, np.ndarray]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        hop_length = int(self.sample_rate * 0.01)
        n_fft = int(self.sample_rate * window_size)
        
        f0, _, _ = librosa.pyin(
            mono_audio,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=self.sample_rate,
            hop_length=hop_length
        )
        
        time_axis = np.arange(len(f0)) * hop_length / self.sample_rate
        
        valid_f0 = f0[~np.isnan(f0)]
        if len(valid_f0) > 0:
            median_f0 = np.median(valid_f0)
            deviation = (f0 - median_f0) / median_f0 * 100
        else:
            deviation = np.zeros_like(f0)
        
        return time_axis, deviation

    def correct_wow_flutter(self, audio: np.ndarray, window_size: float = 2.0, 
                            max_correction: float = 0.03) -> np.ndarray:
        print("开始抖晃校正...")
        
        try:
            if audio.ndim == 2:
                mono_audio = np.mean(audio, axis=1)
            else:
                mono_audio = audio
            
            hop_length = int(self.sample_rate * 0.1)
            
            f0, _, _ = librosa.pyin(
                mono_audio,
                fmin=librosa.note_to_hz('E2'),
                fmax=librosa.note_to_hz('C6'),
                sr=self.sample_rate,
                hop_length=hop_length,
                frame_length=int(self.sample_rate * 0.2)
            )
            
            valid_f0 = f0[~np.isnan(f0)]
            if len(valid_f0) < 10:
                print("  - 有效基频不足，无法校正抖晃")
                return audio
            
            q1 = np.percentile(valid_f0, 25)
            q3 = np.percentile(valid_f0, 75)
            iqr = q3 - q1
            valid_mask = (f0 >= q1 - 1.5 * iqr) & (f0 <= q3 + 1.5 * iqr)
            f0_filtered = np.where(valid_mask, f0, np.nan)
            
            valid_indices = ~np.isnan(f0_filtered)
            if np.sum(valid_indices) < 10:
                print("  - 有效基频不足，无法校正抖晃")
                return audio
            
            median_f0 = np.median(f0_filtered[valid_indices])
            speed_ratios = f0_filtered / median_f0
            
            speed_ratios[np.isnan(speed_ratios)] = 1.0
            
            valid_ratios = speed_ratios.copy()
            for i in range(1, len(speed_ratios)):
                if abs(speed_ratios[i] - 1.0) > max_correction:
                    speed_ratios[i] = speed_ratios[i-1]
            
            window_frames = int(window_size / (hop_length / self.sample_rate))
            window_frames = max(3, window_frames if window_frames % 2 == 1 else window_frames + 1)
            
            speed_ratios_smooth = median_filter(speed_ratios, size=window_frames)
            speed_ratios_smooth = uniform_filter1d(speed_ratios_smooth, size=window_frames//2)
            
            max_dev = 1.0 + max_correction
            min_dev = 1.0 - max_correction
            speed_ratios_clipped = np.clip(speed_ratios_smooth, min_dev, max_dev)
            
            if np.std(speed_ratios_clipped) < 0.001:
                print("  - 抖晃程度很小，无需校正")
                return audio
            
            print(f"  - 检测到抖晃范围: {(np.min(speed_ratios_clipped)-1)*100:.2f}% ~ {(np.max(speed_ratios_clipped)-1)*100:.2f}%")
            
            corrected_audio = self._apply_dynamic_speed_correction_v2(
                audio, speed_ratios_clipped, hop_length
            )
            print("  - 抖晃校正完成")
            
            return corrected_audio
            
        except Exception as e:
            print(f"  - 抖晃校正失败: {str(e)[:50]}")
            return audio

    def _apply_dynamic_speed_correction(self, audio: np.ndarray, speed_ratios: np.ndarray, 
                                        hop_length: int) -> np.ndarray:
        if audio.ndim == 2:
            corrected = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                corrected[:, channel] = self._apply_dynamic_correction_channel(
                    audio[:, channel], speed_ratios, hop_length
                )
            return corrected
        else:
            return self._apply_dynamic_correction_channel(audio, speed_ratios, hop_length)

    def _apply_dynamic_correction_channel(self, audio: np.ndarray, speed_ratios: np.ndarray,
                                          hop_length: int) -> np.ndarray:
        try:
            num_frames = len(speed_ratios)
            output_samples = []
            input_pos = 0.0
            
            for i in range(num_frames):
                ratio = speed_ratios[i]
                frame_samples = min(hop_length, len(audio) - int(input_pos))
                
                if frame_samples <= 0:
                    break
                
                new_length = int(frame_samples / ratio)
                frame = audio[int(input_pos):int(input_pos) + frame_samples]
                
                if new_length > 0:
                    resampled = resample(frame, new_length)
                    output_samples.append(resampled)
                
                input_pos += frame_samples
            
            if output_samples:
                return np.concatenate(output_samples)
            else:
                return audio
        except Exception as e:
            print(f"    动态校正失败: {str(e)[:50]}")
            return audio
    
    def _apply_dynamic_speed_correction_v2(self, audio: np.ndarray, speed_ratios: np.ndarray,
                                           hop_length: int, overlap: float = 0.25) -> np.ndarray:
        if audio.ndim == 2:
            corrected = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                corrected[:, channel] = self._apply_dynamic_correction_channel_v2(
                    audio[:, channel], speed_ratios, hop_length, overlap
                )
            return corrected
        else:
            return self._apply_dynamic_correction_channel_v2(audio, speed_ratios, hop_length, overlap)
    
    def _apply_dynamic_correction_channel_v2(self, audio: np.ndarray, speed_ratios: np.ndarray,
                                             hop_length: int, overlap: float) -> np.ndarray:
        try:
            num_frames = len(speed_ratios)
            total_output = int(len(audio) / np.mean(speed_ratios))
            output = np.zeros(total_output + hop_length, dtype=np.float64)
            window = np.zeros(total_output + hop_length, dtype=np.float64)
            
            output_pos = 0
            input_pos = 0
            
            overlap_samples = int(hop_length * overlap)
            
            for i in range(num_frames):
                ratio = speed_ratios[i]
                frame_start = max(0, input_pos - overlap_samples)
                frame_end = min(len(audio), input_pos + hop_length + overlap_samples)
                
                if frame_end - frame_start <= 0:
                    break
                
                frame = audio[frame_start:frame_end]
                
                new_length = max(1, int(len(frame) / ratio))
                resampled = resample(frame, new_length)
                
                hann_win = np.hanning(len(resampled))
                
                output_start = max(0, output_pos - int(overlap_samples / ratio))
                output_end = min(len(output), output_start + len(resampled))
                
                actual_length = min(len(resampled), output_end - output_start)
                
                output[output_start:output_end] += resampled[:actual_length] * hann_win[:actual_length]
                window[output_start:output_end] += hann_win[:actual_length]
                
                input_pos += hop_length
                output_pos += int(hop_length / ratio)
            
            valid_mask = window > 0.01
            output[valid_mask] /= window[valid_mask]
            
            return output[:output_pos]
            
        except Exception as e:
            print(f"    高级动态校正失败，回退到基础方法: {str(e)[:50]}")
            return self._apply_dynamic_correction_channel(audio, speed_ratios, hop_length)

    def plot_speed_analysis(self, audio: np.ndarray, output_path: Optional[str] = None):
        time_axis, deviation = self.detect_wow_flutter(audio)
        
        fig, axes = plt.subplots(2, 1, figsize=(14, 10))
        
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        time_wave = np.linspace(0, len(mono_audio) / self.sample_rate, len(mono_audio))
        axes[0].plot(time_wave, mono_audio)
        axes[0].set_title('音频波形')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅')
        axes[0].grid(True)
        
        axes[1].plot(time_axis, deviation)
        axes[1].axhline(y=0, color='r', linestyle='--', alpha=0.7)
        axes[1].set_title('基频偏差（抖晃）')
        axes[1].set_xlabel('时间 (秒)')
        axes[1].set_ylabel('偏差 (%)')
        axes[1].grid(True)
        
        plt.tight_layout()
        
        if output_path:
            plt.savefig(output_path, dpi=150)
            plt.close()
            print(f"转速分析图已保存到: {output_path}")
        else:
            plt.show()

    def get_correction_report(self, original: np.ndarray, corrected: np.ndarray, 
                              speed_ratio: float) -> dict:
        if original.ndim == 2:
            orig_mono = np.mean(original, axis=1)
            corr_mono = np.mean(corrected, axis=1)
        else:
            orig_mono = original
            corr_mono = corrected
        
        orig_tempo, _ = librosa.beat.beat_track(y=orig_mono, sr=self.sample_rate)
        corr_tempo, _ = librosa.beat.beat_track(y=corr_mono, sr=self.sample_rate)
        
        report = {
            'speed_ratio': speed_ratio,
            'speed_deviation_percent': (speed_ratio - 1) * 100,
            'original_duration': len(original) / self.sample_rate,
            'corrected_duration': len(corrected) / self.sample_rate,
            'original_tempo_bpm': float(orig_tempo),
            'corrected_tempo_bpm': float(corr_tempo)
        }
        
        return report
