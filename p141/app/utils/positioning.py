import numpy as np
from datetime import datetime
from app import db
from app.models.models import Trajectory
from app.utils.kalman_filter import get_kalman_filter
from app.utils.fingerprint import predict_position_fingerprint, estimate_position_from_rssi

def process_csi_positioning(csi_data):
    device_id = csi_data.device_id
    kf = get_kalman_filter(device_id)
    
    csi_pos = predict_position_fingerprint(csi_data)
    
    if csi_data.rssi is not None:
        rssi_pos = estimate_position_from_rssi(csi_data.rssi)
        csi_pos = 0.7 * csi_pos + 0.3 * rssi_pos
    
    if kf.should_fallback_to_csi():
        kf.reset_filter(csi_pos)
        final_pos = csi_pos
        source = 'csi_pure_fallback'
    else:
        kf.predict()
        final_pos = kf.update_csi(csi_pos, csi_data.timestamp)
        source = 'csi_kalman'
    
    state = kf.get_state()
    
    trajectory = Trajectory(
        device_id=device_id,
        timestamp=csi_data.timestamp,
        x=float(final_pos[0]),
        y=float(final_pos[1]),
        uncertainty=state['uncertainty'],
        source=source
    )
    db.session.add(trajectory)
    db.session.commit()
    
    return {
        'x': float(final_pos[0]),
        'y': float(final_pos[1]),
        'vx': state['vx'],
        'vy': state['vy'],
        'uncertainty': state['uncertainty'],
        'is_fallback': source == 'csi_pure_fallback',
        'is_divergent': state['is_divergent']
    }

def process_imu_positioning(imu_data):
    device_id = imu_data.device_id
    kf = get_kalman_filter(device_id)
    
    accel_x = imu_data.accel_x if imu_data.accel_x is not None else 0
    accel_y = imu_data.accel_y if imu_data.accel_y is not None else 0
    accel = np.array([accel_x, accel_y])
    
    if kf.should_fallback_to_csi():
        if kf.last_csi_position is not None:
            final_pos = kf.last_csi_position
        else:
            final_pos = np.array([kf.x[0], kf.x[1]])
        source = 'imu_fallback_csi'
    else:
        kf.predict()
        final_pos = kf.update_imu(accel, imu_data.timestamp)
        source = 'imu_kalman'
    
    state = kf.get_state()
    
    trajectory = Trajectory(
        device_id=device_id,
        timestamp=imu_data.timestamp,
        x=float(final_pos[0]),
        y=float(final_pos[1]),
        uncertainty=state['uncertainty'],
        source=source
    )
    db.session.add(trajectory)
    db.session.commit()
    
    return {
        'x': float(final_pos[0]),
        'y': float(final_pos[1]),
        'vx': state['vx'],
        'vy': state['vy'],
        'uncertainty': state['uncertainty'],
        'is_fallback': source == 'imu_fallback_csi',
        'is_divergent': state['is_divergent']
    }

def get_current_position(device_id):
    kf = get_kalman_filter(device_id)
    state = kf.get_state()
    return state

def reset_position(device_id, x, y):
    kf = get_kalman_filter(device_id)
    kf.reset_filter([x, y])
    return kf.get_state()
