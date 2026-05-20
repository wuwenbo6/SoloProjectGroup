import numpy as np
from typing import Dict, List, Tuple
import json


class SilkThread:
    def __init__(self, thread_type: str, diameter: float, young_modulus: float, 
                 density: float, breaking_tension: float):
        self.thread_type = thread_type
        self.diameter = diameter
        self.young_modulus = young_modulus
        self.density = density
        self.breaking_tension = breaking_tension
        self.cross_section_area = np.pi * (diameter / 2) ** 2


class StitchType:
    SATIN = 'satin'
    CHAIN = 'chain'
    FILL = 'fill'
    OUTLINE = 'outline'
    
    @classmethod
    def get_stitch_properties(cls, stitch_type: str) -> Dict:
        properties = {
            cls.SATIN: {'stitch_length': 5.0, 'spacing': 0.5, 'tension_factor': 1.2},
            cls.CHAIN: {'stitch_length': 2.0, 'spacing': 1.0, 'tension_factor': 0.8},
            cls.FILL: {'stitch_length': 3.0, 'spacing': 0.3, 'tension_factor': 1.0},
            cls.OUTLINE: {'stitch_length': 1.5, 'spacing': 0.2, 'tension_factor': 1.5}
        }
        return properties.get(stitch_type, properties[cls.FILL])


