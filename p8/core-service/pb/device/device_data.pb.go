package device

import (
	_ "google.golang.org/grpc/encoding/proto"
)

type DeviceDataPoint struct {
	DeviceId  string
	Timestamp int64
	Metrics   map[string]float64
}

type BatchDeviceDataRequest struct {
	DataPoints []*DeviceDataPoint
}

type BatchDeviceDataResponse struct {
	SuccessCount int32
	FailedCount  int32
	Errors       []string
}
