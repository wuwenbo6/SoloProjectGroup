import time
import threading
from typing import Dict, List, Callable
from dataclasses import dataclass
from enum import Enum


class DeviceType(Enum):
    CAMERA = "camera"
    AUDIO = "audio"
    LIGHT_TRAP = "light_trap"
    SENSOR = "sensor"


class DeviceStatus(Enum):
    OFFLINE = "offline"
    ONLINE = "online"
    BUSY = "busy"
    ERROR = "error"


@dataclass
class DeviceInfo:
    device_id: str
    device_type: DeviceType
    name: str
    location: str
    status: DeviceStatus
    last_heartbeat: float
    config: Dict


class DeviceManager:
    def __init__(self):
        self.devices: Dict[str, DeviceInfo] = {}
        self.callbacks: List[Callable] = []
        self.heartbeat_interval = 30
        self._running = False
        self._monitor_thread = None

    def register_device(self, device_id: str, device_type: DeviceType, 
                       name: str, location: str, config: Dict = None) -> bool:
        if device_id in self.devices:
            return False
        
        self.devices[device_id] = DeviceInfo(
            device_id=device_id,
            device_type=device_type,
            name=name,
            location=location,
            status=DeviceStatus.ONLINE,
            last_heartbeat=time.time(),
            config=config or {}
        )
        self._notify_device_change(device_id, "registered")
        return True

    def unregister_device(self, device_id: str) -> bool:
        if device_id not in self.devices:
            return False
        del self.devices[device_id]
        self._notify_device_change(device_id, "unregistered")
        return True

    def update_heartbeat(self, device_id: str) -> bool:
        if device_id not in self.devices:
            return False
        self.devices[device_id].last_heartbeat = time.time()
        if self.devices[device_id].status == DeviceStatus.OFFLINE:
            self.devices[device_id].status = DeviceStatus.ONLINE
            self._notify_device_change(device_id, "online")
        return True

    def set_device_status(self, device_id: str, status: DeviceStatus) -> bool:
        if device_id not in self.devices:
            return False
        old_status = self.devices[device_id].status
        self.devices[device_id].status = status
        if old_status != status:
            self._notify_device_change(device_id, f"status_{status.value}")
        return True

    def get_device(self, device_id: str) -> DeviceInfo:
        return self.devices.get(device_id)

    def get_devices_by_type(self, device_type: DeviceType) -> List[DeviceInfo]:
        return [d for d in self.devices.values() if d.device_type == device_type]

    def get_online_devices(self) -> List[DeviceInfo]:
        return [d for d in self.devices.values() if d.status == DeviceStatus.ONLINE]

    def start_monitor(self):
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def stop_monitor(self):
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join()

    def _monitor_loop(self):
        while self._running:
            now = time.time()
            for device_id, device in self.devices.items():
                if now - device.last_heartbeat > self.heartbeat_interval * 2:
                    if device.status != DeviceStatus.OFFLINE:
                        device.status = DeviceStatus.OFFLINE
                        self._notify_device_change(device_id, "offline")
            time.sleep(self.heartbeat_interval)

    def add_device_callback(self, callback: Callable):
        self.callbacks.append(callback)

    def _notify_device_change(self, device_id: str, event: str):
        for callback in self.callbacks:
            try:
                callback(device_id, event)
            except Exception as e:
                print(f"Device callback error: {e}")
