import numpy as np
import soundfile as sf
from typing import Dict, Optional, List
from scipy import signal
from config.settings import settings
from .memory_manager import GPUMemoryManager, memory_aware_inference, get_optimal_device
from .emotion_prosody import EmotionSynthesisEngine
import logging

logger = logging.getLogger(__name__)

class IntonationPatternMatcher:
    def __init__(self):
        self.dialect_prosody_models = self._init_dialect_specific_prosody()
    
    def _init_dialect_specific_prosody(self) -> Dict[int, Dict]:
        return {
            1: {
                "name": "福州话",
                "tone_range": (180, 380),
                "speed_factor": 0.95,
                "contour_emphasis": 1.2,
                "plosive_strength": 0.8,
                "vowel_duration_ratio": 1.1
            },
            2: {
                "name": "厦门话",
                "tone_range": (200, 400),
                "speed_factor": 1.0,
                "contour_emphasis": 1.3,
                "plosive_strength": 0.9,
                "vowel_duration_ratio": 1.0
            },
            3: {
                "name": "长沙话",
                "tone_range": (160, 360),
                "speed_factor": 1.05,
                "contour_emphasis": 1.1,
                "plosive_strength": 0.7,
                "vowel_duration_ratio": 0.95
            },
            4: {
                "name": "双峰话",
                "tone_range": (170, 370),
                "speed_factor": 0.9,
                "contour_emphasis": 1.4,
                "plosive_strength": 0.85,
                "vowel_duration_ratio": 1.15
            },
            5: {
                "name": "莆田话",
                "tone_range": (190, 390),
                "speed_factor": 0.92,
                "contour_emphasis": 1.25,
                "plosive_strength": 0.75,
                "vowel_duration_ratio": 1.05
            }
        }
    
    def generate_tone_contour(self, base_waveform: np.ndarray, dialect_id: int, sample_rate: int) -> np.ndarray:
        prosody = self.dialect_prosody_models.get(
            dialect_id,
            self.dialect_prosody_models[1]
        )
        
        n_samples = len(base_waveform)
        t = np.arange(n_samples) / sample_rate
        
        tone_center = np.mean(prosody["tone_range"])
        tone_variation = (prosody["tone_range"][1] - prosody["tone_range"][0]) / 2
        
        modulation_freq = 5
        tone_modulation = 1 + (tone_variation / tone_center) * np.sin(2 * np.pi * modulation_freq * t)
        tone_modulation = tone_modulation * prosody["contour_emphasis"]
        
        syllable_rate = 4
        syllable_envelope = 1 + 0.15 * np.sin(2 * np.pi * syllable_rate * t)
        
        combined_modulation = tone_modulation * syllable_envelope
        
        return base_waveform * combined_modulation
    
    def enhance_articulatio(self, waveform: np.ndarray, dialect_id: int) -> np.ndarray:
        prosody = self.dialect_prosody_models.get(
            dialect_id,
            self.dialect_prosody_models[1]
        )
        
        n = len(waveform)
        t = np.arange(n)
        
        high_freq_enhancement = np.ones(n)
        for i in range(n):
            if i > 0 and i < n - 1:
                local_diff = abs(waveform[i] - waveform[i-1])
                if local_diff > 0.01:
                    high_freq_enhancement[i] = 1 + prosody["plosive_strength"] * min(0.3, local_diff)
        
        return waveform * high_freq_enhancement
    
    def apply_vowel_timing(self, waveform: np.ndarray, dialect_id: int, sample_rate: int) -> np.ndarray:
        prosody = self.dialect_prosody_models.get(
            dialect_id,
            self.dialect_prosody_models[1]
        )
        
        vowel_ratio = prosody["vowel_duration_ratio"]
        
        if vowel_ratio == 1.0:
            return waveform
        
        energy = np.abs(waveform)
        threshold = np.mean(energy) * 0.5
        
        vowel_regions = energy > threshold
        
        stretched = np.copy(waveform)
        for i in range(len(waveform)):
            if vowel_regions[i]:
                stretch_amount = int(vowel_ratio - 1)
                if i + int(stretch_amount * 100) < len(waveform):
                    stretched[i] = waveform[min(i + int(stretch_amount * 50), len(waveform) - 1)]
        
        return stretched

class VoiceQualityEnhancer:
    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
    
    def apply_formant_enhancement(self, waveform: np.ndarray) -> np.ndarray:
        nyquist = self.sample_rate / 2
        
        b1, a1 = signal.butter(4, [500/nyquist, 3000/nyquist], btype='band')
        formant_region = signal.filtfilt(b1, a1, waveform)
        
        enhanced = waveform + 0.3 * formant_region
        
        return enhanced / np.max(np.abs(enhanced))
    
    def reduce_breathiness(self, waveform: np.ndarray) -> np.ndarray:
        envelope = np.abs(signal.hilbert(waveform))
        smoothed_envelope = signal.convolve(envelope, np.ones(512)/512, mode='same')
        
        breath_mask = smoothed_envelope < np.mean(smoothed_envelope) * 0.3
        
        de_breathed = np.copy(waveform)
        de_breathed[breath_mask] *= 0.3
        
        return de_breathed
    
    def apply_clarity_filter(self, waveform: np.ndarray) -> np.ndarray:
        nyquist = self.sample_rate / 2
        
        b, a = signal.butter(2, 80/nyquist, btype='high')
        filtered = signal.filtfilt(b, a, waveform)
        
        return filtered
    
    def smooth_transitions(self, waveform: np.ndarray, window_size: int = 256) -> np.ndarray:
        window = signal.windows.hann(window_size)
        window = window / np.sum(window)
        
        smoothed = signal.convolve(waveform, window, mode='same')
        
        return 0.7 * waveform + 0.3 * smoothed

