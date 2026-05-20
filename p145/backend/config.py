import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
    INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "your-token-here")
    INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "iot-org")
    INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "sensor-data")
    
    KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "sensor-data")
    
    DINGTALK_WEBHOOK = os.getenv("DINGTALK_WEBHOOK", "")
    
    MODEL_PATH = os.getenv("MODEL_PATH", "./models/lstm_autoencoder.h5")
    SCALER_PATH = os.getenv("SCALER_PATH", "./models/scaler.pkl")
    THRESHOLD_PATH = os.getenv("THRESHOLD_PATH", "./models/threshold.pkl")
    
    ANOMALY_THRESHOLD = float(os.getenv("ANOMALY_THRESHOLD", "3.0"))
    SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "1000"))
    SEQUENCE_LENGTH = int(os.getenv("SEQUENCE_LENGTH", "100"))
    
    UPLOAD_DIR = "./uploads"
    MODEL_DIR = "./models"
    
    @classmethod
    def ensure_dirs(cls):
        os.makedirs(cls.UPLOAD_DIR, exist_ok=True)
        os.makedirs(cls.MODEL_DIR, exist_ok=True)
