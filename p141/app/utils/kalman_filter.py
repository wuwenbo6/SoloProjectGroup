import numpy as np
from datetime import datetime, timedelta

class KalmanFilter2D:
    def __init__(self, initial_state=None, process_noise=0.1, measurement_noise_csi=0.5, measurement_noise_imu=0.3):
        self.dt = 0.1
        
        self.x = np.array([0, 0, 0, 0], dtype=np.float32) if initial_state is None else initial_state
        
        self.P = np.eye(4) * 1.0
        
        self.F = np.array([
            [1, 0, self.dt, 0],
            [0, 1, 0, self.dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ], dtype=np.float32)
        
        self.H_pos = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)
        
        self.Q = np.eye(4) * process_noise
        
        self.R_csi = np.eye(2) * measurement_noise_csi
        self.R_imu = np.eye(2) * measurement_noise_imu
        
        self.last_csi_time = None
        self.last_imu_time = None
        self.last_csi_position = None
        
        self.divergence_threshold = 10.0
        self.velocity_limit = 5.0
        self.position_limit = 100.0
        
        self.consecutive_pure_predicts = 0
        self.max_consecutive_pure_predicts = 10
        
        self.imu_timeout = timedelta(seconds=1.0)
        self.csi_timeout = timedelta(seconds=2.0)
        
    def check_divergence(self):
        uncertainty = np.mean(np.diag(self.P)[:2])
        velocity = np.sqrt(self.x[2]**2 + self.x[3]**2)
        position = np.sqrt(self.x[0]**2 + self.x[1]**2)
        
        is_divergent = (
            uncertainty > self.divergence_threshold or
            velocity > self.velocity_limit or
            position > self.position_limit or
            self.consecutive_pure_predicts >= self.max_consecutive_pure_predicts
        )
        
        return is_divergent
    
    def reset_filter(self, position=None):
        if position is not None and len(position) >= 2:
            self.x[0] = float(position[0])
            self.x[1] = float(position[1])
        else:
            if self.last_csi_position is not None:
                self.x[0] = self.last_csi_position[0]
                self.x[1] = self.last_csi_position[1]
        
        self.x[2] = 0
        self.x[3] = 0
        self.P = np.eye(4) * 0.1
        self.consecutive_pure_predicts = 0
        
    def predict(self):
        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        self.consecutive_pure_predicts += 1
        
        if self.check_divergence():
            self.reset_filter()
        
        return self.x[:2]
    
    def update_csi(self, z, timestamp=None):
        z = np.array(z, dtype=np.float32)
        self.last_csi_position = z.copy()
        self.last_csi_time = timestamp or datetime.utcnow()
        
        innovation = z - np.dot(self.H_pos, self.x)
        innovation_magnitude = np.linalg.norm(innovation)
        
        adaptive_R = self.R_csi.copy()
        if innovation_magnitude > 2.0:
            adaptive_R = adaptive_R * (1.0 + innovation_magnitude)
        
        y = innovation
        S = np.dot(np.dot(self.H_pos, self.P), self.H_pos.T) + adaptive_R
        K = np.dot(np.dot(self.P, self.H_pos.T), np.linalg.inv(S))
        self.x = self.x + np.dot(K, y)
        self.P = np.dot((np.eye(4) - np.dot(K, self.H_pos)), self.P)
        
        self.consecutive_pure_predicts = max(0, self.consecutive_pure_predicts - 2)
        
        return self.x[:2]
    
    def update_imu(self, accel, timestamp=None):
        ax, ay = accel
        self.last_imu_time = timestamp or datetime.utcnow()
        
        accel_magnitude = np.sqrt(ax**2 + ay**2)
        if accel_magnitude > 10.0:
            scale = 10.0 / accel_magnitude
            ax = ax * scale
            ay = ay * scale
        
        prev_vx = self.x[2]
        prev_vy = self.x[3]
        
        self.x[2] += ax * self.dt
        self.x[3] += ay * self.dt
        
        speed = np.sqrt(self.x[2]**2 + self.x[3]**2)
        if speed > self.velocity_limit:
            scale = self.velocity_limit / speed
            self.x[2] *= scale
            self.x[3] *= scale
        
        x_pos = self.x[0] + 0.5 * (prev_vx + self.x[2]) * self.dt
        y_pos = self.x[1] + 0.5 * (prev_vy + self.x[3]) * self.dt
        
        z = np.array([x_pos, y_pos], dtype=np.float32)
        
        y = z - np.dot(self.H_pos, self.x)
        S = np.dot(np.dot(self.H_pos, self.P), self.H_pos.T) + self.R_imu
        K = np.dot(np.dot(self.P, self.H_pos.T), np.linalg.inv(S))
        self.x = self.x + np.dot(K, y)
        self.P = np.dot((np.eye(4) - np.dot(K, self.H_pos)), self.P)
        
        self.consecutive_pure_predicts = max(0, self.consecutive_pure_predicts - 1)
        
        return self.x[:2]
    
    def is_imu_timed_out(self, current_time=None):
        if current_time is None:
            current_time = datetime.utcnow()
        if self.last_imu_time is None:
            return True
        return (current_time - self.last_imu_time) > self.imu_timeout
    
    def should_fallback_to_csi(self, current_time=None):
        if current_time is None:
            current_time = datetime.utcnow()
        
        imu_timed_out = self.is_imu_timed_out(current_time)
        is_divergent = self.check_divergence()
        
        return imu_timed_out or is_divergent
    
    def get_state(self):
        return {
            'x': float(self.x[0]),
            'y': float(self.x[1]),
            'vx': float(self.x[2]),
            'vy': float(self.x[3]),
            'uncertainty': float(np.mean(np.diag(self.P)[:2])),
            'is_divergent': self.check_divergence(),
            'consecutive_predicts': self.consecutive_pure_predicts,
            'imu_timed_out': self.is_imu_timed_out()
        }

_kalman_filters = {}

def get_kalman_filter(device_id):
    if device_id not in _kalman_filters:
        _kalman_filters[device_id] = KalmanFilter2D()
    return _kalman_filters[device_id]
