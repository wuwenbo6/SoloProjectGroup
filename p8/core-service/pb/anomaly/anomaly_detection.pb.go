package anomaly

type TimeSeriesPoint struct {
	Timestamp int64
	Value     float64
	Metric    string
}

type DetectAnomalyRequest struct {
	DeviceId string
	Data     []*TimeSeriesPoint
}

type AnomalyResult struct {
	AnomalyType string
	Confidence  float64
	Timestamp   int64
	Metric      string
	Description string
}

type DetectAnomalyResponse struct {
	DeviceId   string
	Anomalies  []*AnomalyResult
	HasAnomaly bool
}

type BatchDetectAnomalyRequest struct {
	Requests []*DetectAnomalyRequest
}

type BatchDetectAnomalyResponse struct {
	Responses []*DetectAnomalyResponse
}
