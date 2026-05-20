from flask import Blueprint, request, jsonify
from app import db
from app.models.models import Trajectory
from app.utils.positioning import get_current_position, reset_position

bp = Blueprint('tracking', __name__, url_prefix='/api/tracking')

@bp.route('/position/<device_id>', methods=['GET'])
def get_position(device_id):
    position = get_current_position(device_id)
    return jsonify({
        'device_id': device_id,
        'position': position
    })

@bp.route('/position/<device_id>', methods=['POST'])
def set_position(device_id):
    data = request.get_json()
    if not data or 'x' not in data or 'y' not in data:
        return jsonify({'error': 'Missing x or y coordinates'}), 400
    
    position = reset_position(device_id, data['x'], data['y'])
    return jsonify({
        'device_id': device_id,
        'position': position,
        'message': 'Position reset successfully'
    })

@bp.route('/trajectory/<device_id>', methods=['GET'])
def get_trajectory(device_id):
    limit = request.args.get('limit', 1000, type=int)
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    query = Trajectory.query.filter_by(device_id=device_id)
    
    if start_time:
        from datetime import datetime
        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            query = query.filter(Trajectory.timestamp >= start_dt)
        except:
            pass
    
    if end_time:
        from datetime import datetime
        try:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            query = query.filter(Trajectory.timestamp <= end_dt)
        except:
            pass
    
    trajectory = query.order_by(Trajectory.timestamp.desc()).limit(limit).all()
    trajectory = list(reversed(trajectory))
    
    return jsonify({
        'device_id': device_id,
        'count': len(trajectory),
        'trajectory': [t.to_dict() for t in trajectory]
    })

@bp.route('/trajectory/<device_id>', methods=['DELETE'])
def clear_trajectory(device_id):
    try:
        num_deleted = Trajectory.query.filter_by(device_id=device_id).delete()
        db.session.commit()
        return jsonify({
            'message': f'Deleted {num_deleted} trajectory points',
            'device_id': device_id
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/devices', methods=['GET'])
def get_active_devices():
    from app.models.models import Device
    from datetime import datetime, timedelta
    
    timeout = request.args.get('timeout', 300, type=int)
    cutoff_time = datetime.utcnow() - timedelta(seconds=timeout)
    
    devices = Device.query.filter(Device.last_seen >= cutoff_time).all()
    
    result = []
    for device in devices:
        pos = get_current_position(device.device_id)
        result.append({
            'device_id': device.device_id,
            'name': device.name,
            'device_type': device.device_type,
            'last_seen': device.last_seen.isoformat(),
            'position': pos
        })
    
    return jsonify({
        'count': len(result),
        'devices': result
    })
