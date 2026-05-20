import numpy as np
import cv2
from typing import Dict, List, Tuple
from collections import defaultdict


class AgingAnalyzer:
    def __init__(self):
        self.aging_levels = {
            1: "Grade 1 - 轻微老化",
            2: "Grade 2 - 轻度老化",
            3: "Grade 3 - 中度老化",
            4: "Grade 4 - 重度老化",
            5: "Grade 5 - 严重老化"
        }

    def analyze(self, image: np.ndarray, segmentation_result: Dict) -> Dict:
        features = self._extract_aging_features(image, segmentation_result)
        aging_score = self._calculate_aging_score(features)
        aging_level = self._determine_aging_level(aging_score)
        
        return {
            'level': aging_level,
            'level_description': self.aging_levels[aging_level],
            'score': float(aging_score),
            'features': features,
            'confidence': self._calculate_confidence(features)
        }

    def _extract_aging_features(self, image: np.ndarray, segmentation_result: Dict) -> Dict:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image.copy()

        fiber_density = segmentation_result.get('fiber_density', 0)
        fiber_count = segmentation_result.get('fiber_count', 0)
        avg_length = segmentation_result.get('average_length', 0)
        avg_width = segmentation_result.get('average_width', 0)
        
        texture_contrast = np.std(gray)
        
        mean_intensity = np.mean(gray)
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = np.var(laplacian)
        
        fiber_length_variance = 0
        fibers = segmentation_result.get('fibers', [])
        if fibers:
            lengths = [f['length'] for f in fibers]
            fiber_length_variance = np.var(lengths) if len(lengths) > 1 else 0
        
        orientation_entropy = self._calculate_orientation_entropy(
            segmentation_result.get('orientation_distribution', {})
        )
        
        breakage_index = self._calculate_breakage_index(fibers)

        return {
            'fiber_density': float(fiber_density),
            'fiber_count': int(fiber_count),
            'average_length': float(avg_length),
            'average_width': float(avg_width),
            'texture_contrast': float(texture_contrast),
            'mean_intensity': float(mean_intensity),
            'sharpness': float(sharpness),
            'fiber_length_variance': float(fiber_length_variance),
            'orientation_entropy': float(orientation_entropy),
            'breakage_index': float(breakage_index)
        }

    def _calculate_aging_score(self, features: Dict) -> float:
        weights = {
            'fiber_density': 0.15,
            'texture_contrast': 0.20,
            'sharpness': 0.15,
            'breakage_index': 0.25,
            'fiber_length_variance': 0.15,
            'orientation_entropy': 0.10
        }
        
        normalized = self._normalize_features(features)
        
        score = 0
        for feature, weight in weights.items():
            score += normalized.get(feature, 0) * weight
        
        return score * 5

    def _normalize_features(self, features: Dict) -> Dict:
        normalized = {}
        
        density_norm = min(features['fiber_density'] / 0.4, 1.0)
        normalized['fiber_density'] = 1 - density_norm
        
        contrast_norm = min(features['texture_contrast'] / 80, 1.0)
        normalized['texture_contrast'] = contrast_norm
        
        sharpness_value = features['sharpness']
        if sharpness_value < 50:
            sharpness_norm = 1.0
        elif sharpness_value < 200:
            sharpness_norm = 0.8 - (sharpness_value - 50) / 150 * 0.3
        elif sharpness_value < 500:
            sharpness_norm = 0.5 - (sharpness_value - 200) / 300 * 0.3
        else:
            sharpness_norm = max(0, 0.2 - (sharpness_value - 500) / 1000 * 0.2)
        normalized['sharpness'] = sharpness_norm
        
        breakage_index = features['breakage_index']
        if breakage_index < 0.1:
            breakage_norm = breakage_index * 2
        else:
            breakage_norm = min(breakage_index / 0.4, 1.0)
        normalized['breakage_index'] = breakage_norm
        
        length_variance = features['fiber_length_variance']
        if length_variance < 50:
            length_var_norm = length_variance / 50 * 0.3
        elif length_variance < 200:
            length_var_norm = 0.3 + (length_variance - 50) / 150 * 0.4
        else:
            length_var_norm = min(0.7 + (length_variance - 200) / 400 * 0.3, 1.0)
        normalized['fiber_length_variance'] = length_var_norm
        
        entropy = features['orientation_entropy']
        if entropy < 0.5:
            entropy_norm = entropy / 0.5 * 0.3
        elif entropy < 1.5:
            entropy_norm = 0.3 + (entropy - 0.5) * 0.5
        else:
            entropy_norm = min(0.8 + (entropy - 1.5) / 1.0 * 0.2, 1.0)
        normalized['orientation_entropy'] = entropy_norm
        
        return normalized

    def _determine_aging_level(self, score: float) -> int:
        if score < 0.8:
            return 1
        elif score < 1.7:
            return 2
        elif score < 2.6:
            return 3
        elif score < 3.5:
            return 4
        else:
            return 5

    def _calculate_orientation_entropy(self, distribution: Dict[str, int]) -> float:
        total = sum(distribution.values())
        if total == 0:
            return 0
        
        entropy = 0
        for count in distribution.values():
            if count > 0:
                p = count / total
                entropy -= p * np.log2(p)
        
        return entropy

    def _calculate_breakage_index(self, fibers: List[Dict]) -> float:
        if not fibers:
            return 0
        
        short_fibers = sum(1 for f in fibers if f['length'] < 20)
        return short_fibers / len(fibers)

    def _calculate_confidence(self, features: Dict) -> float:
        fiber_count = features['fiber_count']
        if fiber_count < 10:
            return 0.6
        elif fiber_count < 50:
            return 0.75
        elif fiber_count < 100:
            return 0.85
        else:
            return 0.95


