from influxdb_client import InfluxDBClient, Point, WritePrecision, WriteOptions
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import logging
import threading

from config import Config

logger = logging.getLogger(__name__)

class InfluxDBManager:
    def __init__(self):
        self.client = InfluxDBClient(
            url=Config.INFLUXDB_URL,
            token=Config.INFLUXDB_TOKEN,
            org=Config.INFLUXDB_ORG
        )
        self.write_api = self.client.write_api(
            write_options=WriteOptions(
                batch_size=1000,
                flush_interval=100,
                jitter_interval=0,
                retry_interval=5000,
                max_retries=3,
                max_retry_delay=15000,
                exponential_base=2
            )
        )
        self.sync_write_api = self.client.write_api(write_options="s")
        self.query_api = self.client.query_api()
        self.bucket = Config.INFLUXDB_BUCKET
        self.org = Config.INFLUXDB_ORG
        self._lock = threading.Lock()
    
    def write_sensor_data(self, sensor_id: str, vibration: float, swing: float, temperature: float, 
                          timestamp: Optional[datetime] = None, is_anomaly: bool = False):
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        point = Point("sensor_data") \
            .tag("sensor_id", sensor_id) \
            .field("vibration", vibration) \
            .field("swing", swing) \
            .field("temperature", temperature) \
            .field("is_anomaly", int(is_anomaly)) \
            .time(timestamp, WritePrecision.NS)
        
        with self._lock:
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
        logger.debug(f"Written sensor data: {sensor_id}")
    
    def write_sensor_data_batch(self, records: List[Tuple[str, float, float, float, datetime, bool]]):
        if not records:
            return
        
        points = []
        for sensor_id, vibration, swing, temperature, timestamp, is_anomaly in records:
            point = Point("sensor_data") \
                .tag("sensor_id", sensor_id) \
                .field("vibration", vibration) \
                .field("swing", swing) \
                .field("temperature", temperature) \
                .field("is_anomaly", int(is_anomaly)) \
                .time(timestamp, WritePrecision.NS)
            points.append(point)
        
        with self._lock:
            self.write_api.write(bucket=self.bucket, org=self.org, record=points)
        
        logger.debug(f"Batch written {len(points)} sensor data points")
    
    def write_anomaly_event(self, sensor_id: str, start_time: datetime, end_time: datetime, 
                            anomaly_score: float, description: str):
        point = Point("anomaly_events") \
            .tag("sensor_id", sensor_id) \
            .field("anomaly_score", anomaly_score) \
            .field("description", description) \
            .field("start_time", start_time.isoformat()) \
            .field("end_time", end_time.isoformat()) \
            .time(datetime.utcnow(), WritePrecision.NS)
        
        with self._lock:
            self.sync_write_api.write(bucket=self.bucket, org=self.org, record=point)
        logger.info(f"Anomaly event recorded: {sensor_id}, score: {anomaly_score}")
    
    def flush(self):
        with self._lock:
            self.write_api.flush()
        logger.debug("Write API flushed")
    
    def query_sensor_data(self, sensor_id: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        query = f'''
        from(bucket: "{self.bucket}")
            |> range(start: {start_time.isoformat()}Z, stop: {end_time.isoformat()}Z)
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["_time"])
        '''
        
        tables = self.query_api.query(query)
        data = []
        
        for table in tables:
            for record in table.records:
                data.append({
                    "time": record["_time"],
                    "sensor_id": record["sensor_id"],
                    "vibration": record.get("vibration", 0),
                    "swing": record.get("swing", 0),
                    "temperature": record.get("temperature", 0),
                    "is_anomaly": bool(record.get("is_anomaly", 0))
                })
        
        return data
    
    def query_anomaly_events(self, sensor_id: Optional[str] = None, 
                             start_time: Optional[datetime] = None, 
                             end_time: Optional[datetime] = None) -> List[Dict]:
        query = f'''
        from(bucket: "{self.bucket}")
            |> range(start: 0, stop: now())
            |> filter(fn: (r) => r["_measurement"] == "anomaly_events")
        '''
        
        if sensor_id:
            query += f' |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")'
        
        tables = self.query_api.query(query)
        events = []
        
        for table in tables:
            for record in table.records:
                events.append({
                    "time": record["_time"],
                    "sensor_id": record["sensor_id"],
                    "anomaly_score": record.get("anomaly_score", 0),
                    "description": record.get("description", ""),
                    "start_time": record.get("start_time", ""),
                    "end_time": record.get("end_time", "")
                })
        
        return events
    
    def get_latest_data(self, sensor_id: str, limit: int = 100) -> List[Dict]:
        query = f'''
        from(bucket: "{self.bucket}")
            |> range(start: -1h, stop: now())
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: {limit})
            |> sort(columns: ["_time"])
        '''
        
        tables = self.query_api.query(query)
        data = []
        
        for table in tables:
            for record in table.records:
                data.append({
                    "time": record["_time"],
                    "sensor_id": record["sensor_id"],
                    "vibration": record.get("vibration", 0),
                    "swing": record.get("swing", 0),
                    "temperature": record.get("temperature", 0),
                    "is_anomaly": bool(record.get("is_anomaly", 0))
                })
        
        return data
    
    def close(self):
        self.client.close()

db_manager = InfluxDBManager()
