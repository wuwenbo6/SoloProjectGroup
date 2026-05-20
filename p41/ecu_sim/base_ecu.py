import asyncio
from typing import Dict, Optional, List, Set
import logging
from can_stack.uds import UDSMessage, UDSService, NRC, DTC, DataIdentifier
from can_stack.tp_layer import TPLayer
from can_stack.can_bus import CANMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SessionLevel:
    DEFAULT = 0x01
    PROGRAMMING = 0x02
    EXTENDED = 0x03
    
    SESSION_NAMES = {
        DEFAULT: "默认会话",
        PROGRAMMING: "编程会话",
        EXTENDED: "扩展会话",
    }
    
    @classmethod
    def get_name(cls, level: int) -> str:
        return cls.SESSION_NAMES.get(level, f"未知会话(0x{level:02X})")


class BaseECU:
    def __init__(self, name: str, can_bus, tx_id: int, rx_id: int):
        self.name = name
        self.can_bus = can_bus
        self.tx_id = tx_id
        self.rx_id = rx_id
        self.tp = TPLayer(can_bus, rx_id, tx_id)
        self.tp.set_receive_callback(self._on_uds_message_received)
        
        self.dtcs: List[DTC] = []
        self.data_identifiers: Dict[int, bytes] = {}
        self.active_session = SessionLevel.DEFAULT
        self.running = False
        
        self._init_default_dids()
        self._init_service_permissions()

    def _init_default_dids(self):
        self.data_identifiers[0xF186] = bytes([0x01])
        self.data_identifiers[0xF187] = b"SW_v1.0.0"
        self.data_identifiers[0xF190] = b"1HGBH41JXMN109186"
        self.data_identifiers[0x1234] = b"WritableData_01"

    def _init_service_permissions(self):
        self.service_session_requirements: Dict[int, int] = {
            UDSService.DIAGNOSTIC_SESSION_CONTROL: SessionLevel.DEFAULT,
            UDSService.ECU_RESET: SessionLevel.DEFAULT,
            UDSService.READ_DTC_INFORMATION: SessionLevel.DEFAULT,
            UDSService.READ_DATA_BY_IDENTIFIER: SessionLevel.DEFAULT,
            UDSService.WRITE_DATA_BY_IDENTIFIER: SessionLevel.PROGRAMMING,
            UDSService.INPUT_OUTPUT_CONTROL_BY_IDENTIFIER: SessionLevel.EXTENDED,
        }
        
        self.did_write_session_requirements: Dict[int, int] = {
            0xF187: SessionLevel.PROGRAMMING,
            0x1234: SessionLevel.PROGRAMMING,
        }

    def _check_service_permission(self, service_id: int) -> bool:
        required_level = self.service_session_requirements.get(service_id)
        if required_level is None:
            return True
        return self.active_session >= required_level

    def _check_did_write_permission(self, did: int) -> bool:
        required_level = self.did_write_session_requirements.get(did)
        if required_level is None:
            return False
        return self.active_session >= required_level

    async def start(self):
        self.running = True
        self.can_bus.add_listener(self._on_can_message)
        logger.info(f"{self.name} ECU started, TX=0x{self.tx_id:03X}, RX=0x{self.rx_id:03X}")

    def stop(self):
        self.running = False
        logger.info(f"{self.name} ECU stopped")

    async def _on_can_message(self, msg: CANMessage):
        if msg.arbitration_id == self.rx_id:
            await self.tp.process_received_frame(msg.arbitration_id, msg.data)

    def _on_uds_message_received(self, raw_data: bytes):
        asyncio.create_task(self._process_uds_message(raw_data))

    async def _process_uds_message(self, raw_data: bytes):
        try:
            request = UDSMessage.from_bytes(raw_data)
            logger.info(f"{self.name} received: {request}")
            
            response = await self._handle_uds_request(request)
            if response:
                response_data = response.to_bytes()
                await self.tp.send_data(response_data)
                logger.info(f"{self.name} sent response: {response}")
        except Exception as e:
            logger.error(f"Error processing UDS message: {e}")

    async def _handle_uds_request(self, request: UDSMessage) -> Optional[UDSMessage]:
        handler_map = {
            UDSService.DIAGNOSTIC_SESSION_CONTROL: self._handle_session_control,
            UDSService.ECU_RESET: self._handle_ecu_reset,
            UDSService.READ_DTC_INFORMATION: self._handle_read_dtc,
            UDSService.READ_DATA_BY_IDENTIFIER: self._handle_read_data_by_id,
            UDSService.WRITE_DATA_BY_IDENTIFIER: self._handle_write_data_by_id,
            UDSService.INPUT_OUTPUT_CONTROL_BY_IDENTIFIER: self._handle_io_control,
        }
        
        if not self._check_service_permission(request.service_id):
            required_level = self.service_session_requirements.get(request.service_id, SessionLevel.DEFAULT)
            logger.warning(f"{self.name}: Service 0x{request.service_id:02X} requires {SessionLevel.get_name(required_level)}")
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.SERVICE_NOT_SUPPORTED_IN_ACTIVE_SESSION]),
                is_response=True
            )
        
        handler = handler_map.get(request.service_id)
        if handler:
            return await handler(request)
        else:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.SERVICE_NOT_SUPPORTED]),
                is_response=True
            )

    async def _handle_session_control(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 1:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        session_type = request.data[0]
        
        if session_type not in [SessionLevel.DEFAULT, SessionLevel.PROGRAMMING, SessionLevel.EXTENDED]:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.SUB_FUNCTION_NOT_SUPPORTED]),
                is_response=True
            )
        
        self.active_session = session_type
        self.data_identifiers[0xF186] = bytes([session_type])
        
        if session_type == SessionLevel.DEFAULT:
            p2_server = 0x0032
            p2_star_server = 0x01F4
        elif session_type == SessionLevel.PROGRAMMING:
            p2_server = 0x00C8
            p2_star_server = 0x03E8
        else:
            p2_server = 0x0064
            p2_star_server = 0x07D0
        
        logger.info(f"{self.name}: Session changed to {SessionLevel.get_name(session_type)}")
        
        return UDSMessage(
            UDSService.DIAGNOSTIC_SESSION_CONTROL,
            bytes([
                session_type,
                (p2_server >> 8) & 0xFF, p2_server & 0xFF,
                (p2_star_server >> 8) & 0xFF, p2_star_server & 0xFF
            ]),
            is_response=True
        )

    async def _handle_write_data_by_id(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 2:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        did = (request.data[0] << 8) | request.data[1]
        new_value = request.data[2:]
        
        if did not in self.data_identifiers:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.REQUEST_OUT_OF_RANGE]),
                is_response=True
            )
        
        if not self._check_did_write_permission(did):
            required_level = self.did_write_session_requirements.get(did, SessionLevel.PROGRAMMING)
            logger.warning(f"{self.name}: DID 0x{did:04X} write requires {SessionLevel.get_name(required_level)}")
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.SECURITY_ACCESS_DENIED]),
                is_response=True
            )
        
        self.data_identifiers[did] = new_value
        logger.info(f"{self.name}: DID 0x{did:04X} updated to {new_value.hex()}")
        
        return UDSMessage(
            UDSService.WRITE_DATA_BY_IDENTIFIER,
            bytes([request.data[0], request.data[1]]),
            is_response=True
        )

    async def _handle_io_control(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 3:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        did = (request.data[0] << 8) | request.data[1]
        control_param = request.data[2]
        
        control_states = {
            0x00: "返回控制",
            0x01: "复位默认",
            0x02: "冻结当前",
            0x03: "调整输出",
        }
        
        logger.info(f"{self.name}: IO Control DID=0x{did:04X}, Param=0x{control_param:02X} ({control_states.get(control_param, '未知')})")
        
        return UDSMessage(
            UDSService.INPUT_OUTPUT_CONTROL_BY_IDENTIFIER,
            bytes([request.data[0], request.data[1], control_param]),
            is_response=True
        )

    async def _handle_ecu_reset(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 1:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        reset_type = request.data[0]
        return UDSMessage(
            UDSService.ECU_RESET,
            bytes([reset_type]),
            is_response=True
        )

    async def _handle_read_dtc(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 1:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        sub_function = request.data[0]
        
        if sub_function == 0x02:
            status_mask = request.data[1] if len(request.data) > 1 else 0xFF
            dtc_count = len(self.dtcs)
            response_data = bytes([0x02, status_mask])
            for dtc in self.dtcs:
                response_data += bytes([
                    (dtc.dtc_code >> 16) & 0xFF,
                    (dtc.dtc_code >> 8) & 0xFF,
                    dtc.dtc_code & 0xFF,
                    dtc.status
                ])
            return UDSMessage(UDSService.READ_DTC_INFORMATION, response_data, is_response=True)
        elif sub_function == 0x01:
            status_mask = request.data[1] if len(request.data) > 1 else 0xFF
            dtc_count = len(self.dtcs)
            return UDSMessage(
                UDSService.READ_DTC_INFORMATION,
                bytes([0x01, status_mask, dtc_count >> 8, dtc_count & 0xFF]),
                is_response=True
            )
        else:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.SUB_FUNCTION_NOT_SUPPORTED]),
                is_response=True
            )

    async def _handle_read_data_by_id(self, request: UDSMessage) -> UDSMessage:
        if len(request.data) < 2:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.INCORRECT_MESSAGE_LENGTH_OR_INVALID_FORMAT]),
                is_response=True
            )
        
        did = (request.data[0] << 8) | request.data[1]
        
        if did in self.data_identifiers:
            return UDSMessage(
                UDSService.READ_DATA_BY_IDENTIFIER,
                bytes([request.data[0], request.data[1]]) + self.data_identifiers[did],
                is_response=True
            )
        else:
            return UDSMessage(
                UDSService.NEGATIVE_RESPONSE,
                bytes([request.service_id, NRC.REQUEST_OUT_OF_RANGE]),
                is_response=True
            )

    def add_dtc(self, dtc_code: int, status: int, description: str = ""):
        self.dtcs.append(DTC(dtc_code, status, description))

    def clear_dtcs(self):
        self.dtcs.clear()

    def set_did_value(self, did: int, value: bytes):
        self.data_identifiers[did] = value
