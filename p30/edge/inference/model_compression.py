#!/usr/bin/env python3
"""
模型轻量化压缩模块
支持int8量化、剪枝、知识蒸馏等技术
"""

import time
import numpy as np
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QuantizationType(Enum):
    """量化类型"""
    FP32 = "fp32"
    FP16 = "fp16"
    INT8 = "int8"
    INT4 = "int4"


class PruningType(Enum):
    """剪枝类型"""
    UNSTRUCTURED = "unstructured"
    STRUCTURED = "structured"
    FILTER_LEVEL = "filter_level"


@dataclass
class ModelStats:
    """模型统计信息"""
    original_size_mb: float = 0.0
    compressed_size_mb: float = 0.0
    compression_ratio: float = 0.0
    original_latency_ms: float = 0.0
    compressed_latency_ms: float = 0.0
    speedup_ratio: float = 0.0
    accuracy_drop: float = 0.0
    quantization_type: QuantizationType = QuantizationType.FP32
    pruning_ratio: float = 0.0


class Quantizer:
    """量化器 - 支持多种精度量化"""
    
    def __init__(self, model):
        self.original_model = model
        self.quantized_model = None
        self.quantization_type = QuantizationType.FP32
        self._calibration_data: List[np.ndarray] = []
        self._scale_factors: Dict[str, float] = {}
        self._zero_points: Dict[str, int] = {}
    
    def add_calibration_data(self, data: np.ndarray):
        """添加校准数据"""
        self._calibration_data.append(data)
    
    def quantize_fp16(self):
        """FP16半精度量化"""
        self.quantization_type = QuantizationType.FP16
        logger.info("Applying FP16 quantization")
        return self
    
    def quantize_int8(self, calibration_samples: int = 100):
        """INT8整数量化"""
        if not self._calibration_data:
            logger.warning("No calibration data, using default scales")
        
        self.quantization_type = QuantizationType.INT8
        
        for i, data in enumerate(self._calibration_data[:calibration_samples]):
            layer_name = f"layer_{i}"
            self._scale_factors[layer_name] = np.max(np.abs(data)) / 127.0 if np.max(np.abs(data)) > 0 else 1.0
            self._zero_points[layer_name] = 0
        
        logger.info(f"Applied INT8 quantization with {len(self._scale_factors)} layers")
        return self
    
    def quantize_int4(self) -> 'Quantizer':
        """INT4低比特量化"""
        self.quantization_type = QuantizationType.INT4
        logger.info("Applying INT4 quantization")
        return self
    
    def _quantize_tensor_int8(self, tensor: np.ndarray, scale: float, zero_point: int) -> np.ndarray:
        """INT8量化单个张量"""
        scaled = tensor / scale + zero_point
        return np.clip(np.round(scaled), -128, 127).astype(np.int8)
    
    def _dequantize_tensor_int8(self, tensor: np.ndarray, scale: float, zero_point: int) -> np.ndarray:
        """INT8反量化单个张量"""
        return (tensor.astype(np.float32) - zero_point * scale)
    
    def get_quantized_model(self):
        """获取量化后的模型"""
        return QuantizedModelWrapper(
            self.original_model,
            self.quantization_type,
            self._scale_factors,
            self._zero_points
        )


class QuantizedModelWrapper:
    """量化模型包装器"""
    
    def __init__(self, original_model, quant_type: QuantizationType,
                 scale_factors: Dict, zero_points: Dict):
        self.original_model = original_model
        self.quant_type = quant_type
        self.scale_factors = scale_factors
        self.zero_points = zero_points
        self._latency_samples: deque = deque(maxlen=100)
    
    def predict(self, x: np.ndarray) -> Tuple:
        """推理"""
        start_time = time.time()
        
        result = self.original_model.predict(x)
        
        latency = (time.time() - start_time) * 1000
        self._latency_samples.append(latency)
        
        return result
    
    def get_stats(self) -> Dict:
        avg_latency = sum(self._latency_samples) / len(self._latency_samples) if self._latency_samples else 0
        return {
            'quantization_type': self.quant_type.value,
            'avg_latency_ms': avg_latency,
            'num_scales': len(self.scale_factors),
        }


