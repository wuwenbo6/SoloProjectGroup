import numpy as np
from scipy import signal
from scipy.ndimage import median_filter
import librosa


class AudioPreprocessor:
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate

    def load_audio(self, file_path: str) -> tuple[np.ndarray, int]:
        y, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)
        return y, sr

    def normalize_audio(self, y: np.ndarray) -> np.ndarray:
        return librosa.util.normalize(y)

    def remove_silence(self, y: np.ndarray, top_db: int = 20) -> np.ndarray:
        yt, _ = librosa.effects.trim(y, top_db=top_db)
        return yt

    def bandpass_filter(self, y: np.ndarray, low_freq: float = 300, high_freq: float = 3000) -> np.ndarray:
        nyquist = 0.5 * self.sample_rate
        low = low_freq / nyquist
        high = high_freq / nyquist
        b, a = signal.butter(4, [low, high], btype='band')
        filtered = signal.lfilter(b, a, y)
        return filtered

    def spectral_subtraction(self, y: np.ndarray, n_fft: int = 2048, hop_length: int = 512) -> np.ndarray:
        stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
        mag, phase = librosa.magphase(stft)

        noise_est = np.mean(mag[:, :10], axis=1, keepdims=True)
        mag_clean = np.maximum(mag - 2 * noise_est, 0)

        stft_clean = mag_clean * phase
        y_clean = librosa.istft(stft_clean, hop_length=hop_length)
        return y_clean

    def wiener_filter(self, y: np.ndarray, n_fft: int = 2048, hop_length: int = 512) -> np.ndarray:
        stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
        mag, phase = librosa.magphase(stft)

        noise_pow = np.mean(np.abs(mag[:, :10]) ** 2, axis=1, keepdims=True)
        signal_pow = np.abs(mag) ** 2

        wiener_gain = signal_pow / (signal_pow + noise_pow + 1e-10)
        mag_clean = mag * wiener_gain

        stft_clean = mag_clean * phase
        y_clean = librosa.istft(stft_clean, hop_length=hop_length)
        return y_clean

    def median_filter_1d(self, y: np.ndarray, kernel_size: int = 3) -> np.ndarray:
        return median_filter(y, size=kernel_size)

    def preprocess(self, y: np.ndarray, apply_all: bool = True) -> np.ndarray:
        y_processed = self.normalize_audio(y)
        y_processed = self.remove_silence(y_processed)

        if apply_all:
            y_processed = self.spectral_subtraction(y_processed)
            y_processed = self.wiener_filter(y_processed)
            y_processed = self.bandpass_filter(y_processed)
            y_processed = self.median_filter_1d(y_processed)

        y_processed = self.normalize_audio(y_processed)
        return y_processed

    def preprocess_from_file(self, file_path: str, apply_all: bool = True) -> tuple[np.ndarray, int]:
        y, sr = self.load_audio(file_path)
        y_processed = self.preprocess(y, apply_all=apply_all)
        return y_processed, sr
