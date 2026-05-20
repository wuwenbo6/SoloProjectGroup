from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import base64
import os
import logging
from datetime import datetime
from collections import deque

router = APIRouter()
logger = logging.getLogger(__name__)


class CropParams(BaseModel):
    method: str = "auto"
    margin: int = 20
    aspect_ratio: Optional[float] = None
    threshold: int = 30


class StitchParams(BaseModel):
    blend_strength: float = 0.5
    try_use_gpu: bool = False
    crop_result: bool = True


class WatermarkParams(BaseModel):
    text: str = ""
    image_base64: Optional[str] = None
    position: str = "bottom-right"
    opacity: float = 0.3
    scale: float = 0.2
    font_size: int = 32
    color: str = "#FFFFFF"


class FilmTypeRecognitionResult(BaseModel):
    film_type: str
    confidence: float
    characteristics: dict


class ImageProcessor:
    def __init__(self):
        self.cache = {}
        self.max_cache_size = 50

    def _resize_for_processing(self, image: np.ndarray, max_dim: int = 1000) -> Tuple[np.ndarray, float]:
        h, w = image.shape[:2]
        scale = min(max_dim / max(h, w), 1.0)
        if scale < 1.0:
            new_h, new_w = int(h * scale), int(w * scale)
            return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA), scale
        return image, 1.0

    def auto_crop(self, image: np.ndarray, margin: int = 20, threshold: int = 30) -> np.ndarray:
        logger.info("Starting auto crop")
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, threshold, threshold * 2)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            logger.warning("No contours found, returning original image")
            return image
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        x = max(0, x - margin)
        y = max(0, y - margin)
        w = min(image.shape[1] - x, w + 2 * margin)
        h = min(image.shape[0] - y, h + 2 * margin)
        logger.info(f"Crop bounds: x={x}, y={y}, w={w}, h={h}")
        return image[y:y+h, x:x+w]

    def content_aware_crop(self, image: np.ndarray, aspect_ratio: Optional[float] = None) -> np.ndarray:
        logger.info(f"Content aware crop with aspect ratio: {aspect_ratio}")
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
        success, saliency_map = saliency.computeSaliency(gray)
        if not success:
            return self.auto_crop(image)
        saliency_map = (saliency_map * 255).astype("uint8")
        _, binary = cv2.threshold(saliency_map, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        coords = cv2.findNonZero(binary)
        if coords is None:
            return self.auto_crop(image)
        x, y, w, h = cv2.boundingRect(coords)
        center_x = x + w // 2
        center_y = y + h // 2
        if aspect_ratio:
            target_w = int(np.sqrt(aspect_ratio * w * h))
            target_h = int(target_w / aspect_ratio)
        else:
            target_w, target_h = w, h
        x = max(0, center_x - target_w // 2)
        y = max(0, center_y - target_h // 2)
        if x + target_w > image.shape[1]:
            x = max(0, image.shape[1] - target_w)
        if y + target_h > image.shape[0]:
            y = max(0, image.shape[0] - target_h)
        return image[y:y+target_h, x:x+target_w]

    def stitch_images(self, images: List[np.ndarray], blend_strength: float = 0.5, try_use_gpu: bool = False) -> Optional[np.ndarray]:
        logger.info(f"Stitching {len(images)} images")
        if len(images) < 2:
            return images[0] if images else None
        use_cuda = try_use_gpu and cv2.cuda.getCudaEnabledDeviceCount() > 0
        if use_cuda:
            logger.info("Using GPU acceleration for stitching")
        stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
        if use_cuda:
            try:
                stitcher.setFeaturesFinder(cv2.xfeatures2d.SURF_create())
            except:
                pass
        status, stitched = stitcher.stitch(images)
        if status != cv2.Stitcher_OK:
            logger.warning(f"Stitching failed with status {status}, trying alternative method")
            return self._simple_stitch(images, blend_strength)
        return self._remove_black_borders(stitched)

    def _simple_stitch(self, images: List[np.ndarray], blend_strength: float = 0.5) -> np.ndarray:
        logger.info("Using simple stitching method")
        if len(images) == 2:
            h1, w1 = images[0].shape[:2]
            h2, w2 = images[1].shape[:2]
            orb = cv2.ORB_create(5000)
            kp1, des1 = orb.detectAndCompute(images[0], None)
            kp2, des2 = orb.detectAndCompute(images[1], None)
            if des1 is None or des2 is None:
                return np.hstack([images[0], images[1]])
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            matches = bf.match(des1, des2)
            if len(matches) < 10:
                return np.hstack([images[0], images[1]])
            matches = sorted(matches, key=lambda x: x.distance)[:50]
            src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
            dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
            M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
            if M is None:
                return np.hstack([images[0], images[1]])
            result = cv2.warpPerspective(images[0], M, (w1 + w2, max(h1, h2)))
            result[0:h2, 0:w2] = images[1]
            return result
        return np.hstack(images)

    def _remove_black_borders(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        _, binary = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            return image[y:y+h, x:x+w]
        return image

    def add_text_watermark(self, image: np.ndarray, text: str, position: str = "bottom-right", opacity: float = 0.3, font_size: int = 32, color: str = "#FFFFFF") -> np.ndarray:
        logger.info(f"Adding text watermark: {text}, position: {position}")
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb).convert("RGBA")
        txt = Image.new("RGBA", pil_img.size, (255, 255, 255, 0))
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            font = ImageFont.load_default()
        draw = ImageDraw.Draw(txt)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        pos_map = {
            "top-left": (10, 10),
            "top-center": ((pil_img.width - text_w) // 2, 10),
            "top-right": (pil_img.width - text_w - 10, 10),
            "center-left": (10, (pil_img.height - text_h) // 2),
            "center": ((pil_img.width - text_w) // 2, (pil_img.height - text_h) // 2),
            "center-right": (pil_img.width - text_w - 10, (pil_img.height - text_h) // 2),
            "bottom-left": (10, pil_img.height - text_h - 10),
            "bottom-center": ((pil_img.width - text_w) // 2, pil_img.height - text_h - 10),
            "bottom-right": (pil_img.width - text_w - 10, pil_img.height - text_h - 10),
        }
        x, y = pos_map.get(position, pos_map["bottom-right"])
        r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
        draw.text((x, y), text, font=font, fill=(r, g, b, int(255 * opacity)))
        combined = Image.alpha_composite(pil_img, txt)
        result = cv2.cvtColor(np.array(combined.convert("RGB")), cv2.COLOR_RGB2BGR)
        return result

    def add_image_watermark(self, image: np.ndarray, watermark: np.ndarray, position: str = "bottom-right", opacity: float = 0.3, scale: float = 0.2) -> np.ndarray:
        logger.info(f"Adding image watermark, position: {position}, scale: {scale}")
        h, w = image.shape[:2]
        wm_h, wm_w = watermark.shape[:2]
        new_wm_w = int(w * scale)
        new_wm_h = int(wm_h * new_wm_w / wm_w)
        watermark_resized = cv2.resize(watermark, (new_wm_w, new_wm_h), interpolation=cv2.INTER_AREA)
        pos_map = {
            "top-left": (10, 10),
            "top-center": ((w - new_wm_w) // 2, 10),
            "top-right": (w - new_wm_w - 10, 10),
            "center-left": (10, (h - new_wm_h) // 2),
            "center": ((w - new_wm_w) // 2, (h - new_wm_h) // 2),
            "center-right": (w - new_wm_w - 10, (h - new_wm_h) // 2),
            "bottom-left": (10, h - new_wm_h - 10),
            "bottom-center": ((w - new_wm_w) // 2, h - new_wm_h - 10),
            "bottom-right": (w - new_wm_w - 10, h - new_wm_h - 10),
        }
        x, y = pos_map.get(position, pos_map["bottom-right"])
        if len(watermark_resized.shape) == 2:
            watermark_rgb = cv2.cvtColor(watermark_resized, cv2.COLOR_GRAY2BGR)
        else:
            watermark_rgb = watermark_resized
        roi = image[y:y+new_wm_h, x:x+new_wm_w]
        if roi.shape[:2] != watermark_rgb.shape[:2]:
            watermark_rgb = cv2.resize(watermark_rgb, (roi.shape[1], roi.shape[0]))
        blended = cv2.addWeighted(roi, 1 - opacity, watermark_rgb, opacity, 0)
        result = image.copy()
        result[y:y+new_wm_h, x:x+new_wm_w] = blended
        return result

    def recognize_film_type(self, image: np.ndarray) -> FilmTypeRecognitionResult:
        logger.info("Starting film type recognition")
        features = self._extract_film_features(image)
        film_type, confidence = self._classify_film_type(features)
        return FilmTypeRecognitionResult(film_type=film_type, confidence=confidence, characteristics=features)

    def _extract_film_features(self, image: np.ndarray) -> dict:
        small_img, _ = self._resize_for_processing(image, 500)
        lab = cv2.cvtColor(small_img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        hsv = cv2.cvtColor(small_img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        gray = cv2.cvtColor(small_img, cv2.COLOR_BGR2GRAY)
        features = {
            "brightness_mean": float(np.mean(l)),
            "brightness_std": float(np.std(l)),
            "contrast": float(np.std(gray)),
            "saturation_mean": float(np.mean(s)),
            "warmth_index": float(np.mean(a) - np.mean(b)),
            "grain_noise": self._estimate_grain(gray),
            "dynamic_range": int(np.max(gray) - np.min(gray)),
            "color_cast_score": self._detect_color_cast(small_img),
            "edge_density": self._calculate_edge_density(gray),
            "tone_distribution": self._analyze_tone_distribution(gray)
        }
        logger.info(f"Extracted features: {features}")
        return features

    def _estimate_grain(self, gray: np.ndarray) -> float:
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        grain = np.mean(np.abs(laplacian))
        return float(grain)

    def _detect_color_cast(self, image: np.ndarray) -> float:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        a_mean, b_mean = np.mean(a), np.mean(b)
        return float(np.sqrt(a_mean**2 + b_mean**2))

    def _calculate_edge_density(self, gray: np.ndarray) -> float:
        edges = cv2.Canny(gray, 50, 150)
        edge_pixels = np.sum(edges > 0)
        total_pixels = gray.shape[0] * gray.shape[1]
        return float(edge_pixels / total_pixels)

    def _analyze_tone_distribution(self, gray: np.ndarray) -> str:
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist.flatten()
        low = np.sum(hist[:85]) / np.sum(hist)
        mid = np.sum(hist[85:170]) / np.sum(hist)
        high = np.sum(hist[170:]) / np.sum(hist)
        if low > 0.5:
            return "low_key"
        elif high > 0.5:
            return "high_key"
        elif mid > 0.6:
            return "balanced"
        else:
            return "contrasty"

    def _classify_film_type(self, features: dict) -> Tuple[str, float]:
        film_profiles = {
            "柯达Gold 200": {
                "brightness_mean": (140, 170),
                "saturation_mean": (130, 160),
                "warmth_index": (5, 20),
                "grain_noise": (8, 15),
                "color_cast_score": (5, 20)
            },
            "富士Provia 100F": {
                "brightness_mean": (130, 160),
                "saturation_mean": (140, 170),
                "warmth_index": (-10, 5),
                "grain_noise": (5, 10),
                "color_cast_score": (0, 15)
            },
            "伊尔福HP5": {
                "brightness_mean": (110, 150),
                "saturation_mean": (40, 80),
                "warmth_index": (-5, 5),
                "grain_noise": (15, 25),
                "color_cast_score": (0, 10)
            },
            "柯达Portra 400": {
                "brightness_mean": (120, 155),
                "saturation_mean": (100, 140),
                "warmth_index": (10, 25),
                "grain_noise": (10, 18),
                "color_cast_score": (10, 25)
            },
            "富士Velvia 50": {
                "brightness_mean": (100, 140),
                "saturation_mean": (160, 200),
                "warmth_index": (-5, 10),
                "grain_noise": (3, 8),
                "color_cast_score": (5, 15)
            },
            "普通彩色胶片": {
                "brightness_mean": (90, 180),
                "saturation_mean": (80, 180),
                "warmth_index": (-20, 30),
                "grain_noise": (5, 30),
                "color_cast_score": (5, 40)
            }
        }
        best_match = "未知胶片类型"
        best_score = 0
        for film_name, profile in film_profiles.items():
            score = 0
            total_weights = 0
            weights = {
                "brightness_mean": 0.2,
                "saturation_mean": 0.25,
                "warmth_index": 0.2,
                "grain_noise": 0.2,
                "color_cast_score": 0.15
            }
            for feature_name, (min_val, max_val) in profile.items():
                weight = weights.get(feature_name, 0.1)
                total_weights += weight
                value = features.get(feature_name, 0)
                if min_val <= value <= max_val:
                    score += weight
                else:
                    mid_point = (min_val + max_val) / 2
                    range_size = max_val - min_val
                    distance = abs(value - mid_point) / (range_size * 2) if range_size > 0 else 1
                    score += weight * max(0, 1 - distance)
            normalized_score = score / total_weights if total_weights > 0 else 0
            if normalized_score > best_score:
                best_score = normalized_score
                best_match = film_name
        logger.info(f"Best match: {best_match}, confidence: {best_score:.2f}")
        return best_match, float(best_score)


processor = ImageProcessor()


def _image_to_base64(image: np.ndarray) -> str:
    _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return base64.b64encode(buffer).decode()


def _base64_to_image(b64_string: str) -> np.ndarray:
    img_data = base64.b64decode(b64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


@router.post("/auto-crop")
async def api_auto_crop(image_base64: str, params: CropParams):
    try:
        image = _base64_to_image(image_base64)
        if params.method == "content-aware":
            result = processor.content_aware_crop(image, params.aspect_ratio)
        else:
            result = processor.auto_crop(image, params.margin, params.threshold)
        return {
            "original_size": {"width": image.shape[1], "height": image.shape[0]},
            "cropped_size": {"width": result.shape[1], "height": result.shape[0]},
            "result": _image_to_base64(result)
        }
    except Exception as e:
        logger.error(f"Auto crop error: {e}")
        raise HTTPException(status_code=500, detail=f"裁剪失败: {str(e)}")


@router.post("/stitch")
async def api_stitch_images(images_base64: List[str], params: StitchParams):
    try:
        images = [_base64_to_image(b64) for b64 in images_base64]
        if len(images) < 2:
            raise HTTPException(status_code=400, detail="至少需要2张图片进行拼接")
        result = processor.stitch_images(images, params.blend_strength, params.try_use_gpu)
        if result is None:
            raise HTTPException(status_code=500, detail="拼接失败")
        return {
            "stitched_size": {"width": result.shape[1], "height": result.shape[0]},
            "image_count": len(images),
            "result": _image_to_base64(result)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stitch error: {e}")
        raise HTTPException(status_code=500, detail=f"拼接失败: {str(e)}")


@router.post("/watermark/text")
async def api_text_watermark(image_base64: str, params: WatermarkParams):
    try:
        if not params.text:
            raise HTTPException(status_code=400, detail="水印文本不能为空")
        image = _base64_to_image(image_base64)
        result = processor.add_text_watermark(
            image, params.text, params.position,
            params.opacity, params.font_size, params.color
        )
        return {"result": _image_to_base64(result)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text watermark error: {e}")
        raise HTTPException(status_code=500, detail=f"添加文字水印失败: {str(e)}")


@router.post("/watermark/image")
async def api_image_watermark(image_base64: str, watermark_base64: str, params: WatermarkParams):
    try:
        image = _base64_to_image(image_base64)
        watermark = _base64_to_image(watermark_base64)
        result = processor.add_image_watermark(
            image, watermark, params.position,
            params.opacity, params.scale
        )
        return {"result": _image_to_base64(result)}
    except Exception as e:
        logger.error(f"Image watermark error: {e}")
        raise HTTPException(status_code=500, detail=f"添加图片水印失败: {str(e)}")


@router.post("/batch-watermark/text")
async def api_batch_text_watermark(images_base64: List[str], params: WatermarkParams, background_tasks: BackgroundTasks):
    try:
        if not params.text:
            raise HTTPException(status_code=400, detail="水印文本不能为空")
        results = []
        for i, b64 in enumerate(images_base64):
            image = _base64_to_image(b64)
            result = processor.add_text_watermark(
                image, params.text, params.position,
                params.opacity, params.font_size, params.color
            )
            results.append(_image_to_base64(result))
        return {"results": results, "count": len(results)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch watermark error: {e}")
        raise HTTPException(status_code=500, detail=f"批量水印添加失败: {str(e)}")


@router.post("/recognize-film-type")
async def api_recognize_film_type(image_base64: str):
    try:
        image = _base64_to_image(image_base64)
        result = processor.recognize_film_type(image)
        return {
            "film_type": result.film_type,
            "confidence": result.confidence,
            "characteristics": result.characteristics
        }
    except Exception as e:
        logger.error(f"Film recognition error: {e}")
        raise HTTPException(status_code=500, detail=f"胶片类型识别失败: {str(e)}")


@router.post("/enhance")
async def api_enhance_image(image_base64: str):
    try:
        image = _base64_to_image(image_base64)
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)
        lab_enhanced = cv2.merge((l_enhanced, a, b))
        result = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
        return {"result": _image_to_base64(result)}
    except Exception as e:
        logger.error(f"Enhance error: {e}")
        raise HTTPException(status_code=500, detail=f"图像增强失败: {str(e)}")
