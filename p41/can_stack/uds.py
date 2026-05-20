from enum import IntEnum
from typing import Optional, Dict, List


class UDSService(IntEnum):
    DIAGNOSTIC_SESSION_CONTROL = 0x10
    ECU_RESET = 0x11
    READ_DTC_INFORMATION = 0x19
    READ_DATA_BY_IDENTIFIER = 0x22
    READ_MEMORY_BY_ADDRESS = 0x23
    WRITE_DATA_BY_IDENTIFIER = 0x2E
    INPUT_OUTPUT_CONTROL_BY_IDENTIFIER = 0x2F
    NEGATIVE_RESPONSE = 0x7F


class NRC(IntEnum):
    GENERAL_REJECT = 0x10
    SERVICE_NOT_SUPPORTED = 0x11
    SUB_FUNCTION_NOT_SUPPORTED = 0x12
    INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT = 0x13
    RESPONSE_TOO_LONG = 0x14
    BUSY_REPEAT_REQUEST = 0x21
    CONDITIONS_NOT_CORRECT = 0x22
    REQUEST_SEQUENCE_ERROR = 0x24
    NO_RESPONSE_FROM_SUBNET_COMPONENT = 0x25
    FAILURE_PREVENTS_EXECUTION_OF_REQUESTED_ACTION = 0x26
    REQUEST_OUT_OF_RANGE = 0x31
    SECURITY_ACCESS_DENIED = 0x33
    INVALID_KEY = 0x35
    EXCEEDED_NUMBER_OF_ATTEMPTS = 0x36
    REQUIRED_TIME_DELAY_NOT_EXPIRED = 0x37
    UPLOAD_DOWNLOAD_NOT_ACCEPTED = 0x70
    TRANSFER_DATA_SUSPENDED = 0x71
    GENERAL_PROGRAMMING_FAILURE = 0x72
    WRONG_BLOCK_SEQUENCE_COUNTER = 0x73
    RESPONSE_PENDING = 0x78
    SUB_FUNCTION_NOT_SUPPORTED_IN_ACTIVE_SESSION = 0x7E
    SERVICE_NOT_SUPPORTED_IN_ACTIVE_SESSION = 0x7F


class UDSMessage:
    def __init__(self, service_id: int, data: bytes = b'', is_response: bool = False):
        self.service_id = service_id
        self.data = data
        self.is_response = is_response

    @classmethod
    def from_bytes(cls, raw_data: bytes) -> 'UDSMessage':
        if len(raw_data) < 1:
            raise ValueError("Invalid UDS message: too short")
        
        service_id = raw_data[0]
        is_response = service_id >= 0x40
        if is_response:
            service_id -= 0x40
        
        return cls(service_id, raw_data[1:], is_response)

    def to_bytes(self) -> bytes:
        service_id = self.service_id
        if self.is_response:
            service_id += 0x40
        return bytes([service_id]) + self.data

    def get_service_name(self) -> str:
        try:
            return UDSService(self.service_id).name
        except ValueError:
            return f"UNKNOWN_0x{self.service_id:02X}"

    def __repr__(self) -> str:
        return f"UDSMessage(service=0x{self.service_id:02X} ({self.get_service_name()}), data={self.data.hex().upper()}, is_response={self.is_response})"


class DTC:
    def __init__(self, dtc_code: int, status: int, description: str = ""):
        self.dtc_code = dtc_code
        self.status = status
        self.description = description

    def to_dict(self) -> Dict:
        return {
            "dtc_code": f"P{self.dtc_code:04X}",
            "status": f"0x{self.status:02X}",
            "description": self.description
        }


class DataIdentifier:
    DID_MAP = {
        0xF186: "Active Diagnostic Session",
        0xF187: "Software Identification",
        0xF190: "VIN - Vehicle Identification Number",
        0x1001: "Engine RPM",
        0x1002: "Vehicle Speed",
        0x1003: "Coolant Temperature",
        0x1004: "Throttle Position",
        0x1005: "Fuel Level",
        0x2001: "Gear Position",
        0x2002: "Transmission Oil Temperature",
        0x3001: "Wheel Speed Front Left",
        0x3002: "Wheel Speed Front Right",
        0x3003: "Wheel Speed Rear Left",
        0x3004: "Wheel Speed Rear Right",
    }

    @classmethod
    def get_name(cls, did: int) -> str:
        return cls.DID_MAP.get(did, f"Unknown DID 0x{did:04X}")
