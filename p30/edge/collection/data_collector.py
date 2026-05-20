import time
import threading
import numpy as np
from typing import Dict, Callable, Optional
from dataclasses import dataclass
from enum import Enum
from queue import Queue


class DataType(Enum):
    IMAGE = "image"
    AUDIO = "audio"
    SENSOR = "sensor"


@dataclass
class CollectedData:
    data_id: str
    device_id: str
    data_type: DataType
    timestamp: float
    data: np.ndarray
    metadata: Dict


class DataCollector:
    def __init__(self):
        self.data_queue: Queue[CollectedData] = Queue(maxsize=1000)
        self.callbacks: Dict[DataType, List[Callable]] = {
            DataType.IMAGE: [],
            DataType.AUDIO: [],
            DataType.SENSOR: []
        }
        self._running = False
        self._collect_threads = {}
        self._sample_rate = {
            DataType.IMAGE: 2.0,
            DataType.AUDIO: 1.0,
            DataType.SENSOR: 5.0
        }

    def set_sample_rate(self, data_type: DataType, rate: float):
        self._sample_rate[data_type] = rate

    def start_collection(self, device_id: str, data_type: DataType, 
                        collect_func: Callable):
        if device_id in self._collect_threads:
            return False
        
        thread = threading.Thread(
            target=self._collection_loop,
            args=(device_id, data_type, collect_func),
            daemon=True
        )
        self._collect_threads[device_id] = thread
        thread.start()
        return True

    def stop_collection(self, device_id: str) -> bool:
        if device_id not in self._collect_threads:
            return False
        del self._collect_threads[device_id]
        return True

    def _collection_loop(self, device_id: str, data_type: DataType, 
                        collect_func: Callable):
        while self._running or device_id in self._collect_threads:
            try:
                data = collect_func()
                if data is not None:
                    collected_data = CollectedData(
                        data_id=f"{device_id}_{int(time.time() * 1000)}",
                        device_id=device_id,
                        data_type=data_type,
                        timestamp=time.time(),
                        data=data,
                        metadata={}
                    )
                    if not self.data_queue.full():
                        self.data_queue.put(collected_data)
                        self._notify_callbacks(collected_data)
            except Exception as e:
                print(f"Collection error for {device_id}: {e}")
            time.sleep(1.0 / self._sample_rate[data_type])

    def _notify_callbacks(self, data: CollectedData):
        for callback in self.callbacks[data.data_type]:
            try:
                callback(data)
            except Exception as e:
                print(f"Callback error: {e}")

    def add_callback(self, data_type: DataType, callback: Callable):
        self.callbacks[data_type].append(callback)

    def get_latest_data(self, timeout: float = 1.0) -> Optional[CollectedData]:
        try:
            return self.data_queue.get(timeout=timeout)
        except:
            return None

    def start(self):
        self._running = True

    def stop(self):
        self._running = False
        self._collect_threads.clear()


class CameraSimulator:
    def __init__(self, resolution=(640, 480)):
        self.resolution = resolution

    def capture(self) -> np.ndarray:
        image = np.random.randint(0, 256, 
                                (*self.resolution, 3), 
                                dtype=np.uint8)
        return image


class AudioSimulator:
    def __init__(self, sample_rate=44100, duration=1.0):
        self.sample_rate = sample_rate
        self.duration = duration

    def record(self) -> np.ndarray:
        audio = np.random.randn(int(self.sample_rate * self.duration))
        audio = np.clip(audio, -1, 1)
        return audio.astype(np.float32)
