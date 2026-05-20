import os
import logging
import math
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import numpy as np
import json
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)

class ModelSize(Enum):
    TINY = "tiny"
    SMALL = "small"
    BASE = "base"
    MEDIUM = "medium"

class QuantizationLevel(Enum):
    FP32 = "fp32"
    FP16 = "fp16"
    INT8 = "int8"
    INT4 = "int4"

class PruningLevel(Enum):
    NONE = "none"
    LIGHT = "light"
    MEDIUM = "medium"
    AGGRESSIVE = "aggressive"

@dataclass
class ModelConfig:
    model_size: ModelSize
    vocab_size: int = 10000
    d_model: int = 512
    num_heads: int = 8
    num_layers: int = 6
    d_ff: int = 2048
    max_seq_length: int = 512
    dropout: float = 0.1
    quantization: QuantizationLevel = QuantizationLevel.FP32
    pruning: PruningLevel = PruningLevel.NONE
    use_moe: bool = False
    num_experts: int = 4
    use_flash_attention: bool = True
    use_sparse_attention: bool = False
    
    @classmethod
    def get_config(cls, model_size: ModelSize) -> 'ModelConfig':
        configs = {
            ModelSize.TINY: cls(
                model_size=ModelSize.TINY,
                d_model=128,
                num_heads=2,
                num_layers=2,
                d_ff=512,
                max_seq_length=256,
                dropout=0.1
            ),
            ModelSize.SMALL: cls(
                model_size=ModelSize.SMALL,
                d_model=256,
                num_heads=4,
                num_layers=4,
                d_ff=1024,
                max_seq_length=384,
                dropout=0.1
            ),
            ModelSize.BASE: cls(
                model_size=ModelSize.BASE,
                d_model=512,
                num_heads=8,
                num_layers=6,
                d_ff=2048,
                max_seq_length=512,
                dropout=0.1
            ),
            ModelSize.MEDIUM: cls(
                model_size=ModelSize.MEDIUM,
                d_model=768,
                num_heads=12,
                num_layers=8,
                d_ff=3072,
                max_seq_length=768,
                dropout=0.1
            )
        }
        return configs.get(model_size, configs[ModelSize.BASE])
    
    def get_model_size_mb(self) -> float:
        param_count = self.estimate_parameters()
        bytes_per_param = {
            QuantizationLevel.FP32: 4,
            QuantizationLevel.FP16: 2,
            QuantizationLevel.INT8: 1,
            QuantizationLevel.INT4: 0.5
        }
        return (param_count * bytes_per_param[self.quantization]) / (1024 * 1024)
    
    def estimate_parameters(self) -> int:
        embedding_params = self.vocab_size * self.d_model
        attention_params = 4 * self.d_model * self.d_model
        ff_params = 2 * self.d_model * self.d_ff
        layer_norm_params = 2 * self.d_model
        per_layer_params = attention_params + ff_params + layer_norm_params * 2
        total_params = embedding_params + self.num_layers * per_layer_params
        
        pruning_factors = {
            PruningLevel.NONE: 1.0,
            PruningLevel.LIGHT: 0.7,
            PruningLevel.MEDIUM: 0.5,
            PruningLevel.AGGRESSIVE: 0.3
        }
        total_params = int(total_params * pruning_factors[self.pruning])
        
        return total_params
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_size": self.model_size.value,
            "vocab_size": self.vocab_size,
            "d_model": self.d_model,
            "num_heads": self.num_heads,
            "num_layers": self.num_layers,
            "d_ff": self.d_ff,
            "max_seq_length": self.max_seq_length,
            "dropout": self.dropout,
            "quantization": self.quantization.value,
            "pruning": self.pruning.value,
            "use_moe": self.use_moe,
            "num_experts": self.num_experts,
            "estimated_params_m": self.estimate_parameters() / 1_000_000,
            "estimated_size_mb": round(self.get_model_size_mb(), 2)
        }

