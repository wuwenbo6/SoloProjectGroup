from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker
from typing import Dict, List, Optional
from datetime import datetime
import threading
from collections import deque

from hardware.typewriter_driver import TypewriterDriver
from capture.character_capture import CharacterCapture, CharacterCapture


class DeviceInfo:
    def __init__(self, device_id: str, driver: TypewriterDriver, name: str = None):
        self.device_id = device_id
        self.driver = driver
        self.name = name or f"设备 {device_id[-4:]}"
        self.capture: Optional[CharacterCapture] = None
        self.connected = False
        self.capturing = False
        self.last_activity = None
        self.total_characters = 0
        self.session_characters = 0
        self.model_type = "unknown"
        
    def to_dict(self) -> Dict:
        return {
            "device_id": self.device_id,
            "name": self.name,
            "connected": self.connected,
            "capturing": self.capturing,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "total_characters": self.total_characters,
            "session_characters": self.session_characters,
            "model_type": self.model_type
        }


class DevicePool(QObject):
    device_connected = pyqtSignal(str)
    device_disconnected = pyqtSignal(str)
    device_capture_started = pyqtSignal(str)
    device_capture_stopped = pyqtSignal(str)
    character_received = pyqtSignal(str, dict)
    pool_status_changed = pyqtSignal(dict)
    
    def __init__(self):
        super().__init__()
        self.mutex = QMutex()
        self.devices: Dict[str, DeviceInfo] = {}
        self.device_counter = 0
        self._setup_signals()
        
    def _setup_signals(self):
        pass
        
    def add_device(self, port: str, baudrate: int = 9600, name: str = None) -> Optional[str]:
        locker = QMutexLocker(self.mutex)
        
        self.device_counter += 1
        device_id = f"dev_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self.device_counter}"
        
        driver = TypewriterDriver()
        
        device_info = DeviceInfo(device_id, driver, name)
        
        driver.connection_status_changed.connect(
            lambda status, dev: self._on_connection_status_changed(device_id, status)
        )
        
        driver.data_received.connect(
            lambda data: self._on_data_received(device_id, data)
        )
        
        capture = CharacterCapture(driver)
        capture.character_captured.connect(
            lambda char_data: self._on_character_captured(device_id, char_data)
        )
        device_info.capture = capture
        
        self.devices[device_id] = device_info
        
        if driver.connect(port, baudrate):
            return device_id
        else:
            del self.devices[device_id]
            return None
            
    def remove_device(self, device_id: str) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return False
            
        device = self.devices[device_id]
        
        if device.capturing:
            device.capture.stop_capture()
            
        device.driver.disconnect()
        
        del self.devices[device_id]
        self.device_disconnected.emit(device_id)
        
        return True
        
    def get_device(self, device_id: str) -> Optional[DeviceInfo]:
        locker = QMutexLocker(self.mutex)
        return self.devices.get(device_id)
        
    def get_all_devices(self) -> List[Dict]:
        locker = QMutexLocker(self.mutex)
        return [dev.to_dict() for dev in self.devices.values()]
        
    def get_connected_devices(self) -> List[str]:
        locker = QMutexLocker(self.mutex)
        return [dev_id for dev_id, dev in self.devices.items() if dev.connected]
        
    def get_capturing_devices(self) -> List[str]:
        locker = QMutexLocker(self.mutex)
        return [dev_id for dev_id, dev in self.devices.items() if dev.capturing]
        
    def start_capture(self, device_id: str = None) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id:
            return self._start_single_capture(device_id)
        else:
            success = True
            for dev_id in self.devices:
                if not self._start_single_capture(dev_id):
                    success = False
            return success
            
    def _start_single_capture(self, device_id: str) -> bool:
        if device_id not in self.devices:
            return False
            
        device = self.devices[device_id]
        if not device.connected:
            return False
            
        if device.capture.start_capture():
            device.capturing = True
            device.session_characters = 0
            self.device_capture_started.emit(device_id)
            return True
            
        return False
        
    def stop_capture(self, device_id: str = None) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id:
            return self._stop_single_capture(device_id)
        else:
            success = True
            for dev_id in self.devices:
                if not self._stop_single_capture(dev_id):
                    success = False
            return success
            
    def _stop_single_capture(self, device_id: str) -> bool:
        if device_id not in self.devices:
            return False
            
        device = self.devices[device_id]
        device.capture.stop_capture()
        device.capturing = False
        self.device_capture_stopped.emit(device_id)
        return True
        
    def disconnect_device(self, device_id: str) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return False
            
        device = self.devices[device_id]
        
        if device.capturing:
            device.capture.stop_capture()
            
        device.driver.disconnect()
        return True
        
    def get_pool_status(self) -> Dict:
        locker = QMutexLocker(self.mutex)
        
        total = len(self.devices)
        connected = sum(1 for d in self.devices.values() if d.connected)
        capturing = sum(1 for d in self.devices.values() if d.capturing)
        total_chars = sum(d.total_characters for d in self.devices.values())
        
        return {
            "total_devices": total,
            "connected_devices": connected,
            "capturing_devices": capturing,
            "total_characters": total_chars,
            "devices": [dev.to_dict() for dev in self.devices.values()]
        }
        
    def get_combined_document(self) -> Dict[str, List]:
        locker = QMutexLocker(self.mutex)
        
        combined = {}
        for device_id, device in self.devices.items():
            if device.capture:
                doc = device.capture.get_current_document()
                combined[device_id] = doc
                
        return combined
        
    def clear_all_sessions(self):
        locker = QMutexLocker(self.mutex)
        
        for device in self.devices.values():
            if device.capture:
                device.capture.clear_current_document()
            device.session_characters = 0
            
    def _on_connection_status_changed(self, device_id: str, connected: bool):
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return
            
        device = self.devices[device_id]
        device.connected = connected
        
        if connected:
            device.last_activity = datetime.now()
            self.device_connected.emit(device_id)
        else:
            device.capturing = False
            self.device_disconnected.emit(device_id)
            
        self.pool_status_changed.emit(self.get_pool_status())
        
    def _on_data_received(self, device_id: str, data: bytes):
        pass
        
    def _on_character_captured(self, device_id: str, char_data: Dict):
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return
            
        device = self.devices[device_id]
        device.last_activity = datetime.now()
        device.total_characters += 1
        device.session_characters += 1
        
        char_data["device_id"] = device_id
        char_data["device_name"] = device.name
        
        self.character_received.emit(device_id, char_data)
        self.pool_status_changed.emit(self.get_pool_status())
        
    def set_device_name(self, device_id: str, name: str) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return False
            
        self.devices[device_id].name = name
        return True
        
    def set_device_model(self, device_id: str, model_type: str) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if device_id not in self.devices:
            return False
            
        self.devices[device_id].model_type = model_type
        return True
