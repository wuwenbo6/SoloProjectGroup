import numpy as np
from dataclasses import dataclass
from typing import Optional, Tuple
import logging
from enum import Enum


class NoiseType(Enum):
    TAPE_HISS = "tape_hiss"
    HUM = "hum"
    CLICK = "click"
    CRACKLE = "crackle"
    BACKGROUND = "background"


@dataclass
class AudioParams:
    sample_rate: int = 44100
    channels: int = 2
    bit_depth: int = 16
    noise_reduction_level: float = 0.7
    click_removal: bool = True
    hum_removal: bool = True
    normalize: bool = True
    target_level: float = -16.0
    compression: bool = True
    compression_threshold: float = -24.0
    compression_ratio: float = 4.0


class AudioNoiseReducer:
    def __init__(self, params: Optional[AudioParams] = None):
        self.params = params or AudioParams()
        self.logger = logging.getLogger("AudioNoiseReducer")
        self._noise_profile: Optional[np.ndarray] = None

    def process_audio(self, audio_data: np.ndarray) -> np.ndarray:
        result = audio_data.astype(np.float32)

        if len(result.shape) > 1:
            for ch in range(result.shape[1]):
                result[:, ch] = self._process_channel(result[:, ch])
        else:
            result = self._process_channel(result)

        return result

    def _process_channel(self, channel: np.ndarray) -> np.ndarray:
        result = channel.copy()

        if self.params.click_removal:
            result = self._remove_clicks(result)

        if self.params.hum_removal:
            result = self._remove_hum(result)

        if self.params.noise_reduction_level > 0:
            result = self._spectral_noise_reduction(result)

        if self.params.compression:
            result = self._apply_compression(result)

        if self.params.normalize:
            result = self._normalize(result)

        return result

    def _remove_clicks(self, audio: np.ndarray, threshold: float = 6.0) -> np.ndarray:
        result = audio.copy()
        window_size = int(self.params.sample_rate * 0.002)

        for i in range(window_size, len(audio) - window_size):
            local_mean = np.mean(np.abs(audio[i - window_size:i + window_size]))
            current_val = np.abs(audio[i])

            if current_val > threshold * local_mean:
                left = audio[i - window_size]
                right = audio[i + window_size]
                result[i] = left + (right - left) * 0.5

        return result

    def _remove_hum(self, audio: np.ndarray, base_freq: float = 50.0) -> np.ndarray:
        result = audio.copy()
        harmonics = [base_freq * (i + 1) for i in range(5)]

        n = len(audio)
        fft_data = np.fft.rfft(audio)
        freqs = np.fft.rfftfreq(n, 1.0 / self.params.sample_rate)

        for freq in harmonics:
            if freq < freqs[-1]:
                idx = np.argmin(np.abs(freqs - freq))
                bandwidth = max(3, int(5.0 * n / self.params.sample_rate))
                start = max(0, idx - bandwidth)
                end = min(len(fft_data), idx + bandwidth)

                fft_data[start:end] *= 0.01

        result = np.fft.irfft(fft_data, n)
        return result.astype(np.float32)

    def _spectral_noise_reduction(self, audio: np.ndarray) -> np.ndarray:
        n_fft = 2048
        hop_length = 512

        if self._noise_profile is None:
            noise_start = int(0.1 * self.params.sample_rate)
            noise_end = int(0.5 * self.params.sample_rate)
            if noise_end < len(audio):
                self._noise_profile = self._estimate_noise_profile(audio[noise_start:noise_end], n_fft, hop_length)

        if self._noise_profile is None:
            return audio

        n_frames = 1 + (len(audio) - n_fft) // hop_length
        enhanced = np.zeros_like(audio)
        window = np.hanning(n_fft)

        for i in range(n_frames):
            start = i * hop_length
            end = start + n_fft
            if end > len(audio):
                break

            frame = audio[start:end] * window
            fft_frame = np.fft.rfft(frame)
            mag = np.abs(fft_frame)

            gain = np.maximum(0.01, 1.0 - self.params.noise_reduction_level * self._noise_profile / (mag + 1e-10))
            enhanced_fft = fft_frame * gain

            enhanced_frame = np.fft.irfft(enhanced_fft, n_fft)
            enhanced[start:end] += enhanced_frame * window

        return enhanced

    def _estimate_noise_profile(self, noise_sample: np.ndarray, n_fft: int, hop_length: int) -> np.ndarray:
        n_frames = 1 + (len(noise_sample) - n_fft) // hop_length
        window = np.hanning(n_fft)
        mag_sum = np.zeros(n_fft // 2 + 1)

        for i in range(n_frames):
            start = i * hop_length
            end = start + n_fft
            if end > len(noise_sample):
                break

            frame = noise_sample[start:end] * window
            fft_frame = np.fft.rfft(frame)
            mag_sum += np.abs(fft_frame)

        return mag_sum / n_frames

    def _apply_compression(self, audio: np.ndarray) -> np.ndarray:
        threshold_linear = 10.0 ** (self.params.compression_threshold / 20.0)
        ratio = self.params.compression_ratio

        envelope = np.abs(audio)
        gain = np.ones_like(envelope)

        mask = envelope > threshold_linear
        gain[mask] = threshold_linear + (envelope[mask] - threshold_linear) / ratio
        gain[mask] /= envelope[mask]

        return audio * gain

    def _normalize(self, audio: np.ndarray) -> np.ndarray:
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            target_linear = 10.0 ** (self.params.target_level / 20.0)
            audio = audio * (target_linear / max_val)
        return audio

    def learn_noise_profile(self, noise_audio: np.ndarray):
        n_fft = 2048
        hop_length = 512
        self._noise_profile = self._estimate_noise_profile(noise_audio, n_fft, hop_length)
        self.logger.info("Noise profile learned successfully")


class WaveformProcessor:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.logger = logging.getLogger("WaveformProcessor")

    def remove_silence(self, audio: np.ndarray, threshold: float = 0.01,
                       min_silence_duration: float = 0.5) -> np.ndarray:
        min_samples = int(min_silence_duration * self.sample_rate)
        envelope = np.convolve(np.abs(audio), np.ones(1000) / 1000, mode='same')
        is_speech = envelope > threshold

        speech_regions = []
        in_speech = False
        start = 0

        for i, val in enumerate(is_speech):
            if val and not in_speech:
                start = i
                in_speech = True
            elif not val and in_speech and (i - start) > min_samples:
                speech_regions.append((start, i))
                in_speech = False

        if in_speech:
            speech_regions.append((start, len(audio)))

        result_segments = []
        for start, end in speech_regions:
            result_segments.append(audio[start:end])

        if result_segments:
            return np.concatenate(result_segments)
        return audio

    def smooth_transitions(self, audio: np.ndarray, fade_duration: float = 0.01) -> np.ndarray:
        fade_samples = int(fade_duration * self.sample_rate)
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)

        result = audio.copy()
        result[:fade_samples] *= fade_in
        result[-fade_samples:] *= fade_out

        return result

    def trim(self, audio: np.ndarray, start_seconds: float = 0.0,
             end_seconds: Optional[float] = None) -> np.ndarray:
        start = int(start_seconds * self.sample_rate)
        if end_seconds is not None:
            end = int(end_seconds * self.sample_rate)
            return audio[start:end]
        return audio[start:]

    def adjust_volume(self, audio: np.ndarray, gain_db: float) -> np.ndarray:
        gain_linear = 10.0 ** (gain_db / 20.0)
        return audio * gain_linear
