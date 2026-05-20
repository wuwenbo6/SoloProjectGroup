package reidentification

import (
	"math"
	"sync"
	"time"
	"wifi-probe-analytics/models"
)

type RSSISignature struct {
	MACAddress   string
	Sequence     []int
	Mean         float64
	Variance     float64
	APPattern    map[string]float64
	LastUpdated  time.Time
	DeviceFingerprint string
}

type DeviceReidentifier struct {
	signatures   map[string]*RSSISignature
	fingerprints map[string]string
	mutex        sync.RWMutex
	threshold    float64
}

func NewDeviceReidentifier() *DeviceReidentifier {
	return &DeviceReidentifier{
		signatures:   make(map[string]*RSSISignature),
		fingerprints: make(map[string]string),
		threshold:    0.85,
	}
}

func (dr *DeviceReidentifier) AddDevice(mac string, history []models.SignalPoint) {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()

	sig := dr.createSignature(mac, history)
	dr.signatures[mac] = sig

	fingerprint := generateFingerprint(sig)
	dr.fingerprints[fingerprint] = mac
}

func (dr *DeviceReidentifier) createSignature(mac string, history []models.SignalPoint) *RSSISignature {
	if len(history) == 0 {
		return &RSSISignature{
			MACAddress:  mac,
			Sequence:    []int{},
			APPattern:   make(map[string]float64),
			LastUpdated: time.Now(),
		}
	}

	sequence := make([]int, len(history))
	sum := 0
	for i, point := range history {
		sequence[i] = point.Strength
		sum += point.Strength
	}
	mean := float64(sum) / float64(len(history))

	variance := 0.0
	for _, val := range sequence {
		diff := float64(val) - mean
		variance += diff * diff
	}
	variance /= float64(len(history))

	apPattern := make(map[string]float64)
	apCount := make(map[string]int)
	for _, point := range history {
		apPattern[point.APID] += float64(point.Strength)
		apCount[point.APID]++
	}
	for ap := range apPattern {
		apPattern[ap] /= float64(apCount[ap])
	}

	return &RSSISignature{
		MACAddress:  mac,
		Sequence:    sequence,
		Mean:        mean,
		Variance:    variance,
		APPattern:   apPattern,
		LastUpdated: time.Now(),
	}
}

func generateFingerprint(sig *RSSISignature) string {
	meanBucket := int(sig.Mean) / 10
	varianceBucket := int(sig.Variance) / 20
	return string(rune(meanBucket+256)) + ":" + string(rune(varianceBucket+256))
}

type MatchResult struct {
	OriginalMAC    string
	Similarity     float64
	MatchType      string
}

func (dr *DeviceReidentifier) Reidentify(newMAC string, history []models.SignalPoint) *MatchResult {
	dr.mutex.RLock()
	defer dr.mutex.RUnlock()

	if len(history) < 5 {
		return nil
	}

	newSig := dr.createSignature(newMAC, history)

	bestMatch := ""
	bestScore := 0.0
	bestType := ""

	for mac, sig := range dr.signatures {
		if mac == newMAC {
			continue
		}

		dtwScore := dr.dtwDistance(newSig.Sequence, sig.Sequence)
		apScore := dr.apPatternSimilarity(newSig.APPattern, sig.APPattern)
		statScore := dr.statisticalSimilarity(newSig, sig)

		combinedScore := dtwScore*0.4 + apScore*0.35 + statScore*0.25

		if combinedScore > bestScore && combinedScore > dr.threshold {
			bestScore = combinedScore
			bestMatch = mac
			if combinedScore > 0.95 {
				bestType = "exact"
			} else if combinedScore > 0.90 {
				bestType = "high"
			} else {
				bestType = "probable"
			}
		}
	}

	if bestMatch != "" {
		return &MatchResult{
			OriginalMAC: bestMatch,
			Similarity:  bestScore,
			MatchType:   bestType,
		}
	}

	return nil
}

func (dr *DeviceReidentifier) dtwDistance(s1, s2 []int) float64 {
	if len(s1) == 0 || len(s2) == 0 {
		return 0
	}

	n, m := len(s1), len(s2)
	dtw := make([][]float64, n+1)
	for i := range dtw {
		dtw[i] = make([]float64, m+1)
		for j := range dtw[i] {
			dtw[i][j] = math.Inf(1)
		}
	}
	dtw[0][0] = 0

	for i := 1; i <= n; i++ {
		for j := 1; j <= m; j++ {
			cost := math.Abs(float64(s1[i-1] - s2[j-1]))
			dtw[i][j] = cost + math.Min(math.Min(dtw[i-1][j], dtw[i][j-1]), dtw[i-1][j-1])
		}
	}

	maxDist := 60.0 * math.Max(float64(n), float64(m))
	normalized := 1 - (dtw[n][m] / maxDist)
	return math.Max(0, normalized)
}

func (dr *DeviceReidentifier) apPatternSimilarity(p1, p2 map[string]float64) float64 {
	if len(p1) == 0 || len(p2) == 0 {
		return 0.5
	}

	common := 0
	similarity := 0.0

	for ap, v1 := range p1 {
		if v2, exists := p2[ap]; exists {
			common++
			sigDiff := math.Abs(v1 - v2)
			similarity += math.Max(0, 1-sigDiff/30)
		}
	}

	if common == 0 {
		return 0
	}

	return similarity / float64(common)
}

func (dr *DeviceReidentifier) statisticalSimilarity(sig1, sig2 *RSSISignature) float64 {
	meanDiff := math.Abs(sig1.Mean - sig2.Mean)
	meanSim := math.Max(0, 1-meanDiff/30)

	varDiff := math.Abs(sig1.Variance - sig2.Variance)
	varSim := math.Max(0, 1-varDiff/100)

	return meanSim*0.6 + varSim*0.4
}

func (dr *DeviceReidentifier) UpdateSignature(mac string, history []models.SignalPoint) {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()

	if len(history) >= 5 {
		dr.signatures[mac] = dr.createSignature(mac, history)
	}
}

func (dr *DeviceReidentifier) CleanupOldDevices(maxAge time.Duration) {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()

	cutoff := time.Now().Add(-maxAge)
	for mac, sig := range dr.signatures {
		if sig.LastUpdated.Before(cutoff) {
			delete(dr.signatures, mac)
		}
	}
}

func (dr *DeviceReidentifier) GetSignatureCount() int {
	dr.mutex.RLock()
	defer dr.mutex.RUnlock()
	return len(dr.signatures)
}
