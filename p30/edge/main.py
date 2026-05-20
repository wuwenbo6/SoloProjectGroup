#!/usr/bin/env python3
import sys
import time
import signal
import threading
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from edge.device.device_manager import DeviceManager, DeviceType, DeviceStatus
from edge.collection.data_collector import DataCollector, DataType, CameraSimulator, AudioSimulator
from edge.feature.feature_extractor import MultiScaleImageFeatureExtractor, AudioFeatureExtractor
from edge.inference.ai_engine import InferenceEngine, PestType
from edge.storage.local_storage import LocalStorage
from edge.communication.data_sync import DataSynchronizer


class EdgePestMonitor:
    def __init__(self, config: dict = None):
        self.config = config or self._default_config()
        
        self.device_manager = DeviceManager()
        self.data_collector = DataCollector()
        self.image_feature_extractor = MultiScaleImageFeatureExtractor()
        self.audio_feature_extractor = AudioFeatureExtractor()
        self.inference_engine = InferenceEngine()
        self.storage = LocalStorage(
            db_path=self.config.get("db_path", "pest_monitor.db"),
            data_dir=self.config.get("data_dir", "data")
        )
        self.synchronizer = DataSynchronizer(
            backend_url=self.config.get("backend_url", "http://localhost:8080"),
            edge_id=self.config.get("edge_id", "edge_001"),
            storage=self.storage
        )
        
        self._running = False
        self._threads = []
        self._setup_signal_handlers()
        self._register_devices()
        self._setup_callbacks()

    def _default_config(self) -> dict:
        return {
            "edge_id": "edge_001",
            "location": "Farm A",
            "backend_url": "http://localhost:8080",
            "db_path": "pest_monitor.db",
            "data_dir": "data",
            "sync_interval": 60,
            "alert_threshold": 0.8
        }

    def _setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        print(f"\nReceived shutdown signal {signum}")
        self.stop()

    def _register_devices(self):
        self.device_manager.register_device(
            device_id="camera_001",
            device_type=DeviceType.CAMERA,
            name="Field Camera 1",
            location="North Field",
            config={"resolution": (640, 480)}
        )
        
        self.device_manager.register_device(
            device_id="audio_001",
            device_type=DeviceType.AUDIO,
            name="Audio Sensor 1",
            location="North Field",
            config={"sample_rate": 44100}
        )

    def _setup_callbacks(self):
        def on_inference_result(result):
            self.storage.save_inference_result(
                result_id=result.result_id,
                data_id=result.data_id,
                device_id=result.device_id,
                pest_type=result.pest_type.value,
                confidence=result.confidence,
                model_type=result.model_type.value,
                timestamp=result.timestamp,
                metadata=result.metadata
            )
            
            if result.confidence > self.config["alert_threshold"] and result.pest_type not in [PestType.HEALTHY, PestType.UNKNOWN]:
                print(f"⚠️  ALERT: High confidence {result.pest_type.value} detected!")
        
        self.inference_engine.add_callback(on_inference_result)

    def _image_processing_loop(self):
        camera = CameraSimulator()
        
        while self._running:
            try:
                devices = self.device_manager.get_devices_by_type(DeviceType.CAMERA)
                for device in devices:
                    if device.status == DeviceStatus.ONLINE:
                        image = camera.capture()
                        
                        self.storage.save_collected_data(
                            data_id=f"{device.device_id}_{int(time.time() * 1000)}",
                            device_id=device.device_id,
                            data_type="image",
                            timestamp=time.time(),
                            data=image,
                            metadata={"resolution": list(image.shape)}
                        )
                        
                        data_id = f"{device.device_id}_{int(time.time() * 1000)}"
                        result = self.inference_engine.infer_image(
                            image=image,
                            data_id=data_id,
                            device_id=device.device_id
                        )
                        
                        print(f"📸 Image inference: {result.pest_type.value} (confidence: {result.confidence:.2f})")
                
                time.sleep(2.0)
                
            except Exception as e:
                print(f"Image processing error: {e}")
                time.sleep(1.0)

    def _audio_processing_loop(self):
        audio_sensor = AudioSimulator()
        
        while self._running:
            try:
                devices = self.device_manager.get_devices_by_type(DeviceType.AUDIO)
                for device in devices:
                    if device.status == DeviceStatus.ONLINE:
                        audio = audio_sensor.record()
                        
                        features = self.audio_feature_extractor.extract_all(
                            audio=audio,
                            data_id=f"{device.device_id}_{int(time.time() * 1000)}"
                        )
                        
                        if features:
                            combined_features = features[0].vector
                            data_id = f"{device.device_id}_{int(time.time() * 1000)}"
                            result = self.inference_engine.infer_audio(
                                features=combined_features,
                                data_id=data_id,
                                device_id=device.device_id
                            )
                            
                            print(f"🎤 Audio inference: {result.pest_type.value} (confidence: {result.confidence:.2f})")
                
                time.sleep(3.0)
                
            except Exception as e:
                print(f"Audio processing error: {e}")
                time.sleep(1.0)

    def _status_monitor_loop(self):
        while self._running:
            try:
                stats = self.storage.get_storage_stats()
                sync_status = self.synchronizer.get_status()
                pest_stats = self.inference_engine.get_pest_statistics()
                
                print(f"\n{'='*50}")
                print(f"Edge Monitor Status - {time.strftime('%Y-%m-%d %H:%M:%S'}")
                print(f"{'='*50}")
                print(f"Storage: {stats}")
                print(f"Sync: {sync_status.value}")
                print(f"Pest stats: { {k.value: v for k, v in pest_stats.items()} }")
                print(f"{'='*50}\n")
                
                time.sleep(30)
                
            except Exception as e:
                print(f"Status monitor error: {e}")
                time.sleep(5.0)

    def start(self):
        print("Starting Edge Pest Monitoring System...")
        print(f"Edge ID: {self.config['edge_id']}")
        print(f"Location: {self.config['location']}")
        
        self._running = True
        
        self.device_manager.start_monitor()
        self.synchronizer.start()
        
        threads = [
            threading.Thread(target=self._image_processing_loop, daemon=True),
            threading.Thread(target=self._audio_processing_loop, daemon=True),
            threading.Thread(target=self._status_monitor_loop, daemon=True)
        ]
        
        for t in threads:
            t.start()
            self._threads.append(t)
        
        print("System started successfully!")
        print("Press Ctrl+C to stop...\n")
        
        try:
            while self._running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

    def stop(self):
        print("\nStopping Edge Pest Monitoring System...")
        self._running = False
        
        for t in self._threads:
            t.join(timeout=5)
        
        self.device_manager.stop_monitor()
        self.synchronizer.stop()
        
        print("System stopped successfully!")
        sys.exit(0)


def main():
    monitor = EdgePestMonitor()
    monitor.start()


if __name__ == "__main__":
    main()
