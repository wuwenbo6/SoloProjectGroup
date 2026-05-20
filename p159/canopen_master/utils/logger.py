import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import Optional
import os
from pathlib import Path
from colorama import Fore, Style, init

init(autoreset=True)


class CANopenLogger:
    def __init__(self, name: str = "canopen_master", log_dir: str = "logs", 
                 console_level: int = logging.INFO, file_level: int = logging.DEBUG):
        self.name = name
        self.log_dir = Path(log_dir)
        self.console_level = console_level
        self.file_level = file_level
        self.logger: Optional[logging.Logger] = None
        self._setup_logger()

    def _setup_logger(self) -> None:
        self.logger = logging.getLogger(self.name)
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers.clear()

        self.log_dir.mkdir(exist_ok=True)
        log_file = self.log_dir / f"canopen_{datetime.now().strftime('%Y%m%d')}.log"

        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(self.file_level)
        file_formatter = logging.Formatter(
            '%(asctime)s.%(msecs)03d [%(levelname)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)

        console_handler = logging.StreamHandler()
        console_handler.setLevel(self.console_level)
        console_formatter = ColoredFormatter(
            '%(asctime)s.%(msecs)03d [%(levelname)s] %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)

    def debug(self, message: str) -> None:
        if self.logger:
            self.logger.debug(message)

    def info(self, message: str) -> None:
        if self.logger:
            self.logger.info(message)

    def warning(self, message: str) -> None:
        if self.logger:
            self.logger.warning(message)

    def error(self, message: str) -> None:
        if self.logger:
            self.logger.error(message)

    def critical(self, message: str) -> None:
        if self.logger:
            self.logger.critical(message)

    def log_can_message(self, cob_id: int, data: bytes, direction: str = "RX") -> None:
        hex_data = ' '.join(f'{b:02X}' for b in data)
        direction_str = "→" if direction == "TX" else "←"
        self.debug(f"{direction_str} COB-ID=0x{cob_id:03X} [{len(data)}] {hex_data}")

    def log_nmt(self, node_id: int, command: str) -> None:
        self.info(f"NMT: Node {node_id} → {command}")

    def log_sdo(self, node_id: int, index: int, subindex: int, 
                operation: str, data: Optional[bytes] = None) -> None:
        if data:
            hex_data = ' '.join(f'{b:02X}' for b in data)
            self.debug(f"SDO [{operation}] Node={node_id} 0x{index:04X}:{subindex:02X} Data={hex_data}")
        else:
            self.debug(f"SDO [{operation}] Node={node_id} 0x{index:04X}:{subindex:02X}")

    def log_pdo(self, cob_id: int, data: bytes, pdo_type: str = "TPDO") -> None:
        hex_data = ' '.join(f'{b:02X}' for b in data)
        self.debug(f"{pdo_type} 0x{cob_id:03X} [{len(data)}] {hex_data}")

    def log_heartbeat(self, node_id: int, state: str) -> None:
        self.debug(f"Heartbeat: Node {node_id} state={state}")

    def log_error(self, error_type: str, message: str) -> None:
        self.error(f"{error_type}: {message}")


class ColoredFormatter(logging.Formatter):
    LEVEL_COLORS = {
        logging.DEBUG: Fore.CYAN,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Fore.RED + Style.BRIGHT,
    }

    def format(self, record):
        color = self.LEVEL_COLORS.get(record.levelno, Fore.WHITE)
        record.levelname = f"{color}{record.levelname}{Style.RESET_ALL}"
        return super().format(record)


class Logger:
    _instance: Optional[CANopenLogger] = None

    @classmethod
    def get_instance(cls, **kwargs) -> CANopenLogger:
        if cls._instance is None:
            cls._instance = CANopenLogger(**kwargs)
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        cls._instance = None


def get_logger(**kwargs) -> CANopenLogger:
    return Logger.get_instance(**kwargs)
