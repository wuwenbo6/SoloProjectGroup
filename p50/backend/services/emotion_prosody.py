import numpy as np
from typing import Dict, List, Tuple
from enum import Enum
from scipy import signal
import logging

logger = logging.getLogger(__name__)

class EmotionType(Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISE = "surprise"
    CALM = "calm"

class EmotionProsodyParams:
    def __init__(self):
        self.emotion_profiles = self._init_emotion_profiles()
    
    def _init_emotion_profiles(self) -> Dict[str, Dict]:
        return {
            "neutral": {
                "pitch_mean": 1.0,
                "pitch_range": 1.0,
                "speech_rate": 1.0,
                "energy": 1.0,
                "jitter": 0.02,
                "pause_ratio": 0.05,
                "formant_shift": 1.0,
                "breathiness": 0.0
            },
            "happy": {
                "pitch_mean": 1.15,
                "pitch_range": 1.4,
                "speech_rate": 1.1,
                "energy": 1.25,
                "jitter": 0.015,
                "pause_ratio": 0.03,
                "formant_shift": 1.05,
                "breathiness": 0.0
            },
            "sad": {
                "pitch_mean": 0.85,
                "pitch_range": 0.6,
                "speech_rate": 0.85,
                "energy": 0.75,
                "jitter": 0.035,
                "pause_ratio": 0.1,
                "formant_shift": 0.95,
                "breathiness": 0.15
            },
            "angry": {
                "pitch_mean": 1.2,
                "pitch_range": 1.5,
                "speech_rate": 1.15,
                "energy": 1.4,
                "jitter": 0.04,
                "pause_ratio": 0.04,
                "formant_shift": 1.08,
                "breathiness": 0.05
            },
            "surprise": {
                "pitch_mean": 1.25,
                "pitch_range": 1.6,
                "speech_rate": 1.2,
                "energy": 1.3,
                "jitter": 0.025,
                "pause_ratio": 0.02,
                "formant_shift": 1.1,
                "breathiness": 0.0
            },
            "calm": {
                "pitch_mean": 0.9,
                "pitch_range": 0.7,
                "speech_rate": 0.9,
                "energy": 0.85,
                "jitter": 0.01,
                "pause_ratio": 0.08,
                "formant_shift": 0.98,
                "breathiness": 0.05
            }
        }
    
    def get_emotion_params(self, emotion: str) -> Dict:
        return self.emotion_profiles.get(emotion, self.emotion_profiles["neutral"])
    
    def interpolate_emotions(self, emotion1: str, emotion2: str, ratio: float) -> Dict:
        params1 = self.get_emotion_params(emotion1)
        params2 = self.get_emotion_params(emotion2)
        
        interpolated = {}
        for key in params1.keys():
            interpolated[key] = params1[key] * (1 - ratio) + params2[key] * ratio
        
        return interpolated

class DialectEmotionAdaptor:
    def __init__(self):
        self.dialect_emotion_modifiers = self._init_dialect_modifiers()
    
    def _init_dialect_modifiers(self) -> Dict[int, Dict]:
        return {
            1: {
                "name": "福州话",
                "happy": {"pitch_boost": 1.08, "energy_boost": 1.1},
                "sad": {"pitch_damp": 0.92, "energy_damp": 0.9},
                "contour_mod": 1.2
            },
            2: {
                "name": "厦门话",
                "happy": {"pitch_boost": 1.1, "energy_boost": 1.15},
                "sad": {"pitch_damp": 0.9, "energy_damp": 0.88},
                "contour_mod": 1.25
            },
            3: {
                "name": "长沙话",
                "happy": {"pitch_boost": 1.05, "energy_boost": 1.08},
                "sad": {"pitch_damp": 0.95, "energy_damp": 0.92},
                "contour_mod": 1.15
            },
            4: {
                "name": "双峰话",
                "happy": {"pitch_boost": 1.12, "energy_boost": 1.12},
                "sad": {"pitch_damp": 0.88, "energy_damp": 0.85},
                "contour_mod": 1.3
            },
            5: {
                "name": "莆田话",
                "happy": {"pitch_boost": 1.07, "energy_boost": 1.1},
                "sad": {"pitch_damp": 0.93, "energy_damp": 0.9},
                "contour_mod": 1.22
            }
        }
    
    def adapt_emotion_to_dialect(self, emotion_params: Dict, dialect_id: int, emotion: str) -> Dict:
        modifier = self.dialect_emotion_modifiers.get(dialect_id, {})
        
        adapted = emotion_params.copy()
        
        if emotion == "happy" and "happy" in modifier:
            adapted["pitch_mean"] *= modifier["happy"]["pitch_boost"]
            adapted["energy"] *= modifier["happy"]["energy_boost"]
        elif emotion == "sad" and "sad" in modifier:
            adapted["pitch_mean"] *= modifier["sad"]["pitch_damp"]
            adapted["energy"] *= modifier["sad"]["energy_damp"]
        
        if "contour_mod" in modifier:
            adapted["pitch_range"] *= modifier["contour_mod"]
        
        return adapted

class EmotionWaveformModifier:
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
    
    def apply_pitch_modulation(
        self,
        waveform: np.ndarray,
        pitch_mean: float,
        pitch_range: float,
        jitter: float
    ) -> np.ndarray:
        n = len(waveform)
        t = np.arange(n) / self.sample_rate
        
        lfo_rate = 5.0
        lfo = np.sin(2 * np.pi * lfo_rate * t) * (pitch_range - 1)
        
        random_jitter = np.random.normal(0, jitter, n)
        jitter_smoothed = signal.convolve(
            random_jitter,
            signal.windows.hann(int(0.01 * self.sample_rate)),
            mode='same'
        )
        
        pitch_mod = pitch_mean + lfo + jitter_smoothed
        phase = np.cumsum(pitch_mod) / self.sample_rate
        
        modulated = np.zeros_like(waveform)
        for i in range(1, n):
            orig_idx = min(i, int(phase[i] * self.sample_rate))
            if orig_idx < n:
                modulated[i] = waveform[orig_idx]
        
        return modulated
    
    def apply_energy_envelope(
        self,
        waveform: np.ndarray,
        energy: float,
        pause_ratio: float
    ) -> np.ndarray:
        n = len(waveform)
        t = np.arange(n) / self.sample_rate
        
        amplitude_mod = energy * (1 + 0.1 * np.sin(2 * np.pi * 2 * t))
        
        if pause_ratio > 0:
            pause_rate = 1.0 / pause_ratio
            pause_envelope = 1 - 0.3 * (1 + np.sin(2 * np.pi * pause_rate * t)) / 2
            pause_envelope = np.maximum(pause_envelope, 0.7)
            amplitude_mod *= pause_envelope
        
        return waveform * amplitude_mod
    
    def apply_formant_shift(self, waveform: np.ndarray, formant_shift: float) -> np.ndarray:
        if abs(formant_shift - 1.0) < 0.01:
            return waveform
        
        nyquist = self.sample_rate / 2
        cutoff = min(0.45 * nyquist * formant_shift, 0.8 * nyquist)
        
        b, a = signal.butter(4, cutoff / nyquist, btype='low')
        filtered = signal.filtfilt(b, a, waveform)
        
        mix = 0.7
        return mix * filtered + (1 - mix) * waveform
    
    def apply_breathiness(self, waveform: np.ndarray, breathiness: float) -> np.ndarray:
        if breathiness <= 0:
            return waveform
        
        n = len(waveform)
        noise = np.random.normal(0, breathiness * 0.1, n)
        
        envelope = np.abs(signal.hilbert(waveform))
        smoothed_envelope = signal.convolve(
            envelope,
            signal.windows.hann(int(0.05 * self.sample_rate)),
            mode='same'
        )
        
        breath_noise = noise * smoothed_envelope
        
        return waveform + breath_noise
    
    def apply_emotion_to_waveform(
        self,
        waveform: np.ndarray,
        emotion_params: Dict
    ) -> np.ndarray:
        result = waveform.copy()
        
        result = self.apply_pitch_modulation(
            result,
            emotion_params["pitch_mean"],
            emotion_params["pitch_range"],
            emotion_params["jitter"]
        )
        
        result = self.apply_energy_envelope(
            result,
            emotion_params["energy"],
            emotion_params["pause_ratio"]
        )
        
        result = self.apply_formant_shift(
            result,
            emotion_params["formant_shift"]
        )
        
        result = self.apply_breathiness(
            result,
            emotion_params["breathiness"]
        )
        
        return result

class EmotionSynthesisEngine:
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        self.prosody_params = EmotionProsodyParams()
        self.dialect_adaptor = DialectEmotionAdaptor()
        self.waveform_modifier = EmotionWaveformModifier(sample_rate)
    
    def synthesize_emotional_speech(
        self,
        base_waveform: np.ndarray,
        emotion: str,
        dialect_id: int,
        emotion_intensity: float = 1.0
    ) -> np.ndarray:
        emotion_params = self.prosody_params.get_emotion_params(emotion)
        
        if emotion_intensity != 1.0:
            neutral_params = self.prosody_params.get_emotion_params("neutral")
            for key in emotion_params:
                emotion_params[key] = (
                    neutral_params[key] * (1 - emotion_intensity) +
                    emotion_params[key] * emotion_intensity
                )
        
        adapted_params = self.dialect_adaptor.adapt_emotion_to_dialect(
            emotion_params,
            dialect_id,
            emotion
        )
        
        result = self.waveform_modifier.apply_emotion_to_waveform(
            base_waveform,
            adapted_params
        )
        
        return result
    
    def get_available_emotions(self) -> List[Dict]:
        emotions = []
        for emotion_type in EmotionType:
            params = self.prosody_params.get_emotion_params(emotion_type.value)
            emotions.append({
                "id": emotion_type.value,
                "name": self._get_emotion_name(emotion_type.value),
                "params_summary": {
                    "pitch": params["pitch_mean"],
                    "energy": params["energy"],
                    "speed": params["speech_rate"]
                }
            })
        return emotions
    
    def _get_emotion_name(self, emotion: str) -> str:
        names = {
            "neutral": "中性",
            "happy": "喜悦",
            "sad": "悲伤",
            "angry": "愤怒",
            "surprise": "惊讶",
            "calm": "平静"
        }
        return names.get(emotion, emotion)
    
    def get_emotion_dialect_combinations(self) -> Dict:
        combinations = {}
        for dialect_id, dialect_info in self.dialect_adaptor.dialect_emotion_modifiers.items():
            combinations[dialect_id] = {
                "name": dialect_info["name"],
                "supported_emotions": self.get_available_emotions()
            }
        return combinations
