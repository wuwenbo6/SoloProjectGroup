import numpy as np
from typing import Dict, List, Optional, Tuple, Any, Callable
from enum import Enum
from dataclasses import dataclass, field
import json
import time
from collections import defaultdict


class OptimizationTarget(Enum):
    WEAR_DETECTION = "wear_detection"
    STAIN_PREDICTION = "stain_prediction"
    STRENGTH_ESTIMATION = "strength_estimation"
    SAFETY_ASSESSMENT = "safety_assessment"
    OVERALL = "overall"


class LearningSchedule(Enum):
    CONSTANT = "constant"
    LINEAR_DECAY = "linear_decay"
    EXPONENTIAL_DECAY = "exponential_decay"
    ADAPTIVE = "adaptive"


@dataclass
class ModelParameters:
    wear_detection: Dict[str, float] = field(default_factory=lambda: {
        'distance_threshold': 0.5,
        'neighborhood_radius': 10.0,
        'min_cluster_size': 5,
        'wear_sensitivity': 1.0,
        'outlier_removal_factor': 2.0
    })
    stain_prediction: Dict[str, float] = field(default_factory=lambda: {
        'diffusion_coefficient': 0.1,
        'time_horizon': 10,
        'humidity_factor': 0.8,
        'temperature_factor': 0.05,
        'ph_sensitivity': 0.3,
        'threshold_severity': 0.5
    })
    strength_estimation: Dict[str, float] = field(default_factory=lambda: {
        'tensile_weight': 0.25,
        'tear_weight': 0.20,
        'burst_weight': 0.15,
        'folding_weight': 0.15,
        'stiffness_weight': 0.10,
        'cohesion_weight': 0.10,
        'ph_impact_factor': 0.4,
        'aging_factor': 0.02,
        'brittleness_threshold': 50.0
    })
    safety_assessment: Dict[str, float] = field(default_factory=lambda: {
        'wear_weight': 0.35,
        'thickness_weight': 0.25,
        'strength_weight': 0.30,
        'stain_weight': 0.10,
        'critical_threshold': 30.0,
        'high_threshold': 50.0,
        'medium_threshold': 70.0
    })

    def to_dict(self) -> Dict[str, Any]:
        return {
            'wear_detection': self.wear_detection,
            'stain_prediction': self.stain_prediction,
            'strength_estimation': self.strength_estimation,
            'safety_assessment': self.safety_assessment
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ModelParameters':
        params = cls()
        if 'wear_detection' in data:
            params.wear_detection = data['wear_detection']
        if 'stain_prediction' in data:
            params.stain_prediction = data['stain_prediction']
        if 'strength_estimation' in data:
            params.strength_estimation = data['strength_estimation']
        if 'safety_assessment' in data:
            params.safety_assessment = data['safety_assessment']
        return params


@dataclass
class OptimizationResult:
    target: str
    best_parameters: Dict[str, float]
    best_score: float
    improvement_percent: float
    iterations: int
    convergence_history: List[float]
    parameter_history: List[Dict[str, float]]
    elapsed_time: float
    final_metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GroundTruthSample:
    sample_id: str
    wear_analysis: Dict[str, Any]
    strength_analysis: Dict[str, Any]
    stain_analysis: Optional[Dict[str, Any]]
    safety_assessment: Dict[str, Any]
    expert_rating: Optional[float] = None
    timestamp: float = field(default_factory=time.time)


class ModelFineTuner:
    def __init__(self, initial_parameters: Optional[ModelParameters] = None):
        self.current_parameters = initial_parameters or ModelParameters()
        self.performance_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.training_samples: List[GroundTruthSample] = []
        self.learning_rate = 0.01
        self.optimization_targets = set()

    def add_training_sample(self, sample: GroundTruthSample) -> None:
        self.training_samples.append(sample)

    def add_training_samples(self, samples: List[GroundTruthSample]) -> None:
        self.training_samples.extend(samples)

    def evaluate_wear_detection(self, params: Dict[str, float], 
                                samples: List[GroundTruthSample]) -> float:
        if not samples:
            return 0.5
        
        total_score = 0.0
        valid_samples = 0
        
        for sample in samples:
            wear_ratio = sample.wear_analysis.get('wear_ratio', 0)
            max_depth = sample.wear_analysis.get('max_depth', 0)
            region_count = len(sample.wear_analysis.get('wear_regions', []))
            
            distance_thresh = params.get('distance_threshold', 0.5)
            sensitivity = params.get('wear_sensitivity', 1.0)
            
            normalized_wear = min(wear_ratio * sensitivity / distance_thresh, 1.0)
            normalized_depth = min(max_depth / 5.0, 1.0)
            normalized_regions = min(region_count / 10.0, 1.0)
            
            consistency_score = 1.0 - abs(normalized_wear - normalized_depth)
            region_score = 1.0 - abs(normalized_wear - normalized_regions)
            
            sample_score = (consistency_score + region_score) / 2.0
            
            if sample.expert_rating is not None:
                expert_normalized = sample.expert_rating / 10.0
                sample_score = 0.6 * sample_score + 0.4 * (1.0 - abs(expert_normalized - normalized_wear))
            
            total_score += sample_score
            valid_samples += 1
        
        return total_score / valid_samples if valid_samples > 0 else 0.5

    def evaluate_stain_prediction(self, params: Dict[str, float],
                                  samples: List[GroundTruthSample]) -> float:
        if not samples:
            return 0.5
        
        total_score = 0.0
        valid_samples = 0
        
        for sample in samples:
            if not sample.stain_analysis:
                continue
            
            severity = sample.stain_analysis.get('overall_severity', 'low')
            region_count = len(sample.stain_analysis.get('stain_regions', []))
            diffusion_predicted = sample.stain_analysis.get('predicted_diffusion', {})
            final_area = diffusion_predicted.get('final_area_multiplier', 1.0) if diffusion_predicted else 1.0
            
            severity_scores = {'mild': 0.25, 'moderate': 0.5, 'severe': 0.75, 'critical': 1.0}
            severity_score = severity_scores.get(severity, 0.5)
            
            threshold = params.get('threshold_severity', 0.5)
            coeff = params.get('diffusion_coefficient', 0.1)
            
            predicted_severity = min(region_count * coeff / threshold, 1.0)
            predicted_diffusion = min(final_area * coeff * 2.0, 1.0)
            
            severity_match = 1.0 - abs(severity_score - predicted_severity)
            diffusion_consistency = 1.0 - abs(severity_score - predicted_diffusion)
            
            sample_score = (severity_match + diffusion_consistency) / 2.0
            
            if sample.expert_rating is not None:
                expert_normalized = sample.expert_rating / 10.0
                sample_score = 0.7 * sample_score + 0.3 * (1.0 - abs(expert_normalized - severity_score))
            
            total_score += sample_score
            valid_samples += 1
        
        return total_score / valid_samples if valid_samples > 0 else 0.5

    def evaluate_strength_estimation(self, params: Dict[str, float],
                                     samples: List[GroundTruthSample]) -> float:
        if not samples:
            return 0.5
        
        total_score = 0.0
        valid_samples = 0
        
        for sample in samples:
            metrics = sample.strength_analysis.get('strength_metrics', {})
            overall_score = sample.strength_analysis.get('overall_strength_score', 50.0)
            condition = sample.strength_analysis.get('condition', 'fair')
            
            if isinstance(metrics, dict):
                tensile = metrics.get('tensile_strength', 50.0)
                tear = metrics.get('tear_resistance', 50.0)
                burst = metrics.get('burst_strength', 50.0)
                folding = metrics.get('folding_endurance', 50.0)
                stiffness = metrics.get('stiffness', 50.0)
                cohesion = metrics.get('cohesion_strength', 50.0)
            else:
                tensile = tear = burst = folding = stiffness = cohesion = 50.0
            
            w1 = params.get('tensile_weight', 0.25)
            w2 = params.get('tear_weight', 0.20)
            w3 = params.get('burst_weight', 0.15)
            w4 = params.get('folding_weight', 0.15)
            w5 = params.get('stiffness_weight', 0.10)
            w6 = params.get('cohesion_weight', 0.10)
            
            total_weight = w1 + w2 + w3 + w4 + w5 + w6
            if total_weight > 0:
                w1, w2, w3, w4, w5, w6 = w1/total_weight, w2/total_weight, w3/total_weight, w4/total_weight, w5/total_weight, w6/total_weight
            
            calculated_score = (
                w1 * tensile +
                w2 * tear +
                w3 * burst +
                w4 * folding +
                w5 * stiffness +
                w6 * cohesion
            )
            
            consistency_score = 1.0 - abs(overall_score - calculated_score) / 100.0
            
            condition_scores = {'critical': 0.25, 'poor': 0.5, 'fair': 0.75, 'good': 1.0}
            condition_score = condition_scores.get(condition, 0.5)
            
            score_normalized = overall_score / 100.0
            condition_match = 1.0 - abs(condition_score - score_normalized)
            
            sample_score = (consistency_score + condition_match) / 2.0
            
            if sample.expert_rating is not None:
                expert_normalized = sample.expert_rating / 10.0
                sample_score = 0.6 * sample_score + 0.4 * (1.0 - abs(expert_normalized - score_normalized))
            
            total_score += sample_score
            valid_samples += 1
        
        return total_score / valid_samples if valid_samples > 0 else 0.5

    def evaluate_safety_assessment(self, params: Dict[str, float],
                                   samples: List[GroundTruthSample]) -> float:
        if not samples:
            return 0.5
        
        total_score = 0.0
        valid_samples = 0
        
        for sample in samples:
            wear = sample.safety_assessment.get('wear_risk', 0.5)
            thickness = sample.safety_assessment.get('thickness_risk', 0.5)
            strength = sample.safety_assessment.get('strength_risk', 0.5)
            stain = sample.safety_assessment.get('stain_risk', 0.5)
            overall = sample.safety_assessment.get('overall_safety_score', 0.5)
            
            w1 = params.get('wear_weight', 0.35)
            w2 = params.get('thickness_weight', 0.25)
            w3 = params.get('strength_weight', 0.30)
            w4 = params.get('stain_weight', 0.10)
            
            total_weight = w1 + w2 + w3 + w4
            if total_weight > 0:
                w1, w2, w3, w4 = w1/total_weight, w2/total_weight, w3/total_weight, w4/total_weight
            
            calculated_overall = w1 * wear + w2 * thickness + w3 * strength + w4 * stain
            
            consistency_score = 1.0 - abs(overall - calculated_overall)
            
            critical_thresh = params.get('critical_threshold', 30.0) / 100.0
            high_thresh = params.get('high_threshold', 50.0) / 100.0
            medium_thresh = params.get('medium_threshold', 70.0) / 100.0
            
            if overall < critical_thresh:
                expected_level = 'critical'
            elif overall < high_thresh:
                expected_level = 'high'
            elif overall < medium_thresh:
                expected_level = 'medium'
            else:
                expected_level = 'low'
            
            actual_level = sample.safety_assessment.get('safety_level', 'medium')
            threshold_match = 1.0 if expected_level == actual_level else 0.6
            
            sample_score = (consistency_score + threshold_match) / 2.0
            
            if sample.expert_rating is not None:
                expert_normalized = sample.expert_rating / 10.0
                sample_score = 0.7 * sample_score + 0.3 * (1.0 - abs(expert_normalized - overall))
            
            total_score += sample_score
            valid_samples += 1
        
        return total_score / valid_samples if valid_samples > 0 else 0.5

    def evaluate_overall(self, params: ModelParameters, samples: List[GroundTruthSample]) -> float:
        scores = [
            self.evaluate_wear_detection(params.wear_detection, samples),
            self.evaluate_stain_prediction(params.stain_prediction, samples),
            self.evaluate_strength_estimation(params.strength_estimation, samples),
            self.evaluate_safety_assessment(params.safety_assessment, samples)
        ]
        return sum(scores) / len(scores)

    def gradient_descent_optimize(self,
                                   target: OptimizationTarget,
                                   learning_rate: float = 0.01,
                                   max_iterations: int = 100,
                                   convergence_threshold: float = 1e-5,
                                   schedule: LearningSchedule = LearningSchedule.ADAPTIVE) -> OptimizationResult:
        start_time = time.time()
        
        param_map = {
            OptimizationTarget.WEAR_DETECTION: ('wear_detection', self.evaluate_wear_detection),
            OptimizationTarget.STAIN_PREDICTION: ('stain_prediction', self.evaluate_stain_prediction),
            OptimizationTarget.STRENGTH_ESTIMATION: ('strength_estimation', self.evaluate_strength_estimation),
            OptimizationTarget.SAFETY_ASSESSMENT: ('safety_assessment', self.evaluate_safety_assessment),
        }
        
        if target == OptimizationTarget.OVERALL:
            return self._optimize_overall(learning_rate, max_iterations, convergence_threshold)
        
        param_name, evaluator = param_map[target]
        current_params = getattr(self.current_parameters, param_name).copy()
        
        convergence_history = []
        parameter_history = []
        
        best_params = current_params.copy()
        best_score = evaluator(current_params, self.training_samples)
        initial_score = best_score
        
        convergence_history.append(best_score)
        parameter_history.append(current_params.copy())
        
        iteration = 0
        lr = learning_rate
        
        while iteration < max_iterations:
            if schedule == LearningSchedule.LINEAR_DECAY:
                lr = learning_rate * (1 - iteration / max_iterations)
            elif schedule == LearningSchedule.EXPONENTIAL_DECAY:
                lr = learning_rate * np.exp(-iteration / (max_iterations / 5))
            
            gradients = {}
            epsilon = 1e-8
            
            for param_name_i in current_params:
                params_plus = current_params.copy()
                params_plus[param_name_i] += epsilon
                score_plus = evaluator(params_plus, self.training_samples)
                
                params_minus = current_params.copy()
                params_minus[param_name_i] -= epsilon
                score_minus = evaluator(params_minus, self.training_samples)
                
                gradients[param_name_i] = (score_plus - score_minus) / (2 * epsilon)
            
            for param_name_i, grad in gradients.items():
                current_params[param_name_i] += lr * grad
                
                if 'threshold' in param_name_i or 'weight' in param_name_i:
                    current_params[param_name_i] = max(0.01, min(1.0, current_params[param_name_i]))
                elif 'factor' in param_name_i or 'sensitivity' in param_name_i:
                    current_params[param_name_i] = max(0.0, min(2.0, current_params[param_name_i]))
                elif 'radius' in param_name_i or 'size' in param_name_i:
                    current_params[param_name_i] = max(1.0, current_params[param_name_i])
            
            current_score = evaluator(current_params, self.training_samples)
            
            if current_score > best_score:
                best_score = current_score
                best_params = current_params.copy()
            
            convergence_history.append(current_score)
            parameter_history.append(current_params.copy())
            
            if iteration > 10:
                recent_improvement = abs(convergence_history[-1] - convergence_history[-5])
                if recent_improvement < convergence_threshold:
                    break
            
            iteration += 1
        
        improvement = ((best_score - initial_score) / initial_score * 100) if initial_score > 0 else 0
        
        setattr(self.current_parameters, param_name, best_params)
        
        result = OptimizationResult(
            target=target.value,
            best_parameters=best_params,
            best_score=best_score,
            improvement_percent=improvement,
            iterations=iteration + 1,
            convergence_history=convergence_history,
            parameter_history=parameter_history,
            elapsed_time=time.time() - start_time
        )
        
        self.performance_history[target.value].append({
            'timestamp': time.time(),
            'initial_score': initial_score,
            'final_score': best_score,
            'improvement': improvement,
            'sample_count': len(self.training_samples)
        })
        
        return result

    def _optimize_overall(self, learning_rate: float, max_iterations: int,
                           convergence_threshold: float) -> OptimizationResult:
        start_time = time.time()
        
        convergence_history = []
        parameter_history = []
        
        best_params = ModelParameters.from_dict(self.current_parameters.to_dict())
        best_score = self.evaluate_overall(best_params, self.training_samples)
        initial_score = best_score
        
        convergence_history.append(best_score)
        parameter_history.append(best_params.to_dict())
        
        iteration = 0
        lr = learning_rate
        
        while iteration < max_iterations:
            param_dict = best_params.to_dict()
            gradients = {}
            
            for module_name in param_dict:
                gradients[module_name] = {}
                for param_name in param_dict[module_name]:
                    epsilon = 1e-8
                    
                    params_plus = ModelParameters.from_dict(param_dict)
                    getattr(params_plus, module_name)[param_name] += epsilon
                    score_plus = self.evaluate_overall(params_plus, self.training_samples)
                    
                    params_minus = ModelParameters.from_dict(param_dict)
                    getattr(params_minus, module_name)[param_name] -= epsilon
                    score_minus = self.evaluate_overall(params_minus, self.training_samples)
                    
                    gradients[module_name][param_name] = (score_plus - score_minus) / (2 * epsilon)
            
            for module_name in gradients:
                for param_name, grad in gradients[module_name].items():
                    getattr(best_params, module_name)[param_name] += lr * grad
                    
                    val = getattr(best_params, module_name)[param_name]
                    if 'threshold' in param_name or 'weight' in param_name:
                        getattr(best_params, module_name)[param_name] = max(0.01, min(1.0, val))
                    elif 'factor' in param_name or 'sensitivity' in param_name:
                        getattr(best_params, module_name)[param_name] = max(0.0, min(2.0, val))
            
            current_score = self.evaluate_overall(best_params, self.training_samples)
            
            if current_score > best_score:
                best_score = current_score
            
            convergence_history.append(current_score)
            parameter_history.append(best_params.to_dict())
            
            if iteration > 10:
                recent_improvement = abs(convergence_history[-1] - convergence_history[-5])
                if recent_improvement < convergence_threshold:
                    break
            
            iteration += 1
        
        improvement = ((best_score - initial_score) / initial_score * 100) if initial_score > 0 else 0
        
        self.current_parameters = best_params
        
        return OptimizationResult(
            target=OptimizationTarget.OVERALL.value,
            best_parameters=best_params.to_dict(),
            best_score=best_score,
            improvement_percent=improvement,
            iterations=iteration + 1,
            convergence_history=convergence_history,
            parameter_history=parameter_history,
            elapsed_time=time.time() - start_time
        )

    def cross_validation_optimize(self, target: OptimizationTarget, n_folds: int = 5,
                                   learning_rate: float = 0.01, max_iterations: int = 50) -> Dict[str, Any]:
        if len(self.training_samples) < n_folds:
            n_folds = max(2, len(self.training_samples) // 2)
        
        np.random.shuffle(self.training_samples)
        fold_size = len(self.training_samples) // n_folds
        
        fold_scores = []
        fold_improvements = []
        
        original_samples = self.training_samples.copy()
        
        for fold in range(n_folds):
            val_start = fold * fold_size
            val_end = val_start + fold_size if fold < n_folds - 1 else len(original_samples)
            
            val_samples = original_samples[val_start:val_end]
            train_samples = original_samples[:val_start] + original_samples[val_end:]
            
            self.training_samples = train_samples
            result = self.gradient_descent_optimize(target, learning_rate, max_iterations)
            
            evaluator_map = {
                OptimizationTarget.WEAR_DETECTION: self.evaluate_wear_detection,
                OptimizationTarget.STAIN_PREDICTION: self.evaluate_stain_prediction,
                OptimizationTarget.STRENGTH_ESTIMATION: self.evaluate_strength_estimation,
                OptimizationTarget.SAFETY_ASSESSMENT: self.evaluate_safety_assessment,
            }
            
            if target != OptimizationTarget.OVERALL:
                param_name, _ = {
                    OptimizationTarget.WEAR_DETECTION: ('wear_detection', self.evaluate_wear_detection),
                    OptimizationTarget.STAIN_PREDICTION: ('stain_prediction', self.evaluate_stain_prediction),
                    OptimizationTarget.STRENGTH_ESTIMATION: ('strength_estimation', self.evaluate_strength_estimation),
                    OptimizationTarget.SAFETY_ASSESSMENT: ('safety_assessment', self.evaluate_safety_assessment),
                }[target]
                val_score = evaluator_map[target](getattr(self.current_parameters, param_name), val_samples)
            else:
                val_score = self.evaluate_overall(self.current_parameters, val_samples)
            
            fold_scores.append(val_score)
            fold_improvements.append(result.improvement_percent)
        
        self.training_samples = original_samples
        
        final_result = self.gradient_descent_optimize(target, learning_rate, max_iterations)
        
        return {
            'cv_mean_score': np.mean(fold_scores),
            'cv_std_score': np.std(fold_scores),
            'cv_mean_improvement': np.mean(fold_improvements),
            'n_folds': n_folds,
            'fold_scores': fold_scores,
            'final_result': final_result.__dict__
        }

    def grid_search_optimize(self, target: OptimizationTarget,
                              param_grid: Dict[str, List[float]]) -> Dict[str, Any]:
        param_name_map = {
            OptimizationTarget.WEAR_DETECTION: 'wear_detection',
            OptimizationTarget.STAIN_PREDICTION: 'stain_prediction',
            OptimizationTarget.STRENGTH_ESTIMATION: 'strength_estimation',
            OptimizationTarget.SAFETY_ASSESSMENT: 'safety_assessment',
        }
        
        module_name = param_name_map[target]
        base_params = getattr(self.current_parameters, module_name).copy()
        
        best_score = -1
        best_params = base_params.copy()
        search_history = []
        
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        from itertools import product
        for combination in product(*param_values):
            test_params = base_params.copy()
            for name, value in zip(param_names, combination):
                test_params[name] = value
            
            evaluator_map = {
                OptimizationTarget.WEAR_DETECTION: self.evaluate_wear_detection,
                OptimizationTarget.STAIN_PREDICTION: self.evaluate_stain_prediction,
                OptimizationTarget.STRENGTH_ESTIMATION: self.evaluate_strength_estimation,
                OptimizationTarget.SAFETY_ASSESSMENT: self.evaluate_safety_assessment,
            }
            
            score = evaluator_map[target](test_params, self.training_samples)
            
            search_history.append({
                'parameters': test_params.copy(),
                'score': score
            })
            
            if score > best_score:
                best_score = score
                best_params = test_params.copy()
        
        setattr(self.current_parameters, module_name, best_params)
        
        return {
            'best_parameters': best_params,
            'best_score': best_score,
            'search_count': len(search_history),
            'search_history': sorted(search_history, key=lambda x: -x['score'])[:10]
        }

    def save_parameters(self, filepath: str) -> None:
        with open(filepath, 'w') as f:
            json.dump({
                'parameters': self.current_parameters.to_dict(),
                'performance_history': dict(self.performance_history),
                'training_sample_count': len(self.training_samples)
            }, f, indent=2)

    def load_parameters(self, filepath: str) -> None:
        with open(filepath, 'r') as f:
            data = json.load(f)
            self.current_parameters = ModelParameters.from_dict(data.get('parameters', {}))
            if 'performance_history' in data:
                for key, value in data['performance_history'].items():
                    self.performance_history[key] = value

    def get_performance_summary(self) -> Dict[str, Any]:
        summary = {
            'total_training_samples': len(self.training_samples),
            'optimization_targets': list(self.performance_history.keys()),
            'current_parameters': self.current_parameters.to_dict(),
            'target_performance': {}
        }
        
        for target, history in self.performance_history.items():
            if history:
                latest = history[-1]
                summary['target_performance'][target] = {
                    'latest_score': latest.get('final_score', 0),
                    'total_improvement': sum(h.get('improvement', 0) for h in history),
                    'optimization_count': len(history),
                    'last_optimized': time.strftime('%Y-%m-%d %H:%M:%S', 
                                                     time.localtime(latest.get('timestamp', time.time())))
                }
        
        return summary

    def adaptive_learning(self, target: OptimizationTarget,
                          initial_lr: float = 0.05,
                          min_lr: float = 0.001,
                          patience: int = 10) -> OptimizationResult:
        lr = initial_lr
        best_iter_score = -1
        rounds_without_improvement = 0
        total_iterations = 0
        
        all_convergence = []
        all_parameter_history = []
        
        start_time = time.time()
        
        param_name_map = {
            OptimizationTarget.WEAR_DETECTION: ('wear_detection', self.evaluate_wear_detection),
            OptimizationTarget.STAIN_PREDICTION: ('stain_prediction', self.evaluate_stain_prediction),
            OptimizationTarget.STRENGTH_ESTIMATION: ('strength_estimation', self.evaluate_strength_estimation),
            OptimizationTarget.SAFETY_ASSESSMENT: ('safety_assessment', self.evaluate_safety_assessment),
        }
        
        param_name, evaluator = param_name_map[target]
        current_params = getattr(self.current_parameters, param_name).copy()
        initial_score = evaluator(current_params, self.training_samples)
        
        while lr >= min_lr and rounds_without_improvement < patience * 2:
            result = self.gradient_descent_optimize(
                target, learning_rate=lr, max_iterations=patience,
                convergence_threshold=1e-6
            )
            
            all_convergence.extend(result.convergence_history)
            all_parameter_history.extend(result.parameter_history)
            total_iterations += result.iterations
            
            if result.best_score > best_iter_score + 1e-4:
                best_iter_score = result.best_score
                rounds_without_improvement = 0
            else:
                rounds_without_improvement += patience
                lr *= 0.5
            
            if rounds_without_improvement >= patience:
                lr *= 0.7
        
        best_params = getattr(self.current_parameters, param_name)
        best_score = evaluator(best_params, self.training_samples)
        
        improvement = ((best_score - initial_score) / initial_score * 100) if initial_score > 0 else 0
        
        return OptimizationResult(
            target=target.value,
            best_parameters=best_params,
            best_score=best_score,
            improvement_percent=improvement,
            iterations=total_iterations,
            convergence_history=all_convergence,
            parameter_history=all_parameter_history,
            elapsed_time=time.time() - start_time
        )


__all__ = ['ModelFineTuner', 'ModelParameters', 'OptimizationResult', 'GroundTruthSample',
           'OptimizationTarget', 'LearningSchedule']
