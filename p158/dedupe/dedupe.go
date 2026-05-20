package dedupe

import (
	"strings"
	"sync"
	"time"
	"wifi-probe-analytics/models"
)

type Deduplicator struct {
	windowSize        time.Duration
	duplicateInterval time.Duration
	deviceCache       map[string]*models.DeviceInfo
	ouiWhitelist      map[string]bool
	randomMACPrefixes map[string]bool
	mutex             sync.RWMutex
}

func NewDeduplicator(windowSize, duplicateInterval time.Duration) *Deduplicator {
	return &Deduplicator{
		windowSize:        windowSize,
		duplicateInterval: duplicateInterval,
		deviceCache:       make(map[string]*models.DeviceInfo),
		ouiWhitelist:      initOUIWhitelist(),
		randomMACPrefixes: initRandomMACPrefixes(),
	}
}

func initOUIWhitelist() map[string]bool {
	ouiList := map[string]bool{
		"00:00:00": true, "00:01:42": true, "00:02:2D": true, "00:03:7F": true,
		"00:03:93": true, "00:04:0B": true, "00:04:23": true, "00:04:4B": true,
		"00:04:75": true, "00:05:02": true, "00:05:4E": true, "00:05:69": true,
		"00:05:9A": true, "00:05:B7": true, "00:06:5B": true, "00:06:7B": true,
		"00:07:4D": true, "00:07:E9": true, "00:08:22": true, "00:08:A3": true,
		"00:09:6B": true, "00:09:E8": true, "00:0A:27": true, "00:0A:41": true,
		"00:0A:8A": true, "00:0A:95": true, "00:0A:D6": true, "00:0B:41": true,
		"00:0B:6A": true, "00:0B:DB": true, "00:0C:29": true, "00:0C:43": true,
		"00:0C:7A": true, "00:0C:8D": true, "00:0C:EF": true, "00:0D:07": true,
		"00:0D:3D": true, "00:0D:4E": true, "00:0D:60": true, "00:0D:66": true,
		"00:0D:72": true, "00:0D:88": true, "00:0D:93": true, "00:0D:9D": true,
		"00:0D:B6": true, "00:0D:BC": true, "00:0D:BD": true, "00:0E:08": true,
		"00:0E:2E": true, "00:0E:35": true, "00:0E:58": true, "00:0E:7C": true,
		"00:0E:8C": true, "00:0E:9B": true, "00:0E:C7": true, "00:0F:1F": true,
		"00:0F:35": true, "00:0F:66": true, "00:0F:B5": true, "00:10:18": true,
		"00:10:4B": true, "00:10:5A": true, "00:10:60": true, "00:10:75": true,
		"00:10:A5": true, "00:10:FA": true, "00:11:09": true, "00:11:24": true,
		"00:11:43": true, "00:11:50": true, "00:11:7B": true, "00:11:85": true,
		"00:11:89": true, "00:11:92": true, "00:11:A4": true, "00:11:B1": true,
		"00:11:D8": true, "00:11:E5": true, "00:12:17": true, "00:12:35": true,
		"00:12:5A": true, "00:12:6F": true, "00:12:80": true, "00:12:88": true,
		"00:12:8F": true, "00:12:90": true, "00:12:A9": true, "00:12:BF": true,
		"00:12:D9": true, "00:12:E0": true, "00:12:E3": true, "00:12:F0": true,
		"00:12:F3": true, "00:13:02": true, "00:13:10": true, "00:13:15": true,
		"00:13:21": true, "00:13:46": true, "00:13:49": true, "00:13:60": true,
		"00:13:72": true, "00:13:74": true, "00:13:8B": true, "00:13:A9": true,
		"00:13:C2": true, "00:13:D3": true, "00:13:D4": true, "00:13:E8": true,
		"00:14:0C": true, "00:14:22": true, "00:14:38": true, "00:14:4F": true,
		"00:14:51": true, "00:14:6C": true, "00:14:85": true, "00:14:91": true,
		"00:14:A4": true, "00:14:B3": true, "00:14:D1": true, "00:14:D6": true,
		"00:14:F1": true, "00:15:00": true, "00:15:05": true, "00:15:17": true,
		"00:15:2A": true, "00:15:32": true, "00:15:46": true, "00:15:56": true,
		"00:15:5D": true, "00:15:65": true, "00:15:70": true, "00:15:79": true,
		"00:15:83": true, "00:15:88": true, "00:15:99": true, "00:15:9E": true,
		"00:15:A0": true, "00:15:A2": true, "00:15:AC": true, "00:15:AF": true,
		"00:15:C2": true, "00:15:C5": true, "00:15:E2": true, "00:15:F2": true,
		"00:16:35": true, "00:16:41": true, "00:16:53": true, "00:16:6F": true,
		"00:16:B6": true, "00:16:CB": true, "00:16:D3": true, "00:16:E0": true,
		"00:16:F9": true, "00:17:08": true, "00:17:42": true, "00:17:9A": true,
		"00:17:AB": true, "00:17:C5": true, "00:17:F2": true, "00:18:01": true,
		"00:18:13": true, "00:18:39": true, "00:18:42": true, "00:18:58": true,
		"00:18:5B": true, "00:18:6B": true, "00:18:80": true, "00:18:8B": true,
		"00:18:A6": true, "00:18:C0": true, "00:18:D1": true, "00:18:E7": true,
		"00:18:F3": true, "00:19:07": true, "00:19:0E": true, "00:19:21": true,
		"00:19:30": true, "00:19:4D": true, "00:19:53": true, "00:19:5E": true,
		"00:19:86": true, "00:19:88": true, "00:19:99": true, "00:19:AA": true,
		"00:19:B9": true, "00:19:BE": true, "00:19:C6": true, "00:19:D2": true,
		"00:19:DB": true, "00:19:E5": true, "00:19:F3": true, "00:1A:2B": true,
		"00:1A:30": true, "00:1A:73": true, "00:1A:85": true, "00:1A:A0": true,
		"00:1A:B7": true, "00:1A:C6": true, "00:1A:D9": true, "00:1A:E9": true,
		"00:1A:F1": true, "00:1B:11": true, "00:1B:2F": true, "00:1B:3F": true,
		"00:1B:44": true, "00:1B:5A": true, "00:1B:66": true, "00:1B:77": true,
		"00:1B:B9": true, "00:1B:DA": true, "00:1B:E5": true, "00:1C:14": true,
		"00:1C:23": true, "00:1C:43": true, "00:1C:54": true, "00:1C:7D": true,
		"00:1C:8F": true, "00:1C:B3": true, "00:1C:BF": true, "00:1C:C4": true,
		"00:1C:D4": true, "00:1C:F0": true, "00:1D:4B": true, "00:1D:6A": true,
		"00:1D:72": true, "00:1D:92": true, "00:1D:A1": true, "00:1D:BA": true,
		"00:1D:C0": true, "00:1D:D8": true, "00:1D:E6": true, "00:1D:F7": true,
		"00:1E:06": true, "00:1E:10": true, "00:1E:33": true, "00:1E:52": true,
		"00:1E:58": true, "00:1E:64": true, "00:1E:68": true, "00:1E:8C": true,
		"00:1E:99": true, "00:1E:A9": true, "00:1E:BD": true, "00:1E:C2": true,
		"00:1E:C9": true, "00:1E:E5": true, "00:1E:F1": true, "00:1F:01": true,
		"00:1F:16": true, "00:1F:29": true, "00:1F:3C": true, "00:1F:3D": true,
		"00:1F:41": true, "00:1F:5B": true, "00:1F:84": true, "00:1F:9F": true,
		"00:1F:A1": true, "00:1F:A9": true, "00:1F:C3": true, "00:1F:D0": true,
		"00:1F:E1": true, "00:21:00": true, "00:21:19": true, "00:21:37": true,
		"00:21:5A": true, "00:21:5D": true, "00:21:68": true, "00:21:9B": true,
		"00:21:CC": true, "00:21:D7": true, "00:21:F6": true, "00:22:33": true,
		"00:22:41": true, "00:22:58": true, "00:22:64": true, "00:22:6F": true,
		"00:22:7A": true, "00:22:90": true, "00:22:A1": true, "00:22:AF": true,
		"00:22:BC": true, "00:22:C3": true, "00:22:CE": true, "00:22:D2": true,
		"00:22:DE": true, "00:22:F0": true, "00:22:FA": true, "00:23:03": true,
		"00:23:08": true, "00:23:10": true, "00:23:12": true, "00:23:14": true,
		"00:23:32": true, "00:23:4E": true, "00:23:54": true, "00:23:5C": true,
		"00:23:68": true, "00:23:76": true, "00:23:7C": true, "00:23:82": true,
		"00:23:8B": true, "00:23:99": true, "00:23:AB": true, "00:23:AE": true,
		"00:23:C4": true, "00:23:CC": true, "00:23:D1": true, "00:23:D4": true,
		"00:23:DF": true, "00:23:E8": true, "00:23:F1": true, "00:24:01": true,
		"00:24:08": true, "00:24:1B": true, "00:24:2B": true, "00:24:36": true,
		"00:24:54": true, "00:24:64": true, "00:24:7B": true, "00:24:81": true,
		"00:24:8C": true, "00:24:9D": true, "00:24:AB": true, "00:24:B6": true,
		"00:24:D7": true, "00:24:E3": true, "00:24:F7": true, "00:25:00": true,
		"00:25:10": true, "00:25:22": true, "00:25:2F": true, "00:25:41": true,
		"00:25:4B": true, "00:25:56": true, "00:25:67": true, "00:25:7A": true,
		"00:25:90": true, "00:25:9C": true, "00:25:A0": true, "00:25:BC": true,
		"00:25:BD": true, "00:25:D3": true, "00:25:DC": true, "00:25:E2": true,
		"00:25:F4": true, "00:26:08": true, "00:26:18": true, "00:26:44": true,
		"00:26:4D": true, "00:26:5A": true, "00:26:66": true, "00:26:82": true,
		"00:26:98": true, "00:26:AB": true, "00:26:BB": true, "00:26:C0": true,
		"00:26:C6": true, "00:26:D7": true, "00:26:F9": true, "00:27:03": true,
		"00:27:10": true, "00:27:13": true, "00:27:19": true, "00:27:22": true,
		"00:27:3A": true, "00:27:45": true, "00:27:5F": true, "00:27:7E": true,
		"00:27:8B": true, "00:27:9F": true, "00:27:C5": true, "00:27:CA": true,
		"00:27:D6": true, "00:27:E3": true, "00:28:18": true, "00:28:37": true,
		"00:28:5C": true, "00:28:80": true, "00:28:C0": true, "00:28:D2": true,
		"00:29:17": true, "00:29:25": true, "00:29:46": true, "00:29:5E": true,
		"00:29:62": true, "00:29:6D": true, "00:29:C6": true, "00:2A:10": true,
		"00:2A:2B": true, "00:2A:4F": true, "00:2A:60": true, "00:2A:65": true,
		"00:2A:6E": true, "00:2A:86": true, "00:2A:A2": true, "00:2A:B0": true,
		"00:2A:CF": true, "00:2A:DB": true, "00:2A:E3": true, "00:2A:EF": true,
		"00:2A:F7": true, "00:2B:33": true, "00:2B:59": true, "00:2B:89": true,
		"00:2B:99": true, "00:2B:C4": true, "00:2C:20": true, "00:2C:30": true,
		"00:2C:44": true, "00:2C:60": true, "00:2C:83": true, "00:2C:A7": true,
		"00:2C:B0": true, "00:2C:B7": true, "00:2C:CE": true, "00:2C:D9": true,
		"00:2C:E7": true, "00:2C:EF": true, "00:2C:F7": true, "00:2D:3E": true,
		"00:2D:44": true, "00:2D:63": true, "00:2D:78": true, "00:2D:95": true,
		"00:2D:AA": true, "00:2D:C3": true, "00:2D:CB": true, "00:2E:18": true,
		"00:2E:2E": true, "00:2E:42": true, "00:2E:44": true, "00:2E:60": true,
		"00:2E:92": true, "00:2E:A6": true, "00:2E:C7": true, "00:2E:DB": true,
		"00:2F:1D": true, "00:2F:40": true, "00:2F:4D": true, "00:2F:68": true,
		"00:2F:7F": true, "00:2F:A0": true, "00:2F:B5": true, "00:30:54": true,
		"00:30:5D": true, "00:30:63": true, "00:30:7E": true, "00:30:99": true,
		"00:30:A0": true, "00:30:AB": true, "00:30:B0": true, "00:30:B5": true,
		"00:30:C0": true, "00:30:D2": true, "00:30:DE": true, "00:30:E8": true,
		"00:30:F4": true, "00:31:06": true, "00:31:2C": true, "00:31:47": true,
		"00:31:50": true, "00:31:68": true, "00:31:80": true, "00:31:88": true,
		"00:31:93": true, "00:31:A5": true, "00:31:B9": true, "00:31:C4": true,
		"00:31:D7": true, "00:31:E3": true, "00:31:F2": true, "00:32:00": true,
	}

	result := make(map[string]bool)
	for oui, val := range ouiList {
		result[strings.ToLower(oui)] = val
	}
	return result
}

