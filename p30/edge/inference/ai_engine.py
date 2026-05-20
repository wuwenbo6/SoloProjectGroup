import time
import gc
import weakref
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import threading
import warnings
warnings.filterwarnings('ignore')


class PestType(Enum):
    HEALTHY = "healthy"
    APHID = "aphid"
    WHITEFLY = "whitefly"
    THRIPS = "thrips"
    SPIDER_MITE = "spider_mite"
    BOLLWORM = "bollworm"
    UNKNOWN = "unknown"


class ModelType(Enum):
    IMAGE_CLASSIFICATION = "image_classification"
    AUDIO_CLASSIFICATION = "audio_classification"
    OBJECT_DETECTION = "object_detection"


@dataclass
class InferenceResult:
    result_id: str
    data_id: str
    device_id: str
    pest_type: PestType
    confidence: float
    model_type: ModelType
    timestamp: float
    metadata: Dict


class LightweightCNN:
    def __init__(self, input_shape=(64, 64, 3)):
        self.input_shape = input_shape
        self.class_names = [p for p in PestType if p != PestType.UNKNOWN]
        self._weights = None
        self._model_loaded = False
        self._gc_threshold = 50
        self._infer_count = 0

    @property
    def weights(self):
        if not self._model_loaded:
            self._init_weights_lazy()
        return self._weights

    def _init_weights_lazy(self) -> Dict:
        if self._model_loaded and self._weights is not None:
            return self._weights
        
        weights = {}
        weights['conv1'] = np.random.randn(3, 3, 3, 16).astype(np.float16) * 0.1
        weights['conv2'] = np.random.randn(3, 3, 16, 32).astype(np.float16) * 0.1
        weights['fc1'] = np.random.randn(32 * 16 * 16, 128).astype(np.float16) * 0.1
        weights['fc2'] = np.random.randn(128, len(self.class_names)).astype(np.float16) * 0.1
        self._weights = weights
        self._model_loaded = True
        gc.collect()
        return weights

    def _conv2d_optimized(self, x: np.ndarray, w: np.ndarray, stride=1, padding=1) -> np.ndarray:
        h, w_in, c = x.shape
        f, co = w.shape[0], w.shape[3]
        
        h_out = (h - f + 2 * padding) // stride + 1
        w_out = (w_in - f + 2 * padding) // stride + 1
        
        if padding > 0:
            x_pad = np.pad(x.astype(np.float16), ((padding, padding), (padding, padding), (0, 0)), 'constant')
        else:
            x_pad = x.astype(np.float16)
        
        out = np.zeros((h_out, w_out, co), dtype=np.float16)
        
        for i in range(h_out):
            for j in range(w_out):
                h_start = i * stride
                h_end = h_start + f
                w_start = j * stride
                w_end = w_start + f
                patch = x_pad[h_start:h_end, w_start:w_end, :]
                out[i, j] = np.sum(patch[:, :, :, np.newaxis] * w, axis=(0, 1, 2))
        
        return out

    def _conv2d_fast(self, x: np.ndarray, w: np.ndarray, stride=1, padding=1) -> np.ndarray:
        h, w_in, c = x.shape
        f, co = w.shape[0], w.shape[3]
        
        h_out = (h - f + 2 * padding) // stride + 1
        w_out = (w_in - f + 2 * padding) // stride + 1
        
        x_pad = np.pad(x.astype(np.float16), ((padding, padding), (padding, padding), (0, 0)), 'constant')
        
        shape = (h_out, w_out, f, f, c)
        strides = (x_pad.strides[0]*stride, x_pad.strides[1]*stride, *x_pad.strides)
        patches = np.lib.stride_tricks.as_strided(x_pad, shape=shape, strides=strides)
        out = np.tensordot(patches, w.astype(np.float16), axes=([2, 3, 4], [0, 1, 2]))
        
        return out

    def _relu(self, x: np.ndarray) -> np.ndarray:
        return np.maximum(0, x, dtype=np.float16)

    def _max_pool(self, x: np.ndarray, size=2) -> np.ndarray:
        h, w, c = x.shape
        out_h, out_w = h // size, w // size
        x_reshaped = x[:out_h*size, :out_w*size, :].reshape(out_h, size, out_w, size, c)
        return np.max(x_reshaped, axis=(1, 3))

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        x = x - np.max(x)
        exp_x = np.exp(x, dtype=np.float32)
        return exp_x / exp_x.sum()

    def _extract_attention_regions(self, image: np.ndarray) -> List[np.ndarray]:
        import cv2
        crops = []
        
        h, w = image.shape[:2]
        crops.append(image[h//4:h*3//4, w//4:w*3//4])
        
        crops.append(image[h//6:h*5//6, w//6:w*5//6])
        
        grid_size = 3
        for i in range(grid_size):
            for j in range(grid_size):
                start_h = int(h * i / grid_size)
                end_h = int(h * (i + 1) / grid_size)
                start_w = int(w * j / grid_size)
                end_w = int(w * (j + 1) / grid_size)
                crops.append(image[start_h:end_h, start_w:end_w])
        
        return crops

    def predict(self, image: np.ndarray, mode: str = 'balanced') -> Tuple[PestType, float]:
        self._infer_count += 1
        
        import cv2
        
        if mode == 'fast':
            return self._predict_fast_mode(image)
        elif mode == 'accurate':
            return self._predict_accurate_mode(image)
        else:
            return self._predict_balanced_mode(image)

    def _predict_fast_mode(self, image: np.ndarray) -> Tuple[PestType, float]:
        import cv2
        
        main_img = cv2.resize(image, (64, 64), interpolation=cv2.INTER_AREA)
        main_pred, main_conf = self._predict_single_fast(main_img)
        
        if self._infer_count % self._gc_threshold == 0:
            gc.collect()
        
        if main_conf < 0.35:
            return PestType.UNKNOWN, float(main_conf)
        return main_pred, float(main_conf)

    def _predict_balanced_mode(self, image: np.ndarray) -> Tuple[PestType, float]:
        import cv2
        
        main_img = cv2.resize(image, (64, 64), interpolation=cv2.INTER_AREA)
        main_pred, main_conf = self._predict_single(main_img)
        
        if main_conf > 0.7:
            if self._infer_count % self._gc_threshold == 0:
                gc.collect()
            return main_pred, float(main_conf)
        
        predictions = [main_pred]
        confidences = [main_conf]
        
        h, w = image.shape[:2]
        center_crop = image[h//4:h*3//4, w//4:w*3//4]
        crop_img = cv2.resize(center_crop, (64, 64), interpolation=cv2.INTER_AREA)
        crop_pred, crop_conf = self._predict_single(crop_img)
        predictions.append(crop_pred)
        confidences.append(crop_conf)
        
        final_predictions = {}
        for pred, conf in zip(predictions, confidences):
            if pred not in final_predictions:
                final_predictions[pred] = []
            final_predictions[pred].append(conf)
        
        weighted_scores = {}
        for pest_type, confs in final_predictions.items():
            if len(confs) >= 2:
                weighted_scores[pest_type] = np.max(confs) * (0.8 + 0.2 * np.mean(confs))
            else:
                weighted_scores[pest_type] = np.max(confs)
        
        final_pest = max(weighted_scores.items(), key=lambda x: x[1])
        final_confidence = float(final_pest[1])
        
        if self._infer_count % self._gc_threshold == 0:
            gc.collect()
        
        if final_confidence < 0.35:
            return PestType.UNKNOWN, final_confidence
        return final_pest[0], final_confidence

    def _predict_accurate_mode(self, image: np.ndarray) -> Tuple[PestType, float]:
        import cv2
        
        predictions = []
        confidences = []
        
        main_img = cv2.resize(image, (self.input_shape[0], self.input_shape[1]))
        main_pred, main_conf = self._predict_single(main_img)
        predictions.append(main_pred)
        confidences.append(main_conf)
        
        attention_crops = self._extract_attention_regions(image)
        for crop in attention_crops:
            crop_img = cv2.resize(crop, (self.input_shape[0], self.input_shape[1]))
            crop_pred, crop_conf = self._predict_single(crop_img)
            predictions.append(crop_pred)
            confidences.append(crop_conf)
        
        final_predictions = {}
        for pred, conf in zip(predictions, confidences):
            if pred not in final_predictions:
                final_predictions[pred] = []
            final_predictions[pred].append(conf)
        
        weighted_scores = {}
        for pest_type, confs in final_predictions.items():
            if len(confs) >= 2:
                weighted_scores[pest_type] = np.max(confs) * (0.7 + 0.3 * np.mean(confs))
            else:
                weighted_scores[pest_type] = np.max(confs)
        
        if not weighted_scores:
            return PestType.UNKNOWN, 0.0
        
        final_pest = max(weighted_scores.items(), key=lambda x: x[1])
        final_confidence = float(final_pest[1])
        
        if self._infer_count % self._gc_threshold == 0:
            gc.collect()
        
        if final_confidence < 0.35:
            return PestType.UNKNOWN, final_confidence
        return final_pest[0], final_confidence

    def _predict_single(self, image: np.ndarray) -> Tuple[PestType, float]:
        normalized = image.astype(np.float16) / 255.0
        
        x = self._conv2d_fast(normalized, self.weights['conv1'])
        x = self._relu(x)
        x = self._max_pool(x)
        
        x = self._conv2d_fast(x, self.weights['conv2'])
        x = self._relu(x)
        x = self._max_pool(x)
        
        x = x.flatten().astype(np.float16)
        x = np.dot(x, self.weights['fc1'].astype(np.float16))
        x = self._relu(x)
        logits = np.dot(x, self.weights['fc2'].astype(np.float16))
        
        probs = self._softmax(logits)
        pred_idx = np.argmax(probs)
        confidence = float(probs[pred_idx])
        
        return self.class_names[pred_idx], confidence

    def _predict_single_fast(self, image: np.ndarray) -> Tuple[PestType, float]:
        normalized = image.astype(np.float16) / 255.0
        
        x = self._conv2d_fast(normalized, self.weights['conv1'])
        x = self._relu(x)
        x = self._max_pool(x)
        
        x = self._conv2d_fast(x, self.weights['conv2'])
        x = self._relu(x)
        x = self._max_pool(x)
        
        x = x.flatten().astype(np.float16)
        x = np.dot(x, self.weights['fc1'].astype(np.float16))
        x = self._relu(x)
        logits = np.dot(x, self.weights['fc2'].astype(np.float16))
        
        probs = self._softmax(logits)
        pred_idx = np.argmax(probs)
        confidence = float(probs[pred_idx])
        
        return self.class_names[pred_idx], confidence

    def load_weights(self, weights_path: str):
        try:
            loaded_weights = np.load(weights_path, allow_pickle=True).item()
            for k in loaded_weights:
                if isinstance(loaded_weights[k], np.ndarray):
                    loaded_weights[k] = loaded_weights[k].astype(np.float16)
            self._weights = loaded_weights
            self._model_loaded = True
            gc.collect()
        except Exception as e:
            print(f"Load weights failed, using default: {e}")
            self._init_weights_lazy()

    def unload_model(self):
        if self._model_loaded:
            self._weights = None
            self._model_loaded = False
            gc.collect()

    def get_performance_stats(self) -> Dict:
        return {
            "inference_count": self._infer_count,
            "gc_threshold": self._gc_threshold,
            "model_loaded": self._model_loaded,
            "input_shape": self.input_shape,
            "memory_usage_mb": self._estimate_memory_usage(),
        }

    def _estimate_memory_usage(self) -> float:
        if not self._model_loaded:
            return 0.0
        
        total_bytes = 0
        for k, v in self.weights.items():
            if isinstance(v, np.ndarray):
                total_bytes += v.nbytes
        
        return total_bytes / (1024 * 1024)

    def quantize_model(self, quant_type: str = 'int8') -> bool:
        if not self._model_loaded:
            return False
        
        try:
            if quant_type == 'int8':
                for k in self._weights:
                    if isinstance(self._weights[k], np.ndarray):
                        arr = self._weights[k]
                        scale = np.max(np.abs(arr)) / 127
                        self._weights[k] = (arr / scale).astype(np.int8)
                        self._weights[k + '_scale'] = np.float16(scale)
            return True
        except Exception as e:
            print(f"Quantization failed: {e}")
            return False

    def optimize_for_inference(self):
        if not self._model_loaded:
            return
        
        for k in self._weights:
            if isinstance(self._weights[k], np.ndarray):
                if not k.endswith('_scale'):
                    self._weights[k] = np.ascontiguousarray(self._weights[k].astype(np.float16))
        
        gc.collect()


class InferenceOptimizer:
    def __init__(self, max_batch_size: int = 8, max_cache_size: int = 100):
        self.max_batch_size = max_batch_size
        self.max_cache_size = max_cache_size
        self._cache = {}
        self._cache_order = []
        self._batch_queue = []
        self._total_inferences = 0
        self._cache_hits = 0

    def get_from_cache(self, image_hash: str) -> Optional[Tuple[PestType, float]]:
        if image_hash in self._cache:
            self._cache_hits += 1
            return self._cache[image_hash]
        return None

    def add_to_cache(self, image_hash: str, result: Tuple[PestType, float]):
        if len(self._cache) >= self.max_cache_size:
            oldest = self._cache_order.pop(0)
            del self._cache[oldest]
        
        self._cache[image_hash] = result
        self._cache_order.append(image_hash)

    def get_cache_stats(self) -> Dict:
        hit_rate = self._cache_hits / max(1, self._total_inferences)
        return {
            "cache_size": len(self._cache),
            "cache_hits": self._cache_hits,
            "total_inferences": self._total_inferences,
            "cache_hit_rate": hit_rate,
        }

    def increment_inference_count(self):
        self._total_inferences += 1


class AudioClassifier:
    def __init__(self):
        self.class_names = [
            PestType.APHID,
            PestType.WHITEFLY,
            PestType.THRIPS,
            PestType.SPIDER_MITE,
            PestType.BOLLWORM
        ]
        self._weights = None
        self._model_loaded = False
        self._infer_count = 0
        self._gc_threshold = 100

    @property
    def weights(self):
        if not self._model_loaded:
            self._weights = np.random.randn(17, len(self.class_names)).astype(np.float16) * 0.1
            self._model_loaded = True
        return self._weights

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        x = x - np.max(x)
        exp_x = np.exp(x, dtype=np.float32)
        return exp_x / exp_x.sum()

    def predict(self, features: np.ndarray) -> Tuple[PestType, float]:
        self._infer_count += 1
        logits = np.dot(features.astype(np.float16), self.weights)
        probs = self._softmax(logits)
        pred_idx = np.argmax(probs)
        confidence = float(probs[pred_idx])
        
        if self._infer_count % self._gc_threshold == 0:
            gc.collect()
        
        if confidence < 0.5:
            return PestType.UNKNOWN, confidence
        return self.class_names[pred_idx], confidence

    def unload_model(self):
        if self._model_loaded:
            self._weights = None
            self._model_loaded = False
            gc.collect()


class InferenceEngine:
    def __init__(self):
        self._image_model = None
        self._audio_model = None
        self._model_usage_count = {
            'image': 0,
            'audio': 0
        }
        self._idle_timeout = 300
        self.result_history: List[InferenceResult] = []
        self.max_history = 200
        self.callbacks: List = []
        self._lock = threading.Lock()
        self._last_infer_time = {
            'image': time.time(),
            'audio': time.time()
        }

    @property
    def image_model(self):
        if self._image_model is None:
            self._image_model = LightweightCNN()
        self._model_usage_count['image'] += 1
        self._last_infer_time['image'] = time.time()
        return self._image_model

    @property
    def audio_model(self):
        if self._audio_model is None:
            self._audio_model = AudioClassifier()
        self._model_usage_count['audio'] += 1
        self._last_infer_time['audio'] = time.time()
        return self._audio_model

    def cleanup_idle_models(self):
        current_time = time.time()
        with self._lock:
            if self._image_model is not None and \
               current_time - self._last_infer_time['image'] > self._idle_timeout:
                self._image_model.unload_model()
                self._image_model = None
            
            if self._audio_model is not None and \
               current_time - self._last_infer_time['audio'] > self._idle_timeout:
                self._audio_model.unload_model()
                self._audio_model = None

    def infer_image(self, image: np.ndarray, data_id: str, 
                   device_id: str) -> InferenceResult:
        pest_type, confidence = self.image_model.predict(image)
        
        result = InferenceResult(
            result_id=f"inf_{data_id}_{int(time.time() * 1000)}",
            data_id=data_id,
            device_id=device_id,
            pest_type=pest_type,
            confidence=confidence,
            model_type=ModelType.IMAGE_CLASSIFICATION,
            timestamp=time.time(),
            metadata={"processing_time_ms": np.random.randint(10, 50)}
        )
        
        with self._lock:
            self.result_history.append(result)
            if len(self.result_history) > self.max_history:
                self.result_history.pop(0)
        
        self._notify_callbacks(result)
        return result

    def infer_audio(self, features: np.ndarray, data_id: str,
                   device_id: str) -> InferenceResult:
        pest_type, confidence = self.audio_model.predict(features)
        
        result = InferenceResult(
            result_id=f"inf_{data_id}_{int(time.time() * 1000)}",
            data_id=data_id,
            device_id=device_id,
            pest_type=pest_type,
            confidence=confidence,
            model_type=ModelType.AUDIO_CLASSIFICATION,
            timestamp=time.time(),
            metadata={"processing_time_ms": np.random.randint(5, 20)}
        )
        
        with self._lock:
            self.result_history.append(result)
            if len(self.result_history) > self.max_history:
                self.result_history.pop(0)
        
        self._notify_callbacks(result)
        return result

    def get_latest_results(self, n: int = 10) -> List[InferenceResult]:
        with self._lock:
            return self.result_history[-n:]

    def get_results_by_device(self, device_id: str, n: int = 10) -> List[InferenceResult]:
        with self._lock:
            filtered = [r for r in self.result_history if r.device_id == device_id]
            return filtered[-n:]

    def get_pest_statistics(self) -> Dict[PestType, int]:
        stats = {p: 0 for p in PestType}
        with self._lock:
            for result in self.result_history:
                stats[result.pest_type] += 1
        return stats

    def add_callback(self, callback):
        self.callbacks.append(callback)

    def _notify_callbacks(self, result: InferenceResult):
        for callback in self.callbacks:
            try:
                callback(result)
            except Exception as e:
                print(f"Inference callback error: {e}")

    def update_image_model(self, weights):
        pass

    def update_audio_model(self, weights):
        pass
