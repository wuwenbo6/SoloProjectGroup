import gc
import os
import warnings
from typing import Optional

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import dlib
    DLIB_AVAILABLE = True
except ImportError:
    DLIB_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


class MemoryManager:
    _instance = None
    _video_count = 0
    _cleanup_threshold = 3

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def increment_video_count(cls):
        cls._video_count += 1

    @classmethod
    def should_force_cleanup(cls) -> bool:
        return cls._video_count % cls._cleanup_threshold == 0

    @classmethod
    def reset_counter(cls):
        cls._video_count = 0

    @staticmethod
    def clear_torch_cache():
        if TORCH_AVAILABLE:
            try:
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                if hasattr(torch, '_d'):
                    delattr(torch, '_d')
            except Exception as e:
                warnings.warn(f"PyTorch 缓存清理失败: {str(e)}")

    @staticmethod
    def clear_dlib_objects():
        if DLIB_AVAILABLE:
            try:
                dlib.hit_enter_to_continue()
                pass
            except Exception:
                pass

    @staticmethod
    def clear_cv2_objects():
        if CV2_AVAILABLE:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass

    @staticmethod
    def force_gc():
        gc.collect()

    @staticmethod
    def get_gpu_memory_info() -> dict:
        info = {
            'torch_available': TORCH_AVAILABLE,
            'cuda_available': False,
            'device_count': 0,
            'devices': []
        }

        if TORCH_AVAILABLE and torch.cuda.is_available():
            info['cuda_available'] = True
            info['device_count'] = torch.cuda.device_count()

            for i in range(info['device_count']):
                device_info = {
                    'device_id': i,
                    'name': torch.cuda.get_device_name(i),
                    'total_memory_mb': 0,
                    'allocated_memory_mb': 0,
                    'reserved_memory_mb': 0,
                    'free_memory_mb': 0
                }

                try:
                    device_info['total_memory_mb'] = torch.cuda.get_device_properties(i).total_memory / 1024 ** 2
                    device_info['allocated_memory_mb'] = torch.cuda.memory_allocated(i) / 1024 ** 2
                    device_info['reserved_memory_mb'] = torch.cuda.memory_reserved(i) / 1024 ** 2
                    device_info['free_memory_mb'] = device_info['total_memory_mb'] - device_info['reserved_memory_mb']
                except Exception:
                    pass

                info['devices'].append(device_info)

        return info

    @classmethod
    def full_cleanup(cls, force: bool = False):
        cls.force_gc()
        cls.clear_torch_cache()
        cls.clear_dlib_objects()
        cls.clear_cv2_objects()
        cls.force_gc()

        if force or cls.should_force_cleanup():
            if TORCH_AVAILABLE and torch.cuda.is_available():
                try:
                    torch.cuda.empty_cache()
                    torch.cuda.ipc_collect()
                    torch.cuda.reset_peak_memory_stats()
                except Exception as e:
                    warnings.warn(f"深度 CUDA 清理失败: {str(e)}")

    @classmethod
    def cleanup_after_video(cls):
        cls.increment_video_count()
        cls.full_cleanup()

    @staticmethod
    def clear_numpy_arrays(*arrays):
        for arr in arrays:
            try:
                if arr is not None:
                    del arr
            except Exception:
                pass


memory_manager = MemoryManager()