class DamagePredictor:
    def __init__(self):
        self.damage_types = {
            'surface_crack': '表面裂纹',
            'fiber_breakage': '纤维断裂',
            'delamination': '分层剥落',
            'void_formation': '空洞形成',
            'matrix_degradation': '基体降解'
        }

    def predict(self, image: np.ndarray, segmentation_result: Dict) -> Dict:
        damage_analysis = self._analyze_damage_indicators(image, segmentation_result)
        risk_assessment = self._assess_damage_risk(damage_analysis)
        predictions = self._generate_predictions(damage_analysis, risk_assessment)
        
        return {
            'current_damage': damage_analysis,
            'risk_assessment': risk_assessment,
            'predictions': predictions,
            'overall_risk_level': self._determine_overall_risk(risk_assessment)
        }

    def _analyze_damage_indicators(self, image: np.ndarray, segmentation_result: Dict) -> Dict:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image.copy()

        denoised = cv2.fastNlMeansDenoising(gray, None, h=3, templateWindowSize=7, searchWindowSize=21)
        
        edges = cv2.Canny(denoised, 30, 100)
        crack_density = np.sum(edges > 0) / (image.shape[0] * image.shape[1])
        
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        void_count = 0
        void_total_area = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            if 5 < area < 2000:
                void_count += 1
                void_total_area += area
        
        void_density = void_total_area / (image.shape[0] * image.shape[1]) if void_count > 0 else 0

        fibers = segmentation_result.get('fibers', [])
        breakages = self._detect_fiber_breakages(fibers)
        
        texture_uniformity = self._calculate_texture_uniformity(denoised)
        
        gradient_magnitude = self._calculate_gradient_magnitude(denoised)
        
        return {
            'crack_density': float(crack_density),
            'void_count': int(void_count),
            'void_density': float(void_density),
            'fiber_breakage_count': int(breakages['count']),
            'fiber_breakage_ratio': float(breakages['ratio']),
            'texture_uniformity': float(texture_uniformity),
            'gradient_magnitude': float(gradient_magnitude)
        }

    def _detect_fiber_breakages(self, fibers: List[Dict]) -> Dict:
        if not fibers:
            return {'count': 0, 'ratio': 0}
        
        breakage_count = sum(1 for f in fibers if f['solidity'] < 0.7 or f['length'] < 15)
        
        return {
            'count': breakage_count,
            'ratio': breakage_count / len(fibers)
        }

    def _calculate_texture_uniformity(self, gray: np.ndarray) -> float:
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist.flatten() / hist.sum()
        
        uniformity = np.sum(hist ** 2)
        return uniformity

    def _calculate_gradient_magnitude(self, gray: np.ndarray) -> float:
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(sobelx**2 + sobely**2)
        
        return np.mean(magnitude)

    def _assess_damage_risk(self, damage_indicators: Dict) -> Dict:
        crack_risk = min(damage_indicators['crack_density'] * 100, 1.0)
        void_risk = min(damage_indicators['void_density'] * 50, 1.0)
        breakage_risk = damage_indicators['fiber_breakage_ratio']
        texture_risk = 1 - damage_indicators['texture_uniformity']
        gradient_risk = min(damage_indicators['gradient_magnitude'] / 50, 1.0)
        
        return {
            'crack_risk': float(crack_risk),
            'void_risk': float(void_risk),
            'breakage_risk': float(breakage_risk),
            'degradation_risk': float((texture_risk + gradient_risk) / 2),
            'delamination_risk': float((crack_risk + texture_risk) / 2)
        }

    def _generate_predictions(self, indicators: Dict, risks: Dict) -> List[Dict]:
        predictions = []
        
        if risks['crack_risk'] > 0.3:
            predictions.append({
                'type': 'surface_crack',
                'type_description': self.damage_types['surface_crack'],
                'probability': float(risks['crack_risk']),
                'severity': self._get_severity(risks['crack_risk']),
                'recommendation': '建议进行表面检测和修复'
            })
        
        if risks['breakage_risk'] > 0.25:
            predictions.append({
                'type': 'fiber_breakage',
                'type_description': self.damage_types['fiber_breakage'],
                'probability': float(risks['breakage_risk']),
                'severity': self._get_severity(risks['breakage_risk']),
                'recommendation': '建议评估纤维完整性，考虑增强处理'
            })
        
        if risks['delamination_risk'] > 0.35:
            predictions.append({
                'type': 'delamination',
                'type_description': self.damage_types['delamination'],
                'probability': float(risks['delamination_risk']),
                'severity': self._get_severity(risks['delamination_risk']),
                'recommendation': '建议进行超声波检测，评估分层程度'
            })
        
        if risks['void_risk'] > 0.3:
            predictions.append({
                'type': 'void_formation',
                'type_description': self.damage_types['void_formation'],
                'probability': float(risks['void_risk']),
                'severity': self._get_severity(risks['void_risk']),
                'recommendation': '建议检查材料内部结构，考虑填充修复'
            })
        
        if risks['degradation_risk'] > 0.4:
            predictions.append({
                'type': 'matrix_degradation',
                'type_description': self.damage_types['matrix_degradation'],
                'probability': float(risks['degradation_risk']),
                'severity': self._get_severity(risks['degradation_risk']),
                'recommendation': '建议进行材料老化测试，评估剩余寿命'
            })
        
        return predictions

    def _get_severity(self, probability: float) -> str:
        if probability < 0.3:
            return 'low'
        elif probability < 0.6:
            return 'medium'
        else:
            return 'high'

    def _determine_overall_risk(self, risk_assessment: Dict) -> str:
        avg_risk = np.mean(list(risk_assessment.values()))
        
        if avg_risk < 0.2:
            return 'low'
        elif avg_risk < 0.4:
            return 'medium'
        elif avg_risk < 0.6:
            return 'high'
        else:
            return 'critical'
