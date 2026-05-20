import json
import numpy as np
from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db, socketio
from app.models.models import Device, CSIData, IMUData

bp = Blueprint('data', __name__, url_prefix='/api/data')

def validate_csi_data(amplitude, phase, rssi):
    if len(amplitude) == 0 and len(phase) == 0:
        return False, "Empty CSI data"
    
    if len(amplitude) > 0:
        amp_arr = np.array(amplitude)
        if np.any(np.isnan(amp_arr)) or np.any(np.isinf(amp_arr)):
            return False, "Invalid amplitude values"
        
        if np.std(amp_arr) > 100:
            return False, "Amplitude variance too high"
    
    if len(phase) > 0:
        phase_arr = np.array(phase)
        if np.any(np.isnan(phase_arr)) or np.any(np.isinf(phase_arr)):
            return False, "Invalid phase values"
        
        if np.max(np.abs(np.diff(phase_arr))) > np.pi:
            pass
    
    if rssi is not None:
        if rssi < -100 or rssi > 0:
            return False, "RSSI out of valid range"
    
    return True, "Valid"

def sanitize_imu_data(accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z):
    max_accel = 20.0
    max_gyro = 10.0
    
    def clamp(val, max_val):
        if val is None:
            return 0.0
        val = float(val)
        if np.isnan(val) or np.isinf(val):
            return 0.0
        return max(-max_val, min(max_val, val))
    
    return (
        clamp(accel_x, max_accel),
        clamp(accel_y, max_accel),
        clamp(accel_z, max_accel),
        clamp(gyro_x, max_gyro),
        clamp(gyro_y, max_gyro),
        clamp(gyro_z, max_gyro)
    )

@bp.route('/csi', methods=['POST'])
def receive_csi_data():
    data = request.get_json()
    
    if not data or 'device_id' not in data:
        return jsonify({'error': 'Missing device_id'}), 400
    
    device = Device.query.filter_by(device_id=data['device_id']).first()
    if not device:
        return jsonify({'error': 'Device not registered'}), 404
    
    amplitude = data.get('amplitude', [])
    phase = data.get('phase', [])
    rssi = data.get('rssi')
    
    is_valid, validation_msg = validate_csi_data(amplitude, phase, rssi)
    if not is_valid:
        return jsonify({
            'error': f'CSI data validation failed: {validation_msg}',
            'position': None
        }), 400
    
    csi = CSIData(
        device_id=data['device_id'],
        mac_address=data.get('mac_address'),
        rssi=rssi,
        amplitude=json.dumps(amplitude),
        phase=json.dumps(phase),
        num_subcarriers=data.get('num_subcarriers'),
        channel=data.get('channel')
    )
    
    if 'timestamp' in data:
        csi.timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
    
    db.session.add(csi)
    device.last_seen = datetime.utcnow()
    db.session.commit()
    
    from app.utils.positioning import process_csi_positioning
    position = process_csi_positioning(csi)
    
    if position:
        socketio.emit('position_update', {
            'device_id': data['device_id'],
            'position': position,
            'timestamp': csi.timestamp.isoformat(),
            'source': 'csi'
        })
    
    return jsonify({
        'message': 'CSI data received successfully',
        'position': position,
        'validation': validation_msg
    }), 200

@bp.route('/imu', methods=['POST'])
def receive_imu_data():
    data = request.get_json()
    
    if not data or 'device_id' not in data:
        return jsonify({'error': 'Missing device_id'}), 400
    
    device = Device.query.filter_by(device_id=data['device_id']).first()
    if not device:
        return jsonify({'error': 'Device not registered'}), 404
    
    accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z = sanitize_imu_data(
        data.get('accel_x'), data.get('accel_y'), data.get('accel_z'),
        data.get('gyro_x'), data.get('gyro_y'), data.get('gyro_z')
    )
    
    def sanitize_mag(val):
        if val is None:
            return None
        val = float(val)
        if np.isnan(val) or np.isinf(val):
            return None
        return max(-100.0, min(100.0, val))
    
    def sanitize_orientation(val):
        if val is None:
            return None
        val = float(val)
        if np.isnan(val) or np.isinf(val):
            return None
        return max(-180.0, min(180.0, val))
    
    imu = IMUData(
        device_id=data['device_id'],
        accel_x=accel_x,
        accel_y=accel_y,
        accel_z=accel_z,
        gyro_x=gyro_x,
        gyro_y=gyro_y,
        gyro_z=gyro_z,
        mag_x=sanitize_mag(data.get('mag_x')),
        mag_y=sanitize_mag(data.get('mag_y')),
        mag_z=sanitize_mag(data.get('mag_z')),
        orientation_x=sanitize_orientation(data.get('orientation_x')),
        orientation_y=sanitize_orientation(data.get('orientation_y')),
        orientation_z=sanitize_orientation(data.get('orientation_z'))
    )
    
    if 'timestamp' in data:
        imu.timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
    
    db.session.add(imu)
    device.last_seen = datetime.utcnow()
    db.session.commit()
    
    from app.utils.positioning import process_imu_positioning
    position = process_imu_positioning(imu)
    
    if position:
        socketio.emit('position_update', {
            'device_id': data['device_id'],
            'position': position,
            'timestamp': imu.timestamp.isoformat(),
            'source': 'imu'
        })
    
    return jsonify({
        'message': 'IMU data received successfully',
        'position': position,
        'sanitized': True
    }), 200

@bp.route('/csi/<device_id>', methods=['GET'])
def get_csi_data(device_id):
    limit = request.args.get('limit', 100, type=int)
    csi_data = CSIData.query.filter_by(device_id=device_id).order_by(CSIData.timestamp.desc()).limit(limit).all()
    return jsonify({
        'csi_data': [csi.to_dict() for csi in csi_data]
    })

@bp.route('/imu/<device_id>', methods=['GET'])
def get_imu_data(device_id):
    limit = request.args.get('limit', 100, type=int)
    imu_data = IMUData.query.filter_by(device_id=device_id).order_by(IMUData.timestamp.desc()).limit(limit).all()
    return jsonify({
        'imu_data': [imu.to_dict() for imu in imu_data]
    })
