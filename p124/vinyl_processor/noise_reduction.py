import numpy as np
import noisereduce as nr
from scipy import signal
from scipy.ndimage import median_filter, uniform_filter1d
from typing import Optional, Tuple
import librosa
import warnings
warnings.filterwarnings('ignore')


class NoiseReducer:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.noise_profile = None
        self._cached_noise = None

    def reduce_noise(self, audio: np.ndarray, noise_sample: Optional[np.ndarray] = None, 
                     stationary: bool = True, prop_decrease: float = 0.9) -> np.ndarray:
        if audio.ndim == 2:
            cleaned_audio = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                cleaned_audio[:, channel] = self._reduce_channel(
                    audio[:, channel], noise_sample, stationary, prop_decrease
                )
            return cleaned_audio
        else:
            return self._reduce_channel(audio, noise_sample, stationary, prop_decrease)

    def _reduce_channel(self, audio: np.ndarray, noise_sample: Optional[np.ndarray],
                        stationary: bool, prop_decrease: float) -> np.ndarray:
        try:
            if noise_sample is not None:
                if noise_sample.ndim == 2:
                    noise_sample = noise_sample[:, 0] if noise_sample.shape[1] > 0 else noise_sample
                if len(noise_sample) < int(self.sample_rate * 0.1):
                    noise_sample = None
        except:
            noise_sample = None
        
        chunk_size = int(self.sample_rate * 30)
        if len(audio) > chunk_size * 2:
            result_chunks = []
            for i in range(0, len(audio), chunk_size):
                chunk = audio[i:i + chunk_size]
                try:
                    if noise_sample is not None:
                        reduced = nr.reduce_noise(
                            y=chunk,
                            sr=self.sample_rate,
                            y_noise=noise_sample,
                            stationary=stationary,
                            prop_decrease=prop_decrease,
                            n_fft=2048,
                            win_length=2048,
                            hop_length=512
                        )
                    else:
                        reduced = nr.reduce_noise(
                            y=chunk,
                            sr=self.sample_rate,
                            stationary=stationary,
                            prop_decrease=prop_decrease,
                            n_fft=2048,
                            win_length=2048,
                            hop_length=512
                        )
                    result_chunks.append(reduced)
                except Exception as e:
                    print(f"    块 {i//chunk_size + 1} 降噪失败，使用原始: {str(e)[:50]}")
                    result_chunks.append(chunk)
            
            return np.concatenate(result_chunks)
        else:
            try:
                if noise_sample is not None:
                    return nr.reduce_noise(
                        y=audio,
                        sr=self.sample_rate,
                        y_noise=noise_sample,
                        stationary=stationary,
                        prop_decrease=prop_decrease,
                        n_fft=2048,
                        win_length=2048,
                        hop_length=512
                    )
                else:
                    return nr.reduce_noise(
                        y=audio,
                        sr=self.sample_rate,
                        stationary=stationary,
                        prop_decrease=prop_decrease,
                        n_fft=2048,
                        win_length=2048,
                        hop_length=512
                    )
            except Exception as e:
                print(f"    降噪失败，使用原始: {str(e)[:50]}")
                return audio

    def remove_clicks(self, audio: np.ndarray, threshold: float = 3.0, 
                      window_size: int = 11) -> np.ndarray:
        if audio.ndim == 2:
            cleaned_audio = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                cleaned_audio[:, channel] = self._remove_clicks_channel(
                    audio[:, channel], threshold, window_size
                )
            return cleaned_audio
        else:
            return self._remove_clicks_channel(audio, threshold, window_size)

    def _remove_clicks_channel(self, audio: np.ndarray, threshold: float, 
                               window_size: int) -> np.ndarray:
        try:
            envelope = np.abs(signal.hilbert(audio))
            median_env = median_filter(envelope, size=window_size)
            deviation = envelope / (median_env + 1e-8)
            click_mask = deviation > threshold
            
            cleaned = audio.copy()
            click_positions = np.where(click_mask)[0]
            
            if len(click_positions) > len(audio) * 0.05:
                threshold = threshold * 1.5
                click_mask = deviation > threshold
                click_positions = np.where(click_mask)[0]
            
            merged_clicks = []
            current_start = None
            for i in range(len(click_positions)):
                if current_start is None:
                    current_start = click_positions[i]
                elif click_positions[i] - click_positions[i-1] > window_size:
                    merged_clicks.append((current_start, click_positions[i-1]))
                    current_start = click_positions[i]
            if current_start is not None:
                merged_clicks.append((current_start, click_positions[-1]))
            
            for start, end in merged_clicks:
                expand_start = max(0, start - window_size)
                expand_end = min(len(audio), end + window_size + 1)
                
                left_val = cleaned[expand_start] if expand_start > 0 else 0
                right_val = cleaned[expand_end - 1] if expand_end < len(audio) else 0
                
                x = np.arange(expand_end - expand_start)
                if len(x) > 1:
                    t = x / (len(x) - 1)
                    cleaned[expand_start:expand_end] = left_val * (1 - t) + right_val * t
                else:
                    cleaned[expand_start:expand_end] = (left_val + right_val) / 2
            
            return cleaned
        except Exception as e:
            print(f"    爆音去除失败: {str(e)[:50]}")
            return audio

    def remove_hum(self, audio: np.ndarray, hum_freq: float = 50.0, 
                   Q: float = 30.0) -> np.ndarray:
        try:
            cleaned_audio = audio.copy()
            max_harmonic = min(10, int((self.sample_rate / 2) / hum_freq))
            
            for h in range(1, max_harmonic + 1):
                freq = hum_freq * h
                if freq < self.sample_rate / 2 and freq > 10:
                    try:
                        b, a = signal.iirnotch(freq, Q, self.sample_rate)
                        if cleaned_audio.ndim == 2:
                            for channel in range(cleaned_audio.shape[1]):
                                cleaned_audio[:, channel] = signal.filtfilt(
                                    b, a, cleaned_audio[:, channel], padlen=min(3*(max(len(b), len(a))-1), len(cleaned_audio)//2)
                                )
                        else:
                            cleaned_audio = signal.filtfilt(
                                b, a, cleaned_audio, padlen=min(3*(max(len(b), len(a))-1), len(cleaned_audio)//2)
                            )
                    except:
                        continue
            return cleaned_audio
        except Exception as e:
            print(f"    去哼声失败: {str(e)[:50]}")
            return audio

    def bandpass_filter(self, audio: np.ndarray, low_freq: float = 20.0, 
                        high_freq: float = 20000.0, order: int = 4) -> np.ndarray:
        try:
            nyquist = 0.5 * self.sample_rate
            low = low_freq / nyquist
            high = high_freq / nyquist
            
            high = min(high, 0.99)
            if low >= high:
                low = max(0.001, high * 0.5)
            
            b, a = signal.butter(order, [low, high], btype='band')
            
            if audio.ndim == 2:
                filtered_audio = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    filtered_audio[:, channel] = signal.filtfilt(
                        b, a, audio[:, channel], padlen=min(3*max(len(b), len(a)), len(audio[:, channel])//2)
                    )
                return filtered_audio
            else:
                return signal.filtfilt(
                    b, a, audio, padlen=min(3*max(len(b), len(a)), len(audio)//2)
                )
        except Exception as e:
            print(f"    带通滤波失败: {str(e)[:50]}")
            return audio
    
    def residual_noise_suppression(self, audio: np.ndarray, strength: float = 0.3) -> np.ndarray:
        try:
            if audio.ndim == 2:
                result = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    result[:, channel] = self._residual_suppression_channel(audio[:, channel], strength)
                return result
            else:
                return self._residual_suppression_channel(audio, strength)
        except Exception as e:
            print(f"    残留噪音抑制失败: {str(e)[:50]}")
            return audio
    
    def _residual_suppression_channel(self, audio: np.ndarray, strength: float) -> np.ndarray:
        envelope = np.abs(signal.hilbert(audio))
        smooth_env = uniform_filter1d(envelope, size=int(self.sample_rate * 0.01))
        
        threshold = np.mean(smooth_env) * 0.1
        mask = smooth_env < threshold
        
        suppressed = audio.copy()
        suppress_factor = np.ones_like(audio)
        suppress_factor[mask] = 1 - strength
        
        return audio * suppress_factor

    def smooth_audio(self, audio: np.ndarray, window_size: int = 5) -> np.ndarray:
        kernel = np.hanning(window_size)
        kernel = kernel / kernel.sum()
        
        if audio.ndim == 2:
            smoothed = np.zeros_like(audio)
            for channel in range(audio.shape[1]):
                smoothed[:, channel] = np.convolve(audio[:, channel], kernel, mode='same')
            return smoothed
        else:
            return np.convolve(audio, kernel, mode='same')

    def auto_clean(self, audio: np.ndarray, noise_sample: Optional[np.ndarray] = None, 
                   use_residual_suppression: bool = True) -> np.ndarray:
        print("开始自动降噪处理...")
        
        if noise_sample is None:
            estimated_noise = self.estimate_noise_from_silence(audio)
            if estimated_noise is not None:
                noise_sample = estimated_noise
                print("  - 已自动估计噪声样本")
        
        audio = self.remove_hum(audio)
        print("  - 已去除电源哼声")
        
        audio = self.bandpass_filter(audio)
        print("  - 已应用带通滤波")
        
        audio = self.remove_clicks(audio)
        print("  - 已去除爆音和点击声")
        
        audio = self.reduce_noise(audio, noise_sample, stationary=False, prop_decrease=0.85)
        print("  - 已应用非平稳频谱降噪")
        
        if use_residual_suppression:
            audio = self.residual_noise_suppression(audio, strength=0.25)
            print("  - 已应用残留噪音抑制")
        
        audio = self.smooth_audio(audio, window_size=3)
        print("  - 已应用轻微平滑")
        
        print("自动降噪处理完成")
        return audio

    def estimate_noise_from_silence(self, audio: np.ndarray, 
                                    silence_threshold: float = 0.01) -> Optional[np.ndarray]:
        if audio.ndim == 2:
            mono_audio = np.mean(audio, axis=1)
        else:
            mono_audio = audio
        
        frame_size = int(self.sample_rate * 0.1)
        rms = np.array([
            np.sqrt(np.mean(mono_audio[i:i+frame_size]**2))
            for i in range(0, len(mono_audio) - frame_size, frame_size)
        ])
        
        silent_frames = np.where(rms < silence_threshold)[0]
        if len(silent_frames) == 0:
            return None
        
        longest_silence = 0
        silence_start = 0
        current_start = silent_frames[0]
        current_length = 1
        
        for i in range(1, len(silent_frames)):
            if silent_frames[i] == silent_frames[i-1] + 1:
                current_length += 1
            else:
                if current_length > longest_silence:
                    longest_silence = current_length
                    silence_start = current_start
                current_start = silent_frames[i]
                current_length = 1
        
        if current_length > longest_silence:
            longest_silence = current_length
            silence_start = current_start
        
        start_sample = silence_start * frame_size
        end_sample = start_sample + longest_silence * frame_size
        
        if audio.ndim == 2:
            return audio[start_sample:end_sample, 0]
        else:
            return audio[start_sample:end_sample]

    def plot_spectrum_comparison(self, original: np.ndarray, cleaned: np.ndarray, 
                                 output_path: Optional[str] = None):
        import matplotlib.pyplot as plt
        from scipy.fft import fft, fftfreq
        
        if original.ndim == 2:
            original = original[:, 0]
            cleaned = cleaned[:, 0]
        
        n = len(original)
        yf_original = fft(original)
        yf_cleaned = fft(cleaned)
        xf = fftfreq(n, 1 / self.sample_rate)[:n//2]
        
        plt.figure(figsize=(14, 8))
        
        plt.subplot(2, 1, 1)
        plt.semilogy(xf, 2.0 / n * np.abs(yf_original[:n//2]), alpha=0.5, label='原始')
        plt.semilogy(xf, 2.0 / n * np.abs(yf_cleaned[:n//2]), alpha=0.5, label='降噪后')
        plt.title('频谱对比')
        plt.xlabel('频率 (Hz)')
        plt.ylabel('幅值')
        plt.legend()
        plt.grid(True)
        
        plt.subplot(2, 1, 2)
        time_axis = np.linspace(0, len(original) / self.sample_rate, len(original))
        plt.plot(time_axis, original, alpha=0.5, label='原始')
        plt.plot(time_axis, cleaned, alpha=0.5, label='降噪后')
        plt.title('波形对比')
        plt.xlabel('时间 (秒)')
        plt.ylabel('振幅')
        plt.legend()
        
        plt.tight_layout()
        if output_path:
            plt.savefig(output_path, dpi=150)
            plt.close()
            print(f"频谱对比图已保存到: {output_path}")
        else:
            plt.show()
