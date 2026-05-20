import serial
import serial.tools.list_ports
from PyQt6.QtCore import QObject, pyqtSignal, QThread, QMutex, QMutexLocker
import time
from typing import List, Dict, Optional
from collections import deque


class TypewriterDriver(QObject):
    connection_status_changed = pyqtSignal(bool, str)
    data_received = pyqtSignal(bytes)
    error_occurred = pyqtSignal(str)
    reconnection_attempt = pyqtSignal(int)
    
    def __init__(self):
        super().__init__()
        self.serial_port: Optional[serial.Serial] = None
        self.is_connected_flag = False
        self.device_name = ""
        self.read_thread: Optional[ReadThread] = None
        self.mutex = QMutex()
        self.last_port = ""
        self.last_baudrate = 9600
        self.auto_reconnect = True
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 2000
        
    @staticmethod
    def get_available_ports() -> List[Dict[str, str]]:
        ports = []
        try:
            for port in serial.tools.list_ports.comports():
                ports.append({
                    "device": port.device,
                    "name": port.name,
                    "description": port.description,
                    "hwid": port.hwid
                })
        except Exception as e:
            print(f"获取端口列表失败: {e}")
        return ports
        
    def connect(self, port: str, baudrate: int = 9600, timeout: int = 2) -> bool:
        locker = QMutexLocker(self.mutex)
        try:
            self.disconnect()
            
            self.serial_port = serial.Serial(
                port=port,
                baudrate=baudrate,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                bytesize=serial.EIGHTBITS,
                timeout=timeout,
                write_timeout=2
            )
            
            if self.serial_port.is_open:
                self.is_connected_flag = True
                self.device_name = port
                self.last_port = port
                self.last_baudrate = baudrate
                
                self.read_thread = ReadThread(self.serial_port)
                self.read_thread.data_received.connect(self.data_received.emit)
                self.read_thread.connection_lost.connect(self._on_connection_lost)
                self.read_thread.start()
                
                self.connection_status_changed.emit(True, self.device_name)
                return True
                
        except serial.SerialException as e:
            self.error_occurred.emit(f"串口连接失败: {str(e)}")
        except Exception as e:
            self.error_occurred.emit(f"连接失败: {str(e)}")
        return False
            
    def disconnect(self):
        locker = QMutexLocker(self.mutex)
        self.is_connected_flag = False
        
        if self.read_thread and self.read_thread.isRunning():
            self.read_thread.stop()
            self.read_thread.wait(3000)
            self.read_thread = None
            
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.cancel_read()
                self.serial_port.close()
            except:
                pass
            self.serial_port = None
            
        self.device_name = ""
        self.connection_status_changed.emit(False, "")
        
    def is_connected(self) -> bool:
        locker = QMutexLocker(self.mutex)
        return self.is_connected_flag and self.serial_port and self.serial_port.is_open
        
    def send_command(self, command: bytes) -> bool:
        locker = QMutexLocker(self.mutex)
        if not self.is_connected_flag or not self.serial_port or not self.serial_port.is_open:
            self.error_occurred.emit("设备未连接")
            return False
            
        try:
            self.serial_port.write(command)
            self.serial_port.flush()
            return True
        except serial.SerialTimeoutException:
            self.error_occurred.emit("发送超时")
            return False
        except Exception as e:
            self.error_occurred.emit(f"发送失败: {str(e)}")
            return False
            
    def _on_connection_lost(self):
        self.is_connected_flag = False
        self.error_occurred.emit("连接中断")
        
        if self.auto_reconnect and self.last_port:
            self._attempt_reconnect()
        else:
            self.connection_status_changed.emit(False, "")
            
    def _attempt_reconnect(self):
        for attempt in range(1, self.max_reconnect_attempts + 1):
            self.reconnection_attempt.emit(attempt)
            time.sleep(self.reconnect_delay / 1000)
            
            if self._try_reconnect_once():
                self.error_occurred.emit(f"重连成功 (第{attempt}次)")
                return
                
        self.connection_status_changed.emit(False, "")
        self.error_occurred.emit(f"重连失败，已尝试{self.max_reconnect_attempts}次")
        
    def _try_reconnect_once(self) -> bool:
        try:
            self.serial_port = serial.Serial(
                port=self.last_port,
                baudrate=self.last_baudrate,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                bytesize=serial.EIGHTBITS,
                timeout=2,
                write_timeout=2
            )
            
            if self.serial_port.is_open:
                self.is_connected_flag = True
                self.read_thread = ReadThread(self.serial_port)
                self.read_thread.data_received.connect(self.data_received.emit)
                self.read_thread.connection_lost.connect(self._on_connection_lost)
                self.read_thread.start()
                self.connection_status_changed.emit(True, self.last_port)
                return True
        except:
            pass
        return False
        
    def get_device_info(self) -> Dict[str, str]:
        locker = QMutexLocker(self.mutex)
        return {
            "device": self.device_name,
            "baudrate": str(self.serial_port.baudrate) if self.serial_port else "",
            "status": "已连接" if self.is_connected_flag else "未连接"
        }


class ReadThread(QThread):
    data_received = pyqtSignal(bytes)
    error_occurred = pyqtSignal(str)
    connection_lost = pyqtSignal()
    
    def __init__(self, serial_port: serial.Serial):
        super().__init__()
        self.serial_port = serial_port
        self.running = False
        self.buffer = bytearray()
        self.mutex = QMutex()
        
    def run(self):
        self.running = True
        consecutive_errors = 0
        max_consecutive_errors = 10
        
        while self.running:
            try:
                if not self.serial_port.is_open:
                    break
                    
                if self.serial_port.in_waiting > 0:
                    data = self.serial_port.read(self.serial_port.in_waiting)
                    if data:
                        self.buffer.extend(data)
                        consecutive_errors = 0
                        self._process_buffer()
                else:
                    time.sleep(0.005)
                    
            except serial.SerialException as e:
                consecutive_errors += 1
                if consecutive_errors >= max_consecutive_errors:
                    self.connection_lost.emit()
                    break
                time.sleep(0.1)
            except Exception as e:
                consecutive_errors += 1
                if consecutive_errors >= max_consecutive_errors:
                    self.connection_lost.emit()
                    break
                time.sleep(0.1)
                
    def _process_buffer(self):
        while True:
            newline_pos = self.buffer.find(b'\n')
            return_pos = self.buffer.find(b'\r')
            
            delimiter_pos = -1
            delimiter_len = 1
            
            if newline_pos != -1 and return_pos != -1:
                if newline_pos < return_pos:
                    delimiter_pos = newline_pos
                else:
                    delimiter_pos = return_pos
            elif newline_pos != -1:
                delimiter_pos = newline_pos
            elif return_pos != -1:
                delimiter_pos = return_pos
            else:
                if len(self.buffer) > 1024:
                    self.data_received.emit(bytes(self.buffer))
                    self.buffer.clear()
                break
                
            if delimiter_pos >= 0:
                line = bytes(self.buffer[:delimiter_pos])
                self.buffer = self.buffer[delimiter_pos + delimiter_len:]
                
                while len(self.buffer) > 0 and self.buffer[0] in [10, 13]:
                    self.buffer.pop(0)
                    
                if line:
                    self.data_received.emit(line)
                
    def stop(self):
        self.running = False
