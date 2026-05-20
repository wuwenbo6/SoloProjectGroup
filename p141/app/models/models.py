from datetime import datetime
from app import db
import json

class Building(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text)
    center_lat = db.Column(db.Float, nullable=False)
    center_lng = db.Column(db.Float, nullable=False)
    width = db.Column(db.Float, default=50.0)
    height = db.Column(db.Float, default=50.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    floors = db.relationship('Floor', backref='building', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'center_lat': self.center_lat,
            'center_lng': self.center_lng,
            'width': self.width,
            'height': self.height,
            'created_at': self.created_at.isoformat()
        }

class Floor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    building_id = db.Column(db.Integer, db.ForeignKey('building.id'), nullable=False)
    floor_number = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(128))
    description = db.Column(db.Text)
    grid_size = db.Column(db.Float, default=1.0)
    grid_width = db.Column(db.Integer, default=50)
    grid_height = db.Column(db.Integer, default=50)
    image_url = db.Column(db.String(256))
    
    obstacles = db.relationship('Obstacle', backref='floor', lazy='dynamic')
    pois = db.relationship('POI', backref='floor', lazy='dynamic')
    heatmap_data = db.relationship('HeatmapData', backref='floor', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'building_id': self.building_id,
            'floor_number': self.floor_number,
            'name': self.name or f'Floor {self.floor_number}',
            'description': self.description,
            'grid_size': self.grid_size,
            'grid_width': self.grid_width,
            'grid_height': self.grid_height,
            'image_url': self.image_url
        }

class Obstacle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    name = db.Column(db.String(128))
    type = db.Column(db.String(32))
    x1 = db.Column(db.Float, nullable=False)
    y1 = db.Column(db.Float, nullable=False)
    x2 = db.Column(db.Float, nullable=False)
    y2 = db.Column(db.Float, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'floor_id': self.floor_id,
            'name': self.name,
            'type': self.type,
            'x1': self.x1,
            'y1': self.y1,
            'x2': self.x2,
            'y2': self.y2
        }

class POI(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    type = db.Column(db.String(32))
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'floor_id': self.floor_id,
            'name': self.name,
            'type': self.type,
            'x': self.x,
            'y': self.y,
            'description': self.description
        }

class HeatmapData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    grid_x = db.Column(db.Integer, nullable=False)
    grid_y = db.Column(db.Integer, nullable=False)
    error_mean = db.Column(db.Float, default=0.0)
    error_std = db.Column(db.Float, default=0.0)
    sample_count = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'floor_id': self.floor_id,
            'grid_x': self.grid_x,
            'grid_y': self.grid_y,
            'error_mean': self.error_mean,
            'error_std': self.error_std,
            'sample_count': self.sample_count,
            'updated_at': self.updated_at.isoformat()
        }

class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    device_type = db.Column(db.String(32), nullable=False)
    name = db.Column(db.String(128))
    description = db.Column(db.Text)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    csi_data = db.relationship('CSIData', backref='device', lazy='dynamic')
    imu_data = db.relationship('IMUData', backref='device', lazy='dynamic')
    trajectories = db.relationship('Trajectory', backref='device', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'device_type': self.device_type,
            'name': self.name,
            'description': self.description,
            'registered_at': self.registered_at.isoformat(),
            'last_seen': self.last_seen.isoformat(),
            'is_active': self.is_active
        }

class CSIData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), db.ForeignKey('device.device_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    mac_address = db.Column(db.String(32))
    rssi = db.Column(db.Float)
    amplitude = db.Column(db.Text)
    phase = db.Column(db.Text)
    num_subcarriers = db.Column(db.Integer)
    channel = db.Column(db.Integer)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'mac_address': self.mac_address,
            'rssi': self.rssi,
            'amplitude': self.amplitude,
            'phase': self.phase,
            'num_subcarriers': self.num_subcarriers,
            'channel': self.channel
        }

class IMUData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), db.ForeignKey('device.device_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    accel_x = db.Column(db.Float)
    accel_y = db.Column(db.Float)
    accel_z = db.Column(db.Float)
    gyro_x = db.Column(db.Float)
    gyro_y = db.Column(db.Float)
    gyro_z = db.Column(db.Float)
    mag_x = db.Column(db.Float)
    mag_y = db.Column(db.Float)
    mag_z = db.Column(db.Float)
    orientation_x = db.Column(db.Float)
    orientation_y = db.Column(db.Float)
    orientation_z = db.Column(db.Float)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'accel_x': self.accel_x,
            'accel_y': self.accel_y,
            'accel_z': self.accel_z,
            'gyro_x': self.gyro_x,
            'gyro_y': self.gyro_y,
            'gyro_z': self.gyro_z,
            'mag_x': self.mag_x,
            'mag_y': self.mag_y,
            'mag_z': self.mag_z,
            'orientation_x': self.orientation_x,
            'orientation_y': self.orientation_y,
            'orientation_z': self.orientation_z
        }

class Trajectory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), db.ForeignKey('device.device_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    uncertainty = db.Column(db.Float)
    source = db.Column(db.String(32))
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'x': self.x,
            'y': self.y,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'uncertainty': self.uncertainty,
            'source': self.source
        }
