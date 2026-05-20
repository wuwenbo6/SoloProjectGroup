import can
import threading
import time
from typing import Optional, Dict, Any, Callable
from queue import Queue, Empty

from .nmt import NMTManager, NMTState
from .sdo import SDOClient
from .pdo import PDOManager
from .lss import LSSManager, LSSDeviceInfo
from ..utils.bus_load import BusLoadMonitor, BusStatistics


class CANNetwork:
    def __init__(self, interface: str = 'pcan', channel: str = 'PCAN_USBBUS1', bitrate: int = 250000):
        self.interface = interface
        self.channel = channel
        self.bitrate = bitrate
        self.bus: Optional[can.BusABC] = None
        self._running = False
        self._recv_thread: Optional[threading.Thread] = None
        self._callbacks: Dict[int, list[Callable[[int, bytes], None]]] = {}
        self._all_callbacks: list[Callable[[int, bytes, float], None]] = []
        self._message_queues: Dict[int, Queue[bytes]] = {}
        self._lock = threading.Lock()
        self.bus_load: BusLoadMonitor = BusLoadMonitor(bitrate=bitrate)

    def connect(self) -> None:
        try:
            self.bus = can.Bus(
                interface=self.interface,
                channel=self.channel,
                bitrate=self.bitrate
            )
        except Exception:
            self.bus = can.Bus(
                interface='virtual',
                channel='virtual_channel',
                bitrate=self.bitrate
            )
        
        self._running = True
        self._recv_thread = threading.Thread(target=self._receive_loop, daemon=True)
        self._recv_thread.start()

    def disconnect(self) -> None:
        self._running = False
        if self._recv_thread:
            self._recv_thread.join(timeout=1.0)
        if self.bus:
            self.bus.shutdown()
            self.bus = None

    def _receive_loop(self) -> None:
        while self._running and self.bus:
            try:
                msg = self.bus.recv(timeout=0.1)
                if msg:
                    self.bus_load.on_message(
                        arb_id=msg.arbitration_id,
                        dlc=msg.dlc,
                        is_extended=msg.is_extended_id,
                        is_remote=msg.is_remote_frame,
                        is_error=msg.is_error_frame,
                        direction="RX"
                    )
                    if not msg.is_error_frame and not msg.is_remote_frame:
                        self._dispatch_message(msg.arbitration_id, bytes(msg.data), msg.timestamp)
            except Exception:
                pass

    def _dispatch_message(self, cob_id: int, data: bytes, timestamp: float) -> None:
        with self._lock:
            for callback in self._all_callbacks:
                try:
                    callback(cob_id, data, timestamp)
                except Exception:
                    pass
            
            if cob_id in self._message_queues:
                self._message_queues[cob_id].put(data)
            
            if cob_id in self._callbacks:
                for callback in self._callbacks[cob_id]:
                    try:
                        callback(cob_id, data)
                    except Exception:
                        pass

    def send_message(self, cob_id: int, data: bytes) -> None:
        if self.bus:
            msg = can.Message(arbitration_id=cob_id, data=data, is_extended_id=False)
            self.bus.send(msg)
            self.bus_load.on_message(
                arb_id=cob_id,
                dlc=len(data),
                is_extended=False,
                is_remote=False,
                is_error=False,
                direction="TX"
            )

    def register_callback(self, cob_id: int, callback: Callable[[int, bytes], None]) -> None:
        with self._lock:
            if cob_id not in self._callbacks:
                self._callbacks[cob_id] = []
            self._callbacks[cob_id].append(callback)

    def register_all_callback(self, callback: Callable[[int, bytes, float], None]) -> None:
        with self._lock:
            self._all_callbacks.append(callback)

    def unregister_callback(self, cob_id: int, callback: Callable) -> None:
        with self._lock:
            if cob_id in self._callbacks and callback in self._callbacks[cob_id]:
                self._callbacks[cob_id].remove(callback)

    def wait_for_message(self, cob_id: int, timeout: float = 1.0) -> Optional[bytes]:
        with self._lock:
            if cob_id not in self._message_queues:
                self._message_queues[cob_id] = Queue()
            queue = self._message_queues[cob_id]
        
        try:
            return queue.get(timeout=timeout)
        except Empty:
            return None


