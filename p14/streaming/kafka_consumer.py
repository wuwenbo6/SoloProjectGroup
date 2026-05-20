import json
import threading
import queue
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from collections import deque
import time

try:
    from kafka import KafkaConsumer, KafkaProducer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False


class StreamDataBuffer:
    """流式数据缓冲区 - 用于存储和聚合流数据"""

    def __init__(self, max_size: int = 10000, window_seconds: int = 60):
        self.max_size = max_size
        self.window_seconds = window_seconds
        self.data_buffer: deque = deque(maxlen=max_size)
        self.window_data: List[Dict] = []
        self.last_window_time: float = time.time()

    def add(self, data: Dict[str, Any]):
        """添加数据点"""
        timestamp = data.get('_timestamp', datetime.now().isoformat())
        data['_timestamp'] = timestamp
        self.data_buffer.append(data)
        self.window_data.append(data)

        # 窗口滚动
        current_time = time.time()
        if current_time - self.last_window_time >= self.window_seconds:
            self._roll_window()

    def _roll_window(self):
        """滚动时间窗口"""
        cutoff_time = time.time() - self.window_seconds
        self.window_data = [
            d for d in self.window_data
            if self._parse_timestamp(d.get('_timestamp')) > cutoff_time
        ]
        self.last_window_time = time.time()

    def _parse_timestamp(self, ts) -> float:
        """解析时间戳"""
        if isinstance(ts, (int, float)):
            return ts
        try:
            return datetime.fromisoformat(str(ts)).timestamp()
        except:
            return time.time()

    def get_recent(self, n: int = 100) -> List[Dict]:
        """获取最近N条数据"""
        return list(self.data_buffer)[-n:]

    def get_window_data(self) -> List[Dict]:
        """获取当前窗口数据"""
        self._roll_window()
        return self.window_data

    def get_stats(self) -> Dict[str, Any]:
        """获取缓冲区统计"""
        return {
            'buffer_size': len(self.data_buffer),
            'window_size': len(self.window_data),
            'max_size': self.max_size,
            'window_seconds': self.window_seconds,
            'time_since_roll': time.time() - self.last_window_time
        }


