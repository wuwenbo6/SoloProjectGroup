import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Tuple
import joblib
import os
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from scipy import signal
from scipy.fft import fft

from config import Config
from database import db_manager

logger = logging.getLogger(__name__)

FAULT_TYPES = {
    0: 'normal',
    1: 'bearing_wear',
    2: 'misalignment',
    3: 'imbalance',
    4: 'looseness'
}

FAULT_NAMES = {
    'normal': '正常运行',
    'bearing_wear': '轴承磨损',
    'misalignment': '不对中',
    'imbalance': '不平衡',
    'looseness': '松动'
}

FAULT_DESCRIPTIONS = {
    'normal': '设备运行正常，无明显故障特征。',
    'bearing_wear': '检测到轴承磨损特征，建议检查并更换轴承。',
    'misalignment': '检测到不对中特征，建议进行轴对中校准。',
    'imbalance': '检测到不平衡特征，建议进行动平衡校正。',
    'looseness': '检测到松动特征，建议检查紧固件和连接部件。'
}

FAULT_SEVERITY = {
    'normal': '正常',
    'bearing_wear': '中等',
    'misalignment': '高',
    'imbalance': '中等',
    'looseness': '高'
}

RECOMMENDATIONS = {
    'normal': ['继续监控设备状态', '定期维护保养'],
    'bearing_wear': ['安排专业人员检查轴承', '准备轴承备件', '制定更换计划'],
    'misalignment': ['立即停机检查对中状态', '使用激光对中仪校准', '检查联轴器磨损'],
    'imbalance': ['进行动平衡测试', '检查叶轮磨损情况', '清理堆积物料'],
    'looseness': ['检查地脚螺栓紧固情况', '检查连接部件', '进行振动检测确认']
}

