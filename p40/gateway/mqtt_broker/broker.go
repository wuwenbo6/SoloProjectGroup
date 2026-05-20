package mqtt_broker

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"edge-gateway/models"
)

const (
	BrokerAddress = "tcp://localhost:1883"
	Topic         = "sensors/data"
)

type Broker struct {
	client mqtt.Client
}

func NewBroker() *Broker {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(BrokerAddress)
	opts.SetClientID("edge-gateway-broker")

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Fatalf("Failed to connect to MQTT broker: %v", token.Error())
	}

	return &Broker{client: client}
}

func (b *Broker) Publish(data *models.SensorData) error {
	payload, err := data.MarshalJSON()
	if err != nil {
		return err
	}

	token := b.client.Publish(Topic, 0, false, payload)
	token.Wait()
	return token.Error()
}

func (b *Broker) Subscribe(handler mqtt.MessageHandler) {
	token := b.client.Subscribe(Topic, 0, handler)
	token.Wait()
	if token.Error() != nil {
		log.Fatalf("Failed to subscribe: %v", token.Error())
	}
}

func (b *Broker) Disconnect() {
	b.client.Disconnect(250)
}

type SensorSimulator struct {
	broker   *Broker
	stopChan chan struct{}
}

func NewSensorSimulator(broker *Broker) *SensorSimulator {
	return &SensorSimulator{
		broker:   broker,
		stopChan: make(chan struct{}),
	}
}

func (s *SensorSimulator) Start(numSensors int, intervalMs int) {
	ticker := time.NewTicker(time.Duration(intervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			for i := 0; i < numSensors; i++ {
				go s.publishSensorData(i)
			}
		case <-s.stopChan:
			return
		}
	}
}

func (s *SensorSimulator) publishSensorData(sensorIdx int) {
	sensorID := fmt.Sprintf("sensor_%03d", sensorIdx+1)
	
	temp := 25.0 + rand.NormFloat64()*3.0
	humidity := 50.0 + rand.NormFloat64()*10.0

	if rand.Float64() < 0.01 {
		temp += 10.0
	}
	if rand.Float64() < 0.005 {
		humidity -= 20.0
	}

	data := &models.SensorData{
		SensorID:  sensorID,
		Timestamp: time.Now(),
		Temp:      temp,
		Humidity:  humidity,
	}

	if err := s.broker.Publish(data); err != nil {
		log.Printf("Failed to publish data for %s: %v", sensorID, err)
	}
}

func (s *SensorSimulator) Stop() {
	close(s.stopChan)
}