class LightweightTransformer:
    def __init__(self, config: ModelConfig):
        self.config = config
        self.model = None
        self.is_quantized = config.quantization != QuantizationLevel.FP32
        self.is_pruned = config.pruning != PruningLevel.NONE
        self._initialize_weights()
        
        logger.info(f"LightweightTransformer initialized: {config.model_size.value}")
        logger.info(f"  - Parameters: {config.estimate_parameters() / 1_000_000:.2f}M")
        logger.info(f"  - Estimated size: {config.get_model_size_mb():.2f} MB")
        logger.info(f"  - Quantization: {config.quantization.value}")
        logger.info(f"  - Pruning: {config.pruning.value}")
    
    def _initialize_weights(self):
        d_model = self.config.d_model
        num_heads = self.config.num_heads
        num_layers = self.config.num_layers
        d_ff = self.config.d_ff
        
        self.embedding = np.random.randn(self.config.vocab_size, d_model) * 0.01
        
        self.encoder_layers = []
        for _ in range(num_layers):
            layer = {
                "q_proj": np.random.randn(d_model, d_model) * 0.01,
                "k_proj": np.random.randn(d_model, d_model) * 0.01,
                "v_proj": np.random.randn(d_model, d_model) * 0.01,
                "out_proj": np.random.randn(d_model, d_model) * 0.01,
                "ff1": np.random.randn(d_model, d_ff) * 0.01,
                "ff2": np.random.randn(d_ff, d_model) * 0.01,
                "ln1_gamma": np.ones(d_model),
                "ln1_beta": np.zeros(d_model),
                "ln2_gamma": np.ones(d_model),
                "ln2_beta": np.zeros(d_model)
            }
            self.encoder_layers.append(layer)
        
        self.final_ln_gamma = np.ones(d_model)
        self.final_ln_beta = np.zeros(d_model)
        
        if self.is_quantized:
            self._quantize_weights()
        
        if self.is_pruned:
            self._prune_weights()
    
    def _quantize_weights(self):
        logger.info(f"Applying {self.config.quantization.value} quantization...")
        
        if self.config.quantization == QuantizationLevel.FP16:
            self.embedding = self.embedding.astype(np.float16)
            for layer in self.encoder_layers:
                for k, v in layer.items():
                    if isinstance(v, np.ndarray) and v.dtype == np.float64:
                        layer[k] = v.astype(np.float16)
        
        elif self.config.quantization in [QuantizationLevel.INT8, QuantizationLevel.INT4]:
            self._quantize_to_int()
    
    def _quantize_to_int(self):
        bits = 8 if self.config.quantization == QuantizationLevel.INT8 else 4
        logger.info(f"Quantizing to {bits}-bit integers...")
        
        def quantize_array(arr):
            scale = np.max(np.abs(arr))
            if scale == 0:
                return arr, 1.0, 0
            q_min = -(2 ** (bits - 1))
            q_max = 2 ** (bits - 1) - 1
            zero_point = 0
            quantized = np.clip(np.round(arr / scale * (2 ** (bits - 1) - 1)), q_min, q_max)
            dtype = np.int8 if bits == 8 else np.int8
            return quantized.astype(dtype), scale, zero_point
        
        self.embedding, self.emb_scale, self.emb_zp = quantize_array(self.embedding)
        
        for layer in self.encoder_layers:
            for k, v in layer.items():
                if isinstance(v, np.ndarray) and v.dtype in [np.float32, np.float64]:
                    layer[k], layer[f"{k}_scale"], layer[f"{k}_zp"] = quantize_array(v)
    
    def _prune_weights(self):
        pruning_ratios = {
            PruningLevel.LIGHT: 0.3,
            PruningLevel.MEDIUM: 0.5,
            PruningLevel.AGGRESSIVE: 0.7
        }
        ratio = pruning_ratios[self.config.pruning]
        logger.info(f"Applying {ratio*100:.0f}% weight pruning...")
        
        def prune_array(arr, ratio):
            if len(arr.shape) == 2:
                threshold = np.percentile(np.abs(arr), ratio * 100)
                mask = np.abs(arr) >= threshold
                return arr * mask
            return arr
        
        self.embedding = prune_array(self.embedding, ratio)
        
        for layer in self.encoder_layers:
            for k, v in layer.items():
                if isinstance(v, np.ndarray) and len(v.shape) == 2:
                    layer[k] = prune_array(v, ratio)
    
    def _layer_norm(self, x: np.ndarray, gamma: np.ndarray, beta: np.ndarray, eps: float = 1e-6) -> np.ndarray:
        mean = np.mean(x, axis=-1, keepdims=True)
        var = np.var(x, axis=-1, keepdims=True)
        normalized = (x - mean) / np.sqrt(var + eps)
        return gamma * normalized + beta
    
    def _scaled_dot_product_attention(self, q: np.ndarray, k: np.ndarray, v: np.ndarray, mask: Optional[np.ndarray] = None) -> np.ndarray:
        d_k = q.shape[-1]
        scores = np.matmul(q, k.transpose(0, 1, 3, 2)) / math.sqrt(d_k)
        
        if mask is not None:
            scores = np.where(mask == 0, -1e9, scores)
        
        attn_weights = self._softmax(scores)
        return np.matmul(attn_weights, v)
    
    def _softmax(self, x: np.ndarray) -> np.ndarray:
        exp_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return exp_x / np.sum(exp_x, axis=-1, keepdims=True)
    
    def _gelu(self, x: np.ndarray) -> np.ndarray:
        return 0.5 * x * (1 + np.tanh(math.sqrt(2 / math.pi) * (x + 0.044715 * np.power(x, 3))))
    
    def forward(self, input_ids: np.ndarray, attention_mask: Optional[np.ndarray] = None) -> np.ndarray:
        batch_size, seq_len = input_ids.shape
        
        x = self.embedding[input_ids]
        
        if attention_mask is None:
            attention_mask = np.ones((batch_size, seq_len), dtype=np.float32)
        
        attention_mask = attention_mask[:, np.newaxis, np.newaxis, :]
        
        for layer in self.encoder_layers:
            residual = x
            x = self._layer_norm(x, layer["ln1_gamma"], layer["ln1_beta"])
            
            q = np.matmul(x, layer["q_proj"]).reshape(batch_size, seq_len, self.config.num_heads, -1).transpose(0, 2, 1, 3)
            k = np.matmul(x, layer["k_proj"]).reshape(batch_size, seq_len, self.config.num_heads, -1).transpose(0, 2, 1, 3)
            v = np.matmul(x, layer["v_proj"]).reshape(batch_size, seq_len, self.config.num_heads, -1).transpose(0, 2, 1, 3)
            
            attn_output = self._scaled_dot_product_attention(q, k, v, attention_mask)
            attn_output = attn_output.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, -1)
            attn_output = np.matmul(attn_output, layer["out_proj"])
            
            x = residual + attn_output
            residual = x
            x = self._layer_norm(x, layer["ln2_gamma"], layer["ln2_beta"])
            
            ff_output = np.matmul(x, layer["ff1"])
            ff_output = self._gelu(ff_output)
            ff_output = np.matmul(ff_output, layer["ff2"])
            
            x = residual + ff_output
        
        x = self._layer_norm(x, self.final_ln_gamma, self.final_ln_beta)
        return x
    
    def infer(self, text: str, dialect_id: int = 1) -> Dict[str, Any]:
        start_time = datetime.now()
        
        tokens = self._tokenize(text)
        input_ids = np.array([tokens])
        
        features = self.forward(input_ids)
        
        inference_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return {
            "success": True,
            "dialect_id": dialect_id,
            "input_text": text,
            "input_tokens": len(tokens),
            "output_shape": features.shape,
            "inference_time_ms": round(inference_time, 2),
            "model_config": self.config.to_dict()
        }
    
    def _tokenize(self, text: str) -> List[int]:
        tokens = []
        for char in text:
            token = hash(char) % self.config.vocab_size
            tokens.append(token)
        return tokens[:self.config.max_seq_length]

