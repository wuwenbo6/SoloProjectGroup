from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import platform
import sys
import os
import time


@dataclass
class PortInfo:
    __slots__ = ['device', 'name', 'description', 'vendor_id', 'product_id', 'serial_number']
    device: str
    name: str
    description: str
    vendor_id: str
    product_id: str
    serial_number: str


@dataclass
class PlatformConfig:
    __slots__ = ['os_name', 'baud_rates', 'data_bits', 'stop_bits', 'parity', 
                 'flow_control', 'buffer_size', 'timeout_ms']
    os_name: str
    baud_rates: List[int]
    data_bits: List[int]
    stop_bits: List[int]
    parity: List[str]
    flow_control: List[str]
    buffer_size: int
    timeout_ms: int


class PlatformDetector:
    WINDOWS_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400]
    MACOS_BAUD_RATES = [9600, 19200, 38400, 57600, 115200]
    LINUX_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800]

    @staticmethod
    def get_os_name() -> str:
        return platform.system()

    @staticmethod
    def is_windows() -> bool:
        return platform.system() == 'Windows'

    @staticmethod
    def is_macos() -> bool:
        return platform.system() == 'Darwin'

    @staticmethod
    def is_linux() -> bool:
        return platform.system() == 'Linux'

    @classmethod
    def get_config(cls) -> PlatformConfig:
        os_name = cls.get_os_name()

        if os_name == 'Windows':
            return PlatformConfig(
                os_name='Windows',
                baud_rates=cls.WINDOWS_BAUD_RATES,
                data_bits=[7, 8],
                stop_bits=[1, 2],
                parity=['N', 'E', 'O'],
                flow_control=['None', 'XON/XOFF', 'RTS/CTS'],
                buffer_size=4096,
                timeout_ms=2000
            )
        elif os_name == 'Darwin':
            return PlatformConfig(
                os_name='macOS',
                baud_rates=cls.MACOS_BAUD_RATES,
                data_bits=[8],
                stop_bits=[1, 2],
                parity=['N'],
                flow_control=['None', 'RTS/CTS'],
                buffer_size=8192,
                timeout_ms=3000
            )
        else:
            return PlatformConfig(
                os_name='Linux',
                baud_rates=cls.LINUX_BAUD_RATES,
                data_bits=[7, 8],
                stop_bits=[1, 2],
                parity=['N', 'E', 'O'],
                flow_control=['None', 'XON/XOFF', 'RTS/CTS'],
                buffer_size=8192,
                timeout_ms=3000
            )