class TransformerSynthesizer:
    def __init__(self):
        self.sample_rate = settings.SAMPLE_RATE
        self.memory_manager = GPUMemoryManager()
        self.intonation_matcher = IntonationPatternMatcher()
        self.quality_enhancer = VoiceQualityEnhancer(self.sample_rate)
        self.emotion_engine = EmotionSynthesisEngine(self.sample_rate)
        self.device = get_optimal_device()
        self.is_loaded = True
        self._synthesis_cache = {}
        self._cache_hits = 0
        self._cache_misses = 0
    
    def _generate_base_waveform(self, text: str, duration: float) -> np.ndarray:
        num_samples = int(duration * self.sample_rate)
        t = np.linspace(0, duration, num_samples, endpoint=False)
        
        base_freq = 220
        
        waveform = np.zeros(num_samples)
        harmonics = [1, 2, 3, 4, 5, 6]
        harmonic_amps = [1.0, 0.5, 0.3, 0.2, 0.15, 0.1]
        
        for harmonic, amp in zip(harmonics, harmonic_amps):
            waveform += amp * np.sin(2 * np.pi * base_freq * harmonic * t)
        
        char_duration = duration / max(len(text), 1)
        for i, char in enumerate(text):
            if char in "，。！？；：":
                start_idx = int(i * char_duration * self.sample_rate)
                end_idx = int(min((i + 0.5) * char_duration * self.sample_rate, num_samples))
                waveform[start_idx:end_idx] *= 0.2
        
        return waveform
    
    def _apply_emotion_modulation(self, waveform: np.ndarray, emotion: str) -> np.ndarray:
        emotion_params = {
            "neutral": {"pitch_shift": 1.0, "energy": 1.0, "variation": 0.05, "brightness": 1.0},
            "happy": {"pitch_shift": 1.15, "energy": 1.2, "variation": 0.15, "brightness": 1.1},
            "sad": {"pitch_shift": 0.85, "energy": 0.8, "variation": 0.1, "brightness": 0.9},
            "angry": {"pitch_shift": 1.1, "energy": 1.4, "variation": 0.2, "brightness": 1.15},
            "surprise": {"pitch_shift": 1.2, "energy": 1.3, "variation": 0.18, "brightness": 1.12}
        }
        
        params = emotion_params.get(emotion, emotion_params["neutral"])
        
        n_samples = len(waveform)
        t = np.arange(n_samples) / self.sample_rate
        
        pitch_variation = params["variation"] * np.sin(2 * np.pi * 3 * t)
        energy_envelope = 1 + 0.1 * np.sin(2 * np.pi * 0.5 * t)
        
        modulated = waveform * (1 + pitch_variation) * params["energy"] * energy_envelope
        
        nyquist = self.sample_rate / 2
        b, a = signal.butter(2, min(0.8 * params["brightness"], 0.99), btype='low')
        modulated = signal.filtfilt(b, a, modulated)
        
        return modulated
    
    def _apply_speed_adjustment(self, waveform: np.ndarray, speed: float) -> np.ndarray:
        if abs(speed - 1.0) < 0.01:
            return waveform
        
        old_length = len(waveform)
        new_length = int(old_length / speed)
        
        old_indices = np.arange(old_length)
        new_indices = np.linspace(0, old_length - 1, new_length)
        
        window = signal.windows.hann(5)
        window = window / np.sum(window)
        
        smoothed_wave = signal.convolve(waveform, window, mode='same')
        
        adjusted = np.interp(new_indices, old_indices, smoothed_wave)
        
        return adjusted
    
    def _apply_pitch_shift(self, waveform: np.ndarray, pitch_factor: float) -> np.ndarray:
        if abs(pitch_factor - 1.0) < 0.01:
            return waveform
        
        n = len(waveform)
        t = np.arange(n) / self.sample_rate
        
        modulated = np.zeros_like(waveform)
        for harmonic in range(1, 5):
            phase = 2 * np.pi * 220 * harmonic * pitch_factor * t
            modulated += (1.0 / harmonic) * np.sin(phase)
        
        original_amp = np.abs(signal.hilbert(waveform))
        modulated = modulated * original_amp / np.max(np.abs(modulated))
        
        return modulated
    
    def _normalize_waveform(self, waveform: np.ndarray) -> np.ndarray:
        max_amp = np.max(np.abs(waveform))
        if max_amp > 0:
            waveform = waveform * (0.9 / max_amp)
        
        rms = np.sqrt(np.mean(waveform**2))
        target_rms = 0.1
        if rms > 0:
            gain = target_rms / rms
            gain = min(max(gain, 0.5), 2.0)
            waveform = waveform * gain
        
        return waveform
    
    def _get_cache_key(self, text: str, dialect_id: int, emotion: str, speed: float, pitch: float) -> str:
        return f"{text}_{dialect_id}_{emotion}_{speed:.2f}_{pitch:.2f}"
    
    def _get_from_cache(self, cache_key: str) -> Optional[np.ndarray]:
        if cache_key in self._synthesis_cache:
            self._cache_hits += 1
            return self._synthesis_cache[cache_key]
        self._cache_misses += 1
        return None
    
    def _add_to_cache(self, cache_key: str, waveform: np.ndarray, max_cache_size: int = 100):
        if len(self._synthesis_cache) >= max_cache_size:
            oldest_key = next(iter(self._synthesis_cache))
            del self._synthesis_cache[oldest_key]
        self._synthesis_cache[cache_key] = waveform.copy()
    
    def get_cache_stats(self) -> Dict:
        total = self._cache_hits + self._cache_misses
        hit_rate = self._cache_hits / total if total > 0 else 0
        return {
            "cache_size": len(self._synthesis_cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": hit_rate
        }
    
    @memory_aware_inference(max_batch_size=4)
    def synthesize(
        self,
        text: str,
        dialect_id: int,
        emotion: str = "neutral",
        speed: float = 1.0,
        pitch: float = 1.0,
        emotion_intensity: float = 1.0,
        output_path: Optional[str] = None,
        force_cpu: bool = False,
        use_cache: bool = True
    ) -> Dict:
        try:
            if force_cpu:
                original_device = self.device
                self.device = "cpu"
            
            cache_key = self._get_cache_key(text, dialect_id, emotion, speed, pitch)
            
            if use_cache:
                cached_waveform = self._get_from_cache(cache_key)
                if cached_waveform is not None:
                    waveform = cached_waveform
                    if output_path:
                        sf.write(output_path, waveform, self.sample_rate)
                    return {
                        "success": True,
                        "duration": len(waveform) / self.sample_rate,
                        "sample_rate": self.sample_rate,
                        "dialect_id": dialect_id,
                        "emotion": emotion,
                        "emotion_intensity": emotion_intensity,
                        "speed": speed,
                        "pitch": pitch,
                        "device_used": self.device,
                        "from_cache": True
                    }
            
            base_duration = max(0.5, len(text) * 0.15 * speed)
            
            waveform = self._generate_base_waveform(text, base_duration)
            
            waveform = self.intonation_matcher.generate_tone_contour(waveform, dialect_id, self.sample_rate)
            
            waveform = self.intonation_matcher.enhance_articulatio(waveform, dialect_id)
            
            waveform = self.intonation_matcher.apply_vowel_timing(waveform, dialect_id, self.sample_rate)
            
            waveform = self.emotion_engine.synthesize_emotional_speech(
                waveform, emotion, dialect_id, emotion_intensity
            )
            
            waveform = self._apply_speed_adjustment(waveform, speed)
            
            waveform = self._apply_pitch_shift(waveform, pitch)
            
            waveform = self.quality_enhancer.apply_formant_enhancement(waveform)
            waveform = self.quality_enhancer.reduce_breathiness(waveform)
            waveform = self.quality_enhancer.apply_clarity_filter(waveform)
            waveform = self.quality_enhancer.smooth_transitions(waveform)
            
            waveform = self._normalize_waveform(waveform)
            
            duration = len(waveform) / self.sample_rate
            
            if use_cache:
                self._add_to_cache(cache_key, waveform)
            
            if output_path:
                sf.write(output_path, waveform, self.sample_rate)
            
            if force_cpu:
                self.device = original_device
            
            return {
                "success": True,
                "duration": duration,
                "sample_rate": self.sample_rate,
                "dialect_id": dialect_id,
                "emotion": emotion,
                "emotion_intensity": emotion_intensity,
                "speed": speed,
                "pitch": pitch,
                "device_used": self.device,
                "from_cache": False
            }
            
        except Exception as e:
            logger.error(f"合成失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def batch_synthesize(self, requests: List[Dict]) -> List[Dict]:
        from .memory_manager import BatchProcessor
        
        processor = BatchProcessor(max_batch_size=2)
        
        def process_batch(batch):
            results = []
            for req in batch:
                result = self.synthesize(**req)
                results.append(result)
            return results
        
        return processor.process_in_batches(requests, process_batch)
    
    def get_synthesis_status(self) -> Dict:
        return {
            "device": self.device,
            "gpu_available": self.memory_manager.use_gpu,
            "memory_usage": self.memory_manager.get_memory_usage(),
            "supported_dialects": list(self.intonation_matcher.dialect_prosody_models.keys())
        }
