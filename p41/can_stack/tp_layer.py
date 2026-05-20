import asyncio
from typing import Callable, Optional, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TPLayer:
    N_PCI_TYPE_SF = 0x00
    N_PCI_TYPE_FF = 0x10
    N_PCI_TYPE_CF = 0x20
    N_PCI_TYPE_FC = 0x30

    BS = 0
    STmin = 0

    def __init__(self, can_bus, source_id: int, target_id: int):
        self.can_bus = can_bus
        self.source_id = source_id
        self.target_id = target_id
        self.receive_callback: Optional[Callable[[bytes], None]] = None
        self.receive_buffer = bytearray()
        self.expected_length = 0
        self.sequence_number = 0
        self.pending_message = False
        self.receive_event: Optional[asyncio.Event] = None
        self.lock = asyncio.Lock()

    def set_receive_callback(self, callback: Callable[[bytes], None]):
        self.receive_callback = callback

    async def send_data(self, data: bytes) -> bool:
        async with self.lock:
            if len(data) <= 7:
                return await self._send_single_frame(data)
            else:
                return await self._send_multi_frame(data)

    async def _send_single_frame(self, data: bytes) -> bool:
        dlc = len(data)
        frame_data = bytes([dlc]) + data + b'\x00' * (7 - len(data))
        await self.can_bus.send_message(self.target_id, frame_data)
        logger.debug(f"Sent SF: {frame_data.hex()}")
        return True

    async def _send_multi_frame(self, data: bytes) -> bool:
        length = len(data)
        ff_data = bytes([self.N_PCI_TYPE_FF | (length >> 8), length & 0xFF]) + data[:6]
        await self.can_bus.send_message(self.target_id, ff_data)
        logger.debug(f"Sent FF: {ff_data.hex()}")

        remaining_data = data[6:]
        sn = 1

        while remaining_data:
            fc_frame = await self._wait_flow_control()
            if not fc_frame:
                logger.error("Flow control timeout")
                return False

            bs = fc_frame[1]
            stmin = fc_frame[2] / 1000.0 if fc_frame[2] <= 127 else 0.001

            block_size = bs if bs > 0 else len(remaining_data)
            for _ in range(block_size):
                if not remaining_data:
                    break
                chunk_size = min(7, len(remaining_data))
                cf_data = bytes([self.N_PCI_TYPE_CF | sn]) + remaining_data[:chunk_size]
                cf_data += b'\x00' * (8 - len(cf_data))
                await self.can_bus.send_message(self.target_id, cf_data)
                logger.debug(f"Sent CF SN={sn}: {cf_data.hex()}")
                remaining_data = remaining_data[chunk_size:]
                sn = (sn + 1) % 16
                await asyncio.sleep(stmin)

        return True

    async def _wait_flow_control(self) -> Optional[bytes]:
        timeout = 1.0
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            await asyncio.sleep(0.01)
        return bytes([0x30, 0x00, 0x00])

    async def process_received_frame(self, arbitration_id: int, data: bytes):
        if arbitration_id != self.source_id:
            return

        n_pci = data[0]
        n_pci_type = n_pci & 0xF0

        if n_pci_type == self.N_PCI_TYPE_SF:
            await self._process_single_frame(data)
        elif n_pci_type == self.N_PCI_TYPE_FF:
            await self._process_first_frame(data)
        elif n_pci_type == self.N_PCI_TYPE_CF:
            await self._process_consecutive_frame(data)
        elif n_pci_type == self.N_PCI_TYPE_FC:
            await self._process_flow_control(data)

    async def _process_single_frame(self, data: bytes):
        dlc = data[0] & 0x0F
        payload = data[1:1+dlc]
        logger.debug(f"Received SF: {payload.hex()}")
        if self.receive_callback:
            self.receive_callback(payload)

    async def _process_first_frame(self, data: bytes):
        self.expected_length = ((data[0] & 0x0F) << 8) | data[1]
        self.receive_buffer = bytearray(data[2:8])
        self.sequence_number = 1
        self.pending_message = True
        logger.debug(f"Received FF, expected length: {self.expected_length}")

        fc_data = bytes([self.N_PCI_TYPE_FC, self.BS, self.STmin, 0x00, 0x00, 0x00, 0x00, 0x00])
        await self.can_bus.send_message(self.target_id, fc_data)

    async def _process_consecutive_frame(self, data: bytes):
        if not self.pending_message:
            return

        sn = data[0] & 0x0F
        if sn != self.sequence_number:
            logger.warning(f"Unexpected SN: {sn}, expected: {self.sequence_number}")
            return

        self.receive_buffer.extend(data[1:])
        self.sequence_number = (self.sequence_number + 1) % 16

        if len(self.receive_buffer) >= self.expected_length:
            payload = bytes(self.receive_buffer[:self.expected_length])
            logger.debug(f"Received complete message: {payload.hex()}")
            self.pending_message = False
            if self.receive_callback:
                self.receive_callback(payload)

    async def _process_flow_control(self, data: bytes):
        logger.debug(f"Received FC: {data.hex()}")
