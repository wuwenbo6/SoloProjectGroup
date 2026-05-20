import cv2
import numpy as np
from typing import Tuple, List, Dict, Optional
import json
from database import SessionLocal
from models import ModelConfig


class FiberImageProcessor:
    def __init__(self):
        self._load_config()

    def _load_config(self):
        db = SessionLocal()
        try:
            active_config = db.query(ModelConfig).filter(ModelConfig.is_active == 1).first()
            if active_config:
                self.strength_thresholds = json.loads(active_config.strength_thresholds)
                self.fiber_colors_hsv = json.loads(active_config.fiber_color_ranges)
                self.impurity_classifier = json.loads(active_config.impurity_classifier)
            else:
                self._init_default_config()
        except:
            self._init_default_config()
        finally:
            db.close()

    def _init_default_config(self):
        self.strength_thresholds = {
            'A': {'min': 5.5, 'name': '特级'},
            'B': {'min': 4.5, 'name': '一级'},
            'C': {'min': 3.5, 'name': '二级'},
            'D': {'min': 2.5, 'name': '三级'},
            'E': {'min': 0, 'name': '不合格'}
        }
        self.fiber_colors_hsv = {
            'cotton': {'lower': [0, 0, 180], 'upper': [180, 30, 255]},
            'polyester': {'lower': [100, 20, 100], 'upper': [140, 80, 200]},
            'wool': {'lower': [10, 10, 100], 'upper': [30, 60, 180]},
            'silk': {'lower': [20, 5, 200], 'upper': [40, 30, 255]},
        }
        self.impurity_classifier = {
            'particle': {'sources': ['粉尘', '空气中污染物']},
            'fiber_debris': {'sources': ['机器磨损', '原料残渣']},
            'large_contaminant': {'sources': ['包装材料', '外部杂物']},
            'metal_shard': {'sources': ['设备零件', '工具磨损']},
            'stain': {'sources': ['水渍', '油渍', '染料残留']}
        }

    def reload_config(self):
        self._load_config()
        return True

    def resize_image_if_needed(self, img, max_size=1024):
        h, w = img.shape[:2]
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return img

    def analyze_fiber_ratio(self, image_path: str) -> Dict[str, float]:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")

        img = self.resize_image_if_needed(img)
        img_hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        total_pixels = img.shape[0] * img.shape[1]

        masks = {}
        for fiber_name, color_range in self.fiber_colors_hsv.items():
            lower = np.array(color_range['lower'], dtype=np.uint8)
            upper = np.array(color_range['upper'], dtype=np.uint8)
            masks[fiber_name] = cv2.inRange(img_hsv, lower, upper)

        pixel_counts = {}
        used_pixels = np.zeros((img.shape[0], img.shape[1]), dtype=bool)

        fiber_order = ['polyester', 'wool', 'silk', 'cotton']
        for fiber_name in fiber_order:
            mask = masks[fiber_name]
            mask = mask & (~used_pixels)
            pixel_count = np.count_nonzero(mask)
            pixel_counts[fiber_name] = pixel_count
            used_pixels = used_pixels | mask.astype(bool)

        remaining_pixels = total_pixels - np.sum(list(pixel_counts.values()))
        pixel_counts['other'] = max(0, remaining_pixels)

        ratios = {}
        for fiber_name, count in pixel_counts.items():
            ratios[fiber_name] = round((count / total_pixels) * 100, 2)

        return ratios

    def calculate_strength(self, image_path: str, fiber_ratio: Dict[str, float]) -> float:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")

        img = self.resize_image_if_needed(img)

        fiber_strength = {
            'cotton': 3.5,
            'polyester': 7.0,
            'wool': 2.5,
            'silk': 4.5,
            'other': 2.0
        }

        edges = cv2.Canny(img, 30, 100)
        edge_density = np.count_nonzero(edges) / (img.shape[0] * img.shape[1])

        img_std = np.std(img)
        uniformity = 1.0 - (img_std / 255.0) * 0.5

        blurred = cv2.GaussianBlur(img, (5, 5), 0)
        laplacian_var = cv2.Laplacian(blurred, cv2.CV_64F).var()
        texture_score = min(1.0, laplacian_var / 1000.0)

        weighted_strength = 0.0
        for fiber, ratio in fiber_ratio.items():
            weighted_strength += (ratio / 100) * fiber_strength.get(fiber, 2.0)

        final_strength = weighted_strength * (0.6 + 0.25 * uniformity + 0.15 * min(1.0, edge_density * 5))
        return round(final_strength, 2)

    def get_strength_level(self, strength: float) -> Dict:
        for level in ['A', 'B', 'C', 'D', 'E']:
            if strength >= self.strength_thresholds[level]['min']:
                return {
                    'level': level,
                    'name': self.strength_thresholds[level]['name'],
                    'threshold': self.strength_thresholds[level]['min']
                }
        return {'level': 'E', 'name': '不合格', 'threshold': 0}

    def detect_impurities(self, image_path: str) -> Tuple[int, List[Dict], Dict]:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")

        img = self.resize_image_if_needed(img)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv2.findContours(opening, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        impurities = []
        impurity_count = 0
        impurity_type_counts = {}

        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 20 and area < 10000:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = float(w) / h if h > 0 else 0

                impurity_type = 'particle'
                if aspect_ratio > 5:
                    impurity_type = 'fiber_debris'
                elif area > 800:
                    impurity_type = 'large_contaminant'
                elif 100 < area < 500 and aspect_ratio < 1.5:
                    impurity_type = 'metal_shard'
                elif area > 50 and aspect_ratio < 2:
                    impurity_type = 'stain'

                impurity_type_counts[impurity_type] = impurity_type_counts.get(impurity_type, 0) + 1

                impurities.append({
                    'type': impurity_type,
                    'count': 1,
                    'area': round(area, 2),
                    'position': {'x': x, 'y': y, 'w': w, 'h': h}
                })
                impurity_count += 1

        impurity_source = self.trace_impurity_source(impurity_type_counts)

        return impurity_count, impurities, impurity_source

    def trace_impurity_source(self, impurity_type_counts: Dict[str, int]) -> Dict:
        source_counts = {}
        total_impurities = sum(impurity_type_counts.values())

        for impurity_type, count in impurity_type_counts.items():
            sources = self.impurity_classifier.get(impurity_type, {}).get('sources', ['未知来源'])
            for source in sources:
                source_counts[source] = source_counts.get(source, 0) + count

        result = {
            'primary_source': max(source_counts, key=source_counts.get) if source_counts else '无',
            'source_distribution': source_counts,
            'severity': self._calculate_severity(total_impurities),
            'recommendations': self._generate_recommendations(source_counts)
        }

        return result

    def _calculate_severity(self, total_impurities: int) -> str:
        if total_impurities == 0:
            return '优秀'
        elif total_impurities <= 3:
            return '良好'
        elif total_impurities <= 8:
            return '中等'
        else:
            return '严重'

    def _generate_recommendations(self, source_counts: Dict) -> List[str]:
        recommendations = []
        if not source_counts:
            return ['无需特殊处理，继续保持']

        max_source = max(source_counts, key=source_counts.get)

        if '粉尘' in max_source or '空气中污染物' in max_source:
            recommendations.append('建议净化生产车间空气，增加防尘措施')
            recommendations.append('定期清理设备表面灰尘')
        if '机器磨损' in max_source or '原料残渣' in max_source:
            recommendations.append('检查设备是否有过度磨损，及时更换部件')
            recommendations.append('优化原料清洗工艺')
        if '包装材料' in max_source or '外部杂物' in max_source:
            recommendations.append('加强原料入库检验，更换包装材料')
            recommendations.append('检查生产环境密封性')
        if '设备零件' in max_source or '工具磨损' in max_source:
            recommendations.append('立即停机检查设备，查找脱落零件来源')
            recommendations.append('加强设备日常维护')
        if '水渍' in max_source or '油渍' in max_source or '染料残留' in max_source:
            recommendations.append('检查生产环境湿度控制')
            recommendations.append('优化染料清洗工序')

        if not recommendations:
            recommendations.append('建议加强质量监控，定期检查生产环境')

        return recommendations

    def process_image(self, image_path: str) -> Dict:
        fiber_ratio = self.analyze_fiber_ratio(image_path)
        strength = self.calculate_strength(image_path, fiber_ratio)
        strength_level = self.get_strength_level(strength)
        impurity_count, impurity_details, impurity_source = self.detect_impurities(image_path)

        return {
            'fiber_ratio': fiber_ratio,
            'strength': strength,
            'strength_level': strength_level,
            'impurity_count': impurity_count,
            'impurity_details': impurity_details,
            'impurity_source': impurity_source
        }

    def get_config_info(self) -> Dict:
        return {
            'strength_thresholds': self.strength_thresholds,
            'fiber_colors_hsv': self.fiber_colors_hsv,
            'impurity_classifier': self.impurity_classifier
        }


processor = FiberImageProcessor()
