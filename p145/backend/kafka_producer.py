from kafka import KafkaProducer
import json
import logging
from typing import Dict
from datetime import datetime

from config import Config

logger = logging.getLogger(__name__)

class SensorDataProducer:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=Config.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',
            retries=3
        )
        self.topic = Config.KAFKA_TOPIC
    
    def send_sensor_data(self, sensor_id: str, vibration: float, swing: float, 
                         temperature: float, timestamp: str = None):
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat()
        
        data = {
            "sensor_id": sensor_id,
            "vibration": vibration,
            "swing": swing,
            "temperature": temperature,
            "timestamp": timestamp,
            "type": "sensor_data"
        }
        
        try:
            future = self.producer.send(self.topic, value=data)
            future.get(timeout=10)
            logger.debug(f"Sent sensor data to Kafka: {sensor_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to send sensor data to Kafka: {e}")
            return False
    
    def close(self):
        self.producer.close()

producer = SensorDataProducer()
