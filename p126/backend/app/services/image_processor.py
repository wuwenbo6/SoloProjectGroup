import cv2
import numpy as np
from PIL import Image
import os
import uuid
from typing import Tuple, List, Dict, Any, Optional
import time
import traceback

class ImageProcessor:
    @staticmethod
    def load_image(image_path: str) -> np.ndarray:
        try:
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"无法加载图像: {image_path}")
            return img
        except Exception as e:
            raise ValueError(f"加载图像失败: {str(e)}")
    
    @staticmethod
    def preprocess_image(img: np.ndarray, blur_kernel: int = 3) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if blur_kernel > 0:
            blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)
            return blurred
        return gray
    
    @staticmethod
    def enhance_image(img: np.ndarray) -> np.ndarray:
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
            return enhanced
        except:
            return img
    
    @staticmethod
    def remove_background_noise(gray: np.ndarray) -> np.ndarray:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        opened = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel, iterations=1)
        return opened

class StainDetector:
    STAIN_TYPES = ["油污", "水渍", "霉斑", "尘埃", "墨水", "氧化", "纤维团", "未知"]
    
    @classmethod
    def detect(cls, image_path: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            enhanced = ImageProcessor.enhance_image(img)
            gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
            
            stains = []
            stain_set = set()
            
            method1_stains = cls._detect_by_threshold(gray, img)
            for s in method1_stains:
                key = (s["location"]["x"], s["location"]["y"], int(s["area"]))
                if key not in stain_set:
                    stain_set.add(key)
                    stains.append(s)
            
            method2_stains = cls._detect_by_adaptive_threshold(gray, img)
            for s in method2_stains:
                key = (s["location"]["x"], s["location"]["y"], int(s["area"]))
                if key not in stain_set:
                    stain_set.add(key)
                    stains.append(s)
            
            method3_stains = cls._detect_by_color_difference(img, gray)
            for s in method3_stains:
                key = (s["location"]["x"], s["location"]["y"], int(s["area"]))
                if key not in stain_set:
                    stain_set.add(key)
                    stains.append(s)
            
            stains = cls._merge_overlapping_stains(stains)
            
            processing_time = time.time() - start_time
            
            return {
                "stains": stains,
                "total_stains": len(stains),
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"污渍检测失败: {str(e)}")
    
    @classmethod
    def _detect_by_threshold(cls, gray: np.ndarray, original_img: np.ndarray) -> List[Dict[str, Any]]:
        stains = []
        
        _, binary_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        cleaned = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, kernel, iterations=1)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for idx, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area > 10:
                stain_info = cls._extract_stain_info(contour, original_img, gray, f"thresh_{idx}")
                if stain_info:
                    stains.append(stain_info)
        
        return stains
    
    @classmethod
    def _detect_by_adaptive_threshold(cls, gray: np.ndarray, original_img: np.ndarray) -> List[Dict[str, Any]]:
        stains = []
        
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for idx, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if 10 < area < 5000:
                stain_info = cls._extract_stain_info(contour, original_img, gray, f"adap_{idx}")
                if stain_info:
                    stains.append(stain_info)
        
        return stains
    
    @classmethod
    def _detect_by_color_difference(cls, original_img: np.ndarray, gray: np.ndarray) -> List[Dict[str, Any]]:
        stains = []
        
        lab = cv2.cvtColor(original_img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        a_normalized = cv2.normalize(a, None, 0, 255, cv2.NORM_MINMAX)
        _, a_binary = cv2.threshold(a_normalized, 140, 255, cv2.THRESH_BINARY)
        
        b_normalized = cv2.normalize(b, None, 0, 255, cv2.NORM_MINMAX)
        _, b_binary = cv2.threshold(b_normalized, 140, 255, cv2.THRESH_BINARY)
        
        combined = cv2.bitwise_or(a_binary, b_binary)
        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for idx, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if 15 < area < 8000:
                stain_info = cls._extract_stain_info(contour, original_img, gray, f"color_{idx}")
                if stain_info:
                    stains.append(stain_info)
        
        return stains
    
    @classmethod
    def _extract_stain_info(cls, contour: np.ndarray, original_img: np.ndarray, 
                           gray: np.ndarray, prefix: str) -> Dict[str, Any]:
        try:
            area = cv2.contourArea(contour)
            if area < 10:
                return None
            
            M = cv2.moments(contour)
            cx = int(M["m10"] / M["m00"]) if M["m00"] != 0 else 0
            cy = int(M["m01"] / M["m00"]) if M["m00"] != 0 else 0
            
            mask = np.zeros(gray.shape, np.uint8)
            cv2.drawContours(mask, [contour], -1, 255, -1)
            
            mean_val = cv2.mean(original_img, mask=mask)
            stain_type = cls._classify_stain_type(mean_val, area, mask, gray)
            
            confidence = min(0.95, 0.4 + area / 2000)
            severity = cls._calculate_severity(area)
            
            return {
                "id": f"stain_{prefix}_{uuid.uuid4().hex[:6]}",
                "type": stain_type,
                "confidence": round(confidence, 3),
                "area": round(area, 2),
                "location": {"x": cx, "y": cy},
                "severity": severity
            }
        except:
            return None
    
    @staticmethod
    def _classify_stain_type(mean_color: Tuple[float, float, float], area: float,
                            mask: np.ndarray, gray: np.ndarray) -> str:
        b, g, r = mean_color[:3]
        brightness = (r + g + b) / 3
        
        mask_pixels = gray[mask > 0]
        if len(mask_pixels) > 0:
            std_dev = np.std(mask_pixels)
        else:
            std_dev = 0
        
        if brightness < 50:
            return "墨水"
        elif brightness > 200:
            if std_dev < 20:
                return "尘埃"
            else:
                return "纤维团"
        elif 60 < r < 150 and 80 < g < 170 and 50 < b < 130:
            if g > r + 10 and g > b + 10:
                return "霉斑"
            elif abs(r - g) < 15 and abs(g - b) < 15:
                return "油污"
            else:
                return "氧化"
        elif abs(r - g) < 25 and abs(g - b) < 25 and 90 < brightness < 190:
            return "油污"
        elif 110 < brightness < 210 and b > r - 10 and abs(b - g) < 30:
            return "水渍"
        elif r > 140 and g > 90 and b < 110:
            return "氧化"
        elif std_dev > 30 and area > 100:
            return "纤维团"
        else:
            return "未知"
    
    @staticmethod
    def _calculate_severity(area: float) -> str:
        if area < 100:
            return "轻微"
        elif area < 500:
            return "中等"
        else:
            return "严重"
    
    @staticmethod
    def _merge_overlapping_stains(stains: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if len(stains) <= 1:
            return stains
        
        merged = []
        stains_sorted = sorted(stains, key=lambda x: x["area"], reverse=True)
        
        for stain in stains_sorted:
            should_merge = False
            for idx, m_stain in enumerate(merged):
                dx = abs(stain["location"]["x"] - m_stain["location"]["x"])
                dy = abs(stain["location"]["y"] - m_stain["location"]["y"])
                distance = (dx**2 + dy**2)**0.5
                
                area1 = stain["area"]
                area2 = m_stain["area"]
                min_radius = (min(area1, area2) / 3.14159)**0.5
                
                if distance < min_radius * 2:
                    merged[idx]["area"] = max(area1, area2)
                    merged[idx]["confidence"] = max(stain["confidence"], m_stain["confidence"])
                    should_merge = True
                    break
            
            if not should_merge:
                merged.append(stain)
        
        return merged

class PaperClassifier:
    PAPER_TYPES = {
        "新闻纸": {"brightness_range": (0.4, 0.65), "texture_range": (8, 20)},
        "书写纸": {"brightness_range": (0.6, 0.8), "texture_range": (5, 12)},
        "打印纸": {"brightness_range": (0.7, 0.9), "texture_range": (3, 10)},
        "铜版纸": {"brightness_range": (0.85, 0.98), "texture_range": (1, 5)},
        "牛皮纸": {"brightness_range": (0.2, 0.5), "texture_range": (10, 30)},
        "宣纸": {"brightness_range": (0.5, 0.75), "texture_range": (15, 40)},
        "纸板": {"brightness_range": (0.3, 0.6), "texture_range": (20, 50)},
        "特种纸": {"brightness_range": (0.1, 1.0), "texture_range": (0, 100)}
    }
    
    @classmethod
    def classify(cls, image_path: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            gray = ImageProcessor.preprocess_image(img, blur_kernel=0)
            
            features = cls._extract_features(img, gray)
            paper_type, confidence = cls._classify_by_features(features)
            
            processing_time = time.time() - start_time
            
            return {
                "paper_type": paper_type,
                "confidence": round(confidence, 3),
                "sub_type": cls._get_sub_type(paper_type, features),
                "properties": {
                    "brightness": features["brightness"],
                    "texture_roughness": features["texture"],
                    "fiber_visibility": features["fiber_score"],
                    "color_tone": features["color_tone"],
                    "estimated_thickness": features["thickness"],
                    "contrast": features["contrast"],
                    "uniformity": features["uniformity"]
                },
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"分类失败: {str(e)}")
    
    @staticmethod
    def _extract_features(img: np.ndarray, gray: np.ndarray) -> Dict[str, Any]:
        brightness = np.mean(gray) / 255.0
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F, ksize=3)
        texture = np.var(laplacian) / 500.0
        
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        fiber_score = (np.mean(np.abs(sobelx)) + np.mean(np.abs(sobely))) / 50.0
        
        mean_color = cv2.mean(img)
        r, g, b = mean_color[2], mean_color[1], mean_color[0]
        r_ratio = r / (r + g + b + 1e-6)
        g_ratio = g / (r + g + b + 1e-6)
        b_ratio = b / (r + g + b + 1e-6)
        
        if r_ratio > g_ratio and r_ratio > b_ratio:
            color_tone = "偏红"
        elif g_ratio > r_ratio and g_ratio > b_ratio:
            color_tone = "偏绿"
        elif b_ratio > r_ratio and b_ratio > g_ratio:
            color_tone = "偏蓝"
        else:
            color_tone = "中性"
        
        thickness = "中等"
        if brightness > 0.82 and texture < 6:
            thickness = "薄"
        elif brightness < 0.55 and texture > 12:
            thickness = "厚"
        
        contrast = np.std(gray) / 128.0
        uniformity = 1 - (np.std(gray) / 255.0)
        
        return {
            "brightness": round(brightness, 3),
            "texture": round(texture, 2),
            "fiber_score": round(fiber_score, 2),
            "color_tone": color_tone,
            "thickness": thickness,
            "contrast": round(contrast, 3),
            "uniformity": round(uniformity, 3),
            "r_ratio": round(r_ratio, 3),
            "g_ratio": round(g_ratio, 3),
            "b_ratio": round(b_ratio, 3)
        }
    
    @classmethod
    def _classify_by_features(cls, features: Dict[str, Any]) -> Tuple[str, float]:
        brightness = features["brightness"]
        texture = features["texture"]
        fiber_score = features["fiber_score"]
        uniformity = features["uniformity"]
        contrast = features["contrast"]
        
        scores = {}
        
        for paper_type, ranges in cls.PAPER_TYPES.items():
            if paper_type == "特种纸":
                continue
            
            b_min, b_max = ranges["brightness_range"]
            t_min, t_max = ranges["texture_range"]
            
            b_score = max(0, 1 - abs(brightness - (b_min + b_max) / 2) / ((b_max - b_min) / 2 + 1e-6))
            t_score = max(0, 1 - abs(texture - (t_min + t_max) / 2) / ((t_max - t_min) / 2 + 1e-6))
            
            scores[paper_type] = (b_score * 0.5 + t_score * 0.5)
        
        if fiber_score > 1.8 and texture > 18:
            scores["宣纸"] = scores.get("宣纸", 0) + 0.3
        if brightness < 0.45 and texture > 12:
            scores["牛皮纸"] = scores.get("牛皮纸", 0) + 0.25
        if brightness > 0.83 and texture < 4:
            scores["铜版纸"] = scores.get("铜版纸", 0) + 0.25
        if 0.72 < brightness < 0.88 and 4 < texture < 11:
            scores["打印纸"] = scores.get("打印纸", 0) + 0.2
        if 0.62 < brightness < 0.82 and fiber_score < 1.2:
            scores["书写纸"] = scores.get("书写纸", 0) + 0.15
        if brightness < 0.62 and fiber_score > 1.5:
            scores["新闻纸"] = scores.get("新闻纸", 0) + 0.15
        if texture > 22:
            scores["纸板"] = scores.get("纸板", 0) + 0.2
        
        if scores:
            best_type = max(scores.keys(), key=lambda x: scores[x])
            best_score = scores[best_type]
            
            if best_score < 0.3:
                return "特种纸", 0.6
            
            confidence = min(0.95, 0.5 + best_score * 0.45)
            return best_type, confidence
        
        return "特种纸", 0.6
    
    @staticmethod
    def _get_sub_type(paper_type: str, features: Dict[str, Any]) -> str:
        brightness = features["brightness"]
        texture = features["texture"]
        
        if paper_type == "新闻纸":
            if brightness < 0.5:
                return "低克重新闻纸"
            return "普通新闻纸"
        elif paper_type == "书写纸":
            if texture < 7:
                return "道林书写纸"
            return "胶版书写纸"
        elif paper_type == "打印纸":
            if brightness > 0.85:
                return "激光打印纸"
            elif brightness > 0.78:
                return "喷墨打印纸"
            return "A4复印纸"
        elif paper_type == "铜版纸":
            if brightness > 0.9:
                return "光面铜版纸"
            return "亚光铜版纸"
        elif paper_type == "牛皮纸":
            if brightness < 0.35:
                return "本色牛皮纸"
            return "白牛皮纸"
        elif paper_type == "宣纸":
            if texture > 25:
                return "生宣"
            elif texture < 18:
                return "熟宣"
            return "半生熟宣"
        elif paper_type == "纸板":
            if texture > 30:
                return "牛皮卡"
            elif brightness > 0.5:
                return "白卡纸"
            return "灰底白板"
        elif paper_type == "特种纸":
            if uniformity > 0.8:
                return "防伪纸"
            elif texture > 15:
                return "艺术纸"
            return "拷贝纸"
        
        return "标准型"

class DamagePredictor:
    DAMAGE_TYPES = ["纤维断裂", "酸度降解", "霉菌侵蚀", "机械磨损", "光老化", "水解", "氧化"]
    
    @classmethod
    def predict(cls, image_path: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            gray = ImageProcessor.preprocess_image(img, blur_kernel=3)
            
            health_indicators = cls._analyze_health_indicators(img, gray)
            predictions = cls._generate_predictions(health_indicators)
            
            overall_health = sum(1 - p["probability"] for p in predictions) / len(predictions) if predictions else 0.8
            risk_level = cls._calculate_risk_level(overall_health, predictions)
            
            processing_time = time.time() - start_time
            
            return {
                "predictions": predictions,
                "overall_health": round(overall_health, 3),
                "risk_level": risk_level,
                "health_indicators": health_indicators,
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"预测失败: {str(e)}")
    
    @staticmethod
    def _analyze_health_indicators(img: np.ndarray, gray: np.ndarray) -> Dict[str, float]:
        edges = cv2.Canny(gray, 30, 100)
        edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])
        
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        contrast = np.std(hist) / 500.0
        
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        uniformity = 1 - (np.std(l_channel) / 255.0)
        
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        s_channel = hsv[:, :, 1]
        saturation = np.mean(s_channel) / 255.0
        
        v_channel = hsv[:, :, 2]
        v_std = np.std(v_channel)
        
        b, g, r = cv2.split(img)
        r_mean = np.mean(r)
        b_mean = np.mean(b)
        oxidation_score = max(0, (r_mean - b_mean) / 255.0)
        
        return {
            "edge_density": round(edge_density, 3),
            "contrast": round(contrast, 3),
            "uniformity": round(uniformity, 3),
            "saturation": round(saturation, 3),
            "brightness_std": round(v_std / 255.0, 3),
            "oxidation_score": round(oxidation_score, 3)
        }
    
    @classmethod
    def _generate_predictions(cls, indicators: Dict[str, float]) -> List[Dict[str, Any]]:
        predictions = []
        
        edge_density = indicators["edge_density"]
        uniformity = indicators["uniformity"]
        saturation = indicators["saturation"]
        brightness_std = indicators["brightness_std"]
        oxidation_score = indicators["oxidation_score"]
        
        fiber_prob = min(0.95, edge_density * 4)
        predictions.append({
            "damage_type": "纤维断裂",
            "probability": round(fiber_prob, 3),
            "expected_time": "12-24个月" if fiber_prob > 0.5 else "24-48个月",
            "severity": "严重" if fiber_prob > 0.7 else ("中等" if fiber_prob > 0.4 else "轻微")
        })
        
        acid_prob = max(0.05, 0.9 - uniformity * 0.6)
        predictions.append({
            "damage_type": "酸度降解",
            "probability": round(acid_prob, 3),
            "expected_time": "12-24个月" if acid_prob > 0.6 else "24-48个月",
            "severity": "严重" if uniformity < 0.4 else ("中等" if uniformity < 0.6 else "轻微")
        })
        
        mold_prob = max(0.05, saturation * 1.2)
        predictions.append({
            "damage_type": "霉菌侵蚀",
            "probability": round(mold_prob, 3),
            "expected_time": "6-12个月" if mold_prob > 0.5 else "12-24个月",
            "severity": "严重" if saturation > 0.5 else ("中等" if saturation > 0.3 else "轻微")
        })
        
        wear_prob = min(0.85, edge_density * 2.5)
        predictions.append({
            "damage_type": "机械磨损",
            "probability": round(wear_prob, 3),
            "expected_time": "12-18个月" if wear_prob > 0.5 else "18-36个月",
            "severity": "中等" if edge_density > 0.12 else "轻微"
        })
        
        light_prob = max(0.1, 0.7 - uniformity * 0.4 + brightness_std * 0.5)
        predictions.append({
            "damage_type": "光老化",
            "probability": round(light_prob, 3),
            "expected_time": "24-48个月" if light_prob > 0.5 else "48-72个月",
            "severity": "中等" if brightness_std > 0.2 else "轻微"
        })
        
        hydro_prob = max(0.05, 0.6 - uniformity * 0.5 + saturation * 0.3)
        predictions.append({
            "damage_type": "水解",
            "probability": round(hydro_prob, 3),
            "expected_time": "24-36个月" if hydro_prob > 0.5 else "36-60个月",
            "severity": "中等" if uniformity < 0.55 else "轻微"
        })
        
        oxid_prob = max(0.05, oxidation_score * 2)
        predictions.append({
            "damage_type": "氧化",
            "probability": round(oxid_prob, 3),
            "expected_time": "18-36个月" if oxid_prob > 0.4 else "36-60个月",
            "severity": "中等" if oxidation_score > 0.15 else "轻微"
        })
        
        return predictions
    
    @staticmethod
    def _calculate_risk_level(overall_health: float, predictions: List[Dict[str, Any]]) -> str:
        high_risk_count = sum(1 for p in predictions if p["probability"] > 0.6)
        severe_count = sum(1 for p in predictions if p["severity"] == "严重")
        
        if overall_health < 0.45 or high_risk_count >= 2 or severe_count >= 1:
            return "高风险"
        elif overall_health < 0.65 or high_risk_count >= 1:
            return "中风险"
        else:
            return "低风险"

class WeatheringTrendAnalyzer:
    @classmethod
    def predict_trend(cls, image_path: str, prediction_months: int = 24) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            gray = ImageProcessor.preprocess_image(img, blur_kernel=0)
            
            current_metrics = cls._calculate_current_metrics(img, gray)
            current_health = current_metrics["health_score"]
            
            trend_points = cls._generate_trend_points(
                current_health, 
                current_metrics, 
                prediction_months
            )
            
            critical_points = cls._identify_critical_points(trend_points)
            recommendations = cls._generate_recommendations(current_metrics, trend_points)
            
            processing_time = time.time() - start_time
            
            return {
                "current_health": round(current_health, 3),
                "trend_points": trend_points,
                "prediction_months": prediction_months,
                "recommendations": recommendations,
                "critical_points": critical_points,
                "current_metrics": current_metrics,
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"风化趋势预测失败: {str(e)}")
    
    @staticmethod
    def _calculate_current_metrics(img: np.ndarray, gray: np.ndarray) -> Dict[str, float]:
        brightness = np.mean(gray) / 255.0
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        texture = np.var(laplacian) / 500.0
        
        edges = cv2.Canny(gray, 30, 100)
        edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])
        
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        uniformity = 1 - (np.std(l_channel) / 255.0)
        
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        s_channel = hsv[:, :, 1]
        saturation = np.mean(s_channel) / 255.0
        
        health_score = max(0.1, min(0.95, 
            brightness * 0.25 + 
            (1 - min(1, texture / 50)) * 0.25 + 
            (1 - edge_density) * 0.25 + 
            uniformity * 0.15 +
            (1 - saturation) * 0.1
        ))
        
        total_damage_area = edge_density * (1 - uniformity) * 100
        
        return {
            "health_score": health_score,
            "brightness": brightness,
            "texture": texture,
            "edge_density": edge_density,
            "uniformity": uniformity,
            "saturation": saturation,
            "total_damage_area": total_damage_area
        }
    
    @classmethod
    def _generate_trend_points(cls, current_health: float, 
                                current_metrics: Dict[str, float], 
                                months: int) -> List[Dict[str, Any]]:
        trend_points = []
        
        edge_density = current_metrics["edge_density"]
        uniformity = current_metrics["uniformity"]
        saturation = current_metrics["saturation"]
        
        decay_rate = 0.02 + edge_density * 0.1 + (1 - uniformity) * 0.05
        
        for month in range(0, months + 1, 3):
            decay_factor = 1 - (decay_rate * month / 12)
            health = max(0.1, current_health * decay_factor)
            
            damage_growth = 1 + (edge_density + saturation) * month / 6
            damage_area = current_metrics["total_damage_area"] * damage_growth
            
            if health > 0.65:
                risk = "低风险"
            elif health > 0.45:
                risk = "中风险"
            else:
                risk = "高风险"
            
            trend_points.append({
                "month": month,
                "health_score": round(health, 3),
                "damage_area": round(damage_area, 2),
                "risk_level": risk
            })
        
        return trend_points
    
    @staticmethod
    def _identify_critical_points(trend_points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        critical_points = []
        
        for i, point in enumerate(trend_points):
            if point["risk_level"] == "高风险" and i > 0:
                if trend_points[i-1]["risk_level"] != "高风险":
                    critical_points.append({
                        "type": "风险升级",
                        "month": point["month"],
                        "description": f"第{point['month']}个月达到高风险等级",
                        "health_at_point": point["health_score"]
                    })
            
            if point["health_score"] < 0.5 and i > 0:
                if trend_points[i-1]["health_score"] >= 0.5:
                    critical_points.append({
                        "type": "健康临界",
                        "month": point["month"],
                        "description": f"第{point['month']}个月健康度降至50%以下",
                        "health_at_point": point["health_score"]
                    })
        
        return critical_points
    
    @staticmethod
    def _generate_recommendations(current_metrics: Dict[str, float], 
                                   trend_points: List[Dict[str, Any]]) -> List[str]:
        recommendations = []
        
        if current_metrics["edge_density"] > 0.15:
            recommendations.append("纤维断裂风险高，建议进行局部加固处理")
        
        if current_metrics["uniformity"] < 0.6:
            recommendations.append("纸张均匀度低，存在酸化降解风险，建议进行脱酸处理")
        
        if current_metrics["saturation"] > 0.4:
            recommendations.append("颜色饱和度高，可能存在霉菌污染，建议进行灭菌处理")
        
        if current_metrics["texture"] > 30:
            recommendations.append("纹理粗糙度高，建议进行表面平滑处理")
        
        final_health = trend_points[-1]["health_score"]
        if final_health < 0.3:
            recommendations.append("长期风化趋势严重，建议进行全面修复")
        elif final_health < 0.5:
            recommendations.append("中期存在明显风化风险，建议制定预防性保护方案")
        
        if not recommendations:
            recommendations.append("当前状态良好，建议每6个月进行一次检测")
        
        return recommendations

class MultiPeriodComparator:
    @classmethod
    def compare(cls, image_path1: str, image_path2: str, 
                time_diff_days: Optional[int] = None) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img1 = ImageProcessor.load_image(image_path1)
            img2 = ImageProcessor.load_image(image_path2)
            
            gray1 = ImageProcessor.preprocess_image(img1, blur_kernel=0)
            gray2 = ImageProcessor.preprocess_image(img2, blur_kernel=0)
            
            stains1 = StainDetector.detect(image_path1)["stains"]
            stains2 = StainDetector.detect(image_path2)["stains"]
            
            pred1 = DamagePredictor.predict(image_path1)
            pred2 = DamagePredictor.predict(image_path2)
            
            metrics = cls._calculate_comparison_metrics(
                img1, img2, gray1, gray2, 
                stains1, stains2, 
                pred1, pred2
            )
            
            overall_assessment = cls._generate_assessment(metrics)
            change_rate = cls._calculate_change_rates(metrics, time_diff_days)
            
            processing_time = time.time() - start_time
            
            return {
                "comparison_id": str(uuid.uuid4())[:8],
                "earlier_file_id": os.path.basename(image_path1).split('.')[0][:32],
                "later_file_id": os.path.basename(image_path2).split('.')[0][:32],
                "time_diff_days": time_diff_days,
                "metrics": metrics,
                "overall_assessment": overall_assessment,
                "change_rate": change_rate,
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"多期对比失败: {str(e)}")
    
    @classmethod
    def _calculate_comparison_metrics(cls, img1: np.ndarray, img2: np.ndarray,
                                       gray1: np.ndarray, gray2: np.ndarray,
                                       stains1: List[Dict[str, Any]], stains2: List[Dict[str, Any]],
                                       pred1: Dict[str, Any], pred2: Dict[str, Any]) -> Dict[str, Any]:
        stain_count_change = len(stains2) - len(stains1)
        
        area1 = sum(s["area"] for s in stains1)
        area2 = sum(s["area"] for s in stains2)
        stain_area_change = area2 - area1
        
        health_change = pred2["overall_health"] - pred1["overall_health"]
        
        brightness1 = np.mean(gray1) / 255.0
        brightness2 = np.mean(gray2) / 255.0
        brightness_change = brightness2 - brightness1
        
        laplacian1 = cv2.Laplacian(gray1, cv2.CV_64F)
        laplacian2 = cv2.Laplacian(gray2, cv2.CV_64F)
        texture1 = np.var(laplacian1) / 500.0
        texture2 = np.var(laplacian2) / 500.0
        texture_change = texture2 - texture1
        
        new_stains = cls._find_new_stains(stains1, stains2)
        resolved_stains = cls._find_resolved_stains(stains1, stains2)
        
        return {
            "stain_count_change": stain_count_change,
            "stain_area_change": round(stain_area_change, 2),
            "health_score_change": round(health_change, 3),
            "brightness_change": round(brightness_change, 3),
            "texture_change": round(texture_change, 3),
            "new_stains": new_stains,
            "resolved_stains": resolved_stains
        }
    
    @staticmethod
    def _find_new_stains(old_stains: List[Dict[str, Any]], 
                          new_stains: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        new_ones = []
        for ns in new_stains:
            is_new = True
            for os in old_stains:
                dx = abs(ns["location"]["x"] - os["location"]["x"])
                dy = abs(ns["location"]["y"] - os["location"]["y"])
                if dx < 30 and dy < 30 and abs(ns["area"] - os["area"]) < ns["area"] * 0.5:
                    is_new = False
                    break
            if is_new:
                new_ones.append(ns)
        return new_ones
    
    @staticmethod
    def _find_resolved_stains(old_stains: List[Dict[str, Any]], 
                               new_stains: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        resolved = []
        for os in old_stains:
            is_resolved = True
            for ns in new_stains:
                dx = abs(os["location"]["x"] - ns["location"]["x"])
                dy = abs(os["location"]["y"] - ns["location"]["y"])
                if dx < 30 and dy < 30:
                    is_resolved = False
                    break
            if is_resolved:
                resolved.append(os)
        return resolved
    
    @staticmethod
    def _generate_assessment(metrics: Dict[str, Any]) -> str:
        assessments = []
        
        if metrics["stain_count_change"] > 0:
            assessments.append(f"新增{metrics['stain_count_change']}处污渍")
        elif metrics["stain_count_change"] < 0:
            assessments.append(f"减少{abs(metrics['stain_count_change'])}处污渍")
        
        if metrics["stain_area_change"] > 100:
            assessments.append("污渍面积显著增加")
        elif metrics["stain_area_change"] < -100:
            assessments.append("污渍面积显著减少")
        
        if metrics["health_score_change"] < -0.1:
            assessments.append("健康度明显下降")
        elif metrics["health_score_change"] > 0.1:
            assessments.append("健康度明显改善")
        
        if metrics["brightness_change"] > 0.05:
            assessments.append("纸张亮度有所提升")
        elif metrics["brightness_change"] < -0.05:
            assessments.append("纸张明显变暗")
        
        if not assessments:
            assessments.append("变化不明显，状态相对稳定")
        
        return "；".join(assessments)
    
    @staticmethod
    def _calculate_change_rates(metrics: Dict[str, Any], 
                                 days: Optional[int]) -> Dict[str, float]:
        if days and days > 0:
            return {
                "stain_count_per_month": round(metrics["stain_count_change"] * 30 / days, 2),
                "stain_area_per_month": round(metrics["stain_area_change"] * 30 / days, 2),
                "health_per_month": round(metrics["health_score_change"] * 30 / days, 4)
            }
        return {
            "stain_count_per_month": 0,
            "stain_area_per_month": 0,
            "health_per_month": 0
        }

class RepairEstimator:
    REPAIR_COSTS = {
        "表面清洁": {"base_cost": 50, "cost_per_area": 0.5, "time_per_area": 0.1},
        "脱酸处理": {"base_cost": 200, "cost_per_area": 2.0, "time_per_area": 0.3},
        "污渍去除": {"base_cost": 100, "cost_per_area": 1.0, "time_per_area": 0.2},
        "局部加固": {"base_cost": 150, "cost_per_area": 1.5, "time_per_area": 0.25},
        "纤维修复": {"base_cost": 300, "cost_per_area": 3.0, "time_per_area": 0.5},
        "纸张补全": {"base_cost": 250, "cost_per_area": 2.5, "time_per_area": 0.4},
        "防霉处理": {"base_cost": 120, "cost_per_area": 1.2, "time_per_area": 0.15},
        "整体修复": {"base_cost": 500, "cost_per_area": 5.0, "time_per_area": 1.0}
    }
    
    @classmethod
    def estimate_repair(cls, image_path: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            gray = ImageProcessor.preprocess_image(img, blur_kernel=0)
            
            detection_result = StainDetector.detect(image_path)
            prediction_result = DamagePredictor.predict(image_path)
            classification_result = PaperClassifier.classify(image_path)
            
            repair_items = cls._generate_repair_items(
                detection_result, 
                prediction_result, 
                classification_result,
                img.shape[:2]
            )
            
            total_cost = sum(item["estimated_cost"] for item in repair_items)
            total_time_minutes = sum(cls._parse_time_to_minutes(item["estimated_time"]) for item in repair_items)
            total_time = cls._format_minutes_to_time(total_time_minutes)
            
            material_list = cls._generate_material_list(repair_items)
            priority_summary = cls._calculate_priority_summary(repair_items)
            
            processing_time = time.time() - start_time
            
            return {
                "file_id": os.path.basename(image_path).split('.')[0][:32],
                "total_estimated_cost": round(total_cost, 2),
                "total_estimated_time": total_time,
                "repair_items": repair_items,
                "material_list": material_list,
                "priority_summary": priority_summary,
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"维修量估算失败: {str(e)}")
    
    @classmethod
    def _generate_repair_items(cls, detection_result: Dict[str, Any],
                                 prediction_result: Dict[str, Any],
                                 classification_result: Dict[str, Any],
                                 image_size: Tuple[int, int]) -> List[Dict[str, Any]]:
        repair_items = []
        total_area = image_size[0] * image_size[1] / 100
        
        stains = detection_result["stains"]
        total_stain_area = sum(s["area"] for s in stains)
        
        if total_stain_area > 0:
            dust_count = sum(1 for s in stains if s["type"] == "尘埃")
            mold_count = sum(1 for s in stains if s["type"] == "霉斑")
            ink_count = sum(1 for s in stains if s["type"] == "墨水")
            
            if dust_count > 0:
                area = sum(s["area"] for s in stains if s["type"] == "尘埃")
                cost = cls.REPAIR_COSTS["表面清洁"]["base_cost"] + area * cls.REPAIR_COSTS["表面清洁"]["cost_per_area"]
                minutes = area * cls.REPAIR_COSTS["表面清洁"]["time_per_area"]
                repair_items.append({
                    "repair_type": "表面清洁",
                    "quantity": round(area, 2),
                    "unit": "平方像素",
                    "priority": "高" if area > total_area * 0.1 else ("中" if area > total_area * 0.05 else "低"),
                    "estimated_cost": round(cost, 2),
                    "estimated_time": cls._format_minutes_to_time(minutes),
                    "description": f"清除{dust_count}处尘埃污渍"
                })
            
            if mold_count > 0:
                area = sum(s["area"] for s in stains if s["type"] == "霉斑")
                cost = cls.REPAIR_COSTS["防霉处理"]["base_cost"] + area * cls.REPAIR_COSTS["防霉处理"]["cost_per_area"]
                minutes = area * cls.REPAIR_COSTS["防霉处理"]["time_per_area"]
                repair_items.append({
                    "repair_type": "防霉处理",
                    "quantity": round(area, 2),
                    "unit": "平方像素",
                    "priority": "高",
                    "estimated_cost": round(cost, 2),
                    "estimated_time": cls._format_minutes_to_time(minutes),
                    "description": f"处理{mold_count}处霉斑，进行灭菌防霉"
                })
            
            if ink_count > 0 or total_stain_area > 100:
                area = total_stain_area
                cost = cls.REPAIR_COSTS["污渍去除"]["base_cost"] + area * cls.REPAIR_COSTS["污渍去除"]["cost_per_area"]
                minutes = area * cls.REPAIR_COSTS["污渍去除"]["time_per_area"]
                repair_items.append({
                    "repair_type": "污渍去除",
                    "quantity": round(area, 2),
                    "unit": "平方像素",
                    "priority": "中" if area < 500 else "高",
                    "estimated_cost": round(cost, 2),
                    "estimated_time": cls._format_minutes_to_time(minutes),
                    "description": f"去除{detection_result['total_stains']}处各类污渍"
                })
        
        predictions = prediction_result["predictions"]
        fiber_risk = next((p for p in predictions if p["damage_type"] == "纤维断裂"), None)
        acid_risk = next((p for p in predictions if p["damage_type"] == "酸度降解"), None)
        
        if fiber_risk and fiber_risk["probability"] > 0.4:
            area_est = total_area * fiber_risk["probability"] * 0.3
            cost = cls.REPAIR_COSTS["局部加固"]["base_cost"] + area_est * cls.REPAIR_COSTS["局部加固"]["cost_per_area"]
            minutes = area_est * cls.REPAIR_COSTS["局部加固"]["time_per_area"]
            repair_items.append({
                "repair_type": "局部加固",
                "quantity": round(area_est, 2),
                "unit": "平方像素",
                "priority": "高" if fiber_risk["probability"] > 0.6 else "中",
                "estimated_cost": round(cost, 2),
                "estimated_time": cls._format_minutes_to_time(minutes),
                "description": f"纤维断裂风险{round(fiber_risk['probability']*100)}%，建议局部加固"
            })
        
        if acid_risk and acid_risk["probability"] > 0.4:
            cost = cls.REPAIR_COSTS["脱酸处理"]["base_cost"] + total_area * cls.REPAIR_COSTS["脱酸处理"]["cost_per_area"] * 0.5
            minutes = total_area * cls.REPAIR_COSTS["脱酸处理"]["time_per_area"] * 0.5
            repair_items.append({
                "repair_type": "脱酸处理",
                "quantity": round(total_area, 2),
                "unit": "平方像素",
                "priority": "高" if acid_risk["probability"] > 0.6 else "中",
                "estimated_cost": round(cost, 2),
                "estimated_time": cls._format_minutes_to_time(minutes),
                "description": f"酸度降解风险{round(acid_risk['probability']*100)}%，建议脱酸处理"
            })
        
        if prediction_result["risk_level"] == "高风险":
            cost = cls.REPAIR_COSTS["整体修复"]["base_cost"] + total_area * cls.REPAIR_COSTS["整体修复"]["cost_per_area"] * 0.3
            minutes = total_area * cls.REPAIR_COSTS["整体修复"]["time_per_area"] * 0.3
            repair_items.append({
                "repair_type": "整体修复",
                "quantity": round(total_area, 2),
                "unit": "平方像素",
                "priority": "高",
                "estimated_cost": round(cost, 2),
                "estimated_time": cls._format_minutes_to_time(minutes),
                "description": "整体风险等级高，建议全面修复保护"
            })
        
        if not repair_items:
            repair_items.append({
                "repair_type": "预防性维护",
                "quantity": 1,
                "unit": "次",
                "priority": "低",
                "estimated_cost": 50.0,
                "estimated_time": "30分钟",
                "description": "状态良好，进行常规预防性维护"
            })
        
        return repair_items
    
    @staticmethod
    def _generate_material_list(repair_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        materials = []
        material_map = {
            "表面清洁": ["清洁刷", "无尘布", "专用清洁剂"],
            "脱酸处理": ["脱酸溶液", "喷雾器", "中和剂"],
            "污渍去除": ["溶剂", "吸墨纸", "漂白剂"],
            "局部加固": ["修复纸", "淀粉胶", "镊子"],
            "纤维修复": ["纤维补片", "专用粘合剂", "压平工具"],
            "防霉处理": ["防霉剂", "无菌处理箱", "干燥剂"],
            "整体修复": ["全套修复工具", "保护壳", "封装材料"],
            "预防性维护": ["防护手套", "防尘罩", "湿度调节剂"]
        }
        
        for item in repair_items:
            for mat in material_map.get(item["repair_type"], []):
                materials.append({
                    "material": mat,
                    "required_for": item["repair_type"],
                    "quantity_estimate": "根据实际面积确定"
                })
        
        return materials
    
    @staticmethod
    def _calculate_priority_summary(repair_items: List[Dict[str, Any]]) -> Dict[str, int]:
        summary = {"高": 0, "中": 0, "低": 0}
        for item in repair_items:
            summary[item["priority"]] += 1
        return summary
    
    @staticmethod
    def _parse_time_to_minutes(time_str: str) -> float:
        if "分钟" in time_str:
            return float(time_str.replace("分钟", ""))
        elif "小时" in time_str:
            return float(time_str.replace("小时", "")) * 60
        return 30
    
    @staticmethod
    def _format_minutes_to_time(minutes: float) -> str:
        if minutes < 60:
            return f"{max(10, round(minutes, -1)):.0f}分钟"
        else:
            hours = minutes / 60
            return f"{hours:.1f}小时"

class ModelSlicer:
    @classmethod
    def slice_and_analyze(cls, image_path: str, grid_rows: int = 4, grid_cols: int = 4) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            img = ImageProcessor.load_image(image_path)
            gray = ImageProcessor.preprocess_image(img, blur_kernel=0)
            
            height, width = gray.shape
            slice_height = height // grid_rows
            slice_width = width // grid_cols
            
            slices = []
            heatmap_data = []
            
            for row in range(grid_rows):
                row_heatmap = []
                for col in range(grid_cols):
                    y1 = row * slice_height
                    y2 = y1 + slice_height if row < grid_rows - 1 else height
                    x1 = col * slice_width
                    x2 = x1 + slice_width if col < grid_cols - 1 else width
                    
                    slice_gray = gray[y1:y2, x1:x2]
                    slice_img = img[y1:y2, x1:x2]
                    
                    analysis = cls._analyze_slice(
                        slice_gray, slice_img, row, col,
                        {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                    )
                    slices.append(analysis)
                    row_heatmap.append(analysis["local_health"])
                
                heatmap_data.append(row_heatmap)
            
            high_risk_areas = cls._identify_high_risk_areas(slices)
            overall_summary = cls._generate_overall_summary(slices, grid_rows, grid_cols)
            
            processing_time = time.time() - start_time
            
            return {
                "file_id": os.path.basename(image_path).split('.')[0][:32],
                "grid_size": {"rows": grid_rows, "cols": grid_cols},
                "slices": slices,
                "heatmap_data": heatmap_data,
                "high_risk_areas": high_risk_areas,
                "overall_summary": overall_summary,
                "processing_time": round(processing_time, 3)
            }
        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"模型切片分析失败: {str(e)}")
    
    @classmethod
    def _analyze_slice(cls, slice_gray: np.ndarray, slice_img: np.ndarray,
                        row: int, col: int, bounds: Dict[str, int]) -> Dict[str, Any]:
        brightness = np.mean(slice_gray) / 255.0
        
        laplacian = cv2.Laplacian(slice_gray, cv2.CV_64F)
        texture = np.var(laplacian) / 500.0
        
        edges = cv2.Canny(slice_gray, 30, 100)
        edge_density = np.sum(edges > 0) / (slice_gray.shape[0] * slice_gray.shape[1])
        
        lab = cv2.cvtColor(slice_img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        uniformity = 1 - (np.std(l_channel) / 255.0)
        
        local_health = max(0.1, min(0.95,
            brightness * 0.3 +
            (1 - min(1, texture / 30)) * 0.25 +
            (1 - edge_density) * 0.25 +
            uniformity * 0.2
        ))
        
        stains = cls._detect_stains_in_slice(slice_img, slice_gray)
        stain_count = len(stains)
        total_stain_area = sum(s["area"] for s in stains)
        
        if stains:
            stain_types = [s["type"] for s in stains]
            dominant_type = max(set(stain_types), key=stain_types.count)
        else:
            dominant_type = None
        
        if local_health < 0.45:
            risk_level = "高风险"
        elif local_health < 0.65:
            risk_level = "中风险"
        else:
            risk_level = "低风险"
        
        return {
            "slice_id": f"slice_r{row}_c{col}",
            "row": row,
            "col": col,
            "bounds": bounds,
            "stain_count": stain_count,
            "total_stain_area": round(total_stain_area, 2),
            "avg_brightness": round(brightness, 3),
            "texture_score": round(texture, 2),
            "local_health": round(local_health, 3),
            "dominant_stain_type": dominant_type,
            "risk_level": risk_level
        }
    
    @staticmethod
    def _detect_stains_in_slice(slice_img: np.ndarray, slice_gray: np.ndarray) -> List[Dict[str, Any]]:
        stains = []
        
        _, binary = cv2.threshold(slice_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 5:
                stains.append({
                    "area": area,
                    "type": "检测到"
                })
        
        return stains
    
    @staticmethod
    def _identify_high_risk_areas(slices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        high_risk = []
        for s in slices:
            if s["risk_level"] == "高风险" or s["stain_count"] >= 3:
                high_risk.append({
                    "slice_id": s["slice_id"],
                    "position": f"第{s['row']+1}行第{s['col']+1}列",
                    "local_health": s["local_health"],
                    "stain_count": s["stain_count"],
                    "reason": "高风险区域" if s["risk_level"] == "高风险" else f"检测到{s['stain_count']}处污渍"
                })
        return high_risk
    
    @staticmethod
    def _generate_overall_summary(slices: List[Dict[str, Any]], 
                                   rows: int, cols: int) -> Dict[str, Any]:
        total_slices = rows * cols
        high_risk_count = sum(1 for s in slices if s["risk_level"] == "高风险")
        medium_risk_count = sum(1 for s in slices if s["risk_level"] == "中风险")
        low_risk_count = total_slices - high_risk_count - medium_risk_count
        
        avg_health = sum(s["local_health"] for s in slices) / total_slices
        total_stains = sum(s["stain_count"] for s in slices)
        
        return {
            "total_slices": total_slices,
            "high_risk_count": high_risk_count,
            "medium_risk_count": medium_risk_count,
            "low_risk_count": low_risk_count,
            "average_health_score": round(avg_health, 3),
            "total_stains_detected": total_stains,
            "overall_risk_level": "高风险" if high_risk_count >= total_slices * 0.25 else 
                                 ("中风险" if medium_risk_count + high_risk_count >= total_slices * 0.25 else "低风险")
        }