class CANopenMaster:
    def __init__(self, interface: str = 'pcan', channel: str = 'PCAN_USBBUS1', bitrate: int = 250000):
        self.network = CANNetwork(interface, channel, bitrate)
        self.nmt = NMTManager(self.network)
        self.pdo = PDOManager(self.network)
        self.lss = LSSManager(self.network)
        self._sdo_clients: Dict[int, SDOClient] = {}
        self._heartbeat_producer_id: int = 0
        self._heartbeat_interval: int = 0
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._running = False
        self._node_ids: set[int] = set()

    def connect(self) -> None:
        self.network.connect()
        self._running = True
        self.pdo.start()
        
        self.network.register_callback(0x700, self._on_heartbeat)
        
        for cob_id in range(0x180, 0x580):
            self.network.register_callback(cob_id, self._on_pdo)
        
        for cob_id in range(0x200, 0x280):
            self.network.register_callback(cob_id, self._on_pdo)
        
        for cob_id in range(0x300, 0x380):
            self.network.register_callback(cob_id, self._on_pdo)
        
        for cob_id in range(0x400, 0x480):
            self.network.register_callback(cob_id, self._on_pdo)
        
        self.network.register_callback(0x80, self._on_sync)

    def disconnect(self) -> None:
        self.stop_heartbeat_producer()
        self.pdo.stop()
        self._running = False
        self.network.disconnect()

    def _on_sync(self, cob_id: int, data: bytes) -> None:
        self.pdo.on_sync()

    def _on_heartbeat(self, cob_id: int, data: bytes) -> None:
        if 0x700 <= cob_id <= 0x77F:
            node_id = cob_id - 0x700
            self.nmt.on_heartbeat(node_id, data)
            self._node_ids.add(node_id)

    def _on_pdo(self, cob_id: int, data: bytes) -> None:
        self.pdo.on_pdo_received(cob_id, data)

    def add_node(self, node_id: int, eds_file: Optional[str] = None) -> None:
        self._node_ids.add(node_id)
        if node_id not in self._sdo_clients:
            self._sdo_clients[node_id] = SDOClient(self.network, node_id)

    def remove_node(self, node_id: int) -> None:
        self._node_ids.discard(node_id)
        self._sdo_clients.pop(node_id, None)

    def get_sdo_client(self, node_id: int) -> SDOClient:
        if node_id not in self._sdo_clients:
            self._sdo_clients[node_id] = SDOClient(self.network, node_id)
        return self._sdo_clients[node_id]

    def start_heartbeat_producer(self, producer_id: int = 0, interval_ms: int = 1000) -> None:
        self._heartbeat_producer_id = producer_id
        self._heartbeat_interval = interval_ms
        self._heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def stop_heartbeat_producer(self) -> None:
        self._heartbeat_interval = 0
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=1.0)
            self._heartbeat_thread = None

    def _heartbeat_loop(self) -> None:
        while self._running and self._heartbeat_interval > 0:
            cob_id = 0x700 + self._heartbeat_producer_id
            self.network.send_message(cob_id, bytes([NMTState.OPERATIONAL]))
            time.sleep(self._heartbeat_interval / 1000.0)

    def scan_nodes(self, timeout: float = 2.0) -> set[int]:
        self.nmt.node_states.clear()
        self.nmt.reset_all_nodes()
        time.sleep(timeout)
        return self._node_ids.copy()

    def get_node_ids(self) -> set[int]:
        return self._node_ids.copy()

    def start_node(self, node_id: int) -> None:
        self.nmt.start_node(node_id)

    def stop_node(self, node_id: int) -> None:
        self.nmt.stop_node(node_id)

    def reset_node(self, node_id: int) -> None:
        self.nmt.reset_node(node_id)

    def reset_communication(self, node_id: int) -> None:
        self.nmt.reset_communication(node_id)

    def start_all_nodes(self) -> None:
        self.nmt.start_all_nodes()

    def stop_all_nodes(self) -> None:
        self.nmt.stop_all_nodes()

    def get_node_state(self, node_id: int) -> Optional[NMTState]:
        return self.nmt.get_node_state(node_id)

    def get_all_node_states(self) -> Dict[int, Any]:
        return self.nmt.get_all_node_states()

    def sdo_read(self, node_id: int, index: int, subindex: int = 0) -> bytes:
        sdo = self.get_sdo_client(node_id)
        return sdo.read(index, subindex)

    def sdo_write(self, node_id: int, index: int, subindex: int, data: bytes) -> None:
        sdo = self.get_sdo_client(node_id)
        sdo.write(index, subindex, data)

    def send_sync(self) -> None:
        self.network.send_message(0x80, b'')

    def send_emcy(self, node_id: int, error_code: int, error_register: int, data: bytes = b'') -> None:
        cob_id = 0x80 + node_id
        msg = bytearray()
        msg.extend(error_code.to_bytes(2, 'little'))
        msg.append(error_register)
        msg.extend(data[:5])
        msg.extend(b'\x00' * (5 - len(data)))
        self.network.send_message(cob_id, bytes(msg))

    def register_message_callback(self, callback: Callable[[int, bytes, float], None]) -> None:
        self.network.register_all_callback(callback)

    def get_bus_load(self) -> float:
        return self.network.bus_load.get_current_load()

    def get_bus_statistics(self) -> BusStatistics:
        return self.network.bus_load.get_statistics()

    def reset_bus_statistics(self) -> None:
        self.network.bus_load.reset()

    def configure_pdo_mapping(self, node_id: int, pdo_type: str, pdo_number: int,
                               mappings: list[tuple[int, int, int]],
                               cob_id: Optional[int] = None,
                               transmission_type: int = 0xFF,
                               enabled: bool = True) -> bool:
        if pdo_type.upper() == 'TPDO':
            return self.pdo.configure_tpdo_mapping(
                node_id, pdo_number, mappings, cob_id, transmission_type, enabled
            )
        elif pdo_type.upper() == 'RPDO':
            return self.pdo.configure_rpdo_mapping(
                node_id, pdo_number, mappings, cob_id, transmission_type, enabled
            )
        return False

    def lss_configure_device(self, vendor_id: int, product_code: int,
                             revision_number: int, serial_number: int,
                             new_node_id: int, bitrate: Optional[int] = None,
                             store: bool = True) -> bool:
        return self.lss.configure_device(
            vendor_id, product_code, revision_number, serial_number,
            new_node_id, bitrate, store
        )

    def lss_identify_slaves(self, timeout: float = 2.0) -> list[LSSDeviceInfo]:
        return self.lss.identify_non_configured_slaves(timeout)

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
