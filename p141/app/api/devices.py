from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.models import Device

bp = Blueprint('devices', __name__, url_prefix='/api/devices')

@bp.route('/register', methods=['POST'])
def register_device():
    data = request.get_json()
    
    if not data or 'device_id' not in data or 'device_type' not in data:
        return jsonify({'error': 'Missing required fields: device_id and device_type'}), 400
    
    device = Device.query.filter_by(device_id=data['device_id']).first()
    
    if device:
        device.last_seen = datetime.utcnow()
        if 'name' in data:
            device.name = data['name']
        if 'description' in data:
            device.description = data['description']
        device.is_active = True
    else:
        device = Device(
            device_id=data['device_id'],
            device_type=data['device_type'],
            name=data.get('name'),
            description=data.get('description')
        )
        db.session.add(device)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Device registered successfully',
        'device': device.to_dict()
    }), 200

@bp.route('/', methods=['GET'])
def get_devices():
    devices = Device.query.all()
    return jsonify({
        'devices': [device.to_dict() for device in devices]
    })

@bp.route('/<device_id>', methods=['GET'])
def get_device(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    return jsonify(device.to_dict())

@bp.route('/<device_id>', methods=['PUT'])
def update_device(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    
    data = request.get_json()
    if 'name' in data:
        device.name = data['name']
    if 'description' in data:
        device.description = data['description']
    if 'is_active' in data:
        device.is_active = data['is_active']
    
    db.session.commit()
    return jsonify(device.to_dict())

@bp.route('/<device_id>', methods=['DELETE'])
def delete_device(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    
    db.session.delete(device)
    db.session.commit()
    return jsonify({'message': 'Device deleted successfully'})

@bp.route('/<device_id>/heartbeat', methods=['POST'])
def device_heartbeat(device_id):
    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    
    device.last_seen = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Heartbeat received'})
