from enum import IntEnum
from typing import Any, Optional
import struct
import time
import threading


class SDOServerCommand(IntEnum):
    UPLOAD_SEGMENT = 0x00
    DOWNLOAD_SEGMENT = 0x00
    UPLOAD_INITIATE = 0x40
    DOWNLOAD_INITIATE = 0x20
    ABORT = 0x80
    BLOCK_UPLOAD_INITIATE = 0xA0
    BLOCK_DOWNLOAD_INITIATE = 0xC0
    BLOCK_UPLOAD_END = 0xA1
    BLOCK_DOWNLOAD_END = 0xC1
    BLOCK_SUB_BLOCK = 0x00


class SDOAbortCode(IntEnum):
    TOGGLE_BIT_NOT_ALTERNATED = 0x05030000
    SDO_PROTOCOL_TIMEOUT = 0x05040000
    OUT_OF_MEMORY = 0x05040005
    UNSUPPORTED_ACCESS = 0x06010000
    WRITE_ONLY_OBJECT = 0x06010001
    READ_ONLY_OBJECT = 0x06010002
    OBJECT_DOES_NOT_EXIST = 0x06020000
    OBJECT_CANNOT_BE_MAPPED = 0x06040041
    PDO_LENGTH_EXCEEDED = 0x06040042
    GENERAL_PARAMETER_INCOMPATIBILITY = 0x06040043
    GENERAL_INTERNAL_INCOMPATIBILITY = 0x06040047
    HARDWARE_ERROR = 0x06060000
    WRONG_LENGTH = 0x06070010
    TOO_LONG = 0x06070012
    TOO_SHORT = 0x06070013
    SUBINDEX_DOES_NOT_EXIST = 0x06090011
    VALUE_RANGE_ERROR = 0x06090030
    VALUE_TOO_HIGH = 0x06090031
    VALUE_TOO_LOW = 0x06090032
    MAXIMUM_LESS_THAN_MINIMUM = 0x06090036
    GENERAL_ERROR = 0x08000000
    TRANSFER_ABORTED = 0x08000020


class SDOError(Exception):
    def __init__(self, message: str, abort_code: Optional[int] = None):
        super().__init__(message)
        self.abort_code = abort_code
        self.abort_name = SDOAbortCode(abort_code).name if abort_code in SDOAbortCode.__members__.values() else "UNKNOWN"


