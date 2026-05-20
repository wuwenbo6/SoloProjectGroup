from enum import IntEnum
from dataclasses import dataclass, field
from typing import Callable, Optional, Any
from collections import deque
import struct
import time
import threading
import queue


class PDOType(IntEnum):
    RPDO = 0
    TPDO = 1


class TransmissionType(IntEnum):
    SYNCHRONOUS_ACYCLIC = 0x00
    SYNCHRONOUS_CYCLIC_1 = 0x01
    SYNCHRONOUS_CYCLIC_240 = 0xF0
    RTR_ONLY = 0xFC
    EVENT_DRIVEN_MANUFACTURER = 0xFE
    EVENT_DRIVEN_DEVICE_PROFILE = 0xFF


@dataclass
class PDOMapping:
    index: int
    subindex: int
    bit_length: int
    name: str = ""
    data_type: str = ""


@dataclass
class PDO:
    cob_id: int
    pdo_type: PDOType
    transmission_type: TransmissionType = TransmissionType.EVENT_DRIVEN_DEVICE_PROFILE
    mappings: list[PDOMapping] = field(default_factory=list)
    enabled: bool = False
    inhibit_time: int = 0
    event_timer: int = 0
    sync_start_value: int = 0
    data: bytes = b''
    last_update: float = 0.0
    last_sent: float = 0.0
    sync_counter: int = 0


@dataclass
class PDOEvent:
    cob_id: int
    data: bytes
    timestamp: float
    parsed_data: dict[str, Any]


