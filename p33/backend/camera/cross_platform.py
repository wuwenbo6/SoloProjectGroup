import sys
import platform
import subprocess
import threading
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from abc import ABC, abstractmethod
import logging

from ..utils.common import SingletonMeta, get_platform_info, event_bus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class CameraDeviceInfo:
    device_id: str
    name: str
    manufacturer: str
    model: str
    serial_number: Optional[str]
    port: Optional[str]
    connection_type: str
    is_connected: bool = False
    driver_version: Optional[str] = None
    capabilities: List[str] = None


@dataclass
class DriverStatus:
    driver_name: str
    is_installed: bool
    version: Optional[str]
    is_compatible: bool
    error_message: Optional[str] = None


class BaseCameraDriver(ABC):
    def __init__(self):
        self.is_initialized = False
        self.devices: Dict[str, CameraDeviceInfo] = {}

    @abstractmethod
    def initialize(self) -> bool:
        pass

    @abstractmethod
    def list_devices(self) -> List[CameraDeviceInfo]:
        pass

    @abstractmethod
    def connect(self, device_id: str) -> bool:
        pass

    @abstractmethod
    def disconnect(self, device_id: str) -> bool:
        pass

    @abstractmethod
    def get_status(self, device_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        pass


class WindowsCameraDriver(BaseCameraDriver):
    def __init__(self):
        super().__init__()
        self.wmi = None

    def initialize(self) -> bool:
        try:
            import wmi
            self.wmi = wmi.WMI()
            self.is_initialized = True
            logger.info("Windows WMI 驱动初始化成功")
            return True
        except ImportError:
            logger.warning("WMI 模块未安装，使用备用方式")
            self.is_initialized = True
            return True
        except Exception as e:
            logger.error(f"Windows 驱动初始化失败: {e}")
            return False

    def list_devices(self) -> List[CameraDeviceInfo]:
        devices = []
        try:
            if self.wmi:
                for cam in self.wmi.Win32_PnPEntity():
                    if cam.Name and ('camera' in cam.Name.lower() or '影像' in cam.Name.lower()):
                        devices.append(CameraDeviceInfo(
                            device_id=f"win_{cam.DeviceID}",
                            name=cam.Name,
                            manufacturer=cam.Manufacturer or "Unknown",
                            model=cam.Name,
                            serial_number=None,
                            port=None,
                            connection_type="USB/WPD",
                            driver_version=getattr(cam, 'DriverVersion', None)
                        ))

            if not devices:
                result = subprocess.run(
                    ['powershell', '-Command', 'Get-PnpDevice -Class Camera'],
                    capture_output=True, text=True, timeout=10
                )
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if 'USB' in line and 'Camera' in line.lower():
                            devices.append(CameraDeviceInfo(
                                device_id=f"win_cam_{len(devices)}",
                                name=line.strip(),
                                manufacturer="Unknown",
                                model="Windows Camera",
                                serial_number=None,
                                port=None,
                                connection_type="USB"
                            ))
        except Exception as e:
            logger.error(f"Windows 设备枚举失败: {e}")

        return devices

    def connect(self, device_id: str) -> bool:
        logger.info(f"Windows 连接设备: {device_id}")
        event_bus.emit('device_connected', {'device_id': device_id, 'platform': 'windows'})
        return True

    def disconnect(self, device_id: str) -> bool:
        logger.info(f"Windows 断开设备: {device_id}")
        event_bus.emit('device_disconnected', {'device_id': device_id})
        return True

    def get_status(self, device_id: str) -> Dict[str, Any]:
        return {'device_id': device_id, 'status': 'ready', 'platform': 'windows'}

    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        logger.debug(f"Windows 设备命令: {device_id} {command}")
        return {'status': 'success', 'command': command}


class MacOSCameraDriver(BaseCameraDriver):
    def __init__(self):
        super().__init__()
        self.avfoundation = None

    def initialize(self) -> bool:
        try:
            import objc
            self.is_initialized = True
            logger.info("macOS AVFoundation 驱动初始化成功")
            return True
        except ImportError:
            logger.warning("PyObjC 模块未安装，使用备用方式")
            self.is_initialized = True
            return True
        except Exception as e:
            logger.error(f"macOS 驱动初始化失败: {e}")
            return False

    def list_devices(self) -> List[CameraDeviceInfo]:
        devices = []
        try:
            result = subprocess.run(
                ['system_profiler', 'SPCameraDataType'],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                current_device = None
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith(':'):
                        if 'Camera' in line or 'camera' in line:
                            if current_device:
                                devices.append(current_device)
                            current_device = CameraDeviceInfo(
                                device_id=f"mac_cam_{len(devices)}",
                                name=line,
                                manufacturer="Apple",
                                model=line,
                                serial_number=None,
                                port=None,
                                connection_type="Built-in/USB"
                            )
                if current_device:
                    devices.append(current_device)

            if not devices:
                devices.append(CameraDeviceInfo(
                    device_id="mac_default_0",
                    name="默认相机",
                    manufacturer="Apple",
                    model="Unknown",
                    serial_number=None,
                    port=None,
                    connection_type="System"
                ))

        except Exception as e:
            logger.error(f"macOS 设备枚举失败: {e}")

        return devices

    def connect(self, device_id: str) -> bool:
        logger.info(f"macOS 连接设备: {device_id}")
        event_bus.emit('device_connected', {'device_id': device_id, 'platform': 'macos'})
        return True

    def disconnect(self, device_id: str) -> bool:
        logger.info(f"macOS 断开设备: {device_id}")
        event_bus.emit('device_disconnected', {'device_id': device_id})
        return True

    def get_status(self, device_id: str) -> Dict[str, Any]:
        return {'device_id': device_id, 'status': 'ready', 'platform': 'macos'}

    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        logger.debug(f"macOS 设备命令: {device_id} {command}")
        return {'status': 'success', 'command': command}


class LinuxCameraDriver(BaseCameraDriver):
    def __init__(self):
        super().__init__()

    def initialize(self) -> bool:
        try:
            result = subprocess.run(['v4l2-ctl', '--version'], capture_output=True, timeout=5)
            if result.returncode == 0:
                logger.info("Linux V4L2 驱动可用")
            self.is_initialized = True
            return True
        except Exception as e:
            logger.warning(f"V4L2 不可用: {e}，使用通用模式")
            self.is_initialized = True
            return True

    def list_devices(self) -> List[CameraDeviceInfo]:
        devices = []
        try:
            import os
            video_devices = [f for f in os.listdir('/dev') if f.startswith('video')]

            for dev in video_devices:
                try:
                    result = subprocess.run(
                        ['v4l2-ctl', '-d', f'/dev/{dev}', '--info'],
                        capture_output=True, text=True, timeout=5
                    )
                    if result.returncode == 0:
                        card_name = "Unknown"
                        for line in result.stdout.split('\n'):
                            if 'Card type' in line or '卡片类型' in line:
                                card_name = line.split(':')[-1].strip()
                                break

                        devices.append(CameraDeviceInfo(
                            device_id=f"linux_{dev}",
                            name=card_name,
                            manufacturer="V4L2 Device",
                            model=card_name,
                            serial_number=None,
                            port=f'/dev/{dev}',
                            connection_type="V4L2"
                        ))
                except:
                    continue

            if not devices and video_devices:
                for dev in video_devices:
                    devices.append(CameraDeviceInfo(
                        device_id=f"linux_{dev}",
                        name=f"Video Device {dev}",
                        manufacturer="Linux V4L2",
                        model="Generic Camera",
                        serial_number=None,
                        port=f'/dev/{dev}',
                        connection_type="V4L2"
                    ))

        except Exception as e:
            logger.error(f"Linux 设备枚举失败: {e}")

        return devices

    def connect(self, device_id: str) -> bool:
        logger.info(f"Linux 连接设备: {device_id}")
        event_bus.emit('device_connected', {'device_id': device_id, 'platform': 'linux'})
        return True

    def disconnect(self, device_id: str) -> bool:
        logger.info(f"Linux 断开设备: {device_id}")
        event_bus.emit('device_disconnected', {'device_id': device_id})
        return True

    def get_status(self, device_id: str) -> Dict[str, Any]:
        return {'device_id': device_id, 'status': 'ready', 'platform': 'linux'}

    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        logger.debug(f"Linux 设备命令: {device_id} {command}")
        return {'status': 'success', 'command': command}


class FallbackCameraDriver(BaseCameraDriver):
    def initialize(self) -> bool:
        self.is_initialized = True
        logger.info("备用驱动初始化成功")
        return True

    def list_devices(self) -> List[CameraDeviceInfo]:
        return [
            CameraDeviceInfo(
                device_id="fallback_0",
                name="通用相机设备",
                manufacturer="通用",
                model="Fallback Camera",
                serial_number=None,
                port=None,
                connection_type="模拟"
            )
        ]

    def connect(self, device_id: str) -> bool:
        logger.info(f"备用驱动连接设备: {device_id}")
        return True

    def disconnect(self, device_id: str) -> bool:
        logger.info(f"备用驱动断开设备: {device_id}")
        return True

    def get_status(self, device_id: str) -> Dict[str, Any]:
        return {'device_id': device_id, 'status': 'ready', 'platform': 'fallback'}

    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        return {'status': 'success', 'command': command}


class CrossPlatformCameraManager(metaclass=SingletonMeta):
    def __init__(self):
        self.platform_info = get_platform_info()
        self.driver: Optional[BaseCameraDriver] = None
        self.connected_devices: Dict[str, CameraDeviceInfo] = {}
        self._initialized = False
        self._lock = threading.Lock()

    def initialize(self) -> bool:
        with self._lock:
            if self._initialized:
                return True

            platform_system = self.platform_info['system']

            driver_classes = {
                'win32': WindowsCameraDriver,
                'darwin': MacOSCameraDriver,
                'linux': LinuxCameraDriver
            }

            driver_class = driver_classes.get(platform_system, FallbackCameraDriver)

            try:
                self.driver = driver_class()
                if self.driver.initialize():
                    self._initialized = True
                    logger.info(f"{platform_system} 平台驱动初始化成功")
                    return True
            except Exception as e:
                logger.warning(f"主驱动初始化失败，使用备用驱动: {e}")

            self.driver = FallbackCameraDriver()
            self.driver.initialize()
            self._initialized = True
            return True

    def list_devices(self) -> List[CameraDeviceInfo]:
        if not self._initialized and not self.initialize():
            return []

        try:
            devices = self.driver.list_devices()
            for dev in devices:
                if dev.device_id in self.connected_devices:
                    dev.is_connected = True
            return devices
        except Exception as e:
            logger.error(f"设备列表获取失败: {e}")
            return []

    def connect(self, device_id: str) -> bool:
        if not self._initialized:
            self.initialize()

        with self._lock:
            try:
                if self.driver.connect(device_id):
                    devices = self.driver.list_devices()
                    for dev in devices:
                        if dev.device_id == device_id:
                            dev.is_connected = True
                            self.connected_devices[device_id] = dev
                            break
                    return True
                return False
            except Exception as e:
                logger.error(f"设备连接失败: {e}")
                return False

    def disconnect(self, device_id: str) -> bool:
        with self._lock:
            try:
                if self.driver.disconnect(device_id):
                    if device_id in self.connected_devices:
                        del self.connected_devices[device_id]
                    return True
                return False
            except Exception as e:
                logger.error(f"设备断开失败: {e}")
                return False

    def get_device_status(self, device_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.driver.get_status(device_id)
        except Exception as e:
            logger.error(f"获取设备状态失败: {e}")
            return None

    def send_command(self, device_id: str, command: str, **kwargs) -> Any:
        try:
            return self.driver.send_command(device_id, command, **kwargs)
        except Exception as e:
            logger.error(f"发送命令失败: {e}")
            return None

    def get_driver_status(self) -> DriverStatus:
        driver_name = type(self.driver).__name__ if self.driver else "None"
        return DriverStatus(
            driver_name=driver_name,
            is_installed=self._initialized,
            version="1.0.0",
            is_compatible=self._initialized,
            error_message=None
        )

    def get_all_status(self) -> Dict[str, Any]:
        return {
            'platform': self.platform_info,
            'driver': self.get_driver_status().__dict__,
            'connected_devices': len(self.connected_devices),
            'device_list': [dev.__dict__ for dev in self.connected_devices.values()]
        }


camera_manager = CrossPlatformCameraManager()