func initRandomMACPrefixes() map[string]bool {
	prefixes := []string{
		"da:a1:19", "3e:bd:3e", "4e:65:b4", "5e:cf:7c",
		"62:12:92", "6e:8d:6a", "7e:03:9b", "8e:c5:e2",
		"9e:8a:b8", "ae:49:5b", "be:7d:83", "ce:a5:0f",
		"de:6c:2b", "f2:18:98", "3a:87:f5", "42:8c:fc",
		"4a:8a:95", "52:54:00", "5a:5c:36", "66:bb:8a",
		"72:13:57", "76:b8:8b", "7a:65:b8", "82:8d:52",
		"86:5a:60", "8a:8d:5b", "8e:5d:37", "92:fd:77",
		"96:24:f5", "9a:85:e6", "a2:08:b7", "a6:6c:8d",
		"aa:15:88", "b2:9c:58", "b6:79:ce", "ba:3c:da",
		"be:09:f7", "c2:61:1c", "c6:9b:02", "ca:2f:f1",
		"ce:bb:9e", "d2:18:e4", "d6:2d:8c", "da:da:cb",
		"de:51:dc", "e2:f8:a0", "e6:32:f3", "ea:3b:be",
		"ee:d7:2f", "f6:e2:d0", "fa:8b:91", "fe:1d:c9",
		"fe:57:38", "fe:85:5d", "fe:b1:89", "fe:ce:ef",
	}

	result := make(map[string]bool)
	for _, prefix := range prefixes {
		result[prefix] = true
	}
	return result
}

