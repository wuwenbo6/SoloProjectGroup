package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"
)

type ProbeRequest struct {
	MACAddress    string `json:"mac_address"`
	SignalStrength int    `json:"signal_strength"`
	Timestamp     string `json:"timestamp"`
	APID          string `json:"ap_id"`
	SSID          string `json:"ssid"`
	Frequency     int    `json:"frequency"`
	Channel       int    `json:"channel"`
}

func generateMAC() string {
	return fmt.Sprintf("%02x:%02x:%02x:%02x:%02x:%02x",
		rand.Intn(256), rand.Intn(256), rand.Intn(256),
		rand.Intn(256), rand.Intn(256), rand.Intn(256))
}

func main() {
	apIDs := []string{"ap-001", "ap-002", "ap-003"}
	ssids := []string{"Office-WiFi", "Guest-WiFi", "Staff-WiFi"}

	knownDevices := make([]string, 20)
	for i := range knownDevices {
		knownDevices[i] = generateMAC()
	}

	for {
		var probes []ProbeRequest

		numProbes := rand.Intn(10) + 5

		for i := 0; i < numProbes; i++ {
			var mac string
			if rand.Float64() < 0.7 {
				mac = knownDevices[rand.Intn(len(knownDevices))]
			} else {
				mac = generateMAC()
			}

			signal := -40 - rand.Intn(50)
			freq := 2412 + rand.Intn(14)*5

			probes = append(probes, ProbeRequest{
				MACAddress:     mac,
				SignalStrength: signal,
				Timestamp:      time.Now().Format(time.RFC3339),
				APID:           apIDs[rand.Intn(len(apIDs))],
				SSID:           ssids[rand.Intn(len(ssids))],
				Frequency:      freq,
				Channel:        (freq-2412)/5 + 1,
			})
		}

		body, _ := json.Marshal(probes)

		resp, err := http.Post("http://localhost:8080/api/v1/probe", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("Error sending data: %v\n", err)
		} else {
			fmt.Printf("Sent %d probes, status: %s\n", len(probes), resp.Status)
			resp.Body.Close()
		}

		time.Sleep(2 * time.Second)
	}
}
