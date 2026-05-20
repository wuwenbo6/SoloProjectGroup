#!/usr/bin/env python3
"""
边缘端AI推理链路重构
实现流水线处理、异步推理、批处理优化，提升吞吐量和效率
"""

import time
import queue
import threading
from typing import Dict, List, Optional, Callable, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PipelineStage(Enum):
    """流水线阶段"""
    PREPROCESSING = "preprocessing"
    INFERENCE = "inference"
    POSTPROCESSING = "postprocessing"
    AGGREGATION = "aggregation"


class TaskPriority(Enum):
    """任务优先级"""
    HIGH = 0
    MEDIUM = 1
    LOW = 2


@dataclass
class InferenceTask:
    """推理任务"""
    task_id: str
    image: np.ndarray
    priority: TaskPriority = TaskPriority.MEDIUM
    timestamp: float = field(default_factory=time.time)
    
    callback: Optional[Callable] = None
    metadata: Dict = field(default_factory=dict)
    
    preprocessed_data: Optional[np.ndarray] = None
    inference_result: Optional[Dict] = None
    final_result: Optional[Dict] = None
    
    stage: PipelineStage = PipelineStage.PREPROCESSING
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class PipelineStats:
    """流水线统计信息"""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    avg_latency_ms: float = 0.0
    throughput_per_sec: float = 0.0
    stage_times: Dict[str, float] = field(default_factory=dict)
    queue_sizes: Dict[str, int] = field(default_factory=dict)


class StageWorker(threading.Thread):
    """阶段工作线程"""
    
    def __init__(self, stage: PipelineStage, input_queue: queue.Queue,
                 output_queue: Optional[queue.Queue], processor: Callable,
                 max_workers: int = 2):
        super().__init__(daemon=True)
        self.stage = stage
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.processor = processor
        self.max_workers = max_workers
        self.running = False
        self.processed_count = 0
        self.total_time = 0.0
        self._lock = threading.Lock()
    
    def run(self):
        self.running = True
        while self.running:
            try:
                task = self.input_queue.get(timeout=0.1)
                if task is None:
                    continue
                
                start_time = time.time()
                
                try:
                    result = self.processor(task)
                    if result and self.output_queue:
                        self.output_queue.put(result)
                except Exception as e:
                    logger.error(f"Error in {self.stage.value}: {e}")
                    task.retry_count += 1
                    if task.retry_count < task.max_retries:
                        self.input_queue.put(task)
                    else:
                        logger.error(f"Task {task.task_id} failed after {task.max_retries} retries")
                
                processing_time = time.time() - start_time
                with self._lock:
                    self.processed_count += 1
                    self.total_time += processing_time
                
                self.input_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Worker error in {self.stage.value}: {e}")
    
    def get_stats(self) -> Dict:
        with self._lock:
            avg_time = self.total_time / max(1, self.processed_count)
            return {
                'stage': self.stage.value,
                'processed_count': self.processed_count,
                'avg_time_ms': avg_time * 1000,
                'queue_size': self.input_queue.qsize(),
            }


