import os
import gc
import time
import numpy as np
import soundfile as sf
from typing import Dict, Optional, List, Callable
from enum import Enum
import logging
import json
from pathlib import Path
from functools import wraps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelLoadStatus(Enum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    FAILED = "failed"
    FALLBACK = "fallback"

class FallbackMode(Enum):
    NONE = "none"
    LIGHTWEIGHT = "lightweight"
    RULE_BASED = "rule_based"

class MemoryOptimizer:
    def __init__(self, max_memory_percent: float = 70.0):
        self.max_memory_percent = max_memory_percent
        self._gc_counter = 0

    def get_memory_usage(self) -> Dict:
        try:
            import psutil
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            return {
                "rss_mb": memory_info.rss / (1024 ** 2),
                "vms_mb": memory_info.vms / (1024 ** 2),
                "percent": process.memory_percent()
            }
        except:
            return {"rss_mb": 0, "vms_mb": 0, "percent": 0}

    def force_gc(self):
        self._gc_counter += 1
        if self._gc_counter >= 50:
            gc.collect()
            self._gc_counter = 0

class ResultCache:
    def __init__(self, max_size: int = 500, ttl_seconds: int = 1800):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache = {}
        self._access_times = {}
        self._hit_count = 0
        self._miss_count = 0

    def _generate_key(self, text: str, dialect_id: int, emotion: str, speed: float) -> str:
        return f"{text}_{dialect_id}_{emotion}_{speed:.2f}"

    def get(self, text: str, dialect_id: int, emotion: str, speed: float) -> Optional[np.ndarray]:
        key = self._generate_key(text, dialect_id, emotion, speed)
        if key in self._cache:
            cache_time, value = self._cache[key]
            if time.time() - cache_time <= self.ttl_seconds:
                self._hit_count += 1
                self._access_times[key] = time.time()
                return value
            else:
                del self._cache[key]
                del self._access_times[key]
        self._miss_count += 1
        return None

    def set(self, waveform: np.ndarray, text: str, dialect_id: int, emotion: str, speed: float):
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._access_times.keys(), key=lambda k: self._access_times[k])
            del self._cache[oldest_key]
            del self._access_times[oldest_key]
        
        key = self._generate_key(text, dialect_id, emotion, speed)
        self._cache[key] = (time.time(), waveform.copy())
        self._access_times[key] = time.time()

    def stats(self) -> Dict:
        total = self._hit_count + self._miss_count
        hit_rate = self._hit_count / total if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self._hit_count,
            "misses": self._miss_count,
            "hit_rate": hit_rate
        }

    def clear(self):
        self._cache.clear()
        self._access_times.clear()
        self._hit_count = 0
        self._miss_count = 0

def optimize_inference(func: Callable = None, *, use_cache: bool = True):
    def decorator(f):
        cache = ResultCache(max_size=200) if use_cache else None
        memory_optimizer = MemoryOptimizer()

        @wraps(f)
        def wrapper(self, text: str, dialect_id: int = 1, output_path: Optional[str] = None, **kwargs):
            if use_cache and cache is not None:
                emotion = kwargs.get('emotion', 'neutral')
                speed = kwargs.get('speed', 1.0)
                cached = cache.get(text, dialect_id, emotion, speed)
                if cached is not None:
                    if output_path:
                        sf.write(output_path, cached, self.sample_rate)
                    return {
                        "success": True,
                        "duration": len(cached) / self.sample_rate,
                        "from_cache": True,
                        "dialect_id": dialect_id
                    }

            if not memory_optimizer.get_memory_usage()["percent"] < 80:
                memory_optimizer.force_gc()

            result = f(self, text, dialect_id, output_path, **kwargs)

            if use_cache and cache is not None and result.get("success") and "waveform" in result:
                emotion = kwargs.get('emotion', 'neutral')
                speed = kwargs.get('speed', 1.0)
                cache.set(result["waveform"], text, dialect_id, emotion, speed)

            memory_optimizer.force_gc()
            return result

        wrapper.get_cache_stats = cache.stats if use_cache else lambda: {}
        wrapper.clear_cache = cache.clear if use_cache else lambda: None
        return wrapper

    if func is not None:
        return decorator(func)
    return decorator

