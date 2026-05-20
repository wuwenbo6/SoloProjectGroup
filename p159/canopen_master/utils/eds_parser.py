import configparser
import re
from dataclasses import dataclass, field
from typing import Dict, Optional, Any, List
from pathlib import Path


@dataclass
class ObjectEntry:
    index: int
    subindex: int
    name: str
    object_type: str
    data_type: str
    access: str = ""
    default_value: Any = None
    pdo_mappable: bool = False
    low_limit: Optional[Any] = None
    high_limit: Optional[Any] = None
    description: str = ""


@dataclass
class ObjectDictionary:
    device_name: str = ""
    device_type: int = 0
    vendor_id: int = 0
    product_code: int = 0
    revision_number: int = 0
    objects: Dict[str, ObjectEntry] = field(default_factory=dict)

    def get_object(self, index: int, subindex: int = 0) -> Optional[ObjectEntry]:
        key = f"{index:04X}:{subindex:02X}"
        return self.objects.get(key)

    def add_object(self, obj: ObjectEntry) -> None:
        key = f"{obj.index:04X}:{obj.subindex:02X}"
        self.objects[key] = obj


class EDSParser:
    DATA_TYPES = {
        0x0001: "BOOL",
        0x0002: "INT8",
        0x0003: "INT16",
        0x0004: "INT32",
        0x0005: "UINT8",
        0x0006: "UINT16",
        0x0007: "UINT32",
        0x0008: "REAL32",
        0x0009: "VISIBLE_STRING",
        0x000A: "OCTET_STRING",
        0x000B: "UNICODE_STRING",
        0x000C: "TIME_OF_DAY",
        0x000D: "TIME_DIFFERENCE",
        0x000F: "DOMAIN",
        0x0010: "INT24",
        0x0011: "REAL64",
        0x0012: "INT40",
        0x0013: "INT48",
        0x0014: "INT56",
        0x0015: "INT64",
        0x0016: "UINT24",
        0x0018: "UINT40",
        0x0019: "UINT48",
        0x001A: "UINT56",
        0x001B: "UINT64",
    }

    def __init__(self):
        self.config = configparser.ConfigParser(
            interpolation=None,
            strict=False
        )
        self.object_dict = ObjectDictionary()

    def parse(self, eds_file: str) -> ObjectDictionary:
        path = Path(eds_file)
        if not path.exists():
            raise FileNotFoundError(f"EDS file not found: {eds_file}")

        with open(path, 'r', encoding='latin-1') as f:
            content = f.read()

        self.config.read_string(content)
        self._parse_device_info()
        self._parse_objects()
        
        return self.object_dict

    def _parse_device_info(self) -> None:
        if 'DeviceInfo' in self.config:
            di = self.config['DeviceInfo']
            self.object_dict.device_name = di.get('ProductName', '')
            self.object_dict.vendor_id = self._parse_int(di.get('VendorID', '0'))
            self.object_dict.product_code = self._parse_int(di.get('ProductCode', '0'))
            self.object_dict.revision_number = self._parse_int(di.get('RevisionNumber', '0'))

        if 'DeviceComissioning' in self.config:
            dc = self.config['DeviceComissioning']
            self.object_dict.device_type = self._parse_int(dc.get('NodeID', '0'))

    def _parse_objects(self) -> None:
        for section_name in self.config.sections():
            if section_name.startswith('[') and section_name.endswith(']'):
                section_name = section_name[1:-1]
            
            if self._is_index_section(section_name):
                self._parse_index_section(section_name)

    def _is_index_section(self, name: str) -> bool:
        return bool(re.match(r'^[0-9A-Fa-f]{4}$', name))

    def _parse_index_section(self, index_str: str) -> None:
        index = int(index_str, 16)
        section = self.config[index_str]
        
        object_type = section.get('ObjectType', '')
        if object_type in ['7', '8', '9']:
            self._parse_compact_object(index, section)
        elif object_type in ['0', '1', '2', '5', '6']:
            self._parse_simple_object(index, section)
        else:
            subindex_count = self._parse_int(section.get('SubNumber', '0'))
            for subindex in range(subindex_count):
                self._parse_subobject(index, subindex)

    def _parse_simple_object(self, index: int, section) -> None:
        data_type_raw = self._parse_int(section.get('DataType', '0'))
        data_type = self.DATA_TYPES.get(data_type_raw, f"UNKNOWN_{data_type_raw:04X}")
        
        obj = ObjectEntry(
            index=index,
            subindex=0,
            name=section.get('ParameterName', f'Object_{index:04X}'),
            object_type=section.get('ObjectType', '0'),
            data_type=data_type,
            access=section.get('AccessType', 'ro'),
            default_value=self._parse_value(section.get('DefaultValue'), data_type),
            pdo_mappable=self._parse_bool(section.get('PDOMapping', '0')),
            description=section.get('Description', '')
        )
        self.object_dict.add_object(obj)

    def _parse_compact_object(self, index: int, section) -> None:
        subindex_count = self._parse_int(section.get('SubNumber', '0'))
        if subindex_count == 0:
            for key, value in section.items():
                if re.match(r'^[0-9A-Fa-f]{1,2}$', key):
                    subindex_count = max(subindex_count, int(key, 16) + 1)

        for subindex in range(subindex_count):
            subobj = ObjectEntry(
                index=index,
                subindex=subindex,
                name=section.get(f'ParameterName{subindex}', f'{index:04X}_{subindex:02X}'),
                object_type=section.get(f'ObjectType{subindex}', section.get('ObjectType', '7')),
                data_type=self.DATA_TYPES.get(
                    self._parse_int(section.get(f'DataType{subindex}', section.get('DataType', '0'))),
                    f"UNKNOWN_{self._parse_int(section.get(f'DataType{subindex}', '0')):04X}"
                ),
                access=section.get(f'AccessType{subindex}', section.get('AccessType', 'ro')),
                default_value=self._parse_value(
                    section.get(f'DefaultValue{subindex}', section.get('DefaultValue')),
                    self.DATA_TYPES.get(self._parse_int(section.get('DataType', '0')), '')
                ),
                pdo_mappable=self._parse_bool(section.get(f'PDOMapping{subindex}', '0')),
                description=section.get(f'Description{subindex}', '')
            )
            self.object_dict.add_object(subobj)

    def _parse_subobject(self, index: int, subindex: int) -> None:
        section_name = f"{index:04X}sub{subindex:1X}" if subindex < 10 else f"{index:04X}sub{subindex:02X}"
        
        if section_name not in self.config:
            for sn in self.config.sections():
                if sn.lower() == section_name.lower():
                    section_name = sn
                    break
        
        if section_name in self.config:
            section = self.config[section_name]
            data_type_raw = self._parse_int(section.get('DataType', '0'))
            data_type = self.DATA_TYPES.get(data_type_raw, f"UNKNOWN_{data_type_raw:04X}")
            
            obj = ObjectEntry(
                index=index,
                subindex=subindex,
                name=section.get('ParameterName', f'{index:04X}:{subindex:02X}'),
                object_type=section.get('ObjectType', '0'),
                data_type=data_type,
                access=section.get('AccessType', 'ro'),
                default_value=self._parse_value(section.get('DefaultValue'), data_type),
                pdo_mappable=self._parse_bool(section.get('PDOMapping', '0')),
                low_limit=self._parse_value(section.get('LowLimit'), data_type),
                high_limit=self._parse_value(section.get('HighLimit'), data_type),
                description=section.get('Description', '')
            )
            self.object_dict.add_object(obj)

    def _parse_int(self, value: Optional[str]) -> int:
        if value is None or value == '':
            return 0
        value = value.strip()
        if value.startswith('0x') or value.startswith('0X'):
            return int(value[2:], 16)
        if value.startswith('#'):
            return int(value[1:], 16)
        try:
            return int(value, 0)
        except ValueError:
            return 0

    def _parse_bool(self, value: Optional[str]) -> bool:
        if value is None:
            return False
        value = value.strip().lower()
        return value in ['1', 'true', 'yes', 'on']

    def _parse_value(self, value: Optional[str], data_type: str) -> Any:
        if value is None or value == '':
            return None
        
        value = value.strip()
        
        if data_type in ['BOOL']:
            return self._parse_bool(value)
        elif data_type in ['INT8', 'INT16', 'INT32', 'INT24', 'INT40', 'INT48', 'INT56', 'INT64']:
            return self._parse_int(value)
        elif data_type in ['UINT8', 'UINT16', 'UINT32', 'UINT24', 'UINT40', 'UINT48', 'UINT56', 'UINT64']:
            return self._parse_int(value)
        elif data_type in ['REAL32', 'REAL64']:
            try:
                return float(value)
            except ValueError:
                return None
        elif data_type in ['VISIBLE_STRING', 'OCTET_STRING', 'UNICODE_STRING', 'DOMAIN']:
            if value.startswith('"') and value.endswith('"'):
                return value[1:-1]
            return value
        
        return value

    def get_object_dictionary(self) -> ObjectDictionary:
        return self.object_dict

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'device_info': {
                'device_name': self.object_dict.device_name,
                'device_type': self.object_dict.device_type,
                'vendor_id': self.object_dict.vendor_id,
                'product_code': self.object_dict.product_code,
                'revision_number': self.object_dict.revision_number,
            },
            'objects': {}
        }
        
        for key, obj in self.object_dict.objects.items():
            result['objects'][f'0x{obj.index:04X}'] = result['objects'].get(f'0x{obj.index:04X}', {})
            result['objects'][f'0x{obj.index:04X}'][str(obj.subindex)] = {
                'name': obj.name,
                'object_type': obj.object_type,
                'data_type': obj.data_type,
                'access': obj.access,
                'default_value': obj.default_value,
                'pdo_mappable': obj.pdo_mappable,
                'description': obj.description
            }
        
        return result
