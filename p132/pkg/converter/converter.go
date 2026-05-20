package converter

import (
	"encoding/binary"
	"fmt"
	"math"

	"modbus-mqtt-gateway/pkg/config"
)

type RegisterData struct {
	Register config.RegisterConfig
	RawValue interface{}
	Value    float64
	Timestamp int64
}

func ConvertToFloat(data []byte, dataType config.DataType) (float64, error) {
	switch dataType {
	case config.TypeInt16:
		if len(data) < 2 {
			return 0, fmt.Errorf("insufficient data for int16")
		}
		return float64(int16(binary.BigEndian.Uint16(data))), nil
	case config.TypeUint16:
		if len(data) < 2 {
			return 0, fmt.Errorf("insufficient data for uint16")
		}
		return float64(binary.BigEndian.Uint16(data)), nil
	case config.TypeInt32:
		if len(data) < 4 {
			return 0, fmt.Errorf("insufficient data for int32")
		}
		return float64(int32(binary.BigEndian.Uint32(data))), nil
	case config.TypeUint32:
		if len(data) < 4 {
			return 0, fmt.Errorf("insufficient data for uint32")
		}
		return float64(binary.BigEndian.Uint32(data)), nil
	case config.TypeFloat32:
		if len(data) < 4 {
			return 0, fmt.Errorf("insufficient data for float32")
		}
		return float64(math.Float32frombits(binary.BigEndian.Uint32(data))), nil
	case config.TypeFloat64:
		if len(data) < 8 {
			return 0, fmt.Errorf("insufficient data for float64")
		}
		return math.Float64frombits(binary.BigEndian.Uint64(data)), nil
	default:
		return 0, fmt.Errorf("unknown data type: %s", dataType)
	}
}

func ApplyScaleAndOffset(value float64, scaleFactor float64, offset float64) float64 {
	return value*scaleFactor + offset
}

func GetRegisterCount(dataType config.DataType) int {
	switch dataType {
	case config.TypeInt16, config.TypeUint16:
		return 1
	case config.TypeInt32, config.TypeUint32, config.TypeFloat32:
		return 2
	case config.TypeFloat64:
		return 4
	default:
		return 1
	}
}
