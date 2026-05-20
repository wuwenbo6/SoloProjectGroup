import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import asyncio
import logging
from typing import Dict, List

from config import Config
from kafka_producer import producer

logger = logging.getLogger(__name__)

class SensorDataSimulator:
    def __init__(self, sample_rate: int = None):
        self.sample_rate = sample_rate or Config.SAMPLE_RATE
        self.sensors = ["sensor_001", "sensor_002", "sensor_003"]
        self.is_running = False
    
    def generate_normal_data(self, duration: float = 1.0) -> pd.DataFrame:
        n_samples = int(duration * self.sample_rate)
        timestamps = [datetime.utcnow() + timedelta(microseconds=i*1000000/self.sample_rate) 
                     for i in range(n_samples)]
        
        data = []
        for sensor_id in self.sensors:
            base_vibration = np.random.uniform(0.5, 2.0)
            base_swing = np.random.uniform(0.1, 0.5)
            base_temperature = np.random.uniform(25, 35)
            
            vibration = base_vibration + 0.2 * np.random.randn(n_samples)
            swing = base_swing + 0.05 * np.random.randn(n_samples)
            temperature = base_temperature + 0.5 * np.random.randn(n_samples)
            
            for i in range(n_samples):
                data.append({
                    "timestamp": timestamps[i],
                    "sensor_id": sensor_id,
                    "vibration": vibration[i],
                    "swing": swing[i],
                    "temperature": temperature[i],
                    "is_anomaly": False
                })
        
        return pd.DataFrame(data)
    
    def generate_anomaly_data(self, duration: float = 0.5, anomaly_type: str = "vibration_spike") -> pd.DataFrame:
        n_samples = int(duration * self.sample_rate)
        timestamps = [datetime.utcnow() + timedelta(microseconds=i*1000000/self.sample_rate) 
                     for i in range(n_samples)]
        
        data = []
        sensor_id = np.random.choice(self.sensors)
        
        base_vibration = np.random.uniform(0.5, 2.0)
        base_swing = np.random.uniform(0.1, 0.5)
        base_temperature = np.random.uniform(25, 35)
        
        vibration = base_vibration + 0.2 * np.random.randn(n_samples)
        swing = base_swing + 0.05 * np.random.randn(n_samples)
        temperature = base_temperature + 0.5 * np.random.randn(n_samples)
        
        if anomaly_type == "vibration_spike":
            spike_start = n_samples // 3
            spike_end = 2 * n_samples // 3
            vibration[spike_start:spike_end] += 5.0 * np.sin(np.linspace(0, 4*np.pi, spike_end - spike_start))
        elif anomaly_type == "swing_increase":
            swing += 2.0
        elif anomaly_type == "temperature_rise":
            temperature += 15.0
        elif anomaly_type == "mixed":
            spike_start = n_samples // 4
            spike_end = 3 * n_samples // 4
            vibration[spike_start:spike_end] += 3.0
            swing[spike_start:spike_end] += 1.0
            temperature[spike_start:spike_end] += 8.0
        
        for i in range(n_samples):
            data.append({
                "timestamp": timestamps[i],
                "sensor_id": sensor_id,
                "vibration": vibration[i],
                "swing": swing[i],
                "temperature": temperature[i],
                "is_anomaly": True
            })
        
        return pd.DataFrame(data)
    
    def generate_training_data(self, duration_hours: float = 1.0) -> pd.DataFrame:
        all_data = []
        interval = 60
        
        for minute in range(int(duration_hours * 60)):
            normal_data = self.generate_normal_data(duration=1.0)
            normal_data['timestamp'] = normal_data['timestamp'].apply(
                lambda x: x - timedelta(hours=duration_hours) + timedelta(minutes=minute)
            )
            all_data.append(normal_data)
            
            if np.random.random() < 0.1:
                anomaly_data = self.generate_anomaly_data(duration=0.5)
                anomaly_data['timestamp'] = anomaly_data['timestamp'].apply(
                    lambda x: x - timedelta(hours=duration_hours) + timedelta(minutes=minute)
                )
                all_data.append(anomaly_data)
        
        final_df = pd.concat(all_data, ignore_index=True)
        final_df = final_df.sort_values('timestamp').reset_index(drop=True)
        
        return final_df
    
    async def start_simulation(self, interval: float = 1.0, anomaly_chance: float = 0.05):
        self.is_running = True
        logger.info("Starting sensor data simulation...")
        
        while self.is_running:
            if np.random.random() < anomaly_chance:
                data = self.generate_anomaly_data(duration=interval, 
                                                  anomaly_type=np.random.choice(["vibration_spike", "swing_increase", "temperature_rise", "mixed"]))
            else:
                data = self.generate_normal_data(duration=interval)
            
            for _, row in data.iterrows():
                producer.send_sensor_data(
                    sensor_id=row['sensor_id'],
                    vibration=row['vibration'],
                    swing=row['swing'],
                    temperature=row['temperature'],
                    timestamp=row['timestamp'].isoformat()
                )
            
            await asyncio.sleep(interval)
    
    def stop(self):
        self.is_running = False
        logger.info("Simulation stopped")

simulator = SensorDataSimulator()
