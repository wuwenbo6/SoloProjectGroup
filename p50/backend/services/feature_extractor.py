import numpy as np
import librosa
from typing import Dict, List, Tuple
from config.settings import settings

class FeatureExtractor:
    def __init__(self, sample_rate: int = None):
        self.sample_rate = sample_rate or settings.SAMPLE_RATE
        
    def extract_mfcc(self, audio_path: str, n_mfcc: int = 13) -> List[List[float]]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        return mfcc.T.tolist()
    
    def extract_pitch(self, audio_path: str) -> List[float]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_contour = []
        for i in range(pitches.shape[1]):
            index = magnitudes[:, i].argmax()
            pitch = pitches[index, i]
            pitch_contour.append(float(pitch))
        return pitch_contour
    
    def extract_energy(self, audio_path: str) -> List[float]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        energy = librosa.feature.rms(y=y)
        return energy[0].tolist()
    
    def extract_tempo(self, audio_path: str) -> float:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return float(tempo)
    
    def extract_speech_rate(self, audio_path: str) -> float:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        duration = len(y) / sr
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        syllable_count = len(onsets)
        return syllable_count / duration if duration > 0 else 0
    
    def extract_spectral_features(self, audio_path: str) -> Dict:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        
        return {
            "spectral_centroids": spectral_centroids[0].tolist(),
            "spectral_bandwidth": spectral_bandwidth[0].tolist(),
            "spectral_rolloff": spectral_rolloff[0].tolist()
        }
    
    def extract_zero_crossing_rate(self, audio_path: str) -> List[float]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        zcr = librosa.feature.zero_crossing_rate(y)
        return zcr[0].tolist()
    
    def extract_chroma_features(self, audio_path: str) -> List[List[float]]:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        return chroma.T.tolist()
    
    def extract_all_features(self, audio_path: str) -> Dict:
        return {
            "mfcc": self.extract_mfcc(audio_path),
            "pitch": self.extract_pitch(audio_path),
            "energy": self.extract_energy(audio_path),
            "tempo": self.extract_tempo(audio_path),
            "speech_rate": self.extract_speech_rate(audio_path),
            "spectral": self.extract_spectral_features(audio_path),
            "zero_crossing_rate": self.extract_zero_crossing_rate(audio_path),
            "chroma": self.extract_chroma_features(audio_path)
        }
    
    def extract_prosody_features(self, audio_path: str) -> Dict:
        return {
            "pitch": self.extract_pitch(audio_path),
            "energy": self.extract_energy(audio_path),
            "tempo": self.extract_tempo(audio_path),
            "speech_rate": self.extract_speech_rate(audio_path)
        }
