import asyncio
import random
from .base_ecu import BaseECU
import logging

logger = logging.getLogger(__name__)


class EngineECU(BaseECU):
    def __init__(self, can_bus):
        super().__init__("Engine", can_bus, tx_id=0x7E8, rx_id=0x7E0)
        self.rpm = 800
        self.coolant_temp = 85
        self.throttle_position = 0
        self.fuel_level = 75
        self._init_engine_dids()
        self._init_engine_dtcs()

    def _init_engine_dids(self):
        self.set_did_value(0x1001, self._rpm_to_bytes(self.rpm))
        self.set_did_value(0x1003, self._temp_to_bytes(self.coolant_temp))
        self.set_did_value(0x1004, self._position_to_bytes(self.throttle_position))
        self.set_did_value(0x1005, self._level_to_bytes(self.fuel_level))

    def _init_engine_dtcs(self):
        self.add_dtc(0x0300, 0x2F, "Cylinder 1 Misfire Detected")
        self.add_dtc(0x0301, 0x2F, "Cylinder 2 Misfire Detected")

    def _rpm_to_bytes(self, rpm: int) -> bytes:
        return bytes([rpm >> 8, rpm & 0xFF])

    def _temp_to_bytes(self, temp: int) -> bytes:
        return bytes([temp + 40])

    def _position_to_bytes(self, position: int) -> bytes:
        return bytes([position])

    def _level_to_bytes(self, level: int) -> bytes:
        return bytes([level])

    async def start(self):
        await super().start()
        asyncio.create_task(self._simulate_engine_data())
        asyncio.create_task(self._send_periodic_messages())

    async def _simulate_engine_data(self):
        while self.running:
            self.rpm = 800 + random.randint(-50, 2000)
            self.coolant_temp = 85 + random.randint(-5, 15)
            self.throttle_position = random.randint(0, 100)
            self.fuel_level = max(0, min(100, self.fuel_level + random.randint(-1, 1)))
            
            self.set_did_value(0x1001, self._rpm_to_bytes(self.rpm))
            self.set_did_value(0x1003, self._temp_to_bytes(self.coolant_temp))
            self.set_did_value(0x1004, self._position_to_bytes(self.throttle_position))
            self.set_did_value(0x1005, self._level_to_bytes(self.fuel_level))
            
            await asyncio.sleep(0.1)

    async def _send_periodic_messages(self):
        while self.running:
            data = bytes([
                0x08,
                self.rpm >> 8, self.rpm & 0xFF,
                self.coolant_temp + 40,
                self.throttle_position,
                0x00, 0x00, 0x00
            ])
            await self.can_bus.send_message(0x100, data)
            await asyncio.sleep(0.1)
