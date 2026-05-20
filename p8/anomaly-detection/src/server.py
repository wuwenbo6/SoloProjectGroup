import os
import sys
import time
import logging
from concurrent import futures
from typing import List, Dict, Any

import grpc
import numpy as np
from prometheus_client import start_http_server, Counter, Histogram

sys.path.append(os.path.join(os.path.dirname(__file__), '../generated'))
import anomaly_detection_pb2
import anomaly_detection_pb2_grpc

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter('anomaly_detection_requests_total', 'Total number of anomaly detection requests')
REQUEST_LATENCY = Histogram('anomaly_detection_request_latency_seconds', 'Anomaly detection request latency')
ANOMALY_COUNT = Counter('anomalies_detected_total', 'Total number of anomalies detected')


class AnomalyDetector:
    def __init__(self):
        self.thresholds = {
            'temperature': {'min': -40, 'max': 85, 'std_threshold': 3.0},
            'humidity': {'min': 0, 'max': 100, 'std_threshold': 2.5},
            'pressure': {'min': 800, 'max': 1200, 'std_threshold': 2.0},
            'voltage': {'min': 0, 'max': 480, 'std_threshold': 2.5},
            'current': {'min': 0, 'max': 1000, 'std_threshold': 2.5},
        }
        self.default_threshold = {'min': -1e6, 'max': 1e6, 'std_threshold': 3.0}

    def detect_range_anomaly(self, metric: str, value: float, timestamp: int) -> Dict[str, Any]:
        threshold = self.thresholds.get(metric, self.default_threshold)
        if value < threshold['min']:
            return {
                'type': 'RANGE_LOW',
                'confidence': min(1.0, (threshold['min'] - value) / abs(threshold['min']) * 2),
                'timestamp': timestamp,
                'metric': metric,
                'description': f'Value {value} is below minimum threshold {threshold["min"]}'
            }
        elif value > threshold['max']:
            return {
                'type': 'RANGE_HIGH',
                'confidence': min(1.0, (value - threshold['max']) / threshold['max'] * 2),
                'timestamp': timestamp,
                'metric': metric,
                'description': f'Value {value} is above maximum threshold {threshold["max"]}'
            }
        return None

    def detect_statistical_anomaly(self, metric: str, values: List[float], timestamps: List[int]) -> List[Dict[str, Any]]:
        if len(values) < 5:
            return []

        threshold = self.thresholds.get(metric, self.default_threshold)
        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return []

        anomalies = []
        std_factor = threshold['std_threshold']

        for i, (value, ts) in enumerate(zip(values, timestamps)):
            z_score = abs(value - mean) / std
            if z_score > std_factor:
                confidence = min(1.0, (z_score - std_factor) / std_factor + 0.5)
                anomalies.append({
                    'type': 'STATISTICAL_OUTLIER',
                    'confidence': confidence,
                    'timestamp': ts,
                    'metric': metric,
                    'description': f'Value {value} is {z_score:.2f} standard deviations from mean {mean:.2f}'
                })

        return anomalies

    def detect_spike_anomaly(self, metric: str, values: List[float], timestamps: List[int]) -> List[Dict[str, Any]]:
        if len(values) < 3:
            return []

        anomalies = []
        for i in range(1, len(values) - 1):
            prev_val = values[i - 1]
            curr_val = values[i]
            next_val = values[i + 1]

            if prev_val == 0:
                continue

            change_rate = abs(curr_val - prev_val) / abs(prev_val)

            if change_rate > 0.5:
                recovery_rate = abs(next_val - curr_val) / abs(curr_val) if curr_val != 0 else 0
                if recovery_rate > 0.3:
                    confidence = min(1.0, change_rate)
                    anomalies.append({
                        'type': 'SPIKE',
                        'confidence': confidence,
                        'timestamp': timestamps[i],
                        'metric': metric,
                        'description': f'Spike detected: {prev_val:.2f} -> {curr_val:.2f} -> {next_val:.2f}'
                    })

        return anomalies

    def detect_trend_anomaly(self, metric: str, values: List[float], timestamps: List[int]) -> List[Dict[str, Any]]:
        if len(values) < 10:
            return []

        x = np.arange(len(values))
        slope, intercept = np.polyfit(x, values, 1)

        anomalies = []
        if abs(slope) > 10:
            confidence = min(1.0, abs(slope) / 50)
            anomalies.append({
                'type': 'TREND_CHANGE',
                'confidence': confidence,
                'timestamp': timestamps[-1],
                'metric': metric,
                'description': f'Sudden trend detected with slope {slope:.2f}'
            })

        return anomalies

    def detect(self, device_id: str, data_points: List[anomaly_detection_pb2.TimeSeriesPoint]) -> List[Dict[str, Any]]:
        if not data_points:
            return []

        metric_data: Dict[str, tuple] = {}
        for point in data_points:
            metric = point.metric or 'default'
            if metric not in metric_data:
                metric_data[metric] = ([], [])
            metric_data[metric][0].append(point.value)
            metric_data[metric][1].append(point.timestamp)

        all_anomalies = []

        for metric, (values, timestamps) in metric_data.items():
            for value, ts in zip(values, timestamps):
                range_anomaly = self.detect_range_anomaly(metric, value, ts)
                if range_anomaly:
                    all_anomalies.append(range_anomaly)

            statistical_anomalies = self.detect_statistical_anomaly(metric, values, timestamps)
            all_anomalies.extend(statistical_anomalies)

            spike_anomalies = self.detect_spike_anomaly(metric, values, timestamps)
            all_anomalies.extend(spike_anomalies)

            trend_anomalies = self.detect_trend_anomaly(metric, values, timestamps)
            all_anomalies.extend(trend_anomalies)

        seen = set()
        unique_anomalies = []
        for anomaly in all_anomalies:
            key = (anomaly['type'], anomaly['metric'], anomaly['timestamp'])
            if key not in seen:
                seen.add(key)
                unique_anomalies.append(anomaly)

        return unique_anomalies


