import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import warnings


class StainType(Enum):
    WATER = "water"
    OIL = "oil"
    INK = "ink"
    MOLD = "mold"
    DUST = "dust"
    UNKNOWN = "unknown"


class DiffusionSeverity(Enum):
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


@dataclass
class StainRegion:
    id: int
    center: np.ndarray
    area: float
    perimeter: float
    max_depth: float
    avg_depth: float
    stain_type: StainType
    confidence: float
    boundary_points: np.ndarray


class StainDiffusionPredictor:
    def __init__(self):
        self.diffusion_coefficients = {
            StainType.WATER: 0.15,
            StainType.OIL: 0.08,
            StainType.INK: 0.12,
            StainType.MOLD: 0.20,
            StainType.DUST: 0.03,
            StainType.UNKNOWN: 0.10
        }
        
        self.environment_factors = {
            'humidity_high': 1.8,
            'humidity_normal': 1.0,
            'humidity_low': 0.5,
            'temperature_high': 1.5,
            'temperature_normal': 1.0,
            'temperature_low': 0.6,
            'light_exposure': 1.3,
            'contact_pressure': 2.0
        }
        
        self.paper_properties = {
            'porosity_high': 1.5,
            'porosity_normal': 1.0,
            'porosity_low': 0.5,
            'thickness_high': 0.7,
            'thickness_normal': 1.0,
            'thickness_low': 1.3
        }

    def detect_stain_regions(self, point_cloud_data: np.ndarray,
                             depth_threshold: float = -0.001,
                             min_region_size: int = 50) -> List[StainRegion]:
        if len(point_cloud_data) < min_region_size:
            return []
        
        stain_mask = point_cloud_data[:, 2] < depth_threshold
        
        if not np.any(stain_mask):
            return []
        
        stain_points = point_cloud_data[stain_mask]
        
        regions = self._cluster_stain_regions(stain_points, min_region_size)
        
        stain_regions = []
        for i, region_points in enumerate(regions):
            stain_type, confidence = self._classify_stain_type(region_points)
            
            stain_region = StainRegion(
                id=i,
                center=np.mean(region_points, axis=0),
                area=self._calculate_area(region_points),
                perimeter=self._calculate_perimeter(region_points),
                max_depth=np.min(region_points[:, 2]),
                avg_depth=np.mean(region_points[:, 2]),
                stain_type=stain_type,
                confidence=confidence,
                boundary_points=self._extract_boundary(region_points)
            )
            stain_regions.append(stain_region)
        
        return stain_regions

    def _cluster_stain_regions(self, points: np.ndarray,
                                min_region_size: int,
                                eps: float = 0.005) -> List[np.ndarray]:
        if len(points) < min_region_size:
            return []
        
        from sklearn.cluster import DBSCAN
        clustering = DBSCAN(eps=eps, min_samples=5).fit(points[:, :2])
        labels = clustering.labels_
        
        regions = []
        unique_labels = np.unique(labels)
        
        for label in unique_labels:
            if label == -1:
                continue
            mask = labels == label
            if np.sum(mask) >= min_region_size:
                regions.append(points[mask])
        
        return regions

    def _classify_stain_type(self, region_points: np.ndarray) -> Tuple[StainType, float]:
        depth_variance = np.var(region_points[:, 2])
        depth_mean = np.mean(region_points[:, 2])
        gradient_magnitude = np.mean(np.linalg.norm(np.gradient(region_points[:, :2]), axis=0))
        
        features = np.array([
            abs(depth_mean),
            depth_variance,
            gradient_magnitude,
            len(region_points) / 1000
        ])
        
        thresholds = {
            StainType.MOLD: (0.002, 0.00001, 0.1),
            StainType.WATER: (0.0015, 0.000005, 0.05),
            StainType.INK: (0.003, 0.00002, 0.15),
            StainType.OIL: (0.001, 0.000003, 0.03),
            StainType.DUST: (0.0005, 0.000001, 0.02)
        }
        
        best_match = StainType.UNKNOWN
        best_score = 0
        
        for stain_type, (d_thresh, v_thresh, g_thresh) in thresholds.items():
            score = (
                min(features[0] / d_thresh, 1.0) * 0.4 +
                min(features[1] / v_thresh, 1.0) * 0.3 +
                min(features[2] / g_thresh, 1.0) * 0.3
            )
            if score > best_score:
                best_score = score
                best_match = stain_type
        
        confidence = min(best_score, 1.0)
        
        return best_match, confidence

    def _calculate_area(self, points: np.ndarray) -> float:
        if len(points) < 3:
            return 0.0
        
        from scipy.spatial import ConvexHull
        try:
            hull = ConvexHull(points[:, :2])
            return hull.area
        except:
            return float(len(points)) * 1e-6

    def _calculate_perimeter(self, points: np.ndarray) -> float:
        if len(points) < 3:
            return 0.0
        
        from scipy.spatial import ConvexHull
        try:
            hull = ConvexHull(points[:, :2])
            hull_points = points[hull.vertices, :2]
            perimeter = 0.0
            for i in range(len(hull_points)):
                next_idx = (i + 1) % len(hull_points)
                perimeter += np.linalg.norm(hull_points[i] - hull_points[next_idx])
            return perimeter
        except:
            return np.sqrt(self._calculate_area(points)) * 4

    def _extract_boundary(self, points: np.ndarray, num_samples: int = 50) -> np.ndarray:
        if len(points) < 3:
            return points
        
        from scipy.spatial import ConvexHull
        try:
            hull = ConvexHull(points[:, :2])
            boundary = points[hull.vertices]
            if len(boundary) > num_samples:
                indices = np.linspace(0, len(boundary) - 1, num_samples, dtype=int)
                boundary = boundary[indices]
            return boundary
        except:
            return points[:min(num_samples, len(points))]

    def predict_diffusion(self, stain_region: StainRegion,
                          time_steps: int = 10,
                          environment: Optional[Dict] = None,
                          paper_props: Optional[Dict] = None) -> Dict:
        if environment is None:
            environment = {
                'humidity': 'humidity_normal',
                'temperature': 'temperature_normal',
                'light_exposure': False,
                'contact_pressure': False
            }
        
        if paper_props is None:
            paper_props = {
                'porosity': 'porosity_normal',
                'thickness': 'thickness_normal'
            }
        
        base_coeff = self.diffusion_coefficients[stain_region.stain_type]
        
        env_factor = 1.0
        env_factor *= self.environment_factors[environment['humidity']]
        env_factor *= self.environment_factors[environment['temperature']]
        if environment['light_exposure']:
            env_factor *= self.environment_factors['light_exposure']
        if environment['contact_pressure']:
            env_factor *= self.environment_factors['contact_pressure']
        
        paper_factor = 1.0
        paper_factor *= self.paper_properties[paper_props['porosity']]
        paper_factor *= self.paper_properties[paper_props['thickness']]
        
        effective_coeff = base_coeff * env_factor * paper_factor
        
        diffusion_history = []
        current_area = stain_region.area
        current_perimeter = stain_region.perimeter
        current_boundary = stain_region.boundary_points.copy()
        
        for step in range(time_steps):
            radial_rate = effective_coeff * np.sqrt(current_area) / current_perimeter
            
            new_area = current_area * (1 + 0.1 * effective_coeff * (step + 1))
            new_perimeter = current_perimeter * np.sqrt(new_area / current_area)
            
            center = np.mean(current_boundary, axis=0)
            vectors = current_boundary - center
            expansion_factor = np.sqrt(new_area / current_area)
            new_boundary = center + vectors * expansion_factor
            
            diffusion_history.append({
                'time_step': step + 1,
                'area': new_area,
                'perimeter': new_perimeter,
                'boundary_points': new_boundary,
                'radial_expansion_rate': radial_rate,
                'estimated_depth_increase': abs(stain_region.avg_depth) * 0.05 * (step + 1)
            })
            
            current_area = new_area
            current_perimeter = new_perimeter
            current_boundary = new_boundary
        
        final_prediction = diffusion_history[-1] if diffusion_history else {}
        
        severity = self._calculate_severity(
            final_prediction.get('area', stain_region.area),
            stain_region.area,
            stain_region.stain_type
        )
        
        return {
            'stain_type': stain_region.stain_type.value,
            'initial_area': stain_region.area,
            'initial_perimeter': stain_region.perimeter,
            'effective_diffusion_coefficient': effective_coeff,
            'environment_factor': env_factor,
            'paper_factor': paper_factor,
            'diffusion_history': diffusion_history,
            'final_prediction': final_prediction,
            'severity': severity.value,
            'urgency_score': self._calculate_urgency_score(severity, diffusion_history),
            'critical_time_steps': self._identify_critical_points(diffusion_history)
        }

    def _calculate_severity(self, final_area: float, initial_area: float,
                            stain_type: StainType) -> DiffusionSeverity:
        area_ratio = final_area / initial_area if initial_area > 0 else 1.0
        
        type_multipliers = {
            StainType.MOLD: 1.5,
            StainType.INK: 1.3,
            StainType.WATER: 1.1,
            StainType.OIL: 1.2,
            StainType.DUST: 0.8,
            StainType.UNKNOWN: 1.0
        }
        
        adjusted_ratio = area_ratio * type_multipliers.get(stain_type, 1.0)
        
        if adjusted_ratio >= 5.0:
            return DiffusionSeverity.CRITICAL
        elif adjusted_ratio >= 3.0:
            return DiffusionSeverity.SEVERE
        elif adjusted_ratio >= 2.0:
            return DiffusionSeverity.MODERATE
        else:
            return DiffusionSeverity.MILD

    def _calculate_urgency_score(self, severity: DiffusionSeverity,
                                  diffusion_history: List[Dict]) -> float:
        severity_scores = {
            DiffusionSeverity.MILD: 25,
            DiffusionSeverity.MODERATE: 50,
            DiffusionSeverity.SEVERE: 75,
            DiffusionSeverity.CRITICAL: 100
        }
        
        base_score = severity_scores.get(severity, 50)
        
        if diffusion_history:
            initial_area = diffusion_history[0]['area']
            final_area = diffusion_history[-1]['area']
            growth_rate = (final_area - initial_area) / initial_area if initial_area > 0 else 0
            rate_factor = min(growth_rate * 100, 50)
            base_score = min(base_score + rate_factor, 100)
        
        return base_score

    def _identify_critical_points(self, diffusion_history: List[Dict]) -> List[int]:
        critical_points = []
        
        if len(diffusion_history) < 3:
            return critical_points
        
        for i in range(2, len(diffusion_history)):
            prev_growth = diffusion_history[i-1]['area'] - diffusion_history[i-2]['area']
            curr_growth = diffusion_history[i]['area'] - diffusion_history[i-1]['area']
            
            if curr_growth > prev_growth * 1.5:
                critical_points.append(i + 1)
        
        return critical_points[:3]

    def batch_predict_diffusion(self, stain_regions: List[StainRegion],
                                 time_steps: int = 10,
                                 environment: Optional[Dict] = None,
                                 paper_props: Optional[Dict] = None) -> List[Dict]:
        predictions = []
        for region in stain_regions:
            prediction = self.predict_diffusion(region, time_steps, environment, paper_props)
            predictions.append(prediction)
        return predictions

    def generate_diffusion_heatmap(self, base_shape: Tuple[int, int],
                                    stain_region: StainRegion,
                                    prediction: Dict,
                                    time_step: int = -1) -> np.ndarray:
        height, width = base_shape
        heatmap = np.zeros((height, width))
        
        diffusion_history = prediction['diffusion_history']
        if time_step < 0:
            time_data = diffusion_history[-1] if diffusion_history else None
        else:
            time_data = diffusion_history[min(time_step, len(diffusion_history) - 1)]
        
        if time_data is None:
            return heatmap
        
        center = stain_region.center
        max_radius = np.sqrt(time_data['area'] / np.pi)
        
        y_coords, x_coords = np.ogrid[:height, :width]
        center_y, center_x = int(center[1] * height), int(center[0] * width)
        
        distances = np.sqrt((x_coords - center_x)**2 + (y_coords - center_y)**2)
        max_pixel_radius = max_radius * max(width, height)
        
        gaussian = np.exp(-distances**2 / (2 * max_pixel_radius**2))
        heatmap = gaussian / np.max(gaussian) if np.max(gaussian) > 0 else gaussian
        
        return heatmap


__all__ = ['StainDiffusionPredictor', 'StainType', 'DiffusionSeverity', 'StainRegion']
