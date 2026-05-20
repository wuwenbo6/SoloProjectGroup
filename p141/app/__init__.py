from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()
socketio = SocketIO(cors_allowed_origins="*")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    CORS(app)
    db.init_app(app)
    socketio.init_app(app, async_mode='eventlet')
    
    from app.api import devices, data, tracking, mapping
    app.register_blueprint(devices.bp)
    app.register_blueprint(data.bp)
    app.register_blueprint(tracking.bp)
    app.register_blueprint(mapping.bp)
    
    from app import routes
    app.register_blueprint(routes.bp)
    
    with app.app_context():
        db.create_all()
    
    return app
