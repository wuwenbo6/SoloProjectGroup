import gc
import numpy as np
from typing import Optional, Callable
from functools import wraps
import logging

logger = logging.getLogger(__name__)

class GPUMemoryManager:
    def __init__(self, max_memory_fraction: float = 0.7):
        self.max_memory_fraction = max_memory_fraction
        self.use_gpu = False
        self.device = "cpu"
        
        try:
            import torch
            if torch.cuda.is_available():
                self.use_gpu = True
                self.device = "cuda"
                total_memory = torch.cuda.get_device_properties(0).total_memory
                torch.cuda.set_per_process_memory_fraction(max_memory_fraction)
                logger.info(f"GPU内存限制设置为: {max_memory_fraction * 100}%")
                logger.info(f"总显存: {total_memory / 1024**3:.2f} GB")
        except Exception as e:
            logger.warning(f"GPU初始化失败，使用CPU: {e}")
    
    def clear_cache(self):
        if self.use_gpu:
            try:
                import torch
                torch.cuda.empty_cache()
            except:
                pass
        gc.collect()
    
    def get_memory_usage(self) -> dict:
        usage = {"device": self.device, "gpu_available": self.use_gpu}
        
        if self.use_gpu:
            try:
                import torch
                allocated = torch.cuda.memory_allocated(0) / 1024**3
                reserved = torch.cuda.memory_reserved(0) / 1024**3
                usage.update({
                    "allocated_gb": allocated,
                    "reserved_gb": reserved,
                    "free_gb": reserved - allocated
                })
            except:
                pass
        
        return usage
    
    def check_memory_safety(self, required_gb: float = 0.5) -> bool:
        if not self.use_gpu:
            return True
        
        try:
            import torch
            free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
            free_gb = free_memory / 1024**3
            return free_gb >= required_gb
        except:
            return True

def memory_aware_inference(max_batch_size: int = 8):
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            memory_manager = GPUMemoryManager()
            
            try:
                if not memory_manager.check_memory_safety():
                    logger.warning("显存不足，自动切换到CPU模式")
                    kwargs["force_cpu"] = True
                
                result = func(*args, **kwargs)
                return result
            except RuntimeError as e:
                if "out of memory" in str(e).lower() or "cuda" in str(e).lower():
                    logger.error(f"显存溢出，切换到CPU重试: {e}")
                    memory_manager.clear_cache()
                    kwargs["force_cpu"] = True
                    return func(*args, **kwargs)
                raise
            finally:
                memory_manager.clear_cache()
        
        return wrapper
    return decorator

class BatchProcessor:
    def __init__(self, max_batch_size: int = 4, max_memory_per_sample_mb: int = 100):
        self.max_batch_size = max_batch_size
        self.max_memory_per_sample_mb = max_memory_per_sample_mb
        self.memory_manager = GPUMemoryManager()
    
    def process_in_batches(self, items: list, process_func: Callable, **kwargs) -> list:
        if not items:
            return []
        
        batch_size = self._calculate_optimal_batch_size(len(items))
        logger.info(f"最优批处理大小: {batch_size}")
        
        results = []
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            
            try:
                batch_results = process_func(batch, **kwargs)
                results.extend(batch_results)
            except RuntimeError as e:
                if "out of memory" in str(e).lower():
                    logger.warning(f"批次大小 {batch_size} 内存不足，尝试减小")
                    batch_size = max(1, batch_size // 2)
                    for item in batch:
                        single_result = process_func([item], **kwargs)
                        results.extend(single_result)
                else:
                    raise
            
            self.memory_manager.clear_cache()
        
        return results
    
    def _calculate_optimal_batch_size(self, total_items: int) -> int:
        if not self.memory_manager.use_gpu:
            return min(self.max_batch_size, 2)
        
        try:
            import torch
            free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
            free_mb = free_memory / 1024**2
            
            max_possible = int(free_mb / self.max_memory_per_sample_mb)
            optimal = min(max_possible, self.max_batch_size, total_items)
            
            return max(1, optimal)
        except:
            return min(self.max_batch_size, 2)

class GradientAccumulator:
    def __init__(self, accumulation_steps: int = 4):
        self.accumulation_steps = accumulation_steps
        self.step_counter = 0
        self.loss_accumulator = 0.0
    
    def should_update(self) -> bool:
        self.step_counter += 1
        return self.step_counter >= self.accumulation_steps
    
    def accumulate_loss(self, loss: float):
        self.loss_accumulator += loss / self.accumulation_steps
    
    def reset(self):
        self.step_counter = 0
        self.loss_accumulator = 0.0
    
    def get_accumulated_loss(self) -> float:
        return self.loss_accumulator

def get_optimal_device(prefer_gpu: bool = True) -> str:
    if not prefer_gpu:
        return "cpu"
    
    try:
        import torch
        if torch.cuda.is_available():
            memory_manager = GPUMemoryManager()
            if memory_manager.check_memory_safety(1.0):
                return "cuda"
    except:
        pass
    
    return "cpu"
