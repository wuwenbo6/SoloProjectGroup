from kafka import KafkaConsumer
import json
import logging
import asyncio
from datetime import datetime
from collections import defaultdict, deque
import numpy as np
import threading

from config import Config
from database import db_manager
from anomaly_detector import detector
from dingtalk_alert import notifier

logger = logging.getLogger(__name__)

class SensorDataConsumer:
    def __init__(self):
        self.consumer = KafkaConsumer(
            Config.KAFKA_TOPIC,
            bootstrap_servers=Config.KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            auto_commit_interval_ms=1000,
            fetch_max_wait_ms=100,
            fetch_min_bytes=102400,
            fetch_max_bytes=52428800,
            max_poll_records=500,
            max_poll_interval_ms=300000,
            receive_buffer_bytes=131072,
            send_buffer_bytes=131072,
            group_id='sensor-consumer-group'
        )
        self.is_running = False
        self.data_buffer = defaultdict(lambda: deque(maxlen=Config.SEQUENCE_LENGTH * 2))
        self.last_alert_time = {}
        self.alert_cooldown = 60
        self.batch_size = 100
        self.batch_timeout = 0.5
        self._lock = threading.Lock()
    
    async def process_batch(self, messages):
        try:
            anomaly_tasks = []
            db_records = []
            
            for message in messages:
                data = message.value
                sensor_id = data['sensor_id']
                vibration = data['vibration']
                swing = data['swing']
                temperature = data['temperature']
                timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
                
                is_anomaly = False
                anomaly_score = 0.0
                
                if detector.model is not None and detector.scaler is not None:
                    with self._lock:
                        self.data_buffer[sensor_id].append({
                            'vibration': vibration,
                            'swing': swing,
                            'temperature': temperature
                        })
                        
                        if len(self.data_buffer[sensor_id]) >= Config.SEQUENCE_LENGTH:
                            window_data = np.array([
                                [d['vibration'], d['swing'], d['temperature']]
                                for d in self.data_buffer[sensor_id]
                            ])
                            
                            is_anomaly, anomaly_score = detector.detect_anomaly(window_data)
                            
                            if is_anomaly:
                                anomaly_tasks.append((sensor_id, vibration, swing, temperature, timestamp, anomaly_score))
                
                db_records.append((sensor_id, vibration, swing, temperature, timestamp, is_anomaly))
            
            db_manager.write_sensor_data_batch(db_records)
            
            for anomaly_data in anomaly_tasks:
                await self._handle_anomaly(*anomaly_data)
            
            logger.debug(f"Processed batch of {len(messages)} messages")
            
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
    
    async def process_message(self, message):
        try:
            data = message.value
            sensor_id = data['sensor_id']
            vibration = data['vibration']
            swing = data['swing']
            temperature = data['temperature']
            timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
            
            is_anomaly = False
            anomaly_score = 0.0
            
            if detector.model is not None and detector.scaler is not None:
                with self._lock:
                    self.data_buffer[sensor_id].append({
                        'vibration': vibration,
                        'swing': swing,
                        'temperature': temperature
                    })
                    
                    if len(self.data_buffer[sensor_id]) >= Config.SEQUENCE_LENGTH:
                        window_data = np.array([
                            [d['vibration'], d['swing'], d['temperature']]
                            for d in self.data_buffer[sensor_id]
                        ])
                        
                        is_anomaly, anomaly_score = detector.detect_anomaly(window_data)
                        
                        if is_anomaly:
                            await self._handle_anomaly(sensor_id, vibration, swing, temperature, 
                                                       timestamp, anomaly_score)
            
            db_manager.write_sensor_data(
                sensor_id=sensor_id,
                vibration=vibration,
                swing=swing,
                temperature=temperature,
                timestamp=timestamp,
                is_anomaly=is_anomaly
            )
            
            logger.debug(f"Processed data from {sensor_id}: anomaly={is_anomaly}, score={anomaly_score:.4f}")
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def _handle_anomaly(self, sensor_id: str, vibration: float, swing: float,
                               temperature: float, timestamp: datetime, anomaly_score: float):
        last_alert = self.last_alert_time.get(sensor_id, datetime.min)
        if (timestamp - last_alert).total_seconds() < self.alert_cooldown:
            return
        
        self.last_alert_time[sensor_id] = timestamp
        
        logger.warning(f"Anomaly detected for {sensor_id}! Score: {anomaly_score:.4f}")
        
        details = {
            'vibration': vibration,
            'swing': swing,
            'temperature': temperature
        }
        
        db_manager.write_anomaly_event(
            sensor_id=sensor_id,
            start_time=timestamp,
            end_time=timestamp,
            anomaly_score=anomaly_score,
            description=f"异常振动/摆度/温度检测，评分: {anomaly_score:.2f}"
        )
        
        await notifier.send_anomaly_alert(
            sensor_id=sensor_id,
            anomaly_score=anomaly_score,
            timestamp=timestamp,
            details=details
        )
    
    async def start_consuming(self):
        self.is_running = True
        logger.info("Starting Kafka consumer...")
        logger.info(f"Consumer config: fetch_max_wait_ms=100, max_poll_records=500")
        
        try:
            while self.is_running:
                records = self.consumer.poll(timeout_ms=100, max_records=self.batch_size)
                
                if records:
                    all_messages = []
                    for _, messages in records.items():
                        all_messages.extend(messages)
                    
                    await self.process_batch(all_messages)
                
                await asyncio.sleep(0.001)
                
        except Exception as e:
            logger.error(f"Consumer error: {e}")
        finally:
            self.consumer.close()
    
    def stop(self):
        self.is_running = False
        logger.info("Consumer stopping...")

consumer = SensorDataConsumer()
