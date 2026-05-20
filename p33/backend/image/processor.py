import gc
import io
import base64
from typing import Optional, Tuple, Dict, Any, List
from contextlib import contextmanager
import logging
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None

from ..utils.common import SingletonMeta, measure_time, performance_monitor
from ..utils.cache_manager import image_cache, thumbnail_cache, memory_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ImageResourceManager(metaclass=SingletonMeta):
    def __init__(self):
        self.active_images: Dict[int, Any] = {}
        self.active_arrays: Dict[int, np.ndarray] = {}

    @contextmanager
    def managed_array(self, arr: np.ndarray):
        arr_id = id(arr)
        self.active_arrays[arr_id] = arr
        try:
            yield arr
        finally:
            if arr_id in self.active_arrays:
                del self.active_arrays[arr_id]

    @contextmanager
    def managed_image(self, img: Any):
        img_id = id(img)
        self.active_images[img_id] = img
        try:
            yield img
        finally:
            if img_id in self.active_images:
                del self.active_images[img_id]

    def cleanup(self):
        self.active_arrays.clear()
        self.active_images.clear()
        gc.collect()


resource_manager = ImageResourceManager()


def numpy_to_base64(arr: np.ndarray, format: str = 'JPEG', quality: int = 85) -> str:
    if Image is None:
        raise ImportError("PIL 未安装")

    with resource_manager.managed_array(arr):
        if len(arr.shape) == 3 and arr.shape[2] == 3:
            arr = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB) if cv2 else arr

        img = Image.fromarray(arr)
        buffer = io.BytesIO()
        img.save(buffer, format=format, quality=quality)
        img.close()

        return base64.b64encode(buffer.getvalue()).decode()


def base64_to_numpy(b64_str: str) -> np.ndarray:
    if Image is None:
        raise ImportError("PIL 未安装")

    img_data = base64.b64decode(b64_str)
    buffer = io.BytesIO(img_data)
    img = Image.open(buffer)

    img_array = np.array(img)
    img.close()
    buffer.close()

    if len(img_array.shape) == 3 and img_array.shape[2] == 3:
        if cv2:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

    return img_array