class DialectProsodyModel:
    def __init__(self, dialect_id: int):
        self.dialect_id = dialect_id
        self.is_loaded = False
        self.params = self._get_dialect_params()
    
    def _get_dialect_params(self) -> Dict:
        profiles = {
            1: {"name": "福州话", "base_freq": 180, "speed_factor": 0.95, "contour_emphasis": 1.2},
            2: {"name": "厦门话", "base_freq": 190, "speed_factor": 1.0, "contour_emphasis": 1.3},
            3: {"name": "长沙话", "base_freq": 170, "speed_factor": 1.05, "contour_emphasis": 1.1},
            4: {"name": "双峰话", "base_freq": 175, "speed_factor": 0.9, "contour_emphasis": 1.4},
            5: {"name": "莆田话", "base_freq": 185, "speed_factor": 0.92, "contour_emphasis": 1.25}
        }
        return profiles.get(self.dialect_id, profiles[1])

    def load(self) -> bool:
        try:
            logger.info(f"加载方言语调模型: {self.params['name']}")
            self.is_loaded = True
            return True
        except Exception as e:
            logger.error(f"加载语调模型失败: {e}")
            return False

class WaveformGenerator:
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        self.is_loaded = False
    
    def load(self) -> bool:
        try:
            logger.info("初始化波形生成器")
            self.is_loaded = True
            return True
        except Exception as e:
            logger.error(f"波形生成器初始化失败: {e}")
            return False
    
    def generate(self, text: str, duration: float, prosody_params: Dict, emotion_params: Dict) -> np.ndarray:
        num_samples = int(duration * self.sample_rate)
        t = np.linspace(0, duration, num_samples, endpoint=False)
        
        base_freq = prosody_params["base_freq"] * emotion_params["pitch_mean"]
        energy = emotion_params["energy"]
        
        waveform = np.zeros(num_samples)
        harmonics = [1, 2, 3, 4, 5]
        harmonic_amps = [1.0, 0.5, 0.3, 0.2, 0.15]
        
        for harmonic, amp in zip(harmonics, harmonic_amps):
            waveform += amp * np.sin(2 * np.pi * base_freq * harmonic * t)
        
        contour_rate = 5
        contour = 1 + 0.1 * prosody_params["contour_emphasis"] * np.sin(2 * np.pi * contour_rate * t)
        waveform *= contour * energy
        
        envelope = np.exp(-2 * np.arange(num_samples) / num_samples)
        waveform *= envelope
        
        return waveform

