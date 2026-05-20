import numpy as np
import librosa
import librosa.display


class MelSpectrogramExtractor:
    def __init__(self, n_mels=128, fmin=0, fmax=8000, n_fft=2048, hop_length=512):
        self.n_mels = n_mels
        self.fmin = fmin
        self.fmax = fmax
        self.n_fft = n_fft
        self.hop_length = hop_length

    def extract(self, audio_path, sr=22050, duration=None):
        y, sr = librosa.load(audio_path, sr=sr, duration=duration)
        
        if len(y) < self.n_fft:
            y = np.pad(y, (0, self.n_fft - len(y)), mode='constant')
        
        mel_spect = librosa.feature.melspectrogram(
            y=y,
            sr=sr,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
            fmin=self.fmin,
            fmax=self.fmax
        )
        
        log_mel_spect = librosa.power_to_db(mel_spect, ref=np.max)
        
        return log_mel_spect

    def extract_from_array(self, y, sr=22050):
        if len(y) < self.n_fft:
            y = np.pad(y, (0, self.n_fft - len(y)), mode='constant')
        
        mel_spect = librosa.feature.melspectrogram(
            y=y,
            sr=sr,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
            fmin=self.fmin,
            fmax=self.fmax
        )
        
        log_mel_spect = librosa.power_to_db(mel_spect, ref=np.max)
        
        return log_mel_spect


def normalize_spectrogram(spect):
    min_val = np.min(spect)
    max_val = np.max(spect)
    if max_val == min_val:
        return np.zeros_like(spect)
    return (spect - min_val) / (max_val - min_val)


def pad_or_truncate(spect, target_frames=128):
    n_mels, n_frames = spect.shape
    
    if n_frames < target_frames:
        pad_width = target_frames - n_frames
        spect = np.pad(spect, ((0, 0), (0, pad_width)), mode='constant')
    elif n_frames > target_frames:
        spect = spect[:, :target_frames]
    
    return spect
