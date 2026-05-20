import os
import json
import numpy as np
from scipy.signal import savgol_filter
from config import Config

_fingerprint_model = None
_fingerprint_database = None

def phase_unwrap(phase):
    unwrapped = np.unwrap(phase)
    return unwrapped

def phase_linear_calibration(phase, amplitude=None):
    n = len(phase)
    if n < 2:
        return phase
    
    x = np.arange(n)
    linear_fit = np.polyfit(x, phase, 1)
    phase_trend = np.polyval(linear_fit, x)
    calibrated = phase - phase_trend
    
    if amplitude is not None and len(amplitude) == len(calibrated):
        weight = amplitude / np.sum(amplitude)
        calibrated = calibrated * weight
    
    return calibrated

def phase_sanitize(phase, amplitude=None, threshold=3.0):
    phase = np.array(phase)
    
    phase_unwrapped = phase_unwrap(phase)
    
    phase_calibrated = phase_linear_calibration(phase_unwrapped, amplitude)
    
    mean_phase = np.mean(phase_calibrated)
    std_phase = np.std(phase_calibrated)
    z_scores = np.abs((phase_calibrated - mean_phase) / (std_phase + 1e-6))
    phase_calibrated[z_scores > threshold] = mean_phase
    
    try:
        phase_smoothed = savgol_filter(phase_calibrated, min(5, len(phase_calibrated) // 2 * 2 + 1), 2)
    except:
        phase_smoothed = phase_calibrated
    
    return phase_smoothed

def evaluate_csi_quality(amplitude, phase):
    if len(amplitude) == 0 or len(phase) == 0:
        return 0.0
    
    amp_valid = np.all(np.isfinite(amplitude)) and np.std(amplitude) > 0
    phase_valid = np.all(np.isfinite(phase))
    
    if not (amp_valid and phase_valid):
        return 0.0
    
    amp_spread = np.std(amplitude) / (np.mean(np.abs(amplitude)) + 1e-6)
    phase_continuity = np.mean(np.abs(np.diff(np.unwrap(phase))))
    
    quality_score = 0.5 * (1.0 - min(1.0, amp_spread)) + 0.5 * (1.0 - min(1.0, phase_continuity))
    
    return max(0.0, min(1.0, quality_score))

def load_fingerprint_model():
    global _fingerprint_model
    if _fingerprint_model is None:
        model_path = Config.FINGERPRINT_CONFIG['model_path']
        if os.path.exists(model_path):
            try:
                from tensorflow import keras
                _fingerprint_model = keras.models.load_model(model_path)
            except:
                _fingerprint_model = None
    return _fingerprint_model

def load_fingerprint_database():
    global _fingerprint_database
    if _fingerprint_database is None:
        db_path = Config.FINGERPRINT_CONFIG['fingerprint_db_path']
        if os.path.exists(db_path):
            _fingerprint_database = np.load(db_path, allow_pickle=True).item()
    return _fingerprint_database

def extract_csi_features(csi_data):
    try:
        amplitude = np.array(json.loads(csi_data.amplitude))
        phase = np.array(json.loads(csi_data.phase))
        
        if len(amplitude) == 0:
            amplitude = np.zeros(64)
        if len(phase) == 0:
            phase = np.zeros(64)
        
        if len(amplitude) > 0 and len(phase) > 0:
            phase = phase_sanitize(phase, amplitude)
        
        if len(amplitude) >= 64:
            amplitude = amplitude[:64]
        else:
            amplitude = np.pad(amplitude, (0, max(0, 64 - len(amplitude))), mode='edge')
        
        if len(phase) >= 64:
            phase = phase[:64]
        else:
            phase = np.pad(phase, (0, max(0, 64 - len(phase))), mode='edge')
        
        amp_mean = np.mean(amplitude)
        amp_std = np.std(amplitude)
        amp_max = np.max(amplitude)
        amp_min = np.min(amplitude)
        
        phase_mean = np.mean(phase)
        phase_std = np.std(phase)
        
        quality_score = evaluate_csi_quality(amplitude, phase)
        
        features = np.concatenate([
            amplitude,
            phase,
            [amp_mean, amp_std, amp_max, amp_min, phase_mean, phase_std, quality_score]
        ])
        
        return features
    except Exception as e:
        print(f"CSI feature extraction error: {e}")
        return np.zeros(135)

_last_csi_position = {}
_last_csi_time = {}

def predict_position_fingerprint(csi_data):
    device_id = csi_data.device_id
    db = load_fingerprint_database()
    model = load_fingerprint_model()
    
    features = extract_csi_features(csi_data)
    quality_score = features[-1]
    
    if quality_score < 0.3:
        if device_id in _last_csi_position:
            return _last_csi_position[device_id]
    
    predicted_pos = None
    
    if db is not None and len(db) > 0:
        fingerprints = np.array([v['features'] for v in db.values()])
        positions = np.array([v['position'] for v in db.values()])
        
        distances = np.linalg.norm(fingerprints[:, :135] - features, axis=1)
        nearest_idx = np.argmin(distances)
        
        if distances[nearest_idx] < 15.0:
            k = min(5, len(distances))
            top_k_idx = np.argsort(distances)[:k]
            weights = 1.0 / (distances[top_k_idx] + 1e-6)
            weights = weights / np.sum(weights)
            predicted_pos = np.sum(positions[top_k_idx] * weights.reshape(-1, 1), axis=0)
    
    if predicted_pos is None and model is not None:
        try:
            pred = model.predict(features.reshape(1, -1), verbose=0)
            predicted_pos = pred[0]
        except:
            pass
    
    if predicted_pos is not None:
        if device_id in _last_csi_position:
            last_pos = _last_csi_position[device_id]
            distance = np.linalg.norm(predicted_pos - last_pos)
            
            max_jump = 3.0 if quality_score > 0.5 else 1.5
            if distance > max_jump:
                direction = predicted_pos - last_pos
                direction = direction / (np.linalg.norm(direction) + 1e-6)
                predicted_pos = last_pos + direction * max_jump
        
        _last_csi_position[device_id] = predicted_pos.copy()
        _last_csi_time[device_id] = csi_data.timestamp
        
        return predicted_pos
    
    if device_id in _last_csi_position:
        return _last_csi_position[device_id]
    
    return np.array([0.0, 0.0])

def estimate_position_from_rssi(rssi, tx_power=-50, n=2.0):
    distance = 10 ** ((tx_power - rssi) / (10 * n))
    angle = np.random.uniform(0, 2 * np.pi)
    x = distance * np.cos(angle)
    y = distance * np.sin(angle)
    return np.array([x, y])
