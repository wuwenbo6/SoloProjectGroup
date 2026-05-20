from enum import IntEnum
from dataclasses import dataclass
from typing import Optional, Tuple
import struct
import time


class LSSCommand(IntEnum):
    SWITCH_MODE_GLOBAL = 0x04
    CONFIGURE_NODE_ID = 0x11
    CONFIGURE_BIT_TIMING = 0x13
    ACTIVATE_BIT_TIMING = 0x15
    STORE_CONFIGURATION = 0x17
    SWITCH_MODE_SELECTIVE_VENDOR = 0x40
    SWITCH_MODE_SELECTIVE_PRODUCT = 0x41
    SWITCH_MODE_SELECTIVE_REVISION = 0x42
    SWITCH_MODE_SELECTIVE_SERIAL = 0x43
    SWITCH_MODE_SELECTIVE_RESPONSE = 0x44
    IDENTIFY_REMOTE_SLAVE = 0x46
    IDENTIFY_NON_CONFIGURED_REMOTE_SLAVE = 0x4C
    IDENTIFY_SLAVE = 0x4F
    LSS_FASTSCAN = 0x51
    INQUIRE_NODE_ID = 0x5E
    INQUIRE_VENDOR_ID = 0x5A
    INQUIRE_PRODUCT_CODE = 0x5B
    INQUIRE_REVISION_NUMBER = 0x5C
    INQUIRE_SERIAL_NUMBER = 0x5D


class LSSMode(IntEnum):
    WAITING = 0
    CONFIGURATION = 1


class LSSErrorCode(IntEnum):
    OK = 0
    OUT_OF_RANGE = 1
    LSS_NOT_SUPPORTED = 2
    ACCESS_FAILED = 3
    ILLEGAL_BITRATE = 4
    BITRATE_NOT_SET = 5
    STORE_NOT_SUPPORTED = 6
    STORE_FAILED = 7
    MEDIUM_NOT_SUPPORTED = 8
    NO_SLAVE_FOUND = 9
    SLAVE_NOT_IN_CONFIG_MODE = 10


@dataclass
class LSSDeviceInfo:
    vendor_id: int = 0
    product_code: int = 0
    revision_number: int = 0
    serial_number: int = 0
    node_id: int = 0
    bitrate: int = 0


