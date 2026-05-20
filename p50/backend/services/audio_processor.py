import numpy as np
import librosa
import soundfile as sf
from typing import Dict, Tuple, Optional
from scipy import signal
from config.settings import settings
import io
import logging

logger = logging.getLogger(__name__)

class AudioStreamProcessor:
    def __init__(self, target_sample_rate: int = None):
        self.target_sample_rate = target_sample_rate or settings.SAMPLE_RATE
        self.supported_sample_rates = [8000, 16000, 22050, 44100, 48000]
        self.chunk_size = 4096
    
    def validate_audio_file(self, file_path: str) -> Dict:
        try:
            audio_info = sf.info(file_path)
            sample_rate = audio_info.samplerate
            channels = audio_info.channels
            duration = audio_info.duration
            
            issues = []
            
            if sample_rate not in self.supported_sample_rates:
                issues.append(f"不支持的采样率: {sample_rate}Hz，支持的采样率: {self.supported_sample_rates}")
            
            if sample_rate != self.target_sample_rate:
                logger.info(f"采样率需要转换: {sample_rate} -> {self.target_sample_rate}")
            
            if channels > 2:
                issues.append(f"不支持的声道数: {channels}，最大支持2声道")
            
            if duration > 300:
                issues.append(f"音频时长过长: {duration:.1f}秒，建议不超过300秒")
            
            return {
                "valid": len(issues) == 0,
                "sample_rate": sample_rate,
                "channels": channels,
                "duration": duration,
                "issues": issues
            }
            
        except Exception as e:
            logger.error(f"音频验证失败: {e}")
            return {
                "valid": False,
                "error": str(e)
            }
    
    def resample_audio(self, y: np.ndarray, orig_sr: int) -> np.ndarray:
        if orig_sr == self.target_sample_rate:
            return y
        
        logger.info(f"重采样音频: {orig_sr} -> {self.target_sample_rate}")
        
        resampled = librosa.resample(
            y=y,
            orig_sr=orig_sr,
            target_sr=self.target_sample_rate,
            res_type='kaiser_best'
        )
        
        return resampled
    
    def convert_to_mono(self, y: np.ndarray) -> np.ndarray:
        if y.ndim == 1:
            return y
        
        logger.info(f"转换为单声道: {y.shape}")
        return librosa.to_mono(y.T)
    
    def remove_silence(self, y: np.ndarray, top_db: int = 30) -> np.ndarray:
        yt, _ = librosa.effects.trim(y, top_db=top_db)
        return yt
    
    def normalize_audio(self, y: np.ndarray, target_db: float = -20) -> np.ndarray:
        rms = np.sqrt(np.mean(y**2))
        current_db = 20 * np.log10(rms) if rms > 0 else -100
        
        gain = 10 ** ((target_db - current_db) / 20)
        gain = min(max(gain, 0.1), 10.0)
        
        normalized = y * gain
        normalized = np.clip(normalized, -1.0, 1.0)
        
        return normalized
    
    def apply_anti_aliasing(self, y: np.ndarray, sample_rate: int) -> np.ndarray:
        nyquist = sample_rate / 2
        cutoff = min(0.45 * nyquist, 8000)
        
        b, a = signal.butter(8, cutoff / nyquist, btype='low')
        filtered = signal.filtfilt(b, a, y)
        
        return filtered
    
    def fix_clipping(self, y: np.ndarray) -> np.ndarray:
        clipped = np.abs(y) >= 0.99
        
        if np.any(clipped):
            logger.info(f"检测到削波，修复中... 削波样本数: {np.sum(clipped)}")
            
            y_fixed = np.copy(y)
            
            for i in np.where(clipped)[0]:
                start = max(0, i - 5)
                end = min(len(y), i + 6)
                window = y[start:end]
                
                non_clipped = window[np.abs(window) < 0.99]
                if len(non_clipped) > 0:
                    y_fixed[i] = np.mean(non_clipped)
            
            return y_fixed
        
        return y
    
    def smooth_audio(self, y: np.ndarray, window_size: int = 32) -> np.ndarray:
        window = signal.windows.hann(window_size)
        window = window / np.sum(window)
        
        smoothed = signal.convolve(y, window, mode='same')
        
        return 0.85 * y + 0.15 * smoothed
    
    def process_audio_stream(self, input_path: str, output_path: str = None) -> Dict:
        try:
            validation = self.validate_audio_file(input_path)
            if not validation["valid"] and "error" in validation:
                return {
                    "success": False,
                    "error": validation["error"]
                }
            
            y, sr = librosa.load(input_path, sr=None, mono=False)
            
            if y.ndim > 1:
                y = self.convert_to_mono(y)
            
            if sr != self.target_sample_rate:
                y = self.apply_anti_aliasing(y, sr)
                y = self.resample_audio(y, sr)
            
            y = self.fix_clipping(y)
            y = self.remove_silence(y)
            y = self.normalize_audio(y)
            y = self.smooth_audio(y)
            
            if output_path:
                sf.write(output_path, y, self.target_sample_rate)
            
            return {
                "success": True,
                "original_sample_rate": sr,
                "target_sample_rate": self.target_sample_rate,
                "duration": len(y) / self.target_sample_rate,
                "channels": 1,
                "audio_data": y if not output_path else None
            }
            
        except Exception as e:
            logger.error(f"音频处理失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def process_chunks(self, chunks: list, orig_sr: int) -> np.ndarray:
        combined = np.concatenate(chunks)
        
        if orig_sr != self.target_sample_rate:
            combined = self.apply_anti_aliasing(combined, orig_sr)
            combined = self.resample_audio(combined, orig_sr)
        
        combined = self.fix_clipping(combined)
        combined = self.normalize_audio(combined)
        
        return combined

class AudioQualityChecker:
    def __init__(self, sample_rate: int = None):
        self.sample_rate = sample_rate or settings.SAMPLE_RATE
    
    def calculate_snr(self, y: np.ndarray) -> float:
        signal_power = np.mean(y**2)
        noise_est = np.percentile(np.abs(y), 10)
        noise_power = noise_est ** 2
        
        if noise_power > 0:
            snr = 10 * np.log10(signal_power / noise_power)
            return snr
        return float('inf')
    
    def calculate_clipping_ratio(self, y: np.ndarray) -> float:
        clipped = np.sum(np.abs(y) >= 0.99)
        return clipped / len(y)
    
    def calculate_spectral_flatness(self, y: np.ndarray) -> float:
        stft = np.abs(librosa.stft(y))
        flatness = np.mean(librosa.feature.spectral_flatness(S=stft**2))
        return flatness
    
    def check_quality(self, y: np.ndarray) -> Dict:
        snr = self.calculate_snr(y)
        clipping_ratio = self.calculate_clipping_ratio(y)
        spectral_flatness = self.calculate_spectral_flatness(y)
        
        rms = np.sqrt(np.mean(y**2))
        rms_db = 20 * np.log10(rms) if rms > 0 else -100
        
        issues = []
        quality_score = 100
        
        if snr < 20:
            issues.append("信噪比过低，可能存在较多背景噪音")
            quality_score -= 30
        
        if clipping_ratio > 0.01:
            issues.append("检测到音频削波，可能存在失真")
            quality_score -= 20
        
        if rms_db < -40:
            issues.append("音频音量过低")
            quality_score -= 15
        elif rms_db > -5:
            issues.append("音频音量过高")
            quality_score -= 15
        
        if spectral_flatness > 0.5:
            issues.append("频谱平坦度异常，可能为噪音")
            quality_score -= 20
        
        return {
            "quality_score": max(0, quality_score),
            "snr_db": snr,
            "clipping_ratio": clipping_ratio,
            "spectral_flatness": spectral_flatness,
            "rms_db": rms_db,
            "issues": issues
        }
