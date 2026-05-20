import librosa
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from scipy.stats import skew, kurtosis, mode
from scipy.signal import medfilt
import warnings
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
import pickle
import os


class OperaStyleDefinitions:
    PITCH_RANGES = {
        'high_soprano': {'min': 523, 'max': 1046, 'label': '高音唱腔'},
        'soprano': {'min': 392, 'max': 784, 'label': '女高唱腔'},
        'mezzo': {'min': 294, 'max': 587, 'label': '女中唱腔'},
        'tenor': {'min': 247, 'max': 494, 'label': '男高唱腔'},
        'baritone': {'min': 196, 'max': 392, 'label': '男中唱腔'},
        'bass': {'min': 131, 'max': 262, 'label': '男低唱腔'},
    }

    RHYTHM_STYLES = {
        'slow_aria': {'tempo_min': 40, 'tempo_max': 80, 'label': '慢板抒情'},
        'moderate_aria': {'tempo_min': 80, 'tempo_max': 120, 'label': '中板叙事'},
        'fast_aria': {'tempo_min': 120, 'tempo_max': 180, 'label': '快板表演'},
        'dramatic': {'tempo_min': 180, 'tempo_max': 250, 'label': '戏剧性唱腔'},
    }

    TIMBRE_FEATURES = {
        'bright': {'centroid_min': 2000, 'label': '明亮音色'},
        'warm': {'centroid_min': 1000, 'centroid_max': 2000, 'label': '温暖音色'},
        'dark': {'centroid_max': 1000, 'label': '浑厚音色'},
    }

    VIBRATO_TYPES = {
        'wide_vibrato': {'depth_min': 50, 'rate_min': 4, 'label': '宽幅颤音'},
        'narrow_vibrato': {'depth_min': 10, 'depth_max': 50, 'rate_min': 5, 'label': '细腻颤音'},
        'no_vibrato': {'depth_max': 10, 'label': '直声演唱'},
    }

    OPERA_GENRES = {
        'Beijing_Opera': {
            'name': '京剧',
            'typical_pitch_mean': (300, 600),
            'typical_tempo': (80, 140),
            'description': '皮黄唱腔，讲究字正腔圆'
        },
        'Yue_Opera': {
            'name': '越剧',
            'typical_pitch_mean': (400, 700),
            'typical_tempo': (60, 100),
            'description': '柔美婉转，长于抒情'
        },
        'Yu_Opera': {
            'name': '豫剧',
            'typical_pitch_mean': (250, 550),
            'typical_tempo': (90, 150),
            'description': '高亢激越，大气磅礴'
        },
        'Ping_Opera': {
            'name': '评剧',
            'typical_pitch_mean': (200, 500),
            'typical_tempo': (70, 120),
            'description': '活泼自由，贴近生活'
        },
        'Huangmei_Opera': {
            'name': '黄梅戏',
            'typical_pitch_mean': (300, 550),
            'typical_tempo': (70, 110),
            'description': '质朴细腻，民歌风味'
        },
        'Kun_Opera': {
            'name': '昆曲',
            'typical_pitch_mean': (350, 650),
            'typical_tempo': (50, 90),
            'description': '典雅精致，曲牌体'
        },
        'Qin_Opera': {
            'name': '秦腔',
            'typical_pitch_mean': (200, 500),
            'typical_tempo': (100, 160),
            'description': '粗犷豪放，激越悲壮'
        },
        'Sichuan_Opera': {
            'name': '川剧',
            'typical_pitch_mean': (250, 600),
            'typical_tempo': (80, 140),
            'description': '幽默风趣，高腔特色'
        },
    }


