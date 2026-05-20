import numpy as np
import librosa
from scipy.ndimage import maximum_filter
from typing import List, Tuple, Dict
import hashlib
import struct


class FingerprintExtractor:
    def __init__(
        self,
        sample_rate: int = 22050,
        n_fft: int = 2048,
        hop_length: int = 512,
        n_mels: int = 128,
        peak_neighborhood_size: int = 15,
        target_fan_value: int = 10,
        min_hash_time_delta: int = 2,
        max_hash_time_delta: int = 100,
        fingerprint_reduction: int = 40,
        peak_threshold_std: float = 0.8,
        max_peaks_per_second: int = 50,
    ):
        self.sample_rate = sample_rate
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mels = n_mels
        self.peak_neighborhood_size = peak_neighborhood_size
        self.target_fan_value = target_fan_value
        self.min_hash_time_delta = min_hash_time_delta
        self.max_hash_time_delta = max_hash_time_delta
        self.fingerprint_reduction = fingerprint_reduction
        self.peak_threshold_std = peak_threshold_std
        self.max_peaks_per_second = max_peaks_per_second

    def compute_spectrogram(self, y: np.ndarray) -> np.ndarray:
        S = librosa.feature.melspectrogram(
            y=y,
            sr=self.sample_rate,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
        )
        S_db = librosa.power_to_db(S, ref=np.max)
        return S_db

    def find_peaks(self, spectrogram: np.ndarray) -> List[Tuple[int, int]]:
        neighborhood_size = self.peak_neighborhood_size
        data_max = maximum_filter(spectrogram, size=neighborhood_size)
        peaks = (spectrogram == data_max)

        threshold = np.mean(spectrogram) + self.peak_threshold_std * np.std(spectrogram)
        peaks = peaks & (spectrogram > threshold)

        peak_coords = []
        peak_values = []
        for freq_idx in range(peaks.shape[0]):
            for time_idx in range(peaks.shape[1]):
                if peaks[freq_idx, time_idx]:
                    peak_coords.append((freq_idx, time_idx))
                    peak_values.append(spectrogram[freq_idx, time_idx])

        if len(peak_coords) > 0:
            duration_seconds = spectrogram.shape[1] * self.hop_length / self.sample_rate
            max_peaks = int(self.max_peaks_per_second * max(duration_seconds, 1))

            if len(peak_coords) > max_peaks:
                sorted_indices = np.argsort(peak_values)[::-1]
                peak_coords = [peak_coords[i] for i in sorted_indices[:max_peaks]]

        peak_coords.sort(key=lambda x: x[1])
        return peak_coords

    def generate_hashes(
        self, peaks: List[Tuple[int, int]]
    ) -> List[Tuple[str, int]]:
        hashes = []
        unique_hashes = set()
        peaks.sort(key=lambda x: x[1])

        for i, (freq1, time1) in enumerate(peaks):
            count = 0
            for j in range(i + 1, min(i + self.target_fan_value + 5, len(peaks))):
                freq2, time2 = peaks[j]
                time_delta = time2 - time1

                if self.min_hash_time_delta < time_delta < self.max_hash_time_delta:
                    freq_delta = abs(freq2 - freq1)
                    hash_input = f"{freq1}:{freq2}:{time_delta}:{freq_delta}"
                    hash_bytes = hashlib.sha256(hash_input.encode()).digest()
                    hash_hex = hash_bytes.hex()[:self.fingerprint_reduction]

                    hash_key = f"{hash_hex}:{time1}"
                    if hash_key not in unique_hashes:
                        unique_hashes.add(hash_key)
                        hashes.append((hash_hex, time1))
                        count += 1

                    if count >= self.target_fan_value:
                        break

        return hashes

    def extract_fingerprint(self, y: np.ndarray) -> Dict:
        spectrogram = self.compute_spectrogram(y)
        peaks = self.find_peaks(spectrogram)
        hashes = self.generate_hashes(peaks)

        hash_vector = self._hashes_to_vector(hashes)

        return {
            "spectrogram": spectrogram,
            "peaks": peaks,
            "hashes": hashes,
            "hash_vector": hash_vector,
            "num_peaks": len(peaks),
            "num_hashes": len(hashes),
        }

    def _hashes_to_vector(self, hashes: List[Tuple[str, int]]) -> np.ndarray:
        vector_size = 256
        vector = np.zeros(vector_size, dtype=np.float32)

        time_bins = 16
        time_vector = np.zeros(time_bins, dtype=np.float32)

        if len(hashes) > 0:
            max_time = max(t for _, t in hashes)
            for hash_hex, time in hashes:
                hash_int = int(hash_hex, 16)
                idx = hash_int % vector_size
                vector[idx] += 1

                if max_time > 0:
                    time_bin = int((time / max_time) * (time_bins - 1))
                    time_vector[time_bin] += 1

            combined = np.concatenate([vector, time_vector])
            norm = np.linalg.norm(combined)
            if norm > 0:
                combined = combined / norm
            return combined[:256]

        return vector

    def extract_from_file(self, file_path: str, preprocessor=None) -> Dict:
        y, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)

        if preprocessor:
            y = preprocessor.preprocess(y)

        return self.extract_fingerprint(y)

    def extract_from_array(self, audio_array: np.ndarray, preprocessor=None) -> Dict:
        if preprocessor:
            audio_array = preprocessor.preprocess(audio_array)

        return self.extract_fingerprint(audio_array)
