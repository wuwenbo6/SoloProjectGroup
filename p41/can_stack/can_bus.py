import asyncio
from typing import Callable, List, Dict, Optional, Deque
from collections import deque
import logging
import json
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CANMessage:
    def __init__(self, arbitration_id: int, data: bytes, timestamp: Optional[float] = None):
        self.arbitration_id = arbitration_id
        self.data = data
        self.timestamp = timestamp or time.time()

    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "arbitration_id": f"0x{self.arbitration_id:03X}",
            "data": self.data.hex().upper(),
            "dlc": len(self.data)
        }

    def __repr__(self) -> str:
        return f"CANMessage(id=0x{self.arbitration_id:03X}, data={self.data.hex().upper()})"


class FairQueue:
    def __init__(self, max_burst: int = 3, min_bandwidth: int = 1):
        self.max_burst = max_burst
        self.min_bandwidth = min_bandwidth
        self.queues: Dict[int, Deque[CANMessage]] = {}
        self.active_senders: Deque[int] = deque()
        self.current_sender: Optional[int] = None
        self.consecutive_count = 0
        self._lock = asyncio.Lock()
        self._not_empty = asyncio.Event()

    async def put(self, msg: CANMessage):
        async with self._lock:
            sender_id = msg.arbitration_id
            if sender_id not in self.queues:
                self.queues[sender_id] = deque()
                self.active_senders.append(sender_id)
            self.queues[sender_id].append(msg)
            self._not_empty.set()

    async def get(self) -> Optional[CANMessage]:
        await self._not_empty.wait()
        
        async with self._lock:
            if not self.active_senders:
                self._not_empty.clear()
                return None

            if self.current_sender is None or self.consecutive_count >= self.max_burst:
                self._rotate_sender()
                self.consecutive_count = 0

            if self.current_sender and self.queues[self.current_sender]:
                msg = self.queues[self.current_sender].popleft()
                self.consecutive_count += 1

                if not self.queues[self.current_sender]:
                    self.active_senders.remove(self.current_sender)
                    del self.queues[self.current_sender]
                    self.current_sender = None
                    self.consecutive_count = 0

                if not self.active_senders:
                    self._not_empty.clear()

                return msg

            self._not_empty.clear()
            return None

    def _rotate_sender(self):
        if not self.active_senders:
            self.current_sender = None
            return
        
        if self.current_sender is not None:
            self.active_senders.append(self.active_senders.popleft())
        
        self.current_sender = self.active_senders[0]

    def qsize(self) -> int:
        return sum(len(q) for q in self.queues.values())

    def __len__(self) -> int:
        return self.qsize()


