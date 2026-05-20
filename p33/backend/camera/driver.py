from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import serial.tools.list_ports
import usb.core
import usb.util
from typing import List, Optional
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class CameraDevice(BaseModel):
    id: str
    name: str
    connection_type: str
    port: Optional[str] = None
    vendor_id: Optional[str] = None
    product_id: Optional[str] = None
    is_film_camera: bool = False


class CameraCommand(BaseModel):
    device_id: str
    command: str
    params: Optional[dict] = None


class CameraManager:
    def __init__(self):
        self.connected_devices = {}
        self.current_device = None
        self.connection_lock = False
        self.retry_count = 3
        self.retry_delay = 0.5
        self.film_camera_vendors = {
            '04b0': 'Nikon', '04a9': 'Canon', '045e': 'Microsoft',
            '054c': 'Sony', '0425': 'Pentax', '046d': 'Logitech',
            '03f0': 'HP', '067b': 'Prolific', '0403': 'FTDI'
        }

    def is_film_camera(self, vendor_id: str, product_id: str, description: str = "") -> bool:
        if vendor_id and vendor_id.lower() in self.film_camera_vendors:
            return True
        film_keywords = ['camera', 'scanner', 'film', '胶片', 'scan', 'photo', 'canon', 'nikon']
        desc_lower = description.lower()
        return any(keyword in desc_lower for keyword in film_keywords)

    def list_serial_ports(self) -> List[CameraDevice]:
        devices = []
        try:
            ports = serial.tools.list_ports.comports()
            for port in ports:
                vendor_id = f"{port.vid:04x}" if port.vid else None
                product_id = f"{port.pid:04x}" if port.pid else None
                is_film = self.is_film_camera(vendor_id or "", product_id or "", port.description)
                devices.append(CameraDevice(
                    id=f"serial_{port.device}",
                    name=f"{port.description}",
                    connection_type="serial",
                    port=port.device,
                    vendor_id=vendor_id,
                    product_id=product_id,
                    is_film_camera=is_film
                ))
        except Exception as e:
            logger.error(f"Serial port enumeration error: {e}")
        return devices

    def list_usb_devices(self) -> List[CameraDevice]:
        devices = []
        try:
            usb_devices = usb.core.find(find_all=True)
            for dev in usb_devices:
                try:
                    vendor_id = f"{dev.idVendor:04x}"
                    product_id = f"{dev.idProduct:04x}"
                    manufacturer = usb.util.get_string(dev, dev.iManufacturer) if dev.iManufacturer else "Unknown"
                    product = usb.util.get_string(dev, dev.iProduct) if dev.iProduct else "Unknown"
                    
                    is_film = self.is_film_camera(vendor_id, product_id, f"{manufacturer} {product}")
                    
                    devices.append(CameraDevice(
                        id=f"usb_{vendor_id}_{product_id}",
                        name=f"{manufacturer} {product}",
                        connection_type="usb",
                        vendor_id=vendor_id,
                        product_id=product_id,
                        is_film_camera=is_film
                    ))
                except usb.core.USBError as e:
                    if e.errno != 13:
                        logger.warning(f"USB device access error: {e}")
                    continue
                except Exception as e:
                    logger.debug(f"USB device info error: {e}")
                    continue
        except usb.core.USBError as e:
            logger.error(f"USB permission error: {e}")
        except Exception as e:
            logger.error(f"USB enumeration error: {e}")
        return devices

    def get_all_devices(self) -> List[CameraDevice]:
        try:
            serial_devices = self.list_serial_ports()
            usb_devices = self.list_usb_devices()
            all_devices = serial_devices + usb_devices
            return sorted(all_devices, key=lambda x: (not x.is_film_camera, x.name))
        except Exception as e:
            logger.error(f"Device listing error: {e}")
            return []

    def connect_device(self, device_id: str) -> bool:
        if self.connection_lock:
            logger.warning("Connection already in progress")
            return False
            
        self.connection_lock = True
        try:
            for attempt in range(self.retry_count):
                try:
                    if device_id.startswith("serial_"):
                        port = device_id.replace("serial_", "")
                        baud_rates = [9600, 19200, 38400, 57600, 115200]
                        
                        for baud in baud_rates:
                            try:
                                ser = serial.Serial(port, baud, timeout=3)
                                if ser.is_open:
                                    self.current_device = ser
                                    self.connected_devices[device_id] = ser
                                    logger.info(f"Connected to serial port {port} at {baud} baud")
                                    return True
                            except:
                                continue
                        
                        logger.warning(f"Failed to connect to serial port {port}")
                        
                    elif device_id.startswith("usb_"):
                        parts = device_id.replace("usb_", "").split("_")
                        vendor_id = int(parts[0], 16)
                        product_id = int(parts[1], 16)
                        
                        dev = usb.core.find(idVendor=vendor_id, idProduct=product_id)
                        if dev is None:
                            logger.warning(f"USB device {vendor_id:04x}:{product_id:04x} not found")
                            return False
                        
                        try:
                            if dev.is_kernel_driver_active(0):
                                dev.detach_kernel_driver(0)
                        except:
                            pass
                        
                        dev.set_configuration()
                        usb.util.claim_interface(dev, 0)
                        self.current_device = dev
                        self.connected_devices[device_id] = dev
                        logger.info(f"Connected to USB device {vendor_id:04x}:{product_id:04x}")
                        return True
                        
                except Exception as e:
                    logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                    if attempt < self.retry_count - 1:
                        time.sleep(self.retry_delay)
                        
            return False
        finally:
            self.connection_lock = False

    def disconnect_device(self, device_id: str) -> bool:
        try:
            if device_id in self.connected_devices:
                dev = self.connected_devices[device_id]
                try:
                    if hasattr(dev, 'close'):
                        dev.close()
                    elif hasattr(dev, 'dispose'):
                        usb.util.release_interface(dev, 0)
                        usb.util.dispose_resources(dev)
                except Exception as e:
                    logger.warning(f"Cleanup error: {e}")
                
                del self.connected_devices[device_id]
                if self.current_device == dev:
                    self.current_device = None
                logger.info(f"Disconnected device: {device_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Disconnect error: {e}")
            return False

    def send_command(self, device_id: str, command: str, params: dict = None):
        if device_id not in self.connected_devices:
            raise HTTPException(status_code=400, detail="设备未连接")
        
        dev = self.connected_devices[device_id]
        try:
            if hasattr(dev, 'write'):
                cmd_str = f"{command}\n"
                if params:
                    for k, v in params.items():
                        cmd_str += f"{k}:{v}\n"
                
                dev.flushInput()
                dev.flushOutput()
                dev.write(cmd_str.encode())
                
                response_lines = []
                timeout = time.time() + 5
                while time.time() < timeout:
                    if dev.in_waiting > 0:
                        line = dev.readline().decode().strip()
                        if line:
                            response_lines.append(line)
                        if 'OK' in line or 'END' in line:
                            break
                
                response = '\n'.join(response_lines)
                return {"status": "success", "response": response}
            else:
                return {"status": "success", "message": "USB命令发送"}
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            raise HTTPException(status_code=500, detail=f"命令执行失败: {str(e)}")


camera_manager = CameraManager()


@router.get("/devices")
async def list_devices():
    devices = camera_manager.get_all_devices()
    return {"devices": devices}


@router.post("/connect")
async def connect_device(device_id: str):
    success = camera_manager.connect_device(device_id)
    if success:
        return {"status": "connected", "device_id": device_id}
    raise HTTPException(status_code=400, detail="连接失败")


@router.post("/disconnect")
async def disconnect_device(device_id: str):
    success = camera_manager.disconnect_device(device_id)
    if success:
        return {"status": "disconnected"}
    raise HTTPException(status_code=400, detail="断开连接失败")


@router.post("/command")
async def send_camera_command(cmd: CameraCommand):
    result = camera_manager.send_command(cmd.device_id, cmd.command, cmd.params or {})
    return result


@router.get("/status")
async def get_camera_status():
    connected = list(camera_manager.connected_devices.keys())
    return {
        "connected_devices": connected,
        "has_active_connection": len(connected) > 0
    }
