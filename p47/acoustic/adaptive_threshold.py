import numpy as np
import librosa
from scipy import stats
from collections import deque


class EnvironmentalNoiseAnalyzer:
    """环境噪声分析器 - 实时估计底噪并计算自适应阈值"""
    
    def __init__(self, history_size=50, sr=22050):
        self.sr = sr
        self.noise_history = deque(maxlen=history_size)
        self.noise_profile = {
            'rms_mean': 0,
            'rms_std': 0,
            'spectral_centroid_mean': 0,
            'spectral_bandwidth_mean': 0,
            'zero_crossing_rate_mean': 0
        }
        self.is_profile_ready = False
        self.update_count = 0
    
    def analyze_noise(self, audio_signal):
        """分析音频信号的噪声特征"""
        features = self._extract_features(audio_signal)
        
        self.noise_history.append(features)
        self.update_count += 1
        
        if len(self.noise_history) >= 10:
            self._update_noise_profile()
            self.is_profile_ready = True
        
        return features
    
    def _extract_features(self, signal):
        """提取音频特征用于噪声分析"""
        rms = librosa.feature.rms(y=signal)[0]
        spec_cent = librosa.feature.spectral_centroid(y=signal, sr=self.sr)[0]
        spec_bw = librosa.feature.spectral_bandwidth(y=signal, sr=self.sr)[0]
        zcr = librosa.feature.zero_crossing_rate(signal)[0]
        
        features = {
            'rms_mean': np.mean(rms),
            'rms_std': np.std(rms),
            'rms_max': np.max(rms),
            'spectral_centroid_mean': np.mean(spec_cent),
            'spectral_bandwidth_mean': np.mean(spec_bw),
            'zero_crossing_rate_mean': np.mean(zcr),
            'snr_estimate': self._estimate_snr(signal, rms)
        }
        
        return features
    
    def _estimate_snr(self, signal, rms):
        """估计信噪比"""
        signal_power = np.mean(signal ** 2)
        noise_floor = np.percentile(rms, 20) ** 2
        snr = 10 * np.log10(signal_power / (noise_floor + 1e-10) + 1e-10)
        return snr
    
    def _update_noise_profile(self):
        """更新噪声剖面"""
        features_list = list(self.noise_history)
        
        self.noise_profile['rms_mean'] = np.mean([f['rms_mean'] for f in features_list])
        self.noise_profile['rms_std'] = np.std([f['rms_mean'] for f in features_list])
        self.noise_profile['spectral_centroid_mean'] = np.mean([f['spectral_centroid_mean'] for f in features_list])
        self.noise_profile['spectral_bandwidth_mean'] = np.mean([f['spectral_bandwidth_mean'] for f in features_list])
        self.noise_profile['zero_crossing_rate_mean'] = np.mean([f['zero_crossing_rate_mean'] for f in features_list])
    
    def get_adaptive_threshold(self, sensitivity=0.5):
        """
        计算自适应检测阈值
        
        Args:
            sensitivity: 敏感度 (0-1), 1表示最敏感，0表示最不敏感
        
        Returns:
            threshold: 检测阈值字典
        """
        if not self.is_profile_ready:
            return {
                'rms_threshold': 0.01,
                'snr_threshold': 3.0,
                'confidence_multiplier': 1.0
            }
        
        base_rms = self.noise_profile['rms_mean']
        std_rms = self.noise_profile['rms_std']
        
        k = 2.0 + (1 - sensitivity) * 3.0
        rms_threshold = base_rms + k * std_rms
        
        snr_threshold = 3.0 + (1 - sensitivity) * 5.0
        
        noise_level = base_rms / (base_rms + 0.001)
        confidence_multiplier = 1.0 + noise_level * 0.5
        
        return {
            'rms_threshold': float(rms_threshold),
            'snr_threshold': float(snr_threshold),
            'confidence_multiplier': float(confidence_multiplier),
            'noise_level': float(base_rms),
            'noise_std': float(std_rms)
        }
    
    def should_ignore_signal(self, signal_features, threshold=None):
        """判断是否应该忽略该信号（噪声或干扰）"""
        if threshold is None:
            threshold = self.get_adaptive_threshold()
        
        if signal_features['rms_mean'] < threshold['rms_threshold'] * 0.3:
            return True, "Signal too weak"
        
        if signal_features.get('snr_estimate', 0) < threshold['snr_threshold'] * 0.5:
            return True, "SNR too low"
        
        return False, "OK"