class OfflineSynthesizer:
    def __init__(self, model_path: Optional[str] = None, fallback_mode: FallbackMode = FallbackMode.RULE_BASED):
        self.model_path = model_path
        self.sample_rate = 22050
        self.status = ModelLoadStatus.NOT_LOADED
        self.fallback_mode = fallback_mode
        self.error_history: List[str] = []
        
        self.dialect_models: Dict[int, DialectProsodyModel] = {}
        self.waveform_generator = None
        self.memory_optimizer = MemoryOptimizer()
        self.result_cache = ResultCache(max_size=100)
        
        self._emotion_profiles = self._init_emotion_profiles()

    def _init_emotion_profiles(self) -> Dict[str, Dict]:
        return {
            "neutral": {"pitch_mean": 1.0, "energy": 1.0, "variation": 0.05},
            "happy": {"pitch_mean": 1.15, "energy": 1.2, "variation": 0.15},
            "sad": {"pitch_mean": 0.85, "energy": 0.75, "variation": 0.1},
            "angry": {"pitch_mean": 1.2, "energy": 1.3, "variation": 0.2},
            "surprise": {"pitch_mean": 1.25, "energy": 1.25, "variation": 0.18},
            "calm": {"pitch_mean": 0.9, "energy": 0.85, "variation": 0.05}
        }

    def load_model(self, force_reload: bool = False) -> bool:
        if self.status == ModelLoadStatus.LOADED and not force_reload:
            return True
        
        self.status = ModelLoadStatus.LOADING
        logger.info("开始加载离线合成模型...")
        
        try:
            self.waveform_generator = WaveformGenerator(self.sample_rate)
            if not self.waveform_generator.load():
                raise Exception("波形生成器加载失败")
            
            for dialect_id in range(1, 6):
                model = DialectProsodyModel(dialect_id)
                if model.load():
                    self.dialect_models[dialect_id] = model
                else:
                    logger.warning(f"方言 {dialect_id} 模型加载失败")
            
            if not self.dialect_models:
                raise Exception("没有成功加载任何方言模型")
            
            self.status = ModelLoadStatus.LOADED
            logger.info("所有模型加载成功")
            return True
            
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            self.error_history.append(str(e))
            
            if self.fallback_mode != FallbackMode.NONE:
                logger.info("启用降级模式")
                self.waveform_generator = WaveformGenerator(self.sample_rate)
                self.waveform_generator.is_loaded = True
                self.status = ModelLoadStatus.FALLBACK
                return True
            
            self.status = ModelLoadStatus.FAILED
            return False

    @optimize_inference(use_cache=True)
    def synthesize(
        self,
        text: str,
        dialect_id: int = 1,
        output_path: Optional[str] = None,
        emotion: str = "neutral",
        speed: float = 1.0
    ) -> Dict:
        if self.status not in [ModelLoadStatus.LOADED, ModelLoadStatus.FALLBACK]:
            if not self.load_model():
                return {
                    "success": False,
                    "error": "模型加载失败",
                    "error_history": self.error_history[-5:]
                }
        
        try:
            base_duration = max(0.5, len(text) * 0.15 * speed)
            
            if dialect_id in self.dialect_models:
                prosody_params = self.dialect_models[dialect_id].params
            else:
                prosody_params = DialectProsodyModel(1).params
            
            emotion_params = self._emotion_profiles.get(emotion, self._emotion_profiles["neutral"])
            
            waveform = self.waveform_generator.generate(text, base_duration, prosody_params, emotion_params)
            
            if speed != 1.0:
                new_length = int(len(waveform) / speed)
                old_indices = np.arange(len(waveform))
                new_indices = np.linspace(0, len(waveform) - 1, new_length)
                waveform = np.interp(new_indices, old_indices, waveform)
            
            duration = len(waveform) / self.sample_rate
            
            if output_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
                sf.write(output_path, waveform, self.sample_rate)
            
            return {
                "success": True,
                "duration": duration,
                "sample_rate": self.sample_rate,
                "dialect_id": dialect_id,
                "dialect_name": prosody_params["name"],
                "emotion": emotion,
                "speed": speed,
                "fallback_mode": self.status == ModelLoadStatus.FALLBACK,
                "from_cache": False,
                "waveform": waveform
            }
            
        except Exception as e:
            logger.error(f"合成失败: {e}")
            self.error_history.append(str(e))
            return {
                "success": False,
                "error": str(e)
            }

    def batch_synthesize(
        self,
        texts: List[str],
        dialect_id: int = 1,
        output_dir: str = "./output",
        emotion: str = "neutral",
        max_workers: int = 2
    ) -> List[Dict]:
        os.makedirs(output_dir, exist_ok=True)
        results = []
        
        for i, text in enumerate(texts):
            output_path = os.path.join(output_dir, f"output_{i}.wav")
            result = self.synthesize(text, dialect_id, output_path, emotion=emotion)
            results.append(result)
        
        return results

    def get_supported_dialects(self) -> List[Dict]:
        dialects = []
        for dialect_id in range(1, 6):
            model = self.dialect_models.get(dialect_id)
            if model:
                dialects.append({
                    "id": dialect_id,
                    "name": model.params["name"],
                    "loaded": model.is_loaded
                })
            else:
                temp_model = DialectProsodyModel(dialect_id)
                dialects.append({
                    "id": dialect_id,
                    "name": temp_model.params["name"],
                    "loaded": False
                })
        return dialects

    def get_supported_emotions(self) -> List[Dict]:
        return [
            {"id": eid, "name": name, "params": params}
            for eid, (name, params) in enumerate(self._emotion_profiles.items(), 1)
        ]

    def get_system_status(self) -> Dict:
        return {
            "status": self.status.value,
            "model_count": len(self.dialect_models),
            "memory_usage": self.memory_optimizer.get_memory_usage(),
            "cache_stats": self.result_cache.stats(),
            "error_count": len(self.error_history),
            "fallback_enabled": self.fallback_mode != FallbackMode.NONE
        }

    def get_performance_stats(self) -> Dict:
        return {
            "cache": self.result_cache.stats(),
            "memory": self.memory_optimizer.get_memory_usage(),
            "models_loaded": len(self.dialect_models),
            "status": self.status.value
        }

    def clear_cache(self):
        self.result_cache.clear()
        self.memory_optimizer.force_gc()

def create_synthesizer(
    model_path: Optional[str] = None,
    fallback_mode: FallbackMode = FallbackMode.RULE_BASED
) -> OfflineSynthesizer:
    synthesizer = OfflineSynthesizer(model_path, fallback_mode)
    synthesizer.load_model()
    return synthesizer

if __name__ == "__main__":
    synth = create_synthesizer()
    print("合成器状态:", synth.get_system_status())
    print("支持的方言:", synth.get_supported_dialects())
    
    result = synth.synthesize("你好，这是福州话测试", dialect_id=1, emotion="happy", output_path="test.wav")
    print("合成结果:", {k: v for k, v in result.items() if k != "waveform"})
    print("性能统计:", synth.get_performance_stats())