class LSSManager:
    def __init__(self, network):
        self.network = network
        self.tx_cob_id = 0x7E5
        self.rx_cob_id = 0x7E4
        self.mode = LSSMode.WAITING
        self.timeout = 2.0
        self._selected_device: Optional[LSSDeviceInfo] = None

    def _send_and_wait(self, data: bytes) -> Optional[bytes]:
        self.network.send_message(self.tx_cob_id, data)
        return self.network.wait_for_message(self.rx_cob_id, self.timeout)

    def _check_response(self, response: Optional[bytes], expected_cmd: int) -> Tuple[bool, Optional[int]]:
        if response is None:
            return False, None
        if len(response) < 1:
            return False, None
        if response[0] == expected_cmd:
            return True, None
        if response[0] == 0x00:
            error_code = response[1] if len(response) > 1 else 0
            return False, error_code
        return False, None

    def switch_mode_global(self, config_mode: bool) -> bool:
        cmd = bytearray([LSSCommand.SWITCH_MODE_GLOBAL])
        cmd.append(0x01 if config_mode else 0x00)
        cmd.extend(b'\x00\x00\x00\x00\x00\x00')
        
        if config_mode:
            self.network.send_message(self.tx_cob_id, bytes(cmd))
            time.sleep(0.1)
            self.mode = LSSMode.CONFIGURATION
            return True
        else:
            self.network.send_message(self.tx_cob_id, bytes(cmd))
            self.mode = LSSMode.WAITING
            return True

    def switch_mode_selective(self, vendor_id: int, product_code: int, 
                              revision_number: int, serial_number: int) -> bool:
        success = self._switch_selective_step(
            LSSCommand.SWITCH_MODE_SELECTIVE_VENDOR, vendor_id
        )
        if not success:
            return False
        
        success = self._switch_selective_step(
            LSSCommand.SWITCH_MODE_SELECTIVE_PRODUCT, product_code
        )
        if not success:
            return False
        
        success = self._switch_selective_step(
            LSSCommand.SWITCH_MODE_SELECTIVE_REVISION, revision_number
        )
        if not success:
            return False
        
        success = self._switch_selective_step(
            LSSCommand.SWITCH_MODE_SELECTIVE_SERIAL, serial_number
        )
        if not success:
            return False
        
        response = self.network.wait_for_message(self.rx_cob_id, self.timeout)
        if response and response[0] == LSSCommand.SWITCH_MODE_SELECTIVE_RESPONSE:
            self._selected_device = LSSDeviceInfo(
                vendor_id=vendor_id,
                product_code=product_code,
                revision_number=revision_number,
                serial_number=serial_number
            )
            self.mode = LSSMode.CONFIGURATION
            return True
        return False

    def _switch_selective_step(self, cmd: int, value: int) -> bool:
        data = bytearray([cmd])
        data.extend(struct.pack('<I', value))
        data.extend(b'\x00\x00\x00')
        self.network.send_message(self.tx_cob_id, bytes(data))
        time.sleep(0.05)
        return True

    def identify_non_configured_slaves(self, timeout: float = 2.0) -> list[LSSDeviceInfo]:
        devices = []
        start_time = time.time()
        
        cmd = bytearray([LSSCommand.IDENTIFY_NON_CONFIGURED_REMOTE_SLAVE])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        self.network.send_message(self.tx_cob_id, bytes(cmd))
        
        while time.time() - start_time < timeout:
            response = self.network.wait_for_message(self.rx_cob_id, 0.1)
            if response and response[0] == LSSCommand.IDENTIFY_SLAVE:
                if len(response) >= 8:
                    vendor_id = struct.unpack('<I', response[1:5])[0]
                    product_code = struct.unpack('<I', response[4:8])[0] if len(response) >= 8 else 0
                    devices.append(LSSDeviceInfo(
                        vendor_id=vendor_id,
                        product_code=product_code
                    ))
        
        return devices

    def fastscan(self, timeout: float = 5.0) -> Optional[LSSDeviceInfo]:
        cmd = bytearray([LSSCommand.LSS_FASTSCAN])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        
        vendor_id = 0
        product_code = 0
        revision_number = 0
        serial_number = 0
        
        for id_sub in range(4):
            lss_sub = 0
            bit_check = 0
            not_match = 0
            
            while bit_check < 32:
                lss_sub = bit_check
                scan_bitmask = ((0xFFFFFFFF << lss_sub) ^ (0xFFFFFFFF << (lss_sub + 1)))
                scan_value = 0 & scan_bitmask
                scan_value_lss = scan_value >> 8 * id_sub
                
                data = bytearray([LSSCommand.LSS_FASTSCAN])
                data.append(id_sub)
                data.append(lss_sub)
                data.extend(struct.pack('<I', scan_value_lss))
                data.append(not_match)
                
                self.network.send_message(self.tx_cob_id, bytes(data))
                response = self.network.wait_for_message(self.rx_cob_id, 0.05)
                
                if response and response[0] == LSSCommand.LSS_FASTSCAN:
                    if not_match == 0:
                        pass
                    else:
                        not_match = 0
                else:
                    scan_value |= (1 << lss_sub)
                    not_match = 0
                
                bit_check += 1
            
            if id_sub == 0:
                vendor_id = scan_value
            elif id_sub == 1:
                product_code = scan_value
            elif id_sub == 2:
                revision_number = scan_value
            elif id_sub == 3:
                serial_number = scan_value
        
        response = self.network.wait_for_message(self.rx_cob_id, 0.5)
        if response and response[0] == LSSCommand.SWITCH_MODE_SELECTIVE_RESPONSE:
            self._selected_device = LSSDeviceInfo(
                vendor_id=vendor_id,
                product_code=product_code,
                revision_number=revision_number,
                serial_number=serial_number
            )
            self.mode = LSSMode.CONFIGURATION
            return self._selected_device
        
        return None

    def configure_node_id(self, node_id: int) -> bool:
        if not 1 <= node_id <= 127:
            return False
        
        cmd = bytearray([LSSCommand.CONFIGURE_NODE_ID])
        cmd.append(node_id)
        cmd.extend(b'\x00\x00\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        success, error = self._check_response(response, LSSCommand.CONFIGURE_NODE_ID)
        
        if success and self._selected_device:
            self._selected_device.node_id = node_id
        
        return success

    def configure_bit_timing(self, table: int, bitrate_index: int) -> bool:
        cmd = bytearray([LSSCommand.CONFIGURE_BIT_TIMING])
        cmd.append(table)
        cmd.append(bitrate_index)
        cmd.extend(b'\x00\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        success, error = self._check_response(response, LSSCommand.CONFIGURE_BIT_TIMING)
        return success

    def activate_bit_timing(self, delay_ms: int = 100) -> None:
        cmd = bytearray([LSSCommand.ACTIVATE_BIT_TIMING])
        cmd.extend(struct.pack('<H', delay_ms))
        cmd.extend(b'\x00\x00\x00\x00\x00')
        self.network.send_message(self.tx_cob_id, bytes(cmd))
        time.sleep(delay_ms / 1000.0 + 0.1)

    def store_configuration(self) -> bool:
        cmd = bytearray([LSSCommand.STORE_CONFIGURATION])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        success, error = self._check_response(response, LSSCommand.STORE_CONFIGURATION)
        return success

    def inquire_node_id(self) -> Optional[int]:
        cmd = bytearray([LSSCommand.INQUIRE_NODE_ID])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        if response and response[0] == LSSCommand.INQUIRE_NODE_ID and len(response) >= 2:
            return response[1]
        return None

    def inquire_vendor_id(self) -> Optional[int]:
        cmd = bytearray([LSSCommand.INQUIRE_VENDOR_ID])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        if response and response[0] == LSSCommand.INQUIRE_VENDOR_ID and len(response) >= 5:
            return struct.unpack('<I', response[1:5])[0]
        return None

    def get_bitrate_index(self, bitrate: int) -> Optional[int]:
        bitrate_map = {
            10000: 0,
            20000: 1,
            50000: 2,
            125000: 3,
            250000: 4,
            500000: 5,
            800000: 6,
            1000000: 7,
        }
        return bitrate_map.get(bitrate)

    def configure_device(self, vendor_id: int, product_code: int,
                         revision_number: int, serial_number: int,
                         new_node_id: int, bitrate: Optional[int] = None,
                         store: bool = True) -> bool:
        if not self.switch_mode_selective(vendor_id, product_code, 
                                          revision_number, serial_number):
            return False
        
        if not self.configure_node_id(new_node_id):
            self.switch_mode_global(False)
            return False
        
        if bitrate:
            bitrate_idx = self.get_bitrate_index(bitrate)
            if bitrate_idx is not None:
                self.configure_bit_timing(0, bitrate_idx)
        
        if store:
            if not self.store_configuration():
                self.switch_mode_global(False)
                return False
        
        self.switch_mode_global(False)
        
        if bitrate:
            time.sleep(0.5)
        
        return True

    def get_selected_device(self) -> Optional[LSSDeviceInfo]:
        return self._selected_device