class KafkaStreamConsumer:
    """Kafka流数据消费者 - 支持多主题、实时数据聚合"""

    def __init__(self, bootstrap_servers: str = "localhost:9092",
                 group_id: str = "analytics-dashboard",
                 max_buffer_size: int = 10000):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.consumer: Optional[KafkaConsumer] = None
        self.producer: Optional[KafkaProducer] = None
        self.buffers: Dict[str, StreamDataBuffer] = {}
        self.thread: Optional[threading.Thread] = None
        self.running: bool = False
        self.callbacks: List[Callable[[str, Dict], None]] = []
        self.aggregators: Dict[str, Dict[str, float]] = {}
        self.max_buffer_size = max_buffer_size

    def connect(self) -> bool:
        """连接Kafka"""
        if not KAFKA_AVAILABLE:
            print("⚠️  kafka-python 未安装，请运行: pip install kafka-python")
            return False

        try:
            self.consumer = KafkaConsumer(
                bootstrap_servers=self.bootstrap_servers,
                group_id=self.group_id,
                auto_offset_reset='latest',
                enable_auto_commit=True,
                value_deserializer=lambda x: json.loads(x.decode('utf-8'))
            )
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda x: json.dumps(x).encode('utf-8')
            )
            print("✅ Kafka连接成功")
            return True
        except Exception as e:
            print(f"❌ Kafka连接失败: {e}")
            return False

    def subscribe(self, topics: List[str]):
        """订阅主题"""
        if not self.consumer:
            raise RuntimeError("请先连接Kafka")

        for topic in topics:
            if topic not in self.buffers:
                self.buffers[topic] = StreamDataBuffer(max_size=self.max_buffer_size)

        self.consumer.subscribe(topics)
        print(f"✅ 已订阅主题: {', '.join(topics)}")

    def start_consuming(self, blocking: bool = False):
        """开始消费数据"""
        if not self.consumer:
            raise RuntimeError("请先连接Kafka")

        self.running = True

        if blocking:
            self._consume_loop()
        else:
            self.thread = threading.Thread(target=self._consume_loop, daemon=True)
            self.thread.start()
            print("✅ 后台消费线程已启动")

    def _consume_loop(self):
        """消费主循环"""
        try:
            for message in self.consumer:
                if not self.running:
                    break

                topic = message.topic
                data = message.value

                # 存入缓冲区
                if topic in self.buffers:
                    self.buffers[topic].add(data)

                # 执行回调
                for callback in self.callbacks:
                    try:
                        callback(topic, data)
                    except Exception as e:
                        print(f"回调执行错误: {e}")

        except Exception as e:
            print(f"消费循环异常: {e}")

    def stop_consuming(self):
        """停止消费"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.close()
        print("✅ 已停止Kafka消费")

    def register_callback(self, callback: Callable[[str, Dict], None]):
        """注册数据回调函数"""
        self.callbacks.append(callback)

    def get_latest_data(self, topic: str, n: int = 100) -> List[Dict]:
        """获取最新数据"""
        if topic not in self.buffers:
            return []
        return self.buffers[topic].get_recent(n)

    def get_window_stats(self, topic: str) -> Dict[str, Any]:
        """获取时间窗口统计数据"""
        if topic not in self.buffers:
            return {}

        buffer = self.buffers[topic]
        window_data = buffer.get_window_data()

        if not window_data:
            return {}

        # 提取数值字段进行统计
        numeric_fields = self._get_numeric_fields(window_data)
        stats = {
            'window_size': len(window_data),
            'timestamp': datetime.now().isoformat(),
            'fields': {}
        }

        for field in numeric_fields:
            values = [d[field] for d in window_data if field in d and isinstance(d[field], (int, float))]
            if values:
                stats['fields'][field] = {
                    'count': len(values),
                    'sum': sum(values),
                    'mean': sum(values) / len(values),
                    'min': min(values),
                    'max': max(values),
                    'latest': values[-1]
                }

        return stats

    def _get_numeric_fields(self, data: List[Dict]) -> List[str]:
        """获取数值型字段列表"""
        if not data:
            return []
        return [k for k, v in data[0].items() if isinstance(v, (int, float))]

    def send_data(self, topic: str, data: Dict[str, Any]):
        """发送数据到Kafka（用于测试）"""
        if self.producer:
            self.producer.send(topic, data)
            self.producer.flush()


class RealtimeAnalytics:
    """实时分析引擎 - 对流数据进行实时统计分析"""

    def __init__(self, consumer: KafkaStreamConsumer):
        self.consumer = consumer
        self.stats_history: Dict[str, deque] = {}
        self.alerts: List[Dict] = []

    def start_analysis(self, topic: str, interval_seconds: int = 5):
        """启动实时分析"""
        self.stats_history[topic] = deque(maxlen=100)

        def analysis_loop():
            while self.consumer.running:
                stats = self.consumer.get_window_stats(topic)
                if stats:
                    stats['analysis_time'] = datetime.now().isoformat()
                    self.stats_history[topic].append(stats)
                time.sleep(interval_seconds)

        thread = threading.Thread(target=analysis_loop, daemon=True)
        thread.start()
        print(f"✅ 已启动主题 {topic} 的实时分析")

    def get_latest_stats(self, topic: str) -> Optional[Dict]:
        """获取最新统计数据"""
        if topic in self.stats_history and self.stats_history[topic]:
            return self.stats_history[topic][-1]
        return None

    def get_stats_history(self, topic: str) -> List[Dict]:
        """获取统计历史"""
        if topic in self.stats_history:
            return list(self.stats_history[topic])
        return []

    def detect_anomalies(self, topic: str, field: str, threshold: float = 3.0) -> List[Dict]:
        """简单的异常检测（基于标准差）"""
        if topic not in self.stats_history or len(self.stats_history[topic]) < 5:
            return []

        values = []
        for stat in self.stats_history[topic]:
            if 'fields' in stat and field in stat['fields']:
                values.append(stat['fields'][field]['mean'])

        if len(values) < 5:
            return []

        # 简单Z-score检测
        mean_val = sum(values) / len(values)
        std_val = (sum((x - mean_val) ** 2 for x in values) / len(values)) ** 0.5

        anomalies = []
        if std_val > 0:
            z_score = (values[-1] - mean_val) / std_val
            if abs(z_score) > threshold:
                anomalies.append({
                    'field': field,
                    'value': values[-1],
                    'z_score': z_score,
                    'threshold': threshold,
                    'timestamp': datetime.now().isoformat(),
                    'type': 'anomaly_detected'
                })

        return anomalies


def create_mock_kafka_producer(bootstrap_servers: str = "localhost:9092"):
    """创建模拟Kafka生产者（用于测试）"""
    producer = KafkaStreamConsumer(bootstrap_servers)
    if producer.connect():
        return producer
    return None


def run_stream_demo():
    """流式处理演示"""
    consumer = KafkaStreamConsumer(
        bootstrap_servers="localhost:9092",
        group_id="demo-group"
    )

    # 尝试连接，如果失败则使用模拟模式
    if not consumer.connect():
        print("\n⚠️  使用模拟模式（Kafka不可用）")
        return None

    consumer.subscribe(["sales-events", "user-activity", "metrics"])
    consumer.start_consuming(blocking=False)

    analytics = RealtimeAnalytics(consumer)
    analytics.start_analysis("sales-events", interval_seconds=2)
    analytics.start_analysis("metrics", interval_seconds=2)

    return consumer


if __name__ == "__main__":
    run_stream_demo()
