package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"go.uber.org/zap"
)

type ThresholdType string

const (
	ThresholdMin    ThresholdType = "min"
	ThresholdMax    ThresholdType = "max"
	ThresholdRange  ThresholdType = "range"
	ThresholdStdDev ThresholdType = "stddev"
	ThresholdRateOfChange ThresholdType = "rate_of_change"
	ThresholdSpike  ThresholdType = "spike"
)

type MetricRule struct {
	Metric        string            `json:"metric"`
	Type          ThresholdType     `json:"type"`
	MinValue      *float64          `json:"min_value,omitempty"`
	MaxValue      *float64          `json:"max_value,omitempty"`
	StdDevFactor  *float64          `json:"std_dev_factor,omitempty"`
	RateThreshold *float64          `json:"rate_threshold,omitempty"`
	SpikeFactor   *float64          `json:"spike_factor,omitempty"`
	WindowSize    int               `json:"window_size"`
	Severity      string            `json:"severity"`
	Enabled       bool              `json:"enabled"`
}

type DeviceAnomalyRules struct {
	DeviceID   string                 `json:"device_id"`
	Rules      map[string]*MetricRule `json:"rules"`
	UpdatedAt  time.Time              `json:"updated_at"`
	CreatedAt  time.Time              `json:"created_at"`
}

type AnomalyRuleService struct {
	logger        *zap.Logger
	rules         map[string]*DeviceAnomalyRules
	rwMutex       sync.RWMutex
	dataWindow    map[string][]float64
	dataWindowMutex sync.RWMutex
	maxWindowSize int
}

func NewAnomalyRuleService(logger *zap.Logger) *AnomalyRuleService {
	return &AnomalyRuleService{
		logger:        logger,
		rules:         make(map[string]*DeviceAnomalyRules),
		dataWindow:    make(map[string][]float64),
		maxWindowSize: 100,
	}
}

func (rs *AnomalyRuleService) SetRule(deviceID string, rule *MetricRule) error {
	rs.rwMutex.Lock()
	defer rs.rwMutex.Unlock()

	deviceRules, exists := rs.rules[deviceID]
	if !exists {
		deviceRules = &DeviceAnomalyRules{
			DeviceID:  deviceID,
			Rules:     make(map[string]*MetricRule),
			CreatedAt: time.Now(),
		}
		rs.rules[deviceID] = deviceRules
	}

	deviceRules.Rules[rule.Metric] = rule
	deviceRules.UpdatedAt = time.Now()

	rs.logger.Info("Anomaly rule set",
		zap.String("device_id", deviceID),
		zap.String("metric", rule.Metric),
		zap.String("type", string(rule.Type)))

	return nil
}

func (rs *AnomalyRuleService) SetRules(deviceID string, rules []*MetricRule) error {
	rs.rwMutex.Lock()
	defer rs.rwMutex.Unlock()

	deviceRules, exists := rs.rules[deviceID]
	if !exists {
		deviceRules = &DeviceAnomalyRules{
			DeviceID:  deviceID,
			Rules:     make(map[string]*MetricRule),
			CreatedAt: time.Now(),
		}
		rs.rules[deviceID] = deviceRules
	}

	for _, rule := range rules {
		deviceRules.Rules[rule.Metric] = rule
	}
	deviceRules.UpdatedAt = time.Now()

	rs.logger.Info("Anomaly rules batch set",
		zap.String("device_id", deviceID),
		zap.Int("count", len(rules)))

	return nil
}

func (rs *AnomalyRuleService) GetRules(deviceID string) []*MetricRule {
	rs.rwMutex.RLock()
	defer rs.rwMutex.RUnlock()

	deviceRules, exists := rs.rules[deviceID]
	if !exists {
		globalRules, hasGlobal := rs.rules["*"]
		if !hasGlobal {
			return []*MetricRule{}
		}
		rules := make([]*MetricRule, 0, len(globalRules.Rules))
		for _, r := range globalRules.Rules {
			rules = append(rules, r)
		}
		return rules
	}

	rules := make([]*MetricRule, 0, len(deviceRules.Rules))
	for _, r := range deviceRules.Rules {
		rules = append(rules, r)
	}
	return rules
}