class PDOManager:
    def __init__(self, network):
        self.network = network
        self.rpdos: dict[int, PDO] = {}
        self.tpdos: dict[int, PDO] = {}
        self.callbacks: dict[int, list[Callable]] = {}
        self._lock = threading.RLock()
        self._event_queue: queue.Queue[Optional[PDOEvent]] = queue.Queue()
        self._callback_thread: Optional[threading.Thread] = None
        self._running = False
        self._sync_counter: int = 0
        self._sync_lock = threading.Lock()
        self._parse_handlers: dict[str, Callable] = {
            'BOOL': lambda d: bool(d[0] & 0x01),
            'S8': lambda d: struct.unpack('<b', d[:1])[0],
            'U8': lambda d: struct.unpack('<B', d[:1])[0],
            'S16': lambda d: struct.unpack('<h', d[:2])[0],
            'U16': lambda d: struct.unpack('<H', d[:2])[0],
            'S32': lambda d: struct.unpack('<i', d[:4])[0],
            'U32': lambda d: struct.unpack('<I', d[:4])[0],
            'REAL32': lambda d: struct.unpack('<f', d[:4])[0],
        }
        self._min_send_interval: float = 0.001

    def start(self) -> None:
        self._running = True
        self._callback_thread = threading.Thread(target=self._callback_loop, daemon=True)
        self._callback_thread.start()

    def stop(self) -> None:
        self._running = False
        self._event_queue.put(None)
        if self._callback_thread:
            self._callback_thread.join(timeout=1.0)
            self._callback_thread = None

    def _callback_loop(self) -> None:
        while self._running:
            try:
                event = self._event_queue.get(timeout=0.1)
                if event is None:
                    break
                self._dispatch_callbacks(event)
            except queue.Empty:
                continue

    def _dispatch_callbacks(self, event: PDOEvent) -> None:
        with self._lock:
            callbacks = list(self.callbacks.get(event.cob_id, []))
        
        for callback in callbacks:
            try:
                callback(event.cob_id, event.data, event.parsed_data)
            except Exception:
                pass

    def add_pdo(self, pdo: PDO) -> None:
        with self._lock:
            if pdo.pdo_type == PDOType.RPDO:
                self.rpdos[pdo.cob_id] = pdo
            else:
                self.tpdos[pdo.cob_id] = pdo
                self.callbacks[pdo.cob_id] = []

    def remove_pdo(self, cob_id: int) -> None:
        with self._lock:
            self.rpdos.pop(cob_id, None)
            self.tpdos.pop(cob_id, None)
            self.callbacks.pop(cob_id, None)

    def register_callback(self, cob_id: int, callback: Callable[[int, bytes, dict[str, Any]], None]) -> None:
        with self._lock:
            if cob_id in self.callbacks:
                self.callbacks[cob_id].append(callback)

    def unregister_callback(self, cob_id: int, callback: Callable) -> None:
        with self._lock:
            if cob_id in self.callbacks and callback in self.callbacks[cob_id]:
                self.callbacks[cob_id].remove(callback)

    def on_pdo_received(self, cob_id: int, data: bytes) -> None:
        with self._lock:
            if cob_id not in self.tpdos:
                return
            
            pdo = self.tpdos[cob_id]
            if not pdo.enabled:
                return
            
            pdo.data = data
            pdo.last_update = time.time()
            
            parsed_data = self._parse_pdo_data(pdo)
        
        event = PDOEvent(
            cob_id=cob_id,
            data=data,
            timestamp=time.time(),
            parsed_data=parsed_data
        )
        self._event_queue.put(event)

    def _parse_pdo_data(self, pdo: PDO) -> dict[str, Any]:
        result = {}
        bit_offset = 0
        data_bytes = pdo.data
        
        for mapping in pdo.mappings:
            byte_offset = bit_offset // 8
            bit_in_byte = bit_offset % 8
            
            if mapping.bit_length <= 8:
                raw_value = data_bytes[byte_offset] if byte_offset < len(data_bytes) else 0
                if bit_in_byte > 0 or mapping.bit_length < 8:
                    mask = (1 << mapping.bit_length) - 1
                    raw_value = (raw_value >> bit_in_byte) & mask
            elif mapping.bit_length <= 16:
                if byte_offset + 1 < len(data_bytes):
                    raw_value = struct.unpack('<H', data_bytes[byte_offset:byte_offset + 2])[0]
                else:
                    raw_value = 0
            elif mapping.bit_length <= 32:
                if byte_offset + 3 < len(data_bytes):
                    raw_value = struct.unpack('<I', data_bytes[byte_offset:byte_offset + 4])[0]
                else:
                    raw_value = 0
            else:
                raw_value = 0
            
            name = mapping.name or f"0x{mapping.index:04X}:{mapping.subindex}"
            
            if mapping.data_type in self._parse_handlers:
                try:
                    result[name] = self._parse_handlers[mapping.data_type](data_bytes[byte_offset:])
                except Exception:
                    result[name] = raw_value
            else:
                result[name] = raw_value
            
            bit_offset += mapping.bit_length
        
        return result

    def _check_inhibit_time(self, pdo: PDO) -> bool:
        if pdo.inhibit_time <= 0:
            return True
        elapsed = time.time() - pdo.last_sent
        return elapsed >= pdo.inhibit_time / 1000.0

    def send_rpdo(self, cob_id: int, data: bytes, force: bool = False) -> bool:
        with self._lock:
            if cob_id not in self.rpdos:
                return False
            
            pdo = self.rpdos[cob_id]
            if not pdo.enabled:
                return False
            
            if not force and not self._check_inhibit_time(pdo):
                return False
            
            if not force:
                elapsed = time.time() - pdo.last_sent
                if elapsed < self._min_send_interval:
                    return False
        
        self.network.send_message(cob_id, data)
        
        with self._lock:
            pdo.data = data
            pdo.last_update = time.time()
            pdo.last_sent = time.time()
        
        return True

    def send_rpdo_by_values(self, cob_id: int, values: dict[str, Any], force: bool = False) -> bool:
        with self._lock:
            if cob_id not in self.rpdos:
                return False
            pdo = self.rpdos[cob_id]
            data = self._build_pdo_data(pdo, values)
        
        return self.send_rpdo(cob_id, data, force)

    def send_synced_rpdos(self, cob_ids: list[int], values_list: list[dict[str, Any]]) -> list[bool]:
        results = []
        with self._lock:
            for cob_id, values in zip(cob_ids, values_list):
                if cob_id not in self.rpdos:
                    results.append(False)
                    continue
                pdo = self.rpdos[cob_id]
                if not pdo.enabled:
                    results.append(False)
                    continue
                data = self._build_pdo_data(pdo, values)
                self.network.send_message(cob_id, data)
                pdo.data = data
                pdo.last_update = time.time()
                pdo.last_sent = time.time()
                results.append(True)
        return results

    def _build_pdo_data(self, pdo: PDO, values: dict[str, Any]) -> bytes:
        data = bytearray(8)
        bit_offset = 0
        
        for mapping in pdo.mappings:
            name = mapping.name or f"0x{mapping.index:04X}:{mapping.subindex}"
            if name not in values:
                bit_offset += mapping.bit_length
                continue
            
            value = values[name]
            byte_offset = bit_offset // 8
            bit_in_byte = bit_offset % 8
            
            if mapping.bit_length <= 8:
                byte_val = int(value) & ((1 << mapping.bit_length) - 1)
                if bit_in_byte == 0 and mapping.bit_length == 8:
                    data[byte_offset] = byte_val
                else:
                    mask = ((1 << mapping.bit_length) - 1) << bit_in_byte
                    data[byte_offset] = (data[byte_offset] & ~mask) | (byte_val << bit_in_byte)
            elif mapping.bit_length <= 16:
                struct.pack_into('<H', data, byte_offset, int(value))
            elif mapping.bit_length <= 32:
                struct.pack_into('<I', data, byte_offset, int(value))
            
            bit_offset += mapping.bit_length
        
        return bytes(data)

    def on_sync(self) -> None:
        with self._sync_lock:
            self._sync_counter = (self._sync_counter % 240) + 1

    def get_sync_counter(self) -> int:
        with self._sync_lock:
            return self._sync_counter

    def get_pdo_data(self, cob_id: int) -> Optional[bytes]:
        with self._lock:
            if cob_id in self.tpdos:
                return self.tpdos[cob_id].data
            elif cob_id in self.rpdos:
                return self.rpdos[cob_id].data
        return None

    def get_parsed_data(self, cob_id: int) -> Optional[dict[str, Any]]:
        with self._lock:
            if cob_id in self.tpdos:
                return self._parse_pdo_data(self.tpdos[cob_id])
            elif cob_id in self.rpdos:
                return self._parse_pdo_data(self.rpdos[cob_id])
        return None

    def get_all_tpdos(self) -> dict[int, PDO]:
        with self._lock:
            return self.tpdos.copy()

    def get_all_rpdos(self) -> dict[int, PDO]:
        with self._lock:
            return self.rpdos.copy()

    def enable_pdo(self, cob_id: int) -> None:
        with self._lock:
            if cob_id in self.tpdos:
                self.tpdos[cob_id].enabled = True
            elif cob_id in self.rpdos:
                self.rpdos[cob_id].enabled = True

    def disable_pdo(self, cob_id: int) -> None:
        with self._lock:
            if cob_id in self.tpdos:
                self.tpdos[cob_id].enabled = False
            elif cob_id in self.rpdos:
                self.rpdos[cob_id].enabled = False

    def configure_from_eds(self, node_id: int, eds_config: dict) -> None:
        with self._lock:
            for pdo_num in range(1, 512):
                tpdo_comm_index = 0x1800 + pdo_num - 1
                tpdo_map_index = 0x1A00 + pdo_num - 1
                
                comm_params = eds_config.get(f'0x{tpdo_comm_index:04X}', {})
                if not comm_params:
                    break
                
                cob_id_entry = comm_params.get('1', {})
                if isinstance(cob_id_entry, dict):
                    cob_id_value = int(cob_id_entry.get('DefaultValue', 0))
                    if cob_id_value == 0:
                        continue
                    cob_id = (cob_id_value & 0x1FFFFFFF) + node_id - 1
                    enabled = (cob_id_value & 0x80000000) == 0
                else:
                    continue
                
                trans_type = int(comm_params.get('2', {}).get('DefaultValue', 255))
                try:
                    trans_type_enum = TransmissionType(trans_type)
                except ValueError:
                    trans_type_enum = TransmissionType.EVENT_DRIVEN_DEVICE_PROFILE
                
                inhibit_time = int(comm_params.get('3', {}).get('DefaultValue', 0))
                event_timer = int(comm_params.get('5', {}).get('DefaultValue', 0))
                sync_start = int(comm_params.get('6', {}).get('DefaultValue', 0))
                
                tpdo = PDO(
                    cob_id=cob_id,
                    pdo_type=PDOType.TPDO,
                    transmission_type=trans_type_enum,
                    enabled=enabled,
                    inhibit_time=inhibit_time,
                    event_timer=event_timer,
                    sync_start_value=sync_start
                )
                
                map_params = eds_config.get(f'0x{tpdo_map_index:04X}', {})
                num_mappings = int(map_params.get('0', {}).get('DefaultValue', 0))
                
                for map_idx in range(1, num_mappings + 1):
                    map_entry = map_params.get(str(map_idx), {})
                    map_value = int(map_entry.get('DefaultValue', 0))
                    if map_value:
                        index = (map_value >> 16) & 0xFFFF
                        subindex = (map_value >> 8) & 0xFF
                        bit_length = map_value & 0xFF
                        tpdo.mappings.append(PDOMapping(
                            index=index,
                            subindex=subindex,
                            bit_length=bit_length
                        ))
                
                self.tpdos[cob_id] = tpdo
                self.callbacks[cob_id] = []
            
            for pdo_num in range(1, 512):
                rpdo_comm_index = 0x1400 + pdo_num - 1
                rpdo_map_index = 0x1600 + pdo_num - 1
                
                comm_params = eds_config.get(f'0x{rpdo_comm_index:04X}', {})
                if not comm_params:
                    break
                
                cob_id_entry = comm_params.get('1', {})
                if isinstance(cob_id_entry, dict):
                    cob_id_value = int(cob_id_entry.get('DefaultValue', 0))
                    if cob_id_value == 0:
                        continue
                    cob_id = (cob_id_value & 0x1FFFFFFF) + node_id - 1
                    enabled = (cob_id_value & 0x80000000) == 0
                else:
                    continue
                
                trans_type = int(comm_params.get('2', {}).get('DefaultValue', 255))
                try:
                    trans_type_enum = TransmissionType(trans_type)
                except ValueError:
                    trans_type_enum = TransmissionType.EVENT_DRIVEN_DEVICE_PROFILE
                
                inhibit_time = int(comm_params.get('3', {}).get('DefaultValue', 0))
                
                rpdo = PDO(
                    cob_id=cob_id,
                    pdo_type=PDOType.RPDO,
                    transmission_type=trans_type_enum,
                    enabled=enabled,
                    inhibit_time=inhibit_time
                )
                
                map_params = eds_config.get(f'0x{rpdo_map_index:04X}', {})
                num_mappings = int(map_params.get('0', {}).get('DefaultValue', 0))
                
                for map_idx in range(1, num_mappings + 1):
                    map_entry = map_params.get(str(map_idx), {})
                    map_value = int(map_entry.get('DefaultValue', 0))
                    if map_value:
                        index = (map_value >> 16) & 0xFFFF
                        subindex = (map_value >> 8) & 0xFF
                        bit_length = map_value & 0xFF
                        rpdo.mappings.append(PDOMapping(
                            index=index,
                            subindex=subindex,
                            bit_length=bit_length
                        ))
                
                self.rpdos[cob_id] = rpdo

    def configure_tpdo_mapping(self, node_id: int, pdo_number: int, 
                                mappings: list[tuple[int, int, int]],
                                cob_id: Optional[int] = None,
                                transmission_type: int = 0xFF,
                                enabled: bool = True) -> bool:
        if pdo_number < 1 or pdo_number > 512:
            return False

        if cob_id is None:
            cob_id = 0x180 + node_id - 1 + (pdo_number - 1) * 0x100
        
        comm_index = 0x1800 + pdo_number - 1
        map_index = 0x1A00 + pdo_number - 1

        try:
            sdo_client = self._get_sdo_client(node_id)
            if sdo_client is None:
                return False

            sdo_client.write_u32(comm_index, 1, cob_id | 0x80000000)
            sdo_client.write_u8(comm_index, 2, transmission_type)
            sdo_client.write_u8(map_index, 0, 0)
            
            for i, (obj_index, obj_subindex, bit_length) in enumerate(mappings, 1):
                mapping_value = (obj_index << 16) | (obj_subindex << 8) | bit_length
                sdo_client.write_u32(map_index, i, mapping_value)
            
            sdo_client.write_u8(map_index, 0, len(mappings))
            
            if enabled:
                sdo_client.write_u32(comm_index, 1, cob_id & 0x7FFFFFFF)
            
            with self._lock:
                tpdo = PDO(
                    cob_id=cob_id,
                    pdo_type=PDOType.TPDO,
                    transmission_type=TransmissionType(transmission_type) 
                        if transmission_type in TransmissionType.__members__.values()
                        else TransmissionType.EVENT_DRIVEN_DEVICE_PROFILE,
                    enabled=enabled
                )
                for obj_index, obj_subindex, bit_length in mappings:
                    tpdo.mappings.append(PDOMapping(
                        index=obj_index,
                        subindex=obj_subindex,
                        bit_length=bit_length
                    ))
                self.tpdos[cob_id] = tpdo
                self.callbacks[cob_id] = []
            
            return True
        except Exception:
            return False

    def configure_rpdo_mapping(self, node_id: int, pdo_number: int,
                                mappings: list[tuple[int, int, int]],
                                cob_id: Optional[int] = None,
                                transmission_type: int = 0xFF,
                                enabled: bool = True) -> bool:
        if pdo_number < 1 or pdo_number > 512:
            return False

        if cob_id is None:
            cob_id = 0x200 + node_id - 1 + (pdo_number - 1) * 0x100
        
        comm_index = 0x1400 + pdo_number - 1
        map_index = 0x1600 + pdo_number - 1

        try:
            sdo_client = self._get_sdo_client(node_id)
            if sdo_client is None:
                return False

            sdo_client.write_u32(comm_index, 1, cob_id | 0x80000000)
            sdo_client.write_u8(comm_index, 2, transmission_type)
            sdo_client.write_u8(map_index, 0, 0)
            
            for i, (obj_index, obj_subindex, bit_length) in enumerate(mappings, 1):
                mapping_value = (obj_index << 16) | (obj_subindex << 8) | bit_length
                sdo_client.write_u32(map_index, i, mapping_value)
            
            sdo_client.write_u8(map_index, 0, len(mappings))
            
            if enabled:
                sdo_client.write_u32(comm_index, 1, cob_id & 0x7FFFFFFF)
            
            with self._lock:
                rpdo = PDO(
                    cob_id=cob_id,
                    pdo_type=PDOType.RPDO,
                    transmission_type=TransmissionType(transmission_type)
                        if transmission_type in TransmissionType.__members__.values()
                        else TransmissionType.EVENT_DRIVEN_DEVICE_PROFILE,
                    enabled=enabled
                )
                for obj_index, obj_subindex, bit_length in mappings:
                    rpdo.mappings.append(PDOMapping(
                        index=obj_index,
                        subindex=obj_subindex,
                        bit_length=bit_length
                    ))
                self.rpdos[cob_id] = rpdo
            
            return True
        except Exception:
            return False

    def add_mapping(self, cob_id: int, index: int, subindex: int, 
                    bit_length: int, name: str = "", data_type: str = "") -> bool:
        with self._lock:
            if cob_id in self.tpdos:
                pdo = self.tpdos[cob_id]
            elif cob_id in self.rpdos:
                pdo = self.rpdos[cob_id]
            else:
                return False
            
            total_bits = sum(m.bit_length for m in pdo.mappings) + bit_length
            if total_bits > 64:
                return False
            
            pdo.mappings.append(PDOMapping(
                index=index,
                subindex=subindex,
                bit_length=bit_length,
                name=name,
                data_type=data_type
            ))
            return True

    def clear_mappings(self, cob_id: int) -> bool:
        with self._lock:
            if cob_id in self.tpdos:
                self.tpdos[cob_id].mappings.clear()
                return True
            elif cob_id in self.rpdos:
                self.rpdos[cob_id].mappings.clear()
                return True
        return False

    def _get_sdo_client(self, node_id: int):
        if hasattr(self.network, 'get_sdo_client'):
            return self.network.get_sdo_client(node_id)
        return None
