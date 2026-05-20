package models

import "time"

type ProbeRequest struct {
	MACAddress  string    `json:"mac_address" binding:"required"`
	SignalStrength int   `json:"signal_strength" binding:"required"`
	Timestamp   time.Time `json:"timestamp"`
	APID        string    `json:"ap_id" binding:"required"`
	SSID        string    `json:"ssid"`
	Frequency   int       `json:"frequency"`
	Channel     int       `json:"channel"`
}

type DeviceInfo struct {
	MACAddress    string
	FirstSeen     time.Time
	LastSeen      time.Time
	SignalHistory []SignalPoint
	IsRandomMAC   bool
	APHistory     map[string]time.Time
}

type SignalPoint struct {
	Timestamp time.Time
	Strength  int
	APID      string
}

type TrafficStats struct {
	Timestamp     time.Time `json:"timestamp"`
	VisitorCount  int       `json:"visitor_count"`
	NewVisitors   int       `json:"new_visitors"`
	ReturnVisitors int      `json:"return_visitors"`
}

type StayDurationStats struct {
	AverageStay time.Duration `json:"average_stay"`
	MedianStay  time.Duration `json:"median_stay"`
	Distribution map[string]int `json:"distribution"`
}

type HeatmapPoint struct {
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Count     int       `json:"count"`
	Intensity float64   `json:"intensity"`
}

type TrendDataPoint struct {
	Time   string `json:"time"`
	Count  int    `json:"count"`
}
