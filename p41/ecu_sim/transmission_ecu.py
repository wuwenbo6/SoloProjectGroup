import asyncio
import random
from .base_ecu import BaseECU
import logging

logger = logging.getLogger(__name__)


class TransmissionECU(BaseECU):
    def __init__(self, can_bus):
        super().__init__("Transmission", can_bus, tx_id=0x7E9, rx_id=0x7E1)
        self.gear_position = 1
        self.oil_temp = 70
        self.vehicle_speed = 0
        self._init_transmission_dids()
        self._init_transmission_dtcs()

    def _init_transmission_dids(self):
        self.set_did_value(0x2001, bytes([self.gear_position]))
        self.set_did_value(0x2002, self._temp_to_bytes(self.oil_temp))
        self.set_did_value(0x1002, self._speed_to_bytes(self.vehicle_speed))

    def _init_transmission_dtcs(self):
        self.add_dtc(0x0700, 0x2F, "Transmission Control System Malfunction")
        self.add_dtc(0x0702, 0x2F, "Gear Ratio Incorrect")

    def _temp_to_bytes(self, temp: int) -> bytes:
        return bytes([temp + 40])

    def _speed_to_bytes(self, speed: int) -> bytes:
        return bytes([speed >> 8, speed & 0xFF])

    async def start(self):
        await super().start()
        asyncio.create_task(self._simulate_transmission_data())
        asyncio.create_task(self._send_periodic_messages())

    async def _simulate_transmission_data(self):
        while self.running:
            self.vehicle_speed = random.randint(0, 180)
            self.oil_temp = 70 + random.randint(-10, 30)
            
            if self.vehicle_speed < 20:
                self.gear_position = random.randint(1, 2)
            elif self.vehicle_speed < 50:
                self.gear_position = random.randint(2, 3)
            elif self.vehicle_speed < 90:
                self.gear_position = random.randint(3, 4)
            else:
                self.gear_position = random.randint(4, 6)
            
            self.set_did_value(0x2001, bytes([self.gear_position]))
            self.set_did_value(0x2002, self._temp_to_bytes(self.oil_temp))
            self.set_did_value(0x1002, self._speed_to_bytes(self.vehicle_speed))
            
            await asyncio.sleep(0.1)

    async def _send_periodic_messages(self):
        while self.running:
            data = bytes([
                0x08,
                self.vehicle_speed >> 8, self.vehicle_speed & 0xFF,
                self.gear_position,
                self.oil_temp + 40,
                0x00, 0x00, 0x00
            ])
            await self.can_bus.send_message(0x200, data)
            await asyncio.sleep(0.1)