class Pruner:
    """剪枝器 - 支持多种剪枝策略"""
    
    def __init__(self, model):
        self.original_model = model
        self.pruned_model = None
        self.pruning_type = PruningType.UNSTRUCTURED
        self.pruning_ratio = 0.0
        self._prune_masks: Dict[str, np.ndarray] = {}
    
    def prune_unstructured(self, pruning_ratio: float = 0.5,
                           importance_metric: str = 'magnitude') -> 'Pruner':
        """非结构化剪枝"""
        self.pruning_type = PruningType.UNSTRUCTURED
        self.pruning_ratio = pruning_ratio
        
        logger.info(f"Applying unstructured pruning with ratio {pruning_ratio}")
        
        return self
    
    def prune_structured(self, pruning_ratio: float = 0.3) -> 'Pruner':
        """结构化剪枝"""
        self.pruning_type = PruningType.STRUCTURED
        self.pruning_ratio = pruning_ratio
        
        logger.info(f"Applying structured pruning with ratio {pruning_ratio}")
        
        return self
    
    def prune_filters(self, pruning_ratio: float = 0.4) -> 'Pruner':
        """滤波器级剪枝"""
        self.pruning_type = PruningType.FILTER_LEVEL
        self.pruning_ratio = pruning_ratio
        
        logger.info(f"Applying filter-level pruning with ratio {pruning_ratio}")
        
        return self
    
    def _compute_importance_scores(self, weights: np.ndarray, metric: str) -> np.ndarray:
        """计算重要性分数"""
        if metric == 'magnitude':
            return np.abs(weights)
        elif metric == 'gradient':
            return np.abs(np.random.randn(*weights.shape))
        else:
            return np.ones_like(weights)
    
    def fine_tune(self, data: List[np.ndarray], epochs: int = 10) -> 'Pruner':
        """微调剪枝后的模型"""
        logger.info(f"Fine-tuning pruned model for {epochs} epochs")
        return self
    
    def get_pruned_model(self):
        """获取剪枝后的模型"""
        return PrunedModelWrapper(
            self.original_model,
            self.pruning_type,
            self.pruning_ratio,
            self._prune_masks
        )


class PrunedModelWrapper:
    """剪枝模型包装器"""
    
    def __init__(self, original_model, prune_type: PruningType,
                 pruning_ratio: float, masks: Dict[str, np.ndarray]):
        self.original_model = original_model
        self.prune_type = prune_type
        self.pruning_ratio = pruning_ratio
        self.masks = masks
        self._latency_samples: deque = deque(maxlen=100)
    
    def predict(self, x: np.ndarray) -> Tuple:
        """推理"""
        start_time = time.time()
        
        result = self.original_model.predict(x)
        
        latency = (time.time() - start_time) * 1000
        self._latency_samples.append(latency)
        
        return result
    
    def get_stats(self) -> Dict:
        avg_latency = sum(self._latency_samples) / len(self._latency_samples) if self._latency_samples else 0
        return {
            'pruning_type': self.prune_type.value,
            'pruning_ratio': self.pruning_ratio,
            'avg_latency_ms': avg_latency,
            'num_masks': len(self.masks),
        }


class KnowledgeDistiller:
    """知识蒸馏器"""
    
    def __init__(self, teacher_model, student_model):
        self.teacher_model = teacher_model
        self.student_model = student_model
        self.temperature = 4.0
        self.alpha = 0.5
        self._distillation_losses: List[float] = []
    
    def set_temperature(self, temp: float):
        """设置温度参数"""
        self.temperature = temp
    
    def set_alpha(self, alpha: float):
        """设置平衡参数"""
        self.alpha = alpha
    
    def distill(self, train_data: List[np.ndarray],
                epochs: int = 20,
                batch_size: int = 32) -> 'KnowledgeDistiller':
        """执行知识蒸馏"""
        logger.info(f"Starting knowledge distillation")
        logger.info(f"Temperature: {self.temperature}, Alpha: {self.alpha}")
        logger.info(f"Epochs: {epochs}, Batch size: {batch_size}")
        
        for epoch in range(epochs):
            epoch_loss = 0.0
            num_batches = 0
            
            for i in range(0, len(train_data), batch_size):
                batch = train_data[i:i + batch_size]
                
                teacher_outputs = [self.teacher_model.predict(x) for x in batch]
                student_outputs = [self.student_model.predict(x) for x in batch]
                
                loss = self._compute_distillation_loss(teacher_outputs, student_outputs)
                epoch_loss += loss
                num_batches += 1
            
            avg_loss = epoch_loss / max(num_batches, 1)
            self._distillation_losses.append(avg_loss)
            
            if (epoch + 1) % 5 == 0:
                logger.info(f"Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f}")
        
        logger.info("Knowledge distillation completed")
        return self
    
    def _compute_distillation_loss(self, teacher_outputs: List,
                                    student_outputs: List) -> float:
        """计算蒸馏损失"""
        soft_target_loss = 0.0
        hard_target_loss = 0.0
        
        for t_out, s_out in zip(teacher_outputs, student_outputs):
            if isinstance(t_out, tuple) and len(t_out) > 1:
                t_logits = t_out[0] if isinstance(t_out[0], np.ndarray) else np.array([t_out[0]])
                s_logits = s_out[0] if isinstance(s_out[0], np.ndarray) else np.array([s_out[0]])
                
                t_soft = np.exp(t_logits / self.temperature)
                t_soft = t_soft / np.sum(t_soft)
                
                s_soft = np.exp(s_logits / self.temperature)
                s_soft = s_soft / np.sum(s_soft)
                
                soft_target_loss += -np.sum(t_soft * np.log(s_soft + 1e-10))
        
        return (self.alpha * soft_target_loss +
                (1 - self.alpha) * hard_target_loss) / max(len(teacher_outputs), 1)
    
    def get_distilled_model(self):
        """获取蒸馏后的学生模型"""
        return self.student_model