class ModelCompressor:
    @staticmethod
    def create_lightweight_model(
        model_size: ModelSize = ModelSize.SMALL,
        quantization: QuantizationLevel = QuantizationLevel.INT8,
        pruning: PruningLevel = PruningLevel.MEDIUM
    ) -> LightweightTransformer:
        config = ModelConfig.get_config(model_size)
        config.quantization = quantization
        config.pruning = pruning
        return LightweightTransformer(config)
    
    @staticmethod
    def get_model_comparison() -> Dict[str, Any]:
        comparisons = []
        for size in ModelSize:
            for quant in [QuantizationLevel.FP32, QuantizationLevel.FP16, QuantizationLevel.INT8]:
                config = ModelConfig.get_config(size)
                config.quantization = quant
                comparisons.append({
                    "model_size": size.value,
                    "quantization": quant.value,
                    "params_million": round(config.estimate_parameters() / 1_000_000, 2),
                    "size_mb": round(config.get_model_size_mb(), 2),
                    "relative_size": round(config.get_model_size_mb() / ModelConfig.get_config(ModelSize.BASE).get_model_size_mb(), 3)
                })
        return {
            "comparisons": comparisons,
            "note": "Base model (FP32) as 1.0x reference"
        }
    
    @staticmethod
    def estimate_inference_speed(model_size: ModelSize, quantization: QuantizationLevel) -> Dict[str, Any]:
        base_config = ModelConfig.get_config(ModelSize.BASE)
        target_config = ModelConfig.get_config(model_size)
        target_config.quantization = quantization
        
        param_ratio = base_config.estimate_parameters() / target_config.estimate_parameters()
        quant_speedup = {
            QuantizationLevel.FP32: 1.0,
            QuantizationLevel.FP16: 1.5,
            QuantizationLevel.INT8: 2.5,
            QuantizationLevel.INT4: 4.0
        }
        
        speedup = param_ratio * quant_speedup[quantization]
        
        return {
            "model_size": model_size.value,
            "quantization": quantization.value,
            "speedup_factor": round(speedup, 2),
            "estimated_latency_ms": round(50 / speedup, 2),
            "note": "Relative to Base FP32 model"
        }

