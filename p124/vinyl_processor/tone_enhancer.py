import numpy as np
from scipy import signal
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')


class ToneEnhancer:
    EQ_PRESETS = {
        "flat": {
            "name": "Flat",
            "description": "平直响应，无增强",
            "bands": {"low": 0, "low_mid": 0, "mid": 0, "high_mid": 0, "high": 0}
        },
        "warm": {
            "name": "Warm",
            "description": "温暖音色，增强低频",
            "bands": {"low": 3.0, "low_mid": 2.0, "mid": 0, "high_mid": -1.0, "high": -1.5}
        },
        "bright": {
            "name": "Bright",
            "description": "明亮音色，增强高频",
            "bands": {"low": -1.0, "low_mid": 0, "mid": 0, "high_mid": 1.5, "high": 3.0}
        },
        "vintage": {
            "name": "Vintage",
            "description": "复古黑胶音色",
            "bands": {"low": 2.5, "low_mid": 1.5, "mid": -0.5, "high_mid": 1.0, "high": 2.0}
        },
        "rock": {
            "name": "Rock",
            "description": "摇滚风格增强",
            "bands": {"low": 4.0, "low_mid": 1.0, "mid": -1.0, "high_mid": 1.5, "high": 3.0}
        },
        "jazz": {
            "name": "Jazz",
            "description": "爵士风格增强",
            "bands": {"low": 2.0, "low_mid": -1.0, "mid": 0, "high_mid": 2.0, "high": 2.5}
        },
        "classical": {
            "name": "Classical",
            "description": "古典音乐风格",
            "bands": {"low": 1.5, "low_mid": 0, "mid": 1.0, "high_mid": 2.0, "high": 2.5}
        },
        "pop": {
            "name": "Pop",
            "description": "流行音乐风格",
            "bands": {"low": 3.0, "low_mid": 1.0, "mid": 1.0, "high_mid": 1.0, "high": 2.0}
        },
        "vocals": {
            "name": "Vocals",
            "description": "人声增强",
            "bands": {"low": -2.0, "low_mid": 2.0, "mid": 3.0, "high_mid": 1.5, "high": 0}
        },
        "bass_boost": {
            "name": "Bass Boost",
            "description": "低音增强",
            "bands": {"low": 6.0, "low_mid": 3.0, "mid": 0, "high_mid": 0, "high": -1.0}
        }
    }
    
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.current_eq_preset = None
        self.custom_eq_bands = {}
        self.stereo_width = 1.0
        self.harmonic_amount = 0.0
        self.warmth_amount = 0.0
    
    def list_eq_presets(self) -> List[str]:
        return list(self.EQ_PRESETS.keys())
    
    def get_preset_info(self, preset_name: str) -> Optional[Dict]:
        if preset_name in self.EQ_PRESETS:
            return self.EQ_PRESETS[preset_name]
        return None
    
    def apply_eq_preset(self, preset_name: str) -> bool:
        if preset_name not in self.EQ_PRESETS:
            print(f"EQ 预设 '{preset_name}' 不存在")
            return False
        
        preset = self.EQ_PRESETS[preset_name]
        self.custom_eq_bands = preset["bands"]
        self.current_eq_preset = preset_name
        print(f"已应用 EQ 预设: {preset['name']}")
        return True
    
    def set_custom_eq(self, low: float = 0, low_mid: float = 0, mid: float = 0,
                     high_mid: float = 0, high: float = 0):
        self.custom_eq_bands = {
            "low": low,
            "low_mid": low_mid,
            "mid": mid,
            "high_mid": high_mid,
            "high": high
        }
        self.current_eq_preset = "custom"
        print("已应用自定义 EQ 设置")
    
    def _create_eq_filter(self, gains: Dict[str, float]) -> Tuple[np.ndarray, np.ndarray]:
        nyquist = self.sample_rate / 2
        
        freq_bands = {
            "low": 100,
            "low_mid": 300,
            "mid": 1000,
            "high_mid": 3000,
            "high": 8000
        }
        
        numtaps = 1025
        bands = [0]
        gain_values = [10 ** (gains.get("low", 0) / 20)]
        
        prev_freq = 0
        for band_name in ["low", "low_mid", "mid", "high_mid", "high"]:
            freq = freq_bands[band_name]
            gain = 10 ** (gains.get(band_name, 0) / 20)
            
            bands.append(freq / nyquist)
            gain_values.append(gain)
            prev_freq = freq
        
        bands.append(1.0)
        gain_values.append(gain_values[-1] * 0.8)
        
        tap_coeffs = signal.firwin2(numtaps, bands, gain_values, fs=self.sample_rate)
        return tap_coeffs, [1.0]
    
    def apply_equalization(self, audio: np.ndarray, 
                          preset_name: str = None,
                          custom_gains: Dict[str, float] = None) -> np.ndarray:
        try:
            if preset_name and preset_name in self.EQ_PRESETS:
                gains = self.EQ_PRESETS[preset_name]["bands"]
            elif custom_gains:
                gains = custom_gains
            elif self.custom_eq_bands:
                gains = self.custom_eq_bands
            else:
                gains = {"low": 0, "low_mid": 0, "mid": 0, "high_mid": 0, "high": 0}
            
            b, a = self._create_eq_filter(gains)
            
            if audio.ndim == 2:
                eq_audio = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    eq_audio[:, channel] = signal.filtfilt(b, a, audio[:, channel])
                return eq_audio
            else:
                return signal.filtfilt(b, a, audio)
        except Exception as e:
            print(f"均衡处理失败: {e}")
            return audio
    
    def set_stereo_width(self, width: float = 1.0):
        self.stereo_width = max(0.0, min(2.0, width))
        print(f"立体声宽度设置为: {self.stereo_width}")
    
    def apply_stereo_enhancement(self, audio: np.ndarray, width: float = None) -> np.ndarray:
        if audio.ndim != 2 or audio.shape[1] != 2:
            print("立体声增强仅适用于立体声音频")
            return audio
        
        try:
            w = width if width is not None else self.stereo_width
            
            left = audio[:, 0]
            right = audio[:, 1]
            
            mid = (left + right) * 0.5
            side = (left - right) * 0.5
            
            side_enhanced = side * w
            
            new_left = mid + side_enhanced
            new_right = mid - side_enhanced
            
            max_amp = max(np.max(np.abs(new_left)), np.max(np.abs(new_right)))
            if max_amp > 0.95:
                new_left = new_left / max_amp * 0.95
                new_right = new_right / max_amp * 0.95
            
            enhanced = np.column_stack([new_left, new_right])
            return enhanced
        except Exception as e:
            print(f"立体声增强失败: {e}")
            return audio
    
    def set_harmonic_amount(self, amount: float = 0.3):
        self.harmonic_amount = max(0.0, min(1.0, amount))
        print(f"谐波增强量设置为: {self.harmonic_amount}")
    
    def apply_harmonic_enhancement(self, audio: np.ndarray, amount: float = None) -> np.ndarray:
        try:
            amt = amount if amount is not None else self.harmonic_amount
            
            if amt <= 0:
                return audio
            
            audio_normalized = audio / (np.max(np.abs(audio)) + 1e-8)
            
            second_harmonic = audio_normalized ** 2 * np.sign(audio_normalized)
            third_harmonic = audio_normalized ** 3
            
            harmonic = (second_harmonic * 0.6 + third_harmonic * 0.4) * amt * 0.3
            
            enhanced = audio + harmonic * np.max(np.abs(audio))
            
            max_val = np.max(np.abs(enhanced))
            if max_val > 1.0:
                enhanced = enhanced / max_val * 0.95
            
            return enhanced
        except Exception as e:
            print(f"谐波增强失败: {e}")
            return audio
    
    def set_warmth(self, amount: float = 0.3):
        self.warmth_amount = max(0.0, min(1.0, amount))
        print(f"温暖度设置为: {self.warmth_amount}")
    
    def apply_warmth(self, audio: np.ndarray, amount: float = None) -> np.ndarray:
        try:
            amt = amount if amount is not None else self.warmth_amount
            
            if amt <= 0:
                return audio
            
            nyquist = self.sample_rate / 2
            
            low_pass_freq = 5000 + (1 - amt) * 10000
            high_shelf_freq = 200
            high_shelf_gain = 10 ** (amt * 2 / 20)
            
            sos_lowpass = signal.butter(4, low_pass_freq / nyquist, 'low', output='sos')
            
            sos_highshelf = signal.iirfilter(
                2, [high_shelf_freq / nyquist],
                btype='high',
                rs=high_shelf_gain,
                output='sos'
            )
            
            if audio.ndim == 2:
                warmed = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    x = signal.sosfilt(sos_lowpass, audio[:, channel])
                    warmed[:, channel] = x
            else:
                warmed = signal.sosfilt(sos_lowpass, audio)
            
            return warmed
        except Exception as e:
            print(f"温暖度处理失败: {e}")
            return audio
    
    def apply_de_esser(self, audio: np.ndarray, threshold: float = 0.1, 
                       frequency: float = 5000) -> np.ndarray:
        try:
            nyquist = self.sample_rate / 2
            sos_band = signal.butter(4, [frequency * 0.8 / nyquist, 
                                        frequency * 1.2 / nyquist], 
                                   'band', output='sos')
            
            if audio.ndim == 2:
                processed = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    band_signal = signal.sosfilt(sos_band, audio[:, channel])
                    envelope = np.abs(signal.hilbert(band_signal))
                    
                    gain_reduction = np.maximum(1 - envelope / threshold, 0.5)
                    
                    smoothed_gain = signal.convolve(
                        gain_reduction, 
                        np.hanning(int(self.sample_rate * 0.01)),
                        mode='same'
                    )
                    smoothed_gain = smoothed_gain / np.max(smoothed_gain)
                    
                    processed[:, channel] = audio[:, channel] * smoothed_gain
                return processed
            else:
                band_signal = signal.sosfilt(sos_band, audio)
                envelope = np.abs(signal.hilbert(band_signal))
                
                gain_reduction = np.maximum(1 - envelope / threshold, 0.5)
                
                smoothed_gain = signal.convolve(
                    gain_reduction,
                    np.hanning(int(self.sample_rate * 0.01)),
                    mode='same'
                )
                smoothed_gain = smoothed_gain / np.max(smoothed_gain)
                
                return audio * smoothed_gain
        except Exception as e:
            print(f"去齿音失败: {e}")
            return audio
    
    def apply_compression(self, audio: np.ndarray, threshold: float = -20,
                         ratio: float = 4.0, attack: float = 0.01,
                         release: float = 0.1) -> np.ndarray:
        try:
            threshold_linear = 10 ** (threshold / 20)
            
            envelope = np.abs(signal.hilbert(audio if audio.ndim == 1 else audio[:, 0]))
            
            attack_samples = int(attack * self.sample_rate)
            release_samples = int(release * self.sample_rate)
            
            gain = np.ones_like(envelope)
            for i in range(1, len(envelope)):
                if envelope[i] > threshold_linear:
                    target_gain = threshold_linear / envelope[i]
                    target_gain = 1 - (1 - target_gain) * (1 - 1 / ratio)
                    alpha = 1 / attack_samples
                else:
                    target_gain = 1.0
                    alpha = 1 / release_samples
                
                gain[i] = gain[i-1] * (1 - alpha) + target_gain * alpha
            
            if audio.ndim == 2:
                compressed = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    compressed[:, channel] = audio[:, channel] * gain
            else:
                compressed = audio * gain
            
            max_amp = np.max(np.abs(compressed))
            if max_amp > 0.95:
                compressed = compressed / max_amp * 0.95
            
            return compressed
        except Exception as e:
            print(f"压缩处理失败: {e}")
            return audio
    
    def enhance_audio(self, audio: np.ndarray,
                     eq_preset: str = None,
                     stereo_width: float = None,
                     harmonic_amount: float = None,
                     warmth_amount: float = None,
                     apply_de_esser: bool = False,
                     apply_compression: bool = False) -> np.ndarray:
        print("开始音色增强处理...")
        
        processed = audio.copy()
        
        if eq_preset or self.custom_eq_bands:
            processed = self.apply_equalization(processed, eq_preset)
            print("  - 已应用均衡器")
        
        if stereo_width is not None and stereo_width != 1.0:
            processed = self.apply_stereo_enhancement(processed, stereo_width)
            print(f"  - 已应用立体声增强 (宽度: {stereo_width})")
        
        if harmonic_amount is not None and harmonic_amount > 0:
            processed = self.apply_harmonic_enhancement(processed, harmonic_amount)
            print(f"  - 已应用谐波增强 (强度: {harmonic_amount})")
        
        if warmth_amount is not None and warmth_amount > 0:
            processed = self.apply_warmth(processed, warmth_amount)
            print(f"  - 已应用温暖度增强 (强度: {warmth_amount})")
        
        if apply_de_esser:
            processed = self.apply_de_esser(processed)
            print("  - 已应用去齿音")
        
        if apply_compression:
            processed = self.apply_compression(processed)
            print("  - 已应用动态压缩")
        
        print("音色增强处理完成")
        return processed
    
    def create_custom_preset(self, name: str, bands: Dict[str, float],
                           description: str = "") -> bool:
        try:
            self.EQ_PRESETS[name.lower()] = {
                "name": name,
                "description": description,
                "bands": bands
            }
            print(f"自定义预设 '{name}' 已创建")
            return True
        except Exception as e:
            print(f"创建预设失败: {e}")
            return False
