import librosa
import numpy as np
import soundfile as sf
from scipy.signal import correlate
from typing import Dict, List, Tuple


class AudioProcessor:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.frame_duration = 0.025
        self.hop_duration = 0.010

    def load_audio(self, audio_path: str) -> Tuple[np.ndarray, int]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        return y, sr

    def extract_mfcc(self, y: np.ndarray, sr: int) -> np.ndarray:
        mfcc = librosa.feature.mfcc(
            y=y, sr=sr, n_mfcc=13,
            n_fft=int(self.frame_duration * sr),
            hop_length=int(self.hop_duration * sr)
        )
        return mfcc.T

    def extract_rms_energy(self, y: np.ndarray, sr: int) -> np.ndarray:
        rms = librosa.feature.rms(
            y=y,
            frame_length=int(self.frame_duration * sr),
            hop_length=int(self.hop_duration * sr)
        )
        return rms[0]

    def detect_voice_activity(self, y: np.ndarray, sr: int, threshold: float = 0.02) -> List[Dict]:
        rms = self.extract_rms_energy(y, sr)
        hop_length = int(self.hop_duration * sr)
        segments = []
        is_speech = False
        start_time = 0

        for i, energy in enumerate(rms):
            time = i * self.hop_duration
            if energy > threshold and not is_speech:
                start_time = time
                is_speech = True
            elif energy <= threshold and is_speech:
                segments.append({
                    'start': start_time,
                    'end': time,
                    'duration': time - start_time
                })
                is_speech = False

        if is_speech:
            segments.append({
                'start': start_time,
                'end': len(rms) * self.hop_duration,
                'duration': len(rms) * self.hop_duration - start_time
            })

        return segments

    def compute_audio_envelope(self, y: np.ndarray, sr: int, fps: int = 30) -> np.ndarray:
        hop_length = int(sr / fps)
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length)
        envelope = rms[0]
        envelope = (envelope - envelope.min()) / (envelope.max() - envelope.min() + 1e-8)
        return envelope

    def cross_correlation(self, signal1: np.ndarray, signal2: np.ndarray) -> Tuple[int, float]:
        corr = correlate(signal1, signal2, mode='full')
        lag = np.argmax(corr) - len(signal2) + 1
        max_corr = corr[np.argmax(corr)] / (np.linalg.norm(signal1) * np.linalg.norm(signal2) + 1e-8)
        return lag, max_corr

    def get_audio_duration(self, audio_path: str) -> float:
        y, sr = self.load_audio(audio_path)
        return len(y) / sr