func (rs *AnomalyRuleService) GetRule(deviceID, metric string) (*MetricRule, bool) {
	rs.rwMutex.RLock()
	defer rs.rwMutex.RUnlock()

	if deviceRules, exists := rs.rules[deviceID]; exists {
		if rule, exists := deviceRules.Rules[metric]; exists {
			return rule, true
		}
	}

	if globalRules, exists := rs.rules["*"]; exists {
		if rule, exists := globalRules.Rules[metric]; exists {
			return rule, true
		}
	}

	return nil, false
}

func (rs *AnomalyRuleService) DeleteRule(deviceID, metric string) bool {
	rs.rwMutex.Lock()
	defer rs.rwMutex.Unlock()

	deviceRules, exists := rs.rules[deviceID]
	if !exists {
		return false
	}

	delete(deviceRules.Rules, metric)
	deviceRules.UpdatedAt = time.Now()

	rs.logger.Info("Anomaly rule deleted",
		zap.String("device_id", deviceID),
		zap.String("metric", metric))

	return true
}

func (rs *AnomalyRuleService) DetectAnomalies(deviceID, metric string, values []float64, timestamps []int64) []AnomalyInfo {
	rule, exists := rs.GetRule(deviceID, metric)
	if !exists || !rule.Enabled {
		return []AnomalyInfo{}
	}

	var anomalies []AnomalyInfo

	switch rule.Type {
	case ThresholdMin, ThresholdMax, ThresholdRange:
		anomalies = rs.detectThresholdAnomaly(deviceID, metric, values, timestamps, rule)
	case ThresholdStdDev:
		anomalies = rs.detectStdDevAnomaly(deviceID, metric, values, timestamps, rule)
	case ThresholdRateOfChange:
		anomalies = rs.detectRateOfChangeAnomaly(deviceID, metric, values, timestamps, rule)
	case ThresholdSpike:
		anomalies = rs.detectSpikeAnomaly(deviceID, metric, values, timestamps, rule)
	}

	return anomalies
}

func (rs *AnomalyRuleService) detectThresholdAnomaly(deviceID, metric string, values []float64, timestamps []int64, rule *MetricRule) []AnomalyInfo {
	var anomalies []AnomalyInfo

	for i, value := range values {
		anomalyType := ""
		exceeded := false

		if rule.MinValue != nil && value < *rule.MinValue {
			anomalyType = "VALUE_BELOW_MIN"
			exceeded = true
		} else if rule.MaxValue != nil && value > *rule.MaxValue {
			anomalyType = "VALUE_ABOVE_MAX"
			exceeded = true
		}

		if exceeded {
			confidence := 1.0
			if rule.MinValue != nil && value < *rule.MinValue {
				confidence = math.Min(1.0, (*rule.MinValue-value)/math.Abs(*rule.MinValue)*2)
			} else if rule.MaxValue != nil && value > *rule.MaxValue {
				confidence = math.Min(1.0, (value-*rule.MaxValue)/math.Abs(*rule.MaxValue)*2)
			}

			anomalies = append(anomalies, AnomalyInfo{
				Type:       anomalyType,
				Metric:     metric,
				Value:      value,
				Timestamp:  timestamps[i],
				Severity:   rule.Severity,
				Confidence: math.Max(0.1, confidence),
			})
		}
	}

	return anomalies
}

func (rs *AnomalyRuleService) detectStdDevAnomaly(deviceID, metric string, values []float64, timestamps []int64, rule *MetricRule) []AnomalyInfo {
	if len(values) < 5 {
		return []AnomalyInfo{}
	}

	mean, stdDev := rs.calculateMeanAndStdDev(values)
	if stdDev == 0 {
		return []AnomalyInfo{}
	}

	factor := 3.0
	if rule.StdDevFactor != nil {
		factor = *rule.StdDevFactor
	}

	var anomalies []AnomalyInfo
	for i, value := range values {
		deviation := math.Abs(value - mean)
		if deviation > factor*stdDev {
			confidence := math.Min(1.0, deviation/(factor*stdDev)-0.5)
			anomalies = append(anomalies, AnomalyInfo{
				Type:       "STATISTICAL_OUTLIER",
				Metric:     metric,
				Value:      value,
				Timestamp:  timestamps[i],
				Severity:   rule.Severity,
				Confidence: math.Max(0.1, confidence),
			})
		}
	}

	return anomalies
}

