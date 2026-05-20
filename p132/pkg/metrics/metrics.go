package metrics

import (
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	instance *Metrics
	once     sync.Once
)

type Metrics struct {
	registry           *prometheus.Registry
	pollCount          *prometheus.CounterVec
	pollErrors         *prometheus.CounterVec
	pollDuration       *prometheus.HistogramVec
	dataPointsTotal    *prometheus.CounterVec
	dataPointsReported *prometheus.CounterVec
	mqttPublishTotal   *prometheus.CounterVec
	mqttPublishErrors  *prometheus.CounterVec
	mqttPublishLatency *prometheus.HistogramVec
	cacheSize          *prometheus.GaugeVec
	cacheUnpublished   *prometheus.GaugeVec
	deviceStatus       *prometheus.GaugeVec
}

func GetInstance() *Metrics {
	once.Do(func() {
		instance = newMetrics()
	})
	return instance
}

func newMetrics() *Metrics {
	reg := prometheus.NewRegistry()
	factory := promauto.With(reg)

	return &Metrics{
		registry: reg,

		pollCount: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "modbus_poll_total",
				Help: "Total number of Modbus poll operations",
			},
			[]string{"device"},
		),

		pollErrors: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "modbus_poll_errors_total",
				Help: "Total number of Modbus poll errors",
			},
			[]string{"device"},
		),

		pollDuration: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "modbus_poll_duration_seconds",
				Help:    "Duration of Modbus poll operations",
				Buckets: prometheus.ExponentialBuckets(0.01, 2, 10),
			},
			[]string{"device"},
		),

		dataPointsTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "modbus_datapoints_total",
				Help: "Total number of data points collected",
			},
			[]string{"device", "datapoint"},
		),

		dataPointsReported: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "modbus_datapoints_reported_total",
				Help: "Total number of data points reported via MQTT",
			},
			[]string{"device", "datapoint"},
		),

		mqttPublishTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "mqtt_publish_total",
				Help: "Total number of MQTT publish operations",
			},
			[]string{"topic"},
		),

		mqttPublishErrors: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "mqtt_publish_errors_total",
				Help: "Total number of MQTT publish errors",
			},
			[]string{"topic"},
		),

		mqttPublishLatency: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "mqtt_publish_duration_seconds",
				Help:    "Duration of MQTT publish operations",
				Buckets: prometheus.ExponentialBuckets(0.001, 2, 10),
			},
			[]string{"topic"},
		),

		cacheSize: factory.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "storage_cache_size",
				Help: "Current size of the storage cache",
			},
			[]string{"type"},
		),

		cacheUnpublished: factory.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "storage_unpublished_count",
				Help: "Number of unpublished records in cache",
			},
			[]string{"type"},
		),

		deviceStatus: factory.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "device_connection_status",
				Help: "Device connection status (1=connected, 0=disconnected)",
			},
			[]string{"device"},
		),
	}
}

func (m *Metrics) IncPollCount(device string) {
	m.pollCount.WithLabelValues(device).Inc()
}

func (m *Metrics) IncPollErrors(device string) {
	m.pollErrors.WithLabelValues(device).Inc()
}

func (m *Metrics) ObservePollDuration(device string, duration time.Duration) {
	m.pollDuration.WithLabelValues(device).Observe(duration.Seconds())
}

func (m *Metrics) IncDataPoints(device, datapoint string) {
	m.dataPointsTotal.WithLabelValues(device, datapoint).Inc()
}

func (m *Metrics) IncDataPointsReported(device, datapoint string) {
	m.dataPointsReported.WithLabelValues(device, datapoint).Inc()
}

func (m *Metrics) IncMQTTPublish(topic string) {
	m.mqttPublishTotal.WithLabelValues(topic).Inc()
}

func (m *Metrics) IncMQTTPublishErrors(topic string) {
	m.mqttPublishErrors.WithLabelValues(topic).Inc()
}

func (m *Metrics) ObserveMQTTPublishLatency(topic string, duration time.Duration) {
	m.mqttPublishLatency.WithLabelValues(topic).Observe(duration.Seconds())
}

func (m *Metrics) SetCacheSize(typ string, size float64) {
	m.cacheSize.WithLabelValues(typ).Set(size)
}

func (m *Metrics) SetCacheUnpublished(typ string, count float64) {
	m.cacheUnpublished.WithLabelValues(typ).Set(count)
}

func (m *Metrics) SetDeviceStatus(device string, connected bool) {
	value := float64(0)
	if connected {
		value = 1
	}
	m.deviceStatus.WithLabelValues(device).Set(value)
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{
		Registry:          m.registry,
		EnableOpenMetrics: true,
	})
}