class SDOClient:
    def __init__(self, network, node_id: int):
        self.network = network
        self.node_id = node_id
        self.tx_cob_id = 0x600 + node_id
        self.rx_cob_id = 0x580 + node_id
        self.block_size = 127
        self.timeout = 2.0
        self.max_retries = 3
        self.use_block_transfer_threshold = 256
        self._lock = threading.Lock()

    def _build_index_subindex(self, index: int, subindex: int) -> bytes:
        return struct.pack('<HB', index, subindex)

    def _send_and_wait(self, data: bytes) -> bytes:
        retries = 0
        while retries < self.max_retries:
            self.network.send_message(self.tx_cob_id, data)
            response = self.network.wait_for_message(self.rx_cob_id, self.timeout)
            if response is not None:
                return response
            retries += 1
        raise SDOError(f"SDO timeout after {self.max_retries} retries")

    def _check_abort(self, response: bytes, context: str) -> None:
        if response[0] & 0x80:
            abort_code = struct.unpack('<I', response[4:8])[0]
            raise SDOError(f"{context}: 0x{abort_code:08X}", abort_code)

    def read(self, index: int, subindex: int = 0) -> bytes:
        with self._lock:
            cmd = bytearray([SDOServerCommand.UPLOAD_INITIATE])
            cmd.extend(self._build_index_subindex(index, subindex))
            cmd.extend(b'\x00\x00\x00\x00')
            
            response = self._send_and_wait(bytes(cmd))
            self._check_abort(response, "SDO read abort")
            
            if response[0] & 0x02:
                data_size = struct.unpack('<I', response[4:8])[0]
            else:
                data_size = 0
            
            if response[0] & 0x01:
                num_bytes = 4 - ((response[0] >> 2) & 0x03)
                return response[4:4 + num_bytes]
            else:
                if data_size > self.use_block_transfer_threshold:
                    return self._read_block(index, subindex, data_size)
                else:
                    return self._read_segmented(data_size)

    def _read_segmented(self, expected_size: int) -> bytes:
        data = bytearray()
        toggle = 0
        
        while True:
            cmd = bytearray([SDOServerCommand.UPLOAD_SEGMENT | (toggle << 4)])
            cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
            
            response = self._send_and_wait(bytes(cmd))
            self._check_abort(response, "SDO segmented read abort")
            
            if (response[0] >> 4) & 0x01 != toggle:
                raise SDOError("Toggle bit mismatch in segmented transfer")
            
            num_bytes = 7 - ((response[0] >> 1) & 0x07)
            data.extend(response[1:1 + num_bytes])
            
            if response[0] & 0x01:
                break
            
            toggle = 1 - toggle
        
        return bytes(data)

    def _read_block(self, index: int, subindex: int, expected_size: int) -> bytes:
        cmd = bytearray([SDOServerCommand.BLOCK_UPLOAD_INITIATE])
        cmd.extend(self._build_index_subindex(index, subindex))
        cmd.append(self.block_size)
        cmd.extend(b'\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        self._check_abort(response, "SDO block upload init abort")
        
        if (response[0] & 0xE0) != 0xA0:
            return self._read_segmented(expected_size)
        
        server_block_size = response[4]
        if server_block_size > 0:
            self.block_size = min(self.block_size, server_block_size)
        
        data = bytearray()
        seq_no = 1
        end_of_transfer = False
        
        while not end_of_transfer:
            for _ in range(self.block_size):
                response = self.network.wait_for_message(self.rx_cob_id, self.timeout)
                if response is None:
                    raise SDOError("SDO block transfer timeout")
                
                self._check_abort(response, "SDO block read abort")
                
                if response[0] == 0xA1:
                    end_of_transfer = True
                    break
                
                current_seq = response[0] & 0x7F
                if current_seq != seq_no:
                    cmd = bytearray([SDOServerCommand.BLOCK_UPLOAD_END | 0x01])
                    cmd.append(seq_no - 1)
                    cmd.extend(b'\x00\x00\x00\x00\x00')
                    self.network.send_message(self.tx_cob_id, bytes(cmd))
                    seq_no = 1
                    continue
                
                data.extend(response[1:8])
                seq_no += 1
            
            if not end_of_transfer:
                cmd = bytearray([SDOServerCommand.BLOCK_UPLOAD_END | 0x01])
                cmd.append(seq_no - 1)
                cmd.extend(b'\x00\x00\x00\x00\x00')
                response = self._send_and_wait(bytes(cmd))
                self._check_abort(response, "SDO block ack abort")
                
                if response[0] == 0xA1:
                    end_of_transfer = True
                else:
                    seq_no = 1
        
        if end_of_transfer:
            num_bytes_last = 7 - ((response[1] >> 2) & 0x07)
            if num_bytes_last < 7:
                data = data[:-(7 - num_bytes_last)]
        
        cmd = bytearray([SDOServerCommand.BLOCK_UPLOAD_END])
        cmd.extend(b'\x00\x00\x00\x00\x00\x00\x00')
        self.network.send_message(self.tx_cob_id, bytes(cmd))
        
        if expected_size > 0 and len(data) > expected_size:
            data = data[:expected_size]
        
        return bytes(data)

    def write(self, index: int, subindex: int, data: bytes) -> None:
        with self._lock:
            if len(data) <= 4:
                self._write_expedited(index, subindex, data)
            elif len(data) > self.use_block_transfer_threshold:
                self._write_block(index, subindex, data)
            else:
                self._write_segmented(index, subindex, data)

    def _write_expedited(self, index: int, subindex: int, data: bytes) -> None:
        cmd = bytearray()
        cmd_byte = SDOServerCommand.DOWNLOAD_INITIATE
        cmd_byte |= 0x03
        cmd_byte |= (4 - len(data)) << 2
        cmd.append(cmd_byte)
        cmd.extend(self._build_index_subindex(index, subindex))
        cmd.extend(data)
        cmd.extend(b'\x00' * (4 - len(data)))
        
        response = self._send_and_wait(bytes(cmd))
        self._check_abort(response, "SDO expedited write abort")

    def _write_segmented(self, index: int, subindex: int, data: bytes) -> None:
        cmd = bytearray([SDOServerCommand.DOWNLOAD_INITIATE | 0x02])
        cmd.extend(self._build_index_subindex(index, subindex))
        cmd.extend(struct.pack('<I', len(data)))
        
        response = self._send_and_wait(bytes(cmd))
        self._check_abort(response, "SDO segmented init abort")
        
        toggle = 0
        offset = 0
        
        while offset < len(data):
            chunk_size = min(7, len(data) - offset)
            is_last = offset + chunk_size >= len(data)
            
            cmd_byte = SDOServerCommand.DOWNLOAD_SEGMENT
            cmd_byte |= toggle << 4
            cmd_byte |= (7 - chunk_size) << 1
            if is_last:
                cmd_byte |= 0x01
            
            cmd = bytearray([cmd_byte])
            cmd.extend(data[offset:offset + chunk_size])
            cmd.extend(b'\x00' * (7 - chunk_size))
            
            response = self._send_and_wait(bytes(cmd))
            self._check_abort(response, "SDO segmented write abort")
            
            if (response[0] >> 4) & 0x01 != toggle:
                raise SDOError("Toggle bit mismatch in segmented write")
            
            offset += chunk_size
            toggle = 1 - toggle

    def _write_block(self, index: int, subindex: int, data: bytes) -> None:
        cmd = bytearray([SDOServerCommand.BLOCK_DOWNLOAD_INITIATE | 0x02])
        cmd.extend(self._build_index_subindex(index, subindex))
        cmd.extend(struct.pack('<I', len(data)))
        
        response = self._send_and_wait(bytes(cmd))
        self._check_abort(response, "SDO block download init abort")
        
        if (response[0] & 0xE0) != 0xC0:
            self._write_segmented(index, subindex, data)
            return
        
        server_block_size = response[4]
        if server_block_size > 0:
            self.block_size = min(self.block_size, server_block_size)
        
        offset = 0
        seq_no = 1
        total_length = len(data)
        
        while offset < total_length:
            block_count = 0
            while block_count < self.block_size and offset < total_length:
                chunk_size = min(7, total_length - offset)
                is_last_block = offset + chunk_size >= total_length
                
                if is_last_block:
                    seq_byte = seq_no | 0x80
                else:
                    seq_byte = seq_no
                
                cmd = bytearray([seq_byte])
                cmd.extend(data[offset:offset + chunk_size])
                cmd.extend(b'\x00' * (7 - chunk_size))
                
                self.network.send_message(self.tx_cob_id, bytes(cmd))
                
                offset += chunk_size
                seq_no += 1
                block_count += 1
                
                if is_last_block:
                    break
            
            cmd = bytearray([SDOServerCommand.BLOCK_DOWNLOAD_END | 0x01])
            cmd.append(block_count)
            cmd.append(0)
            cmd.extend(b'\x00\x00\x00\x00')
            
            response = self._send_and_wait(bytes(cmd))
            self._check_abort(response, "SDO block download ack abort")
            
            if (response[0] & 0xE0) == 0xC0:
                seq_no = 1
        
        last_chunk_size = total_length % 7
        if last_chunk_size == 0:
            last_chunk_size = 7
        
        cmd = bytearray([SDOServerCommand.BLOCK_DOWNLOAD_END])
        cmd.append((7 - last_chunk_size) << 2)
        cmd.append(0)
        cmd.extend(b'\x00\x00\x00\x00')
        
        response = self._send_and_wait(bytes(cmd))
        self._check_abort(response, "SDO block download end abort")

    def read_u8(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<B', data)[0]

    def read_u16(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<H', data)[0]

    def read_u32(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<I', data)[0]

    def read_s8(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<b', data)[0]

    def read_s16(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<h', data)[0]

    def read_s32(self, index: int, subindex: int = 0) -> int:
        data = self.read(index, subindex)
        return struct.unpack('<i', data)[0]

    def read_float(self, index: int, subindex: int = 0) -> float:
        data = self.read(index, subindex)
        return struct.unpack('<f', data)[0]

    def read_string(self, index: int, subindex: int = 0) -> str:
        data = self.read(index, subindex)
        return data.rstrip(b'\x00').decode('ascii', errors='replace')

    def write_u8(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<B', value))

    def write_u16(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<H', value))

    def write_u32(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<I', value))

    def write_s8(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<b', value))

    def write_s16(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<h', value))

    def write_s32(self, index: int, subindex: int, value: int) -> None:
        self.write(index, subindex, struct.pack('<i', value))

    def write_float(self, index: int, subindex: int, value: float) -> None:
        self.write(index, subindex, struct.pack('<f', value))

    def write_string(self, index: int, subindex: int, value: str) -> None:
        data = value.encode('ascii') + b'\x00'
        self.write(index, subindex, data)