class DialectModelRegistry:
    def __init__(self, model_dir: str = "./models/optimized"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.models: Dict[int, LightweightTransformer] = {}
        self.model_configs: Dict[int, Dict] = {}
        self.loaded_at: Dict[int, datetime] = {}
        self.last_used_at: Dict[int, datetime] = {}
        
    def get_model(self, dialect_id: int) -> Optional[LightweightTransformer]:
        if dialect_id in self.models:
            self.last_used_at[dialect_id] = datetime.now()
            return self.models[dialect_id]
        return None
    
    def load_model(self, dialect_id: int, model_size: ModelSize = ModelSize.SMALL,
                   quantization: QuantizationLevel = QuantizationLevel.INT8) -> bool:
        try:
            if dialect_id in self.models:
                return True
            
            logger.info(f"Loading optimized model for dialect {dialect_id}...")
            model = ModelCompressor.create_lightweight_model(model_size, quantization)
            
            self.models[dialect_id] = model
            self.model_configs[dialect_id] = model.config.to_dict()
            self.loaded_at[dialect_id] = datetime.now()
            self.last_used_at[dialect_id] = datetime.now()
            
            logger.info(f"Model loaded successfully: {model.config.get_model_size_mb():.2f} MB")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def unload_model(self, dialect_id: int) -> bool:
        if dialect_id in self.models:
            del self.models[dialect_id]
            del self.model_configs[dialect_id]
            del self.loaded_at[dialect_id]
            del self.last_used_at[dialect_id]
            logger.info(f"Unloaded model for dialect {dialect_id}")
            return True
        return False
    
    def unload_idle_models(self, idle_minutes: int = 30) -> int:
        now = datetime.now()
        unloaded_count = 0
        for dialect_id in list(self.models.keys()):
            idle_time = (now - self.last_used_at[dialect_id]).total_seconds() / 60
            if idle_time > idle_minutes:
                self.unload_model(dialect_id)
                unloaded_count += 1
        return unloaded_count
    
    def get_loaded_models(self) -> List[Dict]:
        return [
            {
                "dialect_id": did,
                "config": self.model_configs[did],
                "loaded_at": self.loaded_at[did].isoformat(),
                "last_used_at": self.last_used_at[did].isoformat(),
                "idle_minutes": round((datetime.now() - self.last_used_at[did]).total_seconds() / 60, 1)
            }
            for did in self.models.keys()
        ]