func (d *Deduplicator) ProcessProbe(probe *models.ProbeRequest) (isDuplicate bool, isNewDevice bool, deviceInfo *models.DeviceInfo) {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	isRandomMAC := d.IsLikelyRandomMAC(probe)

	device, exists := d.deviceCache[probe.MACAddress]
	if !exists {
		device = &models.DeviceInfo{
			MACAddress:    probe.MACAddress,
			FirstSeen:     probe.Timestamp,
			LastSeen:      probe.Timestamp,
			IsRandomMAC:   isRandomMAC,
			APHistory:     make(map[string]time.Time),
			SignalHistory: make([]models.SignalPoint, 0, 100),
		}
		d.deviceCache[probe.MACAddress] = device
		isNewDevice = true
	}

	device.APHistory[probe.APID] = probe.Timestamp

	device.SignalHistory = append(device.SignalHistory, models.SignalPoint{
		Timestamp: probe.Timestamp,
		Strength:  probe.SignalStrength,
		APID:      probe.APID,
	})

	device.LastSeen = probe.Timestamp

	if !isNewDevice {
		lastProbeTime := device.SignalHistory[len(device.SignalHistory)-2].Timestamp
		timeSinceLast := probe.Timestamp.Sub(lastProbeTime)
		isDuplicate = timeSinceLast < d.duplicateInterval
	}

	device.SignalHistory = d.cleanOldSignals(device.SignalHistory, probe.Timestamp)

	if !isNewDevice {
		device.IsRandomMAC = d.analyzeDeviceBehavior(device)
	}

	return isDuplicate, isNewDevice, device
}