class VirtualCANBus:
    def __init__(self, channel: str = "vcan0", baud_rate: int = 500000):
        self.channel = channel
        self.baud_rate = baud_rate
        self.callbacks: List[Callable[[CANMessage], None]] = []
        self.load_callbacks: List[Callable[[float], None]] = []
        self.message_queue = FairQueue(max_burst=3)
        self.running = False
        self.message_history: List[CANMessage] = []
        self.max_history = 10000
        self._bus_lock = asyncio.Lock()
        self._interframe_gap = 0.0001
        
        self._load_window_seconds = 1.0
        self._window_bits = 0
        self._window_start = None
        self._current_load = 0.0

    def add_listener(self, callback: Callable[[CANMessage], None]):
        self.callbacks.append(callback)

    def remove_listener(self, callback: Callable[[CANMessage], None]):
        if callback in self.callbacks:
            self.callbacks.remove(callback)

    def add_load_listener(self, callback: Callable[[float], None]):
        self.load_callbacks.append(callback)

    def remove_load_listener(self, callback: Callable[[float], None]):
        if callback in self.load_callbacks:
            self.load_callbacks.remove(callback)

    def _calculate_message_bits(self, msg: CANMessage) -> int:
        data_length = len(msg.data)
        arbitration_id = msg.arbitration_id
        
        if arbitration_id > 0x7FF:
            base_bits = 67
        else:
            base_bits = 47
        
        data_bits = data_length * 8
        crc_bits = 15
        ack_bits = 2
        eof_bits = 7
        ifs_bits = 3
        
        total_bits = base_bits + data_bits + crc_bits + ack_bits + eof_bits + ifs_bits
        return total_bits

    def get_current_load(self) -> float:
        return self._current_load

    async def _update_load_rate(self, bits: int):
        now = asyncio.get_event_loop().time()
        
        if self._window_start is None:
            self._window_start = now
            self._window_bits = 0
        
        elapsed = now - self._window_start
        
        if elapsed >= self._load_window_seconds:
            max_bits = self.baud_rate * self._load_window_seconds
            self._current_load = min(100.0, (self._window_bits / max_bits) * 100)
            self._window_start = now
            self._window_bits = 0
            
            for callback in self.load_callbacks:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(self._current_load)
                    else:
                        callback(self._current_load)
                except Exception as e:
                    logger.error(f"Error in load callback: {e}")
        
        self._window_bits += bits

    async def send_message(self, arbitration_id: int, data: bytes):
        msg = CANMessage(arbitration_id, data)
        await self.message_queue.put(msg)
        logger.debug(f"Queued: {msg}")

    async def start(self):
        self.running = True
        logger.info(f"Virtual CAN bus {self.channel} started with fair queuing")
        while self.running:
            try:
                msg = await asyncio.wait_for(self.message_queue.get(), timeout=0.1)
                if msg:
                    await self._dispatch_message(msg)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing message: {e}")

    async def _dispatch_message(self, msg: CANMessage):
        async with self._bus_lock:
            self.message_history.append(msg)
            if len(self.message_history) > self.max_history:
                self.message_history = self.message_history[-self.max_history:]
            
            for callback in self.callbacks:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(msg)
                    else:
                        callback(msg)
                except Exception as e:
                    logger.error(f"Error in callback: {e}")
            
            message_bits = self._calculate_message_bits(msg)
            await self._update_load_rate(message_bits)
            
            await asyncio.sleep(self._interframe_gap)

    def stop(self):
        self.running = False
        logger.info(f"Virtual CAN bus {self.channel} stopped")

    def save_history(self, filename: str):
        history_data = [msg.to_dict() for msg in self.message_history]
        with open(filename, 'w') as f:
            json.dump(history_data, f, indent=2)
        logger.info(f"Saved {len(history_data)} messages to {filename}")

    def load_history(self, filename: str) -> List[CANMessage]:
        with open(filename, 'r') as f:
            history_data = json.load(f)
        messages = []
        for msg_data in history_data:
            arbitration_id = int(msg_data["arbitration_id"], 16)
            data = bytes.fromhex(msg_data["data"])
            timestamp = msg_data.get("timestamp", 0)
            messages.append(CANMessage(arbitration_id, data, timestamp))
        logger.info(f"Loaded {len(messages)} messages from {filename}")
        return messages

    def get_queue_stats(self) -> Dict:
        return {
            "total_queued": self.message_queue.qsize(),
            "active_senders": len(self.message_queue.queues),
            "senders": [
                f"0x{id:03X}: {len(q)} msgs" 
                for id, q in self.message_queue.queues.items()
            ]
        }

    async def replay_history(self, messages: List[CANMessage], speed: float = 1.0, callback=None) -> bool:
        if not messages:
            logger.warning("No messages to replay")
            return False

        logger.info(f"Starting replay: {len(messages)} messages at {speed}x speed")
        
        self._replay_running = True
        self._replay_paused = False

        for i, msg in enumerate(messages):
            while self._replay_paused:
                await asyncio.sleep(0.01)
                if not self._replay_running:
                    logger.info("Replay stopped")
                    return False

            if not self._replay_running:
                logger.info("Replay stopped")
                return False

            if i > 0:
                time_diff = messages[i].timestamp - messages[i-1].timestamp
                if time_diff > 0 and speed > 0:
                    await asyncio.sleep(time_diff / speed)

            await self.message_queue.put(msg)

            if callback:
                callback(msg, i, len(messages))

        logger.info(f"Replay completed: {len(messages)} messages")
        self._replay_running = False
        return True

    def stop_replay(self):
        self._replay_running = False

    def pause_replay(self):
        self._replay_paused = True

    def resume_replay(self):
        self._replay_paused = False

    def get_replay_status(self) -> Dict:
        return {
            "running": getattr(self, '_replay_running', False),
            "paused": getattr(self, '_replay_paused', False)
        }
