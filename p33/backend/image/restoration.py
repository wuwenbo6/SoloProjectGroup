from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import cv2
import numpy as np
import base64
from typing import Optional
import io
from PIL import Image
from skimage import restoration as sk_restoration

router = APIRouter()


class RestorationParams(BaseModel):
    scratch_removal: bool = True
    scratch_radius: int = 3
    noise_reduction: bool = True
    noise_strength: int = 50
    fade_correction: bool = True
    color_enhance: float = 1.2
    contrast_enhance: float = 1.1
    sharpen: bool = True
    sharpen_amount: float = 1.0


class ImageProcessor:
    @staticmethod
    def base64_to_image(b64_string: str) -> np.ndarray:
        try:
            img_data = base64.b64decode(b64_string)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"图像解码失败: {str(e)}")

    @staticmethod
    def image_to_base64(image: np.ndarray) -> str:
        _, buffer = cv2.imencode('.png', image)
        return base64.b64encode(buffer).decode()

    @staticmethod
    def remove_scratches(image: np.ndarray, radius: int = 3) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        kernel = np.ones((radius, radius), np.uint8)
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        
        _, mask = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)
        
        result = cv2.inpaint(image, mask, 3, cv2.INPAINT_TELEA)
        
        return result

    @staticmethod
    def reduce_noise(image: np.ndarray, strength: int = 50) -> np.ndarray:
        h = strength / 10
        result = cv2.fastNlMeansDenoisingColored(image, None, h, h, 7, 21)
        return result

    @staticmethod
    def correct_fading(image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        l = cv2.normalize(l, None, 0, 255, cv2.NORM_MINMAX)
        
        lab = cv2.merge((l, a, b))
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        return result

    @staticmethod
    def enhance_color(image: np.ndarray, factor: float = 1.2) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        
        s = np.clip(s * factor, 0, 255).astype(np.uint8)
        
        hsv = cv2.merge((h, s, v))
        result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        return result

    @staticmethod
    def enhance_contrast(image: np.ndarray, factor: float = 1.1) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        mean = np.mean(l)
        l = np.clip((l - mean) * factor + mean, 0, 255).astype(np.uint8)
        
        lab = cv2.merge((l, a, b))
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        return result

    @staticmethod
    def apply_sharpen(image: np.ndarray, amount: float = 1.0) -> np.ndarray:
        kernel = np.array([
            [-1, -1, -1],
            [-1,  9, -1],
            [-1, -1, -1]
        ]) * amount
        
        result = cv2.filter2D(image, -1, kernel)
        return np.clip(result, 0, 255).astype(np.uint8)

    @staticmethod
    def process_image(image: np.ndarray, params: RestorationParams) -> tuple:
        steps = {}
        result = image.copy()
        
        steps['original'] = image.copy()
        
        if params.scratch_removal:
            result = ImageProcessor.remove_scratches(result, params.scratch_radius)
            steps['after_scratch'] = result.copy()
        
        if params.noise_reduction:
            result = ImageProcessor.reduce_noise(result, params.noise_strength)
            steps['after_denoise'] = result.copy()
        
        if params.fade_correction:
            result = ImageProcessor.correct_fading(result)
            steps['after_fade'] = result.copy()
        
        result = ImageProcessor.enhance_color(result, params.color_enhance)
        result = ImageProcessor.enhance_contrast(result, params.contrast_enhance)
        
        if params.sharpen:
            result = ImageProcessor.apply_sharpen(result, params.sharpen_amount)
        
        steps['final'] = result
        
        return result, steps


processor = ImageProcessor()


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="无法解析图像文件")
        
        height, width = img.shape[:2]
        img_base64 = processor.image_to_base64(img)
        
        return {
            "filename": file.filename,
            "width": width,
            "height": height,
            "image": img_base64
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/process")
async def process_image(image_base64: str, params: RestorationParams):
    try:
        image = processor.base64_to_image(image_base64)
        result, steps = processor.process_image(image, params)
        
        result_base64 = processor.image_to_base64(result)
        steps_base64 = {k: processor.image_to_base64(v) for k, v in steps.items()}
        
        return {
            "result": result_base64,
            "steps": steps_base64,
            "params_applied": params.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/quick-restore")
async def quick_restore(image_base64: str):
    params = RestorationParams(
        scratch_removal=True,
        scratch_radius=3,
        noise_reduction=True,
        noise_strength=50,
        fade_correction=True,
        color_enhance=1.2,
        contrast_enhance=1.1,
        sharpen=True,
        sharpen_amount=1.0
    )
    return await process_image(image_base64, params)


@router.post("/remove-scratches")
async def api_remove_scratches(image_base64: str, radius: int = 3):
    try:
        image = processor.base64_to_image(image_base64)
        result = processor.remove_scratches(image, radius)
        return {"result": processor.image_to_base64(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"划痕修复失败: {str(e)}")


@router.post("/reduce-noise")
async def api_reduce_noise(image_base64: str, strength: int = 50):
    try:
        image = processor.base64_to_image(image_base64)
        result = processor.reduce_noise(image, strength)
        return {"result": processor.image_to_base64(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"降噪失败: {str(e)}")


@router.post("/correct-fading")
async def api_correct_fading(image_base64: str):
    try:
        image = processor.base64_to_image(image_base64)
        result = processor.correct_fading(image)
        return {"result": processor.image_to_base64(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"褪色校正失败: {str(e)}")


@router.post("/compare")
async def compare_images(
    original_base64: str,
    processed_base64: str
):
    try:
        original = processor.base64_to_image(original_base64)
        processed = processor.base64_to_image(processed_base64)
        
        diff = cv2.absdiff(original, processed)
        diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, diff_thresh = cv2.threshold(diff_gray, 20, 255, cv2.THRESH_BINARY)
        
        changed_pixels = np.count_nonzero(diff_thresh)
        total_pixels = diff_thresh.size
        change_percentage = (changed_pixels / total_pixels) * 100
        
        return {
            "change_percentage": change_percentage,
            "changed_pixels": changed_pixels,
            "diff_image": processor.image_to_base64(diff)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"比较失败: {str(e)}")
