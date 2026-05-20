import cv2
import numpy as np
from typing import Dict, List, Tuple
from scipy import stats
from scipy.signal import find_peaks
from collections import defaultdict
import json
import os
from datetime import datetime


class FiberOrientationAnalyzer:
    def __init__(self):
        self.orientation_bins = 18
        self.bin_width = 180 / self.orientation_bins

    def analyze_orientation(self, image: np.ndarray, segmentation_result: Dict) -> Dict:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image.copy()

        fibers = segmentation_result.get('fibers', [])
        
        orientation_stats = self._calculate_detailed_orientation(fibers)
        texture_orientation = self._analyze_texture_orientation(gray)
        alignment_score = self._calculate_alignment_score(fibers)
        
        return {
            'orientation_distribution': orientation_stats['distribution'],
            'dominant_orientation': orientation_stats['dominant'],
            'orientation_entropy': orientation_stats['entropy'],
            'alignment_score': alignment_score,
            'orientation_uniformity': orientation_stats['uniformity'],
            'texture_orientation': texture_orientation,
            'fiber_count_by_orientation': orientation_stats['count_by_bin']
        }

    def _calculate_detailed_orientation(self, fibers: List[Dict]) -> Dict:
        if not fibers:
            return {
                'distribution': {},
                'dominant': 0,
                'entropy': 0,
                'uniformity': 0,
                'count_by_bin': []
            }

        orientations = [f['orientation'] for f in fibers]
        counts = defaultdict(int)
        
        for angle in orientations:
            bin_idx = int(angle // self.bin_width)
            bin_label = f"{int(bin_idx * self.bin_width)}-{int((bin_idx + 1) * self.bin_width)}°"
            counts[bin_label] += 1

        distribution = dict(counts)
        total = sum(distribution.values())
        
        if total > 0:
            probabilities = [c / total for c in distribution.values()]
            entropy = -sum(p * np.log2(p) if p > 0 else 0 for p in probabilities)
            max_entropy = np.log2(len(distribution)) if len(distribution) > 0 else 1
            uniformity = 1 - (entropy / max_entropy) if max_entropy > 0 else 0
        else:
            entropy = 0
            uniformity = 0

        dominant = max(distribution.items(), key=lambda x: x[1])[0] if distribution else '0-10°'
        
        count_by_bin = [{'angle': k, 'count': v} for k, v in distribution.items()]

        return {
            'distribution': distribution,
            'dominant': dominant,
            'entropy': float(entropy),
            'uniformity': float(uniformity),
            'count_by_bin': count_by_bin
        }

    def _analyze_texture_orientation(self, gray: np.ndarray) -> Dict:
        gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        
        magnitude = np.sqrt(gx**2 + gy**2)
        angle = np.arctan2(gy, gx) * 180 / np.pi
        angle = (angle + 180) % 180
        
        strong_edges = magnitude > np.mean(magnitude) * 2
        valid_angles = angle[strong_edges]
        
        if len(valid_angles) == 0:
            return {'dominant_texture_angle': 0, 'texture_coherence': 0}
        
        hist, bin_edges = np.histogram(valid_angles, bins=18, range=(0, 180))
        dominant_idx = np.argmax(hist)
        dominant_angle = (bin_edges[dominant_idx] + bin_edges[dominant_idx + 1]) / 2
        
        total = np.sum(hist)
        if total > 0:
            normalized_hist = hist / total
            coherence = np.max(normalized_hist)
        else:
            coherence = 0

        return {
            'dominant_texture_angle': float(dominant_angle),
            'texture_coherence': float(coherence)
        }

    def _calculate_alignment_score(self, fibers: List[Dict]) -> float:
        if len(fibers) < 2:
            return 0.0

        orientations = np.array([f['orientation'] for f in fibers])
        orientations_rad = np.radians(orientations)
        
        mean_cos = np.mean(np.cos(2 * orientations_rad))
        mean_sin = np.mean(np.sin(2 * orientations_rad))
        
        alignment = np.sqrt(mean_cos**2 + mean_sin**2)
        
        return float(alignment)


class DurabilityPredictor:
    def __init__(self):
        self.factors = {
            'fiber_density': 0.25,
            'fiber_alignment': 0.20,
            'aging_level': 0.25,
            'fiber_strength': 0.15,
            'damage_risk': 0.15
        }

    def predict_durability(self, image: np.ndarray, segmentation_result: Dict, 
                          aging_result: Dict, damage_result: Dict) -> Dict:
        feature_scores = self._calculate_feature_scores(
            segmentation_result, aging_result, damage_result
        )
        
        overall_score = self._compute_overall_score(feature_scores)
        lifespan_prediction = self._estimate_lifespan(overall_score, aging_result)
        failure_risks = self._assess_failure_risks(feature_scores, damage_result)
        recommendations = self._generate_recommendations(feature_scores, overall_score)

        return {
            'durability_score': float(overall_score),
            'durability_level': self._get_durability_level(overall_score),
            'feature_contributions': feature_scores,
            'lifespan_prediction': lifespan_prediction,
            'failure_risks': failure_risks,
            'recommendations': recommendations
        }

    def _calculate_feature_scores(self, segmentation: Dict, aging: Dict, damage: Dict) -> Dict:
        fiber_density = segmentation.get('fiber_density', 0.5)
        density_score = min(fiber_density * 2, 1.0)

        orientation = segmentation.get('orientation_distribution', {})
        if orientation:
            max_count = max(orientation.values()) if orientation.values() else 0
            total = sum(orientation.values()) if orientation.values() else 1
            alignment_score = max_count / total if total > 0 else 0
        else:
            alignment_score = 0.5

        aging_level = aging.get('level', 3)
        aging_score = 1 - (aging_level - 1) / 4

        avg_length = segmentation.get('average_length', 50)
        avg_width = segmentation.get('average_width', 10)
        aspect_ratio = avg_length / (avg_width + 1e-6)
        strength_score = min(aspect_ratio / 10, 1.0)

        overall_risk = damage.get('overall_risk_level', 'low')
        risk_map = {'low': 1.0, 'medium': 0.7, 'high': 0.4, 'critical': 0.1}
        damage_score = risk_map.get(overall_risk, 0.5)

        return {
            'fiber_density_score': float(density_score),
            'fiber_alignment_score': float(alignment_score),
            'aging_resistance_score': float(aging_score),
            'fiber_strength_score': float(strength_score),
            'damage_resistance_score': float(damage_score)
        }

    def _compute_overall_score(self, feature_scores: Dict) -> float:
        score = sum(
            feature_scores[f'{k}_score'] * v 
            for k, v in self.factors.items()
        )
        return max(0, min(score, 1.0))

    def _get_durability_level(self, score: float) -> str:
        if score >= 0.8:
            return 'Excellent'
        elif score >= 0.65:
            return 'Good'
        elif score >= 0.5:
            return 'Moderate'
        elif score >= 0.35:
            return 'Poor'
        else:
            return 'Critical'

    def _estimate_lifespan(self, score: float, aging_result: Dict) -> Dict:
        base_lifespan = 20
        
        aging_level = aging_result.get('level', 3)
        aging_factor = 1 - (aging_level - 1) * 0.15
        
        estimated_years = base_lifespan * score * aging_factor
        
        confidence = 0.7 + score * 0.25
        
        factors = []
        if score > 0.7:
            factors.append('纤维结构良好，耐久性强')
        elif score > 0.5:
            factors.append('纤维结构一般，需正常维护')
        else:
            factors.append('纤维结构较弱，建议加强维护')

        return {
            'estimated_years': float(estimated_years),
            'remaining_percentage': float(score * 100),
            'confidence': float(confidence),
            'influencing_factors': factors
        }

    def _assess_failure_risks(self, feature_scores: Dict, damage_result: Dict) -> List[Dict]:
        risks = []
        
        density_score = feature_scores['fiber_density_score']
        if density_score < 0.5:
            risks.append({
                'type': 'fiber_density',
                'risk': 'high',
                'description': '纤维密度较低，可能导致结构强度不足',
                'probability': 1 - density_score
            })

        alignment_score = feature_scores['fiber_alignment_score']
        if alignment_score < 0.4:
            risks.append({
                'type': 'fiber_alignment',
                'risk': 'medium',
                'description': '纤维排列不均匀，可能导致各向异性强度',
                'probability': 1 - alignment_score
            })

        damage_risks = damage_result.get('risk_assessment', {})
        if damage_risks.get('crack_risk', 0) > 0.5:
            risks.append({
                'type': 'crack_propagation',
                'risk': 'high',
                'description': '存在裂纹扩展风险，可能导致断裂',
                'probability': damage_risks['crack_risk']
            })

        if damage_risks.get('degradation_risk', 0) > 0.5:
            risks.append({
                'type': 'material_degradation',
                'risk': 'medium',
                'description': '材料降解风险较高，可能加速老化',
                'probability': damage_risks['degradation_risk']
            })

        return risks

    def _generate_recommendations(self, feature_scores: Dict, overall_score: float) -> List[str]:
        recommendations = []

        if overall_score < 0.5:
            recommendations.append('建议立即进行全面检测和必要的修复工作')
        elif overall_score < 0.65:
            recommendations.append('建议进行预防性维护，延长使用寿命')

        if feature_scores['fiber_density_score'] < 0.6:
            recommendations.append('考虑增强处理以提高纤维密度')
        
        if feature_scores['damage_resistance_score'] < 0.6:
            recommendations.append('建议进行损伤修复，防止问题扩大')
        
        if feature_scores['aging_resistance_score'] < 0.6:
            recommendations.append('建议改善存储环境，减缓老化速度')

        if not recommendations:
            recommendations.append('当前状态良好，继续正常维护即可')

        return recommendations


class PaperTracing:
    def __init__(self, database_path: str = 'paper_database.json'):
        self.database_path = database_path
        self.database = self._load_database()

    def _load_database(self) -> Dict:
        if os.path.exists(self.database_path):
            with open(self.database_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            'samples': [],
            'last_update': datetime.now().isoformat()
        }

    def _save_database(self):
        self.database['last_update'] = datetime.now().isoformat()
        with open(self.database_path, 'w', encoding='utf-8') as f:
            json.dump(self.database, f, indent=2, ensure_ascii=False)

    def extract_fingerprint(self, image: np.ndarray, segmentation_result: Dict, 
                          orientation_result: Dict) -> Dict:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image.copy()

        texture_features = self._extract_texture_features(gray)
        fiber_features = self._extract_fiber_features(segmentation_result)
        orientation_features = self._extract_orientation_features(orientation_result)
        color_features = self._extract_color_features(image)

        fingerprint = {
            'texture': texture_features,
            'fiber': fiber_features,
            'orientation': orientation_features,
            'color': color_features,
            'feature_vector': self._create_feature_vector(
                texture_features, fiber_features, orientation_features, color_features
            )
        }

        return fingerprint

    def _extract_texture_features(self, gray: np.ndarray) -> Dict:
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist.flatten() / hist.sum()

        mean_intensity = np.mean(gray)
        std_intensity = np.std(gray)
        skewness = stats.skew(gray.flatten())
        kurtosis = stats.kurtosis(gray.flatten())

        entropy = -np.sum(hist * np.log2(hist + 1e-10))

        return {
            'mean_intensity': float(mean_intensity),
            'std_intensity': float(std_intensity),
            'skewness': float(skewness),
            'kurtosis': float(kurtosis),
            'entropy': float(entropy)
        }

    def _extract_fiber_features(self, segmentation: Dict) -> Dict:
        return {
            'fiber_density': float(segmentation.get('fiber_density', 0)),
            'fiber_count': int(segmentation.get('fiber_count', 0)),
            'average_length': float(segmentation.get('average_length', 0)),
            'average_width': float(segmentation.get('average_width', 0)),
            'total_fiber_area': int(segmentation.get('total_fiber_area', 0))
        }

    def _extract_orientation_features(self, orientation: Dict) -> Dict:
        return {
            'dominant_orientation': str(orientation.get('dominant_orientation', '')),
            'alignment_score': float(orientation.get('alignment_score', 0)),
            'orientation_uniformity': float(orientation.get('orientation_uniformity', 0))
        }

    def _extract_color_features(self, image: np.ndarray) -> Dict:
        if len(image.shape) == 3:
            means = np.mean(image, axis=(0, 1))
            stds = np.std(image, axis=(0, 1))
            return {
                'r_mean': float(means[0]),
                'g_mean': float(means[1]),
                'b_mean': float(means[2]),
                'r_std': float(stds[0]),
                'g_std': float(stds[1]),
                'b_std': float(stds[2])
            }
        else:
            mean = np.mean(image)
            std = np.std(image)
            return {
                'intensity_mean': float(mean),
                'intensity_std': float(std)
            }

    def _create_feature_vector(self, texture: Dict, fiber: Dict, 
                             orientation: Dict, color: Dict) -> List[float]:
        vector = []
        
        vector.append(texture.get('mean_intensity', 0) / 255.0)
        vector.append(texture.get('std_intensity', 0) / 128.0)
        vector.append(texture.get('entropy', 0) / 8.0)
        
        vector.append(fiber.get('fiber_density', 0))
        vector.append(min(fiber.get('fiber_count', 0) / 1000.0, 1.0))
        vector.append(min(fiber.get('average_length', 0) / 100.0, 1.0))
        
        vector.append(orientation.get('alignment_score', 0))
        vector.append(orientation.get('orientation_uniformity', 0))
        
        if 'r_mean' in color:
            vector.append(color.get('r_mean', 0) / 255.0)
            vector.append(color.get('g_mean', 0) / 255.0)
            vector.append(color.get('b_mean', 0) / 255.0)
        else:
            vector.append(color.get('intensity_mean', 0) / 255.0)
            vector.append(color.get('intensity_mean', 0) / 255.0)
            vector.append(color.get('intensity_mean', 0) / 255.0)

        return vector

    def trace_origin(self, fingerprint: Dict) -> Dict:
        feature_vector = fingerprint.get('feature_vector', [])
        
        if not self.database['samples']:
            return {
                'match_found': False,
                'best_match': None,
                'similarity_score': 0,
                'possible_origins': [],
                'recommendation': '数据库中无参考样本，建议添加参考样本以提高溯源准确性'
            }

        similarities = []
        for sample in self.database['samples']:
            sample_vector = sample.get('fingerprint', {}).get('feature_vector', [])
            if len(sample_vector) == len(feature_vector):
                similarity = 1 - np.mean(np.abs(
                    np.array(feature_vector) - np.array(sample_vector)
                ))
                similarities.append((sample, similarity))

        if not similarities:
            return {
                'match_found': False,
                'best_match': None,
                'similarity_score': 0,
                'possible_origins': []
            }

        similarities.sort(key=lambda x: x[1], reverse=True)
        best_match, best_score = similarities[0]

        threshold = 0.85
        match_found = best_score >= threshold

        possible_origins = [
            {
                'sample_id': s[0].get('sample_id'),
                'origin': s[0].get('origin_info', {}),
                'similarity': float(s[1])
            }
            for s in similarities[:3] if s[1] >= 0.7
        ]

        return {
            'match_found': match_found,
            'best_match': {
                'sample_id': best_match.get('sample_id'),
                'origin_info': best_match.get('origin_info', {}),
                'similarity_score': float(best_score)
            } if match_found else None,
            'similarity_score': float(best_score),
            'possible_origins': possible_origins,
            'confidence': 'high' if best_score >= 0.9 else 'medium' if best_score >= 0.75 else 'low'
        }

    def add_reference_sample(self, fingerprint: Dict, origin_info: Dict, 
                           sample_id: str = None) -> str:
        if sample_id is None:
            sample_id = f"sample_{len(self.database['samples']) + 1}_{datetime.now().strftime('%Y%m%d')}"

        self.database['samples'].append({
            'sample_id': sample_id,
            'fingerprint': fingerprint,
            'origin_info': origin_info,
            'added_at': datetime.now().isoformat()
        })

        self._save_database()
        return sample_id

    def get_database_stats(self) -> Dict:
        samples = self.database['samples']
        origins = defaultdict(int)
        for s in samples:
            origin = s.get('origin_info', {}).get('manufacturer', 'Unknown')
            origins[origin] += 1

        return {
            'total_samples': len(samples),
            'unique_origins': len(origins),
            'origin_distribution': dict(origins),
            'last_update': self.database.get('last_update', '')
        }


class ModelFineTuner:
    def __init__(self, config_path: str = 'model_config.json'):
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self) -> Dict:
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        return {
            'segmentation_params': {
                'min_fiber_area': 20,
                'max_fiber_area': 15000,
                'threshold_method': 'otsu_local',
                'clahe_clip_limit': 3.0,
                'use_bilateral_filter': True
            },
            'aging_params': {
                'weight_fiber_density': 0.15,
                'weight_texture_contrast': 0.20,
                'weight_sharpness': 0.15,
                'weight_breakage_index': 0.25,
                'weight_length_variance': 0.15,
                'weight_orientation_entropy': 0.10,
                'level_thresholds': [0.8, 1.7, 2.6, 3.5]
            },
            'durability_params': {
                'base_lifespan_years': 20,
                'weight_fiber_density': 0.25,
                'weight_alignment': 0.20,
                'weight_aging': 0.25,
                'weight_strength': 0.15,
                'weight_damage': 0.15
            },
            'training_history': [],
            'last_trained': None,
            'version': '1.0.0'
        }

    def _save_config(self):
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def fine_tune_segmentation(self, feedback_data: Dict) -> Dict:
        params = self.config['segmentation_params']
        
        if 'min_area_adjustment' in feedback_data:
            params['min_fiber_area'] = max(10, params['min_fiber_area'] + feedback_data['min_area_adjustment'])
        
        if 'clahe_adjustment' in feedback_data:
            params['clahe_clip_limit'] = max(1.0, min(5.0, params['clahe_clip_limit'] + feedback_data['clahe_adjustment']))
        
        if 'threshold_method' in feedback_data:
            params['threshold_method'] = feedback_data['threshold_method']

        self._record_training('segmentation', feedback_data)
        self._save_config()

        return {
            'success': True,
            'updated_params': params,
            'message': '分割参数已更新'
        }

    def fine_tune_aging(self, feedback_data: Dict) -> Dict:
        params = self.config['aging_params']
        
        if 'weight_adjustments' in feedback_data:
            adjustments = feedback_data['weight_adjustments']
            for key, delta in adjustments.items():
                if key in params:
                    params[key] = max(0, min(1, params[key] + delta))
        
        if 'level_thresholds' in feedback_data:
            params['level_thresholds'] = feedback_data['level_thresholds']

        self._record_training('aging', feedback_data)
        self._save_config()

        return {
            'success': True,
            'updated_params': params,
            'message': '老化评估参数已更新'
        }

    def fine_tune_durability(self, feedback_data: Dict) -> Dict:
        params = self.config['durability_params']
        
        if 'weight_adjustments' in feedback_data:
            adjustments = feedback_data['weight_adjustments']
            for key, delta in adjustments.items():
                if key in params:
                    params[key] = max(0, min(1, params[key] + delta))
        
        if 'base_lifespan' in feedback_data:
            params['base_lifespan_years'] = feedback_data['base_lifespan']

        self._record_training('durability', feedback_data)
        self._save_config()

        return {
            'success': True,
            'updated_params': params,
            'message': '耐久性预测参数已更新'
        }

    def _record_training(self, module: str, feedback: Dict):
        self.config['training_history'].append({
            'module': module,
            'timestamp': datetime.now().isoformat(),
            'feedback': feedback
        })
        self.config['last_trained'] = datetime.now().isoformat()

    def get_current_params(self) -> Dict:
        return self.config

    def get_training_history(self, limit: int = 10) -> List[Dict]:
        return self.config.get('training_history', [])[-limit:]

    def reset_to_default(self) -> Dict:
        default_config = {
            'segmentation_params': {
                'min_fiber_area': 20,
                'max_fiber_area': 15000,
                'threshold_method': 'otsu_local',
                'clahe_clip_limit': 3.0,
                'use_bilateral_filter': True
            },
            'aging_params': {
                'weight_fiber_density': 0.15,
                'weight_texture_contrast': 0.20,
                'weight_sharpness': 0.15,
                'weight_breakage_index': 0.25,
                'weight_length_variance': 0.15,
                'weight_orientation_entropy': 0.10,
                'level_thresholds': [0.8, 1.7, 2.6, 3.5]
            },
            'durability_params': {
                'base_lifespan_years': 20,
                'weight_fiber_density': 0.25,
                'weight_alignment': 0.20,
                'weight_aging': 0.25,
                'weight_strength': 0.15,
                'weight_damage': 0.15
            },
            'training_history': self.config.get('training_history', []),
            'last_trained': self.config.get('last_trained'),
            'version': '1.0.0'
        }

        self.config = default_config
        self._save_config()

        return {
            'success': True,
            'message': '已重置为默认参数'
        }