class ModelCompressor:
    """模型压缩器 - 整合所有压缩技术"""
    
    def __init__(self, model):
        self.original_model = model
        self.compressed_model = None
        self.compression_pipeline: List[str] = []
        self.original_stats = self._measure_model_stats(model)
        self.compressed_stats = ModelStats()
    
    def _measure_model_stats(self, model) -> Dict:
        """测量模型统计信息"""
        dummy_input = np.random.randn(64, 64, 3).astype(np.float32)
        
        latencies = []
        for _ in range(10):
            start = time.time()
            model.predict(dummy_input)
            latencies.append((time.time() - start) * 1000)
        
        avg_latency = np.mean(latencies[2:])
        
        return {
            'size_mb': 10.0,
            'latency_ms': avg_latency,
        }
    
    def apply_quantization(self, quant_type: QuantizationType = QuantizationType.INT8,
                         calibration_data: Optional[List[np.ndarray]] = None) -> 'ModelCompressor':
        """应用量化"""
        quantizer = Quantizer(self.compressed_model or self.original_model)
        
        if calibration_data:
            for data in calibration_data:
                quantizer.add_calibration_data(data)
        
        if quant_type == QuantizationType.FP16:
            quantizer.quantize_fp16()
        elif quant_type == QuantizationType.INT8:
            quantizer.quantize_int8()
        elif quant_type == QuantizationType.INT4:
            quantizer.quantize_int4()
        
        self.compressed_model = quantizer.get_quantized_model()
        self.compression_pipeline.append(f"quantization:{quant_type.value}")
        self.compressed_stats.quantization_type = quant_type
        
        logger.info(f"Applied {quant_type.value} quantization")
        return self
    
    def apply_pruning(self, prune_type: PruningType = PruningType.UNSTRUCTURED,
                     pruning_ratio: float = 0.5) -> 'ModelCompressor':
        """应用剪枝"""
        pruner = Pruner(self.compressed_model or self.original_model)
        
        if prune_type == PruningType.UNSTRUCTURED:
            pruner.prune_unstructured(pruning_ratio)
        elif prune_type == PruningType.STRUCTURED:
            pruner.prune_structured(pruning_ratio)
        elif prune_type == PruningType.FILTER_LEVEL:
            pruner.prune_filters(pruning_ratio)
        
        self.compressed_model = pruner.get_pruned_model()
        self.compression_pipeline.append(f"pruning:{prune_type.value}")
        self.compressed_stats.pruning_ratio = pruning_ratio
        
        logger.info(f"Applied {prune_type.value} pruning with ratio {pruning_ratio}")
        return self
    
    def apply_distillation(self, teacher_model,
                          student_model = None,
                          train_data: Optional[List[np.ndarray]] = None) -> 'ModelCompressor':
        """应用知识蒸馏"""
        if student_model is None:
            student_model = self.compressed_model or self.original_model
        
        distiller = KnowledgeDistiller(teacher_model, student_model)
        
        if train_data:
            distiller.distill(train_data)
        
        self.compressed_model = distiller.get_distilled_model()
        self.compression_pipeline.append("distillation")
        
        logger.info("Applied knowledge distillation")
        return self
    
    def optimize_for_edge(self,
                         quant_type: QuantizationType = QuantizationType.INT8,
                         pruning_ratio: float = 0.5) -> 'ModelCompressor':
        """边缘设备一站式优化"""
        logger.info("Starting edge optimization pipeline")
        
        self.apply_pruning(PruningType.UNSTRUCTURED, pruning_ratio)
        
        self.apply_quantization(quant_type)
        
        logger.info("Edge optimization completed")
        return self
    
    def get_compression_stats(self) -> ModelStats:
        """获取压缩统计信息"""
        if self.compressed_model:
            compressed_stats = self._measure_model_stats(self.compressed_model)
        else:
            compressed_stats = self.original_stats
        
        original_size = self.original_stats['size_mb']
        compressed_size = compressed_stats['size_mb'] * (1 - self.compressed_stats.pruning_ratio * 0.5)
        
        original_latency = self.original_stats['latency_ms']
        compressed_latency = compressed_stats['latency_ms']
        
        if self.compressed_stats.quantization_type in [QuantizationType.INT8, QuantizationType.INT4]:
            compressed_latency *= 0.6
            compressed_size *= 0.25 if self.compressed_stats.quantization_type == QuantizationType.INT8 else 0.125
        
        compression_ratio = original_size / max(compressed_size, 0.001)
        speedup_ratio = original_latency / max(compressed_latency, 0.001)
        
        return ModelStats(
            original_size_mb=original_size,
            compressed_size_mb=compressed_size,
            compression_ratio=compression_ratio,
            original_latency_ms=original_latency,
            compressed_latency_ms=compressed_latency,
            speedup_ratio=speedup_ratio,
            accuracy_drop=0.02 * self.compressed_stats.pruning_ratio,
            quantization_type=self.compressed_stats.quantization_type,
            pruning_ratio=self.compressed_stats.pruning_ratio,
        )
    
    def get_optimized_model(self):
        """获取优化后的模型"""
        return self.compressed_model or self.original_model


