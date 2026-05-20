import cv2
import numpy as np
from typing import Tuple, List
import json
import asyncio
from functools import partial
import hashlib
from scipy import stats

from app.core.config import settings


class YarnImageProcessor:
    def __init__(self):
        self.hairiness_threshold = settings.HAIRINESS_THRESHOLD
        self.breakage_threshold = settings.BREAKAGE_THRESHOLD
        self.thickness_std_threshold = settings.THICKNESS_STD_THRESHOLD
        self.density_threshold_low = settings.DENSITY_THRESHOLD_LOW
        self.density_threshold_high = settings.DENSITY_THRESHOLD_HIGH
        self.similarity_threshold = settings.FEATURE_SIMILARITY_THRESHOLD

    def _preprocess_image(self, image_path: str) -> np.ndarray:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")
        
        img = cv2.GaussianBlur(img, (3, 3), 0)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        img = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)
        
        _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return binary

    def _detect_yarn_region(self, binary: np.ndarray) -> Tuple[int, int, int, int]:
        rows, cols = binary.shape
        row_proj = np.sum(binary == 0, axis=1)
        
        yarn_rows = np.where(row_proj > 0)[0]
        if len(yarn_rows) == 0:
            return 0, rows, 0, cols
        
        top = max(0, yarn_rows[0] - 5)
        bottom = min(rows, yarn_rows[-1] + 5)
        
        col_proj = np.sum(binary[top:bottom, :] == 0, axis=0)
        yarn_cols = np.where(col_proj > 0)[0]
        
        if len(yarn_cols) == 0:
            return top, bottom, 0, cols
        
        left = max(0, yarn_cols[0] - 10)
        right = min(cols, yarn_cols[-1] + 10)
        
        return top, bottom, left, right

    def compute_image_hash(self, image_path: str) -> str:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return ""
        
        resized = cv2.resize(img, (64, 64))
        return hashlib.sha256(resized.tobytes()).hexdigest()

    def extract_feature_vector(self, image_path: str) -> List[float]:
        try:
            binary = self._preprocess_image(image_path)
            top, bottom, left, right = self._detect_yarn_region(binary)
            yarn_roi = binary[top:bottom, left:right]
            
            if yarn_roi.size == 0:
                return [0.0] * 128
            
            resized = cv2.resize(yarn_roi, (32, 32))
            
            features = []
            
            row_proj = np.sum(resized == 0, axis=1) / 32.0
            features.extend(row_proj.tolist())
            
            col_proj = np.sum(resized == 0, axis=0) / 32.0
            features.extend(col_proj.tolist())
            
            hist, _ = np.histogram(resized, bins=32, range=(0, 256))
            features.extend(hist.tolist()[:32])
            
            if len(features) < 128:
                features.extend([0.0] * (128 - len(features)))
            else:
                features = features[:128]
            
            return features
        except Exception as e:
            return [0.0] * 128

    def compute_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(v1, v2) / (norm1 * norm2))

    def detect_hairiness(self, image_path: str) -> Tuple[bool, float, str]:
        try:
            binary = self._preprocess_image(image_path)
            
            top, bottom, left, right = self._detect_yarn_region(binary)
            yarn_roi = binary[top:bottom, left:right]
            
            if yarn_roi.size == 0:
                return False, 0.0, json.dumps({"error": "未检测到纱线区域"})
            
            rows_roi, cols_roi = yarn_roi.shape
            
            kernel = np.ones((3, 3), np.uint8)
            dilated = cv2.dilate(yarn_roi, kernel, iterations=1)
            eroded = cv2.erode(yarn_roi, kernel, iterations=1)
            edge_mask = cv2.subtract(dilated, eroded)
            
            yarn_pixels = np.sum(yarn_roi == 0)
            if yarn_pixels == 0:
                return False, 0.0, json.dumps({"error": "纱线像素为0"})
            
            hairiness_pixels = np.sum(edge_mask > 0)
            hairiness_score = hairiness_pixels / yarn_pixels if yarn_pixels > 0 else 0
            
            details = {
                "edge_density": float(hairiness_score),
                "yarn_pixel_count": int(yarn_pixels),
                "hairiness_pixel_count": int(hairiness_pixels),
                "roi_size": [int(rows_roi), int(cols_roi)]
            }
            
            detected = hairiness_score > self.hairiness_threshold
            return detected, hairiness_score, json.dumps(details)
            
        except Exception as e:
            return False, 0.0, json.dumps({"error": str(e)})

    def detect_breakage(self, image_path: str) -> Tuple[bool, float, str]:
        try:
            binary = self._preprocess_image(image_path)
            
            top, bottom, left, right = self._detect_yarn_region(binary)
            yarn_roi = binary[top:bottom, left:right]
            
            if yarn_roi.size == 0:
                return False, 0.0, json.dumps({"error": "未检测到纱线区域"})
            
            row_projection = np.sum(yarn_roi == 0, axis=1)
            
            if np.sum(row_projection) == 0:
                return False, 0.0, json.dumps({"error": "未检测到纱线"})
            
            nonzero_rows = row_projection[row_projection > 0]
            if len(nonzero_rows) == 0:
                return False, 0.0, json.dumps({"error": "无有效纱线行"})
            
            yarn_mean = np.mean(nonzero_rows)
            threshold = yarn_mean * 0.15
            
            gaps = []
            current_gap = 0
            in_gap = False
            
            for i, val in enumerate(row_projection):
                if val < threshold:
                    current_gap += 1
                    in_gap = True
                else:
                    if in_gap and current_gap >= 3:
                        gaps.append(current_gap)
                    current_gap = 0
                    in_gap = False
            
            if in_gap and current_gap >= 3:
                gaps.append(current_gap)
            
            if gaps:
                max_gap = max(gaps)
                avg_gap = np.mean(gaps)
            else:
                max_gap = 0
                avg_gap = 0
            
            total_rows = len(row_projection)
            breakage_score = max_gap / total_rows if total_rows > 0 else 0
            
            details = {
                "max_gap_ratio": float(breakage_score),
                "max_gap_pixels": int(max_gap),
                "avg_gap_pixels": float(avg_gap),
                "gap_count": int(len(gaps)),
                "yarn_mean_width": float(yarn_mean),
                "threshold": float(threshold)
            }
            
            detected = breakage_score > self.breakage_threshold
            return detected, breakage_score, json.dumps(details)
            
        except Exception as e:
            return False, 0.0, json.dumps({"error": str(e)})

    def detect_thickness_abnormality(self, image_path: str) -> Tuple[bool, float, float, str]:
        try:
            binary = self._preprocess_image(image_path)
            
            top, bottom, left, right = self._detect_yarn_region(binary)
            yarn_roi = binary[top:bottom, left:right]
            
            if yarn_roi.size == 0:
                return False, 0.0, 0.0, json.dumps({"error": "未检测到纱线区域"})
            
            col_projection = np.sum(yarn_roi == 0, axis=0)
            
            nonzero_cols = col_projection[col_projection > 0]
            
            if len(nonzero_cols) < 10:
                return False, 0.0, 0.0, json.dumps({"error": "有效纱线数据不足"})
            
            window_size = max(3, int(len(nonzero_cols) * 0.05))
            kernel = np.ones(window_size) / window_size
            smoothed = np.convolve(nonzero_cols, kernel, mode='same')
            
            thickness_mean = np.mean(smoothed)
            thickness_std = np.std(smoothed)
            cv = thickness_std / thickness_mean if thickness_mean > 0 else 0
            
            q1 = np.percentile(smoothed, 25)
            q3 = np.percentile(smoothed, 75)
            iqr = q3 - q1
            
            details = {
                "thickness_cv": float(cv),
                "thickness_mean": float(thickness_mean),
                "thickness_std": float(thickness_std),
                "min_thickness": float(np.min(smoothed)),
                "max_thickness": float(np.max(smoothed)),
                "thickness_q1": float(q1),
                "thickness_q3": float(q3),
                "thickness_iqr": float(iqr),
                "valid_columns": int(len(nonzero_cols))
            }
            
            abnormal = cv > self.thickness_std_threshold
            return abnormal, thickness_mean, thickness_std, json.dumps(details)
            
        except Exception as e:
            return False, 0.0, 0.0, json.dumps({"error": str(e)})

    def detect_density(self, image_path: str) -> Tuple[bool, float, float, str]:
        try:
            binary = self._preprocess_image(image_path)
            
            top, bottom, left, right = self._detect_yarn_region(binary)
            yarn_roi = binary[top:bottom, left:right]
            
            if yarn_roi.size == 0:
                return False, 0.0, 0.0, json.dumps({"error": "未检测到纱线区域"})
            
            rows_roi, cols_roi = yarn_roi.shape
            
            col_projection = np.sum(yarn_roi == 0, axis=0)
            nonzero_cols = col_projection[col_projection > 0]
            
            if len(nonzero_cols) < 10:
                return False, 0.0, 0.0, json.dumps({"error": "有效纱线数据不足"})
            
            yarn_pixels = np.sum(yarn_roi == 0)
            total_roi_pixels = rows_roi * cols_roi
            
            density = yarn_pixels / total_roi_pixels if total_roi_pixels > 0 else 0
            
            density_per_col = nonzero_cols / rows_roi if rows_roi > 0 else 0
            density_std = float(np.std(density_per_col))
            
            baseline_density = 1.0
            normalized_density = density / baseline_density if baseline_density > 0 else 0
            
            abnormal = (normalized_density < self.density_threshold_low or 
                       normalized_density > self.density_threshold_high)
            
            details = {
                "density": float(density),
                "normalized_density": float(normalized_density),
                "density_std": float(density_std),
                "yarn_pixels": int(yarn_pixels),
                "roi_pixels": int(total_roi_pixels),
                "threshold_low": float(self.density_threshold_low),
                "threshold_high": float(self.density_threshold_high),
                "density_distribution": {
                    "q1": float(np.percentile(density_per_col, 25)),
                    "q2": float(np.percentile(density_per_col, 50)),
                    "q3": float(np.percentile(density_per_col, 75))
                }
            }
            
            return abnormal, density, density_std, json.dumps(details)
            
        except Exception as e:
            return False, 0.0, 0.0, json.dumps({"error": str(e)})

    def analyze_image(self, image_path: str) -> dict:
        hairiness_detected, hairiness_score, hairiness_details = self.detect_hairiness(image_path)
        breakage_detected, breakage_score, breakage_details = self.detect_breakage(image_path)
        thickness_abnormal, thickness_mean, thickness_std, thickness_details = self.detect_thickness_abnormality(image_path)
        density_abnormal, density, density_std, density_details = self.detect_density(image_path)
        
        image_hash = self.compute_image_hash(image_path)
        feature_vector = self.extract_feature_vector(image_path)
        
        has_abnormal = (hairiness_detected or breakage_detected or 
                       thickness_abnormal or density_abnormal)
        overall_status = "abnormal" if has_abnormal else "normal"
        
        return {
            "hairiness": {
                "detected": hairiness_detected,
                "score": hairiness_score,
                "details": hairiness_details
            },
            "breakage": {
                "detected": breakage_detected,
                "score": breakage_score,
                "details": breakage_details
            },
            "thickness": {
                "abnormal": thickness_abnormal,
                "mean": thickness_mean,
                "std": thickness_std,
                "details": thickness_details
            },
            "density": {
                "abnormal": density_abnormal,
                "density": density,
                "density_std": density_std,
                "details": density_details
            },
            "image_hash": image_hash,
            "feature_vector": json.dumps(feature_vector),
            "overall_status": overall_status
        }

    async def analyze_image_async(self, image_path: str, timeout: float = 30.0) -> dict:
        loop = asyncio.get_event_loop()
        try:
            func = partial(self.analyze_image, image_path)
            result = await asyncio.wait_for(loop.run_in_executor(None, func), timeout=timeout)
            return result
        except asyncio.TimeoutError:
            return {
                "hairiness": {"detected": False, "score": 0.0, "details": json.dumps({"error": "处理超时"})},
                "breakage": {"detected": False, "score": 0.0, "details": json.dumps({"error": "处理超时"})},
                "thickness": {"abnormal": False, "mean": 0.0, "std": 0.0, "details": json.dumps({"error": "处理超时"})},
                "density": {"abnormal": False, "density": 0.0, "density_std": 0.0, "details": json.dumps({"error": "处理超时"})},
                "image_hash": "",
                "feature_vector": "",
                "overall_status": "error"
            }
        except Exception as e:
            return {
                "hairiness": {"detected": False, "score": 0.0, "details": json.dumps({"error": str(e)})},
                "breakage": {"detected": False, "score": 0.0, "details": json.dumps({"error": str(e)})},
                "thickness": {"abnormal": False, "mean": 0.0, "std": 0.0, "details": json.dumps({"error": str(e)})},
                "density": {"abnormal": False, "density": 0.0, "density_std": 0.0, "details": json.dumps({"error": str(e)})},
                "image_hash": "",
                "feature_vector": "",
                "overall_status": "error"
            }


processor = YarnImageProcessor()