class OptimizedImageProcessor(metaclass=SingletonMeta):
    def __init__(self):
        self.max_dimension = 8000
        self.thumbnail_size = 256
        self.jpeg_quality = 85

    def _check_and_resize(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        if max(h, w) <= self.max_dimension:
            return img

        scale = self.max_dimension / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)

        if cv2:
            return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return img

    @measure_time
    def auto_crop(self, img: np.ndarray, margin: int = 20) -> np.ndarray:
        if cv2 is None:
            return img

        with resource_manager.managed_array(img.copy()):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            _, thresh = cv2.threshold(blurred, 10, 255, cv2.THRESH_BINARY)

            contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            if not contours:
                return img

            max_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(max_contour)

            x = max(0, x - margin)
            y = max(0, y - margin)
            w = min(img.shape[1] - x, w + 2 * margin)
            h = min(img.shape[0] - y, h + 2 * margin)

            return img[y:y + h, x:x + w].copy()

    @measure_time
    def create_thumbnail(self, img: np.ndarray, size: int = None) -> np.ndarray:
        size = size or self.thumbnail_size

        h, w = img.shape[:2]
        scale = size / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)

        if cv2:
            thumb = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            thumb = img

        return thumb

    @measure_time
    def add_text_watermark(self, img: np.ndarray, text: str, position: str = 'bottom-right',
                           opacity: float = 0.3, font_size: int = 32) -> np.ndarray:
        if Image is None:
            return img

        if not text:
            return img

        h, w = img.shape[:2]

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) if cv2 and len(img.shape) == 3 else img
        pil_img = Image.fromarray(rgb_img).convert('RGBA')
        txt_img = Image.new('RGBA', pil_img.size, (255, 255, 255, 0))

        try:
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(txt_img)
            font = ImageFont.truetype('Arial.ttf', font_size)
        except:
            from PIL import ImageDraw
            draw = ImageDraw.Draw(txt_img)
            font = None

        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]

        positions = {
            'top-left': (10, 10),
            'top-center': ((w - text_w) // 2, 10),
            'top-right': (w - text_w - 10, 10),
            'center-left': (10, (h - text_h) // 2),
            'center': ((w - text_w) // 2, (h - text_h) // 2),
            'center-right': (w - text_w - 10, (h - text_h) // 2),
            'bottom-left': (10, h - text_h - 10),
            'bottom-center': ((w - text_w) // 2, h - text_h - 10),
            'bottom-right': (w - text_w - 10, h - text_h - 10)
        }

        x, y = positions.get(position, positions['bottom-right'])

        alpha = int(255 * opacity)
        draw.text((x, y), text, font=font, fill=(255, 255, 255, alpha))

        result = Image.alpha_composite(pil_img, txt_img)
        result_rgb = result.convert('RGB')

        result_array = np.array(result_rgb)
        if cv2 and len(result_array.shape) == 3:
            result_array = cv2.cvtColor(result_array, cv2.COLOR_RGB2BGR)

        pil_img.close()
        txt_img.close()
        result.close()
        result_rgb.close()

        return result_array

    @measure_time
    def adjust_color(self, img: np.ndarray, brightness: int = 0, contrast: float = 1.0,
                     saturation: float = 1.0, temperature: int = 0) -> np.ndarray:
        result = img.astype(np.float32)

        if brightness != 0:
            result = np.clip(result + brightness, 0, 255)

        if contrast != 1.0:
            result = np.clip(128 + (result - 128) * contrast, 0, 255)

        if saturation != 1.0 and len(result.shape) == 3:
            if cv2:
                hsv = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
                hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation, 0, 255)
                result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)

        if temperature != 0 and len(result.shape) == 3:
            temp_factor = temperature / 100.0
            if temp_factor > 0:
                result[:, :, 0] = np.clip(result[:, :, 0] - temp_factor * 30, 0, 255)
                result[:, :, 2] = np.clip(result[:, :, 2] + temp_factor * 20, 0, 255)
            else:
                result[:, :, 0] = np.clip(result[:, :, 0] - temp_factor * 20, 0, 255)
                result[:, :, 2] = np.clip(result[:, :, 2] + temp_factor * 30, 0, 255)

        return result.astype(np.uint8)

    def batch_process(self, images: List[np.ndarray], operation: str, **kwargs) -> List[np.ndarray]:
        results = []
        for img in images:
            try:
                if operation == 'thumbnail':
                    result = self.create_thumbnail(img, kwargs.get('size', 256))
                elif operation == 'auto_crop':
                    result = self.auto_crop(img, kwargs.get('margin', 20))
                elif operation == 'watermark':
                    result = self.add_text_watermark(img, kwargs.get('text', ''),
                                                     kwargs.get('position', 'bottom-right'),
                                                     kwargs.get('opacity', 0.3),
                                                     kwargs.get('font_size', 32))
                else:
                    result = img
                results.append(result)
            except Exception as e:
                logger.error(f"批量处理错误: {e}")
                results.append(img)

        gc.collect()
        return results


processor = OptimizedImageProcessor()


class ImageProcessingPipeline:
    def __init__(self):
        self.steps: List[Tuple[str, Dict[str, Any]]] = []

    def add_step(self, operation: str, **params):
        self.steps.append((operation, params))
        return self

    def process(self, img: np.ndarray, use_cache: bool = True) -> np.ndarray:
        cache_key = f"pipeline:{id(img)}:{str(self.steps)}"

        if use_cache:
            cached = memory_cache.get(cache_key)
            if cached is not None:
                return cached

        result = img
        for operation, params in self.steps:
            if operation == 'crop':
                result = processor.auto_crop(result, **params)
            elif operation == 'thumbnail':
                result = processor.create_thumbnail(result, **params)
            elif operation == 'watermark':
                result = processor.add_text_watermark(result, **params)
            elif operation == 'color':
                result = processor.adjust_color(result, **params)

        img_size = result.nbytes if hasattr(result, 'nbytes') else 0
        if use_cache and img_size < 10 * 1024 * 1024:
            memory_cache.set(cache_key, result, size=img_size, ttl=600)

        return result

    def reset(self):
        self.steps.clear()


def get_processing_stats() -> Dict[str, Any]:
    return {
        "performance": performance_monitor.get_stats(),
        "cache": memory_cache.get_stats(),
        "active_resources": {
            "images": len(resource_manager.active_images),
            "arrays": len(resource_manager.active_arrays)
        }
    }


def force_cleanup():
    resource_manager.cleanup()
    memory_cache.cleanup()
    gc.collect()