class InferencePipeline:
    """推理流水线 - 重构后的核心推理引擎"""
    
    def __init__(self, model, max_queue_size: int = 100,
                 preprocess_workers: int = 2, inference_workers: int = 2,
                 postprocess_workers: int = 2):
        self.model = model
        self.max_queue_size = max_queue_size
        
        self.preprocess_queue = queue.Queue(max_queue_size)
        self.inference_queue = queue.Queue(max_queue_size)
        self.postprocess_queue = queue.Queue(max_queue_size)
        self.result_queue = queue.Queue(max_queue_size)
        
        self._results: Dict[str, Dict] = {}
        self._callbacks: List[Callable] = []
        
        self.preprocess_worker = StageWorker(
            PipelineStage.PREPROCESSING,
            self.preprocess_queue,
            self.inference_queue,
            self._preprocess_func,
            preprocess_workers
        )
        
        self.inference_worker = StageWorker(
            PipelineStage.INFERENCE,
            self.inference_queue,
            self.postprocess_queue,
            self._inference_func,
            inference_workers
        )
        
        self.postprocess_worker = StageWorker(
            PipelineStage.POSTPROCESSING,
            self.postprocess_queue,
            self.result_queue,
            self._postprocess_func,
            postprocess_workers
        )
        
        self.result_handler_thread = threading.Thread(target=self._result_handler_loop, daemon=True)
        
        self._lock = threading.Lock()
        self._total_submitted = 0
        self._total_completed = 0
        self._total_failed = 0
        self._start_time = time.time()
        self._latency_samples = deque(maxlen=1000)
        
        self._running = False
    
    def _preprocess_func(self, task: InferenceTask) -> InferenceTask:
        """预处理函数"""
        image = task.image
        
        if len(image.shape) == 4:
            pass
        elif len(image.shape) == 2:
            image = np.stack([image] * 3, axis=-1)
        elif len(image.shape) == 3 and image.shape[-1] == 1:
            image = np.concatenate([image] * 3, axis=-1)
        
        target_size = (64, 64)
        if image.shape[:2] != target_size:
            image = self._resize_image(image, target_size)
        
        if image.dtype != np.float32:
            image = image.astype(np.float32)
        
        if image.max() > 1.0:
            image = image / 255.0
        
        task.preprocessed_data = image
        task.stage = PipelineStage.INFERENCE
        return task
    
    def _resize_image(self, image: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
        """简单的图像缩放实现"""
        h, w = image.shape[:2]
        th, tw = target_size
        
        scale_h = th / h
        scale_w = tw / w
        
        y_indices = np.floor(np.arange(th) / scale_h).astype(np.int32)
        x_indices = np.floor(np.arange(tw) / scale_w).astype(np.int32)
        
        y_indices = np.clip(y_indices, 0, h - 1)
        x_indices = np.clip(x_indices, 0, w - 1)
        
        resized = image[y_indices][:, x_indices]
        return resized
    
    def _inference_func(self, task: InferenceTask) -> InferenceTask:
        """推理函数"""
        try:
            result = self.model.predict(task.preprocessed_data)
            task.inference_result = {
                'class': result[0] if isinstance(result, tuple) else result,
                'confidence': result[1] if isinstance(result, tuple) and len(result) > 1 else 0.0,
                'raw_output': result,
            }
            task.stage = PipelineStage.POSTPROCESSING
        except Exception as e:
            logger.error(f"Inference error: {e}")
            task.inference_result = {'error': str(e)}
            raise
        return task
    
    def _postprocess_func(self, task: InferenceTask) -> InferenceTask:
        """后处理函数"""
        result = task.inference_result or {}
        
        if 'error' not in result:
            confidence = result.get('confidence', 0.0)
            pred_class = result.get('class')
            
            if isinstance(confidence, np.ndarray):
                confidence = float(confidence.max() if confidence.size > 0 else 0.0)
            
            threshold = task.metadata.get('threshold', 0.5)
            is_valid = confidence >= threshold
            
            task.final_result = {
                'task_id': task.task_id,
                'prediction': pred_class,
                'confidence': float(confidence),
                'threshold_passed': is_valid,
                'processing_time': time.time() - task.timestamp,
                'metadata': task.metadata,
                'timestamp': time.time(),
            }
        else:
            task.final_result = {
                'task_id': task.task_id,
                'error': result['error'],
                'processing_time': time.time() - task.timestamp,
            }
        
        task.stage = PipelineStage.AGGREGATION
        return task
    
    def _result_handler_loop(self):
        """结果处理循环"""
        while self._running:
            try:
                task = self.result_queue.get(timeout=0.1)
                if task is None:
                    continue
                
                with self._lock:
                    self._total_completed += 1
                    self._results[task.task_id] = task.final_result
                    self._latency_samples.append(
                        time.time() - task.timestamp
                    )
                
                if task.callback:
                    try:
                        task.callback(task.final_result)
                    except Exception as e:
                        logger.error(f"Callback error: {e}")
                
                for callback in self._callbacks:
                    try:
                        callback(task.final_result)
                    except Exception as e:
                        logger.error(f"Global callback error: {e}")
                
                self.result_queue.task_done()
            except queue.Empty:
                continue
    
    def start(self):
        """启动流水线"""
        if self._running:
            return
        
        self._running = True
        self._start_time = time.time()
        
        self.preprocess_worker.start()
        self.inference_worker.start()
        self.postprocess_worker.start()
        self.result_handler_thread.start()
        
        logger.info("Inference pipeline started")
    
    def stop(self):
        """停止流水线"""
        self._running = False
        
        self.preprocess_worker.running = False
        self.inference_worker.running = False
        self.postprocess_worker.running = False
        
        logger.info("Inference pipeline stopped")
    
    def submit(self, image: np.ndarray, callback: Optional[Callable] = None,
               metadata: Optional[Dict] = None, priority: TaskPriority = TaskPriority.MEDIUM) -> str:
        """提交推理任务"""
        import uuid
        task_id = str(uuid.uuid4())
        
        task = InferenceTask(
            task_id=task_id,
            image=image,
            priority=priority,
            callback=callback,
            metadata=metadata or {},
        )
        
        self.preprocess_queue.put(task)
        
        with self._lock:
            self._total_submitted += 1
        
        return task_id
    
    def submit_batch(self, images: List[np.ndarray],
                     callback: Optional[Callable] = None,
                     metadata: Optional[Dict] = None) -> List[str]:
        """批量提交任务"""
        return [
            self.submit(img, callback, metadata)
            for img in images
        ]
    
    def get_result(self, task_id: str, timeout: float = 5.0) -> Optional[Dict]:
        """获取任务结果"""
        start = time.time()
        while time.time() - start < timeout:
            with self._lock:
                if task_id in self._results:
                    return self._results.pop(task_id)
            time.sleep(0.01)
        return None
    
    def add_result_callback(self, callback: Callable):
        """添加全局结果回调"""
        self._callbacks.append(callback)
    
    def get_stats(self) -> PipelineStats:
        """获取流水线统计"""
        with self._lock:
            elapsed = time.time() - self._start_time
            avg_latency = (sum(self._latency_samples) / len(self._latency_samples) * 1000) if self._latency_samples else 0
            throughput = self._total_completed / max(elapsed, 0.001)
        
        stats = PipelineStats(
            total_tasks=self._total_submitted,
            completed_tasks=self._total_completed,
            failed_tasks=self._total_failed,
            avg_latency_ms=avg_latency,
            throughput_per_sec=throughput,
        )
        
        stats.stage_times.update(self.preprocess_worker.get_stats())
        stats.stage_times.update(self.inference_worker.get_stats())
        stats.stage_times.update(self.postprocess_worker.get_stats())
        
        stats.queue_sizes = {
            'preprocess': self.preprocess_queue.qsize(),
            'inference': self.inference_queue.qsize(),
            'postprocess': self.postprocess_queue.qsize(),
            'result': self.result_queue.qsize(),
        }
        
        return stats
    
    def wait_for_completion(self, timeout: Optional[float] = None):
        """等待所有任务完成"""
        self.preprocess_queue.join()
        self.inference_queue.join()
        self.postprocess_queue.join()
        self.result_queue.join()


class BatchInferenceOptimizer:
    """批处理优化器"""
    
    def __init__(self, model, max_batch_size: int = 16, max_wait_time: float = 0.1):
        self.model = model
        self.max_batch_size = max_batch_size
        self.max_wait_time = max_wait_time
        
        self._batch_buffer: List[Tuple[np.ndarray, Callable]] = []
        self._buffer_lock = threading.Lock()
        self._last_flush = time.time()
        self._flush_thread: Optional[threading.Thread] = None
        self._running = False
    
    def start(self):
        """启动批处理优化器"""
        self._running = True
        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()
    
    def stop(self):
        """停止批处理优化器"""
        self._running = False
        if self._flush_thread:
            self._flush_thread.join(timeout=1.0)
    
    def submit(self, image: np.ndarray, callback: Callable):
        """提交单个图像进行批处理"""
        with self._buffer_lock:
            self._batch_buffer.append((image, callback))
            
            if len(self._batch_buffer) >= self.max_batch_size:
                self._flush_batch()
    
    def _flush_loop(self):
        """定时刷新循环"""
        while self._running:
            time.sleep(self.max_wait_time / 2)
            
            with self._buffer_lock:
                now = time.time()
                if now - self._last_flush >= self.max_wait_time and self._batch_buffer:
                    self._flush_batch()
    
    def _flush_batch(self):
        """刷新当前批次"""
        if not self._batch_buffer:
            return
        
        images = [item[0] for item in self._batch_buffer]
        callbacks = [item[1] for item in self._batch_buffer]
        
        try:
            batch_input = np.stack(images, axis=0)
            batch_results = self._batch_predict(batch_input)
            
            for result, callback in zip(batch_results, callbacks):
                try:
                    callback(result)
                except Exception as e:
                    logger.error(f"Batch callback error: {e}")
        except Exception as e:
            logger.error(f"Batch inference error: {e}")
        
        self._batch_buffer.clear()
        self._last_flush = time.time()
    
    def _batch_predict(self, batch_input: np.ndarray) -> List[Dict]:
        """批量预测"""
        results = []
        for i in range(len(batch_input)):
            single_result = self.model.predict(batch_input[i])
            results.append({
                'batch_index': i,
                'prediction': single_result[0] if isinstance(single_result, tuple) else single_result,
                'confidence': single_result[1] if isinstance(single_result, tuple) and len(single_result) > 1 else 0.0,
            })
        return results


class DynamicBatcher:
    """动态批处理器 - 根据负载自动调整批次大小"""
    
    def __init__(self, model, initial_batch_size: int = 8,
                 max_batch_size: int = 32, min_batch_size: int = 1,
                 target_latency_ms: float = 100.0):
        self.model = model
        self.batch_size = initial_batch_size
        self.max_batch_size = max_batch_size
        self.min_batch_size = min_batch_size
        self.target_latency_ms = target_latency_ms
        
        self._latency_history: deque = deque(maxlen=50)
        self._adjustment_count = 0
    
    def predict_batch(self, images: List[np.ndarray]) -> List[Dict]:
        """批量预测并自动调整批次大小"""
        start_time = time.time()
        
        results = []
        for i in range(0, len(images), self.batch_size):
            batch = images[i:i + self.batch_size]
            batch_input = np.stack(batch, axis=0)
            
            batch_start = time.time()
            batch_results = [
                self.model.predict(batch_input[j])
                for j in range(len(batch_input))
            ]
            batch_time = (time.time() - batch_start) * 1000 / len(batch)
            self._latency_history.append(batch_time)
            
            results.extend([
                {
                    'prediction': r[0] if isinstance(r, tuple) else r,
                    'confidence': r[1] if isinstance(r, tuple) and len(r) > 1 else 0.0,
                }
                for r in batch_results
            ])
        
        self._adjust_batch_size()
        return results
    
    def _adjust_batch_size(self):
        """根据延迟调整批次大小"""
        if len(self._latency_history) < 10:
            return
        
        avg_latency = sum(self._latency_history) / len(self._latency_history)
        
        if avg_latency < self.target_latency_ms * 0.7:
            self.batch_size = min(self.max_batch_size, int(self.batch_size * 1.2))
        elif avg_latency > self.target_latency_ms * 1.3:
            self.batch_size = max(self.min_batch_size, int(self.batch_size * 0.8))
        
        self._adjustment_count += 1
    
    def get_stats(self) -> Dict:
        avg_latency = sum(self._latency_history) / len(self._latency_history) if self._latency_history else 0
        return {
            'current_batch_size': self.batch_size,
            'avg_latency_ms': avg_latency,
            'adjustment_count': self._adjustment_count,
            'target_latency_ms': self.target_latency_ms,
        }