class FeatureExtractor:
    HIGH_PITCH_FMIN = 65.41
    HIGH_PITCH_FMAX = 2093.0

    def __init__(self, sample_rate: int = 22050, n_mfcc: int = 13,
                 use_high_pitch_correction: bool = True,
                 use_multiple_pitch_methods: bool = True,
                 enable_annotation: bool = True):
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        self.use_high_pitch_correction = use_high_pitch_correction
        self.use_multiple_pitch_methods = use_multiple_pitch_methods
        self.enable_annotation = enable_annotation
        self.scaler = StandardScaler()
        self._genre_classifier = None
        self._genre_model_trained = False

    def extract_all_features(self, y: np.ndarray, sr: Optional[int] = None) -> Dict:
        if sr is None:
            sr = self.sample_rate

        if len(y) == 0:
            return self._get_empty_features()

        features = {}
        features.update(self.extract_pitch_features(y, sr))
        features.update(self.extract_rhythm_features(y, sr))
        features.update(self.extract_timbre_features(y, sr))
        features.update(self.extract_spectral_features(y, sr))
        features.update(self.extract_opera_specific_features(y, sr))

        if self.enable_annotation:
            annotations = self.annotate_features(features)
            features['annotations'] = annotations

        return features

    def _get_empty_features(self) -> Dict:
        empty = {}
        for key in ['pitch_mean', 'pitch_std', 'pitch_min', 'pitch_max',
                    'pitch_median', 'pitch_skew', 'pitch_kurtosis',
                    'pitch_range', 'high_pitch_ratio', 'tempo',
                    'vibrato_rate', 'vibrato_depth', 'brightness']:
            empty[key] = 0.0
        empty['annotations'] = {}
        return empty

    def _apply_pitch_outlier_filter(self, pitches: np.ndarray, threshold: float = 2.0) -> np.ndarray:
        if len(pitches) < 3:
            return pitches

        pitches_log = np.log(pitches[pitches > 0])
        if len(pitches_log) < 3:
            return pitches

        median = np.median(pitches_log)
        mad = np.median(np.abs(pitches_log - median))
        if mad == 0:
            mad = 0.1

        mask = np.abs(pitches_log - median) < threshold * (mad * 1.4826)
        filtered = pitches[pitches > 0].copy()
        filtered[~mask] = np.nan

        return filtered[~np.isnan(filtered)]

    def _smooth_pitch_track(self, pitches: np.ndarray, kernel_size: int = 5) -> np.ndarray:
        if len(pitches) < kernel_size:
            return pitches

        pitches_smooth = medfilt(pitches, kernel_size)
        return pitches_smooth

    def _extract_pitch_piptrack(self, y: np.ndarray, sr: int, fmin: float, fmax: float) -> np.ndarray:
        pitches, magnitudes = librosa.piptrack(
            y=y, sr=sr, fmin=fmin, fmax=fmax, threshold=0.1
        )

        pitch_values = []
        for t in range(pitches.shape[1]):
            valid_pitches = pitches[:, t][magnitudes[:, t] > 0.1 * np.max(magnitudes[:, t])]
            if len(valid_pitches) > 0:
                pitch_values.append(np.mean(valid_pitches))

        return np.array(pitch_values)

    def _extract_pitch_pyin(self, y: np.ndarray, sr: int, fmin: float, fmax: float) -> np.ndarray:
        try:
            f0, _, _ = librosa.pyin(
                y, fmin=fmin, fmax=fmax, sr=sr, fill_na=np.nan
            )
            return f0[~np.isnan(f0)]
        except Exception as e:
            warnings.warn(f"pyin pitch extraction failed: {e}")
            return np.array([])

    def extract_pitch_features(self, y: np.ndarray, sr: int) -> Dict:
        fmin = self.HIGH_PITCH_FMIN
        fmax = self.HIGH_PITCH_FMAX

        pitch_sources = []

        piptrack_pitches = self._extract_pitch_piptrack(y, sr, fmin, fmax)
        if len(piptrack_pitches) > 0:
            pitch_sources.append(piptrack_pitches)

        if self.use_multiple_pitch_methods:
            pyin_pitches = self._extract_pitch_pyin(y, sr, fmin, fmax)
            if len(pyin_pitches) > 0:
                pitch_sources.append(pyin_pitches)

            try:
                yin_pitches = librosa.yin(y, fmin=fmin, fmax=fmax, sr=sr)
                yin_pitches = yin_pitches[yin_pitches > 0]
                if len(yin_pitches) > 0:
                    pitch_sources.append(yin_pitches)
            except Exception as e:
                warnings.warn(f"yin pitch extraction failed: {e}")

        if len(pitch_sources) == 0:
            return {
                'pitch_mean': 0.0, 'pitch_std': 0.0, 'pitch_min': 0.0,
                'pitch_max': 0.0, 'pitch_median': 0.0,
                'pitch_skew': 0.0, 'pitch_kurtosis': 0.0,
                'pitch_range': 0.0, 'high_pitch_ratio': 0.0
            }

        all_pitches = np.concatenate(pitch_sources)
        all_pitches = all_pitches[all_pitches > 0]

        if len(all_pitches) == 0:
            return {
                'pitch_mean': 0.0, 'pitch_std': 0.0, 'pitch_min': 0.0,
                'pitch_max': 0.0, 'pitch_median': 0.0,
                'pitch_skew': 0.0, 'pitch_kurtosis': 0.0,
                'pitch_range': 0.0, 'high_pitch_ratio': 0.0
            }

        if self.use_high_pitch_correction:
            all_pitches = self._apply_pitch_outlier_filter(all_pitches)
            if len(all_pitches) == 0:
                all_pitches = np.concatenate(pitch_sources)
                all_pitches = all_pitches[all_pitches > 0]

            all_pitches = self._smooth_pitch_track(all_pitches)

        pitch_mean = float(np.mean(all_pitches))
        pitch_std = float(np.std(all_pitches))
        pitch_min = float(np.min(all_pitches))
        pitch_max = float(np.max(all_pitches))
        pitch_median = float(np.median(all_pitches))

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pitch_skew = float(skew(all_pitches)) if len(all_pitches) > 1 else 0.0
            pitch_kurtosis = float(kurtosis(all_pitches)) if len(all_pitches) > 1 else 0.0

        high_pitch_ratio = float(np.sum(all_pitches > 523) / len(all_pitches))

        return {
            'pitch_mean': pitch_mean,
            'pitch_std': pitch_std,
            'pitch_min': pitch_min,
            'pitch_max': pitch_max,
            'pitch_median': pitch_median,
            'pitch_skew': pitch_skew,
            'pitch_kurtosis': pitch_kurtosis,
            'pitch_range': pitch_max - pitch_min,
            'high_pitch_ratio': high_pitch_ratio
        }

    def extract_opera_specific_features(self, y: np.ndarray, sr: int) -> Dict:
        features = {}

        try:
            f0, _, _ = librosa.pyin(
                y, fmin=self.HIGH_PITCH_FMIN, fmax=self.HIGH_PITCH_FMAX, sr=sr
            )
            f0_valid = f0[~np.isnan(f0)]

            if len(f0_valid) > 10:
                f0_norm = f0_valid - np.mean(f0_valid)
                autocorr = np.correlate(f0_norm, f0_norm, mode='full')
                autocorr = autocorr[len(autocorr)//2:]

                peaks = librosa.util.peak_pick(autocorr, 3, 3, 3, 5, 0.5, 10)
                if len(peaks) > 0:
                    lag = peaks[0]
                    vibrato_rate = sr / (lag * 512) if lag > 0 else 0
                    vibrato_depth = np.std(f0_valid) if len(f0_valid) > 1 else 0
                    features['vibrato_rate'] = float(vibrato_rate)
                    features['vibrato_depth'] = float(vibrato_depth)
                    features['vibrato_extent'] = float(np.max(f0_valid) - np.min(f0_valid))
                else:
                    features['vibrato_rate'] = 0.0
                    features['vibrato_depth'] = 0.0
                    features['vibrato_extent'] = 0.0
            else:
                features['vibrato_rate'] = 0.0
                features['vibrato_depth'] = 0.0
                features['vibrato_extent'] = 0.0
        except Exception as e:
            warnings.warn(f"Vibrato extraction failed: {e}")
            features['vibrato_rate'] = 0.0
            features['vibrato_depth'] = 0.0
            features['vibrato_extent'] = 0.0

        try:
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.95)[0]

            features['brightness'] = float(np.mean(spectral_centroid))
            features['high_freq_energy'] = float(np.mean(spectral_rolloff > 2000))
        except Exception as e:
            warnings.warn(f"Spectral features extraction failed: {e}")
            features['brightness'] = 0.0
            features['high_freq_energy'] = 0.0

        try:
            harmonic, percussive = librosa.effects.hpss(y)
            total_energy = np.sum(y ** 2) + 1e-10
            features['harmonic_ratio'] = float(np.sum(harmonic ** 2) / total_energy)
            features['percussive_ratio'] = float(np.sum(percussive ** 2) / total_energy)
        except Exception as e:
            warnings.warn(f"HPSS extraction failed: {e}")
            features['harmonic_ratio'] = 0.0
            features['percussive_ratio'] = 0.0

        return features

    def annotate_features(self, features: Dict) -> Dict[str, str]:
        annotations = {}

        pitch_mean = features.get('pitch_mean', 0)
        for vocal_type, range_info in OperaStyleDefinitions.PITCH_RANGES.items():
            if range_info['min'] <= pitch_mean <= range_info['max']:
                annotations['vocal_range'] = range_info['label']
                break
        else:
            annotations['vocal_range'] = '混合唱腔'

        tempo = features.get('tempo', 0)
        for rhythm_type, range_info in OperaStyleDefinitions.RHYTHM_STYLES.items():
            if range_info['tempo_min'] <= tempo <= range_info['tempo_max']:
                annotations['rhythm_style'] = range_info['label']
                break
        else:
            annotations['rhythm_style'] = '自由节奏'

        brightness = features.get('brightness', 0)
        for timbre_type, range_info in OperaStyleDefinitions.TIMBRE_FEATURES.items():
            cmin = range_info.get('centroid_min', 0)
            cmax = range_info.get('centroid_max', float('inf'))
            if cmin <= brightness <= cmax:
                annotations['timbre_type'] = range_info['label']
                break
        else:
            annotations['timbre_type'] = '综合音色'

        vibrato_rate = features.get('vibrato_rate', 0)
        vibrato_depth = features.get('vibrato_depth', 0)
        for vibrato_type, range_info in OperaStyleDefinitions.VIBRATO_TYPES.items():
            dmin = range_info.get('depth_min', 0)
            dmax = range_info.get('depth_max', float('inf'))
            rmin = range_info.get('rate_min', 0)
            if dmin <= vibrato_depth <= dmax and vibrato_rate >= rmin:
                annotations['vibrato_type'] = range_info['label']
                break
        else:
            annotations['vibrato_type'] = '未检测到颤音'

        high_pitch_ratio = features.get('high_pitch_ratio', 0)
        if high_pitch_ratio > 0.5:
            annotations['pitch_characteristic'] = '高音丰富'
        elif high_pitch_ratio > 0.2:
            annotations['pitch_characteristic'] = '音域适中'
        else:
            annotations['pitch_characteristic'] = '中低音为主'

        return annotations

    def predict_genre(self, features: Dict) -> Dict[str, any]:
        predictions = []

        pitch_mean = features.get('pitch_mean', 0)
        tempo = features.get('tempo', 0)

        for genre_id, genre_info in OperaStyleDefinitions.OPERA_GENRES.items():
            pitch_range = genre_info['typical_pitch_mean']
            tempo_range = genre_info['typical_tempo']

            pitch_score = max(0, 1 - abs(pitch_mean - np.mean(pitch_range)) / (pitch_range[1] - pitch_range[0]))
            tempo_score = max(0, 1 - abs(tempo - np.mean(tempo_range)) / (tempo_range[1] - tempo_range[0]))

            overall_score = (pitch_score + tempo_score) / 2

            predictions.append({
                'genre_id': genre_id,
                'genre_name': genre_info['name'],
                'description': genre_info['description'],
                'confidence': float(overall_score),
                'pitch_match': float(pitch_score),
                'tempo_match': float(tempo_score)
            })

        predictions.sort(key=lambda x: x['confidence'], reverse=True)
        top_prediction = predictions[0]

        return {
            'predicted_genre': top_prediction['genre_name'],
            'predicted_genre_id': top_prediction['genre_id'],
            'confidence': top_prediction['confidence'],
            'description': top_prediction['description'],
            'all_predictions': predictions[:5]
        }

    def train_genre_classifier(self, features_df: pd.DataFrame, labels: pd.Series):
        numeric_features = features_df.select_dtypes(include=[np.number])
        X = self.scaler.fit_transform(numeric_features)

        self._genre_classifier = RandomForestClassifier(
            n_estimators=100, max_depth=15, random_state=42
        )
        self._genre_classifier.fit(X, labels)
        self._genre_model_trained = True

        return {
            'feature_importance': dict(zip(numeric_features.columns,
                                            self._genre_classifier.feature_importances_)),
            'classes': self._genre_classifier.classes_.tolist()
        }

    def classify_genre_ml(self, features: Dict) -> Dict[str, any]:
        if not self._genre_model_trained:
            return self.predict_genre(features)

        feature_names = self.scaler.feature_names_in_
        feature_vector = [features.get(f, 0) for f in feature_names]
        X = self.scaler.transform([feature_vector])

        prediction = self._genre_classifier.predict(X)[0]
        probabilities = self._genre_classifier.predict_proba(X)[0]

        return {
            'predicted_genre': prediction,
            'confidence': float(np.max(probabilities)),
            'probabilities': dict(zip(self._genre_classifier.classes_, probabilities))
        }

    def extract_rhythm_features(self, y: np.ndarray, sr: int) -> Dict:
        try:
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            beat_times = librosa.frames_to_time(beats, sr=sr)

            if len(beat_times) > 1:
                inter_beat_intervals = np.diff(beat_times)
                ibi_mean = np.mean(inter_beat_intervals)
                ibi_std = np.std(inter_beat_intervals)
            else:
                ibi_mean, ibi_std = 0.0, 0.0

            zero_crossings = librosa.zero_crossings(y, pad=False)
            zcr = np.sum(zero_crossings) / len(y)

            rms = librosa.feature.rms(y=y)[0]

            return {
                'tempo': float(tempo),
                'num_beats': int(len(beats)),
                'ibi_mean': float(ibi_mean),
                'ibi_std': float(ibi_std),
                'beat_density': float(len(beats) / (len(y) / sr)),
                'zcr_mean': float(zcr),
                'rms_mean': float(np.mean(rms)) if len(rms) > 0 else 0.0,
                'rms_std': float(np.std(rms)) if len(rms) > 0 else 0.0,
                'rms_max': float(np.max(rms)) if len(rms) > 0 else 0.0
            }
        except Exception as e:
            warnings.warn(f"Rhythm features extraction failed: {e}")
            return {
                'tempo': 0.0, 'num_beats': 0, 'ibi_mean': 0.0, 'ibi_std': 0.0,
                'beat_density': 0.0, 'zcr_mean': 0.0, 'rms_mean': 0.0,
                'rms_std': 0.0, 'rms_max': 0.0
            }

    def extract_timbre_features(self, y: np.ndarray, sr: int) -> Dict:
        features = {}

        try:
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=self.n_mfcc, n_fft=2048)
            mfcc_delta = librosa.feature.delta(mfcc)
            mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

            for i in range(self.n_mfcc):
                features[f'mfcc_{i+1}_mean'] = float(np.mean(mfcc[i]))
                features[f'mfcc_{i+1}_std'] = float(np.std(mfcc[i]))
                features[f'mfcc_delta_{i+1}_mean'] = float(np.mean(mfcc_delta[i]))
                features[f'mfcc_delta2_{i+1}_mean'] = float(np.mean(mfcc_delta2[i]))
        except Exception as e:
            warnings.warn(f"MFCC extraction failed: {e}")
            for i in range(self.n_mfcc):
                features[f'mfcc_{i+1}_mean'] = 0.0
                features[f'mfcc_{i+1}_std'] = 0.0
                features[f'mfcc_delta_{i+1}_mean'] = 0.0
                features[f'mfcc_delta2_{i+1}_mean'] = 0.0

        try:
            chroma = librosa.feature.chroma_stft(y=y, sr=sr, n_fft=2048)
            for i in range(12):
                features[f'chroma_{i+1}_mean'] = float(np.mean(chroma[i]))
                features[f'chroma_{i+1}_std'] = float(np.std(chroma[i]))
        except Exception as e:
            warnings.warn(f"Chroma extraction failed: {e}")
            for i in range(12):
                features[f'chroma_{i+1}_mean'] = 0.0
                features[f'chroma_{i+1}_std'] = 0.0

        return features

    def extract_spectral_features(self, y: np.ndarray, sr: int) -> Dict:
        try:
            spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spec_bw = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
            spec_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            spec_flatness = librosa.feature.spectral_flatness(y=y)[0]
            spec_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)

            return {
                'spectral_centroid_mean': float(np.mean(spec_cent)) if len(spec_cent) > 0 else 0.0,
                'spectral_centroid_std': float(np.std(spec_cent)) if len(spec_cent) > 0 else 0.0,
                'spectral_bandwidth_mean': float(np.mean(spec_bw)) if len(spec_bw) > 0 else 0.0,
                'spectral_bandwidth_std': float(np.std(spec_bw)) if len(spec_bw) > 0 else 0.0,
                'spectral_rolloff_mean': float(np.mean(spec_rolloff)) if len(spec_rolloff) > 0 else 0.0,
                'spectral_rolloff_std': float(np.std(spec_rolloff)) if len(spec_rolloff) > 0 else 0.0,
                'spectral_flatness_mean': float(np.mean(spec_flatness)) if len(spec_flatness) > 0 else 0.0,
                'spectral_flatness_std': float(np.std(spec_flatness)) if len(spec_flatness) > 0 else 0.0,
                'spectral_contrast_mean': float(np.mean(spec_contrast)) if spec_contrast.size > 0 else 0.0,
                'spectral_contrast_std': float(np.std(spec_contrast)) if spec_contrast.size > 0 else 0.0
            }
        except Exception as e:
            warnings.warn(f"Spectral features extraction failed: {e}")
            return {
                'spectral_centroid_mean': 0.0, 'spectral_centroid_std': 0.0,
                'spectral_bandwidth_mean': 0.0, 'spectral_bandwidth_std': 0.0,
                'spectral_rolloff_mean': 0.0, 'spectral_rolloff_std': 0.0,
                'spectral_flatness_mean': 0.0, 'spectral_flatness_std': 0.0,
                'spectral_contrast_mean': 0.0, 'spectral_contrast_std': 0.0
            }

    def extract_feature_sequence(self, y: np.ndarray, sr: int, hop_length: int = 512) -> pd.DataFrame:
        if len(y) == 0:
            return pd.DataFrame()

        try:
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=self.n_mfcc, hop_length=hop_length)
            pitch_track, _ = librosa.piptrack(y=y, sr=sr, hop_length=hop_length,
                                                fmin=self.HIGH_PITCH_FMIN, fmax=self.HIGH_PITCH_FMAX)
            rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

            n_frames = mfcc.shape[1]
            times = librosa.times_like(mfcc, sr=sr, hop_length=hop_length)

            data = {'time': times}
            for i in range(self.n_mfcc):
                data[f'mfcc_{i+1}'] = mfcc[i]

            pitch_values = []
            for t in range(n_frames):
                index = pitch_track[:, t].argmax()
                pitch_values.append(pitch_track[index, t])
            data['pitch'] = pitch_values
            data['rms'] = rms

            return pd.DataFrame(data)
        except Exception as e:
            warnings.warn(f"Feature sequence extraction failed: {e}")
            return pd.DataFrame()

    def batch_extract(self, audio_files: List[str], use_chunks: bool = False,
                     chunk_duration: float = 30.0, use_cache: bool = True) -> pd.DataFrame:
        from .audio_loader import AudioLoader

        audio_loader = AudioLoader(sample_rate=self.sample_rate, enable_cache=use_cache)
        all_features = []

        for file_path in audio_files:
            try:
                if use_chunks:
                    features = audio_loader.extract_features_in_chunks(
                        file_path, self, chunk_duration=chunk_duration
                    )
                else:
                    y, sr = audio_loader.load_audio(file_path)
                    features = self.extract_all_features(y, sr)

                features['file_path'] = file_path
                features['filename'] = os.path.basename(file_path)
                all_features.append(features)
            except Exception as e:
                print(f"特征提取失败 {file_path}: {e}")

        return pd.DataFrame(all_features) if all_features else pd.DataFrame()

    def normalize_features(self, df: pd.DataFrame) -> pd.DataFrame:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df_normalized = df.copy()

        for col in numeric_cols:
            mean_val = df[col].mean()
            std_val = df[col].std()
            if std_val > 0:
                df_normalized[col] = (df[col] - mean_val) / std_val
            else:
                df_normalized[col] = 0

        return df_normalized

    def get_feature_importance(self, features_df: pd.DataFrame, labels: pd.Series) -> Dict[str, float]:
        from sklearn.ensemble import RandomForestClassifier

        numeric_features = features_df.select_dtypes(include=[np.number])
        X = self.scaler.fit_transform(numeric_features)

        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X, labels)

        importance = dict(zip(numeric_features.columns, clf.feature_importances_))
        return dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    def save_model(self, model_path: str):
        model_data = {
            'scaler': self.scaler,
            'classifier': self._genre_classifier,
            'trained': self._genre_model_trained
        }
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        with open(model_path, 'wb') as f:
            pickle.dump(model_data, f)

    def load_model(self, model_path: str):
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)
        self.scaler = model_data['scaler']
        self._genre_classifier = model_data['classifier']
        self._genre_model_trained = model_data['trained']