class FaultClassifier:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = os.path.join(Config.MODEL_DIR, 'fault_classifier.pkl')
        self.scaler_path = os.path.join(Config.MODEL_DIR, 'fault_scaler.pkl')
        self.feature_names = [
            'rms', 'peak', 'crest_factor', 'kurtosis', 'skewness',
            'peak_to_peak', 'margin_factor', 'impulse_factor',
            'freq_peak_1', 'freq_peak_2', 'freq_peak_3',
            'freq_peak_4', 'freq_peak_5', 'harmonic_ratio',
            'swing_rms', 'temp_rms', 'temp_trend'
        ]
        self._load_model()
    
    def _load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                logger.info("Fault classifier model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load fault model: {e}")
                self._build_model()
        else:
            logger.info("No existing fault model, building new one")
            self._build_model()
    
    def _build_model(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            random_state=42,
            class_weight='balanced'
        )
        self.scaler = StandardScaler()
        logger.info("New fault classifier model built")
    
    def _extract_time_domain_features(self, data: np.ndarray) -> Dict:
        rms = np.sqrt(np.mean(data ** 2))
        peak = np.max(np.abs(data))
        peak_to_peak = np.max(data) - np.min(data)
        crest_factor = peak / rms if rms > 0 else 0
        kurtosis = np.mean((data - np.mean(data)) ** 4) / (np.std(data) ** 4) if np.std(data) > 0 else 0
        skewness = np.mean((data - np.mean(data)) ** 3) / (np.std(data) ** 3) if np.std(data) > 0 else 0
        
        margin = peak_to_peak / rms if rms > 0 else 0
        impulse = np.max(np.abs(data)) / np.mean(np.abs(data)) if np.mean(np.abs(data)) > 0 else 0
        
        return {
            'rms': rms,
            'peak': peak,
            'crest_factor': crest_factor,
            'kurtosis': kurtosis,
            'skewness': skewness,
            'peak_to_peak': peak_to_peak,
            'margin_factor': margin,
            'impulse_factor': impulse
        }
    
    def _extract_frequency_domain_features(self, data: np.ndarray, sample_rate: int) -> Dict:
        n = len(data)
        fft_vals = fft(data)
        fft_freq = np.fft.fftfreq(n, 1/sample_rate)
        amplitudes = 2.0/n * np.abs(fft_vals)
        
        positive_mask = fft_freq >= 0
        positive_freq = fft_freq[positive_mask]
        positive_amps = amplitudes[positive_mask]
        
        top_indices = np.argsort(positive_amps)[-5:]
        top_freqs = positive_freq[top_indices]
        top_amps = positive_amps[top_indices]
        
        freq_peaks = sorted(top_freqs)
        harmonic_ratio = np.sum(top_amps) / np.sum(positive_amps) if np.sum(positive_amps) > 0 else 0
        
        return {
            f'freq_peak_{i+1}': freq_peaks[i] if i < len(freq_peaks) else 0
            for i in range(5)
        }, {'harmonic_ratio': harmonic_ratio}
    
    def _extract_features(self, vibration_data: np.ndarray, swing_data: np.ndarray, 
                          temp_data: np.ndarray, sample_rate: int) -> np.ndarray:
        time_features = self._extract_time_domain_features(vibration_data)
        freq_features_dict, harmonic_dict = self._extract_frequency_domain_features(vibration_data, sample_rate)
        
        swing_rms = np.sqrt(np.mean(swing_data ** 2))
        temp_rms = np.sqrt(np.mean(temp_data ** 2))
        temp_trend = np.polyfit(range(len(temp_data)), temp_data, 1)[0] if len(temp_data) > 1 else 0
        
        all_features = {
            **time_features,
            **freq_features_dict,
            **harmonic_dict,
            'swing_rms': swing_rms,
            'temp_rms': temp_rms,
            'temp_trend': temp_trend
        }
        
        feature_vector = [all_features.get(name, 0) for name in self.feature_names]
        return np.array(feature_vector)
    
    def train_model(self, training_data: pd.DataFrame) -> Dict:
        X = training_data[self.feature_names].values
        y = training_data['fault_type'].values
        
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        
        os.makedirs(Config.MODEL_DIR, exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        accuracy = self.model.score(X_scaled, y)
        
        logger.info(f"Fault classifier trained successfully with accuracy: {accuracy:.4f}")
        
        return {
            'accuracy': float(accuracy),
            'training_samples': len(X),
            'classes': list(np.unique(y))
        }
    
    def classify(self, sensor_id: str, duration_minutes: int = 5) -> Dict:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=duration_minutes)
        
        data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
        
        if len(data) < 100:
            raise ValueError(f"Insufficient data for classification. Need at least 100 points")
        
        df = pd.DataFrame(data)
        vibration_data = df['vibration'].values
        swing_data = df['swing'].values
        temp_data = df['temperature'].values
        
        sample_rate = min(1000, len(data) // duration_minutes * 60)
        
        features = self._extract_features(vibration_data, swing_data, temp_data, sample_rate)
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        
        probabilities = self.model.predict_proba(features_scaled)[0]
        predicted_class = np.argmax(probabilities)
        confidence = float(probabilities[predicted_class])
        
        fault_code = int(predicted_class)
        fault_type = FAULT_TYPES.get(fault_code, 'unknown')
        
        bearing_score = self._calculate_bearing_score(features)
        misalignment_score = self._calculate_misalignment_score(features)
        
        overall_severity = self._calculate_severity(
            confidence,
            fault_type,
            np.sqrt(np.mean(vibration_data ** 2))
        )
        
        return {
            'sensor_id': sensor_id,
            'analysis_time': end_time.isoformat(),
            'analysis_duration_minutes': duration_minutes,
            'fault_detected': fault_type != 'normal',
            'primary_fault': {
                'code': fault_code,
                'type': fault_type,
                'name': FAULT_NAMES.get(fault_type, '未知'),
                'confidence': confidence,
                'description': FAULT_DESCRIPTIONS.get(fault_type, ''),
                'severity': FAULT_SEVERITY.get(fault_type, '未知')
            },
            'secondary_indicators': {
                'bearing_wear_probability': float(bearing_score),
                'misalignment_probability': float(misalignment_score)
            },
            'severity_level': overall_severity,
            'recommendations': RECOMMENDATIONS.get(fault_type, ['进一步检查']),
            'raw_features': {k: float(v) for k, v in zip(self.feature_names, features)},
            'all_probabilities': {
                FAULT_TYPES.get(i, f'class_{i}'): float(prob)
                for i, prob in enumerate(probabilities)
            }
        }
    
    def _calculate_bearing_score(self, features: np.ndarray) -> float:
        kurtosis = features[3]
        crest_factor = features[2]
        peak = features[1]
        
        score = 0.0
        if kurtosis > 3.5:
            score += (kurtosis - 3.5) * 0.2
        if crest_factor > 8:
            score += (crest_factor - 8) * 0.1
        if peak > 3.0:
            score += 0.3
        
        return min(1.0, score)
    
    def _calculate_misalignment_score(self, features: np.ndarray) -> float:
        swing_rms = features[14]
        freq_peak_2 = features[8]
        freq_peak_4 = features[10]
        
        score = 0.0
        if swing_rms > 0.5:
            score += (swing_rms - 0.5) * 0.5
        if 80 < freq_peak_2 < 120 or 160 < freq_peak_4 < 240:
            score += 0.4
        
        return min(1.0, score)
    
    def _calculate_severity(self, confidence: float, fault_type: str, rms: float) -> str:
        if fault_type == 'normal':
            return '正常'
        
        base_severity = FAULT_SEVERITY.get(fault_type, '中等')
        
        if confidence > 0.8 and rms > 5.0:
            return '严重'
        elif confidence > 0.6 or rms > 3.0:
            return '高'
        else:
            return base_severity
    
    def batch_classify(self, sensor_ids: List[str], duration_minutes: int = 5) -> Dict:
        results = {}
        for sensor_id in sensor_ids:
            try:
                results[sensor_id] = self.classify(sensor_id, duration_minutes)
            except Exception as e:
                logger.error(f"Failed to classify {sensor_id}: {e}")
                results[sensor_id] = {'error': str(e)}
        
        return results

fault_classifier = FaultClassifier()
