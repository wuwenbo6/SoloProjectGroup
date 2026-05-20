import numpy as np
from scipy import signal
import pywt
from typing import Tuple, List, Dict
import logging

logger = logging.getLogger(__name__)

class SignalProcessor:
    @staticmethod
    def compute_fft(signal_data: np.ndarray, sample_rate: int) -> Tuple[np.ndarray, np.ndarray]:
        n = len(signal_data)
        fft_vals = np.fft.fft(signal_data)
        fft_freq = np.fft.fftfreq(n, 1/sample_rate)
        
        positive_mask = fft_freq >= 0
        amplitudes = 2.0/n * np.abs(fft_vals[positive_mask])
        frequencies = fft_freq[positive_mask]
        
        return frequencies, amplitudes
    
    @staticmethod
    def compute_spectrogram(signal_data: np.ndarray, sample_rate: int, 
                           nperseg: int = 256, noverlap: int = 128) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        frequencies, times, spectrogram = signal.spectrogram(
            signal_data, 
            fs=sample_rate,
            nperseg=nperseg,
            noverlap=noverlap
        )
        
        spectrogram_db = 10 * np.log10(spectrogram + 1e-10)
        
        return frequencies, times, spectrogram_db
    
    @staticmethod
    def compute_wavelet_transform(signal_data: np.ndarray, wavelet: str = 'morl',
                                  scales: np.ndarray = None) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if scales is None:
            scales = np.arange(1, 128)
        
        coefficients, frequencies = pywt.cwt(signal_data, scales, wavelet)
        power = np.abs(coefficients) ** 2
        
        power_db = 10 * np.log10(power + 1e-10)
        
        return frequencies, power_db, scales
    
    @staticmethod
    def compute_rms(signal_data: np.ndarray, window_size: int = 100) -> np.ndarray:
        rms = []
        for i in range(0, len(signal_data) - window_size + 1, window_size // 2):
            window = signal_data[i:i + window_size]
            rms_val = np.sqrt(np.mean(window ** 2))
            rms.append(rms_val)
        
        return np.array(rms)
    
    @staticmethod
    def compute_peak_frequency(frequencies: np.ndarray, amplitudes: np.ndarray) -> float:
        if len(amplitudes) == 0:
            return 0.0
        peak_idx = np.argmax(amplitudes)
        return float(frequencies[peak_idx])
    
    @staticmethod
    def extract_features(signal_data: np.ndarray, sample_rate: int) -> Dict:
        rms = np.sqrt(np.mean(signal_data ** 2))
        peak = np.max(np.abs(signal_data))
        kurtosis = np.mean((signal_data - np.mean(signal_data)) ** 4) / (np.std(signal_data) ** 4)
        crest_factor = peak / rms if rms > 0 else 0
        
        frequencies, amplitudes = SignalProcessor.compute_fft(signal_data, sample_rate)
        peak_freq = SignalProcessor.compute_peak_frequency(frequencies, amplitudes)
        
        return {
            "rms": float(rms),
            "peak": float(peak),
            "kurtosis": float(kurtosis),
            "crest_factor": float(crest_factor),
            "peak_frequency": float(peak_freq)
        }

processor = SignalProcessor()
