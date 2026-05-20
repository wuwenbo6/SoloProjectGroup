import serial
import usb.core
import usb.util
import logging
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum
import time
import threading


class ProjectorModel(Enum):
    BELL_HOWELL_16MM = "BellHowell_16mm"
    KODAK_PAGEANT = "Kodak_Pageant"
    EUMIG_SUPER8 = "Eumig_Super8"
    BAUER_T1 = "Bauer_T1"
    UNKNOWN = "Unknown"


class ConnectionType(Enum):
    USB = "USB"
    SERIAL = "Serial"
    BOTH = "Both"


@dataclass
class ProjectorInfo:
    model: ProjectorModel
    connection_type: ConnectionType
    vendor_id: Optional[int] = None
    product_id: Optional[int] = None
    serial_port: Optional[str] = None
    baud_rate: int = 9600
    protocol_version: str = "1.0"
    status: str = "Disconnected"


@dataclass
class DeviceStatus:
    is_connected: bool
    motor_speed: float
    lamp_brightness: int
    film_position: int
    temperature: float
    error_code: int = 0
    error_message: str = ""


class ProtocolHandler:
    def __init__(self, model: ProjectorModel):
        self.model = model
        self.logger = logging.getLogger(f"Protocol_{model.value}")

    def create_command(self, cmd_type: str, **kwargs) -> bytes:
        if self.model == ProjectorModel.BELL_HOWELL_16MM:
            return self._bell_howell_command(cmd_type, **kwargs)
        elif self.model == ProjectorModel.KODAK_PAGEANT:
            return self._kodak_pageant_command(cmd_type, **kwargs)
        elif self.model == ProjectorModel.EUMIG_SUPER8:
            return self._eumig_super8_command(cmd_type, **kwargs)
        elif self.model == ProjectorModel.BAUER_T1:
            return self._bauer_t1_command(cmd_type, **kwargs)
        else:
            return self._generic_command(cmd_type, **kwargs)

    def _bell_howell_command(self, cmd_type: str, **kwargs) -> bytes:
        commands = {
            "CONNECT": b"\x02\x01\x00\x03",
            "DISCONNECT": b"\x02\x02\x00\x03",
            "START_MOTOR": b"\x02\x03\x01\x03",
            "STOP_MOTOR": b"\x02\x03\x00\x03",
            "SET_SPEED": lambda: f"\x02\x04{kwargs.get('speed', 18):02x}\x03".encode(),
            "GET_STATUS": b"\x02\x05\x00\x03",
            "LAMP_ON": b"\x02\x06\x01\x03",
            "LAMP_OFF": b"\x02\x06\x00\x03",
        }
        cmd = commands.get(cmd_type)
        if callable(cmd):
            return cmd()
        return cmd if cmd else b""

    def _kodak_pageant_command(self, cmd_type: str, **kwargs) -> bytes:
        commands = {
            "CONNECT": b"\xFF\x01\x00\xFF",
            "DISCONNECT": b"\xFF\x02\x00\xFF",
            "START_MOTOR": b"\xFF\x03\x01\xFF",
            "STOP_MOTOR": b"\xFF\x03\x00\xFF",
            "SET_SPEED": lambda: f"\xFF\x04{kwargs.get('speed', 18):02x}\xFF".encode(),
            "GET_STATUS": b"\xFF\x05\x00\xFF",
            "LAMP_ON": b"\xFF\x06\x01\xFF",
            "LAMP_OFF": b"\xFF\x06\x00\xFF",
        }
        cmd = commands.get(cmd_type)
        if callable(cmd):
            return cmd()
        return cmd if cmd else b""

    def _eumig_super8_command(self, cmd_type: str, **kwargs) -> bytes:
        base_cmd = {
            "CONNECT": "INIT",
            "DISCONNECT": "EXIT",
            "START_MOTOR": "RUN",
            "STOP_MOTOR": "STP",
            "GET_STATUS": "STA?",
            "LAMP_ON": "LON",
            "LAMP_OFF": "LOF",
        }
        if cmd_type == "SET_SPEED":
            return f"SPD:{kwargs.get('speed', 18)}\r".encode()
        cmd = base_cmd.get(cmd_type, "")
        return f"{cmd}\r".encode() if cmd else b""

    def _bauer_t1_command(self, cmd_type: str, **kwargs) -> bytes:
        prefix = b"\xAA"
        suffix = b"\x55"
        commands = {
            "CONNECT": b"\x01\x00",
            "DISCONNECT": b"\x02\x00",
            "START_MOTOR": b"\x03\x01",
            "STOP_MOTOR": b"\x03\x00",
            "GET_STATUS": b"\x04\x00",
            "LAMP_ON": b"\x05\x64",
            "LAMP_OFF": b"\x05\x00",
        }
        if cmd_type == "SET_SPEED":
            speed = kwargs.get('speed', 18)
            cmd = b"\x06" + bytes([speed])
        else:
            cmd = commands.get(cmd_type, b"")
        return prefix + cmd + suffix if cmd else b""

    def _generic_command(self, cmd_type: str, **kwargs) -> bytes:
        return f"{cmd_type}:{kwargs}\n".encode()

    def parse_response(self, response: bytes) -> Dict:
        try:
            if self.model == ProjectorModel.BELL_HOWELL_16MM:
                return self._parse_bell_howell(response)
            elif self.model == ProjectorModel.KODAK_PAGEANT:
                return self._parse_kodak_pageant(response)
            elif self.model == ProjectorModel.EUMIG_SUPER8:
                return self._parse_eumig_super8(response)
            elif self.model == ProjectorModel.BAUER_T1:
                return self._parse_bauer_t1(response)
            else:
                return {"raw": response.decode(errors="replace")}
        except Exception as e:
            self.logger.error(f"Response parse error: {e}")
            return {"error": str(e), "raw": response.hex()}

    def _parse_bell_howell(self, response: bytes) -> Dict:
        if len(response) < 4:
            return {"error": "Invalid response length"}
        status_byte = response[2]
        return {
            "motor_running": bool(status_byte & 0x01),
            "lamp_on": bool(status_byte & 0x02),
            "film_detected": bool(status_byte & 0x04),
            "temperature_ok": not bool(status_byte & 0x08),
            "speed": response[3] if len(response) > 3 else 0,
        }

    def _parse_kodak_pageant(self, response: bytes) -> Dict:
        if len(response) < 4:
            return {"error": "Invalid response length"}
        status = response[2]
        return {
            "motor_running": bool(status & 0x01),
            "lamp_on": bool(status & 0x02),
            "film_detected": bool(status & 0x04),
            "auto_mode": bool(status & 0x08),
            "frame_count": int.from_bytes(response[3:5], 'big') if len(response) > 4 else 0,
        }

    def _parse_eumig_super8(self, response: bytes) -> Dict:
        try:
            text = response.decode().strip()
            if ":" in text:
                key, value = text.split(":", 1)
                return {key.strip(): value.strip()}
            return {"status": text}
        except:
            return {"raw": response.decode(errors="replace")}

    def _parse_bauer_t1(self, response: bytes) -> Dict:
        if len(response) < 4 or response[0] != 0xAA or response[-1] != 0x55:
            return {"error": "Invalid response format"}
        cmd = response[1]
        data = response[2:-1]
        if cmd == 0x04:
            return {
                "motor_speed": data[0] if len(data) > 0 else 0,
                "lamp_brightness": data[1] if len(data) > 1 else 0,
                "film_position": int.from_bytes(data[2:4], 'big') if len(data) > 3 else 0,
                "temperature": data[4] if len(data) > 4 else 0,
            }
        return {"cmd": cmd, "data": data.hex()}


