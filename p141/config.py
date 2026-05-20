import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///' + os.path.join(basedir, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SOCKETIO_MESSAGE_QUEUE = os.environ.get('SOCKETIO_MESSAGE_QUEUE')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    MAP_CONFIG = {
        'center_lat': 39.9042,
        'center_lng': 116.4074,
        'zoom': 18
    }
    
    KALMAN_CONFIG = {
        'process_noise': 0.1,
        'measurement_noise_csi': 0.5,
        'measurement_noise_imu': 0.3
    }
    
    FINGERPRINT_CONFIG = {
        'model_path': os.path.join(basedir, 'models', 'fingerprint_model.h5'),
        'fingerprint_db_path': os.path.join(basedir, 'data', 'fingerprint_db.npy'),
        'grid_size': 1.0
    }