class SerialPortScanner(QObject):
    scan_completed = pyqtSignal(list)
    scan_error = pyqtSignal(str)

    TYPEWRITER_VENDORS = {
        '0403': 'FTDI - USB Serial Converter',
        '067B': 'Prolific - USB-Serial Controller',
        '2341': 'Arduino',
        '1A86': 'QinHeng Electronics - CH340',
        '0483': 'STMicroelectronics',
    }

    def __init__(self):
        super().__init__()
        self._mutex = QMutex()
        self._scanning = False

    def scan_ports(self) -> List[PortInfo]:
        locker = QMutexLocker(self._mutex)
        
        if self._scanning:
            return []

        self._scanning = True

        try:
            ports = self._scan()
            self.scan_completed.emit(ports)
            return ports
        except Exception as e:
            self.scan_error.emit(str(e))
            return []
        finally:
            self._scanning = False

    def _scan(self) -> List[PortInfo]:
        os_name = PlatformDetector.get_os_name()
        
        if os_name == 'Windows':
            return self._scan_windows()
        elif os_name == 'Darwin':
            return self._scan_macos()
        else:
            return self._scan_linux()

    def _scan_windows(self) -> List[PortInfo]:
        ports = []
        try:
            import serial.tools.list_ports
            for port in serial.tools.list_ports.comports():
                ports.append(PortInfo(
                    device=port.device,
                    name=port.name or '',
                    description=port.description or '',
                    vendor_id=f'{port.vid:04X}' if port.vid else '',
                    product_id=f'{port.pid:04X}' if port.pid else '',
                    serial_number=port.serial_number or ''
                ))
        except ImportError:
            for i in range(1, 257):
                device = f'COM{i}'
                ports.append(PortInfo(
                    device=device,
                    name=device,
                    description=f'Serial Port {i}',
                    vendor_id='',
                    product_id='',
                    serial_number=''
                ))
        return ports

    def _scan_macos(self) -> List[PortInfo]:
        ports = []
        try:
            import serial.tools.list_ports
            for port in serial.tools.list_ports.comports():
                if 'tty.' in port.device or 'cu.' in port.device:
                    ports.append(PortInfo(
                        device=port.device,
                        name=port.name or port.device.split('/')[-1],
                        description=port.description or '',
                        vendor_id=f'{port.vid:04X}' if port.vid else '',
                        product_id=f'{port.pid:04X}' if port.pid else '',
                        serial_number=port.serial_number or ''
                    ))
        except ImportError:
            dev_dir = '/dev'
            for device in os.listdir(dev_dir):
                if device.startswith('tty.') or device.startswith('cu.'):
                    if 'serial' in device.lower() or 'usb' in device.lower():
                        ports.append(PortInfo(
                            device=f'{dev_dir}/{device}',
                            name=device,
                            description='USB Serial Port',
                            vendor_id='',
                            product_id='',
                            serial_number=''
                        ))
        return ports

    def _scan_linux(self) -> List[PortInfo]:
        ports = []
        try:
            import serial.tools.list_ports
            for port in serial.tools.list_ports.comports():
                ports.append(PortInfo(
                    device=port.device,
                    name=port.name or port.device.split('/')[-1],
                    description=port.description or '',
                    vendor_id=f'{port.vid:04X}' if port.vid else '',
                    product_id=f'{port.pid:04X}' if port.pid else '',
                    serial_number=port.serial_number or ''
                ))
        except ImportError:
            for device in ['ttyUSB0', 'ttyUSB1', 'ttyS0', 'ttyACM0']:
                device_path = f'/dev/{device}'
                if os.path.exists(device_path):
                    ports.append(PortInfo(
                        device=device_path,
                        name=device,
                        description='Serial Port',
                        vendor_id='',
                        product_id='',
                        serial_number=''
                    ))
        return ports

    def detect_typewriter_ports(self) -> List[Tuple[PortInfo, str]]:
        detected = []
        ports = self.scan_ports()

        for port in ports:
            vendor_name = self.TYPEWRITER_VENDORS.get(port.vendor_id, '')
            if vendor_name:
                detected.append((port, vendor_name))
            elif 'typewriter' in port.description.lower() or \
                 'serial' in port.description.lower() or \
                 'usb' in port.description.lower():
                detected.append((port, 'Unknown Typewriter Adapter'))

        return detected


class SerialPortConfigOptimizer:
    @staticmethod
    def get_recommended_config(port_info: PortInfo) -> Dict:
        os_name = PlatformDetector.get_os_name()
        config = PlatformDetector.get_config()

        base_config = {
            'baudrate': 9600,
            'bytesize': 8,
            'parity': 'N',
            'stopbits': 1,
            'timeout': config.timeout_ms / 1000,
            'xonxoff': False,
            'rtscts': False,
            'dsrdtr': False
        }

        if 'CH340' in port_info.description or port_info.vendor_id == '1A86':
            base_config.update({
                'baudrate': 9600,
                'timeout': 3.0
            })
        elif 'FTDI' in port_info.description or port_info.vendor_id == '0403':
            base_config.update({
                'baudrate': 19200,
                'timeout': 2.0
            })
        elif 'Arduino' in port_info.description:
            base_config.update({
                'baudrate': 115200,
                'timeout': 1.0
            })

        if os_name == 'Darwin':
            base_config['timeout'] = max(base_config['timeout'], 3.0)

        return base_config

    @staticmethod
    def get_fallback_configs() -> List[Dict]:
        configs = []
        base = {
            'bytesize': 8,
            'parity': 'N',
            'stopbits': 1,
            'timeout': 3.0
        }

        for baudrate in [9600, 19200, 38400, 57600, 115200]:
            config = base.copy()
            config['baudrate'] = baudrate
            configs.append(config)

        return configs


class ConnectionRetryManager:
    def __init__(self, max_retries: int = 5, initial_delay: float = 1.0):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.retry_count = 0
        self._mutex = QMutex()

    def should_retry(self) -> bool:
        locker = QMutexLocker(self._mutex)
        return self.retry_count < self.max_retries

    def get_delay(self) -> float:
        locker = QMutexLocker(self._mutex)
        return self.initial_delay * (2 ** self.retry_count)

    def record_retry(self):
        locker = QMutexLocker(self._mutex)
        self.retry_count += 1

    def reset(self):
        locker = QMutexLocker(self._mutex)
        self.retry_count = 0

    def get_progress(self) -> float:
        locker = QMutexLocker(self._mutex)
        return self.retry_count / self.max_retries if self.max_retries > 0 else 1.0