class NoiseTypeClassifier:
    """特定噪声类型分类器 - 识别风噪声、农机声等干扰"""
    
    NOISE_PROFILES = {
        'wind': {
            'name': '风噪声',
            'spectral_centroid_range': (0, 1000),
            'spectral_bandwidth_range': (0, 800),
            'zero_crossing_range': (0, 0.05),
            'rms_fluctuation': 0.3
        },
        'machinery': {
            'name': '农机声',
            'spectral_centroid_range': (100, 800),
            'spectral_bandwidth_range': (200, 1000),
            'zero_crossing_range': (0.01, 0.08),
            'periodic_score': 0.7
        },
        'traffic': {
            'name': '交通噪声',
            'spectral_centroid_range': (500, 2000),
            'spectral_bandwidth_range': (800, 2500),
            'zero_crossing_range': (0.05, 0.15)
        }
    }
    
    def __init__(self, sr=22050):
        self.sr = sr
    
    def classify_noise(self, signal):
        """判断信号是否为噪声类型"""
        results = {}
        
        features = self._extract_noise_features(signal)
        
        for noise_type, profile in self.NOISE_PROFILES.items():
            score = self._calculate_match_score(features, profile)
            results[noise_type] = {
                'name': profile['name'],
                'score': float(score),
                'is_noise': score > 0.6
            }
        
        dominant_noise = max(results.items(), key=lambda x: x[1]['score'])
        is_interference = dominant_noise[1]['score'] > 0.6
        
        return {
            'is_interference': is_interference,
            'dominant_noise': dominant_noise[0] if is_interference else None,
            'dominant_noise_name': dominant_noise[1]['name'] if is_interference else None,
            'confidence': float(dominant_noise[1]['score']) if is_interference else 0.0,
            'all_scores': results
        }
    
    def _extract_noise_features(self, signal):
        """提取噪声分类特征"""
        rms = librosa.feature.rms(y=signal)[0]
        spec_cent = librosa.feature.spectral_centroid(y=signal, sr=self.sr)[0]
        spec_bw = librosa.feature.spectral_bandwidth(y=signal, sr=self.sr)[0]
        zcr = librosa.feature.zero_crossing_rate(signal)[0]
        
        autocorr = np.correlate(rms - np.mean(rms), rms - np.mean(rms), mode='full')
        autocorr = autocorr[len(autocorr)//2:]
        peaks = self._count_peaks(autocorr)
        periodic_score = min(1.0, peaks / 10.0) if len(autocorr) > 0 else 0
        
        rms_fluctuation = np.std(rms) / (np.mean(rms) + 1e-10)
        
        return {
            'rms_mean': np.mean(rms),
            'spectral_centroid_mean': np.mean(spec_cent),
            'spectral_bandwidth_mean': np.mean(spec_bw),
            'zero_crossing_rate_mean': np.mean(zcr),
            'periodic_score': periodic_score,
            'rms_fluctuation': rms_fluctuation
        }
    
    def _count_peaks(self, signal, threshold=0.1):
        """计算信号中的峰值数量"""
        peaks = 0
        for i in range(1, len(signal) - 1):
            if signal[i] > threshold and signal[i] > signal[i-1] and signal[i] > signal[i+1]:
                peaks += 1
        return peaks
    
    def _calculate_match_score(self, features, profile):
        """计算与噪声剖面的匹配分数"""
        scores = []
        
        cent = features['spectral_centroid_mean']
        cent_min, cent_max = profile['spectral_centroid_range']
        if cent_min <= cent <= cent_max:
            scores.append(1.0)
        else:
            distance = min(abs(cent - cent_min), abs(cent - cent_max))
            scores.append(max(0, 1 - distance / cent_max))
        
        bw = features['spectral_bandwidth_mean']
        bw_min, bw_max = profile['spectral_bandwidth_range']
        if bw_min <= bw <= bw_max:
            scores.append(1.0)
        else:
            distance = min(abs(bw - bw_min), abs(bw - bw_max))
            scores.append(max(0, 1 - distance / bw_max))
        
        zcr = features['zero_crossing_rate_mean']
        zcr_min, zcr_max = profile['zero_crossing_range']
        if zcr_min <= zcr <= zcr_max:
            scores.append(1.0)
        else:
            distance = min(abs(zcr - zcr_min), abs(zcr - zcr_max))
            scores.append(max(0, 1 - distance / zcr_max if zcr_max > 0 else 0))
        
        if 'rms_fluctuation' in profile:
            fluct = features.get('rms_fluctuation', 0)
            scores.append(1.0 - abs(fluct - profile['rms_fluctuation']))
        
        if 'periodic_score' in profile:
            periodic = features.get('periodic_score', 0)
            scores.append(1.0 - abs(periodic - profile['periodic_score']))
        
        return np.mean(scores)


class AdaptivePestDetector:
    """集成自适应阈值的害虫检测器"""
    
    def __init__(self, base_classifier=None, sr=22050):
        self.noise_analyzer = EnvironmentalNoiseAnalyzer(sr=sr)
        self.noise_classifier = NoiseTypeClassifier(sr=sr)
        self.base_classifier = base_classifier
        self.sr = sr
        self.calibration_samples = []
    
    def calibrate(self, calibration_audio):
        """使用环境噪声进行校准"""
        features = self.noise_analyzer.analyze_noise(calibration_audio)
        self.calibration_samples.append(features)
        return features
    
    def batch_calibrate(self, audio_list):
        """批量校准"""
        for audio in audio_list:
            self.calibrate(audio)
        return self.noise_analyzer.noise_profile
    
    def detect_with_adaptive_threshold(self, audio_signal, sensitivity=0.5):
        """
        使用自适应阈值进行害虫检测
        
        Returns:
            检测结果字典
        """
        signal_features = self.noise_analyzer._extract_features(audio_signal)
        
        threshold = self.noise_analyzer.get_adaptive_threshold(sensitivity)
        
        should_ignore, ignore_reason = self.noise_analyzer.should_ignore_signal(
            signal_features, threshold
        )
        
        if should_ignore:
            return {
                'detected': False,
                'pest_type': 'none',
                'confidence': 0.0,
                'reason': ignore_reason,
                'signal_features': signal_features,
                'threshold_used': threshold,
                'is_noise': True
            }
        
        noise_result = self.noise_classifier.classify_noise(audio_signal)
        
        if noise_result['is_interference']:
            return {
                'detected': False,
                'pest_type': 'none',
                'confidence': 0.0,
                'reason': f"Interference detected: {noise_result['dominant_noise_name']}",
                'noise_classification': noise_result,
                'signal_features': signal_features,
                'threshold_used': threshold,
                'is_noise': True
            }
        
        from acoustic.pest_classifier import SimplePestDetector
        
        result = SimplePestDetector.detect_from_array(audio_signal, self.sr)
        
        adjusted_confidence = result['confidence'] * threshold['confidence_multiplier']
        adjusted_confidence = min(1.0, adjusted_confidence)
        
        pest_threshold = 0.5 * threshold['confidence_multiplier']
        
        if adjusted_confidence >= pest_threshold:
            return {
                'detected': True,
                'pest_type': result['pest_type'],
                'confidence': adjusted_confidence,
                'original_confidence': result['confidence'],
                'reason': 'Pest detected',
                'signal_features': signal_features,
                'threshold_used': threshold,
                'is_noise': False
            }
        else:
            return {
                'detected': False,
                'pest_type': 'none',
                'confidence': adjusted_confidence,
                'original_confidence': result['confidence'],
                'reason': 'Below confidence threshold',
                'signal_features': signal_features,
                'threshold_used': threshold,
                'is_noise': noise_result['is_interference']
            }
    
    def get_current_noise_profile(self):
        """获取当前噪声剖面"""
        return {
            'profile': self.noise_analyzer.noise_profile,
            'is_ready': self.noise_analyzer.is_profile_ready,
            'sample_count': self.noise_analyzer.update_count
        }