class AnomalyDetectionServiceServicer(anomaly_detection_pb2_grpc.AnomalyDetectionServiceServicer):
    def __init__(self):
        self.detector = AnomalyDetector()

    @REQUEST_LATENCY.time()
    def DetectAnomaly(self, request, context):
        REQUEST_COUNT.inc()

        device_id = request.device_id
        data_points = request.data

        logger.info(f"Processing anomaly detection request for device: {device_id}, points: {len(data_points)}")

        anomalies = self.detector.detect(device_id, data_points)

        pb_anomalies = []
        for anomaly in anomalies:
            pb_anomaly = anomaly_detection_pb2.AnomalyResult(
                anomaly_type=anomaly['type'],
                confidence=anomaly['confidence'],
                timestamp=anomaly['timestamp'],
                metric=anomaly['metric'],
                description=anomaly['description']
            )
            pb_anomalies.append(pb_anomaly)

        ANOMALY_COUNT.inc(len(pb_anomalies))

        logger.info(f"Detected {len(pb_anomalies)} anomalies for device {device_id}")

        return anomaly_detection_pb2.DetectAnomalyResponse(
            device_id=device_id,
            anomalies=pb_anomalies,
            has_anomaly=len(pb_anomalies) > 0
        )

    def BatchDetectAnomaly(self, request, context):
        responses = []
        for req in request.requests:
            resp = self.DetectAnomaly(req, context)
            responses.append(resp)

        return anomaly_detection_pb2.BatchDetectAnomalyResponse(responses=responses)


def serve():
    grpc_port = os.getenv('GRPC_PORT', '50052')
    metrics_port = int(os.getenv('METRICS_PORT', '8000'))

    start_http_server(metrics_port)
    logger.info(f"Prometheus metrics server started on port {metrics_port}")

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    anomaly_detection_pb2_grpc.add_AnomalyDetectionServiceServicer_to_server(
        AnomalyDetectionServiceServicer(), server
    )

    server.add_insecure_port(f'[::]:{grpc_port}')
    server.start()

    logger.info(f"Anomaly Detection gRPC server started on port {grpc_port}")

    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        server.stop(0)


if __name__ == '__main__':
    serve()
