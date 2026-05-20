import uuid
import hashlib
import time
from datetime import datetime
from typing import Optional


def generate_trace_code(batch_id: str, code_type: str = "qrcode", counter: int = 0) -> str:
    timestamp_ns = time.time_ns()
    timestamp_str = f"{timestamp_ns:016d}"
    random_str = str(uuid.uuid4()).replace("-", "")[:12]
    counter_str = f"{counter:04d}" if counter > 0 else ""
    raw_code = f"TC{batch_id}{timestamp_str}{random_str}{counter_str}"
    hash_obj = hashlib.sha256(raw_code.encode())
    hash_hex = hash_obj.hexdigest()[:20].upper()
    return f"TC{timestamp_str[-12:]}{hash_hex}"


def verify_trace_code_format(trace_code: str) -> bool:
    if not trace_code:
        return False
    if not trace_code.startswith("TC"):
        return False
    if len(trace_code) < 28:
        return False
    return True
