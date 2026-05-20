import numpy as np
from scipy import signal, interpolate, stats, fft
from typing import Dict, List, Tuple, Optional, Callable
from functools import lru_cache


class NumericalComputation:
    def __init__(self, use_numba: bool = False):
        self.use_numba = use_numba
        self._compute_window = None
        self._cache_stats = {}
    
    @staticmethod
    def _rolling_window(a: np.ndarray, window: int) -> np.ndarray:
        shape = a.shape[:-1] + (a.shape[-1] - window + 1, window)
        strides = a.strides + (a.strides[-1],)
        return np.lib.stride_tricks.as_strided(a, shape=shape, strides=strides)
    
    def compute_basic_statistics(self, data: np.ndarray, use_cache: bool = False) -> Dict:
        if use_cache:
            data_hash = hash(data.tobytes())
            if data_hash in self._cache_stats:
                return self._cache_stats[data_hash]
        
        n = len(data)
        mean_val = np.mean(data)
        std_val = np.std(data)
        min_val = np.min(data)
        max_val = np.max(data)
        
        data_sorted = np.sort(data)
        q25 = data_sorted[int(n * 0.25)]
        q75 = data_sorted[int(n * 0.75)]
        
        diff = data - mean_val
        skewness = float(np.mean(diff ** 3) / (std_val ** 3)) if std_val > 0 else 0.0
        kurtosis = float(np.mean(diff ** 4) / (std_val ** 4) - 3) if std_val > 0 else 0.0
        
        result = {
            'mean': float(mean_val),
            'median': float(np.median(data)),
            'std': float(std_val),
            'var': float(std_val ** 2),
            'min': float(min_val),
            'max': float(max_val),
            'range': float(max_val - min_val),
            'skewness': skewness,
            'kurtosis': kurtosis,
            'q25': float(q25),
            'q75': float(q75),
            'iqr': float(q75 - q25)
        }
        
        if use_cache:
            self._cache_stats[data_hash] = result
            if len(self._cache_stats) > 100:
                self._cache_stats.clear()
        
        return result
    
    def compute_derivative(self, x: np.ndarray, y: np.ndarray,
                            order: int = 1) -> np.ndarray:
        if order == 1:
            return np.gradient(y, x)
        elif order == 2:
            first = np.gradient(y, x)
            return np.gradient(first, x)
        else:
            raise ValueError("Order must be 1 or 2")
    
    def compute_integral(self, x: np.ndarray, y: np.ndarray) -> float:
        return float(np.trapz(y, x))
    
    def compute_moving_average(self, data: np.ndarray, window_size: int,
                                mode: str = 'same') -> np.ndarray:
        kernel = np.ones(window_size) / window_size
        return np.convolve(data, kernel, mode=mode)
    
    def apply_filter(self, data: np.ndarray, filter_type: str = 'lowpass',
                     cutoff: float = 0.1, order: int = 4) -> np.ndarray:
        b, a = signal.butter(order, cutoff, btype=filter_type)
        return signal.filtfilt(b, a, data)
    
    def compute_fft(self, data: np.ndarray, sample_rate: float) -> Tuple[np.ndarray, np.ndarray]:
        n = len(data)
        fft_vals = fft.fft(data, workers=-1)
        freqs = fft.fftfreq(n, 1 / sample_rate)
        
        positive_mask = freqs >= 0
        return freqs[positive_mask], np.abs(fft_vals[positive_mask])
    
    def find_peaks(self, data: np.ndarray, height: Optional[float] = None,
                    distance: Optional[int] = None,
                    prominence: Optional[float] = None) -> Tuple[np.ndarray, Dict]:
        peaks, properties = signal.find_peaks(
            data, height=height, distance=distance, prominence=prominence
        )
        
        simple_props = {}
        if 'peak_heights' in properties:
            simple_props['peak_heights'] = properties['peak_heights']
        if 'prominences' in properties:
            simple_props['prominences'] = properties['prominences']
            
        return peaks, simple_props
    
    def find_valleys(self, data: np.ndarray, **kwargs) -> Tuple[np.ndarray, Dict]:
        return self.find_peaks(-data, **kwargs)
    
    def interpolate_data(self, x: np.ndarray, y: np.ndarray, 
                          new_x: np.ndarray, method: str = 'linear') -> np.ndarray:
        if method == 'linear':
            f = interpolate.interp1d(x, y, kind='linear', fill_value='extrapolate')
        elif method == 'cubic':
            f = interpolate.interp1d(x, y, kind='cubic', fill_value='extrapolate')
        elif method == 'spline':
            f = interpolate.make_interp_spline(x, y)
        else:
            raise ValueError(f"Unknown interpolation method: {method}")
        
        return f(new_x)
    
    def compute_correlation(self, x: np.ndarray, y: np.ndarray) -> Dict:
        pearson_r, pearson_p = stats.pearsonr(x, y)
        spearman_r, spearman_p = stats.spearmanr(x, y)
        
        return {
            'pearson': {'r': float(pearson_r), 'p_value': float(pearson_p)},
            'spearman': {'r': float(spearman_r), 'p_value': float(spearman_p)}
        }
    
    def compute_autocorrelation(self, data: np.ndarray, max_lag: Optional[int] = None) -> np.ndarray:
        n = len(data)
        if max_lag is None:
            max_lag = n // 4
        
        mean_val = np.mean(data)
        data_centered = data - mean_val
        
        result = np.correlate(data_centered, data_centered, mode='full')
        result = result[result.size // 2: result.size // 2 + max_lag]
        return result / result[0]
    
    def compute_rolling_window_stats(self, data: np.ndarray, 
                                      window_size: int) -> Dict[str, np.ndarray]:
        pad_left = window_size // 2
        pad_right = window_size - pad_left - 1
        padded = np.pad(data, (pad_left, pad_right), mode='reflect')
        
        windows = self._rolling_window(padded, window_size)
        
        rolling_mean = np.mean(windows, axis=1)
        rolling_std = np.std(windows, axis=1)
        
        return {
            'mean': rolling_mean,
            'std': rolling_std
        }
    
    def detect_outliers(self, data: np.ndarray, method: str = 'iqr',
                         threshold: float = 1.5) -> np.ndarray:
        if method == 'iqr':
            q1 = np.percentile(data, 25)
            q3 = np.percentile(data, 75)
            iqr = q3 - q1
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            return np.where((data < lower_bound) | (data > upper_bound))[0]
        elif method == 'zscore':
            mean_val, std_val = np.mean(data), np.std(data)
            z_scores = np.abs((data - mean_val) / std_val) if std_val > 0 else np.zeros_like(data)
            return np.where(z_scores > threshold)[0]
        else:
            raise ValueError(f"Unknown outlier detection method: {method}")
    
    def fit_distribution(self, data: np.ndarray, 
                          dist_name: str = 'norm') -> Dict:
        dist = getattr(stats, dist_name)
        params = dist.fit(data)
        
        ks_stat, ks_p = stats.kstest(data, dist_name, args=params)
        
        return {
            'distribution': dist_name,
            'parameters': params,
            'ks_statistic': float(ks_stat),
            'ks_p_value': float(ks_p)
        }
    
    def compute_confidence_interval(self, data: np.ndarray, 
                                     confidence: float = 0.95) -> Tuple[float, float]:
        mean_val = np.mean(data)
        se = stats.sem(data)
        ci = se * stats.t.ppf((1 + confidence) / 2, len(data) - 1)
        return (float(mean_val - ci), float(mean_val + ci))
    
    def compute_strain_energy(self, tension: np.ndarray, 
                               elongation: np.ndarray) -> float:
        return float(np.trapz(tension, elongation))
    
    def compute_stress_strain(self, force: np.ndarray, area: float,
                               original_length: float, 
                               elongation: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        stress = force / area
        strain = elongation / original_length
        return stress, strain
    
    def compute_young_modulus(self, stress: np.ndarray, 
                               strain: np.ndarray) -> float:
        linear_region_mask = strain < 0.001
        if np.sum(linear_region_mask) < 2:
            linear_region_mask = np.ones_like(strain, dtype=bool)
        
        slope, intercept, r_value, p_value, std_err = stats.linregress(
            strain[linear_region_mask], stress[linear_region_mask]
        )
        return float(slope)
    
    def compute_damping_coefficient(self, time: np.ndarray, 
                                     amplitude: np.ndarray) -> Dict:
        log_amplitudes = np.log(np.abs(amplitude) + 1e-10)
        slope, intercept, r_value, p_value, std_err = stats.linregress(
            time, log_amplitudes
        )
        
        return {
            'damping_ratio': float(-slope),
            'r_squared': float(r_value ** 2),
            'std_error': float(std_err)
        }
    
    def numerical_integration(self, func: Callable[[float], float],
                               a: float, b: float) -> Tuple[float, float]:
        from scipy.integrate import quad
        result, error = quad(func, a, b)
        return float(result), float(error)
    
    def compute_power_spectral_density(self, data: np.ndarray, 
                                        sample_rate: float,
                                        nperseg: int = 256) -> Tuple[np.ndarray, np.ndarray]:
        freqs, psd = signal.welch(data, fs=sample_rate, nperseg=nperseg)
        return freqs, psd
    
    def compute_cross_correlation(self, x: np.ndarray, y: np.ndarray,
                                   max_lag: Optional[int] = None) -> np.ndarray:
        result = signal.correlate(x - np.mean(x), y - np.mean(y), mode='full')
        if max_lag is not None:
            center = len(result) // 2
            result = result[center - max_lag: center + max_lag + 1]
        return result
    
    def compute_snr(self, signal_data: np.ndarray, noise_data: np.ndarray) -> float:
        signal_power = np.mean(signal_data ** 2)
        noise_power = np.mean(noise_data ** 2)
        return float(10 * np.log10(signal_power / noise_power))
    
    def fast_rolling_zscore(self, data: np.ndarray, window_size: int) -> np.ndarray:
        stats_dict = self.compute_rolling_window_stats(data, window_size)
        mean_val, std_val = stats_dict['mean'], stats_dict['std']
        std_val = np.where(std_val < 1e-6, 1e-6, std_val)
        return (data - mean_val) / std_val
    
    def compute_batch_statistics(self, data_matrix: np.ndarray) -> Dict[str, np.ndarray]:
        return {
            'mean': np.mean(data_matrix, axis=1),
            'std': np.std(data_matrix, axis=1),
            'max': np.max(data_matrix, axis=1),
            'min': np.min(data_matrix, axis=1)
        }
    
    def downsample_data(self, data: np.ndarray, factor: int, method: str = 'mean') -> np.ndarray:
        if method == 'mean':
            return np.mean(data[:len(data) - len(data) % factor].reshape(-1, factor), axis=1)
        elif method == 'max':
            return np.max(data[:len(data) - len(data) % factor].reshape(-1, factor), axis=1)
        elif method == 'min':
            return np.min(data[:len(data) - len(data) % factor].reshape(-1, factor), axis=1)
        else:
            return data[::factor]
    
    def vectorized_peak_detection(self, data: np.ndarray, threshold: float) -> np.ndarray:
        dx = data[1:] - data[:-1]
        peaks = np.where((dx[:-1] > 0) & (dx[1:] < 0) & (data[1:-1] > threshold))[0] + 1
        return peaks
