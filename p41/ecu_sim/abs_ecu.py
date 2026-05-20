import asyncio
import random
from .base_ecu import BaseECU
import logging

logger = logging.getLogger(__name__)


class ABSECU(BaseECU):
    def __init__(self, can_bus):
        super().__init__("ABS", can_bus, tx_id=0x7EA, rx_id=0x7E2)
        self.wheel_speeds = {
            "fl": 0,
            "fr": 0,
            "rl": 0,
            "rr": 0
        }
        self.abs_active = False
        self._init_abs_dids()
        self._init_abs_dtcs()

    def _init_abs_dids(self):
        self.set_did_value(0x3001, self._speed_to_bytes(self.wheel_speeds["fl"]))
        self.set_did_value(0x3002, self._speed_to_bytes(self.wheel_speeds["fr"]))
        self.set_did_value(0x3003, self._speed_to_bytes(self.wheel_speeds["rl"]))
        self.set_did_value(0x3004, self._speed_to_bytes(self.wheel_speeds["rr"]))

    def _init_abs_dtcs(self):
        self.add_dtc(0x0121, 0x2F, "ABS Hydraulic Pump Motor Circuit Malfunction")
        self.add_dtc(0x0122, 0x2F, "Wheel Speed Sensor Circuit Intermittent")

    def _speed_to_bytes(self, speed: int) -> bytes:
        return bytes([speed >> 8, speed & 0xFF])

    async def start(self):
        await super().start()
        asyncio.create_task(self._simulate_abs_data())
        asyncio.create_task(self._send_periodic_messages())

    async def _simulate_abs_data(self):
        while self.running:
            base_speed = random.randint(0, 180)
            self.wheel_speeds["fl"] = base_speed + random.randint(-5, 5)
            self.wheel_speeds["fr"] = base_speed + random.randint(-5, 5)
            self.wheel_speeds["rl"] = base_speed + random.randint(-5, 5)
            self.wheel_speeds["rr"] = base_speed + random.randint(-5, 5)
            
            self.abs_active = random.random() < 0.05
            
            self.set_did_value(0x3001, self._speed_to_bytes(self.wheel_speeds["fl"]))
            self.set_did_value(0x3002, self._speed_to_bytes(self.wheel_speeds["fr"]))
            self.set_did_value(0x3003, self._speed_to_bytes(self.wheel_speeds["rl"]))
            self.set_did_value(0x3004, self._speed_to_bytes(self.wheel_speeds["rr"]))
            
            await asyncio.sleep(0.05)

    async def _send_periodic_messages(self):
        while self.running:
            data = bytes([
                0x08,
                self.wheel_speeds["fl"] >> 8, self.wheel_speeds["fl"] & 0xFF,
                self.wheel_speeds["fr"] >> 8, self.wheel_speeds["fr"] & 0xFF,
                self.wheel_speeds["rl"] >> 8, self.wheel_speeds["rl"] & 0xFF,
                self.wheel_speeds["rr"] >> 8, self.wheel_speeds["rr"] & 0xFF,
            ])
            await self.can_bus.send_message(0x300, data)
            await asyncio.sleep(0.05)