func (rs *AnomalyRuleService) detectRateOfChangeAnomaly(deviceID, metric string, values []float64, timestamps []int64, rule *MetricRule) []AnomalyInfo {
	if len(values) < 2 {
		return []AnomalyInfo{}
	}

	threshold := 0.5
	if rule.RateThreshold != nil {
		threshold = *rule.RateThreshold
	}

	var anomalies []AnomalyInfo
	for i := 1; i < len(values); i++ {
		if values[i-1] == 0 {
			continue
		}
		rate := math.Abs((values[i] - values[i-1]) / values[i-1])
		if rate > threshold {
			confidence := math.Min(1.0, rate/threshold-0.5)
			anomalies = append(anomalies, AnomalyInfo{
				Type:       "RATE_OF_CHANGE",
				Metric:     metric,
				Value:      values[i],
				Timestamp:  timestamps[i],
				Severity:   rule.Severity,
				Confidence: math.Max(0.1, confidence),
			})
		}
	}

	return anomalies
}

func (rs *AnomalyRuleService) detectSpikeAnomaly(deviceID, metric string, values []float64, timestamps []int64, rule *MetricRule) []AnomalyInfo {
	if len(values) < 3 {
		return []AnomalyInfo{}
	}

	spikeFactor := 2.0
	if rule.SpikeFactor != nil {
		spikeFactor = *rule.SpikeFactor
	}

	var anomalies []AnomalyInfo
	for i := 1; i < len(values)-1; i++ {
		prev := values[i-1]
		curr := values[i]
		next := values[i+1]

		if prev == 0 {
			continue
		}

		changeRate := math.Abs(curr-prev) / math.Abs(prev)
		recoveryRate := math.Abs(next-curr) / math.Abs(curr)

		if changeRate > spikeFactor && recoveryRate > 0.3 {
			anomalies = append(anomalies, AnomalyInfo{
				Type:       "SPIKE",
				Metric:     metric,
				Value:      curr,
				Timestamp:  timestamps[i],
				Severity:   rule.Severity,
				Confidence: math.Min(1.0, changeRate),
			})
		}
	}

	return anomalies
}

func (rs *AnomalyRuleService) calculateMeanAndStdDev(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	variance := 0.0
	for _, v := range values {
		variance += (v - mean) * (v - mean)
	}
	variance /= float64(len(values))
	stdDev := math.Sqrt(variance)

	return mean, stdDev
}

func (rs *AnomalyRuleService) GetAllDeviceIDs() []string {
	rs.rwMutex.RLock()
	defer rs.rwMutex.RUnlock()

	ids := make([]string, 0, len(rs.rules))
	for id := range rs.rules {
		if id != "*" {
			ids = append(ids, id)
		}
	}
	return ids
}

type AnomalyInfo struct {
	Type       string
	Metric     string
	Value      float64
	Timestamp  int64
	Severity   string
	Confidence float64
}

func (rs *AnomalyRuleService) ImportRules(data []byte) error {
	var rules map[string][]*MetricRule
	if err := json.Unmarshal(data, &rules); err != nil {
		return fmt.Errorf("failed to unmarshal rules: %w", err)
	}

	for deviceID, deviceRules := range rules {
		if err := rs.SetRules(deviceID, deviceRules); err != nil {
			return err
		}
	}

	return nil
}

func (rs *AnomalyRuleService) ExportRules() ([]byte, error) {
	rs.rwMutex.RLock()
	defer rs.rwMutex.RUnlock()

	result := make(map[string][]*MetricRule)
	for deviceID, deviceRules := range rs.rules {
		rules := make([]*MetricRule, 0, len(deviceRules.Rules))
		for _, r := range deviceRules.Rules {
			rules = append(rules, r)
		}
		result[deviceID] = rules
	}

	return json.MarshalIndent(result, "", "  ")
}