func (d *Deduplicator) IsLikelyRandomMAC(probe *models.ProbeRequest) bool {
	mac := strings.ToLower(probe.MACAddress)

	if len(mac) < 8 {
		return false
	}

	oui := mac[:8]
	if d.ouiWhitelist[oui] {
		return false
	}

	firstByte := mac[:2]
	b, err := hexToByte(firstByte)
	if err != nil {
		return false
	}

	hasLocalBit := (b & 0x02) != 0
	if !hasLocalBit {
		return false
	}

	if d.randomMACPrefixes[oui] {
		return true
	}

	if probe.SSID == "" {
		return true
	}

	return false
}

func (d *Deduplicator) analyzeDeviceBehavior(device *models.DeviceInfo) bool {
	if len(device.SignalHistory) < 5 {
		return device.IsRandomMAC
	}

	signalVariance := calculateSignalVariance(device.SignalHistory)
	if signalVariance < 2.0 {
		return false
	}

	apCount := len(device.APHistory)
	if apCount > 5 {
		return true
	}

	probeInterval := calculateAverageProbeInterval(device.SignalHistory)
	if probeInterval < 2*time.Second {
		return true
	}

	return device.IsRandomMAC
}

func calculateSignalVariance(points []models.SignalPoint) float64 {
	if len(points) < 2 {
		return 0
	}

	sum := 0
	for _, p := range points {
		sum += p.Strength
	}
	mean := float64(sum) / float64(len(points))

	variance := 0.0
	for _, p := range points {
		diff := float64(p.Strength) - mean
		variance += diff * diff
	}

	return variance / float64(len(points))
}

