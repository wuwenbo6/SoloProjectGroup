import librosa
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from scipy import signal
from scipy.stats import skew, kurtosis, pearsonr
from scipy.signal import savgol_filter


class FeatureExtractor:
    HIGH_PITCH_THRESHOLD = 500  # Hz - 戏曲高音域阈值
    PITCH_QUANTILES = [0.25, 0.5, 0.75, 0.9, 0.95]
    
    def __init__(self, sample_rate: int = 22050, hop_length: int = 512,
                 n_fft: int = 2048, enable_high_pitch_enhancement: bool = True):
        self.sample_rate = sample_rate
        self.hop_length = hop_length
        self.n_fft = n_fft
        self.enable_high_pitch_enhancement = enable_high_pitch_enhancement
        self.feature_names = []

    def extract_all_features(self, y: np.ndarray, sr: Optional[int] = None) -> Dict[str, np.ndarray]:
        sr = sr or self.sample_rate
        
        if self.enable_high_pitch_enhancement:
            y = self._enhance_high_pitch(y, sr)
        
        features = {}
        
        pitch_features = self.extract_pitch_features(y, sr)
        features.update(pitch_features)
        
        high_pitch_features = self.extract_high_pitch_features(y, sr)
        features.update(high_pitch_features)
        
        formant_features = self.extract_formant_features(y, sr)
        features.update(formant_features)
        
        harmonic_features = self.extract_harmonic_features(y, sr)
        features.update(harmonic_features)
        
        rhythm_features = self.extract_rhythm_features(y, sr)
        features.update(rhythm_features)
        
        timbre_features = self.extract_timbre_features(y, sr)
        features.update(timbre_features)
        
        energy_features = self.extract_energy_features(y, sr)
        features.update(energy_features)
        
        return features

    def _enhance_high_pitch(self, y: np.ndarray, sr: int) -> np.ndarray:
        nyquist = sr / 2
        high_pass_cutoff = 300
        
        b, a = signal.butter(4, high_pass_cutoff / nyquist, 'high')
        y_high = signal.filtfilt(b, a, y)
        
        y_enhanced = y + 0.3 * y_high
        
        return y_enhanced

    def extract_pitch_features(self, y: np.ndarray, sr: int) -> Dict[str, Union[float, np.ndarray]]:
        f0_pyin, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=self.hop_length
        )
        
        f0_crepe = self._crepe_like_estimation(y, sr)
        
        f0 = self._fuse_f0_estimations(f0_pyin, f0_crepe, voiced_probs)
        
        f0 = self._smooth_f0(f0)
        
        f0_clean = f0[~np.isnan(f0)]
        
        if len(f0_clean) == 0:
            return self._empty_pitch_features()
        
        features = {
            'pitch_mean': float(np.mean(f0_clean)),
            'pitch_std': float(np.std(f0_clean)),
            'pitch_min': float(np.min(f0_clean)),
            'pitch_max': float(np.max(f0_clean)),
            'pitch_median': float(np.median(f0_clean)),
            'pitch_skew': float(skew(f0_clean)),
            'pitch_kurtosis': float(kurtosis(f0_clean)),
            'pitch_range': float(np.max(f0_clean) - np.min(f0_clean)),
            'voiced_ratio': float(np.mean(voiced_flag)),
            'pitch_contour': f0
        }
        
        for q in self.PITCH_QUANTILES:
            features[f'pitch_q{int(q*100)}'] = float(np.quantile(f0_clean, q))
        
        cents = librosa.hz_to_midi(f0_clean)
        features['vibrato_rate'] = self._estimate_vibrato_rate(cents)
        features['vibrato_depth'] = float(np.std(cents)) if len(cents) > 0 else 0
        
        features['pitch_stability'] = self._compute_pitch_stability(f0_clean)
        
        features['glide_count'], features['glide_intensity'] = self._detect_glides(f0)
        
        return features

    def _crepe_like_estimation(self, y: np.ndarray, sr: int) -> np.ndarray:
        S = np.abs(librosa.stft(y, n_fft=self.n_fft, hop_length=self.hop_length))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=self.n_fft)
        
        f0_est = []
        for i in range(S.shape[1]):
            spectrum = S[:, i]
            peak_idx = np.argmax(spectrum)
            
            if peak_idx > 0 and peak_idx < len(spectrum) - 1:
                left = spectrum[peak_idx - 1]
                mid = spectrum[peak_idx]
                right = spectrum[peak_idx + 1]
                
                denominator = left + right - 2 * mid
                if abs(denominator) > 1e-10:
                    delta = 0.5 * (left - right) / denominator
                    peak_freq = freqs[peak_idx] + delta * (freqs[1] - freq[0])
                else:
                    peak_freq = freqs[peak_idx]
            else:
                peak_freq = freqs[peak_idx]
            
            f0_est.append(peak_freq)
        
        return np.array(f0_est)

    def _fuse_f0_estimations(self, f0_pyin: np.ndarray, f0_crepe: np.ndarray, 
                            confidence: np.ndarray) -> np.ndarray:
        f0_fused = np.copy(f0_pyin)
        
        for i in range(len(f0_pyin)):
            if np.isnan(f0_pyin[i]) and not np.isnan(f0_crepe[i]):
                f0_fused[i] = f0_crepe[i]
            elif not np.isnan(f0_pyin[i]) and not np.isnan(f0_crepe[i]):
                conf = confidence[i] if i < len(confidence) else 0.5
                f0_fused[i] = conf * f0_pyin[i] + (1 - conf) * f0_crepe[i]
        
        return f0_fused

    def _smooth_f0(self, f0: np.ndarray, window_length: int = 7) -> np.ndarray:
        valid_mask = ~np.isnan(f0)
        if np.sum(valid_mask) < window_length:
            return f0
        
        f0_interp = np.copy(f0)
        valid_indices = np.where(valid_mask)[0]
        
        if len(valid_indices) > 1:
            f0_interp = np.interp(np.arange(len(f0)), valid_indices, f0[valid_indices])
        
        try:
            f0_smoothed = savgol_filter(f0_interp, window_length, 2)
        except:
            f0_smoothed = f0_interp
        
        f0_smoothed[~valid_mask] = np.nan
        
        return f0_smoothed

    def _empty_pitch_features(self) -> Dict[str, Union[float, np.ndarray]]:
        features = {}
        for name in ['pitch_mean', 'pitch_std', 'pitch_min', 'pitch_max', 
                     'pitch_median', 'pitch_skew', 'pitch_kurtosis', 'pitch_range',
                     'voiced_ratio', 'vibrato_rate', 'vibrato_depth',
                     'pitch_stability', 'glide_count', 'glide_intensity']:
            features[name] = 0.0
        for q in self.PITCH_QUANTILES:
            features[f'pitch_q{int(q*100)}'] = 0.0
        features['pitch_contour'] = np.array([])
        return features

    def extract_high_pitch_features(self, y: np.ndarray, sr: int) -> Dict[str, Union[float, np.ndarray]]:
        f0, _, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=self.hop_length
        )
        
        f0_clean = f0[~np.isnan(f0)]
        
        features = {}
        
        if len(f0_clean) > 0:
            high_pitch_mask = f0_clean > self.HIGH_PITCH_THRESHOLD
            high_pitch_values = f0_clean[high_pitch_mask]
            
            features['high_pitch_ratio'] = float(np.sum(high_pitch_mask) / len(f0_clean))
            
            if len(high_pitch_values) > 0:
                features['high_pitch_mean'] = float(np.mean(high_pitch_values))
                features['high_pitch_std'] = float(np.std(high_pitch_values))
                features['high_pitch_max'] = float(np.max(high_pitch_values))
                features['high_pitch_range'] = float(np.max(high_pitch_values) - np.min(high_pitch_values))
                features['high_pitch_energy'] = float(np.sum(high_pitch_values ** 2) / len(high_pitch_values))
            else:
                for name in ['high_pitch_mean', 'high_pitch_std', 'high_pitch_max',
                             'high_pitch_range', 'high_pitch_energy']:
                    features[name] = 0.0
            
            features['opera_head_voice_ratio'] = self._estimate_head_voice_ratio(f0_clean)
        else:
            for name in ['high_pitch_ratio', 'high_pitch_mean', 'high_pitch_std',
                         'high_pitch_max', 'high_pitch_range', 'high_pitch_energy',
                         'opera_head_voice_ratio']:
                features[name] = 0.0
        
        harmonic_power = self._compute_harmonic_power(y, sr)
        features['harmonic_power_ratio'] = harmonic_power
        
        features['vowel_clarity'] = self._estimate_vowel_clarity(y, sr)
        
        return features

    def _estimate_head_voice_ratio(self, f0_clean: np.ndarray) -> float:
        if len(f0_clean) < 10:
            return 0.0
        
        head_voice_threshold = 600
        head_voice_count = np.sum(f0_clean > head_voice_threshold)
        
        return float(head_voice_count / len(f0_clean))

    def _compute_harmonic_power(self, y: np.ndarray, sr: int) -> float:
        if len(y) < self.n_fft:
            return 0.0
        
        S = np.abs(librosa.stft(y, n_fft=self.n_fft, hop_length=self.hop_length))
        power_spectrum = np.mean(S ** 2, axis=1)
        
        freqs = librosa.fft_frequencies(sr=sr, n_fft=self.n_fft)
        
        f0_estimate = self._estimate_fundamental(y, sr)
        if f0_estimate is None or f0_estimate == 0:
            return 0.0
        
        harmonic_power = 0.0
        total_power = np.sum(power_spectrum)
        
        if total_power == 0:
            return 0.0
        
        for n in range(1, 11):
            harmonic_freq = n * f0_estimate
            if harmonic_freq < sr / 2:
                freq_idx = np.argmin(np.abs(freqs - harmonic_freq))
                window = 5
                start = max(0, freq_idx - window)
                end = min(len(power_spectrum), freq_idx + window + 1)
                harmonic_power += np.sum(power_spectrum[start:end])
        
        return float(harmonic_power / total_power)

    def _estimate_fundamental(self, y: np.ndarray, sr: int) -> Optional[float]:
        try:
            f0, _, _ = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
                hop_length=self.hop_length
            )
            f0_clean = f0[~np.isnan(f0)]
            if len(f0_clean) > 0:
                return float(np.median(f0_clean))
        except:
            pass
        return None

    def _estimate_vowel_clarity(self, y: np.ndarray, sr: int) -> float:
        S = np.abs(librosa.stft(y, n_fft=self.n_fft, hop_length=self.hop_length))
        
        spectral_flatness = librosa.feature.spectral_flatness(S=S)
        avg_flatness = np.mean(spectral_flatness)
        
        return float(1.0 - avg_flatness)

    def extract_formant_features(self, y: np.ndarray, sr: int) -> Dict[str, float]:
        features = {}
        
        try:
            lpc_order = int(2 + sr / 1000)
            a = librosa.lpc(y, order=lpc_order)
            
            roots = np.roots(a)
            roots = roots[np.imag(roots) >= 0]
            
            angz = np.arctan2(np.imag(roots), np.real(roots))
            freqs = angz * (sr / (2 * np.pi))
            
            bandwidths = -1/2 * (sr / (2 * np.pi)) * np.log(np.abs(roots))
            
            valid_mask = (freqs > 50) & (freqs < 5000) & (bandwidths < 400)
            valid_freqs = freqs[valid_mask]
            valid_bandwidths = bandwidths[valid_mask]
            
            sorted_indices = np.argsort(valid_freqs)
            sorted_freqs = valid_freqs[sorted_indices]
            sorted_bws = valid_bandwidths[sorted_indices]
            
            for i in range(4):
                if i < len(sorted_freqs):
                    features[f'formant_{i+1}_freq'] = float(sorted_freqs[i])
                    features[f'formant_{i+1}_bw'] = float(sorted_bws[i])
                else:
                    features[f'formant_{i+1}_freq'] = 0.0
                    features[f'formant_{i+1}_bw'] = 0.0
            
            if len(sorted_freqs) >= 2:
                features['formant_diff_2_1'] = sorted_freqs[1] - sorted_freqs[0]
                if len(sorted_freqs) >= 3:
                    features['formant_diff_3_2'] = sorted_freqs[2] - sorted_freqs[1]
                else:
                    features['formant_diff_3_2'] = 0.0
            else:
                features['formant_diff_2_1'] = 0.0
            
        except Exception as e:
            for i in range(4):
                features[f'formant_{i+1}_freq'] = 0.0
                features[f'formant_{i+1}_bw'] = 0.0
            features['formant_diff_2_1'] = 0.0
            features['formant_diff_3_2'] = 0.0
        
        return features

    def extract_harmonic_features(self, y: np.ndarray, sr: int) -> Dict[str, float]:
        features = {}
        
        hr = librosa.feature.spectral_flatness(y=y, hop_length=self.hop_length)
        features['harmonic_ratio_mean'] = float(np.mean(1 - hr))
        features['harmonic_ratio_std'] = float(np.std(1 - hr))
        
        try:
            y_harm, y_perc = librosa.effects.hpss(y)
            
            harmonic_energy = np.sum(y_harm ** 2)
            percussive_energy = np.sum(y_perc ** 2)
            total_energy = harmonic_energy + percussive_energy
            
            if total_energy > 0:
                features['harmonic_energy_ratio'] = float(harmonic_energy / total_energy)
                features['percussive_energy_ratio'] = float(percussive_energy / total_energy)
            else:
                features['harmonic_energy_ratio'] = 0.0
                features['percussive_energy_ratio'] = 0.0
            
            features['hpss_ratio'] = float(harmonic_energy / percussive_energy) if percussive_energy > 0 else 0.0
            
        except:
            features['harmonic_energy_ratio'] = 0.0
            features['percussive_energy_ratio'] = 0.0
            features['hpss_ratio'] = 0.0
        
        zero_crossings = librosa.feature.zero_crossing_rate(y, hop_length=self.hop_length)
        features['zero_crossing_mean'] = float(np.mean(zero_crossings))
        
        return features

    def _compute_pitch_stability(self, f0_clean: np.ndarray) -> float:
        if len(f0_clean) < 2:
            return 0.0
        
        f0_diff = np.diff(f0_clean)
        mae = np.mean(np.abs(f0_diff))
        
        return float(1.0 / (1.0 + mae / 10.0))

    def _detect_glides(self, f0: np.ndarray) -> Tuple[float, float]:
        valid_mask = ~np.isnan(f0)
        if np.sum(valid_mask) < 5:
            return 0.0, 0.0
        
        f0_interp = np.interp(np.arange(len(f0)), np.where(valid_mask)[0], f0[valid_mask])
        
        derivative = np.gradient(f0_interp)
        
        glide_threshold = 10
        
        glide_regions = []
        in_glide = False
        start_idx = 0
        
        for i in range(len(derivative)):
            if abs(derivative[i]) > glide_threshold:
                if not in_glide:
                    in_glide = True
                    start_idx = i
            else:
                if in_glide:
                    glide_regions.append((start_idx, i))
                    in_glide = False
        
        if in_glide:
            glide_regions.append((start_idx, len(derivative)))
        
        glide_count = len(glide_regions)
        
        glide_intensities = []
        for start, end in glide_regions:
            if end > start:
                intensity = np.mean(np.abs(derivative[start:end]))
                glide_intensities.append(intensity)
        
        avg_glide_intensity = np.mean(glide_intensities) if glide_intensities else 0.0
        
        return float(glide_count), float(avg_glide_intensity)

    def _estimate_vibrato_rate(self, cents: np.ndarray) -> float:
        if len(cents) < 2:
            return 0
        
        cent_diff = np.diff(cents)
        crossings = np.sum(np.abs(np.diff(np.sign(cent_diff))))
        duration = len(cents) * self.hop_length / self.sample_rate
        
        return crossings / (2 * duration) if duration > 0 else 0

    def extract_rhythm_features(self, y: np.ndarray, sr: int) -> Dict[str, Union[float, np.ndarray]]:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=self.hop_length)
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=sr,
            hop_length=self.hop_length
        )
        
        beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=self.hop_length)
        ibi = np.diff(beat_times)
        
        features = {
            'tempo': float(tempo) if np.isscalar(tempo) else float(np.mean(tempo)),
            'beat_std': float(np.std(ibi)) if len(ibi) > 0 else 0,
            'onset_rate': float(len(onset_env[onset_env > np.mean(onset_env)]) / 
                               (len(y) / sr)),
            'rhythm_complexity': self._compute_rhythm_complexity(onset_env),
            'beat_times': beat_times,
            'onset_envelope': onset_env
        }
        
        if len(ibi) > 0:
            features['ibi_mean'] = float(np.mean(ibi))
            features['ibi_std'] = float(np.std(ibi))
        
        return features

    def _compute_rhythm_complexity(self, onset_env: np.ndarray) -> float:
        peaks = signal.find_peaks(onset_env, distance=10)[0]
        if len(peaks) < 2:
            return 0
        
        intervals = np.diff(peaks)
        return float(np.std(intervals) / np.mean(intervals)) if np.mean(intervals) > 0 else 0

    def extract_timbre_features(self, y: np.ndarray, sr: int) -> Dict[str, Union[float, np.ndarray]]:
        mfcc = librosa.feature.mfcc(
            y=y, sr=sr, n_mfcc=20, hop_length=self.hop_length
        )
        
        spectral_centroid = librosa.feature.spectral_centroid(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]
        
        spectral_bandwidth = librosa.feature.spectral_bandwidth(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]
        
        spectral_rolloff = librosa.feature.spectral_rolloff(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]
        
        spectral_flux = librosa.onset.onset_strength(y=y, sr=sr, hop_length=self.hop_length)
        
        zero_crossing_rate = librosa.feature.zero_crossing_rate(
            y=y, hop_length=self.hop_length
        )[0]
        
        features = {}
        
        for i in range(1, 21):
            features[f'mfcc_{i}_mean'] = float(np.mean(mfcc[i-1]))
            features[f'mfcc_{i}_std'] = float(np.std(mfcc[i-1]))
        
        features.update({
            'spectral_centroid_mean': float(np.mean(spectral_centroid)),
            'spectral_centroid_std': float(np.std(spectral_centroid)),
            'spectral_bandwidth_mean': float(np.mean(spectral_bandwidth)),
            'spectral_bandwidth_std': float(np.std(spectral_bandwidth)),
            'spectral_rolloff_mean': float(np.mean(spectral_rolloff)),
            'spectral_rolloff_std': float(np.std(spectral_rolloff)),
            'spectral_flux_mean': float(np.mean(spectral_flux)),
            'spectral_flux_std': float(np.std(spectral_flux)),
            'zero_crossing_rate_mean': float(np.mean(zero_crossing_rate)),
            'zero_crossing_rate_std': float(np.std(zero_crossing_rate)),
            'mfcc_matrix': mfcc
        })
        
        return features

    def extract_energy_features(self, y: np.ndarray, sr: int) -> Dict[str, Union[float, np.ndarray]]:
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)[0]
        
        features = {
            'energy_mean': float(np.mean(rms)),
            'energy_std': float(np.std(rms)),
            'energy_max': float(np.max(rms)),
            'energy_min': float(np.min(rms)),
            'energy_range': float(np.max(rms) - np.min(rms)),
            'energy_curve': rms
        }
        
        return features

    def extract_features_batch(self, audio_data: Dict[str, Dict]) -> pd.DataFrame:
        feature_list = []
        
        for file_path, audio_info in audio_data.items():
            y = audio_info['audio']
            features = self.extract_all_features(y, audio_info['sample_rate'])
            
            scalar_features = {
                k: v for k, v in features.items() 
                if isinstance(v, (int, float, np.number))
            }
            
            scalar_features.update({
                'file_path': file_path,
                'file_name': audio_info['file_name'],
                'opera_type': audio_info['opera_type'],
                'inheritor': audio_info['inheritor'],
                'year': audio_info['year']
            })
            
            feature_list.append(scalar_features)
        
        return pd.DataFrame(feature_list)

    def normalize_features(self, df: pd.DataFrame) -> pd.DataFrame:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df_normalized = df.copy()
        df_normalized[numeric_cols] = (df[numeric_cols] - df[numeric_cols].mean()) / df[numeric_cols].std()
        return df_normalized

    def get_feature_matrix(self, df: pd.DataFrame, feature_subset: Optional[List[str]] = None) -> np.ndarray:
        if feature_subset:
            return df[feature_subset].values
        else:
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            return df[numeric_cols].values
