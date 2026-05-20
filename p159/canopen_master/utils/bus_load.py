import time
import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Optional, Deque
from enum import IntEnum


class FrameType(IntEnum):
    DATA = 0
    REMOTE = 1
    ERROR = 2
    OVERLOAD = 3


@dataclass
class BusStatistics:
    frame_count: int = 0
    byte_count: int = 0
    error_count: int = 0
    bus_load: float = 0.0
    peak_load: float = 0.0
    average_load: float = 0.0
    tx_count: int = 0
    rx_count: int = 0
    pdo_count: int = 0
    sdo_count: int = 0
    nmt_count: int = 0
    lss_count: int = 0
    other_count: int = 0
    sampling_start: float = 0.0
    sampling_duration: float = 0.0


@dataclass
class FrameRecord:
    timestamp: float
    arb_id: int
    dlc: int
    is_extended: bool
    is_remote: bool
    is_error: bool
    bits: int
    direction: str = "RX"


class BusLoadMonitor:
    def __init__(self, bitrate: int = 250000, sampling_window: float = 1.0, 
                 history_size: int = 60):
        self.bitrate = bitrate
        self.sampling_window = sampling_window
        self.history_size = history_size
        
        self._current_window_start: float = time.time()
        self._current_window_frames: Deque[FrameRecord] = deque()
        self._load_history: Deque[float] = deque(maxlen=history_size)
        
        self._stats = BusStatistics()
        self._lock = threading.RLock()
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
        
        self._frame_type_counters = {
            "PDO": 0,
            "SDO": 0,
            "NMT": 0,
            "LSS": 0,
            "OTHER": 0
        }

    def _calculate_frame_bits(self, arb_id: int, dlc: int, 
                              is_extended: bool, is_remote: bool) -> int:
        if is_remote:
            if is_extended:
                return 55 + 18
            else:
                return 43 + 18
        
        if is_extended:
            overhead = 67
        else:
            overhead = 47
        
        stuff_bits = min((overhead + dlc * 8) // 4, 8)
        
        return overhead + dlc * 8 + stuff_bits

    def _classify_frame(self, arb_id: int) -> str:
        function_code = (arb_id >> 7) & 0xF
        
        if function_code == 0:
            return "NMT"
        elif function_code == 0x2:
            return "SYNC"
        elif function_code == 0x3:
            return "TIME"
        elif function_code >= 0x4 and function_code <= 0x7:
            return "TPDO"
        elif function_code >= 0x8 and function_code <= 0xB:
            return "RPDO"
        elif function_code == 0xC:
            return "SDO"
        elif function_code == 0xD:
            return "SDO"
        elif function_code == 0xE:
            node_id = arb_id & 0x7F
            if node_id == 0:
                return "LSS"
            else:
                return "NMT_ERROR"
        elif function_code == 0xF:
            return "HEARTBEAT"
        else:
            return "OTHER"

    def on_message(self, arb_id: int, dlc: int, is_extended: bool = False,
                   is_remote: bool = False, is_error: bool = False,
                   direction: str = "RX") -> None:
        with self._lock:
            now = time.time()
            
            bits = self._calculate_frame_bits(arb_id, dlc, is_extended, is_remote)
            
            if now - self._current_window_start >= self.sampling_window:
                self._rotate_window(now)
            
            frame = FrameRecord(
                timestamp=now,
                arb_id=arb_id,
                dlc=dlc,
                is_extended=is_extended,
                is_remote=is_remote,
                is_error=is_error,
                bits=bits,
                direction=direction
            )
            
            self._current_window_frames.append(frame)
            
            self._stats.frame_count += 1
            self._stats.byte_count += dlc
            
            if is_error:
                self._stats.error_count += 1
            
            if direction == "TX":
                self._stats.tx_count += 1
            else:
                self._stats.rx_count += 1
            
            frame_type = self._classify_frame(arb_id)
            if "PDO" in frame_type:
                self._stats.pdo_count += 1
            elif "SDO" in frame_type:
                self._stats.sdo_count += 1
            elif "NMT" in frame_type:
                self._stats.nmt_count += 1
            elif "LSS" in frame_type:
                self._stats.lss_count += 1
            else:
                self._stats.other_count += 1

    def _rotate_window(self, now: float) -> None:
        window_duration = now - self._current_window_start
        if window_duration <= 0:
            return
        
        total_bits = sum(f.bits for f in self._current_window_frames)
        load = (total_bits / window_duration) / self.bitrate * 100.0
        
        self._load_history.append(load)
        
        self._current_window_frames.clear()
        self._current_window_start = now

    def get_current_load(self) -> float:
        with self._lock:
            now = time.time()
            window_duration = now - self._current_window_start
            
            if window_duration <= 0:
                return 0.0
            
            total_bits = sum(f.bits for f in self._current_window_frames)
            load = (total_bits / window_duration) / self.bitrate * 100.0
            
            return min(load, 100.0)

    def get_peak_load(self) -> float:
        with self._lock:
            if not self._load_history:
                return self.get_current_load()
            return max(max(self._load_history), self.get_current_load())

    def get_average_load(self, window: Optional[float] = None) -> float:
        with self._lock:
            if not self._load_history:
                return self.get_current_load()
            
            if window is None:
                samples = list(self._load_history)
            else:
                num_samples = min(int(window / self.sampling_window), 
                                  len(self._load_history))
                samples = list(self._load_history)[-num_samples:]
            
            if not samples:
                return self.get_current_load()
            
            return sum(samples) / len(samples)

    def get_statistics(self) -> BusStatistics:
        with self._lock:
            stats = BusStatistics()
            stats.frame_count = self._stats.frame_count
            stats.byte_count = self._stats.byte_count
            stats.error_count = self._stats.error_count
            stats.bus_load = self.get_current_load()
            stats.peak_load = self.get_peak_load()
            stats.average_load = self.get_average_load()
            stats.tx_count = self._stats.tx_count
            stats.rx_count = self._stats.rx_count
            stats.pdo_count = self._stats.pdo_count
            stats.sdo_count = self._stats.sdo_count
            stats.nmt_count = self._stats.nmt_count
            stats.lss_count = self._stats.lss_count
            stats.other_count = self._stats.other_count
            stats.sampling_start = self._stats.sampling_start
            stats.sampling_duration = time.time() - self._stats.sampling_start
            return stats

    def get_frame_rate(self, window: Optional[float] = None) -> float:
        with self._lock:
            if window is None:
                window = self.sampling_window
            
            num_frames = len([
                f for f in self._current_window_frames
                if time.time() - f.timestamp <= window
            ])
            
            if window <= 0:
                return 0.0
            
            return num_frames / window

    def get_data_rate(self, window: Optional[float] = None) -> float:
        with self._lock:
            if window is None:
                window = self.sampling_window
            
            total_bytes = sum(
                f.dlc for f in self._current_window_frames
                if time.time() - f.timestamp <= window
            )
            
            if window <= 0:
                return 0.0
            
            return total_bytes / window

    def reset(self) -> None:
        with self._lock:
            self._current_window_start = time.time()
            self._current_window_frames.clear()
            self._load_history.clear()
            self._stats = BusStatistics()
            self._stats.sampling_start = time.time()
            self._frame_type_counters = {
                "PDO": 0,
                "SDO": 0,
                "NMT": 0,
                "LSS": 0,
                "OTHER": 0
            }

    def start(self) -> None:
        if self._running:
            return
        
        self._running = True
        self._stats.sampling_start = time.time()

    def stop(self) -> None:
        self._running = False

    def get_load_history(self) -> list[float]:
        with self._lock:
            return list(self._load_history)

    def format_stats(self) -> str:
        stats = self.get_statistics()
        lines = [
            "=" * 50,
            "CAN Bus Statistics",
            "=" * 50,
            f"Current Load:   {stats.bus_load:.2f}%",
            f"Peak Load:      {stats.peak_load:.2f}%",
            f"Average Load:   {stats.average_load:.2f}%",
            "",
            f"Total Frames:   {stats.frame_count}",
            f"  TX:           {stats.tx_count}",
            f"  RX:           {stats.rx_count}",
            f"  Errors:       {stats.error_count}",
            "",
            f"Frame Types:",
            f"  PDO:          {stats.pdo_count}",
            f"  SDO:          {stats.sdo_count}",
            f"  NMT:          {stats.nmt_count}",
            f"  LSS:          {stats.lss_count}",
            f"  Other:        {stats.other_count}",
            "",
            f"Total Bytes:    {stats.byte_count}",
            f"Sampling Time:  {stats.sampling_duration:.1f}s",
            "=" * 50,
        ]
        return "\n".join(lines)