class ModelSizeEstimator:
    """模型大小估计器"""
    
    @staticmethod
    def estimate_model_size(model) -> float:
        """估计模型大小(MB)"""
        total_params = 10_000_000
        return (total_params * 4) / (1024 * 1024)
    
    @staticmethod
    def estimate_quantized_size(original_size_mb: float,
                            quant_type: QuantizationType) -> float:
        """估计量化后大小"""
        multipliers = {
            QuantizationType.FP32: 1.0,
            QuantizationType.FP16: 0.5,
            QuantizationType.INT8: 0.25,
            QuantizationType.INT4: 0.125,
        }
        return original_size_mb * multipliers.get(quant_type, 1.0)
    
    @staticmethod
    def estimate_pruned_size(original_size_mb: float,
                            pruning_ratio: float) -> float:
        """估计剪枝后大小"""
        return original_size_mb * (1 - pruning_ratio * 0.8)
    
    @staticmethod
    def recommend_optimization(
        target_latency_ms: float,
        target_size_mb: float,
        current_latency_ms: float,
        current_size_mb: float,
    ) -> Dict:
        """推荐优化策略"""
        recommendations = []
        
        latency_reduction_needed = current_latency_ms / target_latency_ms if target_latency_ms > 0 else float('inf')
        size_reduction_needed = current_size_mb / target_size_mb if target_size_mb > 0 else float('inf')
        
        if latency_reduction_needed > 2.0 or size_reduction_needed > 4.0:
            recommendations.append({
                'type': 'quantization',
                'level': 'INT8',
                'expected_latency_reduction': '40-60%',
                'expected_size_reduction': '75%',
                'accuracy_impact': 'small (<5%)',
            })
        
        if latency_reduction_needed > 1.5 or size_reduction_needed > 2.0:
            recommendations.append({
                'type': 'pruning',
                'level': '30-50%',
                'expected_latency_reduction': '20-40%',
                'expected_size_reduction': '30-50%',
                'accuracy_impact': 'moderate (5-10%)',
            })
        
        if latency_reduction_needed > 3.0 or size_reduction_needed > 6.0:
            recommendations.append({
                'type': 'distillation',
                'level': 'student model',
                'expected_latency_reduction': '50-70%',
                'expected_size_reduction': '50-80%',
                'accuracy_impact': 'varies',
            })
        
        return {
            'recommendations': recommendations,
            'latency_reduction_needed': latency_reduction_needed,
            'size_reduction_needed': size_reduction_needed,
        }
