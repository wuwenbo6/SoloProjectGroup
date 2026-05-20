package models

import (
	"encoding/json"
	"time"
)

type CANMessage struct {
	Timestamp   time.Time `json:"timestamp"`
	ID          uint32    `json:"id"`
	IsExtended  bool      `json:"is_extended"`
	Data        []byte    `json:"data"`
	DLC         uint8     `json:"dlc"`
	Bus         uint8     `json:"bus"`
	IsErrorFrame bool     `json:"is_error_frame"`
	IsRemoteFrame bool   `json:"is_remote_frame"`
}

func (m *CANMessage) MarshalJSON() ([]byte, error) {
	type Alias CANMessage
	return json.Marshal(&struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Timestamp: m.Timestamp.UnixNano() / int64(time.Microsecond),
		Alias:     (*Alias)(m),
	})
}

func (m *CANMessage) UnmarshalJSON(data []byte) error {
	type Alias CANMessage
	aux := &struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	m.Timestamp = time.Unix(0, aux.Timestamp*int64(time.Microsecond))
	return nil
}

type CANLogFile struct {
	Filename  string       `json:"filename"`
	Messages  []CANMessage `json:"messages"`
	CreatedAt time.Time    `json:"created_at"`
	Version   string       `json:"version"`
}

type ReplayConfig struct {
	SpeedFactor   float64 `json:"speed_factor"`
	LoopCount     int     `json:"loop_count"`
	StartOffsetMs  int64   `json:"start_offset_ms"`
	EndOffsetMs    int64   `json:"end_offset_ms"`
	FilterIDs     []uint32 `json:"filter_ids"`
	BusFilter     []uint8  `json:"bus_filter"`
}