func calculateAverageProbeInterval(points []models.SignalPoint) time.Duration {
	if len(points) < 2 {
		return time.Hour
	}

	var totalInterval time.Duration
	for i := 1; i < len(points); i++ {
		totalInterval += points[i].Timestamp.Sub(points[i-1].Timestamp)
	}

	return totalInterval / time.Duration(len(points)-1)
}

func (d *Deduplicator) cleanOldSignals(history []models.SignalPoint, now time.Time) []models.SignalPoint {
	cutoff := now.Add(-d.windowSize)
	result := make([]models.SignalPoint, 0, len(history))
	for _, point := range history {
		if point.Timestamp.After(cutoff) {
			result = append(result, point)
		}
	}
	return result
}

func (d *Deduplicator) StartCleanupLoop() {
	ticker := time.NewTicker(d.windowSize)
	defer ticker.Stop()

	for range ticker.C {
		d.cleanup()
	}
}

func (d *Deduplicator) cleanup() {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	cutoff := time.Now().Add(-d.windowSize * 2)
	for mac, device := range d.deviceCache {
		if device.LastSeen.Before(cutoff) {
			delete(d.deviceCache, mac)
		}
	}
}

func (d *Deduplicator) GetDevice(mac string) (*models.DeviceInfo, bool) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()
	device, exists := d.deviceCache[mac]
	return device, exists
}

func (d *Deduplicator) GetActiveDevices() []*models.DeviceInfo {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	devices := make([]*models.DeviceInfo, 0, len(d.deviceCache))
	for _, device := range d.deviceCache {
		devices = append(devices, device)
	}
	return devices
}

func IsRandomMACAddress(mac string) bool {
	if len(mac) < 2 {
		return false
	}

	firstByte := mac[:2]
	b, err := hexToByte(firstByte)
	if err != nil {
		return false
	}

	return (b & 0x02) != 0
}

func hexToByte(hex string) (byte, error) {
	var b byte
	for _, c := range hex {
		b <<= 4
		switch {
		case c >= '0' && c <= '9':
			b |= byte(c - '0')
		case c >= 'a' && c <= 'f':
			b |= byte(c - 'a' + 10)
		case c >= 'A' && c <= 'F':
			b |= byte(c - 'A' + 10)
		}
	}
	return b, nil
}