class ProjectorDriver:
    def __init__(self):
        self.logger = logging.getLogger("ProjectorDriver")
        self.current_projector: Optional[ProjectorInfo] = None
        self._serial_conn: Optional[serial.Serial] = None
        self._usb_dev: Optional[usb.core.Device] = None
        self._protocol_handler: Optional[ProtocolHandler] = None
        self._lock = threading.Lock()
        self._status_monitor_thread: Optional[threading.Thread] = None
        self._monitoring = False
        self.last_status: Optional[DeviceStatus] = None

    def detect_projectors(self) -> List[ProjectorInfo]:
        self.logger.info("Starting projector detection...")
        projectors = []

        usb_projectors = self._detect_usb_devices()
        projectors.extend(usb_projectors)

        serial_projectors = self._detect_serial_ports()
        projectors.extend(serial_projectors)

        self.logger.info(f"Detected {len(projectors)} projector(s)")
        return projectors

    def _detect_usb_devices(self) -> List[ProjectorInfo]:
        projectors = []
        known_vid_pid = {
            (0x0403, 0x6001): (ProjectorModel.BELL_HOWELL_16MM, "FTDI USB-Serial"),
            (0x067B, 0x2303): (ProjectorModel.KODAK_PAGEANT, "Prolific USB-Serial"),
            (0x2341, 0x0043): (ProjectorModel.EUMIG_SUPER8, "Arduino Adapter"),
            (0x1A86, 0x7523): (ProjectorModel.BAUER_T1, "CH340 USB-Serial"),
        }

        try:
            devices = usb.core.find(find_all=True)
            for dev in devices:
                key = (dev.idVendor, dev.idProduct)
                if key in known_vid_pid:
                    model, desc = known_vid_pid[key]
                    projectors.append(ProjectorInfo(
                        model=model,
                        connection_type=ConnectionType.USB,
                        vendor_id=dev.idVendor,
                        product_id=dev.idProduct,
                        status="Detected"
                    ))
                    self.logger.info(f"Found USB projector: {model.value}")
                elif dev.idVendor in [0x0403, 0x067B, 0x2341, 0x1A86]:
                    projectors.append(ProjectorInfo(
                        model=ProjectorModel.UNKNOWN,
                        connection_type=ConnectionType.USB,
                        vendor_id=dev.idVendor,
                        product_id=dev.idProduct,
                        status="Detected (Unknown)"
                    ))
        except Exception as e:
            self.logger.error(f"USB detection error: {e}")

        return projectors

    def _detect_serial_ports(self) -> List[ProjectorInfo]:
        projectors = []
        import glob
        import sys

        if sys.platform.startswith('win'):
            ports = [f'COM{i}' for i in range(1, 257)]
        elif sys.platform.startswith('linux') or sys.platform.startswith('cygwin'):
            ports = glob.glob('/dev/tty[A-Za-z]*')
        elif sys.platform.startswith('darwin'):
            ports = glob.glob('/dev/tty.*')
        else:
            return projectors

        common_baud_rates = [9600, 19200, 38400, 57600, 115200]

        for port in ports:
            try:
                for baud in common_baud_rates:
                    try:
                        ser = serial.Serial(
                            port=port,
                            baudrate=baud,
                            timeout=0.5,
                            write_timeout=0.5
                        )
                        ser.close()
                        model = self._probe_serial_projector(port, baud)
                        if model:
                            projectors.append(ProjectorInfo(
                                model=model,
                                connection_type=ConnectionType.SERIAL,
                                serial_port=port,
                                baud_rate=baud,
                                status="Detected"
                            ))
                            break
                    except (serial.SerialException, OSError):
                        continue
            except Exception as e:
                self.logger.debug(f"Error probing {port}: {e}")

        return projectors

    def _probe_serial_projector(self, port: str, baud: int) -> Optional[ProjectorModel]:
        probes = [
            (ProjectorModel.BELL_HOWELL_16MM, b"\x02\x05\x00\x03"),
            (ProjectorModel.KODAK_PAGEANT, b"\xFF\x05\x00\xFF"),
            (ProjectorModel.EUMIG_SUPER8, b"STA?\r"),
            (ProjectorModel.BAUER_T1, b"\xAA\x04\x00\x55"),
        ]

        try:
            ser = serial.Serial(port=port, baudrate=baud, timeout=1.0, write_timeout=1.0)
            for model, probe_cmd in probes:
                try:
                    ser.reset_input_buffer()
                    ser.write(probe_cmd)
                    response = ser.read(32)
                    if len(response) > 0:
                        handler = ProtocolHandler(model)
                        parsed = handler.parse_response(response)
                        if "error" not in parsed:
                            ser.close()
                            return model
                except:
                    continue
            ser.close()
        except:
            pass
        return None

    def connect(self, projector: ProjectorInfo) -> bool:
        with self._lock:
            self.logger.info(f"Connecting to {projector.model.value}...")

            try:
                if projector.connection_type in [ConnectionType.SERIAL, ConnectionType.BOTH]:
                    if projector.serial_port:
                        self._serial_conn = serial.Serial(
                            port=projector.serial_port,
                            baudrate=projector.baud_rate,
                            timeout=2.0,
                            write_timeout=2.0
                        )
                        self.logger.info(f"Serial connection established on {projector.serial_port}")

                if projector.connection_type in [ConnectionType.USB, ConnectionType.BOTH]:
                    if projector.vendor_id and projector.product_id:
                        self._usb_dev = usb.core.find(
                            idVendor=projector.vendor_id,
                            idProduct=projector.product_id
                        )
                        if self._usb_dev:
                            self._usb_dev.set_configuration()
                            self.logger.info("USB connection established")

                self.current_projector = projector
                self._protocol_handler = ProtocolHandler(projector.model)

                handshake_cmd = self._protocol_handler.create_command("CONNECT")
                if handshake_cmd:
                    response = self._send_command_raw(handshake_cmd)
                    self.logger.debug(f"Handshake response: {response.hex()}")

                projector.status = "Connected"
                self._start_status_monitor()

                self.logger.info(f"Successfully connected to {projector.model.value}")
                return True

            except Exception as e:
                self.logger.error(f"Connection failed: {e}")
                self._cleanup_connections()
                return False

    def disconnect(self):
        with self._lock:
            self._monitoring = False
            if self._status_monitor_thread:
                self._status_monitor_thread.join(timeout=2.0)

            if self._protocol_handler and self.current_projector:
                try:
                    disconnect_cmd = self._protocol_handler.create_command("DISCONNECT")
                    if disconnect_cmd:
                        self._send_command_raw(disconnect_cmd)
                except:
                    pass

            self._cleanup_connections()

            if self.current_projector:
                self.current_projector.status = "Disconnected"

            self.logger.info("Disconnected from projector")

    def _cleanup_connections(self):
        if self._serial_conn:
            try:
                self._serial_conn.close()
            except:
                pass
            self._serial_conn = None

        if self._usb_dev:
            try:
                usb.util.dispose_resources(self._usb_dev)
            except:
                pass
            self._usb_dev = None

        self.current_projector = None
        self._protocol_handler = None

    def _send_command_raw(self, cmd: bytes) -> bytes:
        if not cmd:
            return b""

        if self._serial_conn:
            try:
                self._serial_conn.reset_input_buffer()
                self._serial_conn.write(cmd)
                return self._serial_conn.read(64)
            except Exception as e:
                self.logger.error(f"Serial send error: {e}")
                return b""

        if self._usb_dev:
            try:
                cfg = self._usb_dev.get_active_configuration()
                intf = cfg[(0, 0)]
                ep_out = usb.util.find_descriptor(
                    intf,
                    custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT
                )
                ep_in = usb.util.find_descriptor(
                    intf,
                    custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN
                )
                if ep_out and ep_in:
                    ep_out.write(cmd)
                    return ep_in.read(64, timeout=2000).tobytes()
            except Exception as e:
                self.logger.error(f"USB send error: {e}")
                return b""

        return b""

    def send_command(self, cmd_type: str, **kwargs) -> Optional[Dict]:
        if not self._protocol_handler:
            self.logger.warning("No protocol handler available")
            return None

        with self._lock:
            try:
                cmd = self._protocol_handler.create_command(cmd_type, **kwargs)
                if not cmd:
                    return None

                response = self._send_command_raw(cmd)
                if response:
                    return self._protocol_handler.parse_response(response)
                return None
            except Exception as e:
                self.logger.error(f"Command error: {e}")
                return None

    def start_motor(self) -> bool:
        result = self.send_command("START_MOTOR")
        return result is not None and "error" not in result

    def stop_motor(self) -> bool:
        result = self.send_command("STOP_MOTOR")
        return result is not None and "error" not in result

    def set_speed(self, speed: int) -> bool:
        result = self.send_command("SET_SPEED", speed=speed)
        return result is not None and "error" not in result

    def lamp_on(self) -> bool:
        result = self.send_command("LAMP_ON")
        return result is not None and "error" not in result

    def lamp_off(self) -> bool:
        result = self.send_command("LAMP_OFF")
        return result is not None and "error" not in result

    def get_status(self) -> Optional[DeviceStatus]:
        result = self.send_command("GET_STATUS")
        if not result:
            return None

        status = DeviceStatus(
            is_connected=True,
            motor_speed=result.get("speed", result.get("motor_speed", 0)),
            lamp_brightness=result.get("lamp_brightness", 100 if result.get("lamp_on") else 0),
            film_position=result.get("frame_count", result.get("film_position", 0)),
            temperature=result.get("temperature", 25.0),
        )

        if not result.get("temperature_ok", True):
            status.error_code = 1
            status.error_message = "Temperature warning"

        if not result.get("film_detected", True):
            status.error_code = 2
            status.error_message = "No film detected"

        self.last_status = status
        return status

    def _start_status_monitor(self):
        self._monitoring = True
        self._status_monitor_thread = threading.Thread(target=self._status_monitor_loop, daemon=True)
        self._status_monitor_thread.start()

    def _status_monitor_loop(self):
        while self._monitoring and self.current_projector:
            try:
                status = self.get_status()
                if status and status.error_code != 0:
                    self.logger.warning(f"Projector warning: {status.error_message}")
                time.sleep(1.0)
            except Exception as e:
                self.logger.error(f"Status monitor error: {e}")
                time.sleep(2.0)

    def is_connected(self) -> bool:
        return self.current_projector is not None and self.current_projector.status == "Connected"