class TensionSimulator:
    def __init__(self, sample_rate: int = 100):
        self.sample_rate = sample_rate
        self.threads: Dict[str, SilkThread] = {}
        self._initialize_default_threads()
        
    def _initialize_default_threads(self):
        self.threads['silk_120D'] = SilkThread(
            thread_type='silk_120D',
            diameter=0.12e-3,
            young_modulus=10e9,
            density=1340,
            breaking_tension=5.0
        )
        self.threads['silk_240D'] = SilkThread(
            thread_type='silk_240D',
            diameter=0.24e-3,
            young_modulus=9.5e9,
            density=1340,
            breaking_tension=8.0
        )
        self.threads['cotton_30s'] = SilkThread(
            thread_type='cotton_30s',
            diameter=0.18e-3,
            young_modulus=5e9,
            density=1540,
            breaking_tension=3.5
        )
    
    def add_thread_type(self, thread: SilkThread):
        self.threads[thread.thread_type] = thread
    
    def calculate_elastic_force(self, thread_type: str, strain: float) -> float:
        thread = self.threads.get(thread_type)
        if not thread:
            raise ValueError(f"Unknown thread type: {thread_type}")
        stress = thread.young_modulus * strain
        return stress * thread.cross_section_area
    
    def calculate_friction_force(self, thread_type: str, normal_force: float, 
                                 friction_coeff: float = 0.3) -> float:
        return normal_force * friction_coeff
    
    def simulate_stitch_tension(self, stitch_type: str, thread_type: str,
                                 base_tension: float, stitch_count: int,
                                 fabric_stiffness: float = 1000.0) -> Tuple[np.ndarray, np.ndarray]:
        stitch_props = StitchType.get_stitch_properties(stitch_type)
        tension_factor = stitch_props['tension_factor']
        stitch_length = stitch_props['stitch_length']
        
        time_points = np.linspace(0, stitch_count / 10, stitch_count * self.sample_rate)
        tension_values = np.zeros_like(time_points)
        
        thread = self.threads.get(thread_type)
        if not thread:
            raise ValueError(f"Unknown thread type: {thread_type}")
        
        breaking_tension = thread.breaking_tension
        safety_factor = 0.8
        
        for i, t in enumerate(time_points):
            stitch_phase = (t * 10) % 1
            base = base_tension * tension_factor
            
            with np.errstate(over='raise', under='raise'):
                try:
                    penetration_effect = 0.5 * base * np.sin(stitch_phase * np.pi)
                    pull_effect = 0.3 * base * np.sin((stitch_phase + 0.5) * np.pi)
                    
                    stitch_index = int(t * 10)
                    cumulative_effect = 0.05 * base * (1 - np.exp(-stitch_index / 20))
                    
                    fabric_resistance = fabric_stiffness * 1e-4 * base
                    noise = np.random.normal(0, 0.02 * base)
                    
                    total_tension = base + penetration_effect + pull_effect + \
                                   cumulative_effect + fabric_resistance + noise
                    
                    total_tension = np.clip(total_tension, 0.01, breaking_tension * safety_factor)
                    
                    tension_values[i] = total_tension
                except FloatingPointError:
                    tension_values[i] = base
        
        return time_points, tension_values
    
    def simulate_multi_needle_tension(self, needle_count: int, stitch_type: str,
                                       thread_type: str, base_tension: float,
                                       stitch_count: int) -> Dict[int, Tuple[np.ndarray, np.ndarray]]:
        results = {}
        for needle in range(needle_count):
            phase_shift = needle * 0.1
            time, tension = self.simulate_stitch_tension(
                stitch_type, thread_type, 
                base_tension * (1 + needle * 0.02), 
                stitch_count
            )
            results[needle] = (time, tension)
        return results
    
    def calculate_tension_metrics(self, tension_values: np.ndarray) -> Dict:
        return {
            'mean': float(np.mean(tension_values)),
            'std': float(np.std(tension_values)),
            'max': float(np.max(tension_values)),
            'min': float(np.min(tension_values)),
            'peak_to_peak': float(np.ptp(tension_values)),
            'cv': float(np.std(tension_values) / np.mean(tension_values))
        }
    
    def check_tension_safety(self, thread_type: str, tension_values: np.ndarray) -> Dict:
        thread = self.threads.get(thread_type)
        if not thread:
            raise ValueError(f"Unknown thread type: {thread_type}")
        
        max_tension = np.max(tension_values)
        safety_factor = thread.breaking_tension / max_tension
        
        return {
            'safe': safety_factor > 1.5,
            'safety_factor': float(safety_factor),
            'breaking_tension': thread.breaking_tension,
            'max_tension': float(max_tension)
        }
    
    def simulate_multi_stitch_coordination(self, stitch_sequence: List[Dict],
                                             thread_type: str = 'silk_120D',
                                             total_duration: float = 10.0,
                                             coupling_strength: float = 0.15) -> Dict:
        n_points = int(total_duration * self.sample_rate)
        time = np.linspace(0, total_duration, n_points)
        combined_tension = np.zeros(n_points)
        individual_tensions = []
        stitch_info = []
        
        for seq_idx, stitch in enumerate(stitch_sequence):
            stitch_type = stitch.get('type', 'fill')
            base_tension = stitch.get('base_tension', 1.0)
            start_time = stitch.get('start_time', 0.0)
            end_time = stitch.get('end_time', total_duration)
            needle_id = stitch.get('needle_id', seq_idx)
            
            stitch_props = StitchType.get_stitch_properties(stitch_type)
            factor = stitch_props['tension_factor']
            
            mask = (time >= start_time) & (time <= end_time)
            stitch_duration = end_time - start_time
            stitch_time = time[mask]
            
            if len(stitch_time) > 0:
                phase = (stitch_time - start_time) / stitch_duration
                base = base_tension * factor
                
                penetration = 0.5 * base * np.sin(phase * np.pi)
                pull = 0.3 * base * np.sin((phase + 0.5) * np.pi)
                cumulative = 0.05 * base * (1 - np.exp(-phase * 5))
                
                tension = base + penetration + pull + cumulative
                tension += np.random.normal(0, 0.02 * base, size=len(tension))
            else:
                tension = np.array([])
            
            individual_tensions.append({
                'needle_id': needle_id,
                'stitch_type': stitch_type,
                'start_time': start_time,
                'end_time': end_time,
                'time': stitch_time,
                'tension': tension
            })
            stitch_info.append({
                'needle_id': needle_id,
                'stitch_type': stitch_type,
                'base_tension': base_tension
            })
            
            if len(tension) > 0:
                for i, t in enumerate(stitch_time):
                    idx = np.argmin(np.abs(time - t))
                    combined_tension[idx] += tension[i] * (1 - coupling_strength * seq_idx / len(stitch_sequence))
        
        for i in range(1, n_points):
            if combined_tension[i] == 0:
                combined_tension[i] = combined_tension[i-1]
        
        thread = self.threads.get(thread_type)
        breaking_tension = thread.breaking_tension if thread else 5.0
        combined_tension = np.clip(combined_tension, 0.01, breaking_tension * 0.8)
        
        return {
            'time': time,
            'combined_tension': combined_tension,
            'individual_tensions': individual_tensions,
            'stitch_info': stitch_info,
            'coupling_strength': coupling_strength
        }
    
    def detect_anomalies(self, time: np.ndarray, tension: np.ndarray,
                          window_size: int = 50, threshold: float = 3.0) -> Dict:
        n = len(tension)
        rolling_mean = np.zeros(n)
        rolling_std = np.zeros(n)
        
        for i in range(n):
            start = max(0, i - window_size // 2)
            end = min(n, i + window_size // 2 + 1)
            rolling_mean[i] = np.mean(tension[start:end])
            rolling_std[i] = np.std(tension[start:end])
        
        rolling_std = np.where(rolling_std < 1e-6, 1e-6, rolling_std)
        z_scores = np.abs((tension - rolling_mean) / rolling_std)
        
        anomaly_indices = np.where(z_scores > threshold)[0]
        anomaly_times = time[anomaly_indices]
        anomaly_values = tension[anomaly_indices]
        
        derivative = np.gradient(tension, time)
        sudden_changes = np.where(np.abs(derivative) > np.percentile(np.abs(derivative), 95))[0]
        
        thread = self.threads.get('silk_120D')
        breaking_tension = thread.breaking_tension if thread else 5.0
        high_tension_idx = np.where(tension > breaking_tension * 0.7)[0]
        
        low_tension_idx = np.where(tension < 0.2 * np.mean(tension))[0]
        
        anomaly_types = []
        for idx in anomaly_indices:
            if idx in high_tension_idx:
                anomaly_types.append('high_tension')
            elif idx in low_tension_idx:
                anomaly_types.append('low_tension')
            elif idx in sudden_changes:
                anomaly_types.append('sudden_change')
            else:
                anomaly_types.append('deviation')
        
        return {
            'anomaly_count': len(anomaly_indices),
            'anomaly_indices': anomaly_indices,
            'anomaly_times': anomaly_times,
            'anomaly_values': anomaly_values,
            'anomaly_types': anomaly_types,
            'z_scores': z_scores,
            'rolling_mean': rolling_mean,
            'rolling_std': rolling_std,
            'sudden_changes': sudden_changes,
            'high_tension_warnings': high_tension_idx,
            'anomaly_rate': len(anomaly_indices) / n
        }
    
    def compare_with_experimental(self, sim_time: np.ndarray, sim_tension: np.ndarray,
                                   exp_time: np.ndarray, exp_tension: np.ndarray) -> Dict:
        from scipy import interpolate
        
        f = interpolate.interp1d(sim_time, sim_tension, kind='linear', fill_value='extrapolate')
        sim_interp = f(exp_time)
        
        error = sim_interp - exp_tension
        mae = np.mean(np.abs(error))
        rmse = np.sqrt(np.mean(error ** 2))
        mape = np.mean(np.abs(error / (exp_tension + 1e-6))) * 100
        
        r = np.corrcoef(sim_interp, exp_tension)[0, 1]
        
        sim_mean, sim_std = np.mean(sim_tension), np.std(sim_tension)
        exp_mean, exp_std = np.mean(exp_tension), np.std(exp_tension)
        
        cv_error = abs(sim_std / sim_mean - exp_std / exp_mean) * 100
        
        from scipy.fft import fft, fftfreq
        n = len(exp_time)
        dt = np.mean(np.diff(exp_time))
        sim_fft = np.abs(fft(sim_interp))[:n//2]
        exp_fft = np.abs(fft(exp_tension))[:n//2]
        freq_corr = np.corrcoef(sim_fft, exp_fft)[0, 1]
        
        error_distribution = {
            'mean_error': float(np.mean(error)),
            'error_std': float(np.std(error)),
            'error_max': float(np.max(np.abs(error))),
            'p95_error': float(np.percentile(np.abs(error), 95))
        }
        
        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'correlation': float(r),
            'frequency_correlation': float(freq_corr),
            'cv_error_percent': float(cv_error),
            'sim_mean': float(sim_mean),
            'exp_mean': float(exp_mean),
            'sim_std': float(sim_std),
            'exp_std': float(exp_std),
            'error_distribution': error_distribution,
            'error_time_series': error,
            'sim_interpolated': sim_interp,
            'accuracy_score': float(max(0, 100 - mape * 2))
        }