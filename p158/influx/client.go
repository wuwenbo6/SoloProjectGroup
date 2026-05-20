package influx

import (
	"context"
	"time"
	"wifi-probe-analytics/config"
	"wifi-probe-analytics/models"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type Client struct {
	client   influxdb2.Client
	writeAPI api.WriteAPIBlocking
	queryAPI api.QueryAPI
	org      string
	bucket   string
}

func NewClient(cfg config.InfluxDBConfig) (*Client, error) {
	client := influxdb2.NewClient(cfg.URL, cfg.Token)
	writeAPI := client.WriteAPIBlocking(cfg.Org, cfg.Bucket)
	queryAPI := client.QueryAPI(cfg.Org)

	return &Client{
		client:   client,
		writeAPI: writeAPI,
		queryAPI: queryAPI,
		org:      cfg.Org,
		bucket:   cfg.Bucket,
	}, nil
}

func (c *Client) Close() {
	c.client.Close()
}

func (c *Client) WriteProbeRequest(ctx context.Context, probe *models.ProbeRequest, isDuplicate bool, isRandomMAC bool) error {
	p := influxdb2.NewPoint(
		"probe_requests",
		map[string]string{
			"ap_id":       probe.APID,
			"mac_address": probe.MACAddress,
		},
		map[string]interface{}{
			"signal_strength": probe.SignalStrength,
			"ssid":            probe.SSID,
			"frequency":       probe.Frequency,
			"channel":         probe.Channel,
			"is_duplicate":    isDuplicate,
			"is_random_mac":   isRandomMAC,
		},
		probe.Timestamp,
	)
	return c.writeAPI.WritePoint(ctx, p)
}

func (c *Client) WriteVisitorEvent(ctx context.Context, mac string, eventType string, timestamp time.Time, duration int64) error {
	p := influxdb2.NewPoint(
		"visitor_events",
		map[string]string{
			"mac_address": mac,
			"event_type":  eventType,
		},
		map[string]interface{}{
			"duration_seconds": duration,
		},
		timestamp,
	)
	return c.writeAPI.WritePoint(ctx, p)
}

func (c *Client) WriteTrafficStats(ctx context.Context, stats *models.TrafficStats) error {
	p := influxdb2.NewPoint(
		"traffic_stats",
		map[string]string{},
		map[string]interface{}{
			"visitor_count":    stats.VisitorCount,
			"new_visitors":     stats.NewVisitors,
			"return_visitors":  stats.ReturnVisitors,
		},
		stats.Timestamp,
	)
	return c.writeAPI.WritePoint(ctx, p)
}

func (c *Client) QueryTrafficTrend(ctx context.Context, start, end time.Time, interval string) ([]models.TrendDataPoint, error) {
	query := `
		from(bucket: "` + c.bucket + `")
			|> range(start: ` + start.Format(time.RFC3339) + `, stop: ` + end.Format(time.RFC3339) + `)
			|> filter(fn: (r) => r._measurement == "traffic_stats" and r._field == "visitor_count")
			|> aggregateWindow(every: ` + interval + `, fn: sum, createEmpty: false)
			|> yield(name: "sum")
	`

	result, err := c.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	var data []models.TrendDataPoint
	for result.Next() {
		data = append(data, models.TrendDataPoint{
			Time:  result.Record().Time().Format("15:04"),
			Count: int(result.Record().Value().(int64)),
		})
	}

	return data, result.Err()
}

func (c *Client) QueryUniqueVisitors(ctx context.Context, start, end time.Time) (int, error) {
	query := `
		import "influxdata/influxdb/schema"
		
		schema.tagValues(
			bucket: "` + c.bucket + `",
			tag: "mac_address",
			predicate: (r) => r._measurement == "probe_requests",
			start: ` + start.Format(time.RFC3339) + `,
			stop: ` + end.Format(time.RFC3339) + `
		)
		|> count()
	`

	result, err := c.queryAPI.Query(ctx, query)
	if err != nil {
		return 0, err
	}

	count := 0
	for result.Next() {
		if v, ok := result.Record().Value().(int64); ok {
			count = int(v)
		}
	}

	return count, result.Err()
}
